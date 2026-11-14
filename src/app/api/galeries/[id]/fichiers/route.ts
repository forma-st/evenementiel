import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NO_BLOB_MESSAGE, isBlobConfigured, onVercelWithoutBlob, saveLocal } from "@/lib/storage";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Enregistre un fichier dans une galerie.
 * - JSON { name, mime, size, url, thumbUrl, width, height } après un envoi direct vers Vercel Blob ;
 * - multipart (file + thumb) en stockage local.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role === "CLIENT") return bad("Non autorisé", 401);
  const { id } = await params;
  const g = await db.gallery.findUnique({ where: { id }, select: { id: true, _count: { select: { files: true } } } });
  if (!g) return bad("Galerie introuvable", 404);
  const position = g._count.files;
  const ok = (u: unknown) => typeof u === "string" && (u.startsWith("https://") || u.startsWith("/api/fichiers/"));

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const b = await req.json();
    if (!ok(b.url) || (b.thumbUrl && !ok(b.thumbUrl))) return bad("Adresse de fichier invalide");
    const f = await db.galleryFile.create({
      data: { galleryId: id, name: String(b.name).slice(0, 200), mime: String(b.mime || "application/octet-stream"), size: Number(b.size) || 0, url: b.url, thumbUrl: b.thumbUrl || null, width: b.width || null, height: b.height || null, position },
    });
    return NextResponse.json({ id: f.id });
  }

  if (isBlobConfigured()) return bad("Utilisez l'envoi direct (Vercel Blob).");
  if (onVercelWithoutBlob()) return bad(NO_BLOB_MESSAGE, 503);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return bad("Fichier manquant");
  const url = await saveLocal(`galeries/${id}`, file.name, new Uint8Array(await file.arrayBuffer()));
  const thumb = form.get("thumb");
  const thumbUrl = thumb instanceof File && thumb.size ? await saveLocal(`galeries/${id}/mini`, file.name.replace(/\.\w+$/, "") + ".jpg", new Uint8Array(await thumb.arrayBuffer())) : null;
  const f = await db.galleryFile.create({
    data: { galleryId: id, name: file.name.slice(0, 200), mime: file.type || "application/octet-stream", size: file.size, url, thumbUrl, width: Number(form.get("width")) || null, height: Number(form.get("height")) || null, position },
  });
  return NextResponse.json({ id: f.id });
}
