"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Client = { id: string; name: string; email: string | null; contacts: { firstName: string; lastName: string; email: string | null; jobTitle: string | null }[] };
type Signer = { name: string; email: string };

export function SignatureRequestForm({ clients, dossiers, quotes, defaults }: {
  clients: Client[];
  dossiers: { id: string; label: string; clientId: string }[];
  quotes: { id: string; label: string; clientId: string; dossierId: string | null }[];
  defaults: { clientId?: string; dossierId?: string; quoteId?: string };
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaults.clientId ?? "");
  const [source, setSource] = useState<"upload" | "quote">(defaults.quoteId ? "quote" : "upload");
  const [quoteId, setQuoteId] = useState(defaults.quoteId ?? "");
  const [dossierId, setDossierId] = useState(defaults.dossierId ?? "");
  const client = clients.find((c) => c.id === clientId);
  const suggestions = useMemo<Signer[]>(() => {
    if (!client) return [];
    const list = client.contacts.map((c) => ({ name: `${c.firstName} ${c.lastName}`.trim(), email: c.email ?? "" }));
    if (!list.length && client.email) list.push({ name: "", email: client.email });
    return list;
  }, [client]);
  const firstSigner = (c?: Client): Signer => {
    const f = c?.contacts[0];
    return f ? { name: `${f.firstName} ${f.lastName}`.trim(), email: f.email ?? "" } : { name: "", email: c?.email ?? "" };
  };
  // pré-remplit avec le premier contact du client choisi (y compris en arrivant depuis un devis)
  const [signers, setSigners] = useState<Signer[]>(() => [firstSigner(clients.find((c) => c.id === defaults.clientId))]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pickClient = (id: string) => {
    setClientId(id);
    setDossierId(""); setQuoteId("");
    setSigners([firstSigner(clients.find((x) => x.id === id))]);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (source === "upload") {
      const f = fd.get("file") as File | null;
      if (!f || !f.size) return setError("Choisissez un fichier PDF.");
      if (f.size > 4 * 1024 * 1024) return setError("Le PDF dépasse 4 Mo : compressez-le avant de l'envoyer.");
    }
    setPending(true);
    try {
      const r = await fetch("/api/signatures", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erreur");
      router.push(`/signatures/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  // lorsqu'un devis est choisi, on reprend son dossier
  const chooseQuote = (id: string) => {
    setQuoteId(id);
    const q = quotes.find((x) => x.id === id);
    if (q?.dossierId) setDossierId(q.dossierId);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <input type="hidden" name="source" value={source} />
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="block">
          <span className="label">Client *</span>
          <select name="clientId" required value={clientId} onChange={(e) => pickClient(e.target.value)} className="input">
            <option value="" disabled>Choisir…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Prestation</span>
          <select name="dossierId" value={dossierId} onChange={(e) => setDossierId(e.target.value)} disabled={!clientId} className="input">
            <option value="">Aucun</option>
            {dossiers.filter((d) => d.clientId === clientId).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
      </div>

      <div className="card space-y-4 p-6">
        <div className="font-semibold">Document à signer</div>
        <div className="flex flex-wrap gap-2">
          {([["upload", "📄 Déposer un PDF (fiche technique, avenant…)"], ["quote", "€ Un devis"]] as const).map(([k, l]) => (
            <label key={k} className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${source === k ? "border-link-500 bg-link-100/50 font-medium" : "border-slate-200"}`}>
              <input type="radio" checked={source === k} onChange={() => setSource(k)} className="sr-only" /> {l}
            </label>
          ))}
        </div>
        {source === "upload" ? (
          <input type="file" name="file" accept="application/pdf,.pdf" className="input" />
        ) : (
          <select name="quoteId" value={quoteId} onChange={(e) => chooseQuote(e.target.value)} disabled={!clientId} className="input">
            <option value="">{clientId ? "Choisir un devis…" : "Choisissez d'abord le client"}</option>
            {quotes.filter((q) => q.clientId === clientId).map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        )}
        {source === "quote" && <p className="text-xs text-slate-500">Le devis est mis en page à vos couleurs. Une fois signé, il passe en « Accepté ».</p>}
        <label className="block">
          <span className="label">Titre affiché au signataire</span>
          <input name="title" placeholder={source === "quote" ? "Par défaut : numéro et objet du devis" : "Ex. : Avenant horaires"} className="input" />
        </label>
      </div>

      <div className="card space-y-3 p-6">
        <div className="font-semibold">Signataires</div>
        {signers.map((s, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input name="signerName" required placeholder="Nom et prénom" value={s.name} onChange={(e) => setSigners((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className="input" />
            <input name="signerEmail" type="email" placeholder="E-mail (facultatif)" value={s.email} onChange={(e) => setSigners((x) => x.map((y, j) => (j === i ? { ...y, email: e.target.value } : y)))} className="input" />
            <button type="button" disabled={signers.length === 1} onClick={() => setSigners((x) => x.filter((_, j) => j !== i))} className="px-2 text-sm text-slate-400 hover:text-brand-600 disabled:opacity-30">Retirer</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSigners((x) => [...x, { name: "", email: "" }])} className="btn-secondary py-1.5 text-xs">+ Ajouter un signataire</button>
          {suggestions.filter((sg) => sg.name && !signers.some((s) => s.name === sg.name)).map((sg) => (
            <button key={sg.name} type="button" onClick={() => setSigners((x) => [...x.filter((y) => y.name || y.email), sg])} className="btn-secondary py-1.5 text-xs">+ {sg.name}</button>
          ))}
        </div>
      </div>

      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Message au signataire</span>
          <textarea name="message" rows={3} className="input" placeholder="Bonjour, voici le document à signer…" />
        </label>
        <label className="block">
          <span className="label">Validité du lien</span>
          <select name="expiresInDays" defaultValue="30" className="input">
            {[7, 15, 30, 60, 90].map((d) => <option key={d} value={d}>{d} jours</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="winOnSign" defaultChecked disabled={!dossierId} className="h-4 w-4 accent-brand-600" />
          Passer la prestation à « Confirmée » une fois signé <span className="text-xs text-slate-500">(déclenche les automatisations)</span>
        </label>
      </div>

      {error && <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">{error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Préparation…" : "Créer la demande de signature"}</button>
    </form>
  );
}
