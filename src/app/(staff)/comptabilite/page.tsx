import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { date, eur, fromParis, parisParts } from "@/lib/format";
import { ACTIVITIES, URSSAF_URL, ceilingFor, contributionsFor, currentPeriodId, getUrssaf, periodsOfYear, ratesOf, turnoverBetween } from "@/lib/urssaf";
import { PAYMENT_METHODS } from "@/lib/presta";
import { addExpense, cancelDeclaration, deleteExpense, markDeclarationPaid, markDeclared } from "./actions";

export const metadata = { title: "Comptabilité" };

const CATEGORIES: Record<string, string> = { MATERIEL: "Matériel", DEPLACEMENT: "Déplacements", LOGICIEL: "Logiciels / abonnements", MUSIQUE: "Musique / licences", COMMUNICATION: "Communication", SOUS_TRAITANCE: "Sous-traitance", ASSURANCE: "Assurance", BANQUE: "Banque", AUTRE: "Autre" };
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const eur0 = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default async function Accounting({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const u = await requireStaff();
  if (u.role !== "ADMIN" && u.role !== "MANAGER") redirect("/");
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.annee) || parisParts(now).y;
  const yStart = fromParis(`${year}-01-01`), yEnd = fromParis(`${year + 1}-01-01`);

  const [s, yearCA, prevCA, months, decls, expenses, unpaid, toFile] = await Promise.all([
    getUrssaf(),
    turnoverBetween(yStart, yEnd),
    turnoverBetween(fromParis(`${year - 1}-01-01`), yStart),
    Promise.all(Array.from({ length: 12 }, (_, i) => turnoverBetween(fromParis(`${year}-${String(i + 1).padStart(2, "0")}-01`), i === 11 ? yEnd : fromParis(`${year}-${String(i + 2).padStart(2, "0")}-01`)))),
    db.urssafDeclaration.findMany({ where: { period: { startsWith: String(year) } } }),
    db.expense.findMany({ where: { date: { gte: yStart, lt: yEnd } }, orderBy: { date: "desc" } }),
    db.invoice.findMany({ where: { status: "EMISE", kind: { not: "AVOIR" } }, include: { payments: true } }),
    db.invoice.count({ where: { einvoiceStatus: "A_DEPOSER", status: { not: "BROUILLON" }, client: { type: "COMPANY" } } }),
  ]);
  const r = ratesOf(s);
  const act = ACTIVITIES[s.activity];
  // CA d'une période = somme des mois concernés (déjà chargés)
  const periods = periodsOfYear(year, s.frequency, s.creationDate).map((p) => {
    const [, ps] = p.id.split("-");
    const idx = ps.startsWith("T") ? [0, 1, 2].map((k) => (Number(ps.slice(1)) - 1) * 3 + k) : [Number(ps) - 1];
    const ca = Math.round(idx.reduce((a, i) => a + months[i], 0) * 100) / 100;
    return { ...p, ca, c: contributionsFor(ca, s, p.end), d: decls.find((x) => x.period === p.id) };
  });
  const contribYear = periods.reduce((a, p) => a + (p.d ? p.d.contributions + p.d.cfp + p.d.incomeTax : p.c.total), 0);
  const ceil = ceilingFor(s, year);
  const pctCeil = Math.min(100, (yearCA / ceil.ceiling) * 100);
  const pctVat = Math.min(100, (yearCA / ceil.vat) * 100);
  const toCollect = unpaid.reduce((a, i) => a + i.totalTTC - i.deducted - i.payments.filter((p) => p.paidAt).reduce((x, p) => x + p.amount, 0), 0);
  const expTotal = expenses.reduce((a, e) => a + e.amountTTC, 0);
  const max = Math.max(1, ...months);
  const cur = currentPeriodId(s.frequency);
  const qs = `du=${year}-01-01&au=${year}-12-31`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptabilité"
        subtitle={<>Micro-entreprise · {act.label.split(" — ")[0]} · déclaration {s.frequency.toLowerCase()} · <Link href="/parametres/comptabilite" className="text-link-600 hover:underline">réglages</Link></>}
        actions={<div className="flex gap-1">{[year - 1, year, year + 1].filter((y) => y <= parisParts(now).y).map((y) => <Link key={y} href={`/comptabilite?annee=${y}`} className={`badge px-3 py-1.5 ${y === year ? "bg-ink text-paper" : "border border-slate-200 bg-white"}`}>{y}</Link>)}</div>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4"><div className="text-xs text-slate-500">CA encaissé {year}</div><div className="text-2xl font-semibold tabular-nums">{eur0(yearCA)}</div><div className="text-xs text-slate-500">{year - 1} : {eur0(prevCA)}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Cotisations et contributions</div><div className="text-2xl font-semibold tabular-nums">{eur0(contribYear)}</div><div className="text-xs text-slate-500">{r.rate} % + CFP {r.cfp} %{r.vl ? ` + VL ${r.vl} %` : ""}{s.acreUntil ? " · ACRE" : ""}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Revenu après cotisations</div><div className="text-2xl font-semibold tabular-nums">{eur0(yearCA - contribYear)}</div><div className="text-xs text-slate-500">dépenses saisies : {eur0(expTotal)}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">Reste à encaisser (factures émises)</div><div className="text-2xl font-semibold tabular-nums">{eur0(toCollect)}</div><Link href="/factures?statut=EMISE" className="text-xs text-link-600 hover:underline">voir les factures</Link></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Chiffre d'affaires encaissé par mois — ${year}`} className="lg:col-span-2">
          <div className="flex h-44 items-end gap-1.5">
            {months.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-[10px] text-slate-500 tabular-nums">{m ? Math.round(m / 100) / 10 + "k" : ""}</div>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${(m / max) * 130}px` }} title={eur(m)} />
                <div className="text-[10px] text-slate-500">{MONTHS[i]}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Seuils">
          <div className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between"><span>Plafond micro-entreprise{ceil.prorata < 1 ? " (proratisé)" : ""}</span><span className="tabular-nums">{eur0(ceil.ceiling)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${pctCeil > 90 ? "bg-rose-500" : "bg-brand-500"}`} style={{ width: `${pctCeil}%` }} /></div>
              <div className="mt-0.5 text-xs text-slate-500">{Math.round(pctCeil)} % atteint</div>
            </div>
            <div>
              <div className="flex justify-between"><span>Franchise de TVA</span><span className="tabular-nums">{eur0(ceil.vat)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${yearCA > ceil.vat ? "bg-rose-500" : pctVat > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pctVat}%` }} /></div>
              <div className="mt-0.5 text-xs text-slate-500">{yearCA > ceil.vatMajor ? "Seuil majoré dépassé : TVA due dès le 1er jour du dépassement." : yearCA > ceil.vat ? `Seuil dépassé (seuil majoré ${eur0(ceil.vatMajor)}) : TVA à facturer à partir du 1er janvier suivant.` : `${Math.round(pctVat)} % · seuil majoré ${eur0(ceil.vatMajor)}`}</div>
            </div>
            <p className="text-xs text-slate-500">Seuils de l&apos;année en cours, sur le chiffre d&apos;affaires encaissé. À vérifier sur urssaf.fr.</p>
          </div>
        </Card>
      </div>

      <Card title={`Déclarations URSSAF ${year}`} actions={<a href={URSSAF_URL} target="_blank" className="btn-primary py-1.5 text-xs">Ouvrir autoentrepreneur.urssaf.fr ↗</a>}>
        <p className="mb-3 text-sm text-slate-600">Le chiffre d&apos;affaires à déclarer est celui <b>encaissé</b> sur la période (règlements enregistrés). L&apos;URSSAF ne propose pas de dépôt automatique pour un logiciel comme celui-ci : déclarez sur le portail (ou laissez Indy le faire si vous lui confiez la déclaration), puis marquez la période comme déclarée et payée ici.</p>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Période</th><th className="text-right">CA encaissé</th><th className="text-right">Cotisations</th><th className="text-right">CFP</th>{r.vl > 0 && <th className="text-right">Impôt (VL)</th>}<th className="text-right">Total à payer</th><th>Date limite</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {periods.length === 0 && <tr><td colSpan={9} className="text-center text-slate-500">Aucune période à déclarer cette année.</td></tr>}
              {periods.map((p) => {
                const closed = p.end <= now;
                const late = closed && !p.d && p.deadline < now;
                const v = p.d ? { ca: p.d.turnover, s: p.d.contributions, cfp: p.d.cfp, vl: p.d.incomeTax } : { ca: p.ca, s: p.c.social, cfp: p.c.cfp, vl: p.c.incomeTax };
                return (
                  <tr key={p.id} className={p.id === cur ? "bg-brand-50/40" : ""}>
                    <td className="font-medium capitalize">{p.label}{p.c.acre && <span className="ml-1 text-xs text-emerald-700">ACRE</span>}</td>
                    <td className="text-right tabular-nums">{eur(v.ca)}</td>
                    <td className="text-right tabular-nums">{eur(v.s)}</td>
                    <td className="text-right tabular-nums">{eur(v.cfp)}</td>
                    {r.vl > 0 && <td className="text-right tabular-nums">{eur(v.vl)}</td>}
                    <td className="text-right font-semibold tabular-nums">{eur(v.s + v.cfp + v.vl)}</td>
                    <td className={late ? "font-medium text-rose-600" : "text-slate-600"}>{date(p.deadline)}</td>
                    <td>{p.d ? (p.d.paidAt ? <Badge className="bg-emerald-100 text-emerald-700">Payée</Badge> : <Badge className="bg-blue-100 text-blue-700">Déclarée</Badge>) : !closed ? <Badge className="bg-slate-100 text-slate-600">En cours</Badge> : <Badge className={late ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}>{late ? "En retard" : "À déclarer"}</Badge>}</td>
                    <td className="text-right whitespace-nowrap">
                      {!p.d && closed && (
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer text-sm text-link-600">Déclarer</summary>
                          <form action={markDeclared.bind(null, p.id)} className="absolute right-8 z-10 mt-1 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                            <p className="text-xs text-slate-600">Montant à saisir sur le portail, case « {act.label.split(" (")[0].split(" — ")[0]} » :</p>
                            <input name="turnover" defaultValue={Math.round(p.ca)} className="input" />
                            <input name="reference" placeholder="N° de déclaration (facultatif)" className="input" />
                            <button className="btn-primary w-full py-1.5 text-xs">Marquer comme déclarée</button>
                          </form>
                        </details>
                      )}
                      {p.d && !p.d.paidAt && <form action={markDeclarationPaid.bind(null, p.id, true)} className="inline"><button className="text-sm text-link-600">Payée</button></form>}
                      {p.d && <form action={cancelDeclaration.bind(null, p.id)} className="ml-2 inline"><button className="text-xs text-slate-400 hover:text-rose-600">✕</button></form>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!s.creationDate && <p className="mt-3 text-xs text-amber-700">Indiquez votre date de création dans les réglages pour ne pas afficher les périodes antérieures et proratiser le plafond.</p>}
        <p className="mt-3 text-xs text-slate-500">Arrondi à l&apos;euro sur le portail. Le CA déclaré est figé au moment où vous marquez la période « déclarée ».</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Impôt sur le revenu ${year} (déclaration ${year + 1})`}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Chiffre d&apos;affaires encaissé {year}</dt><dd className="font-semibold tabular-nums">{eur0(yearCA)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Case de la déclaration 2042-C-PRO</dt><dd className="font-mono">{s.versementLiberatoire ? act.boxVL : act.box}</dd></div>
            {!s.versementLiberatoire && <div className="flex justify-between"><dt className="text-slate-500">Abattement forfaitaire appliqué par l&apos;administration</dt><dd>{act.abatement} % → revenu imposable ≈ {eur0(yearCA * (1 - act.abatement / 100))}</dd></div>}
            {s.versementLiberatoire && <div className="flex justify-between"><dt className="text-slate-500">Impôt déjà versé (versement libératoire)</dt><dd>{eur0(periods.reduce((a, p) => a + (p.d?.incomeTax ?? p.c.incomeTax), 0))}</dd></div>}
          </dl>
          <p className="mt-3 text-xs text-slate-500">En micro-entreprise il n&apos;y a pas de liasse fiscale ni de bilan : seul le chiffre d&apos;affaires est reporté sur la 2042-C-PRO. Si vous passez au régime réel, la liasse se prépare dans Indy à partir des exports ci-dessous.</p>
        </Card>
        <Card title="Exports (Indy, expert-comptable, contrôle)">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2"><span>📒 Livre des recettes {year} <span className="text-xs text-slate-500">(obligatoire)</span></span><a href={`/api/compta/export?type=recettes&${qs}`} className="btn-secondary py-1 text-xs">CSV</a></li>
            <li className="flex items-center justify-between gap-2"><span>🧾 Registre des factures {year}</span><a href={`/api/compta/export?type=factures&${qs}`} className="btn-secondary py-1 text-xs">CSV</a></li>
            <li className="flex items-center justify-between gap-2"><span>📦 Toutes les factures Factur-X {year}</span><a href={`/api/compta/export?type=zip&${qs}`} className="btn-secondary py-1 text-xs">ZIP</a></li>
            <li className="flex items-center justify-between gap-2"><span>💳 Dépenses {year}</span><a href={`/api/compta/export?type=depenses&${qs}`} className="btn-secondary py-1 text-xs">CSV</a></li>
          </ul>
          {toFile > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{toFile} facture(s) à des clients professionnels restent à déposer sur votre plateforme agréée. <Link href="/factures?pa=1" className="underline">Voir</Link></p>}
        </Card>
      </div>

      <Card title={`Dépenses ${year} — ${eur(expTotal)}`}>
        <form action={addExpense} className="mb-4 grid gap-2 sm:grid-cols-[140px_1fr_1fr_160px_110px_auto]">
          <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
          <input name="supplier" required placeholder="Fournisseur" className="input" />
          <input name="label" placeholder="Libellé" className="input" />
          <select name="category" className="input">{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input name="amountTTC" required inputMode="decimal" placeholder="Montant TTC" className="input" />
          <button className="btn-primary">Ajouter</button>
          <select name="method" className="input sm:col-span-2"><option value="">Mode de paiement</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          <input name="vat" inputMode="decimal" placeholder="dont TVA" className="input" />
          <input type="file" name="receipt" accept="image/*,application/pdf" className="input sm:col-span-3" />
        </form>
        {expenses.length === 0 ? <Empty>Aucune dépense saisie.</Empty> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Fournisseur</th><th>Libellé</th><th>Catégorie</th><th className="text-right">TTC</th><th>Justificatif</th><th /></tr></thead>
            <tbody>{expenses.map((e) => <tr key={e.id}><td>{date(e.date)}</td><td>{e.supplier}</td><td className="text-slate-600">{e.label}</td><td className="text-slate-600">{CATEGORIES[e.category] ?? e.category}</td><td className="text-right tabular-nums">{eur(e.amountTTC)}</td><td>{e.receiptUrl ? <a href={e.receiptUrl} target="_blank" className="text-link-600 hover:underline">voir</a> : "—"}</td><td><form action={deleteExpense.bind(null, e.id)}><button className="text-xs text-slate-400 hover:text-rose-600">✕</button></form></td></tr>)}</tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-slate-500">En micro-entreprise les dépenses ne sont pas déductibles du chiffre d&apos;affaires ; ce suivi sert à connaître votre rentabilité réelle et à préparer un éventuel passage au réel (exports pour Indy).</p>
      </Card>
    </div>
  );
}
