/* ==========================================================================
   nomi-strass.js: i nomi dei progetti tempestati di strass

   Nel pannello "Progetti" (e nel pannello Portfolio, con le due versioni), passando su un nome, la lettera si dipinge nel
   colore del progetto e si riempie di strass trasparenti: compaiono uno a uno dal centro verso i
   bordi, come nella stella iniziale. Cliccando, il nome vola con i suoi
   strass e resta tempestato anche nel titolo del progetto.

   Come funziona:
   1. la scritta (in Anton) si disegna su un canvas nascosto: è la sagoma;
   2. la sagoma si riempie di cristalli trasparenti, prima i grandi e poi i
      piccoli negli spazi rimasti (una volta per progetto, in "em": vale per
      ogni misura). Sotto, la lettera è dipinta nel colore del progetto;
   3. un solo motore Three.js, fuori dalla pagina, disegna le pietre e copia
      il risultato in un canvas 2D dentro il nome. Così i canvas WebGL restano
      pochi, e il disegno scorre, si sposta e vola insieme al testo.
   ========================================================================== */

import * as THREE from 'three';
import { casuale, geometriaPietra, materialeGemma, pietre } from './strass.js';

const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- REGOLAZIONI ---------- */
const REGOLA = {
  misure: [0.05, 0.038, 0.028, 0.019, 0.012],   // i raggi delle pietre, in em: dalle grandi alle piccole
  vicinanza: 0.94,                               // quanto possono avvicinarsi due pietre (1 = si toccano)
  comparsa: 0.9,                                 // quanto dura la comparsa degli strass (secondi)
  inclinazione: 0.14,                            // quanto il nome si inclina verso il mouse (radianti)
  margine: 0.06,                                 // spazio intorno alle lettere nel canvas, in em
};

// i colori dei progetti: quelli dei nomi nella lista, così al passaggio la scritta non cambia tinta.
// Dipendono dal tema: --sopra sul fondo scuro, --c1 (più scuro, per il contrasto) sul fondo chiaro
const voci = {};
// ogni voce ha il suo nome: data-voce (il progetto, o la versione del portfolio)
const chiaveDi = (v) => v.dataset.voce || v.getAttribute('href').slice(1);
document.querySelectorAll('.elenco-progetti__voce[data-strass]').forEach((v) => { voci[chiaveDi(v)] = v; });
function colore(id) {
  const v = voci[id];
  if (!v) return null;
  const stile = getComputedStyle(v), chiaro = document.documentElement.dataset.tema === 'chiaro';
  return stile.getPropertyValue(chiaro ? '--c1' : '--sopra').trim() || v.dataset.strass;
}

