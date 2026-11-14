import { db } from "@/lib/db";

/** Document pour le signataire (lien personnel). ?signe=1 : version signée une fois terminée. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await db.signatureSigner.findUnique({ where: { token }, include: { request: { select: { fileName: true, original: true, signedPdf: true, status: true } } } });
  if (!s || s.request.status === "ANNULE") return new Response("Lien invalide ou annulé", { status: 404 });
  const signed = new URL(req.url).searchParams.has("signe") && s.request.signedPdf;
  const bytes = signed ? s.request.signedPdf! : s.request.original;
  const name = signed ? s.request.fileName.replace(/\.pdf$/i, "") + "-signe.pdf" : s.request.fileName;
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
