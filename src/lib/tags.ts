/** Couleurs proposées pour les étiquettes (classes écrites en entier pour Tailwind). */
export const TAG_COLORS: Record<string, { label: string; chip: string; dot: string }> = {
  slate: { label: "Gris", chip: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  red: { label: "Rouge", chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  orange: { label: "Orange", chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
  amber: { label: "Jaune", chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-400" },
  green: { label: "Vert", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  teal: { label: "Turquoise", chip: "bg-teal-50 text-teal-700 ring-teal-200", dot: "bg-teal-500" },
  blue: { label: "Bleu", chip: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  violet: { label: "Violet", chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  pink: { label: "Rose", chip: "bg-pink-50 text-pink-700 ring-pink-200", dot: "bg-pink-500" },
};
export const tagColor = (c: string) => TAG_COLORS[c] ?? TAG_COLORS.slate;
