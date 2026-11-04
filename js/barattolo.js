/* ==========================================================================
   barattolo.js: il barattolo di crema tempestato di strass, da girare (Three.js)

   Il lato creativo di Matilde dentro la scheda di Virtuoso, costruito come la lattina:
   1. La pelle: quattro viste del barattolo, srotolate e cucite in un'unica
      immagine che gira tutto intorno (assets/3d/barattolo-pelle.jpg). I testi restano leggibili.
   2. La forma: un tornio con il corpo, la giuntura e il coperchio. Sopra il coperchio,
      che le viste non mostrano bene, ci sono gemme 3D dello stesso azzurro.
   3. Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
      nessuno lo tocca gira piano da solo. Con "riduci movimento" sta fermo.
   Si disegna solo quando il pannello è aperto e il barattolo si vede.
   ========================================================================== */

import * as THREE from 'three';
import { pietre, materialeGemma, geometriaPietra } from './strass.js';

const figura = document.querySelector('[data-barattolo]');
if (figura) prepara();

function prepara() {
  const palco = figura.querySelector('[data-barattolo-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    altezza: 1.6,            // altezza del barattolo, con il raggio = 1
    coperchio: 0.27,         // quanta parte dell'etichetta è coperchio
    rilievo: 0.012,          // quanto sporgono le pietre dalla superficie
    scintille: 1,            // la forza dei lampi di luce sulle pietre (0 = spenti)
    giroDaSola: 0.28,        // quanto gira da solo, in radianti al secondo
    trascina: 0.011,         // quanto gira per ogni pixel trascinato
    attrito: 3.2,            // quanto in fretta si ferma dopo una spinta
    passoTastiera: 30,       // gradi per ogni freccia
  };

  let motore;
  try {
    motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (errore) {
    return;                  // senza WebGL resta la foto del barattolo
  }
  motore.setClearColor(0x000000, 0);
  motore.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(12, 4 / 3, 1, 60);
  camera.position.set(0, 2.5, 13.5);
  camera.lookAt(0, 0, 0);
  const barattolo = new THREE.Group();
  scena.add(barattolo);

  /* ---------- 1. La forma ---------- */
  const H = REGOLA.altezza, V_G = REGOLA.coperchio;
  const liscio = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // v = 0 in cima all'etichetta, 1 in fondo: la giuntura rientra appena, il fondo si arrotonda
  const raggio = (v) => 1 - 0.02 * Math.exp(-(((v - V_G) / 0.008) ** 2)) - 0.05 * liscio(0.965, 1, v);
  const quota = (v) => (0.5 - v) * H;
  const uniformi = {
    uPelle: { value: null },
    uLuce: { value: new THREE.Vector3(-0.35, 0.55, 1).normalize() },
    uRilievo: { value: REGOLA.rilievo },
    uScintille: { value: REGOLA.scintille },
    uPassoT: { value: new THREE.Vector2(1 / 2800, 1 / 760) },
  };
  const SEG_GIRO = 256, SEG_ALTO = 180, SPALLA = 8;
  const posizioni = [], uvs = [], normali = [], indici = [];
  // prima la spalla del coperchio, che piega verso l'interno, poi il fianco
  const metti = (r, y, t, nr, ny) => { for (let i = 0; i <= SEG_GIRO; i++) { const u = i / SEG_GIRO, a = u * Math.PI * 2; posizioni.push(r * Math.sin(a), y, r * Math.cos(a)); uvs.push(u, t); normali.push(nr * Math.sin(a), ny, nr * Math.cos(a)); } };
  const RS = 0.075, INIZIO = 0.03;   // la spalla usa la prima fetta dell'etichetta: così le pietre non si stirano
  for (let j = 0; j < SPALLA; j++) { const f = j / SPALLA, b = (1 - f) * Math.PI * 0.5; metti(1 - RS + RS * Math.cos(b), quota(0) + RS * Math.sin(b), INIZIO * f, Math.cos(b), Math.sin(b)); }
  for (let j = 0; j <= SEG_ALTO; j++) { const f = j / SEG_ALTO, t = INIZIO + (1 - INIZIO) * f, dr = (raggio(Math.min(1, t + 0.002)) - raggio(Math.max(0, t - 0.002))) / (0.004 * H), l = Math.hypot(1, dr); metti(raggio(t), quota(f), t, 1 / l, dr / l); }
  for (let j = 0; j < SEG_ALTO + SPALLA; j++) for (let i = 0; i < SEG_GIRO; i++) { const p = j * (SEG_GIRO + 1) + i, q = p + 1, s = p + SEG_GIRO + 1, w = s + 1; indici.push(p, s, q, q, s, w); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posizioni, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normali, 3));
  geo.setIndex(indici);
  const pelle = new THREE.Mesh(geo, new THREE.ShaderMaterial({
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
        // è tondo: un po' più buio verso i fianchi. La foto ha già la sua luce, quindi poco.
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
  }));
  pelle.frustumCulled = false;
  barattolo.add(pelle);

  // Il sopra del coperchio: un disco azzurro con cerchi di gemme, e il fondo chiuso
  const yCima = quota(0) + RS;
  const disco = (y, r, colore) => { const g = new THREE.CircleGeometry(r, 64); g.rotateX(y > 0 ? -Math.PI / 2 : Math.PI / 2); g.translate(0, y, 0); barattolo.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colore }))); };
  disco(yCima, 1 - RS + 0.01, 0x1a86a4);
  disco(quota(1), 0.96, 0x8d8f93);
  const voci = [], R_G = 0.043, COLORE = [0.3, 0.8, 0.92];
  for (let r = 1 - RS - 0.01; r > 0.02; r -= R_G * 1.82) {
    const n = Math.max(1, Math.floor((Math.PI * 2 * r) / (R_G * 1.95)));
    for (let i = 0; i < n; i++) { const a = ((i + (Math.round(r * 100) % 2) * 0.5) / n) * Math.PI * 2; voci.push({ p: new THREE.Vector3(r * Math.sin(a), yCima, r * Math.cos(a)), n: new THREE.Vector3(0, 1, 0), r: R_G, colore: COLORE }); }
  }
  barattolo.add(pietre(voci, materialeGemma(), geometriaPietra({ alta: 1, semplice: true })));

  /* ---------- 2. Il giro: trascinando, con la tastiera, o da solo ---------- */
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

  // per i lettori di schermo: di quanto è girato, e quale lato si vede
  function aggiornaValore() {
    const gradi = ((Math.round(THREE.MathUtils.radToDeg(stato.angolo)) % 360) + 360) % 360;
    const lato = gradi < 45 || gradi >= 315 ? 'davanti, con il logo' : gradi < 135 ? 'il fianco' : gradi < 225 ? 'il retro' : 'l’altro fianco';
    palco.setAttribute('aria-valuenow', String(gradi));
    palco.setAttribute('aria-valuetext', `${gradi} gradi: si vede ${lato}`);
  }

  /* ---------- Il disegno: solo quando il barattolo si vede ---------- */
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
      // dopo una spinta rallenta piano; poi, se nessuno lo tocca da un po', riprende a girare da solo
      stato.angolo += stato.velocita * dt;
      stato.velocita *= Math.exp(-REGOLA.attrito * dt);
      if (!menoMovimento && t - stato.tocco > 2.5) stato.angolo += REGOLA.giroDaSola * dt * Math.min(1, (t - stato.tocco - 2.5) / 1.5);
      stato.inclina *= Math.exp(-2 * dt);
    }
    barattolo.rotation.set(stato.inclina, stato.angolo, 0);
    motore.render(scena, camera);
  }
  function passo(adesso) {
    ciclo = 0;
    if (!visibile) return;
    disegna(adesso);
    // con "riduci movimento" si ridisegna solo finché qualcuno lo sta girando o la spinta si spegne
    if (!menoMovimento || stato.preso || Math.abs(stato.velocita) > 0.01 || Math.abs(stato.inclina) > 0.002) ciclo = requestAnimationFrame(passo);
  }
  function sveglia() { if (visibile && !ciclo && pronta) { ultimo = 0; ciclo = requestAnimationFrame(passo); } }

  // la pelle pesa, quindi si scarica solo la prima volta che il barattolo si vede.
  // Quando è arrivata, il barattolo 3D prende il posto della foto.
  function chiediPelle() {
    if (chiesta) return;
    chiesta = true;
    new THREE.TextureLoader().load('assets/3d/barattolo-pelle.jpg', (tex) => {
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
