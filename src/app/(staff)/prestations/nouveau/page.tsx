import { db } from "@/lib/db";
import { DossierForm } from "@/components/DossierForm";
import { Back, PageHeader } from "@/components/ui";
import { createDossier } from "../../actions";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Nouvelle prestation" };

export default async function NewDossier({ searchParams }: { searchParams: Promise<{ clientId?: string; type?: string }> }) {
  await requireStaff();
  const { clientId, type } = await searchParams;
  const [clients, users] = await Promise.all([
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="max-w-3xl">
      <Back href="/prestations">Prestations</Back>
      <PageHeader title="Nouvelle prestation" subtitle={<>Le client n&apos;existe pas encore ? <a href="/clients/nouveau" className="text-link-600 hover:underline">Créez-le d&apos;abord</a>.</>} />
      <DossierForm action={createDossier} clients={clients} users={users} defaultClientId={clientId} defaultType={type === "LOCATION" || type === "PRET" ? type : undefined} submit="Créer la prestation" />
    </div>
  );
}
