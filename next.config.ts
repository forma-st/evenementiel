import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les pages :
 * - CSP : scripts et styles du site uniquement, images et envois vers Vercel Blob, aucun plugin ;
 * - le site ne peut pas être affiché dans un cadre (anti « clickjacking »), sauf le formulaire /demande ;
 * - HTTPS imposé, pas de devinette du type des fichiers, adresse des pages non transmise aux autres sites.
 */
const BLOB = "https://*.blob.vercel-storage.com";
const csp = (frame: string) =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // scripts de Next.js et sélection du thème avant affichage
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${BLOB}`,
    `media-src 'self' blob: ${BLOB}`,
    "font-src 'self' data:",
    `connect-src 'self' https://vercel.com ${BLOB}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frame}`,
    ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

const common = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/((?!demande$|api/).*)", headers: [...common, { key: "Content-Security-Policy", value: csp("'self'") }, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      // API et fichiers (PDF affichés dans l'aperçu) : pas de CSP de page, mais affichage limité au site lui-même
      { source: "/api/:path*", headers: [...common, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      // le formulaire de demande peut être intégré dans votre site (iframe)
      { source: "/demande", headers: [...common, { key: "Content-Security-Policy", value: csp("*") }] },
      // pages à lien secret : jamais indexées par les moteurs de recherche
      { source: "/(d|g|p|q|signer)/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};
export default nextConfig;
