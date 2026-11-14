import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Back, PageHeader } from "@/components/ui";
import { GalleryForm } from "@/components/GalleryForm";
import { galleryFormData } from "@/lib/galleryForm";
import { createGallery } from "../actions";

export const metadata = { title: "Nouvelle galerie" };

export default async function NewGallery({ searchParams }: { searchParams: Promise<{ dossierId?: string; type?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const data = await galleryFormData();
  const d = sp.dossierId ? await db.dossier.findUnique({ where: { id: sp.dossierId }, include: { client: true } }) : null;
  const exp = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  return (
    <div className="max-w-3xl">
      <Back href="/galeries">Galeries</Back>
      <PageHeader title={sp.type === "TRANSFERT" ? "Nouveau transfert" : "Nouvelle galerie"} subtitle="Créez la galerie, déposez les fichiers, puis publiez-la : le client reçoit le lien automatiquement." />
      <div className="card p-6">
        <GalleryForm action={createGallery} {...data} submit="Créer et ajouter les fichiers" isNew g={{ kind: sp.type === "TRANSFERT" ? "TRANSFERT" : "GALERIE", title: d ? d.title : undefined, clientId: d?.clientId, dossierId: d?.id, expiresAt: exp, password: null }} />
      </div>
    </div>
  );
}
