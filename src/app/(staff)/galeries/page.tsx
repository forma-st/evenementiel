import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { GALLERY_STATUSES, fileSize } from "@/lib/galleries";
import { date } from "@/lib/format";
import { isBlobConfigured } from "@/lib/storage";

export const metadata = { title: "Galeries" };

export default async function Galleries({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireStaff();
  const { type } = await searchParams;
  const list = await db.gallery.findMany({
    where: type ? { kind: type } : {},
    include: { client: { select: { name: true } }, dossier: { select: { reference: true, eventStart: true } }, _count: { select: { files: true } } },
    orderBy: { createdAt: "desc" },
  });
  const ids = list.map((g) => g.id);
  const [sizes, favs, covers] = await Promise.all([
    db.galleryFile.groupBy({ by: ["galleryId"], where: { galleryId: { in: ids } }, _sum: { size: true } }),
    db.galleryFile.groupBy({ by: ["galleryId"], where: { galleryId: { in: ids }, favorite: true }, _count: true }),
    db.galleryFile.findMany({ where: { OR: list.map((g) => (g.coverId ? { id: g.coverId } : { galleryId: g.id, position: 0 })) }, select: { id: true, galleryId: true, thumbUrl: true } }),
  ]);
  return (
    <div>
      <PageHeader
        title="Galeries & transferts"
        subtitle={<>Livraison des photos et fichiers aux clients · stockage : {isBlobConfigured() ? "Vercel Blob" : "disque local"}</>}
        actions={<><Link href="/galeries/nouvelle?type=TRANSFERT" className="btn-secondary">+ Transfert</Link><Link href="/galeries/nouvelle" className="btn-primary">+ Galerie</Link></>}
      />
      <div className="mb-4 flex gap-2 text-sm">
        {[["", "Tout"], ["GALERIE", "Galeries"], ["TRANSFERT", "Transferts"]].map(([k, l]) => (
          <Link key={k} href={k ? `/galeries?type=${k}` : "/galeries"} className={`badge px-3 py-1.5 ${(type ?? "") === k ? "bg-ink text-paper" : "border border-slate-200 bg-white"}`}>{l}</Link>
        ))}
      </div>
      {list.length === 0 ? <div className="card"><Empty>Aucune galerie pour le moment.</Empty></div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => {
            const cover = covers.find((c) => c.galleryId === g.id && (!g.coverId || c.id === g.coverId));
            const st = GALLERY_STATUSES[g.status];
            return (
              <Link key={g.id} href={`/galeries/${g.id}`} className="card overflow-hidden hover:border-brand-500">
                <div className="flex aspect-[3/2] items-center justify-center bg-slate-100 text-4xl text-slate-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {cover?.thumbUrl ? <img src={cover.thumbUrl} alt="" className="h-full w-full object-cover" /> : g.kind === "TRANSFERT" ? "📦" : g.externalUrl ? "🔗" : "📷"}
                </div>
                <div className="space-y-1 p-4">
                  <div className="flex items-start justify-between gap-2"><div className="font-medium">{g.title}</div><Badge className={st.color}>{st.label}</Badge></div>
                  <div className="text-xs text-slate-500">{g.client?.name ?? "Sans client"}{g.dossier ? ` · ${g.dossier.reference}` : ""}</div>
                  <div className="text-xs text-slate-500">
                    {g._count.files} fichier(s) · {fileSize(sizes.find((x) => x.galleryId === g.id)?._sum.size ?? 0)}
                    {(favs.find((x) => x.galleryId === g.id)?._count ?? 0) > 0 && <> · ♥ {favs.find((x) => x.galleryId === g.id)!._count}</>}
                    {g.views > 0 && <> · 👁 {g.views}</>}
                    {g.expiresAt && <> · jusqu&apos;au {date(g.expiresAt)}</>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
