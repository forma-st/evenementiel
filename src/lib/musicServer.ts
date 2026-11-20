import type { MusicPlan } from "@prisma/client";
import { defaultMoments, parseList, type Moment, type MusicData, type Track } from "./music";

/** Données du planning pour l'éditeur (moments par défaut tant que rien n'est enregistré). */
export function musicData(p: MusicPlan | null, eventType: string): MusicData {
  if (!p) return { playlistUrl: "", moments: defaultMoments(eventType), mustPlay: [], doNotPlay: [], notes: "" };
  return { playlistUrl: p.playlistUrl ?? "", moments: parseList<Moment>(p.moments), mustPlay: parseList<Track>(p.mustPlay), doNotPlay: parseList<Track>(p.doNotPlay), notes: p.notes ?? "" };
}
