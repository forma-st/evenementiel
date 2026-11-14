"use client";
import { useEffect, useState } from "react";

type Conflict = { id: string; reference: string; title: string; status: string; assignee: string | null };

/** Vérifie en direct si la date saisie est déjà prise (prestations confirmées ou en option). */
export function DateCheck({ excludeId }: { excludeId?: string }) {
  const [day, setDay] = useState("");
  const [res, setRes] = useState<Conflict[] | null>(null);
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[name="eventDate"]');
    if (!input) return;
    const on = () => setDay(input.value);
    on();
    input.addEventListener("change", on);
    return () => input.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!day) return setRes(null);
    fetch(`/api/disponibilite?date=${day}${excludeId ? `&exclure=${excludeId}` : ""}`).then((r) => r.json()).then((j) => setRes(j.conflicts ?? [])).catch(() => setRes(null));
  }, [day, excludeId]);
  if (!day || !res) return null;
  if (!res.length) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ Date libre : aucune autre prestation confirmée ou en option ce jour-là.</p>;
  return (
    <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      ⚠ Déjà {res.length} prestation(s) ce jour-là :
      <ul className="mt-1 list-disc pl-5">{res.map((c) => <li key={c.id}><a href={`/prestations/${c.id}`} target="_blank" className="underline">{c.reference} — {c.title}</a> ({c.status}{c.assignee ? `, ${c.assignee}` : ""})</li>)}</ul>
    </div>
  );
}
