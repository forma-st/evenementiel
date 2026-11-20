import { randomBytes } from "crypto";
import type { AutomationRule } from "@prisma/client";
import { db } from "./db";
import { notify } from "./notify";
import { statusOf, BOOKED_STATUSES } from "./format";
import { addDays, startOfDay } from "./tasks";
import { baseUrl, render, varsForDossier, type MergeVars } from "./merge";
import { sendMail } from "./mail";
import { getCompany } from "./company";
import { depositOf, parseLines, totals } from "./quotes";
import { buildPrepList } from "./prep";

export * from "./automationDefs";
import { parseActions, type AutomationAction, type Target } from "./automationDefs";

/* ---------- Exécution ---------- */

type Actor = { id: string; name: string };

async function systemActor(): Promise<Actor | null> {
  return db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
}

/** Exécute les actions d'une règle pour une prestation. Renvoie le résumé des actions faites. */
async function executeRule(rule: AutomationRule, dossierId: string, actor: Actor, depth = 0) {
  const d = await db.dossier.findUnique({ where: { id: dossierId }, include: { client: true } });
  if (!d) return [];
  if (rule.eventTypes && !rule.eventTypes.split(",").includes(d.eventType)) return [];
  let vars: MergeVars = await varsForDossier(dossierId);
  const fill = (s: string) =>
    render(s, vars)
      // anciennes variables courtes, toujours acceptées
      .replaceAll("{client}", d.client.name).replaceAll("{dossier}", d.title).replaceAll("{prestation}", d.title)
      .replaceAll("{reference}", d.reference).replaceAll("{statut}", statusOf(d.status).label).replaceAll("{responsable}", vars.responsable);

  const resolve = async (t: Target): Promise<string[]> => {
    if (t === "DOSSIER_ASSIGNEE") return d.assigneeId ? [d.assigneeId] : [actor.id];
    if (t === "CLIENT_OWNER") return d.client.ownerId ? [d.client.ownerId] : d.assigneeId ? [d.assigneeId] : [actor.id];
    if (t === "ACTOR") return [actor.id];
    if (t === "MANAGERS") return (await db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true } })).map((u) => u.id);
    if (t.startsWith("user:")) return [t.slice(5)];
    return [];
  };

  const done: string[] = [];
  // prêt de matériel : rien vers le client, seulement la préparation interne
  const internalOnly = d.eventType === "PRET";
  for (const a of parseActions(rule.actions)) {
    if (internalOnly && a.kind !== "PREP_LIST" && a.kind !== "NOTIFY") continue;
    try {
      if (a.kind === "SEND_EMAIL") {
        const tpl = await db.emailTemplate.findUnique({ where: { id: a.templateId } });
        if (!tpl) continue;
        const log = await sendMail({ to: d.client.email ?? "", subject: fill(tpl.subject), text: fill(tpl.body), dossierId: d.id, clientId: d.clientId });
        done.push(`e-mail « ${tpl.name} »${log.status === "SIMULE" ? " (simulation)" : log.status === "ERREUR" ? " (échec)" : ""}`);
        if (tpl.body.includes("lien.organisation") && log.status !== "ERREUR") await db.musicPlan.updateMany({ where: { dossierId: d.id, sentAt: null }, data: { sentAt: new Date() } });
      } else if (a.kind === "CREATE_TASK") {
        const [assigneeId] = await resolve(a.assignTo);
        const t = await db.task.create({
          data: {
            title: fill(a.title), description: a.description ? fill(a.description) : null,
            type: a.type || "TACHE", priority: a.priority || "NORMALE",
            dueDate: new Date(addDays(startOfDay(), Math.max(0, a.dueInDays)).getTime() + 12 * 36e5),
            assigneeId: assigneeId ?? null, createdById: actor.id, dossierId: d.id, clientId: d.clientId,
          },
        });
        await notify([assigneeId], { type: "TASK", title: `Nouvelle tâche automatique : ${t.title}`, body: `${d.reference} · ${d.client.name}`, link: `/prestations/${d.id}` }, actor.id);
        done.push(`tâche « ${t.title} »`);
      } else if (a.kind === "NOTIFY") {
        await notify(await resolve(a.to), { type: "SYSTEM", title: fill(a.message), body: `${d.reference} · ${d.client.name}`, link: `/prestations/${d.id}` });
        done.push("notification");
      } else if (a.kind === "SEND_QUESTIONNAIRE") {
        const q = await db.questionnaire.findUnique({ where: { id: a.questionnaireId } });
        if (!q || q.archived) continue;
        let as = await db.questionnaireAssignment.findFirst({ where: { questionnaireId: q.id, dossierId: d.id } });
        if (!as) {
          as = await db.questionnaireAssignment.create({ data: { token: randomBytes(18).toString("base64url"), questionnaireId: q.id, clientId: d.clientId, dossierId: d.id } });
          done.push(`questionnaire « ${q.title} »`);
        }
        // les e-mails suivants de la règle peuvent citer {{lien.questionnaire}}
        vars = { ...vars, "lien.questionnaire": `${baseUrl()}/q/${as.token}` };
      } else if (a.kind === "SET_STATUS") {
        if (d.status === a.status) continue;
        await db.dossier.update({ where: { id: d.id }, data: { status: a.status } });
        await db.activity.create({ data: { dossierId: d.id, userId: actor.id, kind: "STATUS", body: `Statut : ${statusOf(d.status).label} → ${statusOf(a.status).label} (automatique)` } });
        done.push(`statut « ${statusOf(a.status).label} »`);
        if (depth < 2) await runAutomations(d.id, a.status, actor, depth + 1);
      } else if (a.kind === "CREATE_PAYMENTS") {
        if (await createPaymentSchedule(d.id, a.balanceDaysBefore)) done.push("échéancier acompte + solde");
      } else if (a.kind === "PREP_LIST") {
        const list = await buildPrepList(d.id, actor.name);
        const [assigneeId] = await resolve(a.assignTo);
        const units = list.items.reduce((s, i) => s + i.qty, 0);
        const exists = await db.task.findFirst({ where: { dossierId: d.id, title: { startsWith: "Préparer le matériel" }, status: { not: "FAIT" } } });
        if (!exists)
          await db.task.create({
            data: {
              title: `Préparer le matériel : ${d.title}`, type: "TACHE", priority: "HAUTE",
              description: list.items.length ? `${units} unités à préparer, liste à cocher sur la fiche de la prestation.\n\n${list.items.map((i) => `☐ ${i.qty} × ${i.name}`).join("\n")}` : "Aucun matériel réservé : à vérifier sur la fiche de la prestation.",
              dueDate: new Date(addDays(startOfDay(), Math.max(0, a.dueInDays)).getTime() + 12 * 36e5),
              assigneeId: assigneeId ?? null, createdById: actor.id, dossierId: d.id, clientId: d.clientId,
            },
          });
        await notify([assigneeId], { type: "TASK", title: `📋 Liste de préparation prête : ${d.title}`, body: list.items.length ? `${units} unités à préparer` : "Aucun matériel réservé", link: `/prestations/${d.id}#preparation` });
        done.push(`liste de préparation (${list.items.length} article${list.items.length > 1 ? "s" : ""})`);
      } else if (a.kind === "POST_CHANNEL") {
        const general = await db.conversation.findFirst({ where: { kind: "CHANNEL", name: "Général" } });
        if (!general) continue;
        await db.message.create({ data: { conversationId: general.id, userId: actor.id, body: `⚡ ${fill(a.message)}` } });
        await db.conversation.update({ where: { id: general.id }, data: { lastMessageAt: new Date() } });
        done.push("message dans #Général");
      }
    } catch (e) {
      console.error(`Automatisation « ${rule.name} » :`, e);
    }
  }
  if (done.length)
    await db.activity.create({ data: { dossierId: d.id, userId: actor.id, kind: "AUTO", body: `⚡ ${rule.name} : ${done.join(", ")}` } });
  return done;
}

