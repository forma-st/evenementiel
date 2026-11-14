import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Back, Badge, Card, PageHeader } from "@/components/ui";
import { GALLERY_STATUSES, fileSize } from "@/lib/galleries";
import { dateTime } from "@/lib/format";
import { baseUrl } from "@/lib/merge";
import { NO_BLOB_MESSAGE, isBlobConfigured, onVercelWithoutBlob } from "@/lib/storage";
import { galleryFormData } from "@/lib/galleryForm";
import { GalleryForm } from "@/components/GalleryForm";
import { GalleryUploader } from "@/components/GalleryUploader";
import { GalleryFiles } from "@/components/GalleryFiles";
import { CopyLink } from "@/components/CopyLink";
import { ConfirmButton } from "@/components/ConfirmButton";
import { archiveGallery, deleteFiles, deleteGallery, publishGallery, resetFavorites, setCover, sortFilesByName, updateGallery } from "../actions";

export default async function GalleryAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const g = await db.gallery.findUnique({ where: { id }, include: { client: true, dossier: true, files: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } });
  if (!g) notFound();
  const data = await galleryFormData();
  const link = `${baseUrl()}/g/${g.token}`;
  const st = GALLERY_STATUSES[g.status];
  const total = g.files.reduce((a, f) => a + f.size, 0);
  const rule = await db.automationRule.findFirst({ where: { trigger: "GALLERY_PUBLISHED", active: true } });

  return (
    <div className="space-y-6">
      <Back href="/galeries">Galeries</Back>
      <PageHeader
        title={g.title}
        subtitle={<>
          <Badge className={st.color}>{st.label}</Badge> · {g.kind === "TRANSFERT" ? "Transfert" : "Galerie"} · {g.files.length} fichier(s), {fileSize(total)}
          {g.client && <> · <Link href={`/clients/${g.client.id}`} className="text-link-600 hover:underline">{g.client.name}</Link></>}
          {g.dossier && <> · <Link href={`/prestations/${g.dossier.id}`} className="text-link-600 hover:underline">{g.dossier.reference}</Link></>}
        </>}
        actions={<>
          <a href={`/g/${g.token}`} target="_blank" className="btn-secondary">👁 Voir comme le client</a>
          {g.status === "PUBLIEE"
            ? <form action={publishGallery.bind(null, id, false)}><button className="btn-secondary">Dépublier</button></form>
            : <form action={publishGallery.bind(null, id, true)}><button className="btn-primary">🚀 Publier</button></form>}
        </>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Partage" className="lg:col-span-1">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-slate-500">Lien</dt><dd className="break-all">{link} <CopyLink url={link} /></dd></div>
            <div><dt className="text-slate-500">Code d&apos;accès</dt><dd className="font-mono text-base tracking-widest">{g.password ?? "aucun (lien seul)"}</dd></div>
            {g.externalUrl && <div><dt className="text-slate-500">Galerie externe</dt><dd><a href={g.externalUrl} target="_blank" className="text-link-600 hover:underline break-all">{g.externalUrl}</a>{g.externalCode && <> · code {g.externalCode}</>}</dd></div>}
            <div><dt className="text-slate-500">Statistiques</dt><dd>👁 {g.views} visite(s) · ⬇ {g.downloads} téléchargement(s) ZIP · ♥ {g.files.filter((f) => f.favorite).length} favori(s)</dd></div>
            {g.publishedAt && <div><dt className="text-slate-500">Publiée le</dt><dd>{dateTime(g.publishedAt)}</dd></div>}
          </dl>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {g.dossierId
              ? rule ? <>À la publication, l&apos;automatisation « {rule.name} » envoie le lien et le code au client.</> : <>Aucune automatisation « Galerie publiée » active : pensez à envoyer le lien au client.</>
              : <>Rattachez la galerie à une prestation pour prévenir le client automatiquement à la publication.</>}
          </p>
        </Card>
        <Card title="Réglages" className="lg:col-span-2">
          <GalleryForm
            action={updateGallery.bind(null, id)}
            {...data}
            submit="Enregistrer"
            g={{ ...g, expiresAt: g.expiresAt ? g.expiresAt.toISOString().slice(0, 10) : "" }}
          />
        </Card>
      </div>

      <Card title="Fichiers" actions={<div className="flex gap-2"><form action={sortFilesByName.bind(null, id)}><button className="btn-secondary py-1 text-xs">Trier par nom</button></form><form action={resetFavorites.bind(null, id)}><button className="btn-secondary py-1 text-xs">Effacer les favoris</button></form></div>}>
        <div className="space-y-5">
          <GalleryUploader galleryId={id} blob={isBlobConfigured()} disabledReason={onVercelWithoutBlob() ? NO_BLOB_MESSAGE : null} />
          <GalleryFiles files={g.files} coverId={g.coverId} onDelete={deleteFiles.bind(null, id)} onCover={setCover.bind(null, id)} />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        {g.status !== "ARCHIVEE" && <form action={archiveGallery.bind(null, id)}><button className="btn-secondary">Archiver (hors ligne)</button></form>}
        <ConfirmButton action={deleteGallery.bind(null, id)} label="Supprimer la galerie" className="btn-secondary text-rose-600" title="Supprimer la galerie ?" message={`Les ${g.files.length} fichier(s) seront définitivement effacés du stockage.`} />
      </div>
    </div>
  );
}
