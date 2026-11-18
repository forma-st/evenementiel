import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromParis, parisParts } from "@/lib/format";
import { buildInvoiceFiles, INVOICE_KINDS } from "@/lib/invoices";
import { zipStream } from "@/lib/zip";

export const maxDuration = 300;

const csv = (rows: (string | number | null | undefined)[][]) =>
  "﻿" + rows.map((r) => r.map((v) => { const s = v == null ? "" : typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n");
const day = (d: Date | null) => (d ? `${String(parisParts(d).d).padStart(2, "0")}/${String(parisParts(d).m).padStart(2, "0")}/${parisParts(d).y}` : "");

/**
 * Exports comptables (CSV « ; » compatibles Excel / import Indy, ou ZIP des factures Factur-X).
 * ?type=recettes|factures|depenses|zip&du=AAAA-MM-JJ&au=AAAA-MM-JJ
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) return new Response("Réservé aux administrateurs et responsables.", { status: 403 });
  const u = new URL(req.url);
  const y = new Date().getFullYear();
  const from = fromParis(u.searchParams.get("du") || `${y}-01-01`);
  const to = new Date(fromParis(u.searchParams.get("au") || `${y}-12-31`).getTime() + 864e5);
  const type = u.searchParams.get("type") ?? "recettes";
  const name = `${type}-${u.searchParams.get("du") ?? y}-${u.searchParams.get("au") ?? y}`;
  const file = (body: string) => new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });

  if (type === "recettes") {
    // Livre des recettes (obligatoire en micro-entreprise) : encaissements par ordre chronologique
    const pays = await db.payment.findMany({ where: { paidAt: { gte: from, lt: to } }, include: { invoice: { select: { number: true } }, dossier: { select: { reference: true, title: true, client: { select: { name: true } } } } }, orderBy: { paidAt: "asc" } });
    const clients = await db.client.findMany({ where: { id: { in: pays.map((p) => p.clientId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    return file(csv([
      ["Date d'encaissement", "Client", "Nature de la prestation", "Référence facture", "Montant", "Mode de règlement", "Prestation"],
      ...pays.map((p) => [day(p.paidAt), p.dossier?.client.name ?? clients.find((c) => c.id === p.clientId)?.name ?? "", `${p.label}${p.dossier ? ` — ${p.dossier.title}` : ""}`, p.invoice?.number ?? "", p.amount, p.method ?? "", p.dossier?.reference ?? ""]),
    ]));
  }
  if (type === "factures") {
    const list = await db.invoice.findMany({ where: { issueDate: { gte: from, lt: to }, number: { not: null } }, include: { client: true }, orderBy: { number: "asc" } });
    return file(csv([
      ["Numéro", "Type", "Date", "Client", "SIREN client", "Objet", "Total HT", "TVA", "Total TTC", "Acomptes déduits", "Net à payer", "Statut", "Plateforme"],
      ...list.map((i) => [i.number, INVOICE_KINDS[i.kind].label, day(i.issueDate), i.client.name, i.client.siren ?? "", i.label, i.totalHT, i.totalTVA, i.totalTTC, i.deducted, i.totalTTC - i.deducted, i.status, i.einvoiceStatus === "DEPOSEE" ? "déposée" : "à déposer"]),
    ]));
  }
  if (type === "depenses") {
    const list = await db.expense.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: "asc" } });
    return file(csv([["Date", "Fournisseur", "Libellé", "Catégorie", "Montant TTC", "TVA", "Mode de paiement", "Justificatif"], ...list.map((e) => [day(e.date), e.supplier, e.label, e.category, e.amountTTC, e.vat, e.method ?? "", e.receiptUrl ? new URL(e.receiptUrl, u).toString() : ""])]));
  }
  if (type === "zip") {
    const list = await db.invoice.findMany({ where: { issueDate: { gte: from, lt: to }, number: { not: null } }, select: { id: true, number: true }, orderBy: { number: "asc" } });
    const stream = zipStream(list.map((i) => ({ name: `${i.number}.pdf`, open: async () => { const { pdf } = await buildInvoiceFiles(i.id); return new Blob([new Uint8Array(pdf)]).stream(); } })));
    return new Response(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="factures-facturx-${name}.zip"` } });
  }
  return new Response("Type inconnu", { status: 400 });
}
