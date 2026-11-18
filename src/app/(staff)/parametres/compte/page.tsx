import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleLabel } from "@/lib/permissions";
import { dateTime } from "@/lib/format";
import { ResultForm } from "@/components/ResultForm";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { Badge, Card, Field } from "@/components/ui";
import { changePassword, disableTwoFactor, signOutEverywhere, updateProfile } from "../actions";

export const metadata = { title: "Mon compte" };

const browser = (ua: string | null) => {
  if (!ua) return "navigateur inconnu";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "navigateur";
  return `${b}${os ? ` sur ${os}` : ""}`;
};

export default async function Account() {
  const u = await requireStaff();
  const events = await db.loginEvent.findMany({ where: { OR: [{ userId: u.id }, { email: u.email }] }, orderBy: { createdAt: "desc" }, take: 12 });
  const failed = events.filter((e) => !e.success && Date.now() - e.createdAt.getTime() < 7 * 864e5).length;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Mon profil">
        <ResultForm action={updateProfile} submit="Enregistrer">
          <Field label="Nom"><input name="name" defaultValue={u.name} required className="input" /></Field>
          <Field label="Fonction"><input name="jobTitle" defaultValue={u.jobTitle ?? ""} placeholder="DJ, photographe…" className="input" /></Field>
          <Field label="Téléphone"><input name="phone" defaultValue={u.phone ?? ""} className="input" /></Field>
          <p className="text-sm text-slate-500">E-mail : {u.email}, rôle : {roleLabel(u.role)}</p>
        </ResultForm>
      </Card>
      <Card title="Mot de passe">
        <ResultForm action={changePassword} submit="Changer le mot de passe">
          <Field label="Mot de passe actuel"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
          <Field label="Nouveau mot de passe (10 caractères minimum)"><input name="next" type="password" minLength={10} required className="input" autoComplete="new-password" /></Field>
          <Field label="Confirmer"><input name="confirm" type="password" minLength={10} required className="input" autoComplete="new-password" /></Field>
          <p className="text-xs text-slate-500">Astuce : une phrase de quelques mots est à la fois solide et facile à retenir. Le changement déconnecte vos autres appareils.</p>
        </ResultForm>
      </Card>
      <Card title="Vérification en deux étapes" actions={u.totpEnabled ? <Badge className="bg-emerald-100 text-emerald-700">Activée</Badge> : <Badge className="bg-amber-100 text-amber-800">Désactivée</Badge>}>
        <TwoFactorSetup enabled={u.totpEnabled}>
          <ResultForm action={disableTwoFactor} submit="Désactiver">
            <p className="text-sm text-slate-600">Un code de votre application d&apos;authentification est demandé à chaque connexion. Pour désactiver cette protection, confirmez votre mot de passe.</p>
            <Field label="Mot de passe"><input name="password" type="password" required className="input" autoComplete="current-password" /></Field>
          </ResultForm>
        </TwoFactorSetup>
      </Card>
      <Card title="Connexions récentes" actions={<form action={async () => { "use server"; await signOutEverywhere(); }}><button className="btn-secondary py-1.5 text-xs">Déconnecter les autres appareils</button></form>}>
        {failed > 0 && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{failed} tentative{failed > 1 ? "s" : ""} de connexion refusée{failed > 1 ? "s" : ""} sur votre compte cette semaine. Si ce n&apos;était pas vous, changez votre mot de passe et activez la vérification en deux étapes.</p>}
        {events.length === 0 ? <p className="text-sm text-slate-500">Aucune connexion enregistrée.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0"><span className={e.success ? "text-emerald-700" : "text-rose-600"}>{e.success ? "✓" : "✕"}</span> {browser(e.userAgent)}<span className="block truncate text-xs text-slate-500">{e.ip}{e.reason ? `, ${e.reason}` : ""}</span></span>
                <span className="shrink-0 text-xs text-slate-500">{dateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
