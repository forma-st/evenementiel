import { headers } from "next/headers";
import { requireStaff } from "@/lib/auth";
import { CopyLink } from "@/components/CopyLink";
import { regenerateIcsToken } from "../../agenda/actions";
import { isMailConfigured } from "@/lib/mail";
import { isBlobConfigured } from "@/lib/storage";
import { isStripeConfigured } from "@/lib/stripe";
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
      <Card title="Votre nom de domaine" actions={<Status on={!host.endsWith(".vercel.app") && !host.startsWith("localhost")} labelOn="Personnalisé" labelOff="Adresse Vercel" />}>
        <p className="text-sm text-slate-600">Vos clients voient vos devis, contrats, galeries et paiements sur votre propre adresse, par exemple <code>espace.monstudio.fr</code>, au lieu de <code>{host}</code>.</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-500">
          <li>Dans Vercel : projet › Settings › Domains › Add, saisissez <code>espace.votredomaine.fr</code>.</li>
          <li>Chez votre hébergeur de nom de domaine (OVH, Gandi, IONOS…) : ajoutez l&apos;enregistrement <b>CNAME</b> indiqué par Vercel (en général <code>cname.vercel-dns.com</code>).</li>
          <li>Attendez la validation (quelques minutes à quelques heures) : le certificat HTTPS est créé automatiquement.</li>
          <li>Les liens envoyés aux clients utilisent alors la nouvelle adresse. Pour la forcer, ajoutez <code>APP_URL</code> = <code>https://espace.votredomaine.fr</code> dans Vercel et redéployez.</li>
        </ol>
      </Card>
      <Card title="Paiement en ligne (Stripe)" actions={<Status on={isStripeConfigured()} labelOff="Non configuré" />}>
        <p className="text-sm text-slate-600">Vos clients règlent l&apos;acompte et le solde par carte, Apple Pay ou Google Pay depuis leur lien de paiement ou l&apos;espace client. Le règlement s&apos;enregistre tout seul, la facture passe en « payée » et vous êtes prévenu.</p>
        {!isStripeConfigured() && (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-500">
            <li>Créez un compte sur stripe.com (vérification d&apos;identité et IBAN de versement).</li>
            <li>Développeurs › Clés API : copiez la <b>clé secrète</b> dans Vercel sous <code>STRIPE_SECRET_KEY</code>.</li>
            <li>Développeurs › Webhooks › Ajouter une destination : adresse <code>{base}/api/stripe/webhook</code>, événements <code>checkout.session.completed</code> et <code>checkout.session.async_payment_succeeded</code>.</li>
            <li>Copiez le <b>secret de signature</b> du webhook dans Vercel sous <code>STRIPE_WEBHOOK_SECRET</code>, puis redéployez.</li>
          </ol>
        )}
        <p className="mt-2 text-xs text-slate-500">Sans Stripe, le lien de paiement affiche vos coordonnées de virement. Frais Stripe : environ 1,5 % + 0,25 € par carte européenne.</p>
      </Card>
      <Card title="Envoi des e-mails (Resend)" actions={<Status on={isMailConfigured()} labelOff="Mode simulation" />}>
        <p className="text-sm text-slate-600">Envoi des devis, liens de signature, galeries et e-mails automatiques. Sans configuration, les e-mails sont enregistrés dans l&apos;historique de la prestation sans être envoyés.</p>
        {!isMailConfigured() && <p className="mt-2 text-sm text-slate-500">Créez un compte gratuit sur resend.com, validez votre nom de domaine, puis ajoutez dans Vercel <code>RESEND_API_KEY</code> et <code>MAIL_FROM</code> (ex. « Mon Studio &lt;contact@monstudio.fr&gt; ») et redéployez.</p>}
      </Card>
      <Card title="Stockage des photos (Vercel Blob)" actions={<Status on={isBlobConfigured()} labelOff="Disque local" />}>
        <p className="text-sm text-slate-600">Les photos et fichiers des galeries partent directement du navigateur vers le stockage, sans limite de taille.</p>
        {!isBlobConfigured() && <p className="mt-2 text-sm text-slate-500">Sur Vercel : onglet Storage › Create › Blob (accès <b>Public</b>), connectez-le au projet en cochant Production, puis Deployments › … › Redeploy. La variable <code>BLOB_READ_WRITE_TOKEN</code> doit apparaître dans Settings › Environment Variables. Indispensable en ligne : sans lui, aucune photo ne peut être déposée.</p>}
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
