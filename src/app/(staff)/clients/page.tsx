import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientWhere, permsFor } from "@/lib/permissions";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { DeleteClientButton } from "@/components/DeleteClientButton";
import { TagChips } from "@/components/TagPicker";
import { deleteClient } from "../actions";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; owner?: string }> }) {
  const { q = "", tag = "", owner = "" } = await searchParams;
  const user = await requireStaff();
  const p = await permsFor(user);
  const ci = { contains: q, mode: "insensitive" as const };
  const [clients, tags, users] = await Promise.all([
    db.client.findMany({
      where: {
        AND: [
          clientWhere(user, p),
          q ? { OR: [{ name: ci }, { email: ci }, { city: ci }, { siren: { contains: q.replace(/\s/g, "") } }] } : {},
          tag ? { tagList: { some: { id: tag } } } : {},
          owner === "aucun" ? { ownerId: null } : owner ? { ownerId: owner } : {},
        ],
      },
      include: { tagList: true, owner: { select: { name: true } }, _count: { select: { dossiers: true, quotes: true, tasks: true } } },
      orderBy: { name: "asc" },
    }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client(s)${p.clientsScope === "own" ? " · vos clients uniquement" : ""}`}
        actions={<Link href="/clients/nouveau" className="btn-primary">+ Nouveau client</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Rechercher nom, e-mail, ville, SIREN…" className="input max-w-sm" />
        <select name="tag" defaultValue={tag} className="input w-48">
          <option value="">Toutes les étiquettes</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {p.clientsScope === "all" && (
          <select name="owner" defaultValue={owner} className="input w-52">
            <option value="">Tous les responsables</option>
            <option value="aucun">Sans responsable</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <button className="btn-secondary">Filtrer</button>
        {(q || tag || owner) && <Link href="/clients" className="btn px-2 text-slate-500 hover:text-slate-800">Effacer</Link>}
      </form>
      <div className="card overflow-x-auto">
        {clients.length === 0 ? (
          <Empty>Aucun client trouvé.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Nom</th><th>Contact</th><th>Ville</th><th>Responsable</th><th>Prestations</th><th>Devis</th><th /></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/clients/${c.id}`} className="font-medium text-link-600 hover:underline">{c.name}</Link>
                    {c.siren && <span className="ml-2 text-xs text-slate-400">{c.siren}</span>}
                    {c.tagList.length > 0 && <div className="mt-1"><TagChips tags={c.tagList} /></div>}
                  </td>
                  <td className="text-slate-600">{c.email ?? "—"}<div className="text-xs">{c.phone}</div></td>
                  <td>{c.city ?? "—"}</td>
                  <td className="text-slate-600">{c.owner?.name ?? "—"}</td>
                  <td>{c._count.dossiers}</td>
                  <td>{c._count.quotes}</td>
                  
                  <td className="text-right">
                    {p.canDeleteClients && (
                      <DeleteClientButton compact action={deleteClient.bind(null, c.id, "/clients")} name={c.name} counts={{ dossiers: c._count.dossiers, quotes: c._count.quotes, tasks: c._count.tasks }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
