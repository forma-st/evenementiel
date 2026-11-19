/**
 * Contenu proposé au premier démarrage : modèles d'e-mails, de contrats, catalogue et automatisations.
 * Tout est modifiable ensuite dans l'application. Les contrats sont des bases de travail :
 * faites-les relire par un juriste avant de les utiliser.
 */
import type { AutomationAction } from "./automations";

export const DEFAULT_EMAILS: { key: string; name: string; subject: string; body: string }[] = [
  {
    key: "accuse",
    name: "Accusé de réception de la demande",
    subject: "Votre demande pour le {{prestation.date}}",
    body: `Bonjour {{client.nom}},

Merci pour votre demande ! Nous avons bien noté votre {{prestation.type}} du {{prestation.date}}{{prestation.lieu_suffixe}}.

Nous revenons vers vous sous 48 heures avec une proposition sur mesure. Pour la préparer au mieux, vous pouvez déjà compléter ce court questionnaire :
{{lien.questionnaire}}

À très vite,
{{responsable}} — {{societe.nom}}
{{societe.telephone}}`,
  },
  {
    key: "devis",
    name: "Envoi du devis",
    subject: "Votre devis {{devis.numero}} — {{prestation.type}} du {{prestation.date}}",
    body: `Bonjour {{client.nom}},

Comme convenu, voici notre proposition pour votre {{prestation.type}} du {{prestation.date}} :
{{lien.devis}}

Vous pouvez la consulter, la télécharger en PDF et l'accepter en ligne. La date est réservée à réception du contrat signé et de l'acompte.

Je reste disponible pour en discuter, par téléphone ou autour d'un café.

{{responsable}} — {{societe.nom}}
{{societe.telephone}}`,
  },
  {
    key: "relance-devis",
    name: "Relance devis sans réponse",
    subject: "Votre date du {{prestation.date}} est-elle toujours d'actualité ?",
    body: `Bonjour {{client.nom}},

Je me permets de revenir vers vous au sujet de notre proposition pour le {{prestation.date}} :
{{lien.devis}}

Avez-vous pu la consulter ? Je peux l'ajuster si besoin (formule, options, budget). Je ne peux en revanche pas garantir la disponibilité de la date très longtemps : n'hésitez pas à me dire où vous en êtes.

Belle journée,
{{responsable}} — {{societe.nom}}`,
  },
  {
    key: "confirmation",
    name: "Confirmation de réservation",
    subject: "C'est réservé ! Votre {{prestation.type}} du {{prestation.date}}",
    body: `Bonjour {{client.nom}},

Excellente nouvelle : votre date du {{prestation.date}} est désormais réservée.

Récapitulatif :
- Lieu : {{prestation.lieu}} {{prestation.adresse_lieu}}
- Prestations : {{prestation.services}}
- Acompte : {{acompte}} — Solde : {{solde}}, à régler au plus tard 7 jours avant l'événement.

Régler l'acompte en ligne (carte ou virement) : {{lien.paiement}}

Votre espace client vous permet de retrouver vos documents, de suivre vos paiements et de préparer la soirée avec nous :
{{lien.portail}}

Merci pour votre confiance !
{{responsable}} — {{societe.nom}}`,
  },
  {
    key: "preparation",
    name: "J-45 : préparation de la soirée",
    subject: "Préparons ensemble votre {{prestation.type}}",
    body: `Bonjour {{client.nom}},

Plus que {{prestation.jours_restants}} jours avant le grand jour !

Il est temps de préparer le déroulé et la musique. Merci de compléter ce questionnaire (vous pouvez y revenir autant de fois que nécessaire) :
{{lien.questionnaire}}

Je vous proposerai ensuite un rendez-vous téléphonique pour tout caler ensemble.

{{responsable}} — {{societe.nom}}`,
  },
  {
    key: "rappel-solde",
    name: "Rappel du solde",
    subject: "Rappel : solde de votre prestation du {{prestation.date}}",
    body: `Bonjour {{client.nom}},

Votre événement approche ! Pour rappel, le solde de {{solde}} est à régler au plus tard 7 jours avant la prestation.

Régler en ligne (carte ou virement) : {{lien.paiement}}

Si c'est déjà fait, merci et ne tenez pas compte de ce message.

{{responsable}} — {{societe.nom}}`,
  },
  {
    key: "j-3",
    name: "J-3 : dernières informations",
    subject: "J-3 : tout est prêt pour le {{prestation.date}}",
    body: `Bonjour {{client.nom}},

Tout est prêt de notre côté ! Petit récapitulatif :
- Installation à partir de {{prestation.installation}} au {{prestation.lieu}}
- Début de la prestation : {{prestation.heure_debut}}
- Contact sur place : {{prestation.contact_lieu}}

En cas d'imprévu le jour J, joignez-moi au {{societe.telephone}}.

Profitez bien de ces derniers jours de préparation !
{{responsable}} — {{societe.nom}}`,
  },
  {
    key: "merci",
    name: "J+2 : remerciements et avis",
    subject: "Merci pour votre confiance !",
    body: `Bonjour {{client.nom}},

Merci encore de nous avoir fait confiance pour votre {{prestation.type}}. Nous espérons que vous en gardez un souvenir aussi beau que le nôtre !

Si vous avez été satisfaits, un petit avis nous aiderait énormément :
{{lien.avis}}

À bientôt,
{{responsable}} — {{societe.nom}}`,
  },
  {
    key: "galerie",
    name: "Galerie photos disponible",
    subject: "Vos photos sont prêtes ! 📷",
    body: `Bonjour {{client.nom}},

Vos photos sont disponibles dans votre galerie privée :
{{lien.galerie}}
Code d'accès : {{lien.galerie_code}}

Vous pouvez les télécharger, et marquer vos préférées d'un cœur (pour un album ou des tirages). Pensez à sauvegarder vos photos : la galerie restera en ligne pendant une durée limitée.

Belle redécouverte de votre journée !
{{responsable}} — {{societe.nom}}`,
  },
  {
    key: "paiement-retard",
    name: "Relance paiement en retard",
    subject: "Paiement en attente — {{prestation.reference}}",
    body: `Bonjour {{client.nom}},

Sauf erreur de notre part, nous n'avons pas encore reçu votre dernier règlement pour la prestation du {{prestation.date}}.

Régler en ligne (carte ou virement) : {{lien.paiement}}
Votre échéancier : {{lien.portail}}

Merci d'avance,
{{societe.nom}}`,
  },
];

