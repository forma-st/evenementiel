import { currentUser } from "@/lib/auth";
import { getCompany, getLogo } from "@/lib/company";
import { quoteToPdf } from "@/lib/pdf";
import { getPdfStyle, normalizeStyle, type PdfStyle } from "@/lib/pdfStyle";

/** Aperçu d'un devis fictif avec une mise en forme (réglages en cours ou enregistrés). */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "CLIENT") return new Response("Non autorisé", { status: 401 });
  const raw = new URL(req.url).searchParams.get("s");
  let style: PdfStyle;
  try { style = raw ? normalizeStyle(JSON.parse(raw)) : await getPdfStyle(); } catch { style = await getPdfStyle(); }
  const now = new Date();
  const pdf = await quoteToPdf(
    {
      label: "Mariage de Julie & Thomas - DJ, sonorisation et lumières", number: "DEV-2027-0042", issuedAt: now, validUntil: new Date(now.getTime() + 30 * 864e5),
      lines: [
        { label: "Formule Mariage Complète", description: "Cérémonie laïque sonorisée, vin d'honneur, repas et soirée dansante. Rendez-vous de préparation inclus.", quantity: 1, unitPrice: 1490, vatRate: 20, unit: "forfait" },
        { label: "Mise en lumière de la salle", description: "Projecteurs LED d'ambiance aux couleurs de votre décoration.", quantity: 1, unitPrice: 180, vatRate: 20, unit: "forfait" },
        { label: "Heure supplémentaire DJ", quantity: 2, unitPrice: 90, vatRate: 20, unit: "hour" },
        { label: "Frais de déplacement", quantity: 80, unitPrice: 0.6, vatRate: 20, unit: "km" },
      ],
      discount: 50, depositPercent: 30, notes: "Repas prestataire à prévoir. Prise 16 A à proximité de l'emplacement DJ.",
      client: { name: "Julie Martin & Thomas Roux", address: "4 allée des Roses", postalCode: "78000", city: "Versailles", email: "julie.martin@exemple.fr", phone: "06 11 22 33 44" },
      event: { kind: "Mariage", date: "samedi 12 juin 2027, 17:00", venue: "Domaine des Oliviers, Dampierre", guests: 120, services: "DJ / animation, Sonorisation, Éclairage" },
    },
    await getCompany(),
    await getLogo(),
    style,
  );
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="apercu-devis.pdf"', "Cache-Control": "no-store" } });
}