/** Échéancier : acompte (à la réservation) + solde (X jours avant l'événement), sauf s'il existe déjà. */
export async function createPaymentSchedule(dossierId: string, balanceDaysBefore = 7) {
  if (await db.payment.count({ where: { dossierId } })) return false;
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { quotes: { orderBy: { createdAt: "desc" } } } });
  const c = await getCompany();
  const q = d.quotes.find((x) => x.status === "ACCEPTE") ?? d.quotes.find((x) => x.status !== "REFUSE");
  const t = q ? totals(parseLines(q.lines), q.discount) : null;
  const total = t ? (c.vatExempt ? t.totalHT : t.totalTTC) : d.amount ?? 0;
  if (!total) return false;
  const pct = q?.depositPercent ?? d.depositPercent;
  const dep = depositOf(total, pct);
  const data = [];
  if (dep > 0) data.push({ dossierId, label: `Acompte ${pct} %`, amount: dep, dueDate: addDays(startOfDay(), 7) });
  data.push({ dossierId, label: "Solde", amount: Math.round((total - dep) * 100) / 100, dueDate: d.eventStart ? addDays(d.eventStart, -balanceDaysBefore) : null });
  await db.payment.createMany({ data });
  return true;
}

/** Règles « changement de statut ». Appelée à la création d'une prestation et à chaque changement de statut. */
export async function runAutomations(dossierId: string, newStatus: string, actor: Actor, depth = 0) {
  const rules = await db.automationRule.findMany({ where: { active: true, trigger: "STATUS", toStatus: newStatus } });
  for (const rule of rules) await executeRule(rule, dossierId, actor, depth);
}

