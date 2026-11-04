/* ==========================================================================
   occhiali-genera.js: calcola il modello 3D degli occhiali di strass

   Non gira sul sito: produce assets/3d/occhiali.bin, perché piazzare migliaia di
   pietre richiede troppo tempo per farlo mentre si apre una pagina.
   TAVOLA e LENTE sono misurate sovrapponendo il modello alle sagome delle foto vere.
   Si lancia da una pagina del sito (serve la mappa degli import di index.html):
     const m = await import('/strumenti/occhiali-genera.js'); const dati = m.impacchetta();
   ========================================================================== */

import * as THREE from 'three';
import { casuale } from '/js/strass.js';

const K = 0.36;       // dalle unità delle misure ai millimetri
// lungo il nastro, dal naso alla punta: x, z (dalla vista dall'alto), bordo sopra, bordo sotto
const TAVOLA = [[0, -14.5, 28.5, 6], [11, 6, 34, -7], [20, 11, 40, -25], [39, 6, 42, -46], [56.5, 4.5, 47, -52], [75.5, 1.5, 52, -53], [95, -4.5, 54, -52], [116, -11, 54, -50], [142, -25, 53, -42], [164, -39, 51, -29.5], [179, -60, 49, -20], [188, -85, 45, -11.5], [189, -116.5, 41, -8.5], [188, -153, 40, -4], [183, -190, 35, 1], [174, -225, 30, 9], [161, -259, 25, 11], [142, -290, 16, 5.5], [125, -311.5, 3, -8], [115, -329, -8, -20], [108, -340, -19, -28], [106, -348, -25, -30]];
const CONTORNO_LENTE = [[22, 8.0], [25, 16.0], [32, 23.0], [43, 29.0], [58, 33.0], [77, 36.0], [99, 38.0], [120, 38.0], [139, 37.0], [153, 34.0], [164, 29.0], [171, 19.0], [173, 4.1], [170, -7.4], [163, -16.2], [153, -23.3], [141, -30.4], [127, -35.7], [113, -38.3], [99, -40.1], [85, -41.0], [72, -41.0], [60, -41.0], [51, -40.1], [42, -33.9], [34, -24.2], [27, -12.7], [23, -2.1]];   // misurato sulle foto, poi alzato per lasciare il bordo sotto la lente
const STACCO = 0.45;  // lo spazio liscio tra le pietre e la lente

