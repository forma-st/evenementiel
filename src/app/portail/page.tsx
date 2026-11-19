import { Logo } from "@/components/Logo";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { Badge, Card, Empty } from "@/components/ui";
import { date, eur, quoteStatus, statusOf, time, TZ } from "@/lib/format";
import { eventKind, servicesLabel } from "@/lib/presta";
import { getCompany } from "@/lib/company";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { paymentToken } from "@/lib/stripe";

const fullDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);

export default async function Portal() {
  const user = await requireClient();
  const c = await getCompany();
  const client = await db.client.findUniqueOrThrow({
    where: { id: user.clientId },
    include: {
      dossiers: { where: { status: { not: "PERDU" } }, include: { payments: { orderBy: { dueDate: "asc" } } }, orderBy: [{ eventStart: { sort: "desc", nulls: "first" } }] },
      quotes: { where: { status: { notIn: ["BROUILLON"] } }, orderBy: { createdAt: "desc" } },
      assignments: { include: { questionnaire: true }, orderBy: { createdAt: "desc" } },
      invoices: { where: { number: { not: null } }, orderBy: { issueDate: "desc" } },
      galleries: { where: { status: "PUBLIEE" }, include: { _count: { select: { files: true } } }, orderBy: { publishedAt: "desc" } },
      signatures: {
        where: { status: { in: ["EN_ATTENTE", "SIGNE"] } },
        select: { id: true, title: true, status: true, createdAt: true, expiresAt: true, signers: { select: { name: true, token: true, status: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const todo = client.assignments.filter((a) => a.status !== "COMPLETE");
  const tokens: Record<string, string> = {};
  for (const d of client.dossiers) for (const p of d.payments) if (!p.paidAt && p.amount > 0) tokens[p.id] = await paymentToken(p.id);
  const galleries = client.galleries.filter((g) => !g.expiresAt || g.expiresAt > new Date());
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4"><Logo className="h-9" /><div className="border-l border-slate-200 pl-4"><div className="font-semibold">Espace client</div><div className="text-sm text-slate-500">{client.name}</div></div></div>
          <div className="flex items-center gap-3"><ThemeSwitch compact /><form action="/logout" method="post"><button className="text-sm text-slate-500 hover:text-slate-800">Se déconnecter</button></form></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Bonjour {user.name}</h1>

        {client.dossiers.map((d) => {
          const days = d.eventStart ? Math.ceil((d.eventStart.getTime() - Date.now()) / 864e5) : null;
          const k = eventKind(d.eventType);
          const paid = d.payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
          return (
            <section key={d.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-5 text-white">
                <div>
                  <div className="text-sm opacity-80">{k.icon} {k.label}</div>
                  <div className="text-xl font-semibold">{d.title}</div>
                  <div className="text-sm opacity-90">{d.eventStart ? `${fullDate(d.eventStart)} · ${time(d.eventStart)}` : "Date à définir"}{d.venueName ? ` · ${d.venueName}` : ""}</div>
                </div>
                {days !== null && days >= 0 && <div className="text-center"><div className="text-4xl font-bold">{days}</div><div className="text-xs uppercase opacity-80">jour{days > 1 ? "s" : ""} restant{days > 1 ? "s" : ""}</div></div>}
              </div>
              <div className="grid gap-6 p-6 md:grid-cols-2">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Statut</dt><dd><Badge className={statusOf(d.status).color}>{statusOf(d.status).label}</Badge></dd></div>
                  {d.services && <div className="flex justify-between gap-3"><dt className="text-slate-500">Prestations</dt><dd className="text-right">{servicesLabel(d.services)}</dd></div>}
                  {d.venueAddress && <div className="flex justify-between gap-3"><dt className="text-slate-500">Adresse</dt><dd className="text-right">{[d.venueAddress, d.venueCity].filter(Boolean).join(", ")}</dd></div>}
                  {d.guests && <div className="flex justify-between gap-3"><dt className="text-slate-500">Invités</dt><dd>{d.guests}</dd></div>}
                </dl>
                <div>
                  <div className="mb-2 text-sm font-medium">Règlements</div>
                  {d.payments.length === 0 ? <p className="text-sm text-slate-500">L&apos;échéancier apparaîtra à la confirmation de la réservation.</p> : (
                    <ul className="space-y-1.5 text-sm">
                      {d.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3"><span>{p.label}{p.dueDate && !p.paidAt ? <span className="text-xs text-slate-500"> · avant le {date(p.dueDate)}</span> : null}</span><span className="flex items-center gap-2"><span className={p.paidAt ? "text-emerald-700" : ""}>{eur(p.amount)} {p.paidAt ? "✓" : ""}</span>{!p.paidAt && p.amount > 0 && <a href={`/p/${tokens[p.id]}`} className="btn-primary px-2.5 py-1 text-xs">Payer</a>}</span></li>
                      ))}
                      <li className="flex justify-between border-t border-slate-100 pt-1.5 font-medium"><span>Déjà réglé</span><span>{eur(paid)}</span></li>
                    </ul>
                  )}
                  {c.iban && d.payments.some((p) => !p.paidAt) && <p className="mt-2 text-xs text-slate-500">Virement : {c.iban}{c.bic ? ` (BIC ${c.bic})` : ""} — référence {d.reference}</p>}
                </div>
              </div>
            </section>
          );
        })}

        {client.signatures.length > 0 && (
          <Card title="Contrats et documents à signer">
            <ul className="divide-y divide-slate-100">
              {client.signatures.map((sg) => {
                const mine = sg.signers.find((x) => x.status === "EN_ATTENTE") ?? sg.signers[0];
                return (
                  <li key={sg.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><div className="font-medium">{sg.title}</div><div className="text-xs text-slate-500">{sg.status === "SIGNE" ? "Signé" : `À signer avant le ${date(sg.expiresAt)}`} · {sg.signers.map((x) => x.name).join(", ")}</div></div>
                    {sg.status === "SIGNE" ? <a href={`/api/sign/${mine.token}?signe=1`} target="_blank" className="btn-secondary">⬇ Version signée</a> : <Link href={`/signer/${mine.token}`} className="btn-primary">✍ Signer</Link>}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card title={`Préparation : questionnaires à compléter (${todo.length})`}>
          {todo.length === 0 ? <Empty>Rien à compléter pour le moment.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {todo.map((a) => <li key={a.id} className="flex items-center justify-between py-3"><span className="font-medium">{a.questionnaire.title}</span><Link href={`/q/${a.token}`} className="btn-primary">Compléter</Link></li>)}
            </ul>
          )}
        </Card>

        {galleries.length > 0 && (
          <Card title="Vos photos et fichiers">
            <ul className="divide-y divide-slate-100">
              {galleries.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><div className="font-medium">{g.kind === "TRANSFERT" ? "📦" : "📷"} {g.title}</div><div className="text-xs text-slate-500">{g._count.files} fichier(s){g.password ? ` · code ${g.password}` : ""}{g.expiresAt ? ` · en ligne jusqu'au ${date(g.expiresAt)}` : ""}</div></div>
                  <a href={`/g/${g.token}`} target="_blank" className="btn-primary">Ouvrir</a>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {client.invoices.length > 0 && (
          <Card title="Vos factures">
            <ul className="divide-y divide-slate-100 text-sm">
              {client.invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span><span className="font-medium">{i.number}</span> · {i.label}<span className="block text-xs text-slate-500">{date(i.issueDate)} · {eur(i.totalTTC - i.deducted)} · {i.status === "PAYEE" ? "réglée" : i.status === "ANNULEE" ? "annulée" : "à régler"}</span></span>
                  <a href={`/api/factures/${i.id}/pdf`} target="_blank" className="btn-secondary py-1.5 text-xs">⬇ PDF</a>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Vos devis">
          {client.quotes.length === 0 ? <Empty>Aucun devis.</Empty> : (
            <ul className="space-y-3 text-sm">
              {client.quotes.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{q.label}</div>
                    <div className="text-xs text-slate-500">{q.number} · {eur(q.totalTTC)} TTC · valable jusqu&apos;au {date(q.validUntil)}</div>
                    {q.token && <div className="flex gap-3 text-xs"><a href={`/d/${q.token}`} className="text-link-600 hover:underline">Consulter / accepter</a><a href={`/d/${q.token}/pdf`} target="_blank" className="text-link-600 hover:underline">PDF</a></div>}
                  </div>
                  <Badge className={quoteStatus(q.status).color}>{quoteStatus(q.status).label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
