"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { requirePerm } from "@/lib/permissions";
import { getCompany } from "@/lib/company";
import { type QuoteLine, parseLines, totals } from "@/lib/quotes";
import { buildInvoiceFiles, buyerSnapshot, sellerSnapshot, INVOICE_KINDS } from "@/lib/invoices";
import { refreshInvoiceStatus } from "@/lib/invoiceStatus";
import { sendMail } from "@/lib/mail";
import { date, eur, fromParis } from "@/lib/format";
import { eventKind } from "@/lib/presta";

export type InvoiceFormState = { error?: string } | null;
const s = (f: FormData, k: string) => { const v = f.get(k); return v == null || String(v).trim() === "" ? null : String(v).trim(); };
const r2 = (n: number) => Math.round(n * 100) / 100;

async function guard(what = "gérer les factures") {
  const u = await requireStaff();
  await requirePerm(u, "canCreateQuotes", what);
  return u;
}

async function amounts(lines: QuoteLine[], discount: number) {
  const c = await getCompany();
  const ls = c.vatExempt ? lines.map((l) => ({ ...l, vatRate: 0 })) : lines;
  const t = totals(ls, discount);
  return { lines: ls, totalHT: t.totalHT, totalTVA: t.vat, totalTTC: t.totalTTC };
}

/** Acomptes déjà facturés (émis, non annulés) pour une prestation. */
async function depositsInvoiced(dossierId: string | null, quoteId: string | null) {
  if (!dossierId && !quoteId) return 0;
  const a = await db.invoice.aggregate({ where: { kind: "ACOMPTE", status: { in: ["EMISE", "PAYEE"] }, OR: [dossierId ? { dossierId } : {}, quoteId ? { quoteId } : {}] }, _sum: { totalTTC: true } });
  return r2(a._sum.totalTTC ?? 0);
}

/** Brouillon de facture depuis une échéance : acompte (échéances intermédiaires) ou facture finale (dernière échéance / solde). */
export async function invoiceFromPayment(paymentId: string) {
  await guard();
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { dossier: { include: { quotes: { orderBy: { createdAt: "desc" } }, payments: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] } } } } });
  if (p.invoiceId) redirect(`/factures/${p.invoiceId}`);
  const d = p.dossier;
  if (!d) return;
  const q = d.quotes.find((x) => x.status === "ACCEPTE") ?? d.quotes[0] ?? null;
  const last = d.payments[d.payments.length - 1]?.id === p.id || /solde/i.test(p.label);
  const c = await getCompany();
  const serviceDate = d.eventStart;
  let data;
  if (last && q) {
    const a = await amounts(parseLines(q.lines), q.discount);
    data = { kind: "FACTURE", label: q.label, lines: JSON.stringify(a.lines), discount: q.discount, deducted: await depositsInvoiced(d.id, q.id), totalHT: a.totalHT, totalTVA: a.totalTVA, totalTTC: a.totalTTC };
  } else {
    const rate = c.vatExempt ? 0 : parseLines(q?.lines ?? "[]")[0]?.vatRate ?? 20;
    const ht = r2(p.amount / (1 + rate / 100));
    const line: QuoteLine = { label: `${p.label} — ${eventKind(d.eventType).label}${d.eventStart ? ` du ${date(d.eventStart)}` : ""}`, description: q ? `Selon devis ${q.number} accepté (total ${eur(q.totalTTC)} TTC)` : undefined, quantity: 1, unitPrice: ht, vatRate: rate, unit: "forfait" };
    data = { kind: "ACOMPTE", label: `${p.label} — ${d.title}`, lines: JSON.stringify([line]), discount: 0, deducted: 0, totalHT: ht, totalTVA: r2(p.amount - ht), totalTTC: p.amount };
  }
  const inv = await db.invoice.create({ data: { ...data, clientId: d.clientId, dossierId: d.id, quoteId: q?.id ?? null, serviceDate, dueDate: p.dueDate } });
  await db.payment.update({ where: { id: p.id }, data: { invoiceId: inv.id } });
  redirect(`/factures/${inv.id}`);
}

