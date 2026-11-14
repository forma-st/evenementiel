import { AFRelationship, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { db } from "./db";
import { getCompany, getLogo, type Company } from "./company";
import { type QuoteLine, parseLines, totals } from "./quotes";
import { date, TZ } from "./format";
import { eventKind } from "./presta";
import { invoiceToPdf } from "./pdf";

export const INVOICE_KINDS: Record<string, { label: string; code: string }> = {
  FACTURE: { label: "Facture", code: "380" },
  ACOMPTE: { label: "Facture d'acompte", code: "386" },
  AVOIR: { label: "Avoir", code: "381" },
};

export const INVOICE_STATUSES: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  EMISE: { label: "Émise", color: "bg-blue-100 text-blue-700" },
  PAYEE: { label: "Payée", color: "bg-emerald-100 text-emerald-700" },
  ANNULEE: { label: "Annulée (avoir)", color: "bg-zinc-200 text-zinc-600" },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Montants d'une facture : lignes, remise, TVA (0 en franchise), acomptes déduits. */
export function invoiceTotals(lines: QuoteLine[], discount: number, vatExempt: boolean) {
  const ls = vatExempt ? lines.map((l) => ({ ...l, vatRate: 0 })) : lines;
  const t = totals(ls, discount);
  return { ...t, lines: ls };
}

/** Taux de TVA -> base et montant, avec la remise répartie (pour le PDF et le Factur-X). */
export function vatBreakdown(lines: QuoteLine[], discount: number) {
  const gross = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const ratio = gross > 0 ? Math.max(0, gross - discount) / gross : 1;
  const map = new Map<number, { gross: number; base: number; vat: number }>();
  for (const l of lines) {
    const g = l.quantity * l.unitPrice;
    const m = map.get(l.vatRate) ?? { gross: 0, base: 0, vat: 0 };
    m.gross += g;
    m.base += g * ratio;
    m.vat += g * ratio * (l.vatRate / 100);
    map.set(l.vatRate, m);
  }
  return [...map.entries()].map(([rate, v]) => ({ rate, gross: r2(v.gross), allowance: r2(v.gross - v.base), base: r2(v.base), vat: r2(v.vat) }));
}

export type PartySnapshot = { name: string; address: string; postalCode: string; city: string; country: string; siren: string; siret: string; vat: string; email: string; isCompany: boolean };

export function sellerSnapshot(c: Company): PartySnapshot {
  const m = c.address.match(/^(.*?)[,\s]+(\d{5})\s+(.+)$/);
  return {
    name: c.name, address: m ? m[1] : c.address, postalCode: m ? m[2] : "", city: m ? m[3] : "", country: "FR",
    siren: c.siret.replace(/\s/g, "").slice(0, 9), siret: c.siret.replace(/\s/g, ""), vat: c.vat, email: c.email, isCompany: true,
  };
}

export function buyerSnapshot(cl: { name: string; type: string; address: string | null; postalCode: string | null; city: string | null; country: string; siren: string | null; siret: string | null; vatNumber: string | null; email: string | null }): PartySnapshot {
  return {
    name: cl.name, address: cl.address ?? "", postalCode: cl.postalCode ?? "", city: cl.city ?? "", country: cl.country || "FR",
    siren: cl.siren ?? "", siret: cl.siret ?? "", vat: cl.vatNumber ?? "", email: cl.email ?? "", isCompany: cl.type === "COMPANY",
  };
}

/* ---------- Factur-X (CII, profil EN 16931) ---------- */

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const d102 = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).replace(/-/g, "");
const a = (n: number) => n.toFixed(2);
const UNIT: Record<string, string> = { forfait: "C62", piece: "C62", hour: "HUR", day: "DAY", km: "KMT", person: "C62" };

function party(tag: string, p: PartySnapshot) {
  return `<ram:${tag}><ram:Name>${esc(p.name)}</ram:Name>${p.siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(p.siren)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}<ram:PostalTradeAddress>${p.postalCode ? `<ram:PostcodeCode>${esc(p.postalCode)}</ram:PostcodeCode>` : ""}${p.address ? `<ram:LineOne>${esc(p.address)}</ram:LineOne>` : ""}${p.city ? `<ram:CityName>${esc(p.city)}</ram:CityName>` : ""}<ram:CountryID>${esc(p.country || "FR")}</ram:CountryID></ram:PostalTradeAddress>${p.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}${p.vat ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.vat)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}</ram:${tag}>`;
}

