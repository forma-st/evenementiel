import { requireStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCompany, getLogo } from "@/lib/company";
import { saveCompany } from "../emails/actions";

export const metadata = { title: "Entreprise" };

const F = ({ name, label, value, ph, wide }: { name: string; label: string; value: string; ph?: string; wide?: boolean }) => (
  <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="label">{label}</span><input name={name} defaultValue={value} placeholder={ph} className="input" /></label>
);

export default async function CompanySettings() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") redirect("/parametres");
  const [c, logo] = await Promise.all([getCompany(), getLogo()]);
  return (
    <form action={saveCompany} className="space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Identité (devis, contrats, e-mails, galeries)</h2>
        <F name="name" label="Nom commercial" value={c.name} />
        <F name="tagline" label="Accroche" value={c.tagline} ph="DJ · Sonorisation · Photographie" />
        <div className="flex items-center gap-4 sm:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/logo" alt="" className="h-12 max-w-[200px] rounded border border-slate-200 bg-white object-contain p-1" />
          <label className="block flex-1"><span className="label">Logo (PNG ou JPEG, &lt; 600 Ko)</span><input type="file" name="logo" accept="image/png,image/jpeg" className="input" /></label>
          {logo && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo" /> Retirer</label>}
        </div>
        <F name="legal" label="Forme juridique" value={c.legal} ph="EI · Auto-entrepreneur / SARL au capital de…" />
        <F name="siret" label="SIRET" value={c.siret} />
        <F name="address" label="Adresse" value={c.address} wide />
        <F name="phone" label="Téléphone" value={c.phone} />
        <F name="email" label="E-mail (réponses des clients)" value={c.email} />
        <F name="web" label="Site internet" value={c.web} />
        <F name="vat" label="N° de TVA" value={c.vat} />
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="vatExempt" defaultChecked={c.vatExempt} className="h-4 w-4 accent-brand-600" /> Franchise en base de TVA (micro-entreprise) : « TVA non applicable, art. 293 B du CGI »</label>
      </section>
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Paiements et suivi</h2>
        <F name="iban" label="IBAN" value={c.iban} />
        <F name="bic" label="BIC" value={c.bic} />
        <F name="reviewUrl" label="Lien pour laisser un avis (Google, Mariages.net…)" value={c.reviewUrl} ph="https://g.page/r/…" wide />
        <label className="block sm:col-span-2"><span className="label">Mentions en bas des devis</span><textarea name="quoteFooter" rows={3} defaultValue={c.quoteFooter} className="input" /></label>
      </section>
      <button className="btn-primary">Enregistrer</button>
    </form>
  );
}
