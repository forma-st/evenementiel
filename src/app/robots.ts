import type { MetadataRoute } from "next";

/** Seul le formulaire de demande de devis peut être indexé ; tout le reste est privé. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/demande", disallow: "/" }] };
}
