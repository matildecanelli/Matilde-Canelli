/* ==========================================================================
   stella.js: la stella di strass, il caricamento e lo scroll (Three.js + GSAP)

   L'idea, in quattro passi:
   1. La stella di Matilde (il suo PNG) viene riempita di strass di misure
      diverse, come quando si tempesta una forma a mano: prima le pietre
      grandi, poi le piccole negli spazi rimasti.
   2. All'apertura gli strass compaiono uno a uno, dal centro verso le punte:
      è lo stato di caricamento della pagina. Nessuna attesa obbligatoria:
      si può scorrere subito.
   3. Gli strass sono cristallo; la luce sta sopra il mouse e i riflessi
      vicini prendono i colori dei progetti, che cambiano a caso.
   4. Scorrendo (GSAP + ScrollTrigger, con "scrub": il movimento segue lo
      scroll e torna indietro se torni su) la stella scende, entrano il nome,
      il ruolo e il menu. Poi la pagina scorre normalmente.
   ========================================================================== */

import * as THREE from 'three';

const canvas = document.querySelector('[data-scena]');
const palcoEl = document.querySelector('[data-palco]');
const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Le voci del menu; i primi cinque sono i progetti, con il colore dei loro riflessi
const voci = [...document.querySelectorAll('[data-voce]')].map((a, i) => ({
  id: a.dataset.voce,
  colore: a.dataset.strass || '',
  menu: a,
  progetto: Boolean(a.dataset.strass),   // le cinque gemme del pannello Progetti portano il colore del progetto
}));

/* ---------- REGOLAZIONI: i numeri da cambiare per tarare l'effetto ---------- */
const REGOLA = {
  // la stella all'inizio, da sola al centro: altezza rispetto allo schermo
  stellaInizio: { computer: 0.78, telefono: 0.6 },
  // dove arriva la stella alla fine dello scroll (frazioni dello schermo, 0.5 = centro)
  // e quanto rimpicciolisce (1 = uguale)
  stellaFine: {
    computer: { x: 0.74, y: 0.7, scala: 0.6 },
    telefono: { x: 0.5, y: 0.5, scala: 0.55 },   // sul telefono si rimpicciolisce sul posto e svanisce
  },
  scroll: { computer: 0.9, telefono: 0.7 },   // quanto si scorre per tutta l'animazione (in schermi)
  fluidita: 0.8,                              // quanto il movimento "insegue" lo scroll (secondi; 0 = rigido)
  comparsa: 1.6,                              // quanto durano gli strass che compaiono all'apertura (secondi)
  // gli strass, come nella stella di cristalli: misure diverse, le piccole negli spazi tra le grandi.
  // misura = la pietra più grande (rispetto alla stella); misure = le altre, in proporzione
  strass: { misura: 0.017, misure: [1, 0.85, 0.55, 0.35, 0.22], vicinanza: 0.9, versoDiNoi: 0.3 },
  // i colori: cristalli aurora boreale (pastello cangiante) su un corpo cromato arcobaleno
  iride: { pastello: 0.22, bande: 0.35, corpo: 1 },   // quanto bianco nei cristalli, quanto larghe le macchie di colore, quanto acceso il corpo
  // il giro durante lo scroll: la stella fa una capriola su tutti e tre gli assi
  // (da destra a sinistra, dall'alto in basso e su sé stessa), poi resta inclinata e appoggiata al nome
  giro: { voltaX: 1, voltaY: 1, voltaZ: 1, finaleY: 35, finaleZ: -14, finaleX: 8 },   // giri interi e gradi finali
  // il corpo 3D della stella: quanto sono larghe le braccia (0..1), quanto sono tonde punte e insenature,
  // quanto è largo il bordo arrotondato, quanto è gonfia, quanto è gonfio il retro
  forma3d: { braccia: 0.44, tondo: 0.17, tubo: 0.3, spessore: 0.42, retro: 0.75 },
  inclinazione: 0.5,                          // quanto la stella si inclina seguendo il mouse (radianti)
  riflessoScuro: 1.3,                         // nel tema scuro i riflessi sono un po' più luminosi, per staccare dal fondo
  riflessoChiaro: 1.0,
  raggioLuce: 80,                             // quanto è larga la "pozza" di luce del mouse, in pixel
  altezzaLuce: 200,                           // quanto è alta la luce: più bassa = riflessi più radenti
  forzaColore: 0.85,                          // quanto i riflessi vicino al mouse prendono il colore dei progetti
  arcobaleno: 0.45,                           // quanto colore si vede sulle faccette anche lontano dal mouse
  cambioColore: 1.4,                          // ogni quanti secondi (circa) arriva un colore nuovo
  luccichio: 1,                               // le scintille a forma di stella sugli strass (0 = spente)
};

