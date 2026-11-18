import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { getCompany } from "@/lib/company";
import { hasGalleryAccess, isGalleryOpen } from "@/lib/galleries";
import { date } from "@/lib/format";
import { Unlock } from "./Unlock";
import { GalleryView } from "./GalleryView";

export const metadata = { title: "Galerie", robots: { index: false } };

export default async function PublicGallery({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const g = await db.gallery.findUnique({ where: { token }, include: { files: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } });
  if (!g) notFound();
  const user = await currentUser();
  const staff = !!user && user.role !== "CLIENT";
  const c = await getCompany();
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
        <div className="rounded-lg bg-[#fff]/95 px-3 py-1.5"><Logo className="h-8" /></div>
        <div className="text-right text-xs text-zinc-400">{[c.phone, c.web].filter(Boolean).join(" · ")}</div>
      </header>
      {children}
    </div>
  );

  if (!staff && !isGalleryOpen(g))
    return shell(<p className="px-4 py-24 text-center text-zinc-400">{g.status === "PUBLIEE" ? "Cette galerie n'est plus en ligne." : "Cette galerie n'est pas encore disponible."} Contactez-nous si besoin{c.email ? ` : ${c.email}` : ""}.</p>);
  if (!staff && !(await hasGalleryAccess(g))) return shell(<Unlock token={token} title={g.title} />);
  if (!staff) await db.gallery.update({ where: { id: g.id }, data: { views: { increment: 1 } } });

  const cover = g.files.find((f) => f.id === g.coverId) ?? g.files.find((f) => f.thumbUrl);
  return shell(
    <main className="mx-auto max-w-7xl px-4 pb-16">
      {staff && g.status !== "PUBLIEE" && <p className="mb-4 rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-200">Aperçu équipe : la galerie n&apos;est pas encore publiée.</p>}
      <section className="relative mb-8 overflow-hidden rounded-2xl bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {g.kind === "GALERIE" && cover?.thumbUrl && <img src={cover.thumbUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-sm" />}
        <div className="relative px-6 py-14 text-center sm:py-20">
          <div className="text-xs tracking-[0.3em] text-zinc-300 uppercase">{g.kind === "TRANSFERT" ? "Transfert de fichiers" : "Galerie privée"}</div>
          <h1 className="mt-2 text-3xl font-semibold sm:text-5xl">{g.title}</h1>
          {g.message && <p className="mx-auto mt-4 max-w-2xl whitespace-pre-wrap text-zinc-200">{g.message}</p>}
          {g.expiresAt && <p className="mt-4 text-xs text-zinc-400">Disponible jusqu&apos;au {date(g.expiresAt)} — pensez à sauvegarder vos fichiers.</p>}
          {g.externalUrl && (
            <div className="mt-6"><a href={g.externalUrl} target="_blank" className="inline-block rounded-full bg-[#fff] px-5 py-2.5 text-sm font-medium text-zinc-900">Ouvrir la galerie ↗</a>{g.externalCode && <div className="mt-2 text-sm text-zinc-300">Code d&apos;accès : <span className="font-mono tracking-widest">{g.externalCode}</span></div>}</div>
          )}
        </div>
      </section>
      <GalleryView
        token={token}
        kind={g.kind}
        allowDownload={g.allowDownload || staff}
        allowFavorites={g.allowFavorites && g.kind === "GALERIE"}
        files={g.files.map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, url: f.url, thumbUrl: f.thumbUrl, favorite: f.favorite, width: f.width, height: f.height }))}
      />
    </main>,
  );
}