/** Brouillon de facture complète depuis un devis (sans échéancier). */
export async function invoiceFromQuote(quoteId: string) {
  await guard();
  const q = await db.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { dossier: true } });
  const a = await amounts(parseLines(q.lines), q.discount);
  const inv = await db.invoice.create({
    data: { kind: "FACTURE", label: q.label, clientId: q.clientId, dossierId: q.dossierId, quoteId: q.id, lines: JSON.stringify(a.lines), discount: q.discount, deducted: await depositsInvoiced(q.dossierId, q.id), totalHT: a.totalHT, totalTVA: a.totalTVA, totalTTC: a.totalTTC, serviceDate: q.dossier?.eventStart ?? null },
  });
  redirect(`/factures/${inv.id}`);
}

export async function saveInvoice(id: string | null, _: InvoiceFormState, f: FormData): Promise<InvoiceFormState> {
  try { await guard(); } catch (e) { return { error: (e as Error).message }; }
  let lines: QuoteLine[] = [];
  try { lines = JSON.parse(String(f.get("lines") || "[]")); } catch { return { error: "Lignes invalides" }; }
  lines = lines.filter((l) => l.label && l.quantity > 0);
  const clientId = s(f, "clientId");
  if (!clientId) return { error: "Choisissez un client." };
  if (!lines.length) return { error: "Ajoutez au moins une ligne." };
  const discount = Math.max(0, Number((s(f, "discount") ?? "0").replace(",", ".")) || 0);
  const a = await amounts(lines, discount);
  const due = s(f, "dueDate"), svc = s(f, "serviceDate");
  const data = {
    clientId, dossierId: s(f, "dossierId"), label: s(f, "label") || "Facture", lines: JSON.stringify(a.lines), discount,
    totalHT: a.totalHT, totalTVA: a.totalTVA, totalTTC: a.totalTTC, notes: s(f, "notes"),
    dueDate: due ? fromParis(due, "12:00") : null, serviceDate: svc ? fromParis(svc, "12:00") : null,
  };
  let invId = id;
  if (id) {
    const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "BROUILLON") return { error: "Une facture émise n'est plus modifiable : faites un avoir." };
    await db.invoice.update({ where: { id }, data });
  } else invId = (await db.invoice.create({ data })).id;
  if (f.get("andSend") === "1") await issue(invId!);
  redirect(`/factures/${invId}`);
}

/** Émission : numéro définitif (suite continue par année), coordonnées figées, plus de modification possible. */
async function issue(id: string) {
  const c = await getCompany();
  await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { client: true } });
    if (inv.status !== "BROUILLON") return;
    const y = new Date().getFullYear();
    const prefix = inv.kind === "AVOIR" ? `AV-${y}-` : `FA-${y}-`;
    const last = await tx.invoice.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
    const n = (last?.number ? Number(last.number.slice(prefix.length)) || 0 : 0) + 1;
    const buyer = buyerSnapshot(inv.client);
    await tx.invoice.update({
      where: { id },
      data: {
        number: `${prefix}${String(n).padStart(4, "0")}`, status: "EMISE", issueDate: new Date(), dueDate: inv.dueDate ?? new Date(Date.now() + 15 * 864e5),
        seller: JSON.stringify(sellerSnapshot(c)), buyer: JSON.stringify(buyer), einvoiceStatus: "A_DEPOSER",
      },
    });
    if (inv.kind === "AVOIR" && inv.creditOfId) await tx.invoice.update({ where: { id: inv.creditOfId }, data: { status: "ANNULEE" } });
  });
  const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
  if (inv.dossierId) await db.activity.create({ data: { dossierId: inv.dossierId, kind: "QUOTE", body: `🧾 ${INVOICE_KINDS[inv.kind].label} ${inv.number} émise : ${eur(inv.totalTTC - inv.deducted)}` } });
  await refreshInvoiceStatus(id);
}

export async function issueInvoice(id: string) {
  await guard("émettre des factures");
  await issue(id);
  revalidatePath(`/factures/${id}`);
}

export async function deleteInvoiceDraft(id: string) {
  await guard();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
  if (inv.status !== "BROUILLON") return;
  await db.payment.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
  await db.invoice.delete({ where: { id } });
  redirect(inv.dossierId ? `/prestations/${inv.dossierId}` : "/factures");
}

