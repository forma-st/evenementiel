"use client";
import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";
const KEY = "theme";

/** Script exécuté avant l'affichage : applique le thème mémorisé (évite l'éclair blanc). */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");document.documentElement.dataset.theme=(t==="light"||t==="dark")?t:"system"}catch(e){document.documentElement.dataset.theme="system"}`;

const ICONS: Record<Mode, React.ReactNode> = {
  light: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden><circle cx="10" cy="10" r="3.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" strokeLinecap="round" /></svg>,
  dark: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden><path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8Z" strokeLinejoin="round" /></svg>,
  system: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden><rect x="2.5" y="3.5" width="15" height="10" rx="1.5" /><path d="M7 17h6M10 13.5V17" strokeLinecap="round" /></svg>,
};
const LABELS: Record<Mode, string> = { light: "Clair", dark: "Sombre", system: "Système" };

export function ThemeSwitch({ compact = false, full = false }: { compact?: boolean; full?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    const t = document.documentElement.dataset.theme as Mode | undefined;
    if (t === "light" || t === "dark" || t === "system") setMode(t);
  }, []);
  const choose = (m: Mode) => {
    setMode(m);
    document.documentElement.dataset.theme = m;
    try { localStorage.setItem(KEY, m); } catch {}
  };
  return (
    <div role="radiogroup" aria-label="Apparence" className={`${full ? "grid w-full grid-cols-3" : "inline-flex"} rounded-full border border-slate-200 bg-slate-100/70 p-0.5`}>
      {(["light", "dark", "system"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          title={LABELS[m]}
          onClick={() => choose(m)}
          className={`flex items-center justify-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${mode === m ? "bg-white font-medium text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}
        >
          {ICONS[m]}{!compact && <span>{LABELS[m]}</span>}
        </button>
      ))}
    </div>
  );
}
