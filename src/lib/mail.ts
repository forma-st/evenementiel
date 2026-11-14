import { db } from "./db";
import { getCompany } from "./company";

/**
 * Envoi d'e-mails aux clients.
 * - RESEND_API_KEY + MAIL_FROM : envoi réel via Resend (https://resend.com, offre gratuite 3 000 e-mails/mois).
 * - sinon : mode simulation, l'e-mail est seulement enregistré dans l'historique de la prestation.
 */
export const isMailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Texte brut -> HTML simple (paragraphes, liens cliquables). */
export function textToHtml(text: string, signature: string) {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#6d28d9">$1</a>')
    .split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1e1b2e;max-width:600px">${body}<p style="margin-top:24px;color:#71717a;font-size:13px">${escapeHtml(signature)}</p></div>`;
}

export async function sendMail(m: { to: string; subject: string; text: string; dossierId?: string | null; clientId?: string | null; replyTo?: string | null; attachments?: { filename: string; content: Buffer }[] }) {
  const c = await getCompany();
  const to = m.to.trim();
  let status = "SIMULE";
  let error: string | null = null;
  if (!to) {
    status = "ERREUR";
    error = "Le client n'a pas d'adresse e-mail.";
  } else if (isMailConfigured()) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: [to],
          reply_to: m.replyTo || c.email || undefined,
          subject: m.subject,
          text: m.text,
          html: textToHtml(m.text, [c.name, c.phone, c.web].filter(Boolean).join(" · ")),
          attachments: m.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      status = "ENVOYE";
    } catch (e) {
      status = "ERREUR";
      error = (e as Error).message.slice(0, 500);
    }
  }
  const log = await db.emailLog.create({ data: { to: to || "—", subject: m.subject, body: m.text + (m.attachments?.length ? `\n\n[Pièce(s) jointe(s) : ${m.attachments.map((a) => a.filename).join(", ")}]` : ""), status, error, dossierId: m.dossierId ?? null, clientId: m.clientId ?? null } });
  return log;
}
