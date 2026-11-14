"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { accessCode, galleryToken } from "@/lib/galleries";
import { deleteStored } from "@/lib/storage";
import { runTrigger } from "@/lib/automations";
import { fromParis } from "@/lib/format";

const s = (f: FormData, k: string) => {
  const v = f.get(k);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
};

function data(f: FormData) {
  const exp = s(f, "expiresAt");
  return {
    title: s(f, "title") || "Galerie",
    message: s(f, "message"),
    kind: s(f, "kind") === "TRANSFERT" ? "TRANSFERT" : "GALERIE",
    password: f.get("usePassword") === "on" ? s(f, "password") || accessCode() : null,
    allowDownload: f.get("allowDownload") === "on",
    allowFavorites: f.get("allowFavorites") === "on",
    externalUrl: s(f, "externalUrl"),
    externalCode: s(f, "externalCode"),
    expiresAt: exp ? fromParis(exp, "23:59") : null,
    clientId: s(f, "clientId"),
    dossierId: s(f, "dossierId"),
  };
}

export async function createGallery(f: FormData) {
  await requireStaff();
  const d = data(f);
  if (d.dossierId && !d.clientId) d.clientId = (await db.dossier.findUnique({ where: { id: d.dossierId }, select: { clientId: true } }))?.clientId ?? null;
  const g = await db.gallery.create({ data: { ...d, token: galleryToken() } });
  redirect(`/galeries/${g.id}`);
}

export async function updateGallery(id: string, f: FormData) {
  await requireStaff();
  await db.gallery.update({ where: { id }, data: data(f) });
  revalidatePath(`/galeries/${id}`);
}

/** Publication : la galerie devient accessible et l'automatisation « Galerie publiée » se déclenche (e-mail au client). */
export async function publishGallery(id: string, publish: boolean) {
  const user = await requireStaff();
  const g = await db.gallery.update({ where: { id }, data: publish ? { status: "PUBLIEE", publishedAt: new Date() } : { status: "BROUILLON" } });
  if (publish && g.dossierId) {
    await db.activity.create({ data: { dossierId: g.dossierId, userId: user.id, kind: "GALLERY", body: `📷 ${g.kind === "TRANSFERT" ? "Transfert" : "Galerie"} « ${g.title} » publié(e)` } });
    await runTrigger("GALLERY_PUBLISHED", g.dossierId, g.id, user);
  }
  revalidatePath(`/galeries/${id}`);
}

export async function archiveGallery(id: string) {
  await requireStaff();
  await db.gallery.update({ where: { id }, data: { status: "ARCHIVEE" } });
  revalidatePath(`/galeries/${id}`);
}

export async function deleteGallery(id: string) {
  await requireStaff();
  const files = await db.galleryFile.findMany({ where: { galleryId: id }, select: { url: true, thumbUrl: true } });
  await deleteStored(files.flatMap((f) => [f.url, f.thumbUrl]));
  await db.gallery.delete({ where: { id } });
  redirect("/galeries");
}

export async function deleteFiles(galleryId: string, ids: string[]) {
  await requireStaff();
  const files = await db.galleryFile.findMany({ where: { galleryId, id: { in: ids } }, select: { url: true, thumbUrl: true } });
  await deleteStored(files.flatMap((f) => [f.url, f.thumbUrl]));
  await db.galleryFile.deleteMany({ where: { galleryId, id: { in: ids } } });
  revalidatePath(`/galeries/${galleryId}`);
}

export async function setCover(galleryId: string, fileId: string) {
  await requireStaff();
  await db.gallery.update({ where: { id: galleryId }, data: { coverId: fileId } });
  revalidatePath(`/galeries/${galleryId}`);
}

export async function sortFilesByName(galleryId: string) {
  await requireStaff();
  const files = await db.galleryFile.findMany({ where: { galleryId }, select: { id: true, name: true } });
  files.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  await db.$transaction(files.map((f, i) => db.galleryFile.update({ where: { id: f.id }, data: { position: i } })));
  revalidatePath(`/galeries/${galleryId}`);
}

export async function resetFavorites(galleryId: string) {
  await requireStaff();
  await db.galleryFile.updateMany({ where: { galleryId }, data: { favorite: false } });
  revalidatePath(`/galeries/${galleryId}`);
}
