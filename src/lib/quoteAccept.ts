import { db } from "./db";
import { runTrigger } from "./automations";

/** Acceptation (par l'équipe ou par le client en ligne) : statut, prestation, automatisations. */
export async function acceptQuote(id: string, actor: { id: string; name: string } | null, via: string) {
  const q = await db.quote.update({ where: { id }, data: { status: "ACCEPTE", answeredAt: new Date() } });
  if (q.dossierId) {
    await db.activity.create({ data: { dossierId: q.dossierId, userId: actor?.id ?? null, kind: "QUOTE", body: `✅ Devis ${q.number ?? ""} accepté ${via}` } });
    await db.dossier.update({ where: { id: q.dossierId }, data: { amount: q.totalTTC } });
    // les autres devis encore ouverts de la prestation sont refusés
    await db.quote.updateMany({ where: { dossierId: q.dossierId, id: { not: id }, status: { in: ["BROUILLON", "ENVOYE"] } }, data: { status: "REFUSE" } });
    await runTrigger("QUOTE_ACCEPTED", q.dossierId, q.id, actor);
  }
}