export function facturXml(inv: {
  number: string; kind: string; issueDate: Date; dueDate: Date | null; serviceDate: Date | null; label: string; lines: QuoteLine[]; discount: number; deducted: number; notes: string | null;
  seller: PartySnapshot; buyer: PartySnapshot; vatExempt: boolean; iban: string; quoteNumber?: string | null;
}) {
  const cat = (rate: number) => (inv.vatExempt ? "E" : rate === 0 ? "Z" : "S");
  const exempt = inv.vatExempt ? "<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>" : "";
  const vb = vatBreakdown(inv.lines, inv.discount);
  const lineTotal = r2(inv.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const base = r2(vb.reduce((s, v) => s + v.base, 0));
  const vat = r2(vb.reduce((s, v) => s + v.vat, 0));
  const grand = r2(base + vat);
  const items = inv.lines.map((l, i) => `<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>${esc(l.label)}</ram:Name>${l.description ? `<ram:Description>${esc(l.description)}</ram:Description>` : ""}</ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${a(l.unitPrice)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${UNIT[l.unit ?? "forfait"] ?? "C62"}">${l.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat(l.vatRate)}</ram:CategoryCode><ram:RateApplicablePercent>${inv.vatExempt ? 0 : l.vatRate}</ram:RateApplicablePercent></ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${a(l.quantity * l.unitPrice)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`).join("");
  const taxes = vb.map((v) => `<ram:ApplicableTradeTax><ram:CalculatedAmount>${a(v.vat)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>${exempt}<ram:BasisAmount>${a(v.base)}</ram:BasisAmount><ram:CategoryCode>${cat(v.rate)}</ram:CategoryCode><ram:RateApplicablePercent>${inv.vatExempt ? 0 : v.rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`).join("");
  const allowances = vb.filter((v) => v.allowance > 0).map((v) => `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator><ram:ActualAmount>${a(v.allowance)}</ram:ActualAmount><ram:Reason>Remise</ram:Reason><ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat(v.rate)}</ram:CategoryCode><ram:RateApplicablePercent>${inv.vatExempt ? 0 : v.rate}</ram:RateApplicablePercent></ram:CategoryTradeTax></ram:SpecifiedTradeAllowanceCharge>`).join("");
  const notes = [inv.notes, inv.vatExempt ? "TVA non applicable, art. 293 B du CGI" : null].filter(Boolean).map((n) => `<ram:IncludedNote><ram:Content>${esc(n!)}</ram:Content></ram:IncludedNote>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"><rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext><rsm:ExchangedDocument><ram:ID>${esc(inv.number)}</ram:ID><ram:TypeCode>${INVOICE_KINDS[inv.kind]?.code ?? "380"}</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${d102(inv.issueDate)}</udt:DateTimeString></ram:IssueDateTime>${notes}</rsm:ExchangedDocument><rsm:SupplyChainTradeTransaction>${items}<ram:ApplicableHeaderTradeAgreement>${party("SellerTradeParty", inv.seller)}${party("BuyerTradeParty", inv.buyer)}${inv.quoteNumber ? `<ram:BuyerOrderReferencedDocument><ram:IssuerAssignedID>${esc(inv.quoteNumber)}</ram:IssuerAssignedID></ram:BuyerOrderReferencedDocument>` : ""}</ram:ApplicableHeaderTradeAgreement><ram:ApplicableHeaderTradeDelivery>${inv.serviceDate ? `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${d102(inv.serviceDate)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>` : ""}</ram:ApplicableHeaderTradeDelivery><ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${inv.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(inv.iban.replace(/\s/g, ""))}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>` : ""}${taxes}${allowances}<ram:SpecifiedTradePaymentTerms>${inv.dueDate ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${d102(inv.dueDate)}</udt:DateTimeString></ram:DueDateDateTime>` : "<ram:Description>À réception</ram:Description>"}</ram:SpecifiedTradePaymentTerms><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${a(lineTotal)}</ram:LineTotalAmount>${inv.discount > 0 ? `<ram:AllowanceTotalAmount>${a(lineTotal - base)}</ram:AllowanceTotalAmount>` : ""}<ram:TaxBasisTotalAmount>${a(base)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${a(vat)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${a(grand)}</ram:GrandTotalAmount>${inv.deducted > 0 ? `<ram:TotalPrepaidAmount>${a(inv.deducted)}</ram:TotalPrepaidAmount>` : ""}<ram:DuePayableAmount>${a(grand - inv.deducted)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;
}

/** Ajoute le XML Factur-X au PDF (pièce jointe « factur-x.xml » + métadonnées XMP Factur-X). */
export async function embedFacturX(pdf: Uint8Array, xml: string, number: string) {
  const doc = await PDFDocument.load(pdf);
  const now = new Date();
  await doc.attach(Buffer.from(xml, "utf8"), "factur-x.xml", { mimeType: "text/xml", description: "Factur-X EN 16931", creationDate: now, modificationDate: now, afRelationship: AFRelationship.Data });
  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Facture ${esc(number)}</rdf:li></rdf:Alt></dc:title></rdf:Description><rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description><rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"><pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix><pdfaSchema:property><rdf:Seq>${["DocumentFileName", "DocumentType", "Version", "ConformanceLevel"].map((n) => `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${n}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${n}</pdfaProperty:description></rdf:li>`).join("")}</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const meta = doc.context.stream(xmp, { Type: "Metadata", Subtype: "XML" });
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(meta));
  doc.setTitle(`Facture ${number}`);
  doc.catalog.set(PDFName.of("Lang"), PDFString.of("fr-FR"));
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/** PDF + XML d'une facture (les factures émises utilisent les coordonnées figées à l'émission). */
export async function buildInvoiceFiles(id: string) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { client: true, dossier: true, quote: { select: { number: true } } } });
  const c = await getCompany();
  const seller: PartySnapshot = inv.seller ? JSON.parse(inv.seller) : sellerSnapshot(c);
  const buyer: PartySnapshot = inv.buyer ? JSON.parse(inv.buyer) : buyerSnapshot(inv.client);
  const lines = parseLines(inv.lines);
  const vatExempt = lines.every((l) => l.vatRate === 0) && c.vatExempt;
  const number = inv.number ?? "BROUILLON";
  const credited = inv.creditOfId ? await db.invoice.findUnique({ where: { id: inv.creditOfId }, select: { number: true, issueDate: true } }) : null;
  const pdf = await invoiceToPdf(
    {
      kind: inv.kind, kindLabel: INVOICE_KINDS[inv.kind].label, number, draft: !inv.number, issueDate: inv.issueDate ?? new Date(), dueDate: inv.dueDate, serviceDate: inv.serviceDate,
      label: inv.label, lines, discount: inv.discount, deducted: inv.deducted, notes: inv.notes, seller, buyer, vatExempt,
      quoteNumber: inv.quote?.number ?? null,
      event: inv.dossier ? `${eventKind(inv.dossier.eventType).label}${inv.dossier.eventStart ? ` du ${date(inv.dossier.eventStart)}` : ""}${inv.dossier.venueName ? ` - ${inv.dossier.venueName}` : ""}` : null,
      credited: credited ? `${credited.number} du ${date(credited.issueDate)}` : null,
    },
    c,
    await getLogo(),
  );
  const xml = facturXml({ number, kind: inv.kind, issueDate: inv.issueDate ?? new Date(), dueDate: inv.dueDate, serviceDate: inv.serviceDate, label: inv.label, lines, discount: inv.discount, deducted: inv.deducted, notes: inv.notes, seller, buyer, vatExempt, iban: c.iban, quoteNumber: inv.quote?.number });
  const full = inv.number ? await embedFacturX(pdf, xml, number) : pdf;
  return { pdf: full, xml, fileName: `${inv.kind === "AVOIR" ? "avoir" : "facture"}-${number}`, inv };
}
