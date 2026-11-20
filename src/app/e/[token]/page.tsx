import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { MusicPlanner } from "@/components/MusicPlanner";
import { OptionShop } from "@/components/OptionShop";
import { getCompany } from "@/lib/company";
import { TZ } from "@/lib/format";
import { eventKind } from "@/lib/presta";
import { musicData, planAccess } from "@/lib/musicServer";
import { spotifyConfigured } from "@/lib/spotify";
import { cancelOption, requestOption, savePlanByToken } from "./actions";

export const metadata = { title: "Organisation de votre événement", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Espace organisation du client (lien reçu par e-mail, sans compte) : déroulé, musique, infos pratiques, options. */
export default async function PlanSpace({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 16 || token.length > 64) notFound();
  const p = await db.musicPlan.findFirst({ where: { token }, include: { dossier: { include: { client: true, assignee: { select: { name: true, phone: true } }, optionRequests: { orderBy: { createdAt: "asc" } } } } } });
  if (!p || ["PERDU", "CLOTURE"].includes(p.dossier.status)) notFound();
  const d = p.dossier;
  const [c, options] = await Promise.all([getCompany(), db.catalogItem.findMany({ where: { active: true, clientOption: true }, orderBy: [{ position: "asc" }, { label: "asc" }], select: { id: true, label: true, description: true, unitPrice: true, unit: true, category: true } })]);
  const access = planAccess(p, d.eventStart);
  const days = d.eventStart ? Math.ceil((d.eventStart.getTime() - Date.now()) / 864e5) : null;
  const k = eventKind(d.eventType);
  return (
    <div className="min-h-screen">
      <header className="nav-navy">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Logo className="h-10" />
          <ThemeSwitch compact />
        </div>
        <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-4 px-4 pt-2 pb-7">
          <div>
            <div className="text-sm opacity-80">{k.icon} {k.label} · {d.client.name}</div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{d.title}</h1>
            <div className="text-sm opacity-90 first-letter:uppercase">{d.eventStart ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d.eventStart) : "Date à définir"}{d.venueName ? ` · ${d.venueName}` : ""}</div>
          </div>
          {days !== null && days >= 0 && <div className="text-center"><div className="text-4xl font-bold">{days}</div><div className="text-xs uppercase opacity-80">jour{days > 1 ? "s" : ""}</div></div>}
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <p className="text-sm text-slate-600">Bonjour ! Cet espace sert à préparer ensemble votre événement : le déroulé, la musique et les infos pratiques. Vous pouvez y revenir autant de fois que vous voulez avec ce même lien.</p>
        <section className="card p-5">
          <MusicPlanner
            dossierId={d.id}
            role="client"
            initial={musicData(p, d.eventType)}
            access={access}
            spotify={spotifyConfigured()}
            save={savePlanByToken.bind(null, token)}
            extraTab={{
              label: `➕ Options${d.optionRequests.length ? ` (${d.optionRequests.length})` : ""}`,
              content: <OptionShop items={options} requests={d.optionRequests.map((r) => ({ id: r.id, label: r.label, quantity: r.quantity, unitPrice: r.unitPrice, status: r.status, note: r.note }))} editable={access.editable} vatExempt={c.vatExempt} request={requestOption.bind(null, token)} cancel={cancelOption.bind(null, token)} />,
            }}
          />
        </section>
        <p className="text-center text-xs text-slate-500">{c.name}{d.assignee ? ` · votre contact : ${d.assignee.name}${d.assignee.phone ? `, ${d.assignee.phone}` : ""}` : c.phone ? ` · ${c.phone}` : ""}{c.email ? ` · ${c.email}` : ""}</p>
      </main>
    </div>
  );
}