let motore;
try {
  motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (errore) {
  document.documentElement.classList.add('senza-webgl');
}
if (motore) avvia();

function avvia() {
  motore.setClearColor(0x000000, 0);           // trasparente: dietro c'è il nero della pagina e il nome
  motore.outputColorSpace = THREE.SRGBColorSpace;
  const stretto = () => window.innerWidth < 640 || window.innerWidth / window.innerHeight < 1;

  // Camera ortografica in pixel: un pixel dello schermo è un'unità della scena
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -3000, 3000);   // profonda: la stella ora è in 3D
  camera.position.z = 10;
  const scena = new THREE.Scene();
  const stella = new THREE.Group();              // la stella intera: si sposta e si scala tutta insieme
  scena.add(stella);
  const giroG = new THREE.Group();               // il giro su sé stessa durante lo scroll
  stella.add(giroG);
  const corpo = new THREE.Group();               // dentro: la stella che si inclina seguendo il mouse
  giroG.add(corpo);
  // niente luci di Three.js: corpo e strass hanno la loro luce negli shader (sopra il mouse)

  /* ---------- 1. La pietra: una forma sola, con le faccette ---------- */
  // Uno strass vero, a fondo piatto, come quelli della foto:
  // - la cintura: un bordino dritto tutto intorno (resta scuro e disegna il cerchio della pietra);
  // - la corona: 16 punti sul bordo e 8 a metà altezza, girati di mezzo passo, formano
  //   triangoli alternati; sopra, 8 faccette salgono fino alla punta centrale.
  // Visto dall'alto è la "stella" di faccette che spacca la luce in tanti spicchi.
  function pietraStrass() {
    const BORDO = 16, MEZZO = 8;
    const zCintura = 0.12, zMezzo = 0.34, zPunta = 0.44, rMezzo = 0.5;
    const sulBordo = (k, z) => { const a = (k / BORDO) * Math.PI * 2; return [Math.cos(a), Math.sin(a), z]; };
    const aMeta = (j) => { const a = ((2 * j + 1) / BORDO) * Math.PI * 2; return [Math.cos(a) * rMezzo, Math.sin(a) * rMezzo, zMezzo]; };
    const tri = [];
    // ogni triangolo con la faccia verso fuori (la normale deve guardare in su o di lato, mai dentro)
    const aggiungi = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nz = ux * vy - uy * vx, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz;
      const fuori = nz * 1 + nx * (a[0] + b[0] + c[0]) + ny * (a[1] + b[1] + c[1]);
      tri.push(...(fuori >= 0 ? [a, b, c] : [a, c, b]));
    };
    for (let k = 0; k < BORDO; k++) {
      // la cintura: un quadratino dritto
      aggiungi(sulBordo(k, 0), sulBordo(k + 1, 0), sulBordo(k + 1, zCintura));
      aggiungi(sulBordo(k, 0), sulBordo(k + 1, zCintura), sulBordo(k, zCintura));
    }
    for (let j = 0; j < MEZZO; j++) {
      const m = aMeta(j), m2 = aMeta(j + 1);
      aggiungi(sulBordo(2 * j, zCintura), sulBordo(2 * j + 1, zCintura), m);
      aggiungi(sulBordo(2 * j + 1, zCintura), sulBordo(2 * j + 2, zCintura), m);
      aggiungi(m, sulBordo(2 * j + 2, zCintura), m2);
      aggiungi(m, m2, [0, 0, zPunta]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
    geo.computeVertexNormals();                  // ogni triangolo ha la sua normale: faccette nette
    return geo;
  }
  const pietra = pietraStrass();

  // i colori dei progetti, presi dal menu (data-strass)
  const palette = voci.filter((v) => v.progetto && v.colore).map((v) => new THREE.Color(v.colore));
  const casuale = () => palette[Math.floor(Math.random() * palette.length)].clone();

  const tempo = { value: 0 };
  const uniformi = {
    uTempo: tempo,
    uComparsa: { value: menoMovimento ? 2 : 0 },            // da 0 a 1: quanti strass sono già comparsi
    uPastello: { value: REGOLA.iride.pastello },             // quanto bianco nei cristalli
    uForzaCorpo: { value: REGOLA.iride.corpo },
    uForzaRiflesso: { value: 1 },                            // nel tema scuro i riflessi sono un po' più luminosi
    uPuntatore: { value: new THREE.Vector2(0, 0) },
    uRaggioLuce: { value: REGOLA.raggioLuce },
    uAltezza: { value: REGOLA.altezzaLuce },
    uTintaA: { value: casuale() },
    uTintaB: { value: casuale() },
    uForzaColore: { value: REGOLA.forzaColore },
    uLuccichio: { value: REGOLA.luccichio },
    uArcobaleno: { value: REGOLA.arcobaleno },
  };
  const materiale = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,          // il tornio gira le facce: le disegniamo da entrambi i lati
    uniforms: uniformi,
    vertexShader: `
      attribute vec3 aColore; attribute float aFase; attribute float aNascita;
      uniform vec2 uPuntatore; uniform float uRaggioLuce; uniform float uAltezza; uniform float uComparsa;
      varying vec3 vN; varying vec3 vColore; varying float vFase;
      varying vec3 vL; varying float vVicino; varying float vLato;
      void main(){
        // la comparsa: ogni strass nasce al suo momento, con un piccolo "pop" oltre la misura
        float k = clamp((uComparsa - aNascita) / 0.12, 0.0, 1.0);
        float misura = k * k * (3.0 - 2.0 * k) * (1.0 + 0.25 * sin(k * 3.1416));
        // la luce sta sopra il puntatore: ogni gemma la vede arrivare da una direzione diversa
        vec4 centro = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec2 verso = uPuntatore - centro.xy;
        vL = normalize(vec3(verso, uAltezza));
        vVicino = exp(-dot(verso, verso) / (2.0 * uRaggioLuce * uRaggioLuce));   // 1 sotto il mouse, 0 lontano
        vLato = clamp(0.5 - verso.x / (uRaggioLuce * 2.0), 0.0, 1.0);           // per la sfumatura tra i due colori
        vN = normalize(mat3(modelViewMatrix) * mat3(instanceMatrix) * normal);
        vColore = aColore; vFase = aFase;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * misura, 1.0);
      }`,
    fragmentShader: `
      uniform float uPastello; uniform float uForzaRiflesso;
      varying vec3 vN; varying vec3 vColore; varying float vFase;
      varying vec3 vL; varying float vVicino; varying float vLato;
      // l'arcobaleno: un numero (0..1) diventa un colore, e il giro ricomincia
      vec3 iride(float t){ return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){
        vec3 n = normalize(vN);
        if (n.z < 0.0) n = -n;                       // guardiamo sempre la faccia davanti
        vec3 l = normalize(vL);
        vec3 meta = normalize(l + vec3(0.0, 0.0, 1.0));
        // Il cristallo vero non ha sfumature morbide: ogni faccetta è uno specchio piatto
        // che rimanda un pezzo diverso della stanza. Quindi faccette vicine sono molto
        // diverse: una bianca accesa, una quasi nera, una colorata (il "fuoco" arcobaleno
        // degli strass aurora boreale). È questo contrasto che fa sembrare cristallo e non perla.
        vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);                  // cosa rispecchia la faccetta
        float caso = fract(sin(dot(floor(n * 9.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        // la "stanza": due finestre luminose e la luce del mouse, con bordi netti
        float stanza = smoothstep(0.45, 0.6, r.y) * 0.9
                     + smoothstep(0.75, 0.85, dot(r, normalize(vec3(-0.7, -0.2, 0.7)))) * 0.7
                     + pow(max(dot(r, l), 0.0), 30.0) * 1.6;
        float lato = 1.0 - clamp(n.z, 0.0, 1.0);
        float tono = vColore.x + atan(n.y, n.x) * 0.12 + caso * 0.3;  // il fuoco cambia colore faccetta per faccetta
        vec3 fuoco = mix(iride(tono), vec3(1.0), uPastello);
        vec3 c = fuoco * (0.3 + 0.7 * caso);                          // la faccetta "spenta": dal colore scuro al colore pieno
        c += mix(fuoco, vec3(1.0), 0.35) * stanza;                    // quella che rispecchia una luce: quasi bianca
        c *= mix(1.0, 0.35, smoothstep(0.75, 0.95, lato));            // la cintura dritta resta scura: disegna il cerchio
        // il punto di luce: piccolissimo e vivo
        float punto = pow(max(dot(n, meta), 0.0), 260.0);
        c += vec3(1.0) * punto * 2.0 * uForzaRiflesso;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });

  /* ---------- 2. Gli strass: si leggono dalla forma della stella ---------- */
  const stellaImg = new Image();
  stellaImg.src = 'assets/img/stella.png';

  // dove sta davvero la stella dentro il PNG (fuori è tutto trasparente)
  let sagoma = null;
  function misuraSagoma() {
    const c = document.createElement('canvas');
    c.width = stellaImg.naturalWidth; c.height = stellaImg.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(stellaImg, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      if (d[(y * c.width + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    sagoma = { x0, y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------- La stella 3D: un palloncino a cinque punte ----------
     1. Il contorno: una stella a punte vere, poi "gonfiata" di qualche pixel
        tutto intorno. Così le braccia restano affusolate ma le punte e le
        insenature diventano tonde, come la stella cromata della foto.
     2. Lo spessore: si misura quanto un punto è lontano dal bordo. Vicino al
        bordo la superficie sale come un tubo tondo (un quarto di cerchio);
        verso il centro si alza ancora un poco. Il retro è uguale ma più basso. */
  const F = REGOLA.forma3d;
  // distanza dal bordo di una stella a cinque punte vere, punta in alto
  // (negativa dentro, positiva fuori; raggio delle punte r, rf = quanto sono larghe le braccia)
  function distanzaStella(x, y, r, rf) {
    const k1x = 0.809016994375, k1y = -0.587785252292;
    let px = Math.abs(x), py = y, d;
    d = Math.max(k1x * px + k1y * py, 0); px -= 2 * d * k1x; py -= 2 * d * k1y;
    d = Math.max(-k1x * px + k1y * py, 0); px -= 2 * d * -k1x; py -= 2 * d * k1y;
    px = Math.abs(px); py -= r;
    const bax = rf * -k1y, bay = rf * k1x - 1;
    const h = Math.min(Math.max((px * bax + py * bay) / (bax * bax + bay * bay), 0), r);
    const qx = px - bax * h, qy = py - bay * h;
    return Math.hypot(qx, qy) * Math.sign(py * bax - px * bay);
  }
  // la stella tonda: quella a punte vere, più piccola, gonfiata di "tondo" tutto intorno
  const bordoStella = (x, y, R) => distanzaStella(x, y, R * (1 - F.tondo), F.braccia) - R * F.tondo;
  // per il corpo serve il raggio del bordo in ogni direzione: lo si cerca dimezzando
  function raggioIn(ang, R) {
    let dentro = 0, fuori = R * 1.2;
    for (let i = 0; i < 24; i++) {
      const m = (dentro + fuori) / 2;
      if (bordoStella(Math.cos(ang) * m, Math.sin(ang) * m, R) < 0) dentro = m; else fuori = m;
    }
    return dentro;
  }
  // altezza del palloncino nel punto (x, y)
  function altezza(x, y, R, H) {
    const d = -bordoStella(x, y, R);                     // quanto è dentro, in pixel
    if (d <= 0) return 0;
    const tubo = R * F.tubo;                             // quanto è largo il "tubo" tondo del bordo
    const s = Math.min(d / tubo, 1);
    const tondo = Math.sqrt(1 - (1 - s) * (1 - s));      // un quarto di cerchio: sale ripido, poi piano
    const cupola = Math.min(d / (R * 0.5), 1);           // il centro si alza ancora un poco
    return H * tondo * (0.82 + 0.18 * cupola);
  }

  function corpoStella(R, H) {
    const GIRI = 300, ANELLI = 64;
    const pos = [], idx = [];
    const raggi = [];
    for (let i = 0; i < GIRI; i++) raggi.push(raggioIn((i / GIRI) * Math.PI * 2, R));
    // fronte (lato = 1) e retro (lato = -1, più basso)
    for (const lato of [1, -1]) {
      const base = pos.length / 3;
      for (let j = 0; j <= ANELLI; j++) {
        const rn = Math.sin((j / ANELLI) * Math.PI / 2);   // anelli più fitti vicino al bordo, dove la curva è stretta
        for (let i = 0; i < GIRI; i++) {
          const ang = (i / GIRI) * Math.PI * 2;
          const r = raggi[i] * rn;
          const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
          pos.push(x, y, lato * (lato > 0 ? 1 : F.retro) * altezza(x, y, R, H));
        }
      }
      for (let j = 0; j < ANELLI; j++) for (let i = 0; i < GIRI; i++) {
        const p = base + j * GIRI + i, q = base + j * GIRI + (i + 1) % GIRI;
        const p2 = p + GIRI, q2 = q + GIRI;
        if (lato > 0) idx.push(p, p2, q, q, p2, q2); else idx.push(p, q, p2, q, q2, p2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, materialeCorpo);
  }

  // Il corpo: cromato arcobaleno, come la seconda stella della foto. Il colore cambia
  // con la direzione della superficie (verso il bordo scorre tutto lo spettro), con
  // bande più scure come i riflessi di uno specchio curvo e un lampo sotto la luce del mouse.
  const materialeCorpo = new THREE.ShaderMaterial({
    uniforms: uniformi,
    vertexShader: `
      varying vec3 vN; varying vec3 vPos;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        vPos = p.xyz;
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      uniform vec2 uPuntatore; uniform float uAltezza; uniform float uForzaRiflesso; uniform float uForzaCorpo;
      varying vec3 vN; varying vec3 vPos;
      vec3 iride(float t){ return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){
        vec3 n = normalize(vN);
        vec3 l = normalize(vec3(uPuntatore - vPos.xy, uAltezza));
        float bordo = 1.0 - clamp(n.z, 0.0, 1.0);                   // 0 dove guarda verso di noi, 1 sul fianco
        vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);                    // cosa "rispecchia" la superficie
        vec3 c = iride(bordo * 1.3 + n.x * 0.35 - n.y * 0.25 + 0.1) * uForzaCorpo;
        c *= 0.55 + 0.45 * smoothstep(-0.6, 0.4, sin(r.y * 5.0 + r.x * 2.0));   // le bande dello specchio
        c += pow(max(dot(r, l), 0.0), 40.0) * 0.9 * uForzaRiflesso;            // il lampo di luce
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });

  // Gli strass come nella stella di cristalli: misure diverse, attaccate una all'altra.
  // Si fa come a mano: prima si posano le pietre grandi in punti a caso, finché non c'è
  // più spazio; poi le medie negli spazi rimasti, poi le piccole e le piccolissime,
  // che chiudono i buchi. Ogni pietra è appoggiata sulla superficie e inclinata come lei.
  function riempi(alta) {
    const R = alta / 2, H = R * REGOLA.forma3d.spessore;
    const rMax = Math.max(3, alta * REGOLA.strass.misura);     // il raggio della pietra più grande
    const gemme = [];
    const CELLA = rMax * 2.2, celle = new Map();
    const chiave = (x, y) => `${Math.floor(x / CELLA)},${Math.floor(y / CELLA)}`;
    const aggiungi = (g) => { g.h = altezza(g.x, g.y, R, H); const k = chiave(g.x, g.y); if (!celle.has(k)) celle.set(k, []); celle.get(k).push(g); gemme.push(g); };
    // c'è posto per una pietra di raggio r? La distanza si misura in 3D (anche in altezza):
    // sul fianco ripido due pietre vicine "dall'alto" possono essere lontane sulla superficie
    const libera = (x, y, r) => {
      const h = altezza(x, y, R, H);
      const cx = Math.floor(x / CELLA), cy = Math.floor(y / CELLA);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const g of celle.get(`${cx + i},${cy + j}`) || []) if (Math.hypot(g.x - x, g.y - y, g.h - h) < (g.r + r) * REGOLA.strass.vicinanza) return false;
      }
      return true;
    };
    for (const f of REGOLA.strass.misure) {
      const r = Math.max(1.6, rMax * f);
      // tanti punti candidati, un po' spostati a caso e in ordine casuale: così le pietre
      // non si mettono in righe ordinate ma si incastrano come vengono
      const fitto = r * 0.7, punti = [];
      for (let y = -R; y < R; y += fitto) for (let x = -R; x < R; x += fitto) {
        const px = x + (Math.random() - 0.5) * fitto, py = y + (Math.random() - 0.5) * fitto;
        if (bordoStella(px, py, R) < -r * 0.5) punti.push({ x: px, y: py });
      }
      for (let i = punti.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [punti[i], punti[j]] = [punti[j], punti[i]]; }
      for (const p of punti) if (libera(p.x, p.y, r)) aggiungi({ x: p.x, y: p.y, r });
    }
    // 2. il fianco: lì la superficie è quasi verticale, e guardando "dall'alto" non c'è
    //    spazio per mettere pietre (resterebbe una fascia di cromo nudo quando la stella
    //    è di taglio). Quindi il fianco si riveste a parte, girandoci intorno a file:
    //    per ogni altezza si segue il contorno della stella e si posano le pietre lì,
    //    sempre dalle grandi alle piccole, senza toccare quelle davanti e dietro.
    const retro = REGOLA.forma3d.retro;
    const Hb = H * 0.82, tubo = R * REGOLA.forma3d.tubo;
    const fianco = [], celleF = new Map();
    // quanto è rientrata la superficie dal bordo, all'altezza z (davanti z > 0, dietro z < 0)
    const rientro = (z) => { const k = Math.min(Math.abs(z) / (Hb * (z < 0 ? retro : 1)), 0.999); return tubo * (1 - Math.sqrt(1 - k * k)); };
    // il contorno si misura una volta sola: punti fitti a passo regolare lungo il bordo,
    // ognuno con la sua direzione "verso fuori". Per rientrare di d basta tornare indietro di d.
    const contorno = [];
    {
      const grezzo = [];
      for (let i = 0; i <= 2000; i++) { const a = (i / 2000) * Math.PI * 2, rr = raggioIn(a, R); grezzo.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      let strada = 0;
      for (let i = 1; i < grezzo.length; i++) {
        strada += Math.hypot(grezzo[i][0] - grezzo[i - 1][0], grezzo[i][1] - grezzo[i - 1][1]);
        if (strada < 1) continue;
        strada = 0;
        const [x, y] = grezzo[i], e = 1.5;
        const gx = bordoStella(x + e, y, R) - bordoStella(x - e, y, R), gy = bordoStella(x, y + e, R) - bordoStella(x, y - e, R);
        const lungo = Math.hypot(gx, gy) || 1;
        contorno.push({ x, y, nx: gx / lungo, ny: gy / lungo });
      }
    }
    // c'è posto? Si controllano le pietre davanti, quelle dietro (stesse x, y, più in basso) e quelle del fianco
    const liberaF = (x, y, z, r) => {
      const v = REGOLA.strass.vicinanza, cx = Math.floor(x / CELLA), cy = Math.floor(y / CELLA);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const k = `${cx + i},${cy + j}`;
        for (const g of celle.get(k) || []) {
          if (Math.hypot(g.x - x, g.y - y, g.h - z) < (g.r + r) * v || Math.hypot(g.x - x, g.y - y, -g.h * retro - z) < (g.r + r) * v) return false;
        }
        for (const g of celleF.get(k) || []) if (Math.hypot(g.x - x, g.y - y, g.z - z) < (g.r + r) * v) return false;
      }
      return true;
    };
    const zSu = Hb * 0.75, zGiu = -Hb * retro * 0.75;      // fin dove sale e scende il rivestimento del fianco
    for (const f of REGOLA.strass.misure.slice(0, -1)) {     // le piccolissime non servono: il fianco è stretto
      const r = Math.max(1.6, rMax * f), fitto = r * 0.75, punti = [];
      const salto = Math.max(1, Math.round(fitto));             // un candidato ogni "fitto" pixel di contorno
      for (let z0 = zGiu; z0 <= zSu; z0 += fitto) for (let i = 0; i < contorno.length; i += salto) {
        const z = z0 + (Math.random() - 0.5) * fitto, d = rientro(z);
        const c = contorno[(i + Math.floor(Math.random() * salto)) % contorno.length];
        punti.push({ x: c.x - c.nx * d, y: c.y - c.ny * d, z, nx: c.nx, ny: c.ny });
      }
      for (let i = punti.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [punti[i], punti[j]] = [punti[j], punti[i]]; }
      for (const p of punti) {
        if (!liberaF(p.x, p.y, p.z, r)) continue;
        // la pietra guarda verso fuori, e un po' in su (o in giù) man mano che sale sul palloncino
        const g = { x: p.x, y: p.y, z: p.z, r, n: new THREE.Vector3(p.nx, p.ny, p.z / (Hb * (p.z < 0 ? retro : 1))).normalize(), fianco: true };
        const k = chiave(p.x, p.y);
        if (!celleF.has(k)) celleF.set(k, []);
        celleF.get(k).push(g);
        fianco.push(g);
      }
    }
    // fronte e retro (il retro è più basso), così quando la stella gira non si vede il corpo nudo
    const tutte = [...fianco];
    for (const g of gemme) {
      const e = 1.5;
      const z = altezza(g.x, g.y, R, H);
      const dx = (altezza(g.x + e, g.y, R, H) - altezza(g.x - e, g.y, R, H)) / (2 * e);
      const dy = (altezza(g.x, g.y + e, R, H) - altezza(g.x, g.y - e, R, H)) / (2 * e);
      // sul fianco ripido la pietra si vedrebbe di taglio (una fascia scura): la giriamo
      // un po' verso chi guarda, come quando si incolla uno strass su una curva stretta
      const k = REGOLA.strass.versoDiNoi;
      tutte.push({ ...g, z, n: new THREE.Vector3(-dx * (1 - k), -dy * (1 - k), 1).normalize() });
      tutte.push({ ...g, z: -z * retro, n: new THREE.Vector3(dx * retro * (1 - k), dy * retro * (1 - k), -1).normalize(), retro: true });
    }
    return tutte;
  }

  let gemmeMesh = null;
  let corpoMesh = null;
  let gemme = [];
  let centrale = null;   // la gemma più vicina al centro della stella: da lì si aprono i progetti
  function costruisciStella(alta) {
    if (gemmeMesh) { corpo.remove(gemmeMesh); gemmeMesh.geometry.dispose(); }
    if (corpoMesh) { corpo.remove(corpoMesh); corpoMesh.geometry.dispose(); }
    corpoMesh = corpoStella(alta / 2, alta / 2 * REGOLA.forma3d.spessore);
    corpo.add(corpoMesh);
    const R = alta / 2;
    gemme = riempi(alta);
    centrale = gemme.filter((g) => !g.retro).reduce((m, g) => (Math.hypot(g.x, g.y) < Math.hypot(m.x, m.y) ? g : m), gemme[0]);
    const geo = pietra.clone();
    const colori = new Float32Array(gemme.length * 3);
    const fasi = new Float32Array(gemme.length);
    const nascite = new Float32Array(gemme.length);
    gemmeMesh = new THREE.InstancedMesh(geo, materiale, gemme.length);
    gemmeMesh.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), giro = new THREE.Quaternion(), su = new THREE.Vector3(0, 0, 1);
    const lontano = Math.max(...gemme.map((g) => Math.hypot(g.x, g.y))) || 1;
    gemme.forEach((g, i) => {
      // la gemma guarda nella direzione della superficie, e gira un po' su sé stessa
      q.setFromUnitVectors(su, g.n);
      giro.setFromAxisAngle(su, Math.random() * Math.PI);
      q.multiply(giro);
      m.compose(new THREE.Vector3(g.x, g.y, g.z + (g.retro ? -1 : 1) * g.r * 0.15), q, new THREE.Vector3(g.r, g.r, g.r));
      gemmeMesh.setMatrixAt(i, m);
      // il tono nell'arcobaleno: macchie larghe di colore che attraversano la stella in diagonale
      // (rosa, giallo, azzurro), più un pizzico di caso per pietra
      const u = g.x / R, v = g.y / R, b = REGOLA.iride.bande;
      const tono = u * b + v * b * 0.7 + 0.15 * Math.sin(u * 5) * Math.cos(v * 4) + Math.random() * 0.08;
      colori.set([tono, 0, 0], i * 3);
      fasi[i] = Math.random();
      nascite[i] = 0.12 + (Math.hypot(g.x, g.y) / lontano) * 0.7 + Math.random() * 0.12;
    });
    geo.setAttribute('aColore', new THREE.InstancedBufferAttribute(colori, 3));
    geo.setAttribute('aFase', new THREE.InstancedBufferAttribute(fasi, 1));
    geo.setAttribute('aNascita', new THREE.InstancedBufferAttribute(nascite, 1));
    corpo.add(gemmeMesh);
  }

  /* ---------- 3. Le scintille a forma di stella, qua e là sugli strass ---------- */
  function stellaBianca() {
    const bianca = document.createElement('canvas');
    bianca.width = 128; bianca.height = 134;
    const c = bianca.getContext('2d');
    c.drawImage(stellaImg, 0, 0, 128, 134);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 134);
    return new THREE.CanvasTexture(bianca);
  }
  const scintille = [];
  function preparaScintille() {
    if (scintille.length || menoMovimento || !REGOLA.luccichio) return;
    const tex = stellaBianca();
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, opacity: 0 }));
      s.userData = { nasce: -10, vita: 0.9 };
      stella.add(s);
      scintille.push(s);
    }
  }
  function muoviScintille(t) {
    if (uniformi.uComparsa.value < 1) return;     // prima la stella si riempie, poi scintilla
    for (const s of scintille) {
      const eta = t - s.userData.nasce;
      if (eta > s.userData.vita) {
        const g = gemme[Math.floor(Math.random() * gemme.length)];
        if (!g) continue;
        s.position.set(g.x, g.y, 2);
        s.userData.nasce = t + Math.random() * 1.6;
        s.userData.vita = 0.7 + Math.random() * 0.5;
        s.userData.misura = g.r * (5 + Math.random() * 4);
        s.material.rotation = Math.random() * Math.PI;
        s.material.opacity = 0;
        continue;
      }
      if (eta < 0) continue;
      const k = Math.sin((eta / s.userData.vita) * Math.PI);
      s.material.opacity = k * 0.9;
      s.scale.setScalar(s.userData.misura * (0.6 + 0.4 * k));
    }
  }

  /* ---------- 4. Dove sta la stella: lo decide lo scroll ---------- */
  // "avanzamento" va da 0 (inizio: stella sola al centro) a 1 (fine: stella in basso)
  const stato = { avanzamento: menoMovimento ? 1 : 0 };
  let L = 0, A = 0, altaStella = 0;
  function piazzaStella() {
    const tel = stretto();
    const fine = tel ? REGOLA.stellaFine.telefono : REGOLA.stellaFine.computer;
    const k = stato.avanzamento;
    const x = THREE.MathUtils.lerp(0, (fine.x - 0.5) * L, k);
    const y = THREE.MathUtils.lerp(0, (0.5 - fine.y) * A, k);
    stella.position.set(x, y, 0);
    stella.scale.setScalar(THREE.MathUtils.lerp(1, fine.scala, k));
    // il giro: frontale all'inizio; mentre scende fa una capriola su tutti e tre gli assi
    // (dall'alto in basso = X, da destra a sinistra = Y in negativo, su sé stessa = Z),
    // poi si ferma girata di 35° e un po' inclinata, come appoggiata alla scritta
    const G = REGOLA.giro, rad = THREE.MathUtils.degToRad;
    giroG.rotation.set(rad((360 * G.voltaX + G.finaleX) * k), rad((-360 * G.voltaY + G.finaleY) * k), rad((360 * G.voltaZ + G.finaleZ) * k));
  }

  function misura() {
    L = canvas.clientWidth || window.innerWidth; A = canvas.clientHeight || window.innerHeight;
    motore.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    motore.setSize(L, A, false);
    camera.left = -L / 2; camera.right = L / 2; camera.top = A / 2; camera.bottom = -A / 2;
    camera.updateProjectionMatrix();
    const tel = stretto();
    const alta = tel ? Math.min(A * REGOLA.stellaInizio.telefono, L * 0.85) : Math.min(A * REGOLA.stellaInizio.computer, L * 0.55);
    // ricostruiamo gli strass solo se la misura cambia davvero (il telefono cambia altezza scorrendo)
    if (Math.abs(alta - altaStella) > 12) { altaStella = alta; costruisciStella(alta); }
    piazzaStella();
  }

  /* ---------- 5. I colori dei riflessi: cambiano a caso mentre ti muovi ---------- */
  const obiettivoA = uniformi.uTintaA.value.clone();
  const obiettivoB = uniformi.uTintaB.value.clone();
  let prossimoCambio = 0;
  let fisso = null;                  // passando su una voce del menu, il riflesso prende il suo colore
  function nuoviColori(t) {
    if (fisso) { obiettivoA.copy(fisso); obiettivoB.copy(fisso); return; }
    if (t < prossimoCambio) return;
    let nuovo = casuale();
    for (let i = 0; i < 4 && nuovo.equals(obiettivoA); i++) nuovo = casuale();
    obiettivoB.copy(obiettivoA);
    obiettivoA.copy(nuovo);
    prossimoCambio = t + REGOLA.cambioColore * (0.6 + Math.random() * 0.8);
  }

  // quando cambia il tema, gli strass cambiano colore
  // il materiale è lo stesso nei due temi; nel tema scuro i riflessi sono un po' più luminosi
  const aggiornaTema = () => { uniformi.uForzaRiflesso.value = document.documentElement.dataset.tema === 'chiaro' ? REGOLA.riflessoChiaro : REGOLA.riflessoScuro; };
  aggiornaTema();
  new MutationObserver(() => { aggiornaTema(); if (menoMovimento) disegna(performance.now()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

  /* ---------- Il disegno ---------- */
  let fermo = false;
  let luceAuto = true;
  let ultimo = performance.now();
  let inizio = -1;
  function disegna(adesso) {
    const t = adesso / 1000;
    const dt = Math.min((adesso - ultimo) / 1000, 0.1);
    ultimo = adesso;
    if (inizio < 0) inizio = t;
    if (!menoMovimento) {
      tempo.value = t;
      uniformi.uComparsa.value = Math.min(2, (t - inizio) / REGOLA.comparsa);
    }
    if (luceAuto && !menoMovimento) uniformi.uPuntatore.value.set(stella.position.x + Math.cos(t * 0.5) * altaStella * 0.4, stella.position.y + Math.sin(t * 0.7) * altaStella * 0.3);
    nuoviColori(t);
    const k = menoMovimento ? 1 : Math.min(1, dt * 2.5);
    uniformi.uTintaA.value.lerp(obiettivoA, k);
    uniformi.uTintaB.value.lerp(obiettivoB, k);
    piazzaStella();
    // il corpo compare per primo, poi gli strass ci si incollano sopra
    const nascita = THREE.MathUtils.smoothstep(uniformi.uComparsa.value, 0, 0.18);
    corpo.scale.setScalar(Math.max(0.001, nascita));
    // la stella si inclina verso il mouse, e quando è ferma oscilla appena
    const p = uniformi.uPuntatore.value;
    const raggio = Math.max(altaStella * stella.scale.x, 1);
    const px = THREE.MathUtils.clamp((p.x - stella.position.x) / raggio, -1.5, 1.5);
    const py = THREE.MathUtils.clamp((p.y - stella.position.y) / raggio, -1.5, 1.5);
    const oscilla = menoMovimento ? 0 : 0.08;
    corpo.rotation.y += ((px * REGOLA.inclinazione + Math.sin(t * 0.6) * oscilla) - corpo.rotation.y) * Math.min(1, dt * 4);
    corpo.rotation.x += ((-py * REGOLA.inclinazione + Math.cos(t * 0.45) * oscilla) - corpo.rotation.x) * Math.min(1, dt * 4);
    muoviScintille(t);
    motore.render(scena, camera);
  }
  function passo(adesso) {
    if (!fermo) disegna(adesso);
    requestAnimationFrame(passo);
  }

  window.addEventListener('pointermove', (e) => {
    luceAuto = false;
    const box = canvas.getBoundingClientRect();
    uniformi.uPuntatore.value.set(e.clientX - box.left - L / 2, box.top + A / 2 - e.clientY);
    if (menoMovimento) disegna(performance.now());
  });
  voci.filter((v) => v.progetto && v.colore).forEach((v) => {
    const su = () => { fisso = new THREE.Color(v.colore); };
    const giu = () => { fisso = null; prossimoCambio = 0; };
    v.menu.addEventListener('pointerenter', su);
    v.menu.addEventListener('pointerleave', giu);
    v.menu.addEventListener('focus', su);
    v.menu.addEventListener('blur', giu);
  });

  /* ---------- 6. Lo scroll: GSAP muove la stella, il nome, il ruolo e il menu ---------- */
  function preparaScroll() {
    const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    // senza GSAP o con "riduci movimento": composizione finale, ferma, senza pin
    if (!gsap || !ScrollTrigger || menoMovimento) {
      stato.avanzamento = 1;
      document.documentElement.classList.add('statica');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    // due versioni della timeline: computer e telefono. gsap.matchMedia le scambia da sola
    // quando cambia la finestra o si ruota il telefono, e pulisce quella vecchia.
    const mm = gsap.matchMedia();
    let tl = null;
    mm.add({ telefono: '(max-width: 639px), (max-aspect-ratio: 1/1)', computer: '(min-width: 640px) and (min-aspect-ratio: 1/1)' }, (ctx) => {
      const tel = ctx.conditions.telefono;
      tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: palcoEl,
          start: 'top top',
          end: () => `+=${window.innerHeight * (tel ? REGOLA.scroll.telefono : REGOLA.scroll.computer)}`,
          pin: true,                     // la scena resta ferma mentre l'animazione avanza
          scrub: REGOLA.fluidita,        // l'animazione segue lo scroll, avanti e indietro
          invalidateOnRefresh: true,     // ricalcola le misure dopo un resize o una rotazione
        },
      });
      tl.to(stato, { avanzamento: 1, duration: 1, ease: 'power2.inOut' }, 0)
        .to('[data-scorri]', { autoAlpha: 0, duration: 0.15 }, 0)
        .fromTo('.nome__riga--1', { yPercent: -40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, 0.25)
        .fromTo('.nome__riga--2', { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, 0.32)
        .fromTo('[data-entra]', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' }, 0.6);
      // sul telefono la stella lascia il posto al nome: svanisce mentre il nome entra
      if (tel) tl.to(canvas, { autoAlpha: 0, duration: 0.45, ease: 'power1.in' }, 0.05);
    });
    document.documentElement.classList.add('con-scroll');
    // chi usa la tastiera e arriva su un link ancora nascosto: saltiamo alla fine dell'animazione
    document.querySelectorAll('[data-entra]').forEach((el) => el.addEventListener('focusin', () => {
      const st = tl && tl.scrollTrigger;
      if (st && st.progress < 1) window.scrollTo(0, st.end);
    }));
  }

  /* ---------- 7. Il bling: un piccolo riflesso a stella dalla voce del menu ---------- */
  const bling = document.querySelector('[data-bling]');
  const lampo = document.querySelector('[data-lampo]');
  // dove sta il diamantino centrale sullo schermo (null se la stella non si vede, come sul telefono)
  function dalDiamante() {
    if (!centrale || stretto() || getComputedStyle(canvas).visibility === 'hidden' || +getComputedStyle(canvas).opacity < 0.5) return null;
    const box = canvas.getBoundingClientRect();
    const k = stella.scale.x;
    return { x: box.left + L / 2 + stella.position.x + centrale.x * k, y: box.top + A / 2 - (stella.position.y + centrale.y * k), r: Math.max(centrale.r * k, 10) };
  }
  function dovEVoce(id) {
    const v = voci.find((x) => x.id === id);
    if (!v) return null;
    const box = v.menu.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, r: Math.max(box.height, 24) / 2 };
  }
  function abbaglia(p) {
    if (menoMovimento || !bling) return Promise.resolve();
    const lato = Math.min(L, A) * 0.9;
    bling.style.left = `${p.x}px`;
    bling.style.top = `${p.y}px`;
    bling.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.05) rotate(0deg)', opacity: 0.9 },
        { transform: `translate(-50%, -50%) scale(${lato / 400}) rotate(20deg)`, opacity: 0.8, offset: 0.5 },
        { transform: `translate(-50%, -50%) scale(${lato / 200}) rotate(35deg)`, opacity: 0 },
      ],
      { duration: 650, easing: 'cubic-bezier(0.3, 0, 0.6, 1)', fill: 'forwards' }
    ).onfinish = () => bling.getAnimations().forEach((a) => a.cancel());
    lampo.animate([{ opacity: 0 }, { opacity: 0.22, offset: 0.4 }, { opacity: 0 }], { duration: 700, easing: 'ease-in-out' });
    return new Promise((fatto) => setTimeout(fatto, 300));
  }

  /* ---------- Avvio: basta la stella, il resto arriva mentre gli strass compaiono ---------- */
  const pronta = stellaImg.decode ? stellaImg.decode() : new Promise((ok) => { stellaImg.onload = ok; });
  pronta.then(() => {
    misuraSagoma();
    misura();
    preparaScintille();
    preparaScroll();
    disegna(performance.now());
    if (!menoMovimento) requestAnimationFrame(passo);
    // quando anche i font sono pronti, ScrollTrigger rifà le misure (il nome cambia larghezza)
    document.fonts.ready.then(() => window.ScrollTrigger && window.ScrollTrigger.refresh());
  });
  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => { misura(); disegna(performance.now()); }, 150);
  });

  // Quello che serve a pannelli.js: il pannello si apre dalla voce del menu, dopo il piccolo bling
  window.palco = {
    bolla(id) {
      const p = dalDiamante() || dovEVoce(id);
      return p ? { x: p.x, y: p.y, raggio: p.r } : null;
    },
    ferma() { fermo = true; },
    riparti() { fermo = false; ultimo = performance.now(); },
    scoppia(id) {
      const p = dalDiamante() || dovEVoce(id);
      return p ? abbaglia(p) : Promise.resolve();
    },
    riforma() {},
  };
}
