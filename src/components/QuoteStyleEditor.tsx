"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveQuoteStyle } from "@/app/(staff)/parametres/devis/actions";
import { ACCENT_PRESETS, DEFAULT_STYLE, type PdfStyle } from "@/lib/pdfStyleDefs";

const LAYOUTS: { id: PdfStyle["layout"]; label: string; help: string }[] = [
  { id: "classique", label: "Classique", help: "En-tête de tableau foncé, encadré client gris." },
  { id: "moderne", label: "Moderne", help: "Bandeau de couleur, lignes alternées, total en couleur." },
  { id: "epure", label: "Épuré", help: "Sans aplats : filets fins, la couleur sur le titre et le total." },
];

const TITLES = ["Devis", "Proposition commerciale", "Offre de prestation", "Estimation"];

/** Mini-schéma d'une disposition (les proportions d'une page A4). */
function Thumb({ layout, accent }: { layout: PdfStyle["layout"]; accent: string }) {
  return (
    <div className="relative mx-auto aspect-[210/297] w-20 overflow-hidden rounded-sm bg-[#fff] p-1.5 shadow ring-1 ring-slate-200">
      {layout === "moderne" && <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />}
      <div className="flex justify-between"><div className="h-1.5 w-6 rounded-sm" style={{ background: accent }} /><div className="space-y-0.5"><div className="h-0.5 w-5 bg-[#cbd5e1]" /><div className="h-0.5 w-4 bg-[#cbd5e1]" /></div></div>
      <div className="mt-2 flex justify-between"><div className="h-1 w-7 rounded-sm" style={{ background: layout === "epure" ? "transparent" : accent, outline: layout === "epure" ? `1px solid ${accent}` : undefined }} />
        {layout === "epure" ? <div className="h-3 w-6 border-l" style={{ borderColor: accent }} /> : <div className="h-3 w-6 rounded-sm" style={{ background: layout === "moderne" ? `${accent}22` : "#eef1f6" }} />}</div>
      <div className="mt-1.5 h-1 w-full" style={layout === "epure" ? { borderBottom: `1px solid ${accent}` } : { background: layout === "moderne" ? accent : "#14213d" }} />
      {[0, 1, 2, 3].map((i) => <div key={i} className="mt-1 h-1 w-full" style={{ background: layout === "moderne" && i % 2 ? "#f1f4f9" : "transparent", borderBottom: layout === "moderne" ? undefined : "1px solid #e5e7eb" }} />)}
      <div className="mt-1.5 ml-auto h-1.5 w-8 rounded-sm" style={{ background: layout === "moderne" ? accent : "transparent", outline: layout === "moderne" ? undefined : `1px solid ${accent}` }} />
    </div>
  );
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 p-0.5 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-link-500 [&>span]:transition-transform peer-checked:[&>span]:translate-x-4"><span className="h-4 w-4 rounded-full bg-[#fff] shadow" /></span>
      <span className="text-sm"><span className="font-medium">{label}</span>{help && <span className="block text-xs text-slate-500">{help}</span>}</span>
    </label>
  );
}

