"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre de progression en haut de l'écran : apparaît dès qu'on soumet un formulaire ou qu'on
 * clique sur un lien interne, disparaît quand la page a été mise à jour.
 */
export function ActivityBar() {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path = usePathname();
  const sp = useSearchParams();

  useEffect(() => { setOn(false); }, [path, sp]);

  useEffect(() => {
    const start = () => {
      setOn(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOn(false), 15000);
    };
    const onSubmit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      if (f.target === "_blank" || f.method === "get") return;
      start();
      // fin de l'action : la page est re-rendue (mutation du contenu principal)
      const main = document.querySelector("main");
      if (!main) return;
      const obs = new MutationObserver(() => { setTimeout(() => setOn(false), 150); obs.disconnect(); });
      obs.observe(main, { childList: true, subtree: true, characterData: true });
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("/api/") || href.includes("#")) return;
      if (href === location.pathname + location.search) return;
      start();
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("submit", onSubmit, true); document.removeEventListener("click", onClick, true); };
  }, []);

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity ${on ? "opacity-100" : "opacity-0"}`}>
      <div className="activity-bar h-full w-1/3 bg-brand-500" />
    </div>
  );
}
