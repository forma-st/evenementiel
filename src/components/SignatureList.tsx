import Link from "next/link";
import { SIGNATURE_STATUSES } from "@/lib/signature";
import { date } from "@/lib/format";
import { Badge, Empty } from "./ui";

/** Demandes de signature d'un client ou d'un dossier. */
export function SignatureList({ items, newHref }: { items: { id: string; title: string; status: string; createdAt: Date }[]; newHref: string }) {
  return (
    <div>
      {items.length === 0 ? <Empty>Aucun document envoyé en signature.</Empty> : (
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/signatures/${s.id}`} className="min-w-0 truncate hover:text-link-600">{s.title}<div className="text-xs text-slate-500">{date(s.createdAt)}</div></Link>
              <Badge className={SIGNATURE_STATUSES[s.status].color}>{SIGNATURE_STATUSES[s.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
      <Link href={newHref} className="btn-secondary py-1.5 text-xs">✍ Faire signer un document</Link>
    </div>
  );
}