let motore = null;
try {
  motore = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch (errore) { /* senza WebGL i nomi restano scritti normalmente */ }

if (motore && Object.keys(voci).length) avvia();

function avvia() {
  motore.setClearColor(0x000000, 0);
  motore.outputColorSpace = THREE.SRGBColorSpace;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // la pietra di sempre, con in più la comparsa: ogni pietra cresce quando arriva il suo turno
  const materiale = materialeGemma();
  materiale.uniforms = { uComparsa: { value: 1 } };
  materiale.vertexShader = materiale.vertexShader
    .replace('void main(){', 'attribute float aTurno; uniform float uComparsa;\n      void main(){')
    .replace('vec4 w = m * vec4(position, 1.0);', 'float s = smoothstep(aTurno, aTurno + 0.22, uComparsa); s *= 1.0 + 0.35 * sin(s * 3.1416);   // un piccolo salto, come una pietra appena premuta\n        vec4 w = m * vec4(position * s, 1.0);');

  // il cristallo è trasparente: dove il vetro non riflette si vede la lettera dipinta sotto
  // (il suo colore, con il bordo della pietra appena in ombra); sopra restano le luci chiare
  materiale.fragmentShader = materiale.fragmentShader.replace(
    'gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);',
    'float luce = max(c.r, max(c.g, c.b)); c = mix(vTinta * bordo * volume, c, smoothstep(0.35, 0.95, luce)); gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);');

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);

  /* ---------- 1 e 2. La sagoma e le pietre, una volta per progetto ---------- */
  const RIF = 200;   // la misura della scritta su cui si calcolano le pietre, in pixel
  const disposizioni = new Map();
  function disponi(id, testo) {
    const quale = `${id} ${colore(id)}`;   // una disposizione per progetto e per tema
    if (disposizioni.has(quale)) return disposizioni.get(quale);
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    g.font = `${RIF}px Anton`;
    const m = g.measureText(testo), pad = 10;
    const su = m.actualBoundingBoxAscent, giu = m.actualBoundingBoxDescent;
    c.width = Math.ceil(m.width) + pad * 2; c.height = Math.ceil(su + giu) + pad * 2;
    g.font = `${RIF}px Anton`;
    g.fillStyle = '#fff';
    g.fillText(testo, pad, pad + su);
    const alfa = g.getImageData(0, 0, c.width, c.height).data;
    // dentro la lettera? (coordinate dalla linea di base, in pixel di riferimento)
    const dentro = (x, y) => {
      const px = Math.round(x + pad), py = Math.round(y + pad + su);
      return px >= 0 && py >= 0 && px < c.width && py < c.height && alfa[(py * c.width + px) * 4 + 3] > 128;
    };
    const dado = casuale(testo.length * 977 + testo.charCodeAt(0));
    const gemme = [], CELLA = REGOLA.misure[0] * RIF * 2.2, celle = new Map();
    const chiave = (x, y) => `${Math.floor(x / CELLA)},${Math.floor(y / CELLA)}`;
    const libera = (x, y, r) => {
      const cx = Math.floor(x / CELLA), cy = Math.floor(y / CELLA);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const p of celle.get(`${cx + i},${cy + j}`) || []) if (Math.hypot(p.x - x, p.y - y) < (p.r + r) * REGOLA.vicinanza) return false;
      }
      return true;
    };
    // la pietra sta tutta dentro la lettera: il centro e otto punti sul suo bordo
    const sta = (x, y, r) => {
      if (!dentro(x, y)) return false;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (!dentro(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8)) return false; }
      return true;
    };
    for (const misura of REGOLA.misure) {
      const r = misura * RIF, fitto = r * 0.7, punti = [];
      for (let y = -su; y < giu; y += fitto) for (let x = 0; x < m.width; x += fitto) punti.push({ x: x + (dado() - 0.5) * fitto, y: y + (dado() - 0.5) * fitto });
      // in ordine casuale: le pietre si incastrano come vengono, non in righe ordinate
      for (let i = punti.length - 1; i > 0; i--) { const j = Math.floor(dado() * (i + 1)); [punti[i], punti[j]] = [punti[j], punti[i]]; }
      for (const p of punti) {
        if (!sta(p.x, p.y, r) || !libera(p.x, p.y, r)) continue;
        const g = { x: p.x, y: p.y, r };
        const k = chiave(p.x, p.y);
        if (!celle.has(k)) celle.set(k, []);
        celle.get(k).push(g);
        gemme.push(g);
      }
    }
    // il turno di ogni pietra: dal centro della scritta verso i bordi, con un po' di disordine
    const cx = m.width / 2, cy = (giu - su) / 2, lontano = Math.hypot(cx, su + giu);
    // i colori: le pietre sono cristalli trasparenti, come quelli della lattina. Il vetro prende
    // appena il colore della lettera dipinta che c'è sotto (si vede attraverso, vedi il materiale)
    const base = new THREE.Color(colore(id) || '#ffffff'), bianco = new THREE.Color(1, 1, 1);
    const tinta = new THREE.Color();
    const voci = gemme.map((g) => {
      tinta.copy(base).lerp(bianco, 0.05 + dado() * 0.12);
      const c = tinta.getRGB({}, THREE.SRGBColorSpace);   // in sRGB, come li vuole pietre()
      return {
        x: g.x / RIF, y: g.y / RIF, r: g.r / RIF,
        turno: Math.min(1, Math.hypot(g.x - cx, g.y - cy) / lontano) * 0.8 + dado() * 0.2,
        colore: [c.r, c.g, c.b],
      };
    });
    const d = { voci, su: su / RIF, giu: giu / RIF, largo: m.width / RIF };
    disposizioni.set(quale, d);
    return d;
  }

  /* ---------- 3. Un nome sulla pagina: il suo canvas e le sue pietre ---------- */
  const nomi = new Map();
  function prepara(el, id) {
    const stile = getComputedStyle(el);
    const F = parseFloat(stile.fontSize);
    if (!F) return null;
    const vecchio = nomi.get(el);
    if (vecchio && vecchio.F === F && vecchio.tinta === colore(id)) return vecchio;
    if (vecchio) { vecchio.mesh.geometry.dispose(); vecchio.tela.remove(); }
    const testo = el.textContent.trim().toUpperCase();
    const d = disponi(id, testo);
    // dove sta la linea di base dentro il nome: a metà dell'interlinea, come fa il browser
    const misuratore = document.createElement('canvas').getContext('2d');
    misuratore.font = `${F}px Anton`;
    const mt = misuratore.measureText(testo);
    const interlinea = parseFloat(stile.lineHeight) || F;
    const base = (interlinea - (mt.fontBoundingBoxAscent + mt.fontBoundingBoxDescent)) / 2 + mt.fontBoundingBoxAscent;
    const pad = REGOLA.margine * F;
    const larghezza = d.largo * F + pad * 2, altezza = (d.su + d.giu) * F + pad * 2;
    const sinistra = -pad, sopra = base - d.su * F - pad;
    const tela = document.createElement('canvas');
    tela.className = 'nome-strass';
    tela.setAttribute('aria-hidden', 'true');
    tela.width = Math.ceil(larghezza * dpr); tela.height = Math.ceil(altezza * dpr);
    Object.assign(tela.style, { left: `${sinistra}px`, top: `${sopra}px`, width: `${larghezza}px`, height: `${altezza}px` });
    el.append(tela);
    el.style.setProperty('--strass', colore(id) || 'currentColor');
    // le pietre, in pixel del canvas (la y di Three.js va verso l'alto)
    const forma = geometriaPietra({ semplice: true });
    forma.setAttribute('aTurno', new THREE.InstancedBufferAttribute(new Float32Array(d.voci.map((v) => v.turno)), 1));
    const mesh = pietre(d.voci.map((v) => ({
      p: new THREE.Vector3(pad + v.x * F, -(pad + (v.y + d.su) * F), 0),
      n: new THREE.Vector3(0, 0, 1),
      r: v.r * F,
      colore: v.colore,
    })), materiale, forma);
    const gruppo = new THREE.Group(), scena = new THREE.Scene();
    gruppo.position.set(larghezza / 2, -altezza / 2, 0);
    mesh.position.set(-larghezza / 2, altezza / 2, 0);
    gruppo.add(mesh);
    scena.add(gruppo);
    const n = { el, id, F, tinta: colore(id), tela, ctx: tela.getContext('2d'), mesh, gruppo, scena, larghezza, altezza, giroX: 0, giroY: 0 };
    nomi.set(el, n);
    return n;
  }

  function disegna(n, comparsa) {
    motore.setPixelRatio(dpr);
    motore.setSize(n.larghezza, n.altezza, false);
    // la camera guarda il centro del nome da vicino: le pietre ai lati riflettono un'altra parte della stanza
    Object.assign(camera, { left: -n.larghezza / 2, right: n.larghezza / 2, top: n.altezza / 2, bottom: -n.altezza / 2 });
    camera.position.set(n.larghezza / 2, -n.altezza / 2, Math.max(400, n.larghezza * 0.7));
    camera.updateProjectionMatrix();
    n.gruppo.rotation.set(n.giroX, n.giroY, 0);
    materiale.uniforms.uComparsa.value = comparsa;
    motore.render(n.scena, camera);
    n.ctx.clearRect(0, 0, n.tela.width, n.tela.height);
    n.ctx.drawImage(motore.domElement, 0, 0, n.tela.width, n.tela.height);
  }

  // un nome tutto tempestato, fermo
  function tempesta(el, id) {
    const n = prepara(el, id);
    if (!n) return null;
    n.giroX = 0; n.giroY = 0;
    disegna(n, 1.3);
    el.classList.add('e-strass');
    return n;
  }

  // senza mouse (telefono, tablet) nessuno passa sul nome nella lista: quando il progetto si apre,
  // il titolo si riempie di strass da solo, una pietra dopo l'altra, e ondeggia un attimo per brillare
  const senzaMouse = window.matchMedia('(hover: none)');
  function brilla(el, id, ritardo = 0) {
    const n = prepara(el, id);
    if (!n) return null;
    el.classList.add('e-strass');
    if (menoMovimento) { n.giroX = 0; n.giroY = 0; disegna(n, 1.3); return n; }
    if (n.brillaFino && performance.now() < n.brillaFino) return n;   // sta già brillando
    const via = performance.now() + ritardo, durata = REGOLA.comparsa * 1000 * 1.8;
    n.brillaFino = via + durata;
    n.giroX = 0; n.giroY = 0;
    disegna(n, 0);   // vuoto finché non tocca a lui
    const passo = (ora) => {
      const k = Math.max(0, (ora - via) / (REGOLA.comparsa * 1000));
      const smorza = Math.max(0, 1 - k / 1.8);
      n.giroY = Math.sin(k * 3.2) * REGOLA.inclinazione * 1.4 * smorza;
      n.giroX = Math.sin(k * 2.1 + 1) * REGOLA.inclinazione * 0.6 * smorza;
      disegna(n, Math.min(1.3, k));
      if (ora < n.brillaFino) requestAnimationFrame(passo);
      else { n.giroX = 0; n.giroY = 0; disegna(n, 1.3); }
    };
    requestAnimationFrame(passo);
    return n;
  }

  /* ---------- Nella lista: gli strass compaiono al passaggio ---------- */
  let attivo = null, inizio = 0, puntatore = null, inCorsa = false;
  function giro(adesso) {
    if (!attivo) { inCorsa = false; return; }
    const n = attivo;
    const comparsa = menoMovimento ? 1.3 : Math.min(1.3, (adesso - inizio) / 1000 / REGOLA.comparsa);
    // il nome si inclina appena verso il mouse: le faccette prendono la luce e brillano
    if (puntatore && !menoMovimento) {
      const box = n.tela.getBoundingClientRect();
      const px = THREE.MathUtils.clamp((puntatore[0] - box.left) / box.width * 2 - 1, -1, 1);
      const py = THREE.MathUtils.clamp((puntatore[1] - box.top) / box.height * 2 - 1, -1, 1);
      n.giroY += (px * REGOLA.inclinazione - n.giroY) * 0.12;
      n.giroX += (py * REGOLA.inclinazione * 0.6 - n.giroX) * 0.12;
    }
    disegna(n, comparsa);
    if (menoMovimento) inCorsa = false;
    else requestAnimationFrame(giro);
  }
  function accendi(voce) {
    const nome = voce.querySelector('.elenco-progetti__nome');
    const n = prepara(nome, chiaveDi(voce));
    if (!n) return;
    attivo = n; inizio = performance.now(); n.giroX = 0; n.giroY = 0;
    nome.classList.add('e-strass');
    if (!inCorsa) { inCorsa = true; requestAnimationFrame(giro); }   // un giro solo, anche passando da un nome all'altro
  }
  function spegni(voce) {
    const nome = voce.querySelector('.elenco-progetti__nome');
    if (attivo && attivo.el === nome) attivo = null;
    nome.classList.remove('e-strass');
  }
  window.addEventListener('pointermove', (e) => { puntatore = [e.clientX, e.clientY]; }, { passive: true });
  Object.values(voci).forEach((voce) => {
    voce.addEventListener('pointerenter', () => accendi(voce));
    voce.addEventListener('pointerleave', () => spegni(voce));
    voce.addEventListener('focus', () => accendi(voce));
    voce.addEventListener('blur', () => spegni(voce));
  });

  /* ---------- Nei progetti: il titolo resta tempestato ---------- */
  const titolo = (id) => document.querySelector(`#${CSS.escape(id)} .pannello__nome`);
  function titoloAperto() {
    const id = location.hash.slice(1);
    if (!colore(id) || !titolo(id)) return;
    // sul telefono il titolo si riempie dopo che il pannello si è aperto (o che il nome è atterrato)
    if (senzaMouse.matches) brilla(titolo(id), id, 950);
    else tempesta(titolo(id), id);
  }
  window.addEventListener('hashchange', titoloAperto);
  // cambiando misura della finestra o tema, i nomi tempestati si ridisegnano (misure e colori nuovi)
  const ridisegna = () => { for (const n of [...nomi.values()]) if (n.el.classList.contains('e-strass') && !(n.brillaFino > performance.now())) tempesta(n.el, n.id); };
  let attesa;
  window.addEventListener('resize', () => { clearTimeout(attesa); attesa = setTimeout(ridisegna, 200); });
  new MutationObserver(ridisegna).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

  // quello che serve a progetti.js: il titolo del progetto, e la copia che vola con i suoi strass
  window.nomiStrass = {
    titolo(el) {
      const id = el.closest('[data-pannello]')?.id;
      if (!id || !colore(id)) return null;
      return senzaMouse.matches ? brilla(el, id, 900) : tempesta(el, id);
    },
    vesti(da, copia) {
      const n = nomi.get(da);
      if (!n || !da.classList.contains('e-strass')) return null;
      // cliccando a metà comparsa, il nome si completa subito: vola già tutto tempestato
      if (attivo === n) inizio = -Infinity;
      disegna(n, 1.3);
      const tela = n.tela.cloneNode();
      tela.getContext('2d').drawImage(n.tela, 0, 0);
      copia.style.setProperty('--strass', colore(n.id));
      copia.classList.add('e-strass');
      copia.append(tela);
      return tela;
    },
  };

  document.fonts.load(`${RIF}px Anton`).then(titoloAperto);
}
