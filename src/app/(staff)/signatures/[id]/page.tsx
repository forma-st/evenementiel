import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { clientWhere, pagePerm } from "@/lib/permissions";
import { SIGNATURE_STATUSES } from "@/lib/signature";
import { SIGNATURE_LIGHT } from "@/lib/signatureSelect";
import { date, dateTime } from "@/lib/format";
import { CopyLink } from "@/components/CopyLink";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Back, Badge, Card, PageHeader } from "@/components/ui";
import { cancelSignature, deleteSignature, emailSigner, extendSignature } from "../actions";

export const metadata = { title: "Signature" };

export default async function SignatureDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  const perms = await pagePerm(user, "canSendSignatures");
  const r = await db.signatureRequest.findFirst({ where: { id, client: clientWhere(user, perms) }, select: SIGNATURE_LIGHT });
  if (!r) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const st = SIGNATURE_STATUSES[r.status];
  const expired = r.status === "EN_ATTENTE" && r.expiresAt < new Date();

  return (
    <div className="max-w-4xl space-y-6">
      <Back href="/signatures">Signatures</Back>
      <PageHeader
        title={r.title}
        subtitle={<>
          <Link href={`/clients/${r.clientId}`} className="text-link-600 hover:underline">{r.client.name}</Link>
          {r.dossier && <> · <Link href={`/prestations/${r.dossier.id}`} className="text-link-600 hover:underline">{r.dossier.reference}</Link></>}
          {r.quote && <> · <Link href={`/devis/${r.quote.id}`} className="text-link-600 hover:underline">Devis {r.quote.number ?? r.quote.label}</Link></>}
          {" "}· envoyé par {r.createdBy?.name ?? "—"} le {date(r.createdAt)}
        </>}
        actions={
          <>
            <a href={`/api/signatures/${id}/original`} target="_blank" className="btn-secondary">Document d'origine</a>
            {r.status === "SIGNE" && <a href={`/api/signatures/${id}/signe?dl=1`} className="btn-primary">⬇ PDF signé + preuve</a>}
          </>
        }
      />

      <div className={`rounded-xl p-4 ${r.status === "SIGNE" ? "bg-emerald-50" : r.status === "EN_ATTENTE" ? "bg-amber-50" : "bg-slate-100"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge className={st.color}>{st.label}</Badge>
            <span className="text-sm text-slate-700">
              {r.status === "SIGNE" ? `Toutes les signatures recueillies le ${dateTime(r.completedAt!)}.`
                : r.status === "EN_ATTENTE" ? (expired ? `Les liens ont expiré le ${date(r.expiresAt)}.` : `Liens valables jusqu'au ${date(r.expiresAt)}.`)
                : r.status === "REFUSE" ? "Un signataire a refusé de signer." : "Demande annulée."}
            </span>
          </div>
          {r.status === "EN_ATTENTE" && (
            <div className="flex gap-2">
              <form action={extendSignature.bind(null, id)}><button className="btn-secondary py-1.5 text-xs">Prolonger de 30 jours</button></form>
              <form action={cancelSignature.bind(null, id)}><button className="btn-secondary py-1.5 text-xs">Annuler la demande</button></form>
            </div>
          )}
        </div>
        {r.status === "EN_ATTENTE" && r.winOnSign && r.dossier && <p className="mt-2 text-xs text-slate-600">La prestation {r.dossier.reference} passera automatiquement à « Confirmée » une fois le document signé.</p>}
      </div>

      <Card title="Signataires">
        <ul className="divide-y divide-slate-100">
          {r.signers.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <div className="font-medium">{s.status === "SIGNE" ? "✓" : s.status === "REFUSE" ? "✕" : "○"} {s.name}</div>
                <div className="text-xs text-slate-500">{s.email ?? "pas d'e-mail"}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {s.viewedAt ? `Document ouvert le ${dateTime(s.viewedAt)}` : "Pas encore ouvert"}
                  {s.signedAt && ` · signé le ${dateTime(s.signedAt)} (IP ${s.ip ?? "?"})`}
                </div>
                {s.declineReason && <div className="mt-1 text-xs text-brand-700">Motif du refus : {s.declineReason}</div>}
              </div>
              {s.status === "EN_ATTENTE" && r.status === "EN_ATTENTE" && (
                <div className="text-right text-sm">
                  <CopyLink url={`${base}/signer/${s.token}`} />
                  {s.email && (
                    <div className="flex flex-col items-end">
                      <form action={emailSigner.bind(null, s.id)}><button className="text-xs text-link-600 hover:underline">✉ Envoyer le lien par e-mail</button></form>
                      <a
                        href={`mailto:${s.email}?subject=${encodeURIComponent(`Document à signer : ${r.title}`)}&body=${encodeURIComponent(`Bonjour ${s.name},\n\n${r.message ? r.message + "\n\n" : ""}Vous pouvez consulter et signer le document « ${r.title} » en ligne :\n${base}/signer/${s.token}\n\nCordialement,\n${r.createdBy?.name ?? ""}`)}`}
                        className="text-xs text-link-600 hover:underline"
                      >
                        ou via votre messagerie
                      </a>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Le lien est personnel : chaque signataire signe avec le sien. Il apparaît aussi dans l'espace client si le client y a accès.
        </p>
      </Card>

      <Card title="Preuve et intégrité">
        <dl className="space-y-2 text-sm">
          <div><dt className="text-slate-500">Empreinte SHA-256 du document d'origine</dt><dd className="font-mono text-xs break-all">{r.originalHash}</dd></div>
          {r.signedHash && <div><dt className="text-slate-500">Empreinte SHA-256 du PDF signé</dt><dd className="font-mono text-xs break-all">{r.signedHash}</dd></div>}
        </dl>
      </Card>

      {r.status !== "SIGNE" && (
        <div className="text-right">
          <ConfirmButton action={deleteSignature.bind(null, id)} label="Supprimer cette demande" title="Supprimer la demande de signature ?" message="Les liens de signature ne fonctionneront plus." />
        </div>
      )}
    </div>
  );
}