/** Déclencheurs immédiats (devis accepté, contrat signé, galerie publiée). `key` évite d'exécuter deux fois pour le même objet. */
export async function runTrigger(trigger: "GALLERY_PUBLISHED" | "CONTRACT_SIGNED" | "QUOTE_ACCEPTED" | "PAYMENT_RECEIVED", dossierId: string, key: string, actor?: Actor | null) {
  const who = actor ?? (await systemActor());
  if (!who) return;
  const rules = await db.automationRule.findMany({ where: { active: true, trigger } });
  for (const rule of rules) {
    try {
      await db.automationRun.create({ data: { ruleId: rule.id, dossierId, key } });
    } catch {
      continue; // déjà exécutée
    }
    await executeRule(rule, dossierId, who);
  }
}

const allowedStatuses = (r: AutomationRule) => (r.onlyStatuses ? r.onlyStatuses.split(",") : BOOKED_STATUSES);

/**
 * Règles planifiées (appelées une fois par jour par /api/cron, ou à la main).
 * Chaque règle n'est exécutée qu'une fois par prestation (et par devis / paiement).
 */
export async function runScheduled(now = new Date()) {
  const actor = await systemActor();
  if (!actor) return { executed: 0, details: [] as string[] };
  const rules = await db.automationRule.findMany({ where: { active: true, trigger: { in: ["EVENT_OFFSET", "QUOTE_NO_REPLY", "PAYMENT_LATE"] } } });
  const today = startOfDay(now);
  const details: string[] = [];
  let executed = 0;

  const once = async (rule: AutomationRule, dossierId: string, key: string) => {
    try {
      await db.automationRun.create({ data: { ruleId: rule.id, dossierId, key } });
    } catch {
      return; // déjà fait
    }
    const done = await executeRule(rule, dossierId, actor);
    executed++;
    details.push(`${rule.name} → ${dossierId}${done.length ? ` (${done.join(", ")})` : ""}`);
  };

  for (const rule of rules) {
    if (rule.trigger === "EVENT_OFFSET") {
      // l'événement tombe à J - offset ; fenêtre de rattrapage de 3 jours (cron manqué)
      const from = addDays(today, -rule.offsetDays - 3);
      const to = addDays(today, -rule.offsetDays + 1);
      const list = await db.dossier.findMany({ where: { status: { in: allowedStatuses(rule) }, eventStart: { gte: from, lt: to } }, select: { id: true } });
      for (const d of list) await once(rule, d.id, "");
    } else if (rule.trigger === "QUOTE_NO_REPLY") {
      const limit = addDays(now, -Math.max(1, rule.offsetDays));
      const quotes = await db.quote.findMany({
        where: { status: { in: ["ENVOYE"] }, sentAt: { lte: limit, gte: addDays(limit, -10) }, dossierId: { not: null }, validUntil: { gte: today } },
        select: { id: true, dossierId: true, dossier: { select: { status: true } } },
      });
      for (const q of quotes) if (q.dossier && !["PERDU", "CLOTURE"].includes(q.dossier.status)) await once(rule, q.dossierId!, q.id);
    } else if (rule.trigger === "PAYMENT_LATE") {
      const limit = addDays(today, -Math.max(0, rule.offsetDays));
      const pays = await db.payment.findMany({ where: { paidAt: null, dueDate: { lte: limit, gte: addDays(limit, -15) } }, select: { id: true, dossierId: true, dossier: { select: { status: true } } } });
      for (const p of pays) if (p.dossier && p.dossierId && p.dossier.status !== "PERDU") await once(rule, p.dossierId, p.id);
    }
  }

  // devis dont la validité est dépassée
  await db.quote.updateMany({ where: { status: { in: ["ENVOYE"] }, validUntil: { lt: today } }, data: { status: "EXPIRE" } });
  // prestations confirmées dont la date est passée -> réalisées
  const past = await db.dossier.findMany({ where: { status: "CONFIRME", eventEnd: { lt: today } }, select: { id: true } });
  for (const p of past) {
    await db.dossier.update({ where: { id: p.id }, data: { status: "REALISE" } });
    await db.activity.create({ data: { dossierId: p.id, kind: "STATUS", body: "Statut : Confirmée → Réalisée (date passée)" } });
    await runAutomations(p.id, "REALISE", actor);
  }
  // rappel de déclaration URSSAF (7 jours avant la date limite, une fois par période)
  try {
    const { getUrssaf, periodsOfYear, periodOf, turnoverBetween } = await import("./urssaf");
    const st = await getUrssaf();
    const y = new Date().getFullYear();
    for (const p of [...periodsOfYear(y - 1, st.frequency, st.creationDate), ...periodsOfYear(y, st.frequency, st.creationDate)].map((x) => periodOf(x.id))) {
      if (p.end > now || p.deadline < now || p.deadline.getTime() - now.getTime() > 7 * 864e5) continue;
      if (await db.urssafDeclaration.findUnique({ where: { period: p.id } })) continue;
      const key = `urssaf.reminder.${p.id}`;
      if (await db.setting.findUnique({ where: { key } })) continue;
      await db.setting.create({ data: { key, value: now.toISOString() } });
      const ca = await turnoverBetween(p.start, p.end);
      const managers = await db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true } });
      await notify(managers.map((m) => m.id), { type: "SYSTEM", title: `📊 Déclaration URSSAF ${p.label} à faire avant le ${p.deadline.toLocaleDateString("fr-FR")}`, body: `Chiffre d'affaires encaissé : ${ca.toLocaleString("fr-FR")} €`, link: "/comptabilite" });
      details.push(`rappel URSSAF ${p.id}`);
    }
  } catch (e) {
    console.error("Rappel URSSAF :", e);
  }
  await db.setting.upsert({ where: { key: "automations.lastRun" }, update: { value: now.toISOString() }, create: { key: "automations.lastRun", value: now.toISOString() } });
  return { executed, details };
}
