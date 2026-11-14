"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "@/app/(staff)/messages/actions";
import type { ChatMessage } from "@/lib/chat";

const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** Met en valeur les @mentions et rend les liens cliquables. */
function Body({ text, names }: { text: string; names: string[] }) {
  const parts = text.split(/(https?:\/\/[^\s]+|@[\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*)?)/u);
  return (
    <>
      {parts.map((p, i) => {
        if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" className="text-link-600 underline">{p}</a>;
        if (p.startsWith("@")) {
          const full = names.find((n) => p.slice(1).toLowerCase().startsWith(n.toLowerCase()));
          const first = names.find((n) => p.slice(1).toLowerCase().startsWith(n.split(" ")[0].toLowerCase()));
          const match = full ?? first;
          if (match) {
            const len = full ? full.length + 1 : match.split(" ")[0].length + 1;
            return <span key={i}><span className="rounded bg-link-100 px-0.5 font-medium text-link-700">{p.slice(0, len)}</span>{p.slice(len)}</span>;
          }
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function ChatRoom({ conversationId, initial, me, members }: {
  conversationId: string;
  initial: ChatMessage[];
  me: string;
  members: { id: string; name: string }[];
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const last = messages.at(-1)?.createdAt;

  const scroll = () => requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: "end" }));
  useEffect(() => { scroll(); }, [messages.length]);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/messages/${conversationId}${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" });
      if (!r.ok) return;
      const { messages: fresh } = (await r.json()) as { messages: ChatMessage[] };
      if (fresh.length) setMessages((m) => [...m, ...fresh.filter((f) => !m.some((x) => x.id === f.id))]);
    } catch {}
  }, [conversationId, last]);
  useEffect(() => {
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [poll]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await sendMessage(conversationId, body);
      setMessages((ms) => [...ms, m]);
      setText("");
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const onChange = (v: string) => {
    setText(v);
    const m = /@([\p{L}'-]*)$/u.exec(v);
    setMention(m ? m[1].toLowerCase() : null);
  };
  const suggestions = mention !== null ? members.filter((u) => u.id !== me && u.name.toLowerCase().includes(mention)).slice(0, 6) : [];
  const pick = (name: string) => {
    setText((t) => t.replace(/@([\p{L}'-]*)$/u, `@${name} `));
    setMention(null);
    input.current?.focus();
  };

  const names = members.map((m) => m.name);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Aucun message. Lancez la conversation !</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || day(prev.createdAt) !== day(m.createdAt);
          const grouped = !newDay && prev?.userId === m.userId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
          const mine = m.userId === me;
          return (
            <div key={m.id}>
              {newDay && <div className="my-4 text-center text-xs font-medium text-slate-400 first-letter:uppercase">{day(m.createdAt)}</div>}
              <div className={`flex gap-3 ${grouped ? "" : "mt-3"}`}>
                <div className="w-8 shrink-0">
                  {!grouped && (
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${mine ? "bg-brand-600" : "bg-ink"}`}>
                      {initials(m.userName)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="text-sm">
                      <span className="font-semibold">{m.userName}</span> <span className="text-xs text-slate-400">{time(m.createdAt)}</span>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words text-slate-800"><Body text={m.body} names={names} /></div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="relative border-t border-slate-200 p-3">
        {suggestions.length > 0 && (
          <ul className="absolute bottom-full left-3 mb-1 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {suggestions.map((u) => (
              <li key={u.id}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(u.name); }} className="w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-slate-100">
                  @{u.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (suggestions.length && mention !== null) pick(suggestions[0].name);
                else send();
              }
            }}
            rows={Math.min(6, Math.max(1, text.split("\n").length))}
            placeholder="Écrire un message… (@ pour mentionner, Maj+Entrée pour aller à la ligne)"
            className="input resize-none"
            aria-label="Message"
          />
          <button onClick={send} disabled={sending || !text.trim()} className="btn-primary">Envoyer</button>
        </div>
      </div>
    </div>
  );
}
