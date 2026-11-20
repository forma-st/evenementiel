/**
 * Migrations de données exécutées à chaque déploiement (idempotentes).
 * Crée une seule fois le contenu de départ : questionnaires, modèles d'e-mails et de contrats,
 * catalogue, matériel, automatisations et canal de discussion « Général ».
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function once(key: string, fn: () => Promise<void>) {
  if (await db.setting.findUnique({ where: { key } })) return;
  await fn();
  await db.setting.create({ data: { key, value: new Date().toISOString() } });
}

async function main() {
  const T = await import("../src/lib/questionnaireTemplates");
  const D = await import("../src/lib/defaults");

  await once("seed.questionnaires.v1", async () => {
    for (const t of [T.DEMANDE_DEVIS, T.PREPARATION_SOIREE, T.PREPARATION_PHOTO, T.SATISFACTION])
      await db.questionnaire.create({ data: { title: t.title, description: t.description, fields: JSON.stringify(t.fields) } });
    console.log("Questionnaires créés.");
  });

  await once("seed.emails.v1", async () => {
    const ids: Record<string, string> = {};
    for (const e of D.DEFAULT_EMAILS) ids[e.key] = (await db.emailTemplate.create({ data: { name: e.name, subject: e.subject, body: e.body } })).id;
    await db.setting.create({ data: { key: "seed.emails.ids", value: JSON.stringify(ids) } });
    console.log("Modèles d'e-mails créés.");
  });

  await once("seed.contracts.v1", async () => {
    for (const c of D.DEFAULT_CONTRACTS) await db.contractTemplate.create({ data: c });
    console.log("Modèles de contrats créés.");
  });

  await once("seed.catalog.v1", async () => {
    let i = 0;
    for (const c of D.DEFAULT_CATALOG) await db.catalogItem.create({ data: { ...c, position: i++ } });
    console.log("Catalogue créé.");
  });

  await once("seed.equipment.v1", async () => {
    await db.equipment.createMany({ data: D.DEFAULT_EQUIPMENT });
    console.log("Parc matériel créé.");
  });

  await once("seed.automations.v1", async () => {
    const row = await db.setting.findUnique({ where: { key: "seed.emails.ids" } });
    const email = row ? (JSON.parse(row.value) as Record<string, string>) : {};
    const find = async (title: string) => (await db.questionnaire.findFirst({ where: { title, archived: false }, orderBy: { createdAt: "asc" } }))?.id ?? null;
    const rules = D.defaultRules({
      email,
      demande: await find(T.DEMANDE_DEVIS.title),
      prepaDj: await find(T.PREPARATION_SOIREE.title),
      satisfaction: await find(T.SATISFACTION.title),
    });
    for (const r of rules)
      await db.automationRule.create({
        data: { name: r.name, trigger: r.trigger, toStatus: r.toStatus ?? "", offsetDays: r.offsetDays ?? 0, onlyStatuses: r.onlyStatuses ?? "", eventTypes: r.eventTypes ?? "", actions: JSON.stringify(r.actions) },
      });
    console.log("Automatisations créées.");
  });

  // Lien de paiement en ligne dans les e-mails existants (sans écraser vos modifications)
  await once("seed.emails.paylink.v1", async () => {
    const add: Record<string, string> = {
      "Confirmation de réservation": "Régler l'acompte en ligne (carte ou virement) : {{lien.paiement}}",
      "Rappel du solde": "Régler en ligne (carte ou virement) : {{lien.paiement}}",
      "Relance paiement en retard": "Régler en ligne (carte ou virement) : {{lien.paiement}}",
    };
    for (const [name, line] of Object.entries(add)) {
      const t = await db.emailTemplate.findFirst({ where: { name } });
      if (!t || t.body.includes("{{lien.paiement}}")) continue;
      const parts = t.body.split("\n\n");
      parts.splice(Math.max(1, parts.length - 1), 0, line);
      await db.emailTemplate.update({ where: { id: t.id }, data: { body: parts.join("\n\n") } });
    }
  });

  // Règle « J-3 : liste de préparation du matériel » pour les installations existantes
  await once("seed.catalog.clientOptions.v1", async () => {
    const n = await db.catalogItem.updateMany({ where: { active: true, category: { in: ["OPTION", "PHOTOBOOTH"] } }, data: { clientOption: true } });
    console.log(`${n.count} option(s) du catalogue proposée(s) aux clients.`);
  });

  await once("seed.organisation.v1", async () => {
    const tpl = async (e: { name: string; subject: string; body: string }) =>
      (await db.emailTemplate.findFirst({ where: { name: e.name } })) ?? (await db.emailTemplate.create({ data: e }));
    const invite = await tpl(D.ORGANISATION_EMAIL);
    const remind = await tpl(D.ORGANISATION_REMINDER);
    if (!(await db.automationRule.findFirst({ where: { name: "Prestation confirmée : espace organisation au client" } })))
      await db.automationRule.create({ data: { name: "Prestation confirmée : espace organisation au client", trigger: "STATUS", toStatus: "CONFIRME", eventTypes: D.ORGANISATION_EVENT_TYPES, actions: JSON.stringify([{ kind: "SEND_EMAIL", templateId: invite.id }]) } });
    if (!(await db.automationRule.findFirst({ where: { name: "J-10 : rappel de l'espace organisation" } })))
      await db.automationRule.create({ data: { name: "J-10 : rappel de l'espace organisation", trigger: "EVENT_OFFSET", offsetDays: -10, onlyStatuses: "CONFIRME", eventTypes: D.ORGANISATION_EVENT_TYPES, actions: JSON.stringify([{ kind: "SEND_EMAIL", templateId: remind.id }]) } });
    console.log("Espace organisation : modèles et automatisations créés.");
  });

  await once("seed.automations.prep.v1", async () => {
    if (await db.automationRule.findFirst({ where: { name: "J-3 : liste de préparation du matériel" } })) return;
    await db.automationRule.create({
      data: { name: "J-3 : liste de préparation du matériel", trigger: "EVENT_OFFSET", offsetDays: -3, onlyStatuses: "CONFIRME", actions: JSON.stringify([{ kind: "PREP_LIST", dueInDays: 1, assignTo: "DOSSIER_ASSIGNEE" }]) },
    });
  });

  // Canal Général
  let general = await db.conversation.findFirst({ where: { kind: "CHANNEL", name: "Général" } });
  if (!general) general = await db.conversation.create({ data: { kind: "CHANNEL", name: "Général" } });
  const staff = await db.user.findMany({ where: { role: { not: "CLIENT" } }, select: { id: true } });
  const members = await db.conversationMember.findMany({ where: { conversationId: general.id }, select: { userId: true } });
  const missing = staff.filter((u) => !members.some((m) => m.userId === u.id));
  if (missing.length) await db.conversationMember.createMany({ data: missing.map((u) => ({ conversationId: general.id, userId: u.id })) });
}

main()
  .catch((e) => {
    console.error("Migration de données :", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
