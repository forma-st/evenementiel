"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatRoom } from "./ChatRoom";
import type { ChatMessage } from "@/lib/chat";

type Conv = {
  id: string; kind: string; name: string; unread: number;
  last: { id: string; body: string; at: string; mine: boolean; author: string } | null;
  people: { id: string; name: string }[];
};
type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; at: string };
type Dock = { me: string; conversations: Conv[]; notifications: Notif[]; unreadNotifs: number; unreadMessages: number };
type Toast = { key: string; title: string; body: string; onOpen: () => void };

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const ICON: Record<string, string> = { TASK: "✓", MENTION: "@", MESSAGE: "💬", EVENT: "▦", QUESTIONNAIRE: "☑", SYSTEM: "ℹ" };
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } };

export function ChatDock() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"messages" | "notifs">("messages");
  const [active, setActive] = useState<string | null>(null);
  const [data, setData] = useState<Dock | null>(null);
  const [initial, setInitial] = useState<ChatMessage[] | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const seen = useRef<{ msgs: Set<string>; notifs: Set<string> } | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  // état mémorisé entre les pages
  useEffect(() => {
    setOpen(store.get("dock.open") === "1");
    setTab(store.get("dock.tab") === "notifs" ? "notifs" : "messages");
    setActive(store.get("dock.active"));
  }, []);
  useEffect(() => { store.set("dock.open", open ? "1" : "0"); }, [open]);
  useEffect(() => { store.set("dock.tab", tab); }, [tab]);
  useEffect(() => { store.set("dock.active", active ?? ""); }, [active]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dock", { cache: "no-store" });
      if (!r.ok) return;
      const d: Dock = await r.json();
      // aperçu des nouveautés (pas au premier chargement)
      const msgs = new Set(d.conversations.map((c) => c.last?.id).filter(Boolean) as string[]);
      const notifs = new Set(d.notifications.map((n) => n.id));
      if (seen.current) {
        const newMsg = d.conversations.find((c) => c.last && !c.last.mine && !seen.current!.msgs.has(c.last.id) && !(openRef.current && active === c.id));
        const newNotif = d.notifications.find((n) => !n.read && !seen.current!.notifs.has(n.id) && n.type !== "MENTION");
        if (newMsg?.last) setToast({ key: newMsg.last.id, title: `${newMsg.last.author}${newMsg.kind === "CHANNEL" ? ` · ${newMsg.name}` : ""}`, body: newMsg.last.body, onOpen: () => { setOpen(true); setTab("messages"); setActive(newMsg.id); } });
        else if (newNotif) setToast({ key: newNotif.id, title: newNotif.title, body: newNotif.body ?? "", onOpen: () => { setOpen(true); setTab("notifs"); } });
      }
      seen.current = { msgs, notifs };
      setData(d);
    } catch {}
  }, [active]);

  useEffect(() => {
    load();
    const t = setInterval(load, open ? 6000 : 12000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load, open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);

  // charge la conversation choisie
  useEffect(() => {
    setInitial(null);
    if (!active || !open) return;
    fetch(`/api/messages/${active}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setInitial(d.messages))
      .catch(() => setInitial([]));
  }, [active, open]);

  if (path.startsWith("/messages")) return null; // la page Messages occupe déjà l'écran
  const conv = data?.conversations.find((c) => c.id === active) ?? null;
  const unread = (data?.unreadMessages ?? 0) + (data?.unreadNotifs ?? 0);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "POST" });
    load();
    router.refresh();
  };

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 print:hidden">
      {toast && !open && (
        <div role="status" className="relative w-80 max-w-[calc(100vw-2rem)] animate-[fadein_.2s_ease-out] rounded-xl border border-slate-200 bg-white shadow-xl hover:border-link-500">
          <button onClick={() => { toast.onOpen(); setToast(null); }} className="block w-full p-3 pr-8 text-left">
            <span className="block truncate text-sm font-semibold">{toast.title}</span>
            {toast.body && <span className="mt-0.5 line-clamp-2 text-sm text-slate-600">{toast.body}</span>}
          </button>
          <button onClick={() => setToast(null)} className="absolute top-2 right-2 rounded px-1 text-slate-400 hover:text-slate-700" aria-label="Fermer l'aperçu">✕</button>
        </div>
      )}

      {open && (
        <section className="flex h-[min(560px,calc(100vh-6rem))] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" aria-label="Messages et notifications">
          <header className="flex items-center gap-2 border-b border-slate-200 bg-ink px-3 py-2 text-paper">
            {conv && tab === "messages" ? (
              <>
                <button onClick={() => setActive(null)} className="rounded px-1.5 hover:bg-white/10" aria-label="Retour">‹</button>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{conv.name}</span>
                <Link href={`/messages/${conv.id}`} className="rounded px-1.5 text-xs opacity-80 hover:bg-white/10" title="Ouvrir en plein écran">⤢</Link>
              </>
            ) : (
              <div className="flex flex-1 gap-1">
                {(["messages", "notifs"] as const).map((t) => {
                  const n = t === "messages" ? data?.unreadMessages ?? 0 : data?.unreadNotifs ?? 0;
                  return (
                    <button key={t} onClick={() => setTab(t)} className={`rounded-md px-2.5 py-1 text-sm ${tab === t ? "bg-white/15 font-semibold" : "opacity-75 hover:opacity-100"}`}>
                      {t === "messages" ? "💬 Messages" : "🔔 Notifications"}
                      {n > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-[10px] font-semibold ${t === "messages" ? "bg-link-500" : "bg-brand-600"}`}>{n}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => setOpen(false)} className="rounded px-1.5 hover:bg-white/10" aria-label="Réduire" title="Réduire">—</button>
          </header>

          {tab === "messages" && conv ? (
            initial ? (
              <ChatRoom key={conv.id} conversationId={conv.id} initial={initial} me={data!.me} members={conv.people} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Chargement…</div>
            )
          ) : tab === "messages" ? (
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {!data && <li className="p-6 text-center text-sm text-slate-400">Chargement…</li>}
              {data?.conversations.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setActive(c.id)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${c.kind === "CHANNEL" ? "bg-link-600" : "bg-ink"}`}>
                      {c.kind === "CHANNEL" ? "#" : c.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${c.unread ? "font-semibold" : ""}`}>{c.name}</span>
                        {c.last && <span className="shrink-0 text-[11px] text-slate-400">{ago(c.last.at)}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-xs ${c.unread ? "text-slate-800" : "text-slate-500"}`}>
                          {c.last ? `${c.last.mine ? "Vous" : c.last.author.split(" ")[0]} : ${c.last.body}` : "Aucun message"}
                        </span>
                        {c.unread > 0 && <span className="ml-auto shrink-0 rounded-full bg-link-600 px-1.5 text-[10px] font-semibold text-white">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              <li className="p-3 text-center"><Link href="/messages" className="text-xs text-link-600 hover:underline">Ouvrir la messagerie complète</Link></li>
            </ul>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                {data?.notifications.length === 0 && <li className="p-6 text-center text-sm text-slate-400">Aucune notification.</li>}
                {data?.notifications.map((n) => (
                  <li key={n.id} className={`flex items-start hover:bg-slate-50 ${n.read ? "" : "bg-link-100/30"}`}>
                    <a href={`/notifications/${n.id}`} className="flex min-w-0 flex-1 gap-3 py-2.5 pl-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${n.read ? "bg-slate-100 text-slate-500" : "bg-link-600 text-white"}`}>{ICON[n.type] ?? "•"}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`line-clamp-2 text-sm ${n.read ? "text-slate-600" : "font-medium"}`}>{n.title}</span>
                        {n.body && <span className="line-clamp-1 text-xs text-slate-500">{n.body}</span>}
                        <span className="text-[11px] text-slate-400">{ago(n.at)}</span>
                      </span>
                    </a>
                    {!n.read && (
                      <button onClick={() => markRead(n.id)} className="m-2 shrink-0 rounded px-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Marquer comme lue" aria-label="Marquer comme lue">✓</button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-slate-100 px-3 py-2 text-xs">
                <Link href="/notifications?tout=1" className="text-link-600 hover:underline">Tout voir</Link>
                {(data?.unreadNotifs ?? 0) > 0 && <button onClick={() => markRead("tout")} className="text-slate-500 hover:text-slate-800">Tout marquer comme lu</button>}
              </div>
            </div>
          )}
        </section>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-xl transition hover:scale-105 hover:bg-brand-700"
        aria-label={open ? "Réduire la messagerie" : `Ouvrir la messagerie${unread ? ` (${unread} non lus)` : ""}`}
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-link-600 px-1.5 text-center text-[11px] leading-5 font-semibold ring-2 ring-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
    </div>
  );
}
