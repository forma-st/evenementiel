"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible, requirePerm } from "@/lib/permissions";
import { getCompany } from "@/lib/company";
import { eur } from "@/lib/format";
import { totals, type QuoteLine } from "@/lib/quotes";
import { CAUTION_STATUSES, parseJson, rentalDays, type Checkin, type CheckinItem, type CheckoutItem } from "@/lib/rental";

async function load(dossierId: string) {
  const user = await requireStaff();
  await assertDossierVisible(user, dossierId);
  const d = await db.dossier.findUniqueOrThrow({ where: { id: dossierId }, include: { equipment: { include: { equipment: true } } } });
  return { user, d };
}

/** Devis de location : une ligne par matériel réservé (tarif à la journée × jours × quantité). */
export async function createRentalQuote(dossierId: string) {
  const { user, d } = await load(dossierId);
  await requirePerm(user, "canCreateQuotes", "créer des devis");
  const c = await getCompany();
  const days = rentalDays(d.eventStart, d.eventEnd);
  const lines: QuoteLine[] = d.equipment.map((x) => ({
    label: `Location ${x.equipment.name}`,
    description: `${x.quantity} unité${x.quantity > 1 ? "s" : ""} × ${days} jour${days > 1 ? "s" : ""}`,
    quantity: x.quantity * days, unit: "day", unitPrice: x.equipment.dailyRate ?? 0, vatRate: c.vatExempt ? 0 : 20,
  }));
  if (!lines.length) lines.push({ label: "Location de matériel", quantity: days, unit: "day", unitPrice: 0, vatRate: c.vatExempt ? 0 : 20 });
  const t = totals(lines, 0);
  const year = new Date().getFullYear();
  const last = await db.quote.findFirst({ where: { number: { startsWith: `DEV-${year}-` } }, orderBy: { number: "desc" }, select: { number: true } });
  const number = `DEV-${year}-${String((last?.number ? Number(last.number.split("-")[2]) || 0 : 0) + 1).padStart(4, "0")}`;
  const q = await db.quote.create({
    data: {
      clientId: d.clientId, dossierId, label: `Location de matériel — ${days} jour${days > 1 ? "s" : ""}`, number, token: randomBytes(18).toString("base64url"),
      lines: JSON.stringify(lines), totalHT: t.totalHT, totalTTC: t.totalTTC, depositPercent: d.depositPercent, validUntil: new Date(Date.now() + 30 * 864e5),
      notes: [d.cautionAmount ? `Caution de ${eur(d.cautionAmount)} demandée au retrait du matériel, restituée au retour après vérification.` : null, "Matériel vérifié au départ et au retour ; casse ou perte facturée à la valeur de remplacement."].filter(Boolean).join("\n"),
    },
  });
  await db.activity.create({ data: { dossierId, userId: user.id, kind: "QUOTE", body: `Devis de location ${number} créé (${days} jour${days > 1 ? "s" : ""})` } });
  redirect(`/devis/${q.id}/modifier`);
}

export async function setCautionStatus(dossierId: string, status: string, f: FormData) {
  const { user } = await load(dossierId);
  if (!(status in CAUTION_STATUSES)) return;
  const note = String(f.get("note") ?? "").trim().slice(0, 500) || null;
  await db.dossier.update({ where: { id: dossierId }, data: { cautionStatus: status, cautionNote: note } });
  await db.activity.create({ data: { dossierId, userId: user.id, kind: "PAYMENT", body: `🔐 Caution : ${CAUTION_STATUSES[status].label.toLowerCase()}${note ? ` (${note})` : ""}` } });
  revalidatePath(`/prestations/${dossierId}`);
}

/** État des lieux de départ (matériel remis au client). */
export async function saveCheckout(dossierId: string, items: CheckoutItem[], notes: string) {
  const { user, d } = await load(dossierId);
  const known = new Map(d.equipment.map((x) => [x.equipmentId, x]));
  const clean = items.filter((i) => known.has(i.id)).map((i) => ({ id: i.id, name: known.get(i.id)!.equipment.name, qty: Math.max(0, Math.round(i.qty)), ok: !!i.ok }));
  await db.dossier.update({ where: { id: dossierId }, data: { checkout: JSON.stringify({ at: new Date().toISOString(), by: user.name, items: clean, notes: notes.slice(0, 3000) }) } });
  await db.activity.create({ data: { dossierId, userId: user.id, kind: "STATUS", body: `📦 Matériel remis au client : ${clean.reduce((a, i) => a + i.qty, 0)} unités${notes ? ` — ${notes.slice(0, 200)}` : ""}` } });
  revalidatePath(`/prestations/${dossierId}`);
  return { ok: true };
}

