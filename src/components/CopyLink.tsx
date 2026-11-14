"use client";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="text-xs text-link-600 hover:underline"
    >
      {ok ? "Lien copié ✓" : "Copier le lien"}
    </button>
  );
}
