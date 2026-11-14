export type FieldType =
  | "text" | "textarea" | "email" | "phone" | "number" | "date"
  | "select" | "radio" | "checkbox" | "yesno" | "section";

export type Field = {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  help?: string;
  options?: string[];
};

export const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: "text", label: "Texte court" },
  { id: "textarea", label: "Texte long" },
  { id: "email", label: "E-mail" },
  { id: "phone", label: "Téléphone" },
  { id: "number", label: "Nombre" },
  { id: "date", label: "Date" },
  { id: "select", label: "Liste déroulante" },
  { id: "radio", label: "Choix unique" },
  { id: "checkbox", label: "Choix multiples" },
  { id: "yesno", label: "Oui / Non" },
  { id: "section", label: "Titre de section" },
];

export const hasOptions = (t: FieldType) => t === "select" || t === "radio" || t === "checkbox";

export function parseFields(json: string): Field[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Valide les réponses et renvoie les erreurs par champ. */
export function validateAnswers(fields: Field[], answers: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "section") continue;
    const v = answers[f.id];
    const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) errors[f.id] = "Champ obligatoire";
    else if (!empty && f.type === "email" && !/^\S+@\S+\.\S+$/.test(String(v))) errors[f.id] = "E-mail invalide";
    else if (!empty && f.type === "number" && isNaN(Number(v))) errors[f.id] = "Nombre invalide";
  }
  return errors;
}

export function formatAnswer(f: Field, v: unknown) {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (f.type === "yesno") return v === "oui" ? "Oui" : "Non";
  return String(v);
}
