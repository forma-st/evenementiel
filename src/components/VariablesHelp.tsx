"use client";
import { useState } from "react";

/** Liste des variables cliquables (copie dans le presse-papiers). */
export function VariablesHelp({ vars }: { vars: [string, string][] }) {
  const [copied, setCopied] = useState("");
  return (
    <div className="space-y-1 text-xs">
      {vars.map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={async () => { await navigator.clipboard.writeText(`{{${k}}}`); setCopied(k); setTimeout(() => setCopied(""), 1200); }}
          className="flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-slate-100"
        >
          <code className="text-brand-700">{`{{${k}}}`}</code>
          <span className="text-right text-slate-500">{copied === k ? "copié ✓" : l}</span>
        </button>
      ))}
    </div>
  );
}
