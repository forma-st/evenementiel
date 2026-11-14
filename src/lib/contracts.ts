import { getCompany, getLogo } from "./company";
import { textToPdf } from "./pdf";
import { buildQuotePdf } from "./quotePdf";

/** PDF du contrat, avec le devis en annexe si demandé. */
export async function buildContractPdf(title: string, body: string, quoteId: string | null) {
  const annex = quoteId ? (await buildQuotePdf(quoteId)).pdf : null;
  return textToPdf(title, body, await getCompany(), await getLogo(), annex);
}
