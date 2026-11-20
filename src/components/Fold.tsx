"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Section repliable (fermée par défaut) ; l'état ouvert/fermé est retenu sur cet appareil. */
export function Fold({ id, title, summary, actions, children, defaultOpen = false, forceOpen = false, card = true, className = "" }: {
  id: string; title: ReactNode; summary?: ReactNode; actions?: ReactNode; children: ReactNode;
  defaultOpen?: boolean; forceOpen?: boolean; card?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { try { const v = localStorage.getItem(`fold:${id}`); if (v) setOpen(v === "1"); } catch {} }, [id]);
  const toggle = () => setOpen((o) => { try { localStorage.setItem(`fold:${id}`, o ? "0" : "1"); } catch {} return !o; });
  const shown = open || forceOpen;
  return (
    <section className={`${card ? "card overflow-hidden" : ""} ${className}`}>
      <div className={`flex items-center gap-3 px-5 py-3 ${shown ? "border-b border-slate-100" : ""}`}>
        <button type="button" onClick={toggle} aria-expanded={shown} aria-controls={`fold-${id}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${shown ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
          <span className="shrink-0 font-semibold">{title}</span>
          {summary && <span className="min-w-0 truncate text-sm text-slate-500">{summary}</span>}
        </button>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {shown && <div id={`fold-${id}`}>{children}</div>}
    </section>
  );
}
