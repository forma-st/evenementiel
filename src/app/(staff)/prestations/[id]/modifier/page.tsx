import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DossierForm } from "@/components/DossierForm";
import { Back, PageHeader } from "@/components/ui";
import { updateDossier } from "../../../actions";
import { requireStaff } from "@/lib/auth";
import { assertDossierVisible } from "@/lib/permissions";

export default async function EditDossier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertDossierVisible(await requireStaff(), id);
  const [dossier, clients, users] = await Promise.all([
    db.dossier.findUnique({ where: { id } }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true } }),
  ]);
  if (!dossier) notFound();
  return (
    <div className="max-w-3xl">
      <Back href={`/prestations/${id}`}>{dossier.reference}</Back>
      <PageHeader title="Modifier la prestation" />
      <DossierForm action={updateDossier.bind(null, id)} dossier={dossier} clients={clients} users={users} submit="Enregistrer" />
    </div>
  );
}
