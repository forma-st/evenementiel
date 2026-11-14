import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Back, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { PortalAccessForm } from "@/components/PortalAccessForm";
import { QUOTE_STATUSES, date, eur, statusOf } from "@/lib/format";
import { addContact, createPortalAccess, deleteClient, deleteContact } from "../../actions";
import { TaskBoard } from "@/components/TaskBoard";
import { DeleteClientButton } from "@/components/DeleteClientButton";
import { TagChips } from "@/components/TagPicker";
import { EventList } from "@/components/EventList";
import { SignatureList } from "@/components/SignatureList";
import { requireStaff } from "@/lib/auth";
import { assertClientVisible, permsFor } from "@/lib/permissions";
import { toRow } from "@/lib/tasks";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  await assertClientVisible(me, id);
  const perms = await permsFor(me);
  const client = await db.client.findUnique({
    where: { id },
    include: {
      contacts: true,
      dossiers: { orderBy: { updatedAt: "desc" }, include: { assignee: true } },
      quotes: { orderBy: { createdAt: "desc" } },
      assignments: { include: { questionnaire: true }, orderBy: { createdAt: "desc" } },
      users: true,
      tagList: { orderBy: { name: "asc" } },
      signatures: { select: { id: true, title: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      events: { include: { attendees: { include: { user: { select: { name: true } } } } }, orderBy: { start: "desc" }, take: 30 },
      owner: { select: { name: true } },
      tasks: { where: { status: { not: "FAIT" } }, include: { client: true, dossier: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!client) notFound();
  const staff = await db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <Back href="/clients">Clients</Back>
      <PageHeader
        title={client.name}
        subtitle={
          <div className="space-y-2">
            <div>{[client.type === "COMPANY" ? client.legalForm || "Entreprise" : "Particulier", client.siren && `SIREN ${client.siren}`, client.city, client.owner && `Responsable : ${client.owner.name}`].filter(Boolean).join(" · ")}</div>
            {client.tagList.length > 0 && <TagChips tags={client.tagList} />}
          </div>
        }
        actions={
          <>
            <Link href={`/prestations/nouveau?clientId=${id}`} className="btn-secondary">+ Prestation</Link>
            <Link href={`/devis/nouveau?clientId=${id}`} className="btn-secondary">+ Devis</Link>
            <Link href={`/clients/${id}/modifier`} className="btn-primary">Modifier</Link>
            {perms.canDeleteClients && <DeleteClientButton
              action={deleteClient.bind(null, id, "/clients")}
              name={client.name}
              counts={{ dossiers: client.dossiers.length, quotes: client.quotes.length, tasks: client.tasks.length }}
            />}
          </>
        }
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tâches en cours</h2>
        <TaskBoard initial={client.tasks.map(toRow)} users={perms.canAssignOthers ? staff : staff.filter((u) => u.id === me.id)} context={{ clientId: id }} showDone={false} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title="Agenda & comptes-rendus">
            <EventList events={client.events} newHref={`/agenda/nouveau?clientId=${id}`} />
          </Card>

          <Card title="Prestations">
            {client.dossiers.length === 0 ? <Empty>Aucun dossier.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {client.dossiers.map((d) => (
                  <li key={d.id}>
                    <Link href={`/prestations/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-link-600">
                      <div>
                        <div className="font-medium">{d.reference} — {d.title}</div>
                        <div className="text-xs text-slate-500">{d.assignee?.name ?? "Non assigné"} · mis à jour {date(d.updatedAt)}</div>
                      </div>
                      <Badge className={statusOf(d.status).color}>{statusOf(d.status).label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Devis">
            {client.quotes.length === 0 ? <Empty>Aucun devis.</Empty> : (
              <table className="table">
                <tbody>
                  {client.quotes.map((q) => (
                    <tr key={q.id}>
                      <td><Link href={`/devis/${q.id}`} className="font-medium text-link-600 hover:underline">{q.number ?? q.label}</Link><div className="text-xs text-slate-500">{q.label}</div></td>
                      <td>{date(q.issuedAt)}</td>
                      <td className="text-right">{eur(q.totalHT)} HT</td>
                      <td className="text-right"><Badge className={QUOTE_STATUSES[q.status].color}>{QUOTE_STATUSES[q.status].label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {perms.canSendSignatures && (
            <Card title="Signatures électroniques">
              <SignatureList items={client.signatures} newHref={`/signatures/nouveau?clientId=${id}`} />
            </Card>
          )}

          <Card title="Questionnaires">
            {client.assignments.length === 0 ? <Empty>Aucun questionnaire envoyé.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {client.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <Link href={`/questionnaires/reponse/${a.id}`} className="font-medium hover:text-link-600">{a.questionnaire.title}</Link>
                    <Badge className={a.status === "COMPLETE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>
                      {a.status === "COMPLETE" ? `Complété le ${date(a.submittedAt)}` : "En attente"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Coordonnées">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-slate-500">E-mail</dt><dd>{client.email ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Téléphone</dt><dd>{client.phone ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Adresse</dt><dd>{[client.address, [client.postalCode, client.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</dd></div>
              {client.notes && <div><dt className="text-slate-500">Notes</dt><dd className="whitespace-pre-wrap">{client.notes}</dd></div>}
            </dl>
          </Card>

          {client.type === "COMPANY" && (client.siren || client.nafCode) && (
            <Card title="Identité de l'entreprise">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">SIREN</dt><dd>{client.siren ?? "—"}</dd></div>
                <div><dt className="text-slate-500">SIRET siège</dt><dd>{client.siret ?? "—"}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">TVA intracommunautaire</dt><dd>{client.vatNumber ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Forme juridique</dt><dd>{client.legalForm ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Code NAF</dt><dd>{client.nafCode ?? "—"}</dd></div>
                <div><dt className="text-slate-500">Effectif</dt><dd>{client.headcount ?? "—"}</dd></div>
              </dl>
              {client.siren && (
                <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${client.siren}`} target="_blank" className="mt-3 inline-block text-xs text-link-600 hover:underline">
                  Voir sur l'Annuaire des entreprises ↗
                </a>
              )}
            </Card>
          )}



          <Card title="Contacts">
            <ul className="mb-4 space-y-2 text-sm">
              {client.contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.firstName} {c.lastName}</div>
                    <div className="text-xs text-slate-500">{[c.jobTitle, c.email, c.phone].filter(Boolean).join(" · ")}</div>
                  </div>
                  <form action={deleteContact.bind(null, c.id, id)}><button className="text-xs text-slate-400 hover:text-rose-600">Retirer</button></form>
                </li>
              ))}
            </ul>
            <form action={addContact.bind(null, id)} className="grid grid-cols-2 gap-2">
              <input name="firstName" placeholder="Prénom" required className="input" />
              <input name="lastName" placeholder="Nom" required className="input" />
              <input name="email" type="email" placeholder="E-mail" className="input col-span-2" />
              <input name="phone" placeholder="Téléphone" className="input" />
              <input name="jobTitle" placeholder="Fonction" className="input" />
              <button className="btn-secondary col-span-2">Ajouter le contact</button>
            </form>
          </Card>

          <Card title="Accès portail client">
            {client.users.length > 0 && (
              <ul className="mb-3 text-sm">
                {client.users.map((u) => <li key={u.id}>✓ {u.name} — {u.email}</li>)}
              </ul>
            )}
            <PortalAccessForm action={createPortalAccess.bind(null, id)} defaultEmail={client.email} defaultName={client.name} />
          </Card>
        </div>
      </div>
    </div>
  );
}
