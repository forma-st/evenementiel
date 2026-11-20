"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { dossierWhere, permsFor } from "@/lib/permissions";
import { fromParis, dateTime } from "@/lib/format";
import { INTERNAL_CLIENT } from "@/lib/presta";
import { render, varsForDossier } from "@/lib/merge";
import { sendMail } from "@/lib/mail";
import { rateLimit } from "@/lib/security";

export type BulkFilters = { from: string; to: string; types: string[]; statuses: string[]; onePerClient: boolean };
export type Recipient = { dossierId: string; reference: string; title: string; client: string; email: string | null; date: string | null; status: string };

const MAX = 300;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Prestations correspondant aux filtres (visibles par l'utilisateur), un destinataire par client si demandé. */
async function select(f: BulkFilters): Promise<Recipient[]> {
  const user = await requireStaff();
  const p = await permsFor(user);
  const types = (f.types ?? []).filter((x) => typeof x === "string").slice(0, 20);
  const statuses = (f.statuses ?? []).filter((x) => typeof x === "string").slice(0, 10);
  const ds = await db.dossier.findMany({
    where: {
      AND: [
        dossierWhere(user, p),
        isDay(f.from) ? { eventStart: { gte: fromParis(f.from) } } : {},
        isDay(f.to) ? { eventStart: { lt: new Date(fromParis(f.to).getTime() + 864e5) } } : {},
        types.length ? { eventType: { in: types } } : {},
        statuses.length ? { status: { in: statuses } } : {},
        { eventType: { not: "PRET" } },
        { client: { name: { not: INTERNAL_CLIENT } } },
      ],
    },
    orderBy: { eventStart: "asc" },
    take: 1000,
    select: { id: true, reference: true, title: true, status: true, eventStart: true, client: { select: { name: true, email: true } } },
  });
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const d of ds) {
    const key = d.client.email?.toLowerCase() || `#${d.client.name}`;
    if (f.onePerClient && seen.has(key)) continue;
    seen.add(key);
    out.push({ dossierId: d.id, reference: d.reference, title: d.title, client: d.client.name, email: d.client.email, date: d.eventStart?.toISOString() ?? null, status: d.status });
  }
  return out;
}

export async function previewBulk(f: BulkFilters) {
  const list = await select(f);
  const first = list.find((r) => r.email);
  return { list, sample: first ? await varsForDossier(first.dossierId) : null };
}

export async function sendBulk(f: BulkFilters, exclude: string[], subject: string, body: string) {
  const user = await requireStaff();
  subject = subject.trim().slice(0, 300);
  body = body.slice(0, 20000);
  if (!subject || !body.trim()) return { error: "Indiquez l'objet et le message." };
  if (!(await rateLimit(`bulk:${user.id}`, 10, 36e5)).ok) return { error: "Trop d'envois groupés en une heure. Réessayez plus tard." };
  const skip = new Set(exclude);
  const list = (await select(f)).filter((r) => !skip.has(r.dossierId) && r.email);
  if (!list.length) return { error: "Aucun destinataire avec une adresse e-mail." };
  if (list.length > MAX) return { error: `${list.length} destinataires : c'est plus que la limite de ${MAX} par envoi. Réduisez la période.` };
  const bulk = await db.bulkEmail.create({ data: { subject, body, filters: JSON.stringify(f), recipients: list.length, createdById: user.id } });
  let sent = 0, failed = 0, simulated = 0;
  for (const r of list) {
    const vars = await varsForDossier(r.dossierId);
    const log = await sendMail({ to: r.email!, subject: render(subject, vars), text: render(body, vars), dossierId: r.dossierId, replyTo: user.email });
    await db.emailLog.update({ where: { id: log.id }, data: { bulkId: bulk.id } }).catch(() => {});
    if (log.status === "ERREUR") failed++; else if (log.status === "SIMULE") simulated++; else sent++;
    await db.activity.create({ data: { dossierId: r.dossierId, userId: user.id, kind: "EMAIL", body: `✉ E-mail groupé « ${render(subject, vars)} »${log.status === "SIMULE" ? " (simulation)" : log.status === "ERREUR" ? " — échec" : ""}` } });
  }
  await db.bulkEmail.update({ where: { id: bulk.id }, data: { sent, failed, simulated } });
  revalidatePath("/emails");
  return { ok: `${list.length} e-mail(s) traité(s) le ${dateTime(new Date())} : ${sent} envoyé(s)${simulated ? `, ${simulated} en simulation (Resend non configuré)` : ""}${failed ? `, ${failed} en échec` : ""}.` };
}
