"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export type Badges = { lateTasks: number; unreadMessages: number; unreadNotifs: number; teamRequests: number };

/** Emoji de chaque rubrique (plus parlant que des pictogrammes au trait). */
const EMOJI: Record<string, string> = {
  "/": "🏠", "/notifications": "🔔", "/messages": "💬", "/prestations": "🎉", "/agenda": "📅", "/clients": "👥",
  "/emails": "✉️", "/taches": "✅", "/devis": "📝", "/factures": "🧾", "/catalogue": "📚", "/comptabilite": "📊",
  "/contrats": "📜", "/signatures": "✍️", "/galeries": "📸", "/materiel": "🔊", "/preparer": "📋", "/questionnaires": "🗳️", "/parametres": "⚙️", "/equipe/demandes": "🙋",
};
const Emo = ({ href, big = false }: { href: string; big?: boolean }) => <span aria-hidden className={`shrink-0 leading-none ${big ? "text-[21px]" : "text-base"}`}>{EMOJI[href] ?? "•"}</span>;

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
    { href: "/", label: "Tableau de bord", icon: "home" },
    { href: "/notifications", label: "Notifications", icon: "bell", badge: "unreadNotifs", badgeColor: "bg-link-600" },
    ...(show.chat ? [{ href: "/messages", label: "Messages", icon: "chat", badge: "unreadMessages" as const, badgeColor: "bg-link-600" }] : []),
    { href: "/prestations", label: "Prestations", icon: "headphones" },
    { href: "/equipe/demandes", label: "Demandes équipe", icon: "users", badge: "teamRequests", badgeColor: "bg-amber-500" },
    { href: "/agenda", label: "Agenda", icon: "calendar" },
    { href: "/clients", label: "Clients", icon: "users" },
    { href: "/emails", label: "E-mails groupés", icon: "send" },
    { href: "/taches", label: "Tâches", icon: "check", badge: "lateTasks", badgeColor: "bg-brand-600" },
    ...(show.quotes ? [{ href: "/devis", label: "Devis", icon: "file" }, { href: "/factures", label: "Factures", icon: "receipt" }, { href: "/catalogue", label: "Catalogue", icon: "list" }] : []),
    ...(show.accounting ? [{ href: "/comptabilite", label: "Comptabilité", icon: "chart" }] : []),
    ...(show.signatures ? [{ href: "/contrats", label: "Contrats", icon: "pen" }, { href: "/signatures", label: "Signatures", icon: "signature" }] : []),
    { href: "/galeries", label: "Galeries", icon: "camera" },
    { href: "/materiel", label: "Matériel", icon: "box" },
    { href: "/preparer", label: "Préparation", icon: "clipboard" },
    ...(show.questionnaires ? [{ href: "/questionnaires", label: "Questionnaires", icon: "form" }] : []),
    { href: "/parametres", label: "Paramètres", icon: "settings" },
  ];
  const active = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));
  const [wide, setWide] = useState(false);
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  useEffect(() => { try { setWide(localStorage.getItem("nav") === "full"); } catch {} }, []);
  const toggle = () => { setTip(null); return setWide((w) => { try { localStorage.setItem("nav", w ? "rail" : "full"); } catch {} return !w; }); };
  const initials = user.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const hint = (label: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { if (!wide) { const r = e.currentTarget.getBoundingClientRect(); setTip({ label, top: r.top + r.height / 2 }); } },
    onMouseLeave: () => setTip(null),
  });

  return (
    <>
      {/* téléphone : barre du haut défilante */}
      <header className="nav-navy sticky top-0 z-30 print:hidden md:hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2"><Logo className="h-8" /><ThemeSwitch compact /></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
          {items.map((i) => {
            const n = i.badge ? badges[i.badge] : 0;
            return (
              <Link key={i.href} href={i.href} className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap ${active(i.href) ? "bg-[rgba(255,255,255,.20)] font-medium text-white" : "text-[rgba(255,255,255,.75)]"}`}>
                <Emo href={i.href} />{i.label}
                {n > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{n > 99 ? "99+" : n}</span>}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ordinateur et tablette : rail flottant */}
      <aside className={`nav-navy nav-rail sticky top-3 z-30 m-3 mr-0 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-[28px] py-4 shadow-[0_20px_50px_-20px_rgba(11,22,48,.7)] transition-[width] duration-200 print:hidden md:flex ${wide ? "w-60" : "w-[76px]"}`}>
        <div className={`flex items-center ${wide ? "justify-between px-4" : "justify-center"}`}>
          {wide ? <Logo className="h-9" /> : <Link href="/" aria-label="Tableau de bord" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#fff] p-1 shadow-lg">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/api/logo?mark=1" alt="Logo" className="h-full w-full object-contain" /></Link>}
          {wide && <button onClick={toggle} aria-label="Réduire le menu" className="rounded-lg p-1.5 text-[rgba(255,255,255,.70)] hover:bg-[rgba(255,255,255,.10)] hover:text-[#fff]"><Icon name="chevronLeft" className="h-4 w-4" /></button>}
        </div>
        <nav className={`mt-5 flex flex-1 flex-col gap-1 overflow-y-auto ${wide ? "px-3" : "items-center px-2"} pb-6 [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)]`}>
          {items.map((i) => {
            const n = i.badge ? badges[i.badge] : 0;
            const on = active(i.href);
            return (
              <Link key={i.href} href={i.href} aria-label={i.label} {...hint(i.label)}
                className={`relative flex shrink-0 items-center gap-3 rounded-2xl text-sm transition ${wide ? "px-3 py-2" : "h-10 w-10 justify-center"} ${on ? "nav-on font-medium text-white" : `text-[rgba(255,255,255,.80)] hover:bg-[rgba(255,255,255,.16)] hover:text-[#fff] ${wide ? "" : "bg-[rgba(255,255,255,.07)]"}`}`}>
                <Emo href={i.href} big={!wide} />
                {wide && <span className="truncate">{i.label}</span>}
                {n > 0 && <span className={`rounded-full bg-rose-500 px-1.5 text-[10px] leading-4 font-semibold text-white ${wide ? "ml-auto" : "absolute -top-0.5 -right-0.5"}`}>{n > 99 ? "99+" : n}</span>}
              </Link>
            );
          })}
        </nav>
        <div className={`mt-3 flex flex-col gap-2 border-t border-[rgba(255,255,255,.10)] pt-3 ${wide ? "px-4" : "items-center"}`}>
          {!wide && <button onClick={toggle} aria-label="Afficher les libellés" {...hint("Afficher les libellés")} className="flex h-9 w-9 items-center justify-center rounded-xl text-[rgba(255,255,255,.70)] hover:bg-[rgba(255,255,255,.10)] hover:text-[#fff]"><Icon name="chevronRight" className="h-4 w-4" /></button>}
          {wide ? <ThemeSwitch full /> : <ThemeSwitch cycle />}
          {wide && <div className={`rounded-lg px-3 py-2 text-xs ${mail ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>E-mails : {mail ? "envoi activé" : "mode simulation"}</div>}
          <div className={`flex items-center gap-2 ${wide ? "" : "flex-col"}`}>
            <Link href="/parametres/compte" {...hint(`${user.name} · ${user.roleLabel}${mail ? "" : " · e-mails en simulation"}`)} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-blue-500 text-sm font-semibold text-white ring-2 ring-[rgba(255,255,255,.30)]">
              {initials}{!mail && !wide && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-[#1a4bab]" />}
            </Link>
            {wide && <div className="min-w-0 flex-1 text-sm"><div className="truncate font-medium text-white">{user.name}</div><div className="truncate text-xs text-[rgba(255,255,255,.60)]">{user.roleLabel}</div></div>}
            <form action="/logout" method="post"><button aria-label="Se déconnecter" {...hint("Se déconnecter")} className="flex h-9 w-9 items-center justify-center rounded-xl text-[rgba(255,255,255,.60)] hover:bg-[rgba(255,255,255,.10)] hover:text-[#fff]"><Icon name="logout" className="h-4 w-4" /></button></form>
          </div>
        </div>
      </aside>
      {tip && <div role="tooltip" style={{ top: tip.top, left: 100 }} className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-lg bg-[#0b1630] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg">{tip.label}</div>}
    </>
  );
}
