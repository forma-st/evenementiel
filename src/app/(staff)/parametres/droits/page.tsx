import { requireAdmin } from "@/lib/auth";
import { PERM_DEFS, ROLES, loadRolePerms } from "@/lib/permissions";
import { ResultForm } from "@/components/ResultForm";
import { savePermissions } from "../actions";

export const metadata = { title: "Droits d'accès" };

export default async function Rights() {
  await requireAdmin();
  const perms = await loadRolePerms();
  const roles = ["MANAGER", "MEMBER"] as const;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Réglez ce que peut faire chaque niveau. Les <b>administrateurs</b> ont toujours tous les droits.
        Les <b>clients</b> n'accèdent qu'à leur espace client.
      </p>
      <ResultForm action={savePermissions} submit="Enregistrer les droits">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Droit</th>
                {roles.map((r) => <th key={r} className="w-48 text-center">{ROLES.find((x) => x.id === r)!.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERM_DEFS.map((d) => (
                <tr key={d.key}>
                  <td>
                    <div className="font-medium">{d.label}</div>
                    {d.help && <div className="text-xs text-slate-500">{d.help}</div>}
                  </td>
                  {roles.map((r) => (
                    <td key={r} className="text-center">
                      {d.kind === "scope" ? (
                        <select name={`${r}.${d.key}`} defaultValue={perms[r][d.key] as string} className="input py-1.5">
                          <option value="all">Toute l'équipe</option>
                          <option value="own">Les siens uniquement</option>
                        </select>
                      ) : (
                        <input type="checkbox" name={`${r}.${d.key}`} defaultChecked={perms[r][d.key] as boolean} className="h-5 w-5 accent-brand-600" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ResultForm>
    </div>
  );
}
