import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { date, dateTime } from "@/lib/format";
import { getCompany } from "@/lib/company";
import { declineDocument, signDocument } from "./actions";
import { SignForm } from "./SignForm";

export const metadata = { title: "Signature électronique", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await db.signatureSigner.findUnique({
    where: { token },
    include: { request: { include: { client: { select: { name: true } }, createdBy: { select: { name: true } }, signers: { select: { name: true, status: true } } } } },
  });
  if (!s) notFound();
  const r = s.request;
  const COMPANY = await getCompany();
  if (!s.viewedAt && s.status === "EN_ATTENTE") await db.signatureSigner.update({ where: { id: s.id }, data: { viewedAt: new Date() } });
  const docUrl = `/api/sign/${token}`;
  const expired = r.expiresAt < new Date();
  const closed = r.status !== "EN_ATTENTE" || s.status !== "EN_ATTENTE" || expired;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-4">
        <Logo className="h-11" />
        <span className="text-right text-xs text-slate-500">Signature électronique sécurisée<br />{COMPANY.name} · {COMPANY.web}</span>
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{r.title}</div>
              <div className="text-xs text-slate-500">{r.fileName}</div>
            </div>
            <a href={docUrl} target="_blank" className="btn-secondary shrink-0 py-1.5 text-xs">Ouvrir le document ↗</a>
          </div>
          <iframe src={`${docUrl}#view=FitH`} title="Document à signer" className="h-[70vh] w-full bg-slate-100" />
        </div>
        <div className="card h-fit border-t-4 border-t-brand-600 p-5 lg:sticky lg:top-6">
          <div className="text-sm text-slate-500">{r.client.name}</div>
          <h1 className="text-xl font-semibold">Bonjour {s.name.split(" ")[0]},</h1>
          <p className="mt-1 text-sm text-slate-600">
            {r.createdBy?.name ?? COMPANY.name} vous invite à signer ce document.{" "}
            {!closed && <>Lien valable jusqu'au {date(r.expiresAt)}.</>}
          </p>
          {r.message && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">{r.message}</p>}
          {r.signers.length > 1 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-500">
              {r.signers.map((x, i) => <li key={i}>{x.status === "SIGNE" ? "✓" : "○"} {x.name}</li>)}
            </ul>
          )}
          <div className="mt-5">
            {s.status === "SIGNE" ? (
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                ✓ Vous avez signé ce document le {dateTime(s.signedAt!)}.
                {r.status === "SIGNE" && <> <a href={`${docUrl}?signe=1`} target="_blank" className="font-medium underline">Télécharger la version signée</a></>}
              </div>
            ) : s.status === "REFUSE" ? (
              <div className="rounded-xl bg-slate-100 p-4 text-sm">Vous avez refusé de signer ce document.</div>
            ) : r.status === "ANNULE" ? (
              <div className="rounded-xl bg-slate-100 p-4 text-sm">Cette demande a été annulée par {COMPANY.name}.</div>
            ) : expired ? (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Ce lien a expiré. Contactez {COMPANY.name} ({COMPANY.phone}) pour en recevoir un nouveau.</div>
            ) : r.status !== "EN_ATTENTE" ? (
              <div className="rounded-xl bg-slate-100 p-4 text-sm">Cette demande n'est plus en attente de signature.</div>
            ) : (
              <SignForm sign={signDocument.bind(null, token)} decline={declineDocument.bind(null, token)} signerName={s.name} signedUrl={`${docUrl}?signe=1`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
