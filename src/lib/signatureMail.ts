import { db } from "./db";
import { sendMail } from "./mail";
import { baseUrl } from "./merge";
import { getCompany } from "./company";

/** E-mail au signataire avec son lien personnel. */
export async function sendSignatureEmail(signerId: string, from: { id: string; name: string; email?: string | null }) {
  const s = await db.signatureSigner.findUniqueOrThrow({ where: { id: signerId }, include: { request: true } });
  if (!s.email) return null;
  const c = await getCompany();
  const r = s.request;
  const text = `Bonjour ${s.name},

${r.message ? r.message + "\n\n" : ""}Vous pouvez consulter et signer « ${r.title} » en ligne, en quelques secondes, depuis votre ordinateur ou votre téléphone :
${baseUrl()}/signer/${s.token}

Ce lien est personnel. Il est valable jusqu'au ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(r.expiresAt)}.

${from.name} — ${c.name}`;
  const log = await sendMail({ to: s.email, subject: `Document à signer : ${r.title}`, text, dossierId: r.dossierId, clientId: r.clientId, replyTo: from.email });
  if (r.dossierId) await db.activity.create({ data: { dossierId: r.dossierId, userId: from.id, kind: "EMAIL", body: `✉ Lien de signature envoyé à ${s.name}${log.status === "SIMULE" ? " (simulation)" : log.status === "ERREUR" ? ` — échec : ${log.error}` : ""}` } });
  return log;
}
