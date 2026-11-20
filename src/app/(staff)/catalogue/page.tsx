import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { pagePerm } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { CATALOG_CATEGORIES } from "@/lib/presta";
import { UNITS } from "@/lib/quotes";
import { eur } from "@/lib/format";
import { getCompany } from "@/lib/company";
import { deleteCatalogItem, saveCatalogItem, toggleCatalogItem, toggleClientOption } from "./actions";

export const metadata = { title: "Catalogue" };

type Item = { id?: string; category?: string; label?: string; description?: string | null; unit?: string; unitPrice?: number; vatRate?: number };

function ItemForm({ it, vatExempt }: { it: Item; vatExempt: boolean }) {
  return (
    <form action={saveCatalogItem.bind(null, it.id ?? null)} className="grid gap-2 sm:grid-cols-[150px_1fr_110px_110px_90px_auto]">
      <select name="category" defaultValue={it.category ?? "PACK"} className="input">{CATALOG_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <div className="space-y-1">
        <input name="label" required defaultValue={it.label} placeholder="Désignation" className="input font-medium" />
        <textarea name="description" rows={1} defaultValue={it.description ?? ""} placeholder="Détail affiché sur le devis" className="input text-xs" />
      </div>
      <select name="unit" defaultValue={it.unit ?? "forfait"} className="input">{UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input name="unitPrice" inputMode="decimal" required defaultValue={it.unitPrice ?? ""} placeholder="Prix HT" className="input" />
      {vatExempt ? <input type="hidden" name="vatRate" value="0" /> : <select name="vatRate" defaultValue={it.vatRate ?? 20} className="input">{[20, 10, 5.5, 0].map((r) => <option key={r} value={r}>{r} %</option>)}</select>}
      <button className="btn-secondary">{it.id ? "Enregistrer" : "Ajouter"}</button>
    </form>
  );
}

export default async function CatalogPage() {
  await pagePerm(await requireStaff(), "canCreateQuotes");
  const [items, c] = await Promise.all([db.catalogItem.findMany({ orderBy: [{ position: "asc" }, { label: "asc" }] }), getCompany()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Catalogue" subtitle="Vos formules, options et tarifs : ajoutés en un clic dans les devis. Les articles « 🛒 option client » sont proposés aux clients dans leur espace organisation." />
      <div className="card p-5"><h2 className="mb-3 font-semibold">Nouvel article</h2><ItemForm it={{}} vatExempt={c.vatExempt} /></div>
      {CATALOG_CATEGORIES.map((cat) => {
        const list = items.filter((i) => i.category === cat.id);
        if (!list.length) return null;
        return (
          <section key={cat.id} className="card">
            <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">{cat.label}</h2>
            <ul className="divide-y divide-slate-100">
              {list.map((i) => (
                <li key={i.id} className={`px-5 py-3 ${i.active ? "" : "opacity-50"}`}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div><div className="font-medium">{i.label}</div>{i.description && <div className="text-xs text-slate-500">{i.description}</div>}</div>
                      <div className="flex shrink-0 items-center gap-3 text-sm">{i.clientOption && <span className="badge bg-brand-50 text-brand-700" title="Proposé dans l'espace organisation des clients">🛒 option client</span>}<span className="font-medium tabular-nums">{eur(i.unitPrice)} HT</span><span className="text-xs text-link-600">modifier</span></div>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <ItemForm it={i} vatExempt={c.vatExempt} />
                      <div className="flex gap-3 text-xs">
                        <form action={toggleClientOption.bind(null, i.id, !i.clientOption)}><button className="text-link-600 hover:underline">{i.clientOption ? "Ne plus proposer au client" : "🛒 Proposer au client en option"}</button></form>
                        <form action={toggleCatalogItem.bind(null, i.id, !i.active)}><button className="text-slate-500 hover:text-slate-800">{i.active ? "Masquer des devis" : "Réactiver"}</button></form>
                        <form action={deleteCatalogItem.bind(null, i.id)}><button className="text-rose-600 hover:underline">Supprimer</button></form>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
