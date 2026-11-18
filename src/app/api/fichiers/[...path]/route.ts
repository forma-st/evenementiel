import { stat } from "fs/promises";
import { localPath, openStream } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf", zip: "application/zip" };

/** Fichiers du stockage local (adresses longues et aléatoires, comme celles de Vercel Blob). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = "/api/fichiers/" + path.map(encodeURIComponent).join("/");
  const p = localPath(url);
  if (!p) return new Response("Introuvable", { status: 404 });
  const st = await stat(p).catch(() => null);
  if (!st?.isFile()) return new Response("Introuvable", { status: 404 });
  const body = await openStream(url);
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const dl = new URL(req.url).searchParams.get("download");
  return new Response(body, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(st.size),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
      ...(!/^(image|video)\//.test(TYPES[ext] ?? "") && !dl ? { "Content-Disposition": "attachment" } : {}),
      ...(dl ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(dl)}` } : {}),
    },
  });
}
