"use client";
import { useMemo, useState } from "react";

/** Choix du client, ou création à la volée (« Nouveau client »). */
export function ClientPicker({ clients, defaultValue }: { clients: { id: string; name: string; email?: string | null }[]; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue || (clients.length ? "" : "__new__"));
  const [q, setQ] = useState("");
  const [type, setType] = useState("INDIVIDUAL");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? clients.filter((c) => c.name.toLowerCase().includes(t) || c.email?.toLowerCase().includes(t)) : clients;
  }, [clients, q]);
  const isNew = value === "__new__";
  return (
    <div className="space-y-2">
      <span className="label">Client *</span>
      {clients.length > 8 && !isNew && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="input" />}
      <select name="clientId" required value={value} onChange={(e) => setValue(e.target.value)} className="input">
        <option value="" disabled>Choisir…</option>
        <option value="__new__">➕ Nouveau client…</option>
        {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {isNew && (
        <div className="grid gap-2 rounded-lg border border-brand-100 bg-brand-50/50 p-3 sm:grid-cols-2">
          <div className="flex gap-2 sm:col-span-2">
            {[["INDIVIDUAL", "Particulier"], ["COMPANY", "Entreprise / association"]].map(([k, l]) => (
              <label key={k} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${type === k ? "border-brand-600 bg-white font-medium text-brand-700" : "border-slate-200 text-slate-500"}`}>
                <input type="radio" name="newClientType" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" /> {l}
              </label>
            ))}
          </div>
          <input name="newClientName" required placeholder={type === "COMPANY" ? "Raison sociale *" : "Nom et prénom * (ex. Julie Martin & Thomas Roux)"} className="input sm:col-span-2" />
          <input name="newClientEmail" type="email" placeholder="E-mail" className="input" />
          <input name="newClientPhone" type="tel" placeholder="Téléphone" className="input" />
          <input name="newClientAddress" placeholder="Adresse" className="input" />
          <div className="grid grid-cols-[110px_1fr] gap-2"><input name="newClientPostalCode" placeholder="Code postal" className="input" /><input name="newClientCity" placeholder="Ville" className="input" /></div>
          {type === "COMPANY" && <input name="newClientSiren" placeholder="SIREN (utile pour la facture électronique)" className="input sm:col-span-2" />}
          <p className="text-xs text-slate-500 sm:col-span-2">Si un client avec le même e-mail existe déjà, la prestation lui est rattachée.</p>
        </div>
      )}
    </div>
  );
}
