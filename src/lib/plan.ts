import { randomBytes } from "crypto";
import { db } from "./db";
import { cleanMusic, clientEditable, type MusicData } from "./music";
import { notify } from "./notify";

/** Lien de l'espace organisation (créé à la première demande). */
export async function ensurePlanToken(dossierId: string) {
  const p = await db.musicPlan.findUnique({ where: { dossierId }, select: { token: true } });
  if (p?.token) return p.token;
  const token = randomBytes(18).toString("base64url");
  await db.musicPlan.upsert({ where: { dossierId }, update: { token }, create: { dossierId, token } });
  return token;
}

/** Enregistre l'organisation (déroulé, musique, infos pratiques). Le client est soumis à la date limite. */
export async function writePlan(dossierId: string, data: Partial<MusicData>, who: { name: string; client: boolean; userId?: string | null }) {
  const d = await db.dossier.findUnique({ where: { id: dossierId }, select: { title: true, eventStart: true, assigneeId: true, client: { select: { ownerId: true } }, musicPlan: true } });
  if (!d) return { error: "Prestation introuvable." };
  if (who.client) {
    const st = clientEditable(d.musicPlan, d.eventStart);
    if (!st.editable) return { error: st.reason === "deadline" ? "La date limite de modification est passée : contactez-nous pour tout changement." : "L'organisation a été validée : contactez-nous pour tout changement." };
  }
  const m = cleanMusic(data);
  const row = {
    playlistUrl: m.playlistUrl || null, moments: JSON.stringify(m.moments), mustPlay: JSON.stringify(m.mustPlay), doNotPlay: JSON.stringify(m.doNotPlay),
    notes: m.notes || null, info: JSON.stringify(m.info), updatedBy: who.name, ...(who.client ? { clientSavedAt: new Date() } : {}),
  };
  await db.musicPlan.upsert({ where: { dossierId }, update: row, create: { dossierId, ...row } });
  if (who.client) {
    // une notification par heure au plus, pour ne pas inonder pendant que le client remplit
    const recent = d.musicPlan?.clientSavedAt && Date.now() - d.musicPlan.clientSavedAt.getTime() < 36e5;
    if (!recent) {
      await notify([d.assigneeId, d.client.ownerId], { type: "SYSTEM", title: `${who.name} a mis à jour l'organisation de « ${d.title} »`, link: `/prestations/${dossierId}#musique` }, who.userId ?? null);
      await db.activity.create({ data: { dossierId, userId: who.userId ?? null, kind: "NOTE", body: "🗒 Organisation (déroulé, musique, infos pratiques) mise à jour par le client" } });
    }
  }
  return { ok: true };
}
