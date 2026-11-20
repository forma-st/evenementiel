import type { MusicPlan } from "@prisma/client";
import { EMPTY_INFO, cleanInfo, clientEditable, defaultMoments, parseList, type Moment, type MusicData, type Track } from "./music";

/** Données du planning pour l'éditeur (moments par défaut tant que rien n'est enregistré). */
export function musicData(p: MusicPlan | null, eventType: string): MusicData {
  if (!p) return { playlistUrl: "", moments: defaultMoments(eventType), mustPlay: [], doNotPlay: [], notes: "", info: EMPTY_INFO };
  return { playlistUrl: p.playlistUrl ?? "", moments: parseList<Moment>(p.moments), mustPlay: parseList<Track>(p.mustPlay), doNotPlay: parseList<Track>(p.doNotPlay), notes: p.notes ?? "", info: (() => { try { return cleanInfo(JSON.parse(p.info)); } catch { return EMPTY_INFO; } })() };
}

/** État d'accès sérialisable pour l'éditeur. */
export function planAccess(p: MusicPlan | null, eventStart: Date | null) {
  const st = clientEditable(p, eventStart);
  return { clientCanEdit: p?.clientCanEdit ?? true, forceOpen: p?.forceOpen ?? false, deadlineDays: p?.deadlineDays ?? 7, deadline: st.deadline?.toISOString() ?? null, editable: st.editable, reason: st.reason };
}
