"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { DOSSIER_STATUSES, PRIORITIES } from "@/lib/format";

type Card = { id: string; reference: string; title: string; status: string; priority: string; client: string; assignee: string | null; due: string | null };

export function Kanban({ dossiers, onMove }: { dossiers: Card[]; onMove: (id: string, status: string) => Promise<void> }) {
  const [, start] = useTransition();
  const [items, move] = useOptimistic(dossiers, (state, { id, status }: { id: string; status: string }) =>
    state.map((d) => (d.id === id ? { ...d, status } : d)),
  );
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {DOSSIER_STATUSES.map((col) => {
        const list = items.filter((d) => d.status === col.id);
        return (
          <div
            key={col.id}
            className="min-w-40 flex-1 basis-0 rounded-xl bg-slate-100/70 p-2.5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (!id) return;
              start(async () => {
                move({ id, status: col.id });
                await onMove(id, col.id);
              });
            }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className={`badge ${col.color}`}>{col.label}</span>
              <span className="text-xs text-slate-500">{list.length}</span>
            </div>
            <div className="min-h-24 space-y-2">
              {list.map((d) => (
                <Link
                  key={d.id}
                  href={`/prestations/${d.id}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
                  className="block cursor-grab rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-link-500"
                >
                  <div className="text-xs text-slate-400">{d.reference}</div>
                  <div className="font-medium">{d.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{d.client}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{d.assignee ?? "—"}</span>
                    <span className={d.priority === "HAUTE" ? "font-medium text-rose-600" : ""}>
                      {d.due ?? PRIORITIES[d.priority]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