export function QuoteStyleEditor({ initial }: { initial: PdfStyle }) {
  const [st, setSt] = useState<PdfStyle>(initial);
  const [saved, setSaved] = useState<PdfStyle>(initial);
  const [src, setSrc] = useState(`/api/devis/apercu?s=${encodeURIComponent(JSON.stringify(initial))}`);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const set = <K extends keyof PdfStyle>(k: K, v: PdfStyle[K]) => { setSt((x) => ({ ...x, [k]: v })); setMsg(""); };
  const dirty = useMemo(() => JSON.stringify(st) !== JSON.stringify(saved), [st, saved]);

  // aperçu rafraîchi 600 ms après la dernière modification
  useEffect(() => {
    const t = setTimeout(() => setSrc(`/api/devis/apercu?s=${encodeURIComponent(JSON.stringify(st))}`), 600);
    return () => clearTimeout(t);
  }, [st]);

  const save = () => start(async () => { await saveQuoteStyle(st); setSaved(st); setMsg("Mise en forme enregistrée : elle s'applique aux prochains PDF."); });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="font-semibold">Disposition</h2>
          <div role="radiogroup" aria-label="Disposition" className="mt-3 grid grid-cols-3 gap-3">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={st.layout === l.id} onClick={() => set("layout", l.id)}
                className={`rounded-xl p-3 text-left ring-1 transition ${st.layout === l.id ? "bg-brand-50 ring-2 ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>
                <Thumb layout={l.id} accent={st.accent} />
                <div className="mt-2 text-sm font-medium">{l.label}</div>
                <div className="text-xs text-slate-500">{l.help}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="card grid gap-5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-semibold">Couleur</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map(([hex, name]) => (
                <button key={hex} type="button" onClick={() => set("accent", hex)} title={name} aria-label={name} aria-pressed={st.accent === hex}
                  className={`h-9 w-9 rounded-full ring-offset-2 transition ${st.accent === hex ? "ring-2 ring-ink" : "hover:scale-105"}`} style={{ background: hex }} />
              ))}
              <label className="ml-2 flex items-center gap-2 text-sm text-slate-600">
                <input type="color" value={st.accent} onChange={(e) => set("accent", e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white" />
                Personnalisée
              </label>
            </div>
          </div>
          <div>
            <span className="label">Police</span>
            <div className="flex gap-2">
              {([["helvetica", "Sans empattement", "font-sans"], ["times", "Avec empattement", "font-serif"]] as const).map(([k, l, cls]) => (
                <button key={k} type="button" onClick={() => set("font", k)} aria-pressed={st.font === k} className={`flex-1 rounded-lg px-3 py-2 text-sm ring-1 ${cls} ${st.font === k ? "bg-brand-50 ring-2 ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Logo et coordonnées</span>
            <div className="flex gap-2">
              {([["left", "À gauche"], ["center", "Centrés"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => set("logoPosition", k)} aria-pressed={st.logoPosition === k} className={`flex-1 rounded-lg px-3 py-2 text-sm ring-1 ${st.logoPosition === k ? "bg-brand-50 ring-2 ring-brand-600" : "ring-slate-200 hover:bg-slate-50"}`}>{l}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Textes</h2>
          <label className="block">
            <span className="label">Titre du document</span>
            <input list="titres" value={st.title} onChange={(e) => set("title", e.target.value)} maxLength={40} className="input" />
            <datalist id="titres">{TITLES.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="block">
            <span className="label">Introduction (facultatif)</span>
            <textarea value={st.intro} onChange={(e) => set("intro", e.target.value)} rows={3} maxLength={1500} placeholder="Merci pour votre confiance ! Voici notre proposition pour faire de votre soirée un moment inoubliable." className="input" />
          </label>
          <label className="block">
            <span className="label">Conditions générales de vente (facultatif, ajoutées en dernière page)</span>
            <textarea value={st.cgv} onChange={(e) => set("cgv", e.target.value)} rows={6} maxLength={30000} placeholder={"Article 1 - Objet\nLes présentes conditions s'appliquent…"} className="input font-mono text-[13px]" />
            <span className="mt-1 block text-xs text-slate-500">Une ligne commençant par « Article », « 1. » ou « # » devient un titre en gras.</span>
          </label>
        </section>

        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Contenu affiché</h2>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <Toggle checked={st.showEvent} onChange={(v) => set("showEvent", v)} label="Informations de l'événement" help="Type, date, lieu, invités" />
            <Toggle checked={st.showDescriptions} onChange={(v) => set("showDescriptions", v)} label="Détail sous chaque ligne" />
            <Toggle checked={st.showUnits} onChange={(v) => set("showUnits", v)} label="Unités (heure, km, forfait…)" />
            <Toggle checked={st.lineNumbers} onChange={(v) => set("lineNumbers", v)} label="Numéroter les lignes" />
            <Toggle checked={st.showDeposit} onChange={(v) => set("showDeposit", v)} label="Encadré acompte et solde" />
            <Toggle checked={st.showBank} onChange={(v) => set("showBank", v)} label="Coordonnées bancaires" help="IBAN et BIC de Paramètres › Entreprise" />
            <Toggle checked={st.showSignature} onChange={(v) => set("showSignature", v)} label="Cadre « Bon pour accord »" />
            <Toggle checked={st.applyToInvoices} onChange={(v) => set("applyToInvoices", v)} label="Même style pour factures et contrats" help="Couleur, police et disposition" />
          </div>
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/85 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
          <button type="button" onClick={save} disabled={pending || !dirty} className="btn-primary">{pending ? "Enregistrement…" : "Enregistrer la mise en forme"}</button>
          <button type="button" onClick={() => setSt(saved)} disabled={!dirty} className="btn-secondary">Annuler les modifications</button>
          <button type="button" onClick={() => setSt({ ...DEFAULT_STYLE, cgv: st.cgv, intro: st.intro })} className="text-sm text-slate-500 hover:text-ink">Revenir au style par défaut</button>
          <span role="status" className="text-sm text-emerald-700">{msg}</span>
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
        <div className="card flex h-[70vh] flex-col overflow-hidden xl:h-full">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm">
            <span className="font-medium">Aperçu</span>
            <a href={src} target="_blank" className="text-link-600 hover:underline">Ouvrir en grand</a>
          </div>
          <iframe key={src} src={`${src}#toolbar=0&navpanes=0&view=FitH`} title="Aperçu du devis" className="w-full flex-1 bg-slate-100" />
        </div>
      </aside>
    </div>
  );
}
