import { requireStaff } from "@/lib/auth";
import { roleLabel } from "@/lib/permissions";
import { ResultForm } from "@/components/ResultForm";
import { Card, Field } from "@/components/ui";
import { changePassword, updateProfile } from "../actions";

export const metadata = { title: "Mon compte" };

export default async function Account() {
  const u = await requireStaff();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Mon profil">
        <ResultForm action={updateProfile} submit="Enregistrer">
          <Field label="Nom"><input name="name" defaultValue={u.name} required className="input" /></Field>
          <Field label="Fonction"><input name="jobTitle" defaultValue={u.jobTitle ?? ""} placeholder="Formateur, Commercial…" className="input" /></Field>
          <Field label="Téléphone"><input name="phone" defaultValue={u.phone ?? ""} className="input" /></Field>
          <p className="text-sm text-slate-500">E-mail : {u.email} · Rôle : {roleLabel(u.role)}</p>
        </ResultForm>
      </Card>
      <Card title="Mot de passe">
        <ResultForm action={changePassword} submit="Changer le mot de passe">
          <Field label="Mot de passe actuel"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
          <Field label="Nouveau mot de passe (8 caractères min.)"><input name="next" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
          <Field label="Confirmer"><input name="confirm" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
        </ResultForm>
      </Card>
    </div>
  );
}
