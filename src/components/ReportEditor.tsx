"use client";
import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

const TEMPLATE = `Participants :
-

Points abordés :
-

Décisions :
-

Actions à mener (qui / quand) :
-
`;

export function ReportEditor({ initial, onSave }: { initial: string; onSave: (text: string) => Promise<{ ok: boolean; savedAt: string }> }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const save = async (value = text) => {
    if (value === saved) return;
    setStatus("Enregistrement…");
    const r = await onSave(value);
    setSaved(value);
    setStatus(`Enregistré à ${new Date(r.savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
  };

  const toggleDictation = () => {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = "fr-FR"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let finalText = ""; let temp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript; else temp += res[0].transcript;
      }
      if (finalText) setText((t) => (t && !t.endsWith("\n") && !t.endsWith(" ") ? t + " " : t) + finalText.trim());
      setInterim(temp);
    };
    r.onerror = (e) => setStatus(e.error === "not-allowed" ? "Micro refusé : autorisez-le dans le navigateur." : `Dictée interrompue (${e.error}).`);
    r.onend = () => { setListening(false); setInterim(""); };
    rec.current = r;
    r.start();
    setListening(true);
    setStatus("Parlez, le texte s'ajoute au compte-rendu…");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {supported ? (
          <button type="button" onClick={toggleDictation} className={listening ? "btn bg-brand-600 text-white" : "btn-secondary"}>
            {listening ? "⏹ Arrêter la dictée" : "🎤 Dicter"}
          </button>
        ) : (
          <span className="text-xs text-slate-500">La dictée vocale nécessite Chrome ou Edge.</span>
        )}
        {!text.trim() && <button type="button" onClick={() => { setText(TEMPLATE); area.current?.focus(); }} className="btn-secondary">Utiliser le modèle</button>}
        {listening && <span className="flex items-center gap-2 text-sm text-brand-600"><span className="h-2 w-2 animate-pulse rounded-full bg-brand-600" /> écoute en cours</span>}
      </div>
      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => save()}
        rows={14}
        placeholder="Rédigez ou dictez le compte-rendu : participants, points abordés, décisions, actions à mener…"
        className="input font-[inherit] leading-relaxed"
      />
      {interim && <p className="text-sm text-slate-400 italic">{interim}…</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => save()} disabled={text === saved} className="btn-primary">Enregistrer le compte-rendu</button>
        {status && <span className="text-sm text-slate-500">{status}</span>}
        {text !== saved && !status?.startsWith("Enregistrement") && <span className="text-xs text-amber-700">Modifications non enregistrées</span>}
      </div>
    </div>
  );
}
