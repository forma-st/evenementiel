/** Référentiels métier : types d'événements, services proposés, catégories. */

export const EVENT_KINDS = [
  { id: "MARIAGE", label: "Mariage", icon: "💍" },
  { id: "ANNIVERSAIRE", label: "Anniversaire", icon: "🎂" },
  { id: "ENTREPRISE", label: "Soirée d'entreprise", icon: "🏢" },
  { id: "BAPTEME", label: "Baptême / communion", icon: "🕊" },
  { id: "GALA", label: "Gala / remise de prix", icon: "🏆" },
  { id: "SOIREE", label: "Soirée privée", icon: "🎉" },
  { id: "CONCERT", label: "Concert / spectacle", icon: "🎤" },
  { id: "SEANCE", label: "Séance photo", icon: "📷" },
  { id: "AUTRE", label: "Autre", icon: "•" },
] as const;
export const eventKind = (id: string) => EVENT_KINDS.find((k) => k.id === id) ?? EVENT_KINDS[EVENT_KINDS.length - 1];

export const SERVICES = [
  { id: "DJ", label: "DJ / animation", icon: "🎧", color: "bg-violet-100 text-violet-800" },
  { id: "SONO", label: "Sonorisation", icon: "🔊", color: "bg-blue-100 text-blue-800" },
  { id: "LUMIERE", label: "Éclairage", icon: "💡", color: "bg-amber-100 text-amber-900" },
  { id: "PHOTO", label: "Photographie", icon: "📷", color: "bg-pink-100 text-pink-800" },
  { id: "VIDEO", label: "Vidéo", icon: "🎬", color: "bg-teal-100 text-teal-800" },
  { id: "PHOTOBOOTH", label: "Photobooth", icon: "🤳", color: "bg-orange-100 text-orange-800" },
  { id: "ANIMATION", label: "Animation / MC", icon: "🎤", color: "bg-emerald-100 text-emerald-800" },
] as const;
export const serviceOf = (id: string) => SERVICES.find((s) => s.id === id);
export const parseServices = (s: string | null | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
export const servicesLabel = (s: string | null | undefined) => parseServices(s).map((x) => serviceOf(x)?.label ?? x).join(", ");

export const CATALOG_CATEGORIES = [
  { id: "PACK", label: "Formules / packs" },
  { id: "DJ", label: "DJ / animation" },
  { id: "SONO", label: "Sonorisation" },
  { id: "LUMIERE", label: "Éclairage" },
  { id: "PHOTO", label: "Photographie" },
  { id: "VIDEO", label: "Vidéo" },
  { id: "PHOTOBOOTH", label: "Photobooth" },
  { id: "DEPLACEMENT", label: "Déplacement / logistique" },
  { id: "OPTION", label: "Options" },
] as const;
export const catalogCategory = (id: string) => CATALOG_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const EQUIPMENT_CATEGORIES = [
  { id: "SONO", label: "Sonorisation" },
  { id: "DJ", label: "Régie DJ" },
  { id: "LUMIERE", label: "Éclairage" },
  { id: "PHOTO", label: "Photo / vidéo" },
  { id: "STRUCTURE", label: "Structures / scène" },
  { id: "AUTRE", label: "Autre" },
] as const;

export const SOURCES = ["Site internet", "Instagram", "Facebook", "Mariages.net", "Bouche à oreille", "Salon du mariage", "Recommandation lieu / traiteur", "Client fidèle", "Autre"];

export const PAYMENT_METHODS = ["Virement", "Chèque", "Espèces", "Carte bancaire", "PayPal / Lydia"];