/** État des lieux de retour : quantités rendues, abîmées ; montant des dommages calculé avec la valeur de remplacement. */
export async function saveCheckin(dossierId: string, items: CheckinItem[], notes: string) {
  const { user, d } = await load(dossierId);
  const known = new Map(d.equipment.map((x) => [x.equipmentId, x]));
  const clean = items.filter((i) => known.has(i.id)).map((i) => {
    const qty = known.get(i.id)!.quantity;
    const returned = Math.min(qty, Math.max(0, Math.round(i.returned)));
    return { id: i.id, name: known.get(i.id)!.equipment.name, qty, returned, damaged: Math.min(returned, Math.max(0, Math.round(i.damaged))), note: String(i.note ?? "").slice(0, 300) };
  });
  const damages = clean.reduce((a, i) => a + ((i.qty - i.returned) + i.damaged) * (known.get(i.id)!.equipment.replacementValue ?? 0), 0);
  // un prêt rendu est terminé : il passe en « Réalisée » et libère le matériel tout de suite
  const loanDone = d.eventType === "PRET" ? { status: "REALISE", eventEnd: d.eventEnd && d.eventStart && d.eventEnd > new Date() && d.eventStart < new Date() ? new Date() : d.eventEnd } : {};
  await db.dossier.update({ where: { id: dossierId }, data: { checkin: JSON.stringify({ at: new Date().toISOString(), by: user.name, items: clean, notes: notes.slice(0, 3000), damages }), ...loanDone } });
  const missing = clean.reduce((a, i) => a + i.qty - i.returned, 0), broken = clean.reduce((a, i) => a + i.damaged, 0);
  await db.activity.create({ data: { dossierId, userId: user.id, kind: "STATUS", body: `📦 Retour du matériel : ${missing || broken ? `${missing} manquant(s), ${broken} abîmé(s), dommages estimés ${eur(damages)}` : "tout est rendu en bon état"}` } });
  revalidatePath(`/prestations/${dossierId}`);
  return { ok: true };
}

/** Brouillon de facture des dommages (matériel manquant ou abîmé). */
export async function invoiceDamages(dossierId: string) {
  const { user, d } = await load(dossierId);
  await requirePerm(user, "canCreateQuotes", "créer des factures");
  const ci = parseJson<Checkin>(d.checkin);
  if (!ci) return;
  const c = await getCompany();
  const val = new Map(d.equipment.map((x) => [x.equipmentId, x.equipment.replacementValue ?? 0]));
  const lines: QuoteLine[] = ci.items.flatMap((i) => [
    ...(i.qty - i.returned > 0 ? [{ label: `${i.name} — non rendu`, description: i.note || undefined, quantity: i.qty - i.returned, unit: "piece", unitPrice: val.get(i.id) ?? 0, vatRate: c.vatExempt ? 0 : 20 }] : []),
    ...(i.damaged > 0 ? [{ label: `${i.name} — endommagé`, description: i.note || undefined, quantity: i.damaged, unit: "piece", unitPrice: val.get(i.id) ?? 0, vatRate: c.vatExempt ? 0 : 20 }] : []),
  ]);
  if (!lines.length) return;
  const t = totals(lines, 0);
  const inv = await db.invoice.create({
    data: { kind: "FACTURE", label: "Matériel manquant ou endommagé", clientId: d.clientId, dossierId, lines: JSON.stringify(lines), totalHT: t.totalHT, totalTVA: t.vat, totalTTC: t.totalTTC, serviceDate: d.eventEnd, notes: d.cautionAmount ? "Montant déductible de la caution versée." : null },
  });
  redirect(`/factures/${inv.id}/modifier`);
}
