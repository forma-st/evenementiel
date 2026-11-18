/** Règles de mot de passe : 10 caractères minimum, pas un mot de passe courant, pas l'e-mail. */
const COMMON = ["motdepasse", "password", "azertyuiop", "1234567890", "0123456789", "qwertyuiop", "soleil1234", "bonjour123", "admin12345", "motdepasse1", "password123", "azerty1234", "1234567891"];

export function passwordProblem(pw: string, email?: string | null) {
  if (pw.length < 10) return "Le mot de passe doit faire au moins 10 caractères.";
  if (pw.length > 200) return "Mot de passe trop long.";
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) return "Ce mot de passe est trop courant : choisissez-en un autre.";
  if (/^(.)\1+$/.test(pw)) return "Ce mot de passe est trop simple.";
  if (email && low.includes(email.toLowerCase().split("@")[0]) && email.split("@")[0].length >= 4) return "Le mot de passe ne doit pas contenir votre adresse e-mail.";
  return null;
}
