import { currentUser } from "@/lib/auth";
import { buildContractPdf } from "@/lib/contracts";

/** Aperçu PDF du contrat avant envoi (formulaire de génération). */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "CLIENT") return new Response("Non autorisé", { status: 401 });
  const f = await req.formData();
  const pdf = await buildContractPdf(String(f.get("title") || "Contrat"), String(f.get("body") || ""), String(f.get("quoteId") || "") || null);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="apercu-contrat.pdf"' } });
}
