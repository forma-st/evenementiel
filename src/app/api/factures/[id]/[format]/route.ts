import { currentUser } from "@/lib/auth";
import { buildInvoiceFiles } from "@/lib/invoices";

/** PDF (Factur-X : XML intégré) ou XML seul d'une facture. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { id, format } = await params;
  const { pdf, xml, fileName, inv } = await buildInvoiceFiles(id);
  // un client ne voit que ses factures émises
  if (user.role === "CLIENT" && (inv.clientId !== user.clientId || !inv.number)) return new Response("Non autorisé", { status: 403 });
  if (format === "xml") return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}.xml"` } });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}.pdf"` } });
}
