import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { clientWhere, permsFor } from "@/lib/permissions";

/** Téléchargement côté équipe : /api/signatures/{id}/original ou /signe */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const user = await currentUser();
  if (!user || user.role === "CLIENT") return new Response("Non autorisé", { status: 401 });
  const { id, kind } = await params;
  const perms = await permsFor(user);
  const r = await db.signatureRequest.findFirst({ where: { id, client: clientWhere(user, perms) }, select: { fileName: true, original: true, signedPdf: true } });
  if (!r) return new Response("Introuvable", { status: 404 });
  const signed = kind === "signe";
  const bytes = signed ? r.signedPdf : r.original;
  if (!bytes) return new Response("Pas encore signé", { status: 404 });
  const name = signed ? r.fileName.replace(/\.pdf$/i, "") + "-signe.pdf" : r.fileName;
  const dl = new URL(req.url).searchParams.has("dl");
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, no-store" },
  });
}
