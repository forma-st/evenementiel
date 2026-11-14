import { headers } from "next/headers";
import { requireStaff } from "@/lib/auth";
import { CopyLink } from "@/components/CopyLink";
import { regenerateIcsToken } from "../../agenda/actions";
import { isMailConfigured } from "@/lib/mail";
import { isBlobConfigured } from "@/lib/storage";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Intégrations" };

function Status({ on, labelOn = "Connecté", labelOff = "Non configuré" }: { on: boolean; labelOn?: string; labelOff?: string }) {
  return <Badge className={on ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>{on ? labelOn : labelOff}</Badge>;
}

export default async function Integrations() {
  const user = await requireStaff();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const icsUrl = user.icsToken ? `${base}/api/ics/${user.icsToken}.ics` : null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div id="google" className="lg:col-span-2">
        <Card title="Google Agenda — votre agenda" actions={<Status on={!!icsUrl} labelOn="Lien créé" labelOff="À configurer" />}>
          <p className="text-sm text-slate-600">
            Affichez vos prestations et rendez-vous (là où vous êtes participant) directement dans votre Google Agenda.
            Chaque membre de l'équipe a son propre lien.
          </p>
          {icsUrl ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
                <code className="min-w-0 flex-1 truncate text-xs">{icsUrl}</code>
                <CopyLink url={icsUrl} />
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                <li>Copiez le lien ci-dessus.</li>
                <li>Dans Google Agenda (sur ordinateur), à gauche : <b>Autres agendas › + › À partir de l'URL</b>.</li>
                <li>Collez le lien puis cliquez sur <b>Ajouter un agenda</b>.</li>
              </ol>
              <p className="text-xs text-slate-500">
                Google actualise ces agendas toutes les quelques heures (ce délai est fixé par Google). Pour un ajout immédiat,
                utilisez le bouton « + Google Agenda » sur la fiche de l'événement. Ce lien est personnel : ne le partagez pas.
              </p>
              <form action={regenerateIcsToken}><button className="text-xs text-slate-500 underline hover:text-slate-800">Générer un nouveau lien (l'ancien cessera de fonctionner)</button></form>
            </div>
          ) : (
            <form action={regenerateIcsToken} className="mt-4"><button className="btn-primary">Créer mon lien Google Agenda</button></form>
          )}
        </Card>
      </div>
      <Card title="Envoi des e-mails (Resend)" actions={<Status on={isMailConfigured()} labelOff="Mode simulation" />}>
        <p className="text-sm text-slate-600">Envoi des devis, liens de signature, galeries et e-mails automatiques. Sans configuration, les e-mails sont enregistrés dans l&apos;historique de la prestation sans être envoyés.</p>
        {!isMailConfigured() && <p className="mt-2 text-sm text-slate-500">Créez un compte gratuit sur resend.com, validez votre nom de domaine, puis ajoutez dans Vercel <code>RESEND_API_KEY</code> et <code>MAIL_FROM</code> (ex. « Mon Studio &lt;contact@monstudio.fr&gt; ») et redéployez.</p>}
      </Card>
      <Card title="Stockage des photos (Vercel Blob)" actions={<Status on={isBlobConfigured()} labelOff="Disque local" />}>
        <p className="text-sm text-slate-600">Les photos et fichiers des galeries partent directement du navigateur vers le stockage, sans limite de taille.</p>
        {!isBlobConfigured() && <p className="mt-2 text-sm text-slate-500">Sur Vercel : onglet Storage › Create › Blob, puis connectez-le au projet (la variable <code>BLOB_READ_WRITE_TOKEN</code> est ajoutée seule) et redéployez. Indispensable en production : sans lui, les gros fichiers sont refusés.</p>}
      </Card>
      <Card title="Formulaire de demande et disponibilités" actions={<Status on labelOn="Actif" />}>
        <p className="text-sm text-slate-600">Lien à mettre sur votre site : <a href={`${base}/demande`} target="_blank" className="text-link-600 hover:underline">{base}/demande</a> <CopyLink url={`${base}/demande`} /></p>
        <p className="mt-2 text-sm text-slate-600">Chaque demande crée le client, la prestation « Demande » et déclenche vos automatisations (accusé de réception, questionnaire, tâche de rappel).</p>
        <p className="mt-2 text-xs text-slate-500">Disponibilité d&apos;une date pour votre site : <code>{base}/api/disponibilite?date=2027-06-12</code> renvoie <code>{"{ available: true }"}</code>.</p>
      </Card>
      <Card title="Automatisations quotidiennes" actions={<Status on={!!process.env.CRON_SECRET} labelOn="Planifiées" labelOff="À configurer" />}>
        <p className="text-sm text-slate-600">Rappels J-x, relances de devis et de paiements : vérifiés chaque matin à 8 h par Vercel Cron.</p>
        {!process.env.CRON_SECRET && <p className="mt-2 text-sm text-slate-500">Ajoutez dans Vercel une variable <code>CRON_SECRET</code> (longue chaîne aléatoire) puis redéployez.</p>}
      </Card>
      <Card title="Base INSEE (SIRENE)" actions={<Status on labelOn="Actif" />}>
        <p className="text-sm text-slate-600">
          Recherche d'entreprises et pré-remplissage des fiches clients via l'API publique de l'Annuaire des entreprises. Gratuit, sans clé.
        </p>
      </Card>
    </div>
  );
}
