"use client";
import { useMemo, useState } from "react";

/* Palette catégorielle validée (ordre fixe, jamais recyclé) : bleu, orange. */
export const SERIES = ["#2a78d6", "#eb6834"] as const;
const GRID = "#e7e5e4";
const AXIS = "#78716c";

type Series = { key: string; label: string };
type Row = { label: string } & Record<string, number | string>;

/** Graduations rondes (pas de 1, 2 ou 5 × 10^n), 5 intervalles au plus. */
function niceTicks(v: number) {
  if (v <= 0) return [0, 1];
  for (let p = 10 ** Math.floor(Math.log10(v / 5)); ; p *= 10) {
    for (const k of [1, 2, 5]) {
      const step = k * p;
      const n = Math.ceil(v / step);
      if (n <= 5) return Array.from({ length: n + 1 }, (_, i) => i * step);
    }
  }
}

/** Barre aux coins supérieurs arrondis (4 px), ancrée sur la ligne de base. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      {series.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function TableView({ rows, series, format, first }: { rows: Row[]; series: Series[]; format: (n: number) => string; first: string }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="table">
        <thead><tr><th>{first}</th>{series.map((s) => <th key={s.key} className="text-right">{s.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}><td>{r.label}</td>{series.map((s) => <td key={s.key} className="text-right tabular-nums">{format(Number(r[s.key]))}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Histogramme groupé (1 ou 2 séries) avec info-bulle par colonne et vue tableau. */
export function GroupedBars({ rows, series, format, axisFormat, first = "Période", height = 240, width = 720 }: {
  rows: Row[];
  series: Series[];
  format: (n: number) => string;
  axisFormat?: (n: number) => string;
  first?: string;
  height?: number;
  width?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const W = width, H = height, L = 52, R = 8, T = 12, B = 28;
  const ticks = useMemo(() => niceTicks(Math.max(0, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]))))), [rows, series]);
  const max = ticks[ticks.length - 1];
  const plotW = W - L - R, plotH = H - T - B;
  const band = plotW / rows.length;
  const gap = 2;
  const barW = Math.min(22, (band * 0.62 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const fmtAxis = axisFormat ?? format;
  const empty = rows.every((r) => series.every((s) => !Number(r[s.key])));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend series={series} />
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-xs text-link-600 hover:underline">
          {asTable ? "Voir le graphique" : "Voir en tableau"}
        </button>
      </div>
      {asTable ? (
        <TableView rows={rows} series={series} format={format} first={first} />
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${series.map((s) => s.label).join(" et ")} par ${first.toLowerCase()}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS}>{fmtAxis(t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const x0 = L + i * band + (band - groupW) / 2;
              return (
                <g key={r.label} opacity={hover === null || hover === i ? 1 : 0.45}>
                  {series.map((s, k) => {
                    const v = Number(r[s.key]);
                    return <path key={s.key} d={barPath(x0 + k * (barW + gap), y(v), barW, T + plotH - y(v))} fill={SERIES[k]} />;
                  })}
                  <text x={L + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS}>{r.label}</text>
                  <rect x={L + i * band} y={T} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                </g>
              );
            })}
            <line x1={L} x2={W - R} y1={T + plotH} y2={T + plotH} stroke={AXIS} strokeWidth={1} />
          </svg>
          {empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Pas encore de données sur cette période</div>}
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-lg whitespace-nowrap border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: `clamp(0px, calc(${((L + hover * band + band / 2) / W) * 100}% - 110px), calc(100% - 230px))` }}
            >
              <div className="mb-1 font-semibold">{rows[hover].label}</div>
              {series.map((s, k) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-sm" style={{ background: SERIES[k] }} />{s.label}</span>
                  <span className="font-medium tabular-nums">{format(Number(rows[hover][s.key]))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Barres horizontales (une série) : libellé, barre, valeur ; info-bulle au survol. */
export function HBars({ rows, format, detail }: {
  rows: { label: string; value: number; href?: string; note?: string }[];
  format: (n: number) => string;
  detail?: (r: { label: string; value: number; note?: string }) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2" role="list">
      {rows.map((r, i) => {
        const Inner = (
          <>
            <span className="w-32 shrink-0 truncate text-sm text-slate-600">{r.label}</span>
            <span className="relative h-5 flex-1">
              <span
                className="absolute inset-y-0 left-0 rounded-r"
                style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%`, background: SERIES[0], opacity: hover === null || hover === i ? 1 : 0.45 }}
              />
            </span>
            <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">{format(r.value)}</span>
          </>
        );
        return (
          <li key={r.label} className="relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {r.href ? <a href={r.href} className="flex items-center gap-3 rounded hover:bg-slate-50">{Inner}</a> : <div className="flex items-center gap-3">{Inner}</div>}
            {hover === i && detail && (
              <div className="pointer-events-none absolute right-28 -top-8 z-10 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs whitespace-nowrap shadow-lg">{detail(r)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
