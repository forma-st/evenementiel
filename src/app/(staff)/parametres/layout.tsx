import { requireStaff } from "@/lib/auth";
import { permsFor } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const p = await permsFor(user);
  const admin = user.role === "ADMIN";
  const tabs = [
    { href: "/parametres/compte", label: "Mon compte" },
    ...(admin || user.role === "MANAGER" ? [{ href: "/parametres/entreprise", label: "Entreprise" }, { href: "/parametres/comptabilite", label: "Comptabilité" }] : []),
    ...(admin ? [{ href: "/parametres/equipe", label: "Équipe" }, { href: "/parametres/droits", label: "Droits d'accès" }] : []),
    ...(p.canManageTags ? [{ href: "/parametres/etiquettes", label: "Étiquettes" }] : []),
    ...(admin || user.role === "MANAGER" ? [{ href: "/parametres/automatisations", label: "Automatisations" }, { href: "/parametres/emails", label: "Modèles d'e-mails" }] : []),
    { href: "/parametres/integrations", label: "Intégrations" },
  ];
  return (
    <div className="max-w-5xl">
      <PageHeader title="Paramètres" />
      <SettingsTabs tabs={tabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
