"use client";
import { useEffect, useRef, useState } from "react";

/** Zone de signature (souris, doigt, stylet). Renvoie un PNG transparent via le champ caché `name`. */
export function SignaturePad({ name = "signature" }: { name?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [data, setData] = useState("");
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 2);
      const { width, height } = c.getBoundingClientRect();
      c.width = width * ratio; c.height = height * ratio;
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.4; ctx.strokeStyle = "#0b1f5c";
      setEmpty(true); setData("");
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath(); ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = "#0b1f5c"; ctx.fill();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    setEmpty(false);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setData(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true); setData("");
  };

  return (
    <div>
      <input type="hidden" name={name} value={data} />
      <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvas}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
          className="block h-44 w-full cursor-crosshair touch-none"
          aria-label="Zone de signature : tracez votre signature"
        />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Signez ici avec la souris ou le doigt</span>}
        <span className="pointer-events-none absolute right-4 bottom-8 left-4 border-b border-slate-200" />
      </div>
      <button type="button" onClick={clear} className="mt-1 text-xs text-slate-500 hover:text-slate-800">Effacer</button>
    </div>
  );
}
