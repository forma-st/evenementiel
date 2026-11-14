import { currentUser } from "@/lib/auth";
import { permsFor } from "@/lib/permissions";
import { buildQuotePdf } from "@/lib/quotePdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role === "CLIENT" || !(await permsFor(user)).canViewQuotes) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  const { pdf, fileName } = await buildQuotePdf(id);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"` } });
}
