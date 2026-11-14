/**
 * Recherche d'entreprises dans la base SIRENE (INSEE) via l'API publique
 * « Recherche d'entreprises » de l'État : https://recherche-entreprises.api.gouv.fr
 * Gratuite, sans clé, limitée à ~7 requêtes/seconde.
 */

export type Company = {
  siren: string;
  siret: string | null;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  nafCode: string | null;
  legalForm: string | null;
  headcount: string | null;
  vatNumber: string;
  active: boolean;
  createdOn: string | null;
  director: string | null;
};

const LEGAL_FORMS: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC", "5306": "SCS", "5308": "SCA",
  "5410": "SARL", "5422": "SARL", "5426": "SARL", "5499": "SARL", "5498": "EURL",
  "5485": "SELARL", "5785": "SELAS",
  "5599": "SA", "5699": "SA à directoire",
  "5710": "SAS", "5720": "SASU", "5800": "Société européenne",
  "6540": "SCI", "6589": "SCM", "6599": "Société civile",
  "9220": "Association déclarée", "9221": "Association d'insertion",
  "7210": "Commune", "7220": "Département", "7230": "Région",
};

const HEADCOUNTS: Record<string, string> = {
  NN: "Non renseigné", "00": "0 salarié", "01": "1 à 2", "02": "3 à 5", "03": "6 à 9", "11": "10 à 19",
  "12": "20 à 49", "21": "50 à 99", "22": "100 à 199", "31": "200 à 249", "32": "250 à 499",
  "41": "500 à 999", "42": "1 000 à 1 999", "51": "2 000 à 4 999", "52": "5 000 à 9 999", "53": "10 000 et plus",
};

const VOIES: Record<string, string> = {
  AV: "avenue", BD: "boulevard", CHE: "chemin", CHEM: "chemin", IMP: "impasse", PL: "place", RTE: "route",
  ALL: "allée", QUA: "quai", QU: "quai", CRS: "cours", SQ: "square", PASS: "passage", ZA: "ZA", ZI: "ZI",
  ZAC: "ZAC", LOT: "lotissement", RES: "résidence", HAM: "hameau", FG: "faubourg", PRO: "promenade", ESP: "esplanade",
  R: "rue", RUE: "rue", VOIE: "voie", SEN: "sentier", CAR: "carrefour", RPT: "rond-point",
};

/** Numéro de TVA intracommunautaire français déduit du SIREN. */
export function vatFromSiren(siren: string) {
  const n = Number(siren);
  if (!/^\d{9}$/.test(siren)) return "";
  const key = (12 + 3 * (n % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

const SMALL = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "sur", "sous", "aux", "au", "d", "l"]);
/** « BOULEVARD DE MONS » -> « Boulevard de Mons », « VILLENEUVE-D'ASCQ » -> « Villeneuve-d'Ascq » */
const title = (s: string, capitalizeFirst = true) =>
  s.toLowerCase().replace(/[a-zà-ÿ]+/g, (w, i: number) =>
    (i > 0 || !capitalizeFirst) && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1));

type ApiSiege = {
  siret?: string; numero_voie?: string | null; indice_repetition?: string | null; type_voie?: string | null;
  libelle_voie?: string | null; complement_adresse?: string | null; code_postal?: string | null;
  libelle_commune?: string | null; activite_principale?: string | null; tranche_effectif_salarie?: string | null;
};
type ApiResult = {
  siren: string; nom_complet?: string; nom_raison_sociale?: string | null; siege?: ApiSiege;
  activite_principale?: string | null; nature_juridique?: string | null; tranche_effectif_salarie?: string | null;
  etat_administratif?: string; date_creation?: string | null;
  dirigeants?: { nom?: string; prenoms?: string; denomination?: string; qualite?: string }[];
};

export function normalize(r: ApiResult): Company {
  const s = r.siege ?? {};
  const voie = [s.numero_voie, s.indice_repetition, s.type_voie ? VOIES[s.type_voie] ?? s.type_voie.toLowerCase() : null, s.libelle_voie ? title(s.libelle_voie, !s.type_voie) : null]
    .filter(Boolean).join(" ");
  const address = [voie, s.complement_adresse ? title(s.complement_adresse) : null].filter(Boolean).join(", ");
  const d = r.dirigeants?.[0];
  const director = d ? [d.prenoms ? title(d.prenoms.split(" ")[0]) : null, d.nom ?? d.denomination, d.qualite ? `(${d.qualite})` : null].filter(Boolean).join(" ") : null;
  const tranche = r.tranche_effectif_salarie ?? s.tranche_effectif_salarie ?? null;
  return {
    siren: r.siren,
    siret: s.siret ?? null,
    name: r.nom_raison_sociale || r.nom_complet || r.siren,
    address,
    postalCode: s.code_postal ?? "",
    city: s.libelle_commune ? title(s.libelle_commune) : "",
    nafCode: r.activite_principale ?? s.activite_principale ?? null,
    legalForm: r.nature_juridique ? LEGAL_FORMS[r.nature_juridique] ?? `Code ${r.nature_juridique}` : null,
    headcount: tranche ? HEADCOUNTS[tranche] ?? tranche : null,
    vatNumber: vatFromSiren(r.siren),
    active: r.etat_administratif !== "C",
    createdOn: r.date_creation ?? null,
    director,
  };
}

export async function searchCompanies(q: string): Promise<Company[]> {
  const clean = q.trim();
  // un SIRET (14 chiffres) se cherche par son SIREN
  const digits = clean.replace(/\s/g, "");
  const query = /^\d{14}$/.test(digits) ? digits.slice(0, 9) : /^\d{9}$/.test(digits) ? digits : clean;
  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=10&page=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
  if (res.status === 429) throw new Error("Trop de recherches d'un coup, réessayez dans une seconde.");
  if (!res.ok) throw new Error(`Base INSEE indisponible (${res.status}).`);
  const data = (await res.json()) as { results?: ApiResult[] };
  return (data.results ?? []).map(normalize);
}
