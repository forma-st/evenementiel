import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";
import { getCompany } from "@/lib/company";
import { eur, TZ } from "@/lib/format";
import { INTERNAL_CLIENT } from "@/lib/presta";
import { parseJson, type Checkout } from "@/lib/rental";
import { Logo } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";
import { HandoverSign } from "@/components/HandoverSign";
import { signHandover } from "../actions";

export const metadata = { title: "Bon de sortie" };
const dt = (d: Date | string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(d));

/** Bon de sortie (prêt ou location) : matériel remis, dates, conditions, signature de l'emprunteur. */
export default async function Handover({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertDossierVisible(await requireStaff(), id);
  const d = await db.dossier.findUnique({ where: { id }, include: { client: true, assignee: { select: { name: true, phone: true } }, equipment: { include: { equipment: { select: { name: true, brand: true, replacementValue: true, notes: true } } }, orderBy: { equipment: { category: "asc" } } } } });
  if (!d) notFound();
  const c = await getCompany();
  const co = parseJson<Checkout>(d.checkout);
  const loan = d.eventType === "PRET";
  const team = d.client.name === INTERNAL_CLIENT;
  const borrower = team ? d.assignee?.name ?? "—" : d.client.name;
  const phone = team ? d.assignee?.phone : d.client.phone;
  const total = d.equipment.reduce((a, x) => a + (x.equipment.replacementValue ?? 0) * x.quantity, 0);
  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none print:text-[12px]">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/prestations/${id}`} className="text-sm text-link-600 hover:underline">← {d.reference}</Link>
        <PrintButton />
      </div>
      <article className="card space-y-6 p-6 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><Logo className="h-12" /><div className="mt-2 text-xs text-slate-500">{[c.name, c.address, c.siret && `SIRET ${c.siret}`, c.phone].filter(Boolean).join(" · ")}</div></div>
          <div className="text-right"><div className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Bon de sortie de matériel</div><div className="text-lg font-semibold">{d.reference}</div><div className="text-xs text-slate-500">{loan ? "Prêt à titre gracieux" : "Location"}</div></div>
        </header>
        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 print:bg-white print:ring-1 print:ring-slate-300">
          <div><div className="text-xs text-slate-500">Emprunteur</div><div className="font-semibold">{borrower}</div>{phone && <div>{phone}</div>}{d.venueName && <div className="text-slate-600">Lieu d&apos;utilisation : {d.venueName}</div>}</div>
          <div><div className="text-xs text-slate-500">Sortie</div><div className="font-medium first-letter:uppercase">{d.eventStart ? dt(d.eventStart) : "—"}</div><div className="mt-1 text-xs text-slate-500">Retour prévu</div><div className="font-medium first-letter:uppercase">{d.eventEnd ? dt(d.eventEnd) : "—"}</div></div>
        </div>
        <table className="table">
          <thead><tr><th className="w-14 text-right">Qté</th><th>Matériel</th><th className="text-right">Valeur de remplacement</th><th className="w-20 text-center">Retour</th></tr></thead>
          <tbody>
            {d.equipment.map((x) => (
              <tr key={x.equipmentId}><td className="text-right font-semibold tabular-nums">{x.quantity}</td><td>{x.equipment.name}{x.equipment.brand && <span className="text-slate-500"> — {x.equipment.brand}</span>}{x.equipment.notes && <div className="text-xs text-slate-500">{x.equipment.notes}</div>}</td><td className="text-right tabular-nums">{x.equipment.replacementValue ? eur(x.equipment.replacementValue * x.quantity) : "—"}</td><td className="text-center text-slate-400">☐</td></tr>
            ))}
            {total > 0 && <tr><td /><td className="font-medium">Valeur totale du matériel confié</td><td className="text-right font-semibold tabular-nums">{eur(total)}</td><td /></tr>}
          </tbody>
        </table>
        {(co?.notes || d.description) && <p className="text-sm whitespace-pre-wrap"><b>Remarques :</b> {co?.notes || d.description}</p>}
        <section className="space-y-1 text-xs leading-relaxed text-slate-600">
          <h2 className="text-sm font-semibold text-ink">Conditions</h2>
          <p>Le matériel ci-dessus est {loan ? "prêté à titre gracieux" : "loué"} à l&apos;emprunteur, qui en assure la garde et l&apos;utilisation conforme du retrait jusqu&apos;au retour. Il s&apos;engage à le restituer complet, propre et en bon état à la date prévue.</p>
          <p>Toute perte, casse ou dégradation (hors usure normale) est à la charge de l&apos;emprunteur, à hauteur de la valeur de remplacement indiquée. Le matériel ne peut être ni sous-prêté ni modifié sans accord.</p>
        </section>
        <section className="grid gap-6 border-t border-slate-200 pt-5 sm:grid-cols-2">
          <div className="text-sm"><div className="text-xs text-slate-500">Pour {c.name || "le prestataire"}</div><div className="font-medium">{co?.by ?? "—"}</div>{co && <div className="text-xs text-slate-500">Remis le {dt(co.at)}</div>}</div>
          <div className="text-sm">
            <div className="text-xs text-slate-500">L&apos;emprunteur, « reçu en bon état »</div>
            {co?.signature ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={co.signature.png} alt={`Signature de ${co.signature.name}`} className="h-24 w-auto" />
                <div className="font-medium">{co.signature.name}</div><div className="text-xs text-slate-500">Signé le {dt(co.signature.at)}</div>
              </>
            ) : <div className="hidden h-20 print:block" />}
          </div>
        </section>
      </article>
      {!co?.signature && (
        <section className="card p-5 print:hidden">
          <h2 className="mb-3 font-semibold">🖊 Faire signer l&apos;emprunteur</h2>
          <HandoverSign action={signHandover.bind(null, id)} defaultName={borrower === "—" ? "" : borrower} />
        </section>
      )}
    </div>
  );
}
