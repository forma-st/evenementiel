import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { permsFor } from "@/lib/permissions";
import { ClientForm } from "@/components/ClientForm";
import { Back, PageHeader } from "@/components/ui";
import { createClient } from "../../actions";

export const metadata = { title: "Nouveau client" };

export default async function NewClient() {
  const user = await requireStaff();
  const [p, tags, users] = await Promise.all([
    permsFor(user),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { not: "CLIENT" }, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="max-w-3xl">
      <Back href="/clients">Clients</Back>
      <PageHeader title="Nouveau client" />
      <ClientForm action={createClient} submit="Créer le client" tags={tags} users={users} ownerId={user.id} canCreateTag={p.canManageTags} />
    </div>
  );
}
