/** Mise en forme des documents PDF (Paramètres › Mise en forme des devis). */
export type PdfStyle = {
  layout: "classique" | "moderne" | "epure";
  accent: string; // #rrggbb
  font: "helvetica" | "times";
  logoPosition: "left" | "center";
  title: string; // « Devis », « Proposition commerciale »…
  intro: string; // texte d'introduction au-dessus des lignes
  showEvent: boolean;
  showDescriptions: boolean;
  showUnits: boolean;
  lineNumbers: boolean;
  showDeposit: boolean;
  showBank: boolean;
  showSignature: boolean;
  cgv: string; // conditions générales de vente, ajoutées en dernière page
  applyToInvoices: boolean; // même couleur, police et disposition pour factures et contrats
};

export const DEFAULT_STYLE: PdfStyle = {
  layout: "classique",
  accent: "#1d5fd6",
  font: "helvetica",
  logoPosition: "left",
  title: "Devis",
  intro: "",
  showEvent: true,
  showDescriptions: true,
  showUnits: true,
  lineNumbers: false,
  showDeposit: true,
  showBank: true,
  showSignature: true,
  cgv: "",
  applyToInvoices: true,
};

export const ACCENT_PRESETS = [
  ["#1d5fd6", "Bleu électrique"], ["#0f2a5c", "Bleu nuit"], ["#0e7490", "Bleu canard"], ["#0f766e", "Vert sapin"],
  ["#b45309", "Ambre"], ["#be123c", "Framboise"], ["#334155", "Ardoise"], ["#111827", "Noir"],
] as const;

export function normalizeStyle(v: Partial<PdfStyle> | null | undefined): PdfStyle {
  const s = { ...DEFAULT_STYLE, ...(v ?? {}) };
  if (!/^#[0-9a-f]{6}$/i.test(s.accent)) s.accent = DEFAULT_STYLE.accent;
  if (!["classique", "moderne", "epure"].includes(s.layout)) s.layout = "classique";
  if (!["helvetica", "times"].includes(s.font)) s.font = "helvetica";
  if (!["left", "center"].includes(s.logoPosition)) s.logoPosition = "left";
  s.title = (s.title || "Devis").slice(0, 40);
  s.intro = (s.intro || "").slice(0, 1500);
  s.cgv = (s.cgv || "").slice(0, 30000);
  return s;
}

