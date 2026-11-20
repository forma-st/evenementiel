"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { rateLimit, requestInfo, tooMany } from "@/lib/security";
import { writePlan } from "@/lib/plan";
import { clientEditable, type MusicData } from "@/lib/music";
import { notify } from "@/lib/notify";
import { eur } from "@/lib/format";

async function load(token: string) {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
  const p = await db.musicPlan.findFirst({ where: { token }, include: { dossier: { select: { id: true, title: true, status: true, eventStart: true, assigneeId: true, client: { select: { name: true, ownerId: true } } } } } });
  if (!p || ["PERDU", "CLOTURE"].includes(p.dossier.status)) return null;
  return p;
}
async function limit(token: string) {
  const lim = await rateLimit(`plan:${(await requestInfo()).ip}:${token.slice(0, 8)}`, 120, 60 * 60e3);
  return lim.ok ? null : tooMany(lim.retryAfter);
}

/** Enregistrement par le client depuis le lien reçu (sans compte). */
export async function savePlanByToken(token: string, data: MusicData) {
  const e = await limit(token); if (e) return { error: e };
  const p = await load(token);
  if (!p) return { error: "Ce lien n'est plus valide." };
  const r = await writePlan(p.dossierId, data, { name: p.dossier.client.name, client: true });
  revalidatePath(`/e/${token}`);
  return r;
}

/** Demande d'option : un article du catalogue proposé, ou une demande libre. */
export async function requestOption(token: string, input: { catalogItemId?: string; label?: string; quantity?: number; note?: string }) {
  const e = await limit(token); if (e) return { error: e };
  const p = await load(token);
  if (!p) return { error: "Ce lien n'est plus valide." };
  if (!clientEditable(p, p.dossier.eventStart).editable) return { error: "Les demandes ne sont plus possibles en ligne : contactez-nous directement." };
  const open = await db.optionRequest.count({ where: { dossierId: p.dossierId, status: "DEMANDE" } });
  if (open >= 20) return { error: "Trop de demandes en attente." };
  const qty = Math.max(1, Math.min(999, Math.round(Number(input.quantity) || 1)));
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) || null : null;
  let row: { catalogItemId: string | null; label: string; unitPrice: number; vatRate: number; unit: string };
  if (input.catalogItemId) {
    const it = await db.catalogItem.findFirst({ where: { id: input.catalogItemId, active: true, clientOption: true } });
    if (!it) return { error: "Cette option n'est plus proposée." };
    row = { catalogItemId: it.id, label: it.label, unitPrice: it.unitPrice, vatRate: it.vatRate, unit: it.unit };
  } else {
    const label = typeof input.label === "string" ? input.label.trim().slice(0, 200) : "";
    if (!label) return { error: "Décrivez ce que vous souhaitez ajouter." };
    row = { catalogItemId: null, label, unitPrice: 0, vatRate: 20, unit: "forfait" };
  }
  await db.optionRequest.create({ data: { dossierId: p.dossierId, ...row, quantity: qty, note } });
  await db.activity.create({ data: { dossierId: p.dossierId, kind: "QUOTE", body: `➕ Option demandée par le client : ${qty > 1 ? `${qty} × ` : ""}${row.label}${row.unitPrice ? ` (${eur(row.unitPrice * qty)} HT)` : ""}${note ? ` — « ${note} »` : ""}` } });
  await notify([p.dossier.assigneeId, p.dossier.client.ownerId], { type: "SYSTEM", title: `➕ ${p.dossier.client.name} demande une option : ${row.label}`, body: "À valider sur la prestation.", link: `/prestations/${p.dossierId}#options` });
  revalidatePath(`/e/${token}`);
  return { ok: true };
}

export async function cancelOption(token: string, id: string) {
  const p = await load(token);
  if (!p) return { error: "Ce lien n'est plus valide." };
  await db.optionRequest.deleteMany({ where: { id, dossierId: p.dossierId, status: "DEMANDE" } });
  revalidatePath(`/e/${token}`);
  return { ok: true };
}
