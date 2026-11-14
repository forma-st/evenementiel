import { cache } from "react";
import { db } from "./db";

/** Coordonnées de l'entreprise (Paramètres > Entreprise) — utilisées dans les devis, contrats, e-mails et PDF. */
export type Company = {
  name: string;
  tagline: string;
  legal: string;
  address: string;
  siret: string;
  vat: string;
  phone: string;
  email: string;
  web: string;
  iban: string;
  bic: string;
  vatExempt: boolean; // auto-entrepreneur : « TVA non applicable, art. 293 B du CGI »
  reviewUrl: string;  // lien d'avis Google / Mariages.net envoyé après la prestation
  quoteFooter: string;
  teamChat: boolean; // messagerie d'équipe (masquée quand on travaille seul)
};

export const DEFAULT_COMPANY: Company = {
  name: "Mon Studio Événements",
  tagline: "DJ · Sonorisation · Photographie",
  legal: "",
  address: "",
  siret: "",
  vat: "",
  phone: "",
  email: "",
  web: "",
  iban: "",
  bic: "",
  vatExempt: false,
  reviewUrl: "",
  teamChat: false,
  quoteFooter: "Devis valable 30 jours. Réservation de la date à réception du contrat signé et de l'acompte.",
};

export const getCompany = cache(async (): Promise<Company> => {
  const row = await db.setting.findUnique({ where: { key: "company" } });
  return { ...DEFAULT_COMPANY, ...(row ? (JSON.parse(row.value) as Partial<Company>) : {}) };
});

/** Logo déposé dans les paramètres (data URL PNG ou JPEG), ou null. */
export const getLogo = cache(async (): Promise<string | null> => {
  const row = await db.setting.findUnique({ where: { key: "company.logo" } });
  return row?.value || null;
});
