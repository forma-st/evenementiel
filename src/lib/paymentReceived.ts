import { db } from "./db";
import { notify } from "./notify";
import { eur } from "./format";
import { refreshInvoiceStatus } from "./invoiceStatus";
import { runTrigger } from "./automations";

/** Paiement en ligne confirmé par Stripe : encaissement, facture, journal, notifications, automatisations. */
export async function markPaidOnline(paymentId: string, sessionId: string) {
  const upd = await db.payment.updateMany({
    where: { id: paymentId, paidAt: null },
    data: { paidAt: new Date(), method: "Carte bancaire (en ligne)", paidOnline: true, stripeSessionId: sessionId },
  });
  if (!upd.count) return false; // déjà enregistré (Stripe peut renvoyer le même événement)
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { dossier: { include: { client: true } } } });
  if (p.invoiceId) await refreshInvoiceStatus(p.invoiceId);
  if (p.dossierId && p.dossier) {
    await db.activity.create({ data: { dossierId: p.dossierId, kind: "PAYMENT", body: `💳 ${p.label} payé en ligne par carte : ${eur(p.amount)}` } });
    const managers = await db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true } });
    await notify([p.dossier.assigneeId, p.dossier.client.ownerId, ...managers.map((m) => m.id)], { type: "SYSTEM", title: `💳 ${p.dossier.client.name} a payé ${eur(p.amount)} en ligne`, body: `${p.label} — ${p.dossier.title}`, link: `/prestations/${p.dossierId}` });
    await runTrigger("PAYMENT_RECEIVED", p.dossierId, p.id, null);
  }
  return true;
}