export const CONTRACT_DJ = `# Contrat de prestation DJ et sonorisation

**Entre les soussignés**
{{societe.nom}}, {{societe.adresse}}, SIRET {{societe.siret}}, ci-après « le Prestataire »,
et {{client.nom}}, {{client.adresse}}, ci-après « le Client ».

## Article 1 - Objet
Le Prestataire s'engage à assurer une prestation d'animation musicale et de sonorisation lors de l'événement suivant :
- Type d'événement : {{prestation.type}}
- Date : {{prestation.date}}
- Horaires : de {{prestation.heure_debut}} à {{prestation.heure_fin}} (installation à partir de {{prestation.installation}})
- Lieu : {{prestation.lieu}}, {{prestation.adresse_lieu}}
- Nombre d'invités prévu : {{prestation.invites}}
- Prestations : {{prestation.services}}

## Article 2 - Prix et modalités de paiement
Le prix de la prestation est fixé à {{devis.total_ttc}} TTC, selon le devis n° {{devis.numero}} annexé au présent contrat.
- Un acompte de {{acompte}} ({{acompte.pourcentage}}) est versé à la signature du contrat. La date n'est réservée qu'à réception de cet acompte.
- Le solde de {{solde}} est réglé au plus tard 7 jours avant la date de l'événement.
Tout dépassement horaire demandé par le Client le jour de l'événement est facturé selon le tarif horaire en vigueur.

## Article 3 - Obligations du Prestataire
Le Prestataire fournit le matériel de sonorisation et d'éclairage prévu au devis, en bon état de fonctionnement, ainsi que la musique diffusée. Il prépare la soirée avec le Client (déroulé, choix musicaux) et adapte l'animation à l'ambiance de l'événement.

## Article 4 - Obligations du Client
Le Client s'engage à :
- garantir l'accès au lieu aux horaires d'installation et de démontage, avec un accès véhicule à proximité ;
- mettre à disposition une alimentation électrique adaptée (prise 16 A dédiée à proximité de l'emplacement) et un emplacement abrité ;
- informer le Prestataire de toute contrainte du lieu (limiteur de son, horaires de fin, étage) ;
- prévoir un repas pour le personnel du Prestataire lorsque la prestation inclut le temps du repas ;
- être responsable du comportement de ses invités : toute dégradation du matériel par un invité sera facturée au Client.

## Article 5 - Droits d'auteur (SACEM)
Les déclarations et redevances SACEM / SPRE liées à la diffusion de musique lors de l'événement sont à la charge de l'organisateur ou du lieu de réception, sauf mention contraire au devis.

## Article 6 - Annulation
En cas d'annulation par le Client, l'acompte reste acquis au Prestataire. Si l'annulation intervient moins de 30 jours avant l'événement, la totalité du prix est due.
En cas d'impossibilité pour le Prestataire d'assurer la prestation (maladie, accident), il s'engage à proposer un remplaçant de qualité équivalente, ou à défaut à rembourser l'intégralité des sommes versées.

## Article 7 - Force majeure
Aucune des parties ne pourra être tenue responsable d'un manquement dû à un cas de force majeure au sens de l'article 1218 du Code civil. Les sommes versées sont alors reportées sur une nouvelle date ou remboursées.

## Article 8 - Litiges
Le présent contrat est soumis au droit français. En cas de litige, les parties rechercheront une solution amiable avant toute action. Le Client consommateur peut recourir gratuitement à un médiateur de la consommation.

Fait le {{date_du_jour}}, en version électronique.
`;

