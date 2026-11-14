"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { name: string; size: number; done: number; status: "attente" | "envoi" | "ok" | "erreur"; error?: string };

/** Miniature JPEG (600 px) et dimensions d'une photo, calculées dans le navigateur. */
async function thumbnail(file: File): Promise<{ blob: Blob; width: number; height: number } | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return null;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
    return blob ? { blob, width: bmp.width, height: bmp.height } : null;
  } catch {
    return null;
  }
}

const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");

export function GalleryUploader({ galleryId, blob }: { galleryId: string; blob: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const patch = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function sendOne(file: File, i: number) {
    patch(i, { status: "envoi" });
    const th = await thumbnail(file);
    if (blob) {
      const { upload } = await import("@vercel/blob/client");
      const opts = { access: "public" as const, handleUploadUrl: "/api/galeries/upload", clientPayload: galleryId };
      const main = await upload(`galeries/${galleryId}/${safe(file.name)}`, file, { ...opts, multipart: file.size > 50 * 1024 ** 2, contentType: file.type || undefined, onUploadProgress: (p) => patch(i, { done: p.percentage }) });
      const mini = th ? await upload(`galeries/${galleryId}/mini/${safe(file.name)}.jpg`, th.blob, { ...opts, contentType: "image/jpeg" }) : null;
      const r = await fetch(`/api/galeries/${galleryId}/fichiers`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mime: file.type, size: file.size, url: main.url, thumbUrl: mini?.url, width: th?.width, height: th?.height }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Erreur");
    } else {
      const fd = new FormData();
      fd.append("file", file);
      if (th) { fd.append("thumb", th.blob, "mini.jpg"); fd.append("width", String(th.width)); fd.append("height", String(th.height)); }
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open("POST", `/api/galeries/${galleryId}/fichiers`);
        x.upload.onprogress = (e) => e.lengthComputable && patch(i, { done: Math.round((e.loaded / e.total) * 100) });
        x.onload = () => (x.status < 300 ? resolve() : reject(new Error(x.status === 413 ? "Fichier trop lourd pour ce serveur (activez Vercel Blob)" : JSON.parse(x.responseText || "{}").error ?? `Erreur ${x.status}`)));
        x.onerror = () => reject(new Error("Connexion interrompue"));
        x.send(fd);
      });
    }
    patch(i, { status: "ok", done: 100 });
  }

  async function start(files: File[]) {
    if (!files.length) return;
    const base = items.length;
    setItems((xs) => [...xs, ...files.map((f) => ({ name: f.name, size: f.size, done: 0, status: "attente" as const }))]);
    setBusy(true);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const k = next++;
        try { await sendOne(files[k], base + k); } catch (e) { patch(base + k, { status: "erreur", error: (e as Error).message }); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(false);
    router.refresh();
  }

  const ok = items.filter((x) => x.status === "ok").length;
  const errors = items.filter((x) => x.status === "erreur");
  const total = items.reduce((a, x) => a + x.size, 0);
  const sent = items.reduce((a, x) => a + (x.size * x.done) / 100, 0);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); start([...e.dataTransfer.files]); }}
        onClick={() => input.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${over ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-500 hover:bg-slate-50"}`}
      >
        <div className="text-3xl">⬆</div>
        <div className="mt-2 font-medium">Glissez vos photos et fichiers ici</div>
        <div className="text-sm text-slate-500">ou cliquez pour choisir · JPEG, PNG, vidéos, ZIP… envoi en parallèle, reprise possible</div>
        <input ref={input} type="file" multiple hidden onChange={(e) => { start([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {items.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-sm"><span>{ok} / {items.length} fichier(s) envoyé(s){busy ? "…" : ""}</span><span className="text-slate-500">{Math.round(sent / 1024 ** 2)} / {Math.round(total / 1024 ** 2)} Mo</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${total ? (sent / total) * 100 : 0}%` }} /></div>
          {errors.length > 0 && (
            <ul className="space-y-1 text-xs text-rose-600">{errors.map((x, i) => <li key={i}>{x.name} : {x.error}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
