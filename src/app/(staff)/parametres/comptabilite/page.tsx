import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { ACTIVITIES, getUrssaf, ratesOf } from "@/lib/urssaf";
import { getEinvoiceSettings, PLATFORMS } from "@/lib/einvoice";
import { saveAccountingSettings } from "../../comptabilite/actions";

export const metadata = { title: "Comptabilité" };

export default async function AccountingSettings() {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") redirect("/parametres");
  const [s, e] = await Promise.all([getUrssaf(), getEinvoiceSettings()]);
  const r = ratesOf({ ...s, versementLiberatoire: true });
  return (
    <form action={saveAccountingSettings} className="space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Micro-entreprise (auto-entrepreneur)</h2>
        <label className="block sm:col-span-2"><span className="label">Activité principale</span>
          <select name="activity" defaultValue={s.activity} className="input">{Object.entries(ACTIVITIES).map(([k, a]) => <option key={k} value={k}>{a.label} — {a.rate} %</option>)}</select>
        </label>
        <label className="block"><span className="label">Déclaration du chiffre d&apos;affaires</span>
          <select name="frequency" defaultValue={s.frequency} className="input"><option value="TRIMESTRIELLE">Trimestrielle</option><option value="MENSUELLE">Mensuelle</option></select>
        </label>
        <label className="block"><span className="label">Date de création de l&apos;entreprise</span><input type="date" name="creationDate" defaultValue={s.creationDate} className="input" /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="versementLiberatoire" defaultChecked={s.versementLiberatoire} className="h-4 w-4 accent-brand-600" /> Option pour le versement libératoire de l&apos;impôt sur le revenu ({r.vl} % du CA)</label>
        <label className="block"><span className="label">ACRE jusqu&apos;au (vide si aucune)</span><input type="date" name="acreUntil" defaultValue={s.acreUntil} className="input" /></label>
        <label className="block"><span className="label">Cotisations dues pendant l&apos;ACRE</span>
          <select name="acreFactor" defaultValue={String(s.acreFactor)} className="input"><option value="0.5">50 % (création avant le 1er juillet 2026)</option><option value="0.75">75 % (création à partir du 1er juillet 2026)</option></select>
        </label>
        <div className="sm:col-span-2">
          <div className="label">Taux personnalisés (laisser vide pour les taux 2026 par défaut)</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input name="rate" defaultValue={s.rate ?? ""} placeholder={`Cotisations : ${ACTIVITIES[s.activity].rate} %`} className="input" />
            <input name="cfp" defaultValue={s.cfp ?? ""} placeholder={`Formation pro : ${ACTIVITIES[s.activity].cfp} %`} className="input" />
            <input name="vl" defaultValue={s.vl ?? ""} placeholder={`Versement libératoire : ${ACTIVITIES[s.activity].vl} %`} className="input" />
          </div>
          <p className="mt-2 text-xs text-slate-500">Taux, plafonds ({ACTIVITIES[s.activity].ceiling.toLocaleString("fr-FR")} €) et seuils de TVA ({ACTIVITIES[s.activity].vatThreshold.toLocaleString("fr-FR")} € / {ACTIVITIES[s.activity].vatMajor.toLocaleString("fr-FR")} €) préremplis pour 2026 : vérifiez-les chaque année sur autoentrepreneur.urssaf.fr. La taxe pour frais de chambre consulaire éventuelle n&apos;est pas incluse.</p>
        </div>
      </section>
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Facturation électronique</h2>
        <label className="block"><span className="label">Plateforme agréée</span>
          <select name="platform" defaultValue={e.platform} className="input">{Object.entries(PLATFORMS).map(([k, p]) => <option key={k} value={k}>{k === "AUTRE" ? "Autre plateforme" : p.name}</option>)}</select>
        </label>
        <p className="text-sm text-slate-600 sm:col-span-2">Les factures émises sont produites au format Factur-X (PDF avec XML structuré EN 16931). Indy étant plateforme agréée sans API ouverte aux logiciels tiers, le dépôt se fait par import de fichiers ; chaque facture garde un suivi « à déposer / déposée ».</p>
      </section>
      <button className="btn-primary">Enregistrer</button>
    </form>
  );
}
