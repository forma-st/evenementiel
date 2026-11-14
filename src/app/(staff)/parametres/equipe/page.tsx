import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ROLES, roleLabel } from "@/lib/permissions";
import { ResultForm } from "@/components/ResultForm";
import { UserRowActions } from "@/components/UserRowActions";
import { Badge, Card } from "@/components/ui";
import { createUser, deleteUser, resetUserPassword, setUserActive, setUserRole } from "../actions";

export const metadata = { title: "Équipe" };

export default async function Team() {
  const me = await requireAdmin();
  const users = await db.user.findMany({
    where: { role: { not: "CLIENT" } },
    include: { _count: { select: { tasks: { where: { status: { not: "FAIT" } } }, dossiers: true, clientsOwned: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <div className="space-y-6">
      <Card title="Ajouter un membre">
        <ResultForm action={createUser} submit="Créer le compte">
          <div className="grid gap-3 sm:grid-cols-4">
            <input name="name" placeholder="Nom complet" required className="input" />
            <input name="email" type="email" placeholder="E-mail" required className="input" />
            <input name="jobTitle" placeholder="Fonction (facultatif)" className="input" />
            <select name="role" className="input" defaultValue="MEMBER">
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </ResultForm>
        <ul className="mt-4 space-y-1 text-xs text-slate-500">
          {ROLES.map((r) => <li key={r.id}><b>{r.label}</b> : {r.help}</li>)}
        </ul>
      </Card>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Membre</th><th>Rôle</th><th>Charge</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td>
                  <div className="font-medium">{u.name} {!u.active && <Badge className="bg-slate-200 text-slate-600">Désactivé</Badge>}</div>
                  <div className="text-xs text-slate-500">{u.email}{u.jobTitle && ` · ${u.jobTitle}`}</div>
                </td>
                <td>{roleLabel(u.role)}</td>
                <td className="text-xs text-slate-500">{u._count.clientsOwned} client(s) · {u._count.dossiers} dossier(s) · {u._count.tasks} tâche(s) ouvertes</td>
                <td>
                  <UserRowActions
                    id={u.id} name={u.name} role={u.role} active={u.active} isMe={u.id === me.id}
                    onRole={setUserRole} onActive={setUserActive} onReset={resetUserPassword} onDelete={deleteUser}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
