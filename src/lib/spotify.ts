/** Recherche de titres Spotify (identifiants d'application facultatifs : SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET). */
let token: { value: string; until: number } | null = null;

export const spotifyConfigured = () => !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

async function getToken() {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Spotify ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return token.value;
}

export type SpotifyTrack = { title: string; artist: string; url: string; image: string | null };

export async function searchTracks(q: string): Promise<SpotifyTrack[]> {
  if (!spotifyConfigured() || q.trim().length < 2) return [];
  const res = await fetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: q.slice(0, 100), type: "track", limit: "8", market: "FR" })}`, { headers: { Authorization: `Bearer ${await getToken()}` }, cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as { tracks?: { items: { name: string; external_urls: { spotify: string }; artists: { name: string }[]; album: { images: { url: string; width: number }[] } }[] } };
  return (j.tracks?.items ?? []).map((t) => ({
    title: t.name, artist: t.artists.map((a) => a.name).join(", "), url: t.external_urls.spotify,
    image: [...t.album.images].sort((a, b) => a.width - b.width)[0]?.url ?? null,
  }));
}
