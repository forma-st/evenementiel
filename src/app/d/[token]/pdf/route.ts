import { db } from "@/lib/db";
import { buildQuotePdf } from "@/lib/quotePdf";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await db.quote.findUnique({ where: { token }, select: { id: true, status: true } });
  if (!q || q.status === "BROUILLON") return new Response("Introuvable", { status: 404 });
  const { pdf, fileName } = await buildQuotePdf(q.id);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"` } });
}