/** Avoir total : annule la facture (elle ne peut pas être supprimée). */
export async function creditInvoice(id: string) {
  await guard();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
  if (!["EMISE", "PAYEE"].includes(inv.status)) return;
  const av = await db.invoice.create({
    data: { kind: "AVOIR", label: `Avoir sur la facture ${inv.number}`, clientId: inv.clientId, dossierId: inv.dossierId, quoteId: inv.quoteId, creditOfId: inv.id, lines: inv.lines, discount: inv.discount, totalHT: inv.totalHT, totalTVA: inv.totalTVA, totalTTC: inv.totalTTC, serviceDate: inv.serviceDate, notes: inv.status === "PAYEE" ? "Remboursement à effectuer au client." : null },
  });
  redirect(`/factures/${av.id}`);
}

export async function setEinvoiceStatus(id: string, status: string) {
  await guard();
  await db.invoice.update({ where: { id }, data: { einvoiceStatus: status, einvoiceAt: status === "DEPOSEE" ? new Date() : null } });
  revalidatePath(`/factures/${id}`);
  revalidatePath("/factures");
}

export async function sendInvoice(id: string, f: FormData) {
  const u = await guard("envoyer des factures");
  const { pdf, fileName, inv } = await buildInvoiceFiles(id);
  if (!inv.number) return;
  const c = await getCompany();
  const net = (c.vatExempt ? inv.totalHT : inv.totalTTC) - inv.deducted;
  const to = s(f, "to") || inv.client.email || "";
  const text = `Bonjour ${inv.client.name},

Veuillez trouver ci-joint ${inv.kind === "AVOIR" ? "l'avoir" : inv.kind === "ACOMPTE" ? "la facture d'acompte" : "la facture"} ${inv.number} d'un montant de ${eur(net)}${inv.dueDate && inv.kind !== "AVOIR" ? `, à régler avant le ${date(inv.dueDate)}` : ""}.
${c.iban && inv.kind !== "AVOIR" ? `\nRèglement par virement : ${c.iban} (référence ${inv.number}).\n` : ""}
Merci pour votre confiance,
${u.name} — ${c.name}`;
  const log = await sendMail({ to, subject: `${INVOICE_KINDS[inv.kind].label} ${inv.number} — ${c.name}`, text, dossierId: inv.dossierId, clientId: inv.clientId, replyTo: u.email, attachments: [{ filename: `${fileName}.pdf`, content: pdf }] });
  await db.invoice.update({ where: { id }, data: { sentAt: new Date() } });
  if (inv.dossierId) await db.activity.create({ data: { dossierId: inv.dossierId, userId: u.id, kind: "EMAIL", body: `✉ ${INVOICE_KINDS[inv.kind].label} ${inv.number} envoyée à ${to}${log.status === "SIMULE" ? " (simulation)" : log.status === "ERREUR" ? ` — échec : ${log.error}` : ""}` } });
  revalidatePath(`/factures/${id}`);
}

/** Enregistre un règlement de la facture (crée l'encaissement correspondant, qui alimente le livre des recettes). */
export async function recordInvoicePayment(id: string, f: FormData) {
  await guard();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
  const c = await getCompany();
  const net = r2((c.vatExempt ? inv.totalHT : inv.totalTTC) - inv.deducted);
  const already = inv.payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  const amount = Number((s(f, "amount") ?? String(net - already)).replace(",", ".")) || 0;
  const day = s(f, "date");
  const open = inv.payments.find((p) => !p.paidAt);
  if (open && Math.abs(open.amount - amount) < 0.01) await db.payment.update({ where: { id: open.id }, data: { paidAt: day ? fromParis(day, "12:00") : new Date(), method: s(f, "method") } });
  else await db.payment.create({ data: { dossierId: inv.dossierId, clientId: inv.clientId, invoiceId: id, label: `Règlement ${inv.number}`, amount: inv.kind === "AVOIR" ? -Math.abs(amount) : amount, paidAt: day ? fromParis(day, "12:00") : new Date(), method: s(f, "method") } });
  await refreshInvoiceStatus(id);
  revalidatePath(`/factures/${id}`);
}