export function genera({ conPietre = true } = {}) {
  /* ---------- 1. Il nastro: misurato per lunghezza, s = 0 al naso ---------- */
  const pianta = new THREE.CatmullRomCurve3(TAVOLA.map((r) => new THREE.Vector3(r[0] * K, 0, r[1] * K)), false, 'centripetal');
  const bordi = new THREE.CatmullRomCurve3(TAVOLA.map((r, i) => new THREE.Vector3(r[2] * K, r[3] * K, i)), false, 'centripetal');
  const PASSO = 0.2, SU = [];
  {
    const fine = [], N = 2400;
    let s = 0, prima = null;
    for (let i = 0; i <= N; i++) { const t = i / N, p = pianta.getPoint(t), a = bordi.getPoint(t); if (prima) s += p.distanceTo(prima); prima = p; fine.push({ s, x: p.x, z: p.z, su: a.x, giu: a.y }); }
    let j = 0;
    for (let q = 0; q <= s; q += PASSO) { while (j < N && fine[j + 1].s < q) j++; const A = fine[j], B = fine[Math.min(N, j + 1)], f = B.s > A.s ? (q - A.s) / (B.s - A.s) : 0; SU.push({ x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, su: A.su + (B.su - A.su) * f, giu: A.giu + (B.giu - A.giu) * f }); }
  }
  const S_MAX = (SU.length - 1) * PASSO;
  const riga = (a) => { const f = Math.min(SU.length - 1.001, Math.max(0, a / PASSO)), i = Math.floor(f), t = f - i, A = SU[i], B = SU[i + 1]; return { x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t, su: A.su + (B.su - A.su) * t, giu: A.giu + (B.giu - A.giu) * t }; };
  // il terminale si chiude arrotondato negli ultimi millimetri
  const stringe = (a) => { const d = S_MAX - a; return d >= 3 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - d / 3) ** 2)); };
  const alti = (a) => { const p = riga(a), m = (p.su + p.giu) / 2, h = ((p.su - p.giu) / 2) * stringe(a); return [m - h, m + h]; };
  const sDiU = (u) => { const X = u * K; let m = 1e9, q = 0; for (let i = 0; i < SU.length * 0.55; i++) { const d = Math.abs(SU[i].x - X); if (d < m) { m = d; q = i * PASSO; } } return q; };
  const sDiZ = (z) => { let i = 0; while (i < SU.length - 1 && SU[i].z > z * K) i++; return i * PASSO; };
  const S_CERNIERA = sDiZ(-112), S_PIETRE = S_MAX - 1.5;
  const LENTE = new THREE.CatmullRomCurve3(CONTORNO_LENTE.map(([u, y]) => new THREE.Vector3(sDiU(u), y * K, 0)), true, 'centripetal').getPoints(440).map((p) => [p.x, p.y]);
  const dentro = (a, b) => { let c = false; for (let i = 0, j = LENTE.length - 1; i < LENTE.length; j = i++) { const [e, f] = LENTE[i], [g, h] = LENTE[j]; if ((f > b) !== (h > b) && a < ((g - e) * (b - f)) / (h - f) + e) c = !c; } return c; };
  const distanza = (a, b) => { let m = 1e9; for (let i = 0, j = LENTE.length - 1; i < LENTE.length; j = i++) { const [e, f] = LENTE[i], [g, h] = LENTE[j], dx = g - e, dy = h - f, t = Math.max(0, Math.min(1, ((a - e) * dx + (b - f) * dy) / (dx * dx + dy * dy || 1))), d = (a - e - dx * t) ** 2 + (b - f - dy * t) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
  // positivo fuori dalla lente, negativo dentro
  const segno = (a, b) => (a > LENTE.reduce((n, q) => Math.max(n, q[0]), 0) + 6 ? 9 : dentro(a, b) ? -distanza(a, b) : distanza(a, b));

  // la sezione è chiusa e arrotondata: davanti bombata, dietro più spessa, si incontrano sui due bordi
  const pancia = (v) => Math.pow(Math.max(0, Math.sin(v * Math.PI)), 0.55);
  const davanti = (a) => (a < S_CERNIERA ? 1.7 : Math.max(0.7, 1.7 - (a - S_CERNIERA) * 0.012));
  const dietro = (a) => (a < S_CERNIERA ? 3.2 : Math.max(1, 3.2 - (a - S_CERNIERA) * 0.024));
  const fuoriDi = (a) => { const A = riga(Math.max(0, a - 0.8)), B = riga(Math.min(S_MAX, a + 0.8)), dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  // un punto del nastro. L'x della tavola è positiva: il segno di s sceglie il lato
  const punto = (s, y, faccia, sopra = 0) => {
    const a = Math.abs(s), p = riga(a), [gi, su] = alti(a), v = (y - gi) / Math.max(0.01, su - gi), n = fuoriDi(a);
    const o = (faccia ? davanti(a) : -dietro(a)) * pancia(Math.max(0, Math.min(1, v))) * stringe(a) + sopra;
    return new THREE.Vector3((s < 0 ? -1 : 1) * (p.x + n[0] * o), y, p.z + n[1] * o);
  };
  const normale = (s, y, sopra = 0) => { const e = 0.35, A = punto(s - e, y, true, sopra), B = punto(s + e, y, true, sopra), C = punto(s, y - e, true, sopra), D = punto(s, y + e, true, sopra); return B.sub(A).cross(D.sub(C)).normalize(); };

  /* ---------- 2. I corpi: griglia sul nastro, ritagliata con precisione sul contorno ---------- */
  const DS = 1.2, NR = 28, NC = Math.floor(S_MAX / DS), colonna = (i) => (i === NC + 1 ? S_MAX : i === -NC - 1 ? -S_MAX : i * DS);
  const quota = (i, r) => { const [gi, su] = alti(Math.abs(colonna(i))); return gi + (r / NR) * (su - gi); };
  const SD = new Map(), sdDi = (i, r) => { const k = i * 1000 + r; if (!SD.has(k)) SD.set(k, segno(Math.abs(colonna(i)), quota(i, r))); return SD.get(k); };
  function strato({ tiene, facce, chiusa, sopra = () => 0, muro = false }) {
    // tiene: +1 tiene il fuori della lente, -1 il dentro. facce: quali superfici
    const pos = [], fronte = [], idx = [], mappa = new Map();
    const nuovo = (k, s, y, f) => { if (mappa.has(k)) return mappa.get(k); const q = punto(s, y, f, sopra(f)); pos.push(q.x, q.y, q.z); fronte.push(!f ? 0 : tiene > 0 && segno(Math.abs(s), y) > 0.95 ? 2 : 1); mappa.set(k, pos.length / 3 - 1); return pos.length / 3 - 1; };
    const griglia = (i, r, f) => nuovo(`g${i},${r},${chiusa && (r === 0 || r === NR) ? 1 : f ? 1 : 0}`, colonna(i), quota(i, r), chiusa && (r === 0 || r === NR) ? true : f);
    const taglio = (A, B, f) => { const a = sdDi(A[0], A[1]) - SOGLIA, b = sdDi(B[0], B[1]) - SOGLIA, t = a / (a - b), s = colonna(A[0]) + (colonna(B[0]) - colonna(A[0])) * t, y = quota(A[0], A[1]) + (quota(B[0], B[1]) - quota(A[0], A[1])) * t, ka = `${A[0]},${A[1]}`, kb = `${B[0]},${B[1]}`; return nuovo(`t${ka < kb ? ka + '|' + kb : kb + '|' + ka},${f ? 1 : 0}`, s, y, f); };
    const SOGLIA = tiene > 0 ? 0 : 0.3;
    const lim = NC + 1, val = (A) => (sdDi(A[0], A[1]) - SOGLIA) * tiene;
    const tri = (A, B, C, f) => {
      const V = [A, B, C], su = V.map((q) => val(q) >= 0), n = su.filter(Boolean).length;
      const metti = (a, b, c) => { if (f) idx.push(a, b, c); else idx.push(a, c, b); };
      const gv = (q) => griglia(q[0], q[1], f);
      if (n === 3) { metti(gv(A), gv(B), gv(C)); return; }
      if (n === 0) return;
      const solo = su.indexOf(n === 1), P = V[solo], Q = V[(solo + 1) % 3], R = V[(solo + 2) % 3], pq = taglio(P, Q, f), pr = taglio(P, R, f);
      if (n === 1) metti(gv(P), pq, pr); else { metti(pq, gv(Q), gv(R)); metti(pq, gv(R), pr); }
      if (muro && f) { const ba = taglio(P, Q, false), bb = taglio(P, R, false); if (n === 1) { idx.push(pq, ba, bb, pq, bb, pr); } else { idx.push(pq, pr, bb, pq, bb, ba); } }
    };
    for (let i = -lim; i < lim; i++) for (let r = 0; r < NR; r++) for (const f of facce) {
      const A = [i, r], B = [i + 1, r], C = [i + 1, r + 1], D = [i, r + 1];
      tri(A, B, C, f); tri(A, C, D, f);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.userData.fronte = fronte;
    return new THREE.Mesh(g);
  }
  const occhiali = new THREE.Group();
  occhiali.add(strato({ tiene: 1, facce: [true, false], chiusa: true, muro: true }));   // la montatura e le aste, un solo pezzo
  occhiali.add(strato({ tiene: -1, facce: [true], chiusa: false, sopra: () => -0.7 }));   // sotto le pietre nere
  occhiali.add(strato({ tiene: -1, facce: [false], chiusa: false, sopra: () => 0.6 }));   // da dietro: vetro scuro

  /* ---------- 3. Le pietre: file che seguono i bordi, come nelle foto ---------- */
  const chiare = [], nere = [];
  if (conPietre) {
    const dado = casuale(2024), CEL = 4;
    const libero = (g, s, y, r) => { const ca = Math.floor(s / CEL), cb = Math.floor(y / CEL); for (let a = ca - 1; a <= ca + 1; a++) for (let b = cb - 1; b <= cb + 1; b++) { const l = g.get(a * 4096 + b); if (l) for (const e of l) if ((e[0] - s) ** 2 + (e[1] - y) ** 2 < ((e[2] + r) * 0.92) ** 2) return false; } return true; };
    const segna = (g, s, y, r) => { const k = Math.floor(s / CEL) * 4096 + Math.floor(y / CEL); if (!g.has(k)) g.set(k, []); g.get(k).push([s, y, r]); };
    // grandi vicino alla cerniera, sempre più piccole verso la punta
    const scala = (a) => (a < S_CERNIERA ? 1 : Math.max(0.56, 1.06 - ((a - S_CERNIERA) / (S_PIETRE - S_CERNIERA)) * 0.5));
    const valida = (s, y, r) => { const a = Math.abs(s); if (a > S_PIETRE || Math.abs(a - S_CERNIERA) < 0.35 + r) return false; const [gi, su] = alti(a); if (y > su - r * 0.62 || y < gi + r * 0.62 || dentro(a, y)) return false; return distanza(a, y) > STACCO + r; };
    let area = 0; for (let i = 0; i < LENTE.length; i++) { const [a, b] = LENTE[i], [e, f] = LENTE[(i + 1) % LENTE.length]; area += a * f - e * b; }
    const verso = area > 0 ? 1 : -1, R = 1.28;
    for (const lato of [1, -1]) {
      const g = new Map();
      const metti = (s, y, r) => { if (valida(s, y, r) && libero(g, s, y, r)) { segna(g, s, y, r); chiare.push({ p: punto(s, y, true, -0.05), n: normale(s, y), r }); return true; } return false; };
      // i bordi esterni: una fila ordinata, sopra e sotto
      for (let a = 0.8; a < S_PIETRE;) { const r = 0.98 * scala(a), [gi, su] = alti(a); metti(lato * a, su - r * 0.7, r); metti(lato * a, gi + r * 0.7, r); a += 2 * r * 1.02; }
      // attorno alla lente: file concentriche
      for (let fila = 0; fila < 3; fila++) {
        const off = STACCO + R + fila * 2 * R * 0.9; let resto = 99;
        for (let i = 0; i < LENTE.length; i++) { const [a, b] = LENTE[i], [e, f] = LENTE[(i + 1) % LENTE.length], l = Math.hypot(e - a, f - b); resto += l; if (resto < 2 * R) continue; const ss = a + ((f - b) / l) * verso * off, y = b + (-(e - a) / l) * verso * off; if (ss > 0 && metti(lato * ss, y, R * (0.97 + dado() * 0.06))) resto = 0; }
      }
      // le aste e il resto: file parallele al nastro, sfalsate
      for (let a = 0.8, n = 0; a < S_PIETRE; n++) { const r = R * scala(a), [gi, su] = alti(a); for (let y = gi + r * 0.7 + (n % 2 ? r * 0.87 : 0); y < su; y += 2 * r * 0.92) metti(lato * a, y, r); a += 2 * r * 0.82; }
      // negli spazi rimasti, poche pietre piccole
      for (const [m, volte] of [[0.8, 90000], [0.56, 30000]]) for (let t = 0; t < volte; t++) { const a = dado() * S_PIETRE, [gi, su] = alti(a); metti(lato * a, gi + dado() * (su - gi), m * Math.max(0.75, scala(a))); }
      // le lenti: righe di pietre nere, solo sulla faccia davanti
      const g2 = new Map(), RN = 1.05, ok = (a, y, r) => dentro(a, y) && distanza(a, y) > 0.2 + r && libero(g2, lato * a, y, r);
      const nera = (a, y, r) => { segna(g2, lato * a, y, r); nere.push({ p: punto(lato * a, y, true, -0.75), n: normale(lato * a, y, -0.7), r }); };
      for (let rg = 0, y = -20; y < 15; y += 2 * RN * 0.87, rg++) for (let a = (rg % 2) * RN; a < S_CERNIERA + 4; a += 2 * RN * 0.98) if (ok(a, y, RN)) nera(a, y, RN);
      for (let t = 0; t < 26000; t++) { const a = dado() * (S_CERNIERA + 4), y = -20 + dado() * 35; if (ok(a, y, 0.66)) nera(a, y, 0.66); }
    }
  }

  /* ---------- 4. Le cerniere, all'interno ---------- */
  for (const lato of [1, -1]) {
    const s = lato * (S_CERNIERA + 2), [gi, su] = alti(S_CERNIERA + 2), y = (gi + su) / 2, p = punto(s, y, false, -0.3), n = normale(s, y).negate();
    const c = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5, 0.8));
    c.position.copy(p);
    c.lookAt(p.clone().add(n));
    occhiali.add(c);
  }
  occhiali.updateMatrixWorld(true);
  return { occhiali, chiare, nere };
}

// tutto in un solo file binario: posizioni in Int16 (un'unità = 0,01 mm), triangoli, pietre, cerniere
export function impacchetta(opzioni) {
  const { occhiali, chiare, nere } = genera(opzioni);
  const parti = occhiali.children.slice(0, 3).map((m) => m.geometry), cerniere = occhiali.children.slice(3);
  const pezzi = [], testa = [parti.length, chiare.length, nere.length, cerniere.length];
  for (const g of parti) {
    const p = g.attributes.position.array, q = new Int16Array(p.length);
    for (let i = 0; i < p.length; i++) q[i] = Math.round(p[i] * 100);
    testa.push(q.length, g.index.count);
    pezzi.push(q, new Uint16Array(g.index.array), new Uint8Array(g.userData.fronte));
  }
  const pack = (lista) => {
    const b = new Int16Array(lista.length * 8);
    lista.forEach((v, i) => { const o = i * 8; b[o] = v.p.x * 100; b[o + 1] = v.p.y * 100; b[o + 2] = v.p.z * 100; b[o + 3] = v.n.x * 32767; b[o + 4] = v.n.y * 32767; b[o + 5] = v.n.z * 32767; b[o + 6] = v.r * 1000;  });
    return b;
  };
  pezzi.push(pack(chiare), pack(nere));
  const mat = new Float32Array(cerniere.length * 16);
  cerniere.forEach((c, i) => { c.updateMatrix(); mat.set(c.matrix.elements, i * 16); });
  pezzi.push(mat);
  let lung = testa.length * 4; const allinea = (n, a) => Math.ceil(n / a) * a;
  for (const z of pezzi) lung = allinea(lung, z.BYTES_PER_ELEMENT) + z.byteLength;
  const buf = new ArrayBuffer(lung); new Uint32Array(buf, 0, testa.length).set(testa);
  let o = testa.length * 4;
  for (const z of pezzi) { o = allinea(o, z.BYTES_PER_ELEMENT); new Uint8Array(buf, o, z.byteLength).set(new Uint8Array(z.buffer, z.byteOffset, z.byteLength)); o += z.byteLength; }
  return { buf, chiare: chiare.length, nere: nere.length, testa };
}
