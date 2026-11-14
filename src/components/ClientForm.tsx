"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Client } from "@prisma/client";
import type { Company } from "@/lib/sirene";
import { TagPicker, type TagOpt } from "./TagPicker";

type Result = Company & { existingId: string | null };

const FIELDS = ["type", "name", "siren", "siret", "vatNumber", "nafCode", "legalForm", "headcount", "email", "phone", "address", "postalCode", "city", "country", "notes"] as const;
type Values = Record<(typeof FIELDS)[number], string>;

export function ClientForm({ action, client, submit, tags, selectedTags = [], users, ownerId, canCreateTag }: {
  action: (f: FormData) => void;
  client?: Client;
  submit: string;
  tags: TagOpt[];
  selectedTags?: string[];
  users: { id: string; name: string }[];
  ownerId?: string | null;
  canCreateTag: boolean;
}) {
  const [v, setV] = useState<Values>(() => {
    const o = {} as Values;
    for (const k of FIELDS) o[k] = (client?.[k] as string | null | undefined) ?? "";
    if (!o.type) o.type = "COMPANY";
    if (!o.country) o.country = "FR";
    return o;
  });
  const [filled, setFilled] = useState<string | null>(null);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const pick = (c: Company) => {
    setV((s) => ({
      ...s,
      type: "COMPANY",
      name: c.name,
      siren: c.siren,
      siret: c.siret ?? "",
      vatNumber: c.vatNumber,
      nafCode: c.nafCode ?? "",
      legalForm: c.legalForm ?? "",
      headcount: c.headcount ?? "",
      address: c.address,
      postalCode: c.postalCode,
      city: c.city,
      country: "FR",
      notes: s.notes || (c.director ? `Dirigeant : ${c.director}` : ""),
    }));
    setFilled(c.name);
  };

  return (
    <form action={action} className="space-y-6">
      {v.type === "COMPANY" && <InseeSearch onPick={pick} initial={client ? "" : undefined} />}
      {filled && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          ✓ Fiche pré-remplie avec les données INSEE de <b>{filled}</b>. Complétez l'e-mail et le téléphone.
        </div>
      )}

      <div className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <L label="Type">
            <select name="type" value={v.type} onChange={set("type")} className="input">
              <option value="COMPANY">Entreprise</option>
              <option value="INDIVIDUAL">Particulier</option>
            </select>
          </L>
          <div className="sm:col-span-2">
            <L label={v.type === "COMPANY" ? "Raison sociale *" : "Nom et prénom *"}>
              <input name="name" required value={v.name} onChange={set("name")} className="input" />
            </L>
          </div>
        </div>

        {v.type === "COMPANY" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <L label="SIREN"><input name="siren" value={v.siren} onChange={set("siren")} inputMode="numeric" className="input" /></L>
            <L label="SIRET (siège)"><input name="siret" value={v.siret} onChange={set("siret")} inputMode="numeric" className="input" /></L>
            <L label="N° TVA intracommunautaire"><input name="vatNumber" value={v.vatNumber} onChange={set("vatNumber")} className="input" /></L>
            <L label="Forme juridique"><input name="legalForm" value={v.legalForm} onChange={set("legalForm")} className="input" /></L>
            <L label="Code NAF / APE"><input name="nafCode" value={v.nafCode} onChange={set("nafCode")} className="input" /></L>
            <L label="Effectif"><input name="headcount" value={v.headcount} onChange={set("headcount")} className="input" /></L>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <L label="E-mail"><input name="email" type="email" value={v.email} onChange={set("email")} className="input" /></L>
          <L label="Téléphone"><input name="phone" value={v.phone} onChange={set("phone")} className="input" /></L>
          <div />
          <div className="sm:col-span-3">
            <L label="Adresse"><input name="address" value={v.address} onChange={set("address")} className="input" /></L>
          </div>
          <L label="Code postal"><input name="postalCode" value={v.postalCode} onChange={set("postalCode")} className="input" /></L>
          <L label="Ville"><input name="city" value={v.city} onChange={set("city")} className="input" /></L>
          <L label="Pays (code ISO)"><input name="country" value={v.country} onChange={set("country")} maxLength={2} className="input" /></L>
          <div className="sm:col-span-2">
            {/* pas de <label> autour : il refermerait la liste à chaque clic */}
            <div>
              <span className="label">Étiquettes</span>
              <TagPicker tags={tags} selected={selectedTags} canCreate={canCreateTag} />
            </div>
          </div>
          <L label="Responsable commercial">
            <select name="ownerId" defaultValue={ownerId ?? ""} className="input">
              <option value="">Aucun</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </L>
          <div className="sm:col-span-3">
            <L label="Notes internes"><textarea name="notes" rows={3} value={v.notes} onChange={set("notes")} className="input" /></L>
          </div>
        </div>
        <button className="btn-primary">{submit}</button>
      </div>
    </form>
  );
}

function InseeSearch({ onPick, initial }: { onPick: (c: Company) => void; initial?: string }) {
  const [q, setQ] = useState(initial ?? "");
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setResults(null); setError(null); return; }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/entreprises?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        if (id !== seq.current) return;
        if (!res.ok) { setError(data.error ?? "Erreur"); setResults(null); }
        else { setError(null); setResults(data.results); }
      } catch {
        if (id === seq.current) setError("Base INSEE injoignable.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="card border-l-4 border-l-link-600 p-5">
      <div className="mb-1 font-semibold">Rechercher dans la base INSEE (SIRENE)</div>
      <p className="mb-3 text-sm text-slate-500">Nom de l'entreprise, SIREN ou SIRET. Cliquez sur un résultat pour pré-remplir la fiche.</p>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Ex. : Acme BTP Toulouse, 552100554…"
          className="input pr-10"
          autoFocus={initial === undefined}
          aria-label="Recherche INSEE"
        />
        {loading && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">…</span>}
      </div>
      {error && <p className="mt-2 text-sm text-brand-600">{error}</p>}
      {results && results.length === 0 && !loading && <p className="mt-3 text-sm text-slate-500">Aucune entreprise trouvée.</p>}
      {results && results.length > 0 && (
        <ul className="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {results.map((r) => (
            <li key={r.siren} className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
              <button type="button" onClick={() => { onPick(r); setResults(null); setQ(""); }} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {!r.active && <span className="badge bg-slate-200 text-slate-600">Fermée</span>}
                  {r.legalForm && <span className="text-xs text-slate-500">{r.legalForm}</span>}
                </div>
                <div className="text-xs text-slate-500">
                  SIREN {r.siren.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")} · {[r.address, `${r.postalCode} ${r.city}`.trim()].filter(Boolean).join(", ")}
                  {r.nafCode && ` · NAF ${r.nafCode}`}{r.headcount && r.headcount !== "Non renseigné" && ` · ${r.headcount} sal.`}
                </div>
              </button>
              {r.existingId && (
                <Link href={`/clients/${r.existingId}`} className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200">
                  Déjà client →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
