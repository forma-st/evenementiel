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
  success: "bg-emerald-500 text-white",
  info: "bg-brand-600 text-white",
  error: "bg-rose-600 text-white",
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
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 print:hidden">
      {list.map((t) => (
        <div key={t.key} role="status" className="toast-in pointer-events-auto flex items-start gap-3 rounded-2xl bg-white p-3 pr-2 shadow-2xl ring-1 ring-slate-200">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${TONE[t.tone]}`} aria-hidden>{t.icon}</span>
          <button type="button" onClick={() => { if (t.link) router.push(t.link); setList((l) => l.filter((x) => x.key !== t.key)); }} className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold">{t.title}</span>
            {t.body && <span className="line-clamp-2 block text-xs text-slate-500">{t.body}</span>}
          </button>
          <button type="button" onClick={() => setList((l) => l.filter((x) => x.key !== t.key))} aria-label="Fermer" className="px-1 text-slate-400 hover:text-slate-700">×</button>
        </div>
      ))}
    </div>
  );
}
