/** Planning musical : types et outils partagés (navigateur et serveur). */
export type Moment = { id: string; label: string; time: string; song: string; note: string };
export type Track = { id: string; title: string; artist: string; url?: string };
export type MusicData = { playlistUrl: string; moments: Moment[]; mustPlay: Track[]; doNotPlay: Track[]; notes: string };

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Moments proposés par défaut selon le type d'événement. */
export function defaultMoments(type: string): Moment[] {
  const L: Record<string, string[]> = {
    MARIAGE: ["Cérémonie : entrée", "Cérémonie : sortie des mariés", "Vin d'honneur", "Entrée des mariés dans la salle", "Ouverture de bal", "Gâteau / pièce montée", "Dernière danse"],
    ANNIVERSAIRE: ["Arrivée des invités", "Entrée de la personne fêtée", "Gâteau", "Ouverture de la piste", "Dernière chanson"],
    ENTREPRISE: ["Accueil", "Discours", "Remise de prix", "Ouverture de la piste", "Fin de soirée"],
    SOIREE: ["Accueil", "Ouverture de la piste", "Temps fort", "Dernière chanson"],
  };
  return (L[type] ?? ["Accueil", "Ouverture de la piste", "Dernière chanson"]).map((label) => ({ id: uid(), label, time: "", song: "", note: "" }));
}

/** Adresse Spotify (lien ou URI) vers le lecteur intégrable, ou null. */
export function spotifyEmbed(url: string | null | undefined) {
  if (!url) return null;
  const m = url.trim().match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(playlist|album|track)[/:]([A-Za-z0-9]{10,40})/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` : null;
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n) : []);
export function parseList<T>(s: string | null | undefined): T[] {
  try { const v = JSON.parse(s ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Nettoie ce qui arrive du navigateur (longueurs bornées, champs connus seulement). */
export function cleanMusic(d: Partial<MusicData>): MusicData {
  const track = (x: Record<string, unknown>): Track => ({ id: str(x?.id, 20) || uid(), title: str(x?.title, 200), artist: str(x?.artist, 200), url: /^https:\/\/open\.spotify\.com\//.test(str(x?.url, 300)) ? str(x?.url, 300) : undefined });
  return {
    playlistUrl: spotifyEmbed(str(d.playlistUrl, 300)) ? str(d.playlistUrl, 300).trim() : "",
    moments: arr(d.moments, 60).map((x: Record<string, unknown>) => ({ id: str(x?.id, 20) || uid(), label: str(x?.label, 120), time: /^\d{2}:\d{2}$/.test(str(x?.time, 5)) ? str(x?.time, 5) : "", song: str(x?.song, 300), note: str(x?.note, 500) })).filter((m) => m.label || m.song),
    mustPlay: arr(d.mustPlay, 200).map(track).filter((t) => t.title),
    doNotPlay: arr(d.doNotPlay, 200).map(track).filter((t) => t.title),
    notes: str(d.notes, 5000),
  };
}