export const CONTRACT_PHOTO = `# Contrat de prestation photographique

**Entre les soussignés**
{{societe.nom}}, {{societe.adresse}}, SIRET {{societe.siret}}, ci-après « le Photographe »,
et {{client.nom}}, {{client.adresse}}, ci-après « le Client ».

## Article 1 - Objet
Le Photographe réalise un reportage photographique lors de l'événement suivant :
- Type d'événement : {{prestation.type}}
- Date : {{prestation.date}}, de {{prestation.heure_debut}} à {{prestation.heure_fin}}
- Lieu : {{prestation.lieu}}, {{prestation.adresse_lieu}}
- Prestations : {{prestation.services}}

## Article 2 - Prix et paiement
Le prix est fixé à {{devis.total_ttc}} TTC selon le devis n° {{devis.numero}} annexé.
- Acompte de {{acompte}} ({{acompte.pourcentage}}) à la signature : la date est réservée à réception.
- Solde de {{solde}} au plus tard 7 jours avant l'événement.

## Article 3 - Livraison
Les photographies sont sélectionnées et retouchées par le Photographe, qui reste seul juge des choix artistiques. Elles sont livrées en haute définition dans une galerie en ligne privée, dans un délai de 6 semaines après l'événement. La galerie reste accessible 3 mois : il appartient au Client de sauvegarder ses fichiers. Les fichiers bruts (RAW) ne sont pas remis.

## Article 4 - Droits d'auteur et droit à l'image
Le Photographe reste titulaire des droits d'auteur sur les photographies (Code de la propriété intellectuelle). Il concède au Client un droit d'usage privé et familial (tirages, partage avec les proches, réseaux sociaux personnels, en citant le Photographe). Toute utilisation commerciale nécessite un accord écrit.
Le Client autorise le Photographe à utiliser une sélection de photographies pour sa communication (site, réseaux sociaux, salons) :
- [ ] Oui      - [ ] Non      - [ ] Oui, sans visage reconnaissable
Le Client se charge d'informer ses invités de la présence d'un photographe.

## Article 5 - Obligations du Client
Le Client communique le planning de la journée et les photos de groupe souhaitées au plus tard 15 jours avant l'événement, et prévoit un repas pour le Photographe lorsque la prestation inclut le temps du repas.

## Article 6 - Annulation
En cas d'annulation par le Client, l'acompte reste acquis. Si l'annulation intervient moins de 30 jours avant l'événement, la totalité du prix est due. En cas d'empêchement du Photographe, celui-ci propose un confrère de qualité équivalente ou rembourse les sommes versées.

## Article 7 - Responsabilité
En cas de perte ou de destruction accidentelle des fichiers avant leur livraison (défaillance matérielle, vol), la responsabilité du Photographe est limitée au remboursement des sommes versées.

## Article 8 - Litiges
Contrat soumis au droit français. Recherche d'une solution amiable avant toute action ; le Client consommateur peut recourir gratuitement à un médiateur de la consommation.

Fait le {{date_du_jour}}, en version électronique.
`;

