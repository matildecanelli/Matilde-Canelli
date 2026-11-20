/* ==========================================================================
   fotocamera.js: la Panasonic Lumix rosa di strass di Matilde, da girare (Three.js)

   Il lato creativo di Matilde dentro la scheda di Energia Pura, costruita come la lattina:
   1. La pelle, fatta come quella del barattolo di Virtuoso: davanti e dietro c'è la stampa della
      fotocamera vera (le sue foto, in assets/3d/fotocamera-*.webp) con il fucsia pieno al posto degli
      strass, e sopra una griglia pulita di cristalli trasparenti, tutti uguali, in file sfalsate.
      Attraverso il vetro si vedono il fucsia e le scritte (LUMIX, 12 MEGA PIXELS), un po' ingrandite,
      come CeraVe sotto i cristalli del barattolo. Restano liberi obiettivo, flash, schermo e tasti.
      Sui fianchi ci sono le sue foto, con gli strass veri.
   2. La forma: un blocco rigido con gli spigoli tondi, misurato sulle foto. Ogni pelle è
      proiettata sul suo lato e sugli spigoli vicini; sopra e sotto, che le foto non mostrano,
      c'è la fascia del fianco, ripetuta. L'obiettivo e la ghiera dello scatto sporgono in 3D.
   3. La luce, la stessa del barattolo: i cristalli sporgono dalla superficie, prendono il
      riflesso e le scintille che lampeggiano mentre la fotocamera gira.
   4. Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
      nessuno la tocca gira piano da sola. Con "riduci movimento" sta ferma.
   Le foto si scaricano la prima volta che si vede, e si disegna solo quando si vede.
   ========================================================================== */

import * as THREE from 'three';

document.querySelectorAll('[data-fotocamera]').forEach(prepara);

