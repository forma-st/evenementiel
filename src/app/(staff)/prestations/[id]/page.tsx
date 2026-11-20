import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Back, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { DOSSIER_STATUSES, date, dateTime, eur, parisParts, quoteStatus, statusOf, time, TZ } from "@/lib/format";
import { addNote, addPayment, deleteDossier, deletePayment, generatePayments, markPaymentPaid, sendEmailToClient, sendQuestionnaire, setDossierEquipment, removeDossierEquipment, setDossierStatus } from "../../actions";
import { TaskBoard } from "@/components/TaskBoard";
import { toRow } from "@/lib/tasks";
import { EventList } from "@/components/EventList";
import { SignatureList } from "@/components/SignatureList";
import { DeleteDossierButton } from "@/components/DeleteDossierButton";
import { CopyLink } from "@/components/CopyLink";
import { EmailComposer } from "@/components/EmailComposer";
import { EquipmentPicker } from "@/components/EquipmentPicker";
import { equipmentAvailability } from "@/lib/equipment";
import { paymentToken } from "@/lib/stripe";
import { RentalPanel } from "@/components/RentalPanel";
import { PrepChecklist } from "@/components/PrepChecklist";
import { parsePrep, prepOutdated } from "@/lib/prep";
import { parseJson, rentalDays, type Checkin, type Checkout } from "@/lib/rental";
import { invoiceFromPayment } from "../../factures/actions";
import { INVOICE_KINDS, INVOICE_STATUSES } from "@/lib/invoices";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible, permsFor } from "@/lib/permissions";
import { eventKind, parseServices, serviceOf, PAYMENT_METHODS } from "@/lib/presta";
import { GALLERY_STATUSES } from "@/lib/galleries";
import { baseUrl, render, varsForDossier } from "@/lib/merge";
import { isMailConfigured } from "@/lib/mail";

const KIND_ICON: Record<string, string> = { NOTE: "✎", STATUS: "↻", QUOTE: "€", QUESTIONNAIRE: "☑", AUTO: "⚡", EMAIL: "✉", PAYMENT: "💶", GALLERY: "📷" };
const fullDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);

