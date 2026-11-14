"use client";
import { useRouter } from "next/navigation";

export function ConvSelect({ value, options }: { value: string; options: { id: string; name: string; unread: number }[] }) {
  const router = useRouter();
  return (
    <select className="input w-44 py-1.5 sm:hidden" value={value} onChange={(e) => router.push(`/messages/${e.target.value}`)} aria-label="Conversation">
      {options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.unread ? ` (${c.unread})` : ""}</option>)}
    </select>
  );
}
