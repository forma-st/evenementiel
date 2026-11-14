import { cache } from "react";
import { db } from "./db";

/**
 * Plateforme agréée (PA, ex-PDP) pour la facturation électronique.
 * Indy est immatriculé plateforme agréée, mais ne propose pas (à ce jour, d'après son support) d'API pour
 * qu'un logiciel tiers lui transmette des factures : l'échange se fait donc par fichiers (Factur-X, exports).
 * Si Indy ou une autre plateforme ouvre une API, c'est ici qu'il faudra brancher l'envoi automatique.
 */
export const PLATFORMS = {
  INDY: {
    name: "Indy",
    url: "https://app.indy.fr",
    howTo: "Téléchargez la facture (PDF Factur-X) et importez-la dans Indy, ou recréez-la dans Indy si vous facturez vos clients professionnels directement depuis Indy. Les exports du livre des recettes et des factures sont dans Comptabilité.",
  },
  AUTRE: {
    name: "votre plateforme agréée",
    url: "",
    howTo: "Déposez le PDF Factur-X (ou le XML CII) sur votre plateforme agréée. Le format Factur-X EN 16931 fait partie des formats acceptés par toutes les plateformes.",
  },
} as const;
export type PlatformId = keyof typeof PLATFORMS;

export const getEinvoiceSettings = cache(async (): Promise<{ platform: PlatformId }> => {
  const row = await db.setting.findUnique({ where: { key: "einvoice" } });
  const v = row ? (JSON.parse(row.value) as { platform?: PlatformId }) : {};
  return { platform: v.platform && v.platform in PLATFORMS ? v.platform : "INDY" };
});
