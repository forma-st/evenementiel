"use client";
import { useState, useTransition } from "react";

export function DeleteClientButton({ action, name, counts, compact }: {
  action: () => Promise<void>;
  name: string;
  counts: { dossiers: number; quotes: number; tasks: number };
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const linked = [
    counts.dossiers && `${counts.dossiers} dossier(s)`,
    counts.quotes && `${counts.quotes} devis`,
    counts.tasks && `${counts.tasks} tâche(s)`,
  ].filter(Boolean);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-brand-50 hover:text-brand-600" : "btn border border-brand-100 bg-white text-brand-600 hover:bg-brand-50"}
        title="Supprimer le client"
      >
        {compact ? "Supprimer" : "🗑 Supprimer"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-4 p-6 text-left">
            <h2 className="text-lg font-semibold">Supprimer « {name} » ?</h2>
            {linked.length > 0 ? (
              <p className="text-sm text-slate-600">
                Seront aussi supprimés : <b>{linked.join(", ")}</b>, les contacts, questionnaires et accès portail de ce client.
              </p>
            ) : (
              <p className="text-sm text-slate-600">Les contacts et accès portail de ce client seront aussi supprimés.</p>
            )}
            <p className="text-sm text-slate-500">Cette action est définitive.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
              <button type="button" disabled={pending} onClick={() => start(() => action())} className="btn-danger">
                {pending ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