export const CONTRACT_LOCATION = `# Contrat de location de matériel de sonorisation

**Entre** {{societe.nom}} ({{societe.adresse}}, SIRET {{societe.siret}}), « le Loueur »,
**et** {{client.nom}} ({{client.adresse}}), « le Locataire ».

## Article 1 - Objet
Location du matériel décrit au devis n° {{devis.numero}} annexé, pour l'événement du {{prestation.date}} à {{prestation.lieu}}.

## Article 2 - Prix, caution
Prix de la location : {{devis.total_ttc}} TTC. Un dépôt de garantie, dont le montant est indiqué au devis, est remis au retrait du matériel et restitué au retour après vérification.

## Article 3 - Retrait, retour, utilisation
Le matériel est vérifié contradictoirement au retrait et au retour. Le Locataire l'utilise en bon père de famille, à l'abri des intempéries, sans le modifier ni le sous-louer. Tout retard de retour est facturé par journée supplémentaire.

## Article 4 - Responsabilité
Le Locataire est responsable du matériel du retrait jusqu'au retour. Toute casse, perte ou vol est facturé au prix de remplacement, déduction faite du dépôt de garantie.

## Article 5 - Annulation
Annulation moins de 7 jours avant la date : 50 % du prix reste dû.

Fait le {{date_du_jour}}, en version électronique.
`;

export const DEFAULT_CONTRACTS = [
  { name: "Contrat DJ / animation et sonorisation", body: CONTRACT_DJ, services: "DJ,SONO,LUMIERE,ANIMATION,PHOTOBOOTH" },
  { name: "Contrat photographe", body: CONTRACT_PHOTO, services: "PHOTO,VIDEO" },
  { name: "Contrat de location de matériel", body: CONTRACT_LOCATION, services: "SONO" },
];

