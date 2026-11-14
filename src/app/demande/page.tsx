import { Logo } from "@/components/Logo";
import { getCompany } from "@/lib/company";
import { LeadForm } from "./LeadForm";

export const metadata = { title: "Demande de devis" };

/** Formulaire public (lien ou iframe sur votre site : /demande). */
export default async function LeadPage() {
  const c = await getCompany();
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center"><Logo className="h-12" /></div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">Demande de devis</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">Parlez-nous de votre événement : nous vérifions la disponibilité de la date et revenons vers vous rapidement.</p>
          <LeadForm />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">{[c.name, c.phone, c.email].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}
