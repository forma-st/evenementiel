/* Logo de l'entreprise : celui déposé dans Paramètres > Entreprise, sinon le nom en toutes lettres. */
export function Logo({ className = "h-10" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/api/logo" alt="Logo" className={`logo w-auto max-w-[220px] object-contain ${className}`} />;
}
