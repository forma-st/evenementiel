import { getCompany, getLogo } from "@/lib/company";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Logo public (pages de connexion, signature, galeries) : image déposée ou monogramme SVG. */
export async function GET(req: Request) {
  const mark = new URL(req.url).searchParams.has("mark"); // version carrée (menu réduit)
  const logo = await getLogo();
  if (logo) {
    const [meta, b64] = logo.split(",");
    const type = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
    return new Response(Buffer.from(b64, "base64"), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=300" } });
  }
  const c = await getCompany();
  const name = esc(c.name);
  const initials = esc(c.name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "★");
  if (mark) return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#1d5fd6"/><text x="24" y="31" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="19" font-weight="700" fill="#fff">${initials}</text></svg>`, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" } });
  const w = Math.max(160, 64 + c.name.length * 11);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="56" viewBox="0 0 ${w} 56">
<rect x="0" y="4" width="48" height="48" rx="12" fill="#1d5fd6"/>
<text x="24" y="36" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="19" font-weight="700" fill="#fff">${initials}</text>
<text x="60" y="${c.tagline ? 30 : 36}" font-family="Helvetica,Arial,sans-serif" font-size="18" font-weight="700" fill="#14213d">${name}</text>
${c.tagline ? `<text x="60" y="47" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#71717a">${esc(c.tagline)}</text>` : ""}
</svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" } });
}
