import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getPdfStyle } from "@/lib/pdfStyle";
import { QuoteStyleEditor } from "@/components/QuoteStyleEditor";

export const metadata = { title: "Mise en forme des devis" };

export default async function QuoteStylePage() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") redirect("/parametres");
  return <QuoteStyleEditor initial={await getPdfStyle()} />;
}
