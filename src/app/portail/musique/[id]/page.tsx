import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { eventKind } from "@/lib/presta";
import { TZ } from "@/lib/format";
import { MusicPlanner } from "@/components/MusicPlanner";
import { musicData } from "@/lib/musicServer";
import { spotifyConfigured } from "@/lib/spotify";

export const metadata = { title: "Ma musique" };

export default async function ClientMusic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireClient();
  const d = await db.dossier.findFirst({ where: { id, clientId: u.clientId, eventType: { notIn: ["LOCATION", "PRET"] } }, include: { musicPlan: true } });
  if (!d) notFound();
  const k = eventKind(d.eventType);
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Link href="/portail" className="text-sm text-link-600 hover:underline">← Mon espace</Link>
        <div>
          <div className="text-sm text-slate-500">{k.icon} {d.title}{d.eventStart && ` · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: TZ }).format(d.eventStart)}`}</div>
          <h1 className="text-2xl font-semibold">🎵 Votre musique</h1>
          <p className="mt-1 text-sm text-slate-600">Partagez votre playlist, choisissez les morceaux des moments importants et dites-nous ce que vous voulez entendre… ou pas.</p>
        </div>
        <section className="card p-5">
          <MusicPlanner dossierId={d.id} role="client" initial={musicData(d.musicPlan, d.eventType)} clientCanEdit={d.musicPlan?.clientCanEdit ?? true} spotify={spotifyConfigured()} />
        </section>
      </main>
    </div>
  );
}
