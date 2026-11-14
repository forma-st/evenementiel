import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { hasGalleryAccess, isGalleryOpen } from "@/lib/galleries";
import { openStream, safeName } from "@/lib/storage";
import { zipStream } from "@/lib/zip";

export const maxDuration = 300;

/** Téléchargement de toute la galerie (ou des favoris) en un seul ZIP. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const g = await db.gallery.findUnique({ where: { token }, include: { files: { orderBy: { position: "asc" } } } });
  if (!g) return new Response("Introuvable", { status: 404 });
  const user = await currentUser();
  const staff = !!user && user.role !== "CLIENT";
  if (!staff && (!isGalleryOpen(g) || !g.allowDownload || !(await hasGalleryAccess(g)))) return new Response("Accès refusé", { status: 403 });
  const fav = new URL(req.url).searchParams.get("favoris") === "1";
  const files = fav ? g.files.filter((f) => f.favorite) : g.files;
  if (!staff) await db.gallery.update({ where: { id: g.id }, data: { downloads: { increment: 1 } } });
  const stream = zipStream(files.map((f) => ({ name: f.name, open: () => openStream(f.url) })));
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName(g.title) + (fav ? "-favoris" : "") + ".zip")}`,
      "Cache-Control": "no-store",
    },
  });
}