export const DEFAULT_CATALOG = [
  { category: "PACK", label: "Formule Soirée — DJ + sono + lumières", description: "DJ de 20h à 3h, sonorisation adaptée jusqu'à 200 personnes, jeux de lumières dansants, micro sans fil.", unit: "forfait", unitPrice: 990 },
  { category: "PACK", label: "Formule Mariage Complète", description: "Cérémonie laïque sonorisée, vin d'honneur, repas et soirée dansante. Rendez-vous de préparation inclus.", unit: "forfait", unitPrice: 1490 },
  { category: "PACK", label: "Formule Photo Reportage — journée", description: "De la préparation à la première danse (10 h). 400 photos retouchées minimum en galerie privée.", unit: "forfait", unitPrice: 1690 },
  { category: "DJ", label: "Heure supplémentaire DJ", unit: "hour", unitPrice: 90 },
  { category: "SONO", label: "Sonorisation cérémonie laïque", description: "Enceintes autonomes, 2 micros sans fil, lecture des musiques.", unit: "forfait", unitPrice: 190 },
  { category: "SONO", label: "Sonorisation vin d'honneur (2e espace)", unit: "forfait", unitPrice: 150 },
  { category: "SONO", label: "Location sono 2 x 1000 W (sans technicien)", unit: "day", unitPrice: 120 },
  { category: "LUMIERE", label: "Mise en lumière de la salle (projecteurs LED d'ambiance)", unit: "forfait", unitPrice: 180 },
  { category: "LUMIERE", label: "Machine à fumée lourde (première danse)", unit: "forfait", unitPrice: 120 },
  { category: "PHOTO", label: "Séance engagement / couple", description: "1 h 30, 60 photos retouchées.", unit: "forfait", unitPrice: 250 },
  { category: "PHOTO", label: "Heure de reportage supplémentaire", unit: "hour", unitPrice: 120 },
  { category: "PHOTO", label: "Album photo 30 x 30, 40 pages", unit: "piece", unitPrice: 390 },
  { category: "PHOTOBOOTH", label: "Photobooth avec impressions illimitées", unit: "forfait", unitPrice: 390 },
  { category: "VIDEO", label: "Film souvenir 5 minutes", unit: "forfait", unitPrice: 890 },
  { category: "DEPLACEMENT", label: "Frais de déplacement", description: "Au-delà de 50 km du siège.", unit: "km", unitPrice: 0.6 },
  { category: "OPTION", label: "Remise fidélité / partenaire", unit: "forfait", unitPrice: -50 },
];

export const DEFAULT_EQUIPMENT = [
  { name: "Enceinte active 12\" 1000 W", category: "SONO", quantity: 4 },
  { name: "Caisson de basses 18\"", category: "SONO", quantity: 2 },
  { name: "Enceinte autonome sur batterie", category: "SONO", quantity: 2 },
  { name: "Micro sans fil HF", category: "SONO", quantity: 4 },
  { name: "Contrôleur DJ / platines", category: "DJ", quantity: 2 },
  { name: "Ordinateur DJ de secours", category: "DJ", quantity: 1 },
  { name: "Projecteur LED par 64", category: "LUMIERE", quantity: 12 },
  { name: "Lyre asservie", category: "LUMIERE", quantity: 4 },
  { name: "Machine à fumée lourde", category: "LUMIERE", quantity: 1 },
  { name: "Boîtier photo + optiques", category: "PHOTO", quantity: 2 },
  { name: "Borne photobooth", category: "PHOTO", quantity: 1 },
  { name: "Façade DJ / booth", category: "STRUCTURE", quantity: 2 },
];

type RuleDef = { name: string; trigger: string; toStatus?: string; offsetDays?: number; onlyStatuses?: string; eventTypes?: string; actions: AutomationAction[] };