function prepara(figura) {
  const fermo = figura.hasAttribute('data-fermo');   // nella finestrella della home: gira da sola, non si trascina
  const palco = figura.querySelector('[data-fotocamera-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    pietra: 0.043,           // il raggio dei cristalli: la misura media delle pietre nelle foto (la fotocamera è larga 4)
    vicinanza: 1.0,          // la distanza tra due cristalli (1 = si toccano)
    lente: 1.2,              // quanto il cristallo ingrandisce la stampa sotto
    rilievo: 0.018,          // quanto sporgono i cristalli dalla superficie
    scintille: 1,            // la forza dei lampi di luce sui cristalli (0 = spenti)
    giroDaSola: 0.28,        // quanto gira da sola, in radianti al secondo
    trascina: 0.011,         // quanto gira per ogni pixel trascinato
    attrito: 3.2,            // quanto in fretta si ferma dopo una spinta
    passoTastiera: 30,       // gradi per ogni freccia
  };

  let motore;
  try {
    motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (errore) {
    return;                  // senza WebGL resta la foto della fotocamera
  }
  figura.classList.add('in-3d');   // c'è WebGL: niente foto, si aspetta l'oggetto 3D
  motore.setClearColor(0x000000, 0);
  motore.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(12, 4 / 3, 1, 80);
  camera.position.set(0, 2.4, 19.5);
  camera.lookAt(0, 0, 0);
  const fotocamera = new THREE.Group();
  scena.add(fotocamera);

  /* ---------- 1. Le misure, prese dalle foto (unità: la fotocamera è larga 4) ---------- */
  // davanti 1354 × 780 pixel, il fianco 400 × 1228: la profondità è un terzo dell'altezza
  const L = 4, A = L * 780 / 1354, P = A * 400 / 1228;
  const SPIGOLO = 0.13;                      // il raggio degli spigoli tondi, sul davanti e sui fianchi
  const px = L / 1354;                       // un pixel della foto davanti, in unità
  // le posizioni misurate sulla foto intera: il ritaglio parte da x 89, y 139
  const OBIETTIVO = { x: (1000 - 89) * px - L / 2, y: A / 2 - (520 - 139) * px, r: 340 * px };
  const SCATTO = { x: (438 - 89) * px - L / 2, z: 0 };

  // il blocco con gli spigoli tondi: una scatola fitta (i cristalli sporgono, servono tanti punti), con più punti vicino ai bordi,
  // e ogni punto spinto fuori dal blocco interno di "SPIGOLO". Le normali vengono da lì, senza cuciture.
  function blocco() {
    const g = new THREE.BoxGeometry(1, 1, 1, 280, 160, 60), pos = g.attributes.position, nor = g.attributes.normal;
    const mezzi = [L / 2, A / 2, P / 2], p = new THREE.Vector3(), dentro = new THREE.Vector3(), n = new THREE.Vector3();
    // da -0.5..0.5 alla quota vera: il 70% dei punti sulla parte piatta, il 30% sulla curva
    const quota = (v, h) => { const u = Math.abs(v) * 2, q = u < 0.7 ? (u / 0.7) * (h - SPIGOLO) : h - SPIGOLO + ((u - 0.7) / 0.3) * SPIGOLO; return Math.sign(v) * q; };
    for (let i = 0; i < pos.count; i++) {
      p.set(quota(pos.getX(i), mezzi[0]), quota(pos.getY(i), mezzi[1]), quota(pos.getZ(i), mezzi[2]));
      dentro.set(...[p.x, p.y, p.z].map((c, k) => THREE.MathUtils.clamp(c, -(mezzi[k] - SPIGOLO), mezzi[k] - SPIGOLO)));
      n.subVectors(p, dentro);
      if (n.lengthSq() < 1e-12) n.fromBufferAttribute(nor, i);
      n.normalize();
      p.copy(dentro).addScaledVector(n, SPIGOLO);
      pos.setXYZ(i, p.x, p.y, p.z);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  }

  // la luce: davanti in alto a sinistra, come nelle foto
  const uniformi = {
    uDavanti: { value: null }, uDietro: { value: null }, uFiancoO: { value: null }, uFiancoS: { value: null }, uSopra: { value: null },
    uMisure: { value: new THREE.Vector3(L, A, P) },
    uLuce: { value: new THREE.Vector3(-0.35, 0.55, 1).normalize() },
    uRilievo: { value: REGOLA.rilievo },
    uScintille: { value: REGOLA.scintille },
  };

  // Ogni punto prende il colore dalla pelle del lato verso cui guarda di più (come tre proiettori:
  // davanti/dietro, i fianchi, sopra/sotto), mescolate sugli spigoli secondo la normale.
  const PROIETTORI = `
    uniform sampler2D uDavanti, uDietro, uFiancoO, uFiancoS, uSopra;
    uniform vec3 uMisure;
    float chiaro(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
    // le coordinate nella pelle di ogni lato (l'origine è in basso a sinistra)
    vec2 uvDi(int lato, vec3 o){
      if (lato == 0) return vec2(o.x / uMisure.x + 0.5, o.y / uMisure.y + 0.5);
      if (lato == 1) return vec2(0.5 - o.x / uMisure.x, o.y / uMisure.y + 0.5);
      if (lato == 2) return vec2(0.5 - o.z / uMisure.z, o.y / uMisure.y + 0.5);   // il fianco dell'obiettivo: il davanti è a sinistra
      if (lato == 3) return vec2(o.z / uMisure.z + 0.5, o.y / uMisure.y + 0.5);   // l'altro fianco: il davanti è a destra
      return vec2(o.x / uMisure.x + 0.5, o.z / uMisure.z + 0.5);
    }
    vec3 fotoIn(int lato, vec2 uv, float lod){
      if (lato == 0) return textureLod(uDavanti, uv, lod).rgb;
      if (lato == 1) return textureLod(uDietro, uv, lod).rgb;
      if (lato == 2) return textureLod(uFiancoO, uv, lod).rgb;
      if (lato == 3) return textureLod(uFiancoS, uv, lod).rgb;
      return textureLod(uSopra, uv, lod).rgb;
    }
    vec2 pixelDi(int lato){
      if (lato == 0) return vec2(textureSize(uDavanti, 0));
      if (lato == 1) return vec2(textureSize(uDietro, 0));
      if (lato == 2) return vec2(textureSize(uFiancoO, 0));
      if (lato == 3) return vec2(textureSize(uFiancoS, 0));
      return vec2(textureSize(uSopra, 0));
    }
    vec3 pesi(vec3 no){ vec3 w = pow(abs(no), vec3(8.0)); return w / (w.x + w.y + w.z); }
    int principale(vec3 no){ vec3 w = pesi(no); int fz = no.z > 0.0 ? 0 : 1, fx = no.x > 0.0 ? 2 : 3; return w.z >= w.x && w.z >= w.y ? fz : (w.x >= w.y ? fx : 4); }
  `;
  const materialePelle = new THREE.ShaderMaterial({
    uniforms: uniformi,
    vertexShader: `
      ${PROIETTORI}
      uniform float uRilievo;
      varying vec3 vO; varying vec3 vNo; varying vec3 vN; varying vec3 vP;
      void main(){
        vO = position; vNo = normal;
        // il rilievo, come sul barattolo: quanto il punto è più chiaro dei suoi dintorni (un cristallo sporge, una fessura rientra)
        int lato = principale(normal);
        vec2 uv = uvDi(lato, position);
        float h = chiaro(fotoIn(lato, uv, 2.0)) - chiaro(fotoIn(lato, uv, 5.0));
        vec3 p = position + normal * clamp(h * 3.0, -0.5, 1.0) * uRilievo;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vP = mv.xyz;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      ${PROIETTORI}
      uniform vec3 uLuce; uniform float uScintille;
      varying vec3 vO; varying vec3 vNo; varying vec3 vN; varying vec3 vP;
      float caso(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 no = normalize(vNo), w = pesi(no);
        int fz = no.z > 0.0 ? 0 : 1, fx = no.x > 0.0 ? 2 : 3, lato = principale(no);
        vec3 foto = fotoIn(fz, uvDi(fz, vO), 0.0) * w.z + fotoIn(fx, uvDi(fx, vO), 0.0) * w.x + fotoIn(4, uvDi(4, vO), 0.0) * w.y;

        // da qui è il barattolo, uguale
        vec3 n = normalize(vN);
        vec3 t = normalize(cross(abs(n.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0), n));
        vec3 b = cross(n, t);
        // i cristalli in rilievo: la pendenza si ricava dalla pelle
        vec2 uv = uvDi(lato, vO), d = 2.5 / pixelDi(lato);
        float dx = chiaro(fotoIn(lato, uv + vec2(d.x, 0.0), 1.0)) - chiaro(fotoIn(lato, uv - vec2(d.x, 0.0), 1.0));
        float dy = chiaro(fotoIn(lato, uv + vec2(0.0, d.y), 1.0)) - chiaro(fotoIn(lato, uv - vec2(0.0, d.y), 1.0));
        vec3 m = normalize(n - (t * dx - b * dy) * 0.55);
        vec3 l = normalize(uLuce);
        vec3 meta = normalize(l + normalize(-vP));
        // la pelle ha già la sua luce, quindi poca ombra in più
        float tondo = clamp(dot(n, normalize(l + vec3(0.0, 0.0, 1.2))), 0.0, 1.0);
        vec3 c = foto * (0.74 + 0.36 * tondo);
        c += vec3(1.0) * pow(max(dot(m, meta), 0.0), 60.0) * 0.08;
        // le scintille: faccette minuscole, ognuna inclinata a caso: mentre gira lampeggiano.
        // Grandi come sul barattolo rispetto al cristallo: quattro faccette di traverso per cristallo
        vec2 piano = lato < 2 ? vO.xy : (lato < 4 ? vO.zy : vO.xz);
        vec2 cella = floor(piano / 0.021) + float(lato) * 17.0;
        vec3 faccetta = normalize(m + 0.55 * (vec3(caso(cella), caso(cella + 3.7), caso(cella + 7.1)) - 0.5));
        vec3 intorno = fotoIn(lato, uv, 3.0);
        float strass = smoothstep(0.15, 0.35, intorno.r - intorno.g);   // solo dove c'è il fucsia con i cristalli: non sull'argento né sullo schermo
        c += vec3(1.0) * pow(max(dot(faccetta, meta), 0.0), 420.0) * 1.7 * uScintille * strass;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });

  // il metallo nudo della ghiera dello scatto: bande chiare e scure, come un metallo che rispecchia la stanza
  function metallo(colore, lucido) {
    return new THREE.ShaderMaterial({
      uniforms: { uLuce: uniformi.uLuce, uColore: { value: new THREE.Color(colore) }, uLucido: { value: lucido } },
      vertexShader: `
        varying vec3 vN; varying vec3 vP;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform vec3 uLuce; uniform vec3 uColore; uniform float uLucido;
        varying vec3 vN; varying vec3 vP;
        void main(){
          vec3 n = normalize(vN);
          vec3 r = reflect(normalize(vP), n);
          float bande = smoothstep(-0.2, 0.5, sin(r.y * 7.0 + r.x * 3.0));
          vec3 c = uColore * (0.5 + 0.6 * bande) + vec3(1.0) * pow(max(dot(r, normalize(uLuce)), 0.0), 24.0) * uLucido;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }

  // le parti che restano libere, senza cristalli, misurate sulle foto (in pixel della foto):
  // cerchi [x, y, r] e rettangoli [x0, y0, x1, y1]
  const LIBERO = {
    davanti: {
      cerchi: [[911, 381, 345], [1229, 236, 24]],                                           // l'obiettivo, la lucina
      rettangoli: [[436, 40, 686, 116]],                                                    // il flash
    },
    dietro: {
      cerchi: [[1078, 431, 126]],                                                           // la croce dei tasti
      rettangoli: [[88, 85, 858, 648], [976, 213, 1084, 265], [971, 594, 1055, 642], [1097, 594, 1199, 642], [1150, 109, 1199, 179]],   // schermo, MODE, i due tasti, la levetta (stretti, senza pietre intorno)
    },
  };
  // le scritte e le icone della stampa: restano sotto i cristalli, e si leggono attraverso il vetro
  const SCRITTE = {
    davanti: [[153, 365, 486, 431], [162, 688, 488, 733], [1189, 638, 1267, 716]],        // LUMIX, 12 MEGA PIXELS, la L (stretti sulle lettere)
    dietro: [[1154, 59, 1198, 103], [1154, 194, 1198, 238]],                                // le due icone accanto alla levetta
  };
  const FUCSIA = 'rgb(196, 22, 98)';         // il guscio, preso dalla foto tra una pietra e l'altra
  const NITIDA = 2;                          // la pelle è disegnata al doppio della foto: i cristalli vengono netti

  // La pelle di davanti o di dietro: la stampa (fucsia, scritte, obiettivo, schermo, tasti) e sopra i cristalli
  function pelle(tex, nome, verso) {
    const foto = tex.image, W = foto.width * NITIDA, H = foto.height * NITIDA, k = W / L;   // pixel per unità
    const tela = (w, h) => { const t = document.createElement('canvas'); t.width = w; t.height = h; return t; };
    const forma = (c, [a, b, cc, d]) => { c.beginPath(); if (d === undefined) c.arc(a * NITIDA, b * NITIDA, cc * NITIDA, 0, Math.PI * 2); else c.rect(a * NITIDA, b * NITIDA, (cc - a) * NITIDA, (d - b) * NITIDA); };

    // 1. la stampa: tutto fucsia, poi dalla foto solo le parti vere
    const stampa = tela(W, H), s = stampa.getContext('2d');
    s.fillStyle = FUCSIA; s.fillRect(0, 0, W, H);
    for (const pezzo of [...LIBERO[nome].cerchi, ...LIBERO[nome].rettangoli, ...SCRITTE[nome]]) {
      s.save(); forma(s, pezzo); s.clip(); s.drawImage(foto, 0, 0, W, H); s.restore();
    }

    // tra le frecce della croce la foto ha quattro pietre: sotto i loro cristalli torna il fucsia
    if (nome === 'dietro') for (let q = 0; q < 4; q++) {
      const a = Math.PI / 4 + q * Math.PI / 2;
      s.fillStyle = FUCSIA; s.beginPath(); s.arc((1078 + Math.cos(a) * 94) * NITIDA, (431 + Math.sin(a) * 94) * NITIDA, 21 * NITIDA, 0, Math.PI * 2); s.fill();
    }

    // 2. i cristalli: griglia centrata, file dritte sfalsate di mezzo cristallo, a filo delle parti libere
    const finale = tela(W, H), c = finale.getContext('2d');
    c.drawImage(stampa, 0, 0);
    const R = REGOLA.pietra, passo = R * 2 * REGOLA.vicinanza, r = R * k;
    const dentroLibero = (fx, fy, m) => LIBERO[nome].cerchi.some(([cx, cy, cr]) => Math.hypot(fx - cx, fy - cy) < cr + m)
      || LIBERO[nome].rettangoli.some(([x0, y0, x1, y1]) => fx > x0 - m && fx < x1 + m && fy > y0 - m && fy < y1 + m);
    const colonne = Math.floor((L - R) / passo) + 1, file = Math.floor((A - R) / (passo * 0.866)) + 1;
    for (let j = 0; j < file; j++) {
      const y = (j - (file - 1) / 2) * passo * 0.866;
      for (let i = 0; i < colonne - (j % 2); i++) {
        const x = (i - (colonne - 1) / 2 + (j % 2) * 0.5) * passo;
        // dentro la sagoma con gli angoli tondi
        const qx = Math.max(Math.abs(x) - (L / 2 - SPIGOLO), 0), qy = Math.max(Math.abs(y) - (A / 2 - SPIGOLO), 0);
        if (Math.hypot(qx, qy) > SPIGOLO - R * 0.6) continue;
        const fx = (verso > 0 ? x / L + 0.5 : 0.5 - x / L) * foto.width, fy = (0.5 - y / A) * foto.height;
        if (dentroLibero(fx, fy, R * (foto.width / L) * 0.75)) continue;
        cristallo(c, stampa, fx * NITIDA, fy * NITIDA, r);
      }
    }
    // dietro, nei quattro angolini tra le frecce della croce, un cristallo più piccolo
    if (nome === 'dietro') for (let q = 0; q < 4; q++) {
      const a = Math.PI / 4 + q * Math.PI / 2;
      cristallo(c, stampa, (1078 + Math.cos(a) * 94) * NITIDA, (431 + Math.sin(a) * 94) * NITIDA, r * 0.9);
    }
    const nuova = new THREE.CanvasTexture(finale);
    nuova.colorSpace = THREE.SRGBColorSpace;
    nuova.anisotropy = tex.anisotropy;
    return nuova;
  }

  // Un cristallo trasparente visto dall'alto, come quelli del barattolo: dentro si vede la stampa
  // ingrandita, la tavola ottagonale e le faccette intorno (chiare e scure a turno), il bordo che
  // brilla, l'ombra in basso a destra e il riflesso della luce in alto a sinistra
  function cristallo(c, stampa, x, y, r) {
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    const z = REGOLA.lente;
    c.drawImage(stampa, x - r / z, y - r / z, (2 * r) / z, (2 * r) / z, x - r, y - r, 2 * r, 2 * r);
    c.fillStyle = 'rgba(255, 255, 255, 0.06)'; c.fillRect(x - r, y - r, 2 * r, 2 * r);   // il vetro schiarisce appena: il fucsia resta pieno
    const punto = (raggio, i) => [x + Math.cos(((i + 0.5) / 8) * Math.PI * 2) * raggio, y + Math.sin(((i + 0.5) / 8) * Math.PI * 2) * raggio];
    for (let i = 0; i < 8; i++) {
      const [ax, ay] = punto(r * 0.55, i), [bx, by] = punto(r * 0.55, i + 1), [ex, ey] = punto(r * 1.05, i + 0.5);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(ex, ey); c.closePath();
      c.fillStyle = i % 2 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(70, 0, 35, 0.14)'; c.fill();
    }
    c.beginPath(); for (let i = 0; i < 8; i++) { const [px, py] = punto(r * 0.55, i); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath();
    c.fillStyle = 'rgba(255, 255, 255, 0.1)'; c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.35)'; c.lineWidth = r * 0.05; c.stroke();
    const bordo = c.createRadialGradient(x, y, r * 0.7, x, y, r);
    bordo.addColorStop(0, 'rgba(255, 255, 255, 0)'); bordo.addColorStop(1, 'rgba(255, 255, 255, 0.45)');
    c.fillStyle = bordo; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    const ombra = c.createLinearGradient(x - r, y - r, x + r, y + r);
    ombra.addColorStop(0.45, 'rgba(60, 0, 30, 0)'); ombra.addColorStop(1, 'rgba(60, 0, 30, 0.3)');
    c.fillStyle = ombra; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    const luce = c.createRadialGradient(x - r * 0.32, y - r * 0.36, 0, x - r * 0.32, y - r * 0.36, r * 0.32);
    luce.addColorStop(0, 'rgba(255, 255, 255, 0.95)'); luce.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = luce; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    c.restore();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(90, 0, 45, 0.45)'; c.lineWidth = r * 0.07; c.stroke();
  }

  function costruisci(foto) {
    uniformi.uDavanti.value = foto.davanti;
    uniformi.uDietro.value = foto.dietro;
    uniformi.uFiancoO.value = foto.fiancoO;
    uniformi.uFiancoS.value = foto.fiancoS;
    uniformi.uSopra.value = foto.sopra;

    const corpo = new THREE.Mesh(blocco(), materialePelle);
    fotocamera.add(corpo);

    // l'obiettivo sporge un poco (spento, è rientrato): la sua faccia è la foto davanti, con le scritte vere
    const giri = [[1, 0], [1, 0.03], [0.96, 0.055], [0.8, 0.065], [0.78, 0.085], [0.6, 0.095], [0.001, 0.095]]
      .map(([r, z]) => new THREE.Vector2(r * OBIETTIVO.r, z));
    const lente = new THREE.LatheGeometry(giri.reverse(), 128);
    lente.rotateX(Math.PI / 2);
    lente.translate(OBIETTIVO.x, OBIETTIVO.y, P / 2 - 0.004);
    // la faccia deve guardare in avanti: è la normale che sceglie la foto davanti
    const nor = lente.attributes.normal;
    if (nor.getZ(0) < 0) for (let i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
    const vetro = materialePelle.clone();
    vetro.uniforms = { ...uniformi, uRilievo: { value: 0 }, uScintille: { value: 0 } };   // l'obiettivo è liscio: niente rilievo né scintille
    vetro.side = THREE.DoubleSide;
    fotocamera.add(new THREE.Mesh(lente, vetro));

    // la ghiera dello scatto, sopra a sinistra, con il bottone dorato
    const ghiera = [[0.25, 0], [0.25, 0.05], [0.22, 0.07], [0.2, 0.12], [0.16, 0.14], [0.001, 0.14]].map(([r, y]) => new THREE.Vector2(r, y));
    const scatto = new THREE.Mesh(new THREE.LatheGeometry(ghiera, 64), metallo(0xc9c9cc, 0.8));
    scatto.position.set(SCATTO.x, A / 2 - 0.01, SCATTO.z); fotocamera.add(scatto);
    const bottone = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.03, 32), metallo(0xc7a25a, 0.9));
    bottone.position.set(SCATTO.x, A / 2 + 0.14, SCATTO.z); fotocamera.add(bottone);
  }

  // sopra e sotto le foto non ci sono: la fascia del fianco (argento in mezzo, strass ai bordi),
  // girata per il lungo e ripetuta lungo tutta la fotocamera. Le righe del fianco vanno dal davanti al dietro.
  function sopraESotto(fianco) {
    const tela = document.createElement('canvas');
    tela.width = 2048; tela.height = 384;
    const c = tela.getContext('2d');
    const da = 420, alto = 640;                         // un tratto di fianco senza viti
    c.setTransform(0, tela.height / fianco.width, 1, 0, 0, 0);   // scambia righe e colonne
    for (let x = 0; x < tela.width; x += alto) c.drawImage(fianco, 0, da, fianco.width, alto, 0, x, fianco.width, alto);
    const t = new THREE.CanvasTexture(tela);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ---------- 2. Il giro: trascinando, con la tastiera, o da sola ---------- */
  const stato = { angolo: -0.5, velocita: 0, inclina: 0, preso: false, ultimaX: 0, ultimaY: 0, ultimoT: 0, tocco: -10 };
  if (!fermo) {
  palco.addEventListener('pointerdown', (e) => {
    stato.preso = true; stato.ultimaX = e.clientX; stato.ultimaY = e.clientY; stato.ultimoT = performance.now(); stato.velocita = 0;
    try { palco.setPointerCapture(e.pointerId); } catch (errore) { /* niente */ }
    palco.classList.add('e-presa');
    palco.classList.add('e-col-mouse');   // il riquadro di selezione serve solo a chi usa la tastiera
    sveglia();
  });
  palco.addEventListener('pointermove', (e) => {
    if (!stato.preso) return;
    const adesso = performance.now(), dt = Math.max(1, adesso - stato.ultimoT) / 1000;
    const dx = e.clientX - stato.ultimaX, dy = e.clientY - stato.ultimaY;
    stato.angolo += dx * REGOLA.trascina;
    stato.velocita = Math.max(-REGOLA.giroDaSola * 12, Math.min(REGOLA.giroDaSola * 12, (dx * REGOLA.trascina) / dt));   // con un tetto: col dito i movimenti arrivano a pochi ms l'uno dall'altro
    stato.inclina = Math.max(-0.3, Math.min(0.3, stato.inclina + dy * REGOLA.trascina * 0.5));
    stato.ultimaX = e.clientX; stato.ultimaY = e.clientY; stato.ultimoT = adesso;
    aggiornaValore();
    sveglia();
  });
  const lascia = () => {
    if (!stato.preso) return;
    stato.preso = false; stato.tocco = performance.now() / 1000;
    if (menoMovimento || performance.now() - stato.ultimoT > 80) stato.velocita = 0;   // fermo prima di lasciare: niente spinta
    palco.classList.remove('e-presa');
    aggiornaValore();
  };
  palco.addEventListener('pointerup', lascia);
  // il browser si è preso il gesto (sul telefono: si stava scorrendo la pagina), quindi niente spinta
  palco.addEventListener('pointercancel', () => { stato.velocita = 0; lascia(); });

  palco.addEventListener('keydown', (e) => {
    palco.classList.remove('e-col-mouse');
    const gradi = { ArrowRight: REGOLA.passoTastiera, ArrowUp: REGOLA.passoTastiera, ArrowLeft: -REGOLA.passoTastiera, ArrowDown: -REGOLA.passoTastiera }[e.key];
    if (gradi == null && e.key !== 'Home') return;
    e.preventDefault();
    stato.velocita = 0; stato.tocco = performance.now() / 1000;
    stato.angolo = e.key === 'Home' ? 0 : stato.angolo + THREE.MathUtils.degToRad(gradi);
    aggiornaValore();
    sveglia();
  });
  }

  // per i lettori di schermo: di quanto è girata, e quale lato si vede
  function aggiornaValore() {
    if (fermo) return;
    const gradi = ((Math.round(THREE.MathUtils.radToDeg(stato.angolo)) % 360) + 360) % 360;
    const lato = gradi < 45 || gradi >= 315 ? 'davanti, con l’obiettivo' : gradi < 135 ? 'il fianco' : gradi < 225 ? 'il retro, con lo schermo' : 'l’altro fianco';
    palco.setAttribute('aria-valuenow', String(gradi));
    palco.setAttribute('aria-valuetext', `${gradi} gradi: si vede ${lato}`);
  }

  /* ---------- Il disegno: solo quando la fotocamera si vede ---------- */
  let visibile = false, ciclo = 0, ultimo = 0, pronta = false, chiesta = false;
  function misura() {
    const l = palco.clientWidth, a = palco.clientHeight;
    if (!l || !a) return false;
    motore.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    motore.setSize(l, a, false);
    camera.aspect = l / a;
    camera.updateProjectionMatrix();
    return true;
  }
  function disegna(adesso) {
    const t = adesso / 1000, dt = Math.min(0.05, ultimo ? t - ultimo : 0);
    ultimo = t;
    if (!stato.preso) {
      // dopo una spinta rallenta piano; poi, se nessuno la tocca da un po', riprende a girare da sola
      stato.angolo += stato.velocita * dt;
      stato.velocita *= Math.exp(-REGOLA.attrito * dt);
      if (!menoMovimento && t - stato.tocco > 2.5) stato.angolo += REGOLA.giroDaSola * dt * Math.min(1, (t - stato.tocco - 2.5) / 1.5);
      stato.inclina *= Math.exp(-2 * dt);
    }
    fotocamera.rotation.set(stato.inclina, stato.angolo, 0);
    motore.render(scena, camera);
  }
  function passo(adesso) {
    ciclo = 0;
    if (!visibile) return;
    disegna(adesso);
    // con "riduci movimento" si ridisegna solo finché qualcuno la sta girando o la spinta si spegne
    if (!menoMovimento || stato.preso || Math.abs(stato.velocita) > 0.01 || Math.abs(stato.inclina) > 0.002) ciclo = requestAnimationFrame(passo);
  }
  function sveglia() { if (visibile && !ciclo && pronta) { ultimo = 0; ciclo = requestAnimationFrame(passo); } }

  // le foto pesano, quindi si scaricano solo la prima volta che la fotocamera si vede.
  // Quando sono arrivate tutte, la fotocamera 3D prende il posto della foto.
  function chiediFotocamera() {
    if (chiesta) return;
    chiesta = true;
    const carica = (nome) => new THREE.TextureLoader().loadAsync(`assets/3d/fotocamera-${nome}.webp`).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, motore.capabilities.getMaxAnisotropy());
      return tex;
    });
    Promise.all(['davanti', 'dietro', 'fianco-obiettivo', 'fianco-sportello'].map(carica)).then(([davanti, dietro, fiancoO, fiancoS]) => {
      costruisci({ davanti: pelle(davanti, 'davanti', 1), dietro: pelle(dietro, 'dietro', -1), fiancoO, fiancoS, sopra: sopraESotto(fiancoO.image) });
      pronta = true;
      figura.classList.add('e-3d');
      if (visibile && misura()) { disegna(performance.now()); sveglia(); }
    }).catch(() => figura.classList.remove('in-3d'));   // se le foto non arrivano, resta l'immagine ferma
  }

  new IntersectionObserver(([voce]) => {
    visibile = voce.isIntersecting;
    if (visibile) chiediFotocamera();
    if (visibile && pronta && misura()) { disegna(performance.now()); sveglia(); }
  }, { rootMargin: '200px' }).observe(figura);
  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => { if (visibile && pronta && misura()) disegna(performance.now()); }, 150);
  });
  aggiornaValore();
}
