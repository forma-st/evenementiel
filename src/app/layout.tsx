import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Figtree, Outfit } from "next/font/google";
import { THEME_SCRIPT } from "@/components/ThemeSwitch";

// polices servies par le site lui-même (pas d'appel à Google au chargement)
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Studio Événements", template: "%s · Studio Événements" },
  description: "Devis, contrats, agenda, galeries photo et automatisations pour DJ, sonorisation et photographes",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f6fb" }, { media: "(prefers-color-scheme: dark)", color: "#0a101c" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="system" className={`${figtree.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