/** Règles proposées (identifiants des modèles d'e-mail et questionnaires créés juste avant). */
export function defaultRules(ids: { email: Record<string, string>; demande: string | null; prepaDj: string | null; satisfaction: string | null }): RuleDef[] {
  const mail = (k: string): AutomationAction[] => (ids.email[k] ? [{ kind: "SEND_EMAIL", templateId: ids.email[k] }] : []);
  const q = (id: string | null): AutomationAction[] => (id ? [{ kind: "SEND_QUESTIONNAIRE", questionnaireId: id }] : []);
  return [
    {
      name: "Nouvelle demande : accusé de réception",
      trigger: "STATUS", toStatus: "DEMANDE",
      actions: [
        ...q(ids.demande),
        ...mail("accuse"),
        { kind: "CREATE_TASK", title: "Rappeler {{client.nom}} et préparer le devis", type: "APPEL", priority: "HAUTE", dueInDays: 1, assignTo: "DOSSIER_ASSIGNEE" },
      ],
    },
    {
      name: "Devis sans réponse depuis 7 jours : relance",
      trigger: "QUOTE_NO_REPLY", offsetDays: 7,
      actions: [...mail("relance-devis"), { kind: "CREATE_TASK", title: "Appeler {{client.nom}} : devis sans réponse", type: "RELANCE", priority: "NORMALE", dueInDays: 3, assignTo: "DOSSIER_ASSIGNEE" }],
    },
    {
      name: "Devis accepté : envoyer le contrat",
      trigger: "QUOTE_ACCEPTED",
      actions: [
        { kind: "SET_STATUS", status: "OPTION" },
        { kind: "CREATE_TASK", title: "Générer et envoyer le contrat à {{client.nom}}", type: "EMAIL", priority: "HAUTE", dueInDays: 0, assignTo: "DOSSIER_ASSIGNEE" },
      ],
    },
    {
      name: "Contrat signé : réservation confirmée",
      trigger: "CONTRACT_SIGNED",
      actions: [{ kind: "SET_STATUS", status: "CONFIRME" }],
    },
    {
      name: "Prestation confirmée : échéancier et confirmation",
      trigger: "STATUS", toStatus: "CONFIRME",
      actions: [
        { kind: "CREATE_PAYMENTS", balanceDaysBefore: 7 },
        ...mail("confirmation"),
        { kind: "POST_CHANNEL", message: "🎉 Nouvelle date réservée : {{prestation.titre}} le {{prestation.date}} ({{responsable}})" },
      ],
    },
    {
      name: "J-45 : préparation de la soirée",
      trigger: "EVENT_OFFSET", offsetDays: -45, onlyStatuses: "CONFIRME",
      actions: [
        ...q(ids.prepaDj),
        ...mail("preparation"),
        { kind: "CREATE_TASK", title: "Planifier le rendez-vous de préparation avec {{client.nom}}", type: "RDV", priority: "NORMALE", dueInDays: 7, assignTo: "DOSSIER_ASSIGNEE" },
      ],
    },
    {
      name: "J-14 : rappel du solde",
      trigger: "EVENT_OFFSET", offsetDays: -14, onlyStatuses: "CONFIRME",
      actions: [...mail("rappel-solde")],
    },
    {
      name: "J-7 : appel de calage et check-list matériel",
      trigger: "EVENT_OFFSET", offsetDays: -7, onlyStatuses: "CONFIRME",
      actions: [
        { kind: "CREATE_TASK", title: "Appel de calage final avec {{client.nom}}", type: "APPEL", priority: "HAUTE", dueInDays: 1, assignTo: "DOSSIER_ASSIGNEE" },
        { kind: "CREATE_TASK", title: "Préparer et tester le matériel ({{prestation.reference}})", type: "TACHE", priority: "HAUTE", dueInDays: 5, assignTo: "DOSSIER_ASSIGNEE" },
      ],
    },
    {
      name: "J-3 : dernières informations au client",
      trigger: "EVENT_OFFSET", offsetDays: -3, onlyStatuses: "CONFIRME",
      actions: [...mail("j-3")],
    },
    {
      name: "J+2 : remerciements et demande d'avis",
      trigger: "EVENT_OFFSET", offsetDays: 2, onlyStatuses: "CONFIRME,REALISE",
      actions: [...mail("merci"), ...q(ids.satisfaction)],
    },
    {
      name: "Galerie publiée : prévenir le client",
      trigger: "GALLERY_PUBLISHED",
      actions: [...mail("galerie")],
    },
    {
      name: "Paiement en retard de 3 jours : relance",
      trigger: "PAYMENT_LATE", offsetDays: 3,
      actions: [...mail("paiement-retard"), { kind: "NOTIFY", to: "MANAGERS", message: "Paiement en retard : {{client.nom}} ({{prestation.reference}})" }],
    },
    {
      name: "Prestation perdue : noter la raison",
      trigger: "STATUS", toStatus: "PERDU",
      actions: [{ kind: "CREATE_TASK", title: "Noter la raison de la perte ({{prestation.reference}})", type: "TACHE", priority: "BASSE", dueInDays: 2, assignTo: "CLIENT_OWNER" }],
    },
  ];
}
