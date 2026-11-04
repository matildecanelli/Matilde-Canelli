/* ==========================================================================
   lattina.js: la lattina di strass di Matilde, da girare (Three.js)

   Il lato creativo di Matilde dentro la scheda di Synapses.
   1. La pelle: dieci foto della lattina vera, scattate girandole intorno e
      cucite in un'unica immagine a 360° (assets/img/lattina-pelle.jpg). Gli
      strass che si vedono sono quelli veri.
   2. La forma: il profilo della lattina (collo stretto, corpo dritto, fondo
      tondo), fatto girare su sé stesso come al tornio. La superficie si
      alza un poco dove la foto ha le pietre, così il bordo è bitorzoluto.
   3. La luce: sopra la foto, le pietre prendono riflessi e scintille che si
      muovono mentre la lattina gira. Il coperchio e il fondo sono di metallo
      nudo, come sulla lattina vera.
   4. Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
      nessuno la tocca gira piano da sola. Con "riduci movimento" sta ferma.
   Si disegna solo quando il pannello è aperto e la lattina si vede.
   ========================================================================== */

import * as THREE from 'three';

const figura = document.querySelector('[data-lattina]');
if (figura) prepara();

function prepara() {
  const palco = figura.querySelector('[data-lattina-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    altezza: 5.3,            // altezza della lattina, con il raggio = 1
    rilievo: 0.016,          // quanto sporgono le pietre dalla superficie
    scintille: 1,            // la forza dei lampi di luce sulle pietre (0 = spenti)
    giroDaSola: 0.28,        // quanto gira da sola, in radianti al secondo
    trascina: 0.011,         // quanto gira per ogni pixel trascinato
    attrito: 3.2,            // quanto in fretta si ferma dopo una spinta
    passoTastiera: 30,       // gradi per ogni freccia
  };

  let motore;
  try {
    motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (errore) {
    return;                  // senza WebGL resta la foto della lattina
  }
  motore.setClearColor(0x000000, 0);
  motore.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 1, 100);
  camera.position.set(0, 2.2, 19);
  camera.lookAt(0, -0.05, 0);
  const lattina = new THREE.Group();
  scena.add(lattina);

  /* ---------- 1. La forma ---------- */
  const H = REGOLA.altezza;
  const liscio = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // il raggio a ogni altezza (v = 0 in cima, 1 in fondo) e la quota
  const raggio = (v) => 0.8 + 0.2 * liscio(0, 0.1, v) - 0.13 * liscio(0.95, 1, v);
  const quota = (v) => (0.5 - v) * H;
  const FINE_PELLE = 0.965;  // sotto gli ultimi strass c'è il fondo di metallo

  // la luce: si muove un poco seguendo il puntatore
  const uniformi = {
    uPelle: { value: null },
    uLuce: { value: new THREE.Vector3(-0.35, 0.55, 1).normalize() },
    uRilievo: { value: REGOLA.rilievo },
    uScintille: { value: REGOLA.scintille },
    uPassoT: { value: new THREE.Vector2(1 / 1536, 1 / 1320) },
  };

  // La pelle: la parte alta del tornio, dal collo agli ultimi strass.
  // uv.x gira intorno alla lattina, uv.y scende dall'alto (la foto non è capovolta).
  const SEG_GIRO = 512, SEG_ALTO = 420;
  const posizioni = [], uvs = [], normali = [], indici = [];
  for (let j = 0; j <= SEG_ALTO; j++) {
    const t = j / SEG_ALTO, v = t * FINE_PELLE;
    const r = raggio(v), y = quota(v);
    const dr = (raggio(Math.min(1, v + 0.002)) - raggio(Math.max(0, v - 0.002))) / (0.004 * H);   // la pendenza del profilo
    for (let i = 0; i <= SEG_GIRO; i++) {
      const u = i / SEG_GIRO, a = u * Math.PI * 2;
      const sx = Math.sin(a), cz = Math.cos(a);
      posizioni.push(r * sx, y, r * cz);
      uvs.push(u, t);
      const l = Math.hypot(1, dr);
      normali.push(sx / l, dr / l, cz / l);
    }
  }
  for (let j = 0; j < SEG_ALTO; j++) for (let i = 0; i < SEG_GIRO; i++) {
    const p = j * (SEG_GIRO + 1) + i, q = p + 1, s = p + SEG_GIRO + 1, w = s + 1;
    indici.push(p, s, q, q, s, w);
  }
  const geoPelle = new THREE.BufferGeometry();
  geoPelle.setAttribute('position', new THREE.Float32BufferAttribute(posizioni, 3));
  geoPelle.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geoPelle.setAttribute('normal', new THREE.Float32BufferAttribute(normali, 3));
  geoPelle.setIndex(indici);

  const materialePelle = new THREE.ShaderMaterial({
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
        vec3 occhio = normalize(-vP);
        vec3 meta = normalize(l + occhio);
        // la lattina è tonda: un po' più buia verso i fianchi. La foto ha già la sua luce, quindi poco.
        float tondo = clamp(dot(n, normalize(l + vec3(0.0, 0.0, 1.2))), 0.0, 1.0);
        vec3 c = pow(foto, vec3(1.3)) * 1.12 * (0.62 + 0.5 * tondo);   // più contrasto: i neri restano neri
        // il riflesso che scorre sulle pietre
        c += vec3(1.0) * pow(max(dot(m, meta), 0.0), 60.0) * 0.1;
        // le scintille: tante faccette minuscole, ognuna inclinata a caso. Si accendono solo
        // quando sono girate giuste verso la luce, quindi mentre la lattina gira lampeggiano.
        vec2 cella = floor(vUv * vec2(520.0, 450.0));
        vec3 faccetta = normalize(m + 0.55 * (vec3(caso(cella), caso(cella + 3.7), caso(cella + 7.1)) - 0.5));
        c += vec3(1.0, 0.98, 0.92) * pow(max(dot(faccetta, meta), 0.0), 420.0) * 1.7 * uScintille;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const pelle = new THREE.Mesh(geoPelle, materialePelle);
  pelle.frustumCulled = false;
  lattina.add(pelle);

  // Il metallo nudo: il coperchio nero in cima e il fondo d'alluminio
  function metallo(colore, lucido) {
    return new THREE.ShaderMaterial({
      uniforms: { uLuce: uniformi.uLuce, uColore: { value: new THREE.Color(colore) }, uLucido: { value: lucido } },
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vN; varying vec3 vP;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform vec3 uLuce; uniform vec3 uColore; uniform float uLucido;
        varying vec3 vN; varying vec3 vP;
        void main(){
          vec3 n = normalize(vN); if (dot(n, -vP) < 0.0) n = -n;
          vec3 r = reflect(normalize(vP), n);
          // bande chiare e scure, come un metallo che rispecchia la stanza
          float bande = smoothstep(-0.2, 0.5, sin(r.y * 7.0 + r.x * 3.0));
          vec3 c = uColore * (0.55 + 0.6 * bande) + vec3(1.0) * pow(max(dot(r, normalize(uLuce)), 0.0), 24.0) * uLucido;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }
  const yCima = quota(0);
  const bordo = [[0, yCima - 0.06], [0.68, yCima - 0.06], [0.74, yCima + 0.05], [0.78, yCima + 0.06], [0.815, yCima + 0.02], [0.8, yCima - 0.04]];
  lattina.add(new THREE.Mesh(new THREE.LatheGeometry(bordo.map((p) => new THREE.Vector2(p[0], p[1])), 96), metallo(0x08080a, 0.7)));
  const fondo = [];
  for (let i = 0; i <= 12; i++) { const v = FINE_PELLE + (i / 12) * (1 - FINE_PELLE); fondo.push(new THREE.Vector2(raggio(v) * 0.985, quota(v))); }
  fondo.push(new THREE.Vector2(0.62, quota(1) + 0.03), new THREE.Vector2(0, quota(1) + 0.09));
  lattina.add(new THREE.Mesh(new THREE.LatheGeometry(fondo, 96), metallo(0x8d8f93, 0.8)));

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
    const lato = gradi < 45 || gradi >= 315 ? 'davanti, con il logo' : gradi < 135 ? 'il fianco' : gradi < 225 ? 'il retro' : 'l’altro fianco';
    palco.setAttribute('aria-valuenow', String(gradi));
    palco.setAttribute('aria-valuetext', `${gradi} gradi: si vede ${lato}`);
  }

  /* ---------- Il disegno: solo quando la lattina si vede ---------- */
  let visibile = false, ciclo = 0, ultimo = 0, pronta = false;
  function misura() {
    const L = palco.clientWidth, A = palco.clientHeight;
    if (!L || !A) return false;
    motore.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    motore.setSize(L, A, false);
    camera.aspect = L / A;
    // la lattina deve stare tutta nel riquadro, anche se è stretto
    const alta = H + 1.4, larga = 2.6 / camera.aspect;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(alta, larga) / 2 / 19.1));
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
    lattina.rotation.set(stato.inclina, stato.angolo, 0);
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

  // la pelle pesa, quindi si scarica solo la prima volta che la lattina si vede.
  // Quando è arrivata, la lattina 3D prende il posto della foto.
  let chiesta = false;
  function chiediPelle() {
    if (chiesta) return;
    chiesta = true;
    new THREE.TextureLoader().load('assets/img/lattina-pelle.jpg', (tex) => {
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
    attesa = setTimeout(() => { if (visibile && misura()) disegna(performance.now()); }, 150);
  });
  aggiornaValore();
}
