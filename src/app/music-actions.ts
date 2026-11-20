"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser, requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { cleanMusic, type MusicData } from "@/lib/music";
import { notify } from "@/lib/notify";

/** Enregistre le planning musical : l'équipe (prestation visible) ou le client de la prestation si l'édition lui est ouverte. */
export async function saveMusicPlan(dossierId: string, data: Partial<MusicData>) {
  const u = await currentUser();
  if (!u) return { error: "Session expirée : reconnectez-vous." };
  const d = await db.dossier.findUnique({ where: { id: dossierId }, select: { id: true, clientId: true, assigneeId: true, title: true, musicPlan: { select: { clientCanEdit: true } } } });
  if (!d) return { error: "Prestation introuvable." };
  const client = u.role === "CLIENT";
  if (client) {
    if (!u.clientId || u.clientId !== d.clientId) return { error: "Non autorisé." };
    if (d.musicPlan && !d.musicPlan.clientCanEdit) return { error: "Le planning est verrouillé par votre DJ. Contactez-le pour une modification." };
  } else await assertDossierVisible(u, dossierId);
  const m = cleanMusic(data);
  const row = { playlistUrl: m.playlistUrl || null, moments: JSON.stringify(m.moments), mustPlay: JSON.stringify(m.mustPlay), doNotPlay: JSON.stringify(m.doNotPlay), notes: m.notes || null, updatedBy: u.name };
  await db.musicPlan.upsert({ where: { dossierId }, update: row, create: { dossierId, ...row } });
  if (client) {
    await notify([d.assigneeId], { type: "SYSTEM", title: `${u.name} a mis à jour le planning musical de « ${d.title} »`, link: `/prestations/${dossierId}#musique` });
    await db.activity.create({ data: { dossierId, userId: u.id, kind: "NOTE", body: "🎵 Planning musical mis à jour par le client" } });
  }
  revalidatePath(`/prestations/${dossierId}`);
  return { ok: true, at: new Date().toISOString() };
}

export async function setMusicClientEdit(dossierId: string, open: boolean) {
  const u = await requireStaff();
  await assertDossierVisible(u, dossierId);
  await db.musicPlan.upsert({ where: { dossierId }, update: { clientCanEdit: open }, create: { dossierId, clientCanEdit: open } });
  revalidatePath(`/prestations/${dossierId}`);
}
