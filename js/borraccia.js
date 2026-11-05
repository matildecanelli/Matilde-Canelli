/* ==========================================================================
   borraccia.js: la borraccia tempestata di strass da Matilde, da girare (Three.js)

   Il lato creativo di Matilde dentro la scheda di Energia Pura, costruita come la lattina:
   1. La pelle: due foto, davanti e dietro, srotolate e cucite in un'unica immagine
      (assets/3d/borraccia-pelle.jpg): sopra il tappo, sotto il corpo.
   2. La forma: un tornio misurato sulle foto, con la spalla, la ghiera di metallo e il tappo.
   3. Il manico, i bottoni e il beccuccio sono veri pezzi 3D, con gemme vere.
   4. Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
      nessuno la tocca gira piano da sola. Con "riduci movimento" sta ferma.
   Si disegna solo quando il pannello è aperto e la borraccia si vede.
   ========================================================================== */

import * as THREE from 'three';
import { pietre, materialeGemma, geometriaPietra, stanzaDiLuci } from './strass.js';

const figura = document.querySelector('[data-borraccia]');
if (figura) prepara();

function prepara() {
  const palco = figura.querySelector('[data-borraccia-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    rilievo: 0.012,          // quanto sporgono le pietre dalla superficie
    scintille: 0.4,            // la forza dei lampi di luce sulle pietre (0 = spenti)
    giroDaSola: 0.28,        // quanto gira da sola, in radianti al secondo
    trascina: 0.011,         // quanto gira per ogni pixel trascinato
    attrito: 3.2,            // quanto in fretta si ferma dopo una spinta
    passoTastiera: 30,       // gradi per ogni freccia
  };

  let motore;
  try {
    motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (errore) {
    return;                  // senza WebGL resta la foto della borraccia
  }
  motore.setClearColor(0x000000, 0);
  motore.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(15.5, 3 / 5, 1, 80);
  camera.position.set(0, 3, 24);
  camera.lookAt(0, 0, 0);
  const borraccia = new THREE.Group();
  scena.add(borraccia);

  /* ---------- 1. La forma, misurata sulle foto: il raggio del corpo = 1 ---------- */
  const Y = (riga) => (800 - riga) / 276;            // dalla riga della foto all'altezza
  const L = 0.14;                                    // la parte di pelle che è tappo
  const PROFILO = [[320, 0.72], [360, 0.835], [396, 0.93], [432, 0.985], [468, 1], [1540, 1]];
  const raggio = (riga) => { for (let i = 1; i < PROFILO.length; i++) if (riga <= PROFILO[i][0]) { const t = (riga - PROFILO[i - 1][0]) / (PROFILO[i][0] - PROFILO[i - 1][0]), e = t * t * (3 - 2 * t); return PROFILO[i - 1][1] + (PROFILO[i][1] - PROFILO[i - 1][1]) * (i < 4 ? t : e); } return 1; };
  const uniformi = {
    uPelle: { value: null },
    uLuce: { value: new THREE.Vector3(-0.35, 0.55, 1).normalize() },
    uRilievo: { value: REGOLA.rilievo },
    uScintille: { value: REGOLA.scintille },
    uPassoT: { value: new THREE.Vector2(1 / 1800, 1 / 1400) },
  };
  const SEG_GIRO = 256;
  // un pezzo di tornio dalle sue righe: [raggio, altezza, v]
  function tornio(righe) {
    const posizioni = [], uvs = [], normali = [], indici = [];
    righe.forEach((q, j) => {
      const A = righe[Math.max(0, j - 1)], B = righe[Math.min(righe.length - 1, j + 1)], dr = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dr, dy) || 1, nr = -dy / l, ny = dr / l;
      for (let i = 0; i <= SEG_GIRO; i++) { const u = i / SEG_GIRO, a = u * Math.PI * 2; posizioni.push(q[0] * Math.sin(a), q[1], q[0] * Math.cos(a)); uvs.push(u, q[2]); normali.push(nr * Math.sin(a), ny, nr * Math.cos(a)); }
    });
    for (let j = 0; j < righe.length - 1; j++) for (let i = 0; i < SEG_GIRO; i++) { const p = j * (SEG_GIRO + 1) + i, q = p + 1, s = p + SEG_GIRO + 1, w = s + 1; indici.push(p, s, q, q, s, w); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posizioni, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normali, 3));
    g.setIndex(indici);
    return g;
  }
  const righeTappo = [], RS = 0.1, R_T = 0.8, Y_C = Y(112);
  for (let j = 0; j <= 8; j++) { const b = (1 - j / 8) * Math.PI * 0.5; righeTappo.push([R_T - RS + RS * Math.cos(b), Y_C + RS * Math.sin(b), 0.012 * (j / 8)]); }
  for (let j = 1; j <= 24; j++) { const f = j / 24; righeTappo.push([R_T, Y_C + (Y(290) - Y_C) * f, L * (0.09 + 0.91 * f)]); }
  const righeCorpo = [];
  for (let j = 0; j <= 150; j++) { const f = j / 150, riga = 322 + (1540 - 322) * f; righeCorpo.push([raggio(riga), Y(riga), L + (1 - L) * f * 0.985]); }
  for (let j = 1; j <= 6; j++) { const b = (j / 6) * Math.PI * 0.5; righeCorpo.push([1 - 0.06 + 0.06 * Math.cos(b), Y(1540) - 0.06 * Math.sin(b), L + (1 - L) * (0.985 + 0.015 * (j / 6))]); }
  const pelle = new THREE.ShaderMaterial({
    uniforms: uniformi,
    vertexShader: `
      uniform sampler2D uPelle; uniform float uRilievo;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      float chiaro(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
      void main(){
        vUv = uv;
        // il rilievo: quanto il punto è più chiaro dei suoi dintorni (una pietra sporge, una fessura rientra)
        float h = chiaro(textureLod(uPelle, uv, 2.0).rgb) - chiaro(textureLod(uPelle, uv, 5.0).rgb);
        vec3 p = position + normal * clamp(h * 3.0, -0.5, 1.0) * uRilievo;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vP = mv.xyz;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uPelle; uniform vec3 uLuce; uniform vec2 uPassoT; uniform float uScintille;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      float chiaro(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
      float caso(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 foto = texture2D(uPelle, vUv).rgb;
        vec3 n = normalize(vN);
        vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
        vec3 b = cross(n, t);
        // le pietre in rilievo: la pendenza si ricava dalla foto
        vec2 d = uPassoT * 2.5;
        float dx = chiaro(textureLod(uPelle, vUv + vec2(d.x, 0.0), 1.0).rgb) - chiaro(textureLod(uPelle, vUv - vec2(d.x, 0.0), 1.0).rgb);
        float dy = chiaro(textureLod(uPelle, vUv + vec2(0.0, d.y), 1.0).rgb) - chiaro(textureLod(uPelle, vUv - vec2(0.0, d.y), 1.0).rgb);
        vec3 m = normalize(n - (t * dx - b * dy) * 0.55);
        vec3 l = normalize(uLuce);
        vec3 meta = normalize(l + normalize(-vP));
        // è tonda: un po' più buio verso i fianchi. La foto ha già la sua luce, quindi poco.
        float tondo = clamp(dot(n, normalize(l + vec3(0.0, 0.0, 1.2))), 0.0, 1.0);
        vec3 c = foto * (0.74 + 0.36 * tondo);
        c += vec3(1.0) * pow(max(dot(m, meta), 0.0), 60.0) * 0.08;
        // le scintille: faccette minuscole, ognuna inclinata a caso: mentre gira lampeggiano
        vec2 cella = floor(vUv * vec2(460.0, 125.0));
        vec3 faccetta = normalize(m + 0.55 * (vec3(caso(cella), caso(cella + 3.7), caso(cella + 7.1)) - 0.5));
        c += vec3(1.0) * pow(max(dot(faccetta, meta), 0.0), 420.0) * 1.7 * uScintille;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  for (const righe of [righeTappo, righeCorpo]) { const m = new THREE.Mesh(tornio(righe), pelle); m.frustumCulled = false; borraccia.add(m); }

  /* ---------- I pezzi veri ---------- */
  const stanza = stanzaDiLuci(motore);
  const metallo = new THREE.MeshStandardMaterial({ color: 0xd4d3d2, metalness: 1, roughness: 0.24, envMap: stanza, envMapIntensity: 1.1 });
  const smalto = new THREE.MeshStandardMaterial({ color: 0x5d1426, metalness: 0.1, roughness: 0.5, envMap: stanza, envMapIntensity: 0.3 });
  borraccia.add(new THREE.AmbientLight(0xffffff, 1.2));
  // la ghiera di metallo tra il corpo e il tappo
  borraccia.add(new THREE.Mesh(tornio([[0.7, Y(324), 0], [0.78, Y(322), 0], [0.785, Y(306), 0], [0.77, Y(291), 0], [0.7, Y(288), 0]]), metallo));
  // il sopra del tappo e il fondo
  const disco = (y, r, m) => { const g = new THREE.CircleGeometry(r, 64); g.rotateX(y > 0 ? -Math.PI / 2 : Math.PI / 2); g.translate(0, y, 0); borraccia.add(new THREE.Mesh(g, m)); };
  disco(Y_C + RS, R_T - RS + 0.01, smalto);
  disco(Y(1540) - 0.06, 0.95, smalto);

  const voci = [], R_G = 0.044, COLORE = [0.72, 0.31, 0.4];
  const pietra = (p, n, r = R_G) => voci.push({ p, n: n.clone().normalize(), r, colore: COLORE });
  // cerchi di gemme sul tappo
  for (let r = R_T - RS - 0.02; r > 0.03; r -= R_G * 1.85) { const n = Math.max(1, Math.floor((Math.PI * 2 * r) / (R_G * 1.95))); for (let i = 0; i < n; i++) { const a = ((i + (Math.round(r * 100) % 2) * 0.5) / n) * Math.PI * 2; pietra(new THREE.Vector3(r * Math.sin(a), Y_C + RS, r * Math.cos(a)), new THREE.Vector3(0, 1, 0)); } }
  // il beccuccio
  const inclina = new THREE.Vector3(0.22, 1, 0).normalize(), base = new THREE.Vector3(0.05, Y_C + RS, 0), lato = new THREE.Vector3(1, -0.22, 0).normalize(), dentro = new THREE.Vector3(0, 0, 1), R_B = 0.09, H_B = 0.26;
  const becco = new THREE.Mesh(new THREE.CylinderGeometry(R_B, R_B, H_B, 16), smalto); becco.position.copy(base).addScaledVector(inclina, H_B / 2); becco.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inclina); borraccia.add(becco);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 8; i++) { const a = ((i + (k % 2) * 0.5) / 8) * Math.PI * 2, n = lato.clone().multiplyScalar(Math.cos(a)).addScaledVector(dentro, Math.sin(a)); pietra(base.clone().addScaledVector(inclina, 0.05 + k * 0.08).addScaledVector(n, R_B), n, 0.036); }
  pietra(base.clone().addScaledVector(inclina, H_B), inclina, 0.05);

  // il manico: un nastro a U tra i due bottoni, abbassato di lato come nelle foto
  const Y_P = Y(195), giu = new THREE.Vector3(-1.13, Y(445) - Y_P, 0), Z_P = R_T + 0.075;
  const centro = (t) => new THREE.Vector3(0, Y_P, Z_P * Math.cos(t)).addScaledVector(giu, Math.pow(Math.max(0, Math.sin(t)), 0.7));
  const asse = giu.clone().normalize().cross(new THREE.Vector3(0, 0, 1));   // la larghezza del nastro
  const fuori = (t) => { const d = centro(Math.min(Math.PI, t + 0.01)).sub(centro(Math.max(0, t - 0.01))).normalize(); return d.cross(asse).normalize().multiplyScalar(-1); };
  const LARGO = 0.135, SPESSO = 0.05, NM = 120, pos = [], idx = [];
  for (let i = 0; i <= NM; i++) { const t = 0.002 + (Math.PI - 0.004) * (i / NM), c = centro(t), f = fuori(t); for (const [a, b] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) { const q = c.clone().addScaledVector(asse, a * LARGO).addScaledVector(f, b * SPESSO); pos.push(q.x, q.y, q.z); } }
  for (let i = 0; i < NM; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = a + 4, d = b + 4; idx.push(a, c, b, b, c, d); }
  const gm = new THREE.BufferGeometry(); gm.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gm.setIndex(idx); gm.computeVertexNormals();
  const manico = new THREE.Mesh(gm, new THREE.MeshStandardMaterial({ color: 0x5d1426, roughness: 0.5, side: THREE.DoubleSide })); manico.frustumCulled = false; borraccia.add(manico);
  // tre file di gemme, misurate per lunghezza
  { let s = 0, ultimo = centro(0.012); const passo = R_G * 1.95; for (let k = 0; k <= 2400; k++) { const t = 0.012 + (Math.PI - 0.024) * (k / 2400), c = centro(t); s += c.distanceTo(ultimo); ultimo = c; if (s >= passo) { s = 0; const f = fuori(t); for (const a of [-0.095, 0, 0.095]) { pietra(c.clone().addScaledVector(asse, a).addScaledVector(f, SPESSO), f); } for (const a of [-1, 1]) pietra(c.clone().addScaledVector(asse, a * LARGO), asse.clone().multiplyScalar(a).addScaledVector(f, 0.3), 0.032); } } }
  // i bottoni di metallo, ai due capi
  for (const segno of [1, -1]) { const g = new THREE.CylinderGeometry(0.155, 0.16, 0.05, 40); g.rotateX(Math.PI / 2); const b = new THREE.Mesh(g, metallo); b.position.set(0, Y_P, segno * (Z_P + SPESSO + 0.02)); borraccia.add(b); }
  borraccia.add(pietre(voci, materialeGemma(), geometriaPietra({ alta: 1.2, semplice: true })));

  /* ---------- 2. Il giro: trascinando, con la tastiera, o da sola ---------- */
  const stato = { angolo: 0, velocita: 0, inclina: 0, preso: false, ultimaX: 0, ultimaY: 0, ultimoT: 0, tocco: -10 };
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
    stato.velocita = (dx * REGOLA.trascina) / dt;
    stato.inclina = Math.max(-0.3, Math.min(0.3, stato.inclina + dy * REGOLA.trascina * 0.5));
    stato.ultimaX = e.clientX; stato.ultimaY = e.clientY; stato.ultimoT = adesso;
    aggiornaValore();
    sveglia();
  });
  const lascia = () => {
    if (!stato.preso) return;
    stato.preso = false; stato.tocco = performance.now() / 1000;
    if (menoMovimento) stato.velocita = 0;
    palco.classList.remove('e-presa');
    aggiornaValore();
  };
  palco.addEventListener('pointerup', lascia);
  palco.addEventListener('pointercancel', lascia);

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

  // per i lettori di schermo: di quanto è girata, e quale lato si vede
  function aggiornaValore() {
    const gradi = ((Math.round(THREE.MathUtils.radToDeg(stato.angolo)) % 360) + 360) % 360;
    const lato = gradi < 45 || gradi >= 315 ? 'davanti, con le ciliegie' : gradi < 135 ? 'il fianco' : gradi < 225 ? 'il retro' : 'l’altro fianco';
    palco.setAttribute('aria-valuenow', String(gradi));
    palco.setAttribute('aria-valuetext', `${gradi} gradi: si vede ${lato}`);
  }

  /* ---------- Il disegno: solo quando la borraccia si vede ---------- */
  let visibile = false, ciclo = 0, ultimo = 0, pronta = false, chiesta = false;
  function misura() {
    const L = palco.clientWidth, A = palco.clientHeight;
    if (!L || !A) return false;
    motore.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    motore.setSize(L, A, false);
    camera.aspect = L / A;
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
    borraccia.rotation.set(stato.inclina, stato.angolo, 0);
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

  // la pelle pesa, quindi si scarica solo la prima volta che la borraccia si vede.
  // Quando è arrivata, la borraccia 3D prende il posto della foto.
  function chiediPelle() {
    if (chiesta) return;
    chiesta = true;
    new THREE.TextureLoader().load('assets/3d/borraccia-pelle.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;                      // uv.y scende dall'alto, come la foto
      tex.wrapS = THREE.RepeatWrapping;       // il giro si richiude senza stacco
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = Math.min(8, motore.capabilities.getMaxAnisotropy());
      uniformi.uPelle.value = tex;
      pronta = true;
      figura.classList.add('e-3d');
      if (visibile && misura()) { disegna(performance.now()); sveglia(); }
    });
  }

  new IntersectionObserver(([voce]) => {
    visibile = voce.isIntersecting;
    if (visibile) chiediPelle();
    if (visibile && pronta && misura()) { disegna(performance.now()); sveglia(); }
  }, { rootMargin: '200px' }).observe(figura);
  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => { if (visibile && pronta && misura()) disegna(performance.now()); }, 150);
  });
  aggiornaValore();
}
