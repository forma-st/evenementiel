"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ToastTone } from "@/lib/toast";

type T = { key: string; title: string; body?: string | null; link?: string | null; tone: ToastTone; icon: string };

/** Icône et ton d'après le texte de la notification (devis accepté, paiement reçu, relance…). */
function look(title: string, type?: string): { icon: string; tone: ToastTone } {
  const t = title.toLowerCase();
  if (/accept|sign|payé|paiement reçu|réglé|confirm/.test(t)) return { icon: "✓", tone: "success" };
  if (/refus|échec|retard|erreur|annul/.test(t)) return { icon: "!", tone: "error" };
  if (/relance|e-mail|envoy/.test(t)) return { icon: "✉", tone: "info" };
  if (type === "MESSAGE" || type === "MENTION") return { icon: "💬", tone: "info" };
  if (type === "QUESTIONNAIRE") return { icon: "☑", tone: "info" };
  return { icon: "🔔", tone: "info" };
}
const TONE: Record<ToastTone, string> = {
  success: "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30",
  info: "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-amber-500/30",
  error: "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/30",
};
const SVG: Record<string, React.ReactNode> = {
  "✓": <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  "!": <><path d="M12 8v5M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></>,
  "✉": <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  "🔔": <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  "💬": <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  "☑": <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></>,
};

/** Notifications flottantes en bas à droite : nouvelles notifications (interrogées toutes les 25 s) et confirmations locales. */
export function Toaster() {
  const [list, setList] = useState<T[]>([]);
  const since = useRef<string | null>(null);
  const router = useRouter();

  const push = (t: T) => {
    setList((l) => [...l.filter((x) => x.key !== t.key), t].slice(-4));
    setTimeout(() => setList((l) => l.filter((x) => x.key !== t.key)), 8000);
  };

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/notifications/flux${since.current ? `?since=${encodeURIComponent(since.current)}` : ""}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { now: string; items: { id: string; type: string; title: string; body: string | null; link: string | null }[] };
        if (stop) return;
        since.current = j.now;
        for (const n of j.items) push({ key: n.id, title: n.title, body: n.body, link: n.link, ...look(n.title, n.type) });
        if (j.items.length) router.refresh();
      } catch { /* hors ligne : on réessaiera */ }
    };
    poll();
    const id = setInterval(poll, 25_000);
    const onVis = () => document.visibilityState === "visible" && poll();
    const onLocal = (e: Event) => {
      const d = (e as CustomEvent).detail as { title: string; body?: string; tone?: ToastTone; link?: string };
      const l = look(d.title);
      push({ key: `l${Date.now()}${Math.random()}`, title: d.title, body: d.body, link: d.link, tone: d.tone ?? l.tone, icon: d.tone === "error" ? "!" : d.tone === "success" ? "✓" : l.icon });
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("app:toast", onLocal);
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("app:toast", onLocal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 print:hidden">
      {list.map((t) => (
        <div key={t.key} role="status" className="toast-in pointer-events-auto flex items-center gap-4 rounded-3xl bg-white p-3.5 pr-2 shadow-[0_20px_50px_-15px_rgba(15,33,71,.35)] ring-1 ring-slate-200/70">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${t.tone === "info" && t.icon === "✉" ? "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-blue-500/30" : TONE[t.tone]}`} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{SVG[t.icon] ?? SVG["🔔"]}</svg>
          </span>
          <button type="button" onClick={() => { if (t.link) router.push(t.link); setList((l) => l.filter((x) => x.key !== t.key)); }} className="min-w-0 flex-1 text-left">
            <span className="block font-semibold leading-snug">{t.title}</span>
            {t.body && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{t.body}</span>}
          </button>
          <button type="button" onClick={() => setList((l) => l.filter((x) => x.key !== t.key))} aria-label="Fermer" className="self-start px-1 text-slate-400 hover:text-slate-700">×</button>
        </div>
      ))}
    </div>
  );
}
