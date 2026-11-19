import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { getCompany } from "@/lib/company";
import { date, eur, TZ } from "@/lib/format";
import { eventKind } from "@/lib/presta";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata = { title: "Règlement", robots: { index: false } };

const fullDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);

/** Page de règlement d'une échéance (lien envoyé au client). */
export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ statut?: string }> }) {
  const { token } = await params;
  const { statut } = await searchParams;
  if (token.length < 20) notFound();
  const p = await db.payment.findFirst({ where: { token }, include: { dossier: { include: { client: true, payments: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] } } } } });
  if (!p) notFound();
  const c = await getCompany();
  const d = p.dossier;
  const online = isStripeConfigured();
  const others = d?.payments.filter((x) => x.id !== p.id) ?? [];
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex justify-center"><Logo className="h-11" /></div>
        <div className="card p-6 sm:p-8">
          {d && <p className="text-sm text-slate-500">{eventKind(d.eventType).icon} {d.title}{d.eventStart ? `, ${fullDate(d.eventStart)}` : ""}</p>}
          <h1 className="mt-1 text-xl font-semibold">{p.label}</h1>
          <div className="mt-4 font-display text-4xl font-semibold tabular-nums">{eur(p.amount)}</div>
          {p.dueDate && !p.paidAt && <p className="mt-1 text-sm text-slate-500">À régler avant le {date(p.dueDate)}</p>}

          {p.paidAt ? (
            <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800">✓ Réglé le {date(p.paidAt)}{p.paidOnline ? " par carte" : ""}. Merci !</p>
          ) : statut === "ok" ? (
            <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800">Merci ! Votre paiement est en cours de confirmation : vous recevrez un reçu par e-mail.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {statut === "annule" && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Paiement interrompu : rien n&apos;a été débité.</p>}
              {statut === "erreur" && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Le paiement en ligne est momentanément indisponible. Vous pouvez régler par virement.</p>}
              {online && (
                <a href={`/p/${token}/payer`} className="btn-primary w-full py-3 text-base">Payer {eur(p.amount)} par carte</a>
              )}
              {online && <p className="text-center text-xs text-slate-500">Paiement sécurisé par Stripe : carte bancaire, Apple Pay ou Google Pay. Vos coordonnées bancaires ne nous sont jamais transmises.</p>}
              {c.iban && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="font-medium">{online ? "Ou par virement" : "Règlement par virement"}</div>
                  <div className="mt-1 font-mono text-[13px] break-all">{c.iban}</div>
                  {c.bic && <div className="text-xs text-slate-500">BIC {c.bic}</div>}
                  <div className="mt-1 text-xs text-slate-500">Référence à indiquer : {d?.reference ?? p.id.slice(-8)}</div>
                </div>
              )}
              {!online && !c.iban && <p className="text-sm text-slate-600">Contactez-nous pour le règlement{c.phone ? ` : ${c.phone}` : ""}.</p>}
            </div>
          )}
        </div>
        {others.length > 0 && (
          <div className="card p-5 text-sm">
            <div className="mb-2 font-medium">Votre échéancier</div>
            <ul className="space-y-1.5">{others.map((x) => <li key={x.id} className="flex justify-between gap-3"><span>{x.label}{x.dueDate && !x.paidAt ? <span className="text-slate-500"> avant le {date(x.dueDate)}</span> : null}</span><span className={x.paidAt ? "text-emerald-700" : ""}>{eur(x.amount)} {x.paidAt ? "✓" : ""}</span></li>)}</ul>
          </div>
        )}
        <p className="text-center text-xs text-slate-400">{[c.name, c.phone, c.email].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
  );
}
