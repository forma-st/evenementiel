import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { hasGalleryAccess, isGalleryOpen } from "@/lib/galleries";

/** Téléchargement d'un fichier de la galerie (redirection vers le stockage). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const f = await db.galleryFile.findFirst({ where: { id: fileId, gallery: { token } }, include: { gallery: true } });
  if (!f) return new Response("Introuvable", { status: 404 });
  const user = await currentUser();
  const staff = !!user && user.role !== "CLIENT";
  if (!staff && (!isGalleryOpen(f.gallery) || !f.gallery.allowDownload || !(await hasGalleryAccess(f.gallery)))) return new Response("Accès refusé", { status: 403 });
  const target = f.url.startsWith("/")
    ? new URL(`${f.url}?download=${encodeURIComponent(f.name)}`, req.url)
    : new URL(`${f.url}${f.url.includes("?") ? "&" : "?"}download=1`);
  return NextResponse.redirect(target);
}