export default async function PrestationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  const [, perms] = await Promise.all([assertDossierVisible(me, id), permsFor(me)]);
  const base = baseUrl();
  const [d, questionnaires, users, equipment, templates, emails, vars0] = await Promise.all([
    db.dossier.findUnique({
      where: { id },
      include: {
        client: true, assignee: true,
        activities: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 80 },
        quotes: { orderBy: { createdAt: "desc" } },
        assignments: { include: { questionnaire: true }, orderBy: { createdAt: "desc" } },
        signatures: { select: { id: true, title: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        events: { include: { attendees: { include: { user: { select: { name: true } } } } }, orderBy: { start: "desc" } },
        tasks: { include: { client: true, dossier: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
        payments: { orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] },
        equipment: { include: { equipment: true } },
        galleries: { include: { _count: { select: { files: true } } }, orderBy: { createdAt: "desc" } },
        invoices: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.questionnaire.findMany({ where: { archived: false }, orderBy: { title: "asc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.equipment.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.emailTemplate.findMany({ orderBy: { name: "asc" } }),
    db.emailLog.findMany({ where: { dossierId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    varsForDossier(id).catch(() => null),
  ]);
  if (!d) notFound();
  const st = statusOf(d.status);
  const k = eventKind(d.eventType);
  const vars = vars0 ?? {};
  const paid = d.payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  const totalDue = d.payments.reduce((a, p) => a + p.amount, 0);
  const days = d.eventStart ? Math.ceil((d.eventStart.getTime() - Date.now()) / 864e5) : null;

  const availability = await equipmentAvailability(id, d.eventStart, d.eventEnd);
  const payLinks: Record<string, string> = {};
  for (const p of d.payments) if (!p.paidAt && p.amount > 0) payLinks[p.id] = `${base}/p/${await paymentToken(p.id)}`;
  const overbooked = availability.filter((x) => x.overbooked);

  return (
    <div className="space-y-6">
      <Back href="/prestations">Prestations</Back>
      <PageHeader
        title={`${k.icon} ${d.title}`}
        subtitle={<>{d.reference} · <Link href={`/clients/${d.clientId}`} className="text-link-600 hover:underline">{d.client.name}</Link>{d.client.phone && <> · <a href={`tel:${d.client.phone}`} className="hover:underline">{d.client.phone}</a></>}{d.client.email && <> · <a href={`mailto:${d.client.email}`} className="hover:underline">{d.client.email}</a></>}</>}
        actions={
          <>
            {perms.canCreateQuotes && <Link href={`/devis/nouveau?dossierId=${id}`} className="btn-secondary">+ Devis</Link>}
            {perms.canSendSignatures && <Link href={`/contrats/generer?dossierId=${id}`} className="btn-secondary">✍ Contrat</Link>}
            <Link href={`/galeries/nouvelle?dossierId=${id}`} className="btn-secondary">📷 Galerie</Link>
            <Link href={`/prestations/${id}/modifier`} className="btn-primary">Modifier</Link>
            {perms.canDeleteDossiers && (
              <DeleteDossierButton
                action={deleteDossier.bind(null, id, "/prestations")}
                title={d.title}
                counts={{ tasks: d.tasks.length, activities: d.activities.length, quotes: d.quotes.length, events: d.events.length, signatures: d.signatures.length, assignments: d.assignments.length }}
              />
            )}
          </>
        }
      />

      {overbooked.length > 0 && (
        <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <b>⛔ Conflit de matériel :</b> {overbooked.map((o) => `${o.name} (${o.mine} demandé(s), stock ${o.stock}, déjà pris par ${o.conflicts.map((c) => c.reference).join(", ")})`).join(" · ")}. <a href="#materiel" className="underline">Corriger</a>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {DOSSIER_STATUSES.map((s) => (
          <form key={s.id} action={setDossierStatus.bind(null, id, s.id)}>
            <button className={`badge px-3 py-1.5 text-sm ${s.id === d.status ? s.color + " ring-2 ring-current ring-offset-1" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>{s.label}</button>
          </form>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4 md:col-span-2">
          <div className="text-xs text-slate-500">Date</div>
          <div className="text-lg font-semibold capitalize">{d.eventStart ? fullDate(d.eventStart) : "À définir"}</div>
          <div className="text-sm text-slate-600">
            {d.eventStart && <>{time(d.eventStart)}{d.eventEnd && <> → {time(d.eventEnd)}</>}</>}
            {d.setupTime && <> · installation {d.setupTime}</>}
            {days !== null && days >= 0 && <span className="ml-2 badge bg-brand-50 text-brand-700">J-{days}</span>}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Lieu</div>
          <div className="font-medium">{d.venueName ?? "—"}</div>
          <div className="text-sm text-slate-600">{[d.venueAddress, d.venueCity].filter(Boolean).join(", ")}</div>
          {(d.venueAddress || d.venueCity) && <a target="_blank" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.venueName, d.venueAddress, d.venueCity].filter(Boolean).join(", "))}`} className="text-xs text-link-600 hover:underline">Itinéraire ↗</a>}
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Règlements</div>
          <div className="text-lg font-semibold">{eur(paid)} <span className="text-sm font-normal text-slate-500">/ {eur(totalDue || d.amount)}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${totalDue ? Math.min(100, (paid / totalDue) * 100) : 0}%` }} /></div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {d.eventType === "LOCATION" && (
            <RentalPanel
              key={d.equipment.map((x) => `${x.equipmentId}:${x.quantity}`).join(",")}
              dossierId={id}
              start={d.eventStart?.toISOString() ?? null}
              end={d.eventEnd?.toISOString() ?? null}
              days={rentalDays(d.eventStart, d.eventEnd)}
              items={d.equipment.map((x) => ({ id: x.equipmentId, name: x.equipment.name, qty: x.quantity, dailyRate: x.equipment.dailyRate, replacementValue: x.equipment.replacementValue }))}
              caution={d.cautionAmount}
              cautionStatus={d.cautionStatus || (d.cautionAmount ? "A_RECEVOIR" : "")}
              checkout={parseJson<Checkout>(d.checkout)}
              checkin={parseJson<Checkin>(d.checkin)}
            />
          )}

          <Card title="Devis" actions={perms.canCreateQuotes ? <Link href={`/devis/nouveau?dossierId=${id}`} className="text-sm text-link-600 hover:underline">+ Nouveau devis</Link> : undefined}>
            {d.quotes.length === 0 ? <Empty>Aucun devis. Créez-le à partir du catalogue.</Empty> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {d.quotes.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/devis/${q.id}`} className="hover:text-link-600"><span className="font-medium">{q.number ?? "Devis"}</span> — {q.label}<div className="text-xs text-slate-500">{eur(q.totalTTC)} TTC · {date(q.issuedAt)}{q.viewedAt && " · 👁 consulté"}</div></Link>
                    <div className="flex items-center gap-3">
                      {q.token && q.status !== "BROUILLON" && <CopyLink url={`${base}/d/${q.token}`} />}
                      <Badge className={quoteStatus(q.status).color}>{quoteStatus(q.status).label}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Échéancier et paiements" actions={d.payments.length === 0 ? <form action={generatePayments.bind(null, id)}><button className="text-sm text-link-600 hover:underline">Créer acompte + solde</button></form> : undefined}>
            {d.payments.length === 0 ? <Empty>Aucune échéance. L&apos;échéancier est créé automatiquement à la confirmation.</Empty> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {d.payments.map((p) => {
                  const late = !p.paidAt && p.dueDate && p.dueDate < new Date();
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{p.label} — {eur(p.amount)}</div>
                        <div className={`text-xs ${late ? "font-medium text-rose-600" : "text-slate-500"}`}>{p.paidAt ? `✓ reçu le ${date(p.paidAt)}${p.method ? ` (${p.method})` : ""}` : p.dueDate ? `${late ? "En retard — " : ""}échéance ${date(p.dueDate)}` : "sans échéance"}</div>
                      </div>
                      {!p.paidAt && p.amount > 0 && payLinks[p.id] && <CopyLink url={payLinks[p.id]} label="Lien de paiement" />}
                      {p.paidOnline && <span className="badge bg-emerald-100 text-emerald-700">💳 en ligne</span>}
                      <form action={markPaymentPaid.bind(null, p.id)} className="flex items-center gap-2">
                        {!p.paidAt && <select name="method" className="input w-36 py-1 text-xs">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>}
                        <button className={p.paidAt ? "text-xs text-slate-400 hover:text-slate-700" : "btn-secondary py-1 text-xs"}>{p.paidAt ? "Annuler" : "✓ Reçu"}</button>
                      </form>
                      {p.invoiceId ? <Link href={`/factures/${p.invoiceId}`} className="text-xs text-link-600 hover:underline">🧾 {d.invoices.find((i) => i.id === p.invoiceId)?.number ?? "brouillon"}</Link>
                        : perms.canCreateQuotes && <form action={invoiceFromPayment.bind(null, p.id)}><button className="text-xs text-link-600 hover:underline">🧾 Facturer</button></form>}
                      {!p.paidAt && !p.invoiceId && <form action={deletePayment.bind(null, p.id)}><button className="text-xs text-slate-400 hover:text-rose-600">✕</button></form>}
                    </li>
                  );
                })}
              </ul>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-link-600">+ Ajouter une échéance</summary>
              <form action={addPayment.bind(null, id)} className="mt-2 grid gap-2 sm:grid-cols-[1fr_120px_150px_auto]">
                <input name="label" placeholder="Libellé (ex. 2e acompte)" className="input" />
                <input name="amount" inputMode="decimal" placeholder="Montant" required className="input" />
                <input name="dueDate" type="date" className="input" />
                <button className="btn-secondary">Ajouter</button>
              </form>
            </details>
          </Card>

          {d.invoices.length > 0 && (
            <Card title="Factures">
              <ul className="divide-y divide-slate-100 text-sm">
                {d.invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/factures/${i.id}`} className="hover:text-link-600"><span className="font-medium">{i.number ?? "Brouillon"}</span> — {INVOICE_KINDS[i.kind].label}<div className="text-xs text-slate-500">{eur(i.totalTTC - i.deducted)}{i.issueDate ? ` · ${date(i.issueDate)}` : ""}</div></Link>
                    <Badge className={INVOICE_STATUSES[i.status].color}>{INVOICE_STATUSES[i.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">Tâches</h2>
            <TaskBoard initial={d.tasks.map(toRow)} users={perms.canAssignOthers ? users : users.filter((u) => u.id === me.id)} context={{ dossierId: id, clientId: d.clientId }} />
          </section>

          <Card title="Écrire au client">
            <EmailComposer
              action={sendEmailToClient.bind(null, id)}
              to={d.client.email ?? ""}
              templates={templates.map((t) => ({ id: t.id, name: t.name, subject: render(t.subject, vars), body: render(t.body, vars) }))}
              simulated={!isMailConfigured()}
            />
            {emails.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-slate-600">Historique des e-mails ({emails.length})</summary>
                <ul className="mt-2 divide-y divide-slate-100">
                  {emails.map((e) => (
                    <li key={e.id} className="py-2">
                      <div className="flex justify-between gap-2"><span className="font-medium">{e.subject}</span><span className={`text-xs ${e.status === "ENVOYE" ? "text-emerald-700" : e.status === "SIMULE" ? "text-amber-700" : "text-rose-600"}`}>{e.status === "ENVOYE" ? "envoyé" : e.status === "SIMULE" ? "simulation" : "échec"} · {dateTime(e.createdAt)}</span></div>
                      <details><summary className="cursor-pointer text-xs text-slate-500">à {e.to} — voir le texte</summary><pre className="mt-1 text-xs whitespace-pre-wrap text-slate-600">{e.body}</pre></details>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          <Card title="Journal">
            <form action={addNote.bind(null, id)} className="mb-5 space-y-2">
              <textarea name="body" rows={3} required placeholder="Ajouter une note, un compte-rendu d'appel…" className="input" />
              <button className="btn-primary">Ajouter</button>
            </form>
            {d.activities.length === 0 ? <Empty>Aucune activité.</Empty> : (
              <ol className="space-y-4">
                {d.activities.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">{KIND_ICON[a.kind] ?? "•"}</span>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">{a.user?.name ?? "Client / système"} · {dateTime(a.createdAt)}</div>
                      <div className={`text-sm whitespace-pre-wrap ${a.kind === "NOTE" ? "" : "text-slate-600 italic"}`}>{a.body}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Détails">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Statut</dt><dd><Badge className={st.color}>{st.label}</Badge></dd></div>
              <div><dt className="text-slate-500">Type</dt><dd>{k.label}</dd></div>
              <div><dt className="text-slate-500">Prestataire</dt><dd>{d.assignee?.name ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Invités</dt><dd>{d.guests ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Budget</dt><dd>{eur(d.amount)}</dd></div>
              <div><dt className="text-slate-500">Origine</dt><dd>{d.source ?? "—"}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Prestations</dt><dd className="mt-1 flex flex-wrap gap-1">{parseServices(d.services).map((x) => <span key={x} className={`badge ${serviceOf(x)?.color ?? "bg-slate-100"}`}>{serviceOf(x)?.icon} {serviceOf(x)?.label ?? x}</span>)}</dd></div>
              {d.venueContact && <div className="col-span-2"><dt className="text-slate-500">Contact sur place</dt><dd>{d.venueContact}</dd></div>}
              {d.lostReason && <div className="col-span-2"><dt className="text-slate-500">Raison de la perte</dt><dd>{d.lostReason}</dd></div>}
            </dl>
            {d.description && <p className="mt-4 text-sm whitespace-pre-wrap text-slate-700">{d.description}</p>}
          </Card>

          {perms.canSendSignatures && (
            <Card title="Contrats et signatures" actions={<Link href={`/contrats/generer?dossierId=${id}`} className="text-sm text-link-600 hover:underline">Générer</Link>}>
              <SignatureList items={d.signatures} newHref={`/signatures/nouveau?clientId=${d.clientId}&dossierId=${id}`} />
            </Card>
          )}

          <Card title="Préparation (questionnaires)">
            <ul className="mb-4 space-y-2 text-sm">
              {d.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/questionnaires/reponse/${a.id}`} className="hover:text-link-600">{a.questionnaire.title}</Link>
                    {a.status !== "COMPLETE" && <div><CopyLink url={`${base}/q/${a.token}`} /></div>}
                  </div>
                  <Badge className={a.status === "COMPLETE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>{a.status === "COMPLETE" ? "Complété" : "En attente"}</Badge>
                </li>
              ))}
            </ul>
            {questionnaires.length > 0 && (
              <form action={sendQuestionnaire} className="flex gap-2">
                <input type="hidden" name="clientId" value={d.clientId} />
                <input type="hidden" name="dossierId" value={id} />
                <input type="hidden" name="back" value={`/prestations/${id}`} />
                <select name="questionnaireId" className="input">{questionnaires.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}</select>
                <button className="btn-secondary">Envoyer</button>
              </form>
            )}
          </Card>

          <Card title="Galeries & transferts" actions={<Link href={`/galeries/nouvelle?dossierId=${id}`} className="text-sm text-link-600 hover:underline">+ Nouvelle</Link>}>
            {d.galleries.length === 0 ? <Empty>Aucune galerie.</Empty> : (
              <ul className="space-y-2 text-sm">
                {d.galleries.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2">
                    <Link href={`/galeries/${g.id}`} className="hover:text-link-600">{g.kind === "TRANSFERT" ? "📦" : "📷"} {g.title}<div className="text-xs text-slate-500">{g._count.files} fichier(s) · 👁 {g.views}</div></Link>
                    <Badge className={GALLERY_STATUSES[g.status].color}>{GALLERY_STATUSES[g.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {d.eventType !== "LOCATION" && (
            <PrepChecklist
              dossierId={id}
              list={parsePrep(d.prepList)}
              outdated={prepOutdated(parsePrep(d.prepList), d.equipment)}
              hasEquipment={d.equipment.length > 0}
              day={d.eventStart ? parisParts(d.eventStart).key : null}
              autoDays={days}
            />
          )}

          <div id="materiel" className="scroll-mt-6"><Card title="Matériel réservé">
            {equipment.length > 0 ? (
              <EquipmentPicker items={availability} action={setDossierEquipment.bind(null, id)} remove={removeDossierEquipment.bind(null, id)} dated={!!d.eventStart} />
            ) : <p className="text-sm text-slate-500"><Link href="/materiel" className="text-link-600">Ajoutez votre parc matériel</Link>.</p>}
          </Card></div>

          <Card title="Agenda">
            <EventList events={d.events} newHref={`/agenda/nouveau?clientId=${d.clientId}&dossierId=${id}`} />
          </Card>
        </div>
      </div>
    </div>
  );
}
