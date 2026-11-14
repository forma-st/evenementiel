/**
 * Archive ZIP en flux (sans compression : les photos sont déjà compressées).
 * Les fichiers sont lus un par un et envoyés au fur et à mesure : pas de limite de mémoire.
 * Format ZIP64 pour dépasser 4 Go au total.
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(crc: number, buf: Uint8Array) {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type Entry = { name: string; open: () => Promise<ReadableStream<Uint8Array> | null> };

function dosTime(d: Date) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function zipStream(entries: Entry[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0n;
  const { time, date } = dosTime(new Date());
  const used = new Set<string>();
  const unique = (n: string) => {
    let name = n, i = 1;
    while (used.has(name.toLowerCase())) name = n.replace(/(\.[^.]*)?$/, (ext) => ` (${i++})${ext ?? ""}`);
    used.add(name.toLowerCase());
    return name;
  };

  return new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const push = (b: Uint8Array) => { ctrl.enqueue(b); offset += BigInt(b.length); };
      for (const e of entries) {
        const stream = await e.open().catch(() => null);
        if (!stream) continue;
        const name = enc.encode(unique(e.name));
        const start = offset;
        // en-tête local : bit 3 (descripteur après les données) + bit 11 (noms UTF-8), ZIP64 extra
        const h = new DataView(new ArrayBuffer(30 + name.length + 20));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 45, true); h.setUint16(6, 0x0808, true); h.setUint16(8, 0, true);
        h.setUint16(10, time, true); h.setUint16(12, date, true);
        h.setUint32(14, 0, true); h.setUint32(18, 0xffffffff, true); h.setUint32(22, 0xffffffff, true);
        h.setUint16(26, name.length, true); h.setUint16(28, 20, true);
        new Uint8Array(h.buffer).set(name, 30);
        h.setUint16(30 + name.length, 0x0001, true); h.setUint16(32 + name.length, 16, true); // extra ZIP64 vide (tailles dans le descripteur)
        push(new Uint8Array(h.buffer));
        let crc = 0, size = 0n;
        const reader = stream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          crc = crc32(crc, value); size += BigInt(value.length);
          push(value);
        }
        // descripteur ZIP64
        const d = new DataView(new ArrayBuffer(24));
        d.setUint32(0, 0x08074b50, true); d.setUint32(4, crc, true); d.setBigUint64(8, size, true); d.setBigUint64(16, size, true);
        push(new Uint8Array(d.buffer));
        // entrée du répertoire central
        const c = new DataView(new ArrayBuffer(46 + name.length + 28));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 45, true); c.setUint16(6, 45, true); c.setUint16(8, 0x0808, true); c.setUint16(10, 0, true);
        c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
        c.setUint32(20, 0xffffffff, true); c.setUint32(24, 0xffffffff, true);
        c.setUint16(28, name.length, true); c.setUint16(30, 28, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
        c.setUint32(38, 0, true); c.setUint32(42, 0xffffffff, true);
        new Uint8Array(c.buffer).set(name, 46);
        const x = 46 + name.length;
        c.setUint16(x, 0x0001, true); c.setUint16(x + 2, 24, true);
        c.setBigUint64(x + 4, size, true); c.setBigUint64(x + 12, size, true); c.setBigUint64(x + 20, start, true);
        central.push(new Uint8Array(c.buffer));
      }
      const cdStart = offset;
      let cdSize = 0n;
      for (const c of central) { push(c); cdSize += BigInt(c.length); }
      const zip64End = offset;
      const z = new DataView(new ArrayBuffer(56 + 20 + 22));
      // fin de répertoire ZIP64
      z.setUint32(0, 0x06064b50, true); z.setBigUint64(4, 44n, true); z.setUint16(12, 45, true); z.setUint16(14, 45, true);
      z.setUint32(16, 0, true); z.setUint32(20, 0, true);
      z.setBigUint64(24, BigInt(central.length), true); z.setBigUint64(32, BigInt(central.length), true);
      z.setBigUint64(40, cdSize, true); z.setBigUint64(48, cdStart, true);
      // localisateur ZIP64
      z.setUint32(56, 0x07064b50, true); z.setUint32(60, 0, true); z.setBigUint64(64, zip64End, true); z.setUint32(72, 1, true);
      // fin de répertoire classique
      z.setUint32(76, 0x06054b50, true); z.setUint16(80, 0, true); z.setUint16(82, 0, true);
      z.setUint16(84, 0xffff, true); z.setUint16(86, 0xffff, true); z.setUint32(88, 0xffffffff, true); z.setUint32(92, 0xffffffff, true); z.setUint16(96, 0, true);
      push(new Uint8Array(z.buffer));
      ctrl.close();
    },
  });
}
