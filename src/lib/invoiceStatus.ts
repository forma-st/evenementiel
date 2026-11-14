import { db } from "./db";
import { getCompany } from "./company";

/** Passe une facture émise en « Payée » quand ses encaissements couvrent le net à payer (et inversement). */
export async function refreshInvoiceStatus(id: string) {
  const inv = await db.invoice.findUnique({ where: { id }, include: { payments: true } });
  if (!inv || !["EMISE", "PAYEE"].includes(inv.status) || inv.kind === "AVOIR") return;
  const c = await getCompany();
  const net = (c.vatExempt ? inv.totalHT : inv.totalTTC) - inv.deducted;
  const paid = inv.payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  const status = paid >= net - 0.01 ? "PAYEE" : "EMISE";
  if (status !== inv.status) await db.invoice.update({ where: { id }, data: { status } });
}
