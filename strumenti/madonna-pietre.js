/* ==========================================================================
   madonna-pietre.js: posa le pietre sulla forma 3D della Madonna

   Non gira sul sito: produce assets/3d/madonna-pietre.bin. Le pietre si posano una a
   una in file che girano attorno alla statua, fitte come quelle vere; negli spazi, le piccole.
   Il colore viene dalla pelle ricavata dal video; le pietre chiuse dentro le pieghe
   diventano più scure, così le pieghe restano profonde.
   Si lancia da una pagina del sito: const m = await import('/strumenti/madonna-pietre.js'); await m.calcola();
   ========================================================================== */

const GRANDE = 0.0074, PICCOLA = 0.0042;   // il raggio delle pietre, con la statua alta 1
const ROSA = [244, 96, 132];

export async function calcola() {
  const dati = await (await fetch('/assets/3d/madonna.bin')).arrayBuffer();
  const [nv, ni] = new Uint32Array(dati, 0, 2), i16 = new Int16Array(dati, 8, nv * 8), u16 = new Uint16Array(dati, 8, nv * 8), i8 = new Int8Array(dati, 8, nv * 16), idx = new Uint16Array(dati, 8 + nv * 16, ni);
  const P = (i) => [i16[i * 8] / 32767, i16[i * 8 + 1] / 32767, i16[i * 8 + 2] / 32767], N = (i) => [i8[i * 16 + 12] / 127, i8[i * 16 + 13] / 127, i8[i * 16 + 14] / 127], UV = (i) => [u16[i * 8 + 4] / 65535, u16[i * 8 + 5] / 65535];
  const im = new Image(); im.src = '/assets/3d/madonna-pelle.jpg'; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data;
  const pelle = (u, v) => { const s = [0, 0, 0]; let n = 0; for (let a = -14; a <= 14; a += 4) for (let b = -14; b <= 14; b += 4) { const x = Math.min(c.width - 1, Math.max(0, Math.round(u * c.width) + a)), y = Math.min(c.height - 1, Math.max(0, Math.round(v * c.height) + b)), o = (y * c.width + x) * 4; s[0] += px[o]; s[1] += px[o + 1]; s[2] += px[o + 2]; n++; } return s.map((q) => q / n); };
  // i triangoli, scelti in proporzione alla loro area
  const cum = new Float64Array(ni / 3); let tot = 0;
  for (let t = 0; t < ni / 3; t++) { const a = P(idx[t * 3]), b = P(idx[t * 3 + 1]), d = P(idx[t * 3 + 2]), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; tot += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; cum[t] = tot; }
  let seme = 7; const dado = () => { seme = (seme + 0x6d2b79f5) >>> 0; let q = seme; q = Math.imul(q ^ (q >>> 15), q | 1); q ^= q + Math.imul(q ^ (q >>> 7), q | 61); return ((q ^ (q >>> 14)) >>> 0) / 4294967296; };
  const CEL = 0.022, griglia = new Map(), chiave = (x, y, z) => Math.floor(x / CEL + 512) * 1048576 + Math.floor(y / CEL + 512) * 1024 + Math.floor(z / CEL + 512);
  const lista = [];
  const libero = (p, r) => { const a = Math.floor(p[0] / CEL), b = Math.floor(p[1] / CEL), e = Math.floor(p[2] / CEL); for (let x = a - 1; x <= a + 1; x++) for (let y = b - 1; y <= b + 1; y++) for (let z = e - 1; z <= e + 1; z++) { const l = griglia.get((x + 512) * 1048576 + (y + 512) * 1024 + z + 512); if (l) for (const q of l) { const d = (q.p[0] - p[0]) ** 2 + (q.p[1] - p[1]) ** 2 + (q.p[2] - p[2]) ** 2; if (d < ((q.r + r) * 0.9) ** 2) return false; } } return true; };
  // tanti punti candidati sulla superficie
  const candidati = [];
  for (let k = 0; k < 300000; k++) {
    let lo = 0, hi = cum.length - 1; const q = dado() * tot; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < q) lo = m + 1; else hi = m; }
    let u = dado(), v = dado(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v, i0 = idx[lo * 3], i1 = idx[lo * 3 + 1], i2 = idx[lo * 3 + 2], mix = (a, b, d) => [a[0] * w + b[0] * u + d[0] * v, a[1] * w + b[1] * u + d[1] * v, a[2] * w + b[2] * u + d[2] * v], p = mix(P(i0), P(i1), P(i2));
    let n = mix(N(i0), N(i1), N(i2)); const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
    if (p[1] < 0.0015 || n[1] < -0.8) continue;     // sotto la base non si vede
    candidati.push({ p, n, uv: [UV(i0)[0] * w + UV(i1)[0] * u + UV(i2)[0] * v, UV(i0)[1] * w + UV(i1)[1] * u + UV(i2)[1] * v] });
  }
  const prova = (e, r) => { if (!libero(e.p, r)) return; const q = { ...e, r }; lista.push(q); const ky = chiave(e.p[0], e.p[1], e.p[2]); if (!griglia.has(ky)) griglia.set(ky, []); griglia.get(ky).push(q); };
  // le file: dal basso verso l'alto, e lungo ogni fila attorno alla statua. Scorrendoli in quest'ordine i punti si impacchettano stretti
  const FILA = GRANDE * 1.75;
  [...candidati].sort((a, b) => Math.floor(a.p[1] / FILA) - Math.floor(b.p[1] / FILA) || Math.atan2(a.p[2], a.p[0]) - Math.atan2(b.p[2], b.p[0])).forEach((e) => prova(e, GRANDE));
  candidati.forEach((e) => prova(e, PICCOLA));
  // quanto è chiusa ogni pietra: si guarda intorno, lungo la normale, se ne incontra altre
  const occupato = (x, y, z) => griglia.has(chiave(x, y, z));
  for (const e of lista) { let colpi = 0, prove = 0; for (let a = 0; a < 8; a++) { const f = (a / 8) * 6.283, t = [Math.cos(f), 0.3, Math.sin(f)], d = [e.n[0] + t[0] * 0.9, e.n[1] + t[1] * 0.9, e.n[2] + t[2] * 0.9], l = Math.hypot(...d); for (let q = 2; q <= 4; q++) { prove++; const s = q * CEL; if (occupato(e.p[0] + (d[0] / l) * s, e.p[1] + (d[1] / l) * s, e.p[2] + (d[2] / l) * s)) { colpi++; break; } } } e.ao = 1 - Math.min(0.55, (colpi / 8) * 0.75); }
  const buf = new ArrayBuffer(4 + lista.length * 16), dv = new DataView(buf); dv.setUint32(0, lista.length, true);
  lista.forEach((e, i) => { const o = 4 + i * 16, t = pelle(e.uv[0], e.uv[1]), lum = (t[0] + t[1] + t[2]) / 3 / 150, schiarisce = Math.min(1.2, Math.max(0.6, lum ** 1.6)) * (0.94 + dado() * 0.12) * e.ao; e.p.forEach((x, k) => dv.setInt16(o + k * 2, Math.round(x * 32767), true)); e.n.forEach((x, k) => dv.setInt8(o + 6 + k, Math.round(x * 127))); dv.setUint8(o + 9, Math.round(e.r * 10000)); ROSA.forEach((x, k) => dv.setUint8(o + 10 + k, Math.min(255, Math.round(x * schiarisce)))); });
  return { buf, quante: lista.length };
}
