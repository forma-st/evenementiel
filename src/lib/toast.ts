/** Notification flottante locale (confirmation d'une action), affichée par <Toaster />. Utilisable dans le navigateur uniquement. */
export type ToastTone = "success" | "info" | "error";
export function toast(title: string, opts: { body?: string; tone?: ToastTone; link?: string } = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { title, ...opts } }));
}
