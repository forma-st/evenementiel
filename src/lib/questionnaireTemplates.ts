import type { Field } from "./questionnaire";

/** Questionnaires prêts à l'emploi pour l'événementiel (créés au premier démarrage, modifiables). */

type Tpl = { title: string; description: string; fields: Field[] };

export const DEMANDE_DEVIS: Tpl = {
  title: "Demande de devis",
  description: "Quelques informations pour vous proposer une prestation sur mesure.",
  fields: [
    { id: "s1", type: "section", label: "Votre événement" },
    { id: "type", type: "select", label: "Type d'événement", required: true, options: ["Mariage", "Anniversaire", "Soirée d'entreprise", "Baptême / communion", "Gala", "Soirée privée", "Autre"] },
    { id: "date", type: "date", label: "Date", required: true },
    { id: "lieu", type: "text", label: "Lieu de réception (nom et ville)", required: true },
    { id: "invites", type: "number", label: "Nombre d'invités" },
    { id: "horaires", type: "text", label: "Horaires souhaités", help: "Ex. vin d'honneur 18h, fin de soirée 4h" },
    { id: "s2", type: "section", label: "Prestations souhaitées" },
    { id: "services", type: "checkbox", label: "Prestations", options: ["DJ / animation", "Sonorisation (discours, cérémonie laïque)", "Éclairage / mise en lumière", "Photographie", "Vidéo", "Photobooth"] },
    { id: "budget", type: "select", label: "Budget envisagé", options: ["Moins de 800 €", "800 à 1 500 €", "1 500 à 2 500 €", "Plus de 2 500 €", "Je ne sais pas encore"] },
    { id: "ambiance", type: "textarea", label: "Ambiance et styles de musique", help: "Années 80, latino, électro, variété française…" },
    { id: "connu", type: "select", label: "Comment nous avez-vous connus ?", options: ["Site internet", "Instagram", "Facebook", "Mariages.net", "Bouche à oreille", "Salon", "Le lieu de réception / traiteur", "Autre"] },
  ],
};

export const PREPARATION_SOIREE: Tpl = {
  title: "Préparation de votre soirée (DJ)",
  description: "Ce questionnaire nous permet de préparer votre soirée dans les moindres détails. Vous pouvez le compléter en plusieurs fois.",
  fields: [
    { id: "s1", type: "section", label: "Déroulé de la journée" },
    { id: "ceremonie", type: "yesno", label: "Faut-il sonoriser une cérémonie (laïque, discours) ?" },
    { id: "ceremonieHeure", type: "text", label: "Heure et lieu de la cérémonie" },
    { id: "vinHonneur", type: "text", label: "Vin d'honneur : horaires et lieu" },
    { id: "repas", type: "text", label: "Heure du repas" },
    { id: "deroule", type: "textarea", label: "Déroulé du repas", help: "Entrée des mariés, discours, jeux, vidéo, pièce montée, animations des invités…" },
    { id: "fin", type: "text", label: "Heure de fin de soirée" },
    { id: "s2", type: "section", label: "Les moments forts" },
    { id: "entree", type: "text", label: "Musique d'entrée dans la salle" },
    { id: "ouverture", type: "text", label: "Ouverture du bal (titre et artiste)" },
    { id: "gateau", type: "text", label: "Musique pour le gâteau / la pièce montée" },
    { id: "autres", type: "textarea", label: "Autres moments à mettre en musique" },
    { id: "s3", type: "section", label: "Votre musique" },
    { id: "styles", type: "checkbox", label: "Styles appréciés", options: ["Variété française", "Années 80", "Années 90 / 2000", "Pop / hits actuels", "Rock", "Disco / funk", "Latino / reggaeton", "Rap / RnB", "Électro / house", "Musiques du monde"] },
    { id: "incontournables", type: "textarea", label: "Vos incontournables", help: "Les titres à passer absolument." },
    { id: "interdits", type: "textarea", label: "Musiques à ne surtout pas passer" },
    { id: "playlist", type: "text", label: "Lien vers une playlist (Spotify, Deezer…)" },
    { id: "demandes", type: "yesno", label: "Accepter les demandes des invités ?" },
    { id: "s4", type: "section", label: "Informations pratiques" },
    { id: "contact", type: "text", label: "Contact le jour J (témoin, coordinatrice)", required: true },
    { id: "acces", type: "textarea", label: "Accès au lieu, stationnement, horaires d'installation", help: "Étage, ascenseur, distance du camion, contraintes de volume sonore…" },
    { id: "repasPresta", type: "yesno", label: "Un repas prestataire est-il prévu ?" },
  ],
};

export const PREPARATION_PHOTO: Tpl = {
  title: "Préparation du reportage photo",
  description: "Aidez-nous à ne rien manquer de votre journée.",
  fields: [
    { id: "s1", type: "section", label: "Le planning" },
    { id: "preparatifs", type: "text", label: "Préparatifs : heure et adresse" },
    { id: "mairie", type: "text", label: "Mairie : heure et adresse" },
    { id: "ceremonie", type: "text", label: "Cérémonie religieuse / laïque : heure et adresse" },
    { id: "couple", type: "text", label: "Séance couple : moment et lieu souhaités" },
    { id: "groupe", type: "textarea", label: "Photos de groupe à prévoir", help: "Familles, amis, témoins… par ordre de priorité." },
    { id: "s2", type: "section", label: "Vos attentes" },
    { id: "style", type: "checkbox", label: "Style recherché", options: ["Naturel / reportage", "Posé / classique", "Artistique", "Noir et blanc"] },
    { id: "important", type: "textarea", label: "Personnes ou détails importants à photographier" },
    { id: "eviter", type: "textarea", label: "Situations familiales délicates à connaître" },
    { id: "contact", type: "text", label: "Contact le jour J", required: true },
  ],
};

export const SATISFACTION: Tpl = {
  title: "Votre avis sur notre prestation",
  description: "Merci de nous avoir fait confiance ! Votre avis nous aide à progresser.",
  fields: [
    { id: "note", type: "radio", label: "Note globale", required: true, options: ["5 — Excellent", "4 — Très bien", "3 — Bien", "2 — Moyen", "1 — Décevant"] },
    { id: "musique", type: "radio", label: "Choix musical / qualité des photos", options: ["Parfait", "Bien", "À améliorer"] },
    { id: "contact", type: "radio", label: "Relation et organisation", options: ["Parfait", "Bien", "À améliorer"] },
    { id: "recommande", type: "yesno", label: "Nous recommanderiez-vous ?" },
    { id: "commentaire", type: "textarea", label: "Un mot sur votre expérience", help: "Il pourra être publié sur notre site (avec votre accord)." },
    { id: "publication", type: "yesno", label: "J'accepte que mon avis soit publié" },
  ],
};

export const QUESTIONNAIRE_TEMPLATES = {
  "demande-devis": DEMANDE_DEVIS,
  "preparation-soiree": PREPARATION_SOIREE,
  "preparation-photo": PREPARATION_PHOTO,
  satisfaction: SATISFACTION,
} as const;
