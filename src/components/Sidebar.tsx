"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

export type Badges = { lateTasks: number; unreadMessages: number; unreadNotifs: number };

type Item = { href: string; label: string; icon: string; badge?: keyof Badges; badgeColor?: string };

export function Sidebar({ user, mail, badges: initial, show }: {
  user: { name: string; role: string; roleLabel: string };
  mail: boolean;
  badges: Badges;
  show: { quotes: boolean; questionnaires: boolean; signatures: boolean; accounting: boolean; chat: boolean };
}) {
  const path = usePathname();
  const [badges, setBadges] = useState(initial);
  useEffect(() => setBadges(initial), [initial]);

  // rafraîchit les compteurs toutes les 30 secondes
  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch("/api/badges", { cache: "no-store" });
        if (r.ok) setBadges(await r.json());
      } catch {}
    };
    const t = setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);

  const items: Item[] = [
    { href: "/", label: "Tableau de bord", icon: "◧" },
    { href: "/notifications", label: "Notifications", icon: "🔔", badge: "unreadNotifs", badgeColor: "bg-link-600" },
    ...(show.chat ? [{ href: "/messages", label: "Messages", icon: "💬", badge: "unreadMessages" as const, badgeColor: "bg-link-600" }] : []),
    { href: "/prestations", label: "Prestations", icon: "🎧" },
    { href: "/agenda", label: "Agenda", icon: "▦" },
    { href: "/clients", label: "Clients", icon: "◉" },
    { href: "/taches", label: "Tâches", icon: "✓", badge: "lateTasks", badgeColor: "bg-brand-600" },
    ...(show.quotes ? [{ href: "/devis", label: "Devis", icon: "€" }, { href: "/factures", label: "Factures", icon: "🧾" }, { href: "/catalogue", label: "Catalogue", icon: "☰" }] : []),
    ...(show.accounting ? [{ href: "/comptabilite", label: "Comptabilité", icon: "📊" }] : []),
    ...(show.signatures ? [{ href: "/contrats", label: "Contrats", icon: "✍" }, { href: "/signatures", label: "Signatures", icon: "🖋" }] : []),
    { href: "/galeries", label: "Galeries", icon: "📷" },
    { href: "/materiel", label: "Matériel", icon: "🔊" },
    ...(show.questionnaires ? [{ href: "/questionnaires", label: "Questionnaires", icon: "☑" }] : []),
    { href: "/parametres", label: "Paramètres", icon: "⚙" },
  ];
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  return (
    <aside className="flex w-full shrink-0 flex-col print:hidden border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-3 px-5 py-4 md:block">
        <Logo className="h-9" />
        <div className="text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase md:mt-2">Événementiel</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-y-auto md:pb-0">
        {items.map((i) => {
          const n = i.badge ? badges[i.badge] : 0;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
                active(i.href) ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="w-4 text-center text-[13px]">{i.icon}</span>
              {i.label}
              {n > 0 && (
                <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${i.badgeColor}`}>{n > 99 ? "99+" : n}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-slate-100 p-4 text-sm md:block">
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${mail ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          E-mails : {mail ? "envoi activé" : "mode simulation"}
        </div>
        <Link href="/parametres/compte" className="block hover:text-brand-700">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-slate-500">{user.roleLabel}</div>
        </Link>
        <form action="/logout" method="post">
          <button className="mt-2 text-xs text-slate-500 hover:text-slate-800">Se déconnecter</button>
        </form>
      </div>
    </aside>
  );
}
