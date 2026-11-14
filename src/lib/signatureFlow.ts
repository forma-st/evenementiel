import { db } from "./db";
import { notify } from "./notify";
import { buildSignedPdf } from "./signature";
import { runAutomations, runTrigger } from "./automations";
import { acceptQuote } from "./quoteAccept";
import { syncPrestationEvent } from "./prestaSync";
import { statusOf } from "./format";

/** Une fois tous les signataires passés : PDF signé, devis accepté, prestation confirmée (option), notifications. */
export async function finalizeIfComplete(requestId: string) {
  const r = await db.signatureRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { signers: true, client: { select: { name: true, ownerId: true } }, createdBy: true, dossier: true },
  });
  if (r.status !== "EN_ATTENTE" || r.signers.some((s) => s.status !== "SIGNE")) return false;

  const { bytes, hash } = await buildSignedPdf(
    { id: r.id, title: r.title, fileName: r.fileName, original: r.original, originalHash: r.originalHash, createdAt: r.createdAt, createdBy: r.createdBy?.name ?? null, clientName: r.client.name },
    r.signers.map((s) => ({ name: s.name, email: s.email, signedAt: s.signedAt!, viewedAt: s.viewedAt, ip: s.ip, userAgent: s.userAgent, signatureImage: s.signatureImage })),
  );
  // mise à jour conditionnelle : évite une double finalisation si deux signatures arrivent en même temps
  const upd = await db.signatureRequest.updateMany({
    where: { id: r.id, status: "EN_ATTENTE" },
    data: { status: "SIGNE", completedAt: new Date(), signedPdf: new Uint8Array(bytes), signedHash: hash },
  });
  if (!upd.count) return false;

  if (r.quoteId) {
    const q = await db.quote.findUnique({ where: { id: r.quoteId }, select: { status: true } });
    if (q && q.status !== "ACCEPTE") await acceptQuote(r.quoteId, r.createdBy ?? null, "par signature électronique");
  }

  const who = r.signers.map((s) => s.name).join(", ");
  if (r.dossierId) {
    await db.activity.create({ data: { dossierId: r.dossierId, kind: "QUOTE", body: `✍ « ${r.title} » signé électroniquement par ${who}` } });
    if (r.winOnSign && r.dossier && !["CONFIRME", "REALISE", "CLOTURE"].includes(r.dossier.status)) {
      await db.dossier.update({ where: { id: r.dossierId }, data: { status: "CONFIRME" } });
      await db.activity.create({ data: { dossierId: r.dossierId, kind: "STATUS", body: `Statut : ${statusOf(r.dossier.status).label} → Confirmée (après signature)` } });
      await syncPrestationEvent(r.dossierId);
      const actor = r.createdBy ?? (await db.user.findFirst({ where: { role: "ADMIN", active: true } }));
      if (actor) await runAutomations(r.dossierId, "CONFIRME", actor);
    }
    if (r.kind === "CONTRAT") await runTrigger("CONTRACT_SIGNED", r.dossierId, r.id, r.createdBy);
  }
  await notify([r.createdById, r.client.ownerId, r.dossier?.assigneeId], {
    type: "SYSTEM",
    title: `✍ ${r.client.name} a signé « ${r.title} »`,
    body: `Signé par ${who}. Le PDF signé et son dossier de preuve sont disponibles.`,
    link: `/signatures/${r.id}`,
  });
  return true;
}
