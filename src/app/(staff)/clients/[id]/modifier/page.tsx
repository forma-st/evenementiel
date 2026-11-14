import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { assertClientVisible, permsFor } from "@/lib/permissions";
import { ClientForm } from "@/components/ClientForm";
import { Back, PageHeader } from "@/components/ui";
import { updateClient } from "../../../actions";

export const metadata = { title: "Modifier le client" };

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  await assertClientVisible(user, id);
  const [client, p, tags, users] = await Promise.all([
    db.client.findUnique({ where: { id }, include: { tagList: { select: { id: true } } } }),
    permsFor(user),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!client) notFound();
  return (
    <div className="max-w-3xl">
      <Back href={`/clients/${id}`}>{client.name}</Back>
      <PageHeader title="Modifier le client" subtitle="Vous pouvez aussi rechercher l'entreprise dans la base INSEE pour mettre la fiche à jour." />
      <ClientForm
        action={updateClient.bind(null, id)}
        client={client}
        submit="Enregistrer"
        tags={tags}
        selectedTags={client.tagList.map((t) => t.id)}
        users={users}
        ownerId={client.ownerId}
        canCreateTag={p.canManageTags}
      />
    </div>
  );
}
