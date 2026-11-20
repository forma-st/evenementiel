"use client";
import { useState, useTransition } from "react";
import { quickReturn } from "@/app/(staff)/materiel/sortie/actions";
import { toast } from "@/lib/toast";

/** « Tout est rendu » en un clic (confirmation sur le bouton lui-même). */
export function ReturnButton({ dossierId, label = "Rendu ✓", className = "" }: { dossierId: string; label?: string; className?: string }) {
  const [pending, run] = useTransition();
  const [ask, setAsk] = useState(false);
  return (
    <button type="button" disabled={pending}
      onClick={() => { if (!ask) { setAsk(true); setTimeout(() => setAsk(false), 4000); return; } run(async () => { await quickReturn(dossierId); toast("Matériel rendu", { body: "Tout est revenu en bon état.", tone: "success" }); }); }}
      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition ${ask ? "bg-emerald-600 text-white ring-emerald-600" : "text-emerald-700 ring-emerald-300 hover:bg-emerald-50"} ${className}`}>
      {pending ? "…" : ask ? "Confirmer : tout est rendu" : label}
    </button>
  );
}
