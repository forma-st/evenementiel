"use client";
import { useState, useTransition } from "react";

/** Bouton qui ouvre une fenêtre de confirmation avant une action destructive. */
export function ConfirmButton({ action, label, title, message, confirmLabel = "Supprimer définitivement", className }: {
  action: () => Promise<void>;
  label: React.ReactNode;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "px-2 py-2 text-sm text-slate-400 hover:text-brand-600"}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="card w-full max-w-md space-y-4 p-6 text-left">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="text-sm text-slate-600">{message}</div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
              <button type="button" disabled={pending} onClick={() => start(() => action())} className="btn-danger">{pending ? "…" : confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
