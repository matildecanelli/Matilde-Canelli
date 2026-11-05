/* ==========================================================================
   statua.js: la Madonna di strass di Matilde, in 3D (Three.js)

   Il lato creativo di Matilde dentro la scheda di Imaze. Si comporta come la
   lattina di Synapses, e come lei indossa le foto vere:
   1. La forma: 88 fotogrammi del video, passati in fotogrammetria (Object Capture
      di Apple), danno una sola statua vera, uguale da ogni lato (assets/3d/madonna.bin).
   2. La pelle: 27 fotogrammi del video proiettati sulla forma. Ogni punto prende il colore
      da quello che lo vede più di fronte, quindi le pietre sono quelle vere
      (assets/3d/madonna-pelle.jpg). La luce del sole è stata attenuata.
   3. Il piedistallo è un blocco rigido, costruito qui sulle misure vere, con le sue
      pietre proiettate dai fotogrammi (assets/3d/madonna-base.jpg): girando resta squadrato.
   Il rilievo e i lampi si ricavano dalla pelle, come sulla lattina.
   4. Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
      nessuno la tocca gira piano da sola. Con "riduci movimento" sta ferma.
   Si disegna solo quando il pannello è aperto e la statua si vede.
   ========================================================================== */

import * as THREE from 'three';

const figura = document.querySelector('[data-statua]');
if (figura) prepara();

function prepara() {
  const palco = figura.querySelector('[data-statua-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    scintille: 0.6,          // la forza dei lampi di luce sulle pietre (0 = spenti)
    giroDaSola: 0.28,        // quanto gira da sola, in radianti al secondo
    trascina: 0.011,         // quanto gira per ogni pixel trascinato
    attrito: 3.2,            // quanto in fretta si ferma dopo una spinta
    passoTastiera: 30,       // gradi per ogni freccia
  };

  let motore;
  try {
    motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (errore) {
    return;                  // senza WebGL resta la foto della statua
  }
  motore.setClearColor(0x000000, 0);
  motore.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(16, 3 / 5, 0.1, 30);
  camera.position.set(0, 0.86, 4.6);
  camera.lookAt(0, 0.5, 0);
  const statua = new THREE.Group();
  scena.add(statua);

  const uniformi = {
    uPelle: { value: null },
    uLuce: { value: new THREE.Vector3(-0.35, 0.55, 1).normalize() },
    uScintille: { value: REGOLA.scintille },
    uPassoT: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
    uCelle: { value: new THREE.Vector2(150, 150) },
  };
  const materiale = new THREE.ShaderMaterial({
    uniforms: uniformi,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = mv.xyz;
        vN = normalMatrix * normal;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uPelle; uniform vec3 uLuce; uniform vec2 uPassoT; uniform float uScintille; uniform vec2 uCelle;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      float chiaro(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
      float caso(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 foto = texture2D(uPelle, vUv).rgb;
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        // la base sulla superficie, dalle derivate: la pelle è fatta a pezzi
        vec3 dp1 = dFdx(vP), dp2 = dFdy(vP); vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
        vec3 t = normalize(dp2 * du1.y * -1.0 + dp1 * du2.y), b = normalize(dp2 * du1.x - dp1 * du2.x);
        // le pietre in rilievo: la pendenza si ricava dalla foto
        vec2 d = uPassoT * 2.5;
        float dx = chiaro(textureLod(uPelle, vUv + vec2(d.x, 0.0), 1.0).rgb) - chiaro(textureLod(uPelle, vUv - vec2(d.x, 0.0), 1.0).rgb);
        float dy = chiaro(textureLod(uPelle, vUv + vec2(0.0, d.y), 1.0).rgb) - chiaro(textureLod(uPelle, vUv - vec2(0.0, d.y), 1.0).rgb);
        vec3 m = normalize(n - (t * dx + b * dy) * 0.55);
        vec3 l = normalize(uLuce), occhio = normalize(-vP), meta = normalize(l + occhio);
        // la forma dà le ombre delle pieghe; la foto ha già la sua luce, quindi poca
        float tondo = clamp(dot(n, normalize(l + vec3(0.0, 0.0, 1.2))), 0.0, 1.0);
        vec3 c = foto * (0.66 + 0.46 * tondo);
        c *= mix(0.78, 1.0, smoothstep(0.0, 0.45, dot(n, occhio)));
        c += vec3(1.0, 0.92, 0.94) * pow(max(dot(m, meta), 0.0), 60.0) * 0.08;
        // le scintille: ogni cella ha la sua inclinazione, mentre gira lampeggia
        vec2 cella = floor(vUv * uCelle);
        vec3 faccetta = normalize(m + 0.55 * (vec3(caso(cella), caso(cella + 3.7), caso(cella + 7.1)) - 0.5));
        c += vec3(1.0, 0.97, 0.96) * pow(max(dot(faccetta, meta), 0.0), 420.0) * 1.7 * uScintille;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });

  /* ---------- Il giro: trascinando, con la tastiera, o da sola ---------- */
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
    const dx = e.clientX - stato.ultimaX;
    stato.angolo += dx * REGOLA.trascina;
    stato.velocita = (dx * REGOLA.trascina) / dt;
    stato.ultimaX = e.clientX; stato.ultimoT = adesso;
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
    const lato = gradi < 45 || gradi >= 315 ? 'davanti, con le mani giunte' : gradi < 135 ? 'il fianco' : gradi < 225 ? 'la schiena' : 'l’altro fianco';
    palco.setAttribute('aria-valuenow', String(gradi));
    palco.setAttribute('aria-valuetext', `${gradi} gradi: si vede ${lato}`);
  }

  /* ---------- Il disegno: solo quando la statua si vede ---------- */
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
    }
    statua.rotation.y = stato.angolo;
    motore.render(scena, camera);
  }
  function passo(adesso) {
    ciclo = 0;
    if (!visibile) return;
    disegna(adesso);
    // con "riduci movimento" si ridisegna solo finché qualcuno la sta girando o la spinta si spegne
    if (!menoMovimento || stato.preso || Math.abs(stato.velocita) > 0.01) ciclo = requestAnimationFrame(passo);
  }
  function sveglia() { if (visibile && !ciclo && pronta) { ultimo = 0; ciclo = requestAnimationFrame(passo); } }

  // La forma: vertici compatti (posizione, pelle, normale) e triangoli
  function costruisci(dati) {
    const testa = new Uint32Array(dati, 0, 2), [nv, ni] = testa;
    const geo = new THREE.BufferGeometry();
    const inter = new THREE.InterleavedBuffer(new Int16Array(dati, 8, nv * 8), 8);
    geo.setAttribute('position', new THREE.InterleavedBufferAttribute(inter, 3, 0, true));
    const uv = new Uint16Array(dati, 8, nv * 8);
    geo.setAttribute('uv', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(uv, 8), 2, 4, true));
    const nor = new Int8Array(dati, 8, nv * 16);
    geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(nor, 16), 3, 12, true));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(dati, 8 + nv * 16, ni), 1));
    const mesh = new THREE.Mesh(geo, materiale);
    mesh.frustumCulled = false;
    statua.add(mesh);
  }

  /* ---------- Il piedistallo: un blocco rastremato con gli spigoli appena arrotondati ---------- */
  function costruisciBlocco(pelleBase) {
    const Y0 = 0.014, Y1 = 0.088, L0 = 0.118, L1 = 0.109, R = 0.009, PC = 6;
    // il contorno, faccia per faccia. u corre lungo le quattro facce, come nella pelle
    const contorno = [];
    for (let f = 0; f < 4; f++) for (let i = 0; i <= 24 + PC; i++) {
      let g, n;                                  // g: lungo la faccia (-1..1), n: fuori (0..1 solo sullo spigolo)
      if (i <= 24) { g = (i / 24) * 2 - 1; n = 0; } else { g = 1; n = (i - 24) / PC; }
      contorno.push({ f, g, n, u: i <= 24 ? (f + 0.5 + g * 0.5) / 4 : (f + 1) / 4 });
    }
    const punto = (c, L) => {
      const interno = L - R, a = (c.n * Math.PI) / 2, s = c.g * interno + Math.sin(a) * R, d = interno + Math.cos(a) * R;
      const [x, z] = [[s, d], [d, -s], [-s, -d], [-d, s]][c.f];
      const [nx, nz] = [[Math.sin(a), Math.cos(a)], [Math.cos(a), -Math.sin(a)], [-Math.sin(a), -Math.cos(a)], [-Math.cos(a), Math.sin(a)]][c.f];
      return { x, z, nx, nz };
    };
    const pos = [], uvs = [], nor = [], idx = [], N = contorno.length;
    [[Y1, L1, 0], [Y0, L0, 1], [Y0 - 0.002, L0 - 0.004, 1]].forEach(([y, L, v]) => contorno.forEach((c) => { const q = punto(c, L); pos.push(q.x, y, q.z); uvs.push(c.u, v); nor.push(q.nx, 0.12, q.nz); }));
    for (let r = 0; r < 2; r++) for (let i = 0; i < N; i++) { const a = r * N + i, b = r * N + (i + 1) % N, c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
    // il piano in alto, su cui poggia il rialzo: si vede solo ai bordi
    const inizio = pos.length / 3;
    contorno.forEach((c) => { const q = punto(c, L1); pos.push(q.x, Y1, q.z); uvs.push(q.x / (8 * L1), q.z / (2 * L1) * 3); nor.push(0, 1, 0); });
    pos.push(0, Y1, 0); uvs.push(0, 0); nor.push(0, 1, 0);
    for (let i = 0; i < N; i++) idx.push(inizio + N, inizio + i, inizio + (i + 1) % N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    const m = materiale.clone();
    m.uniforms.uLuce = uniformi.uLuce; m.uniforms.uScintille = { value: 0 };   // le pietre del blocco brillano già nella foto
    m.uniforms.uPelle = { value: pelleBase };
    m.uniforms.uPassoT = { value: new THREE.Vector2(1 / 2160, 1 / 180) };
    m.uniforms.uCelle = { value: new THREE.Vector2(72, 7) };
    const blocco = new THREE.Mesh(g, m);
    blocco.frustumCulled = false;
    statua.add(blocco);
  }

  // i file pesano, quindi si scaricano solo la prima volta che la statua si vede.
  // Quando sono arrivati, la statua 3D prende il posto della foto.
  function chiediFile() {
    if (chiesta) return;
    chiesta = true;
    const carica = (file, colore) => new Promise((ok, no) => new THREE.TextureLoader().load(file, (tex) => {
      if (colore) tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;                      // la riga 0 è in alto
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = Math.min(8, motore.capabilities.getMaxAnisotropy());
      ok(tex);
    }, undefined, no));
    const scarica = (file) => fetch(file).then((r) => { if (!r.ok) throw new Error(file); return r.arrayBuffer(); });
    Promise.all([scarica('assets/3d/madonna.bin'), carica('assets/3d/madonna-pelle.jpg', true), carica('assets/3d/madonna-base.jpg', true)]).then(([dati, pelle, base]) => {
      costruisci(dati);
      base.wrapS = THREE.RepeatWrapping; base.wrapT = THREE.MirroredRepeatWrapping; base.needsUpdate = true;
      costruisciBlocco(base);
      uniformi.uPelle.value = pelle;
      pronta = true;
      figura.classList.add('e-3d');
      if (visibile && misura()) { disegna(performance.now()); sveglia(); }
    }).catch(() => {});                       // se qualcosa non arriva, resta la foto
  }

  new IntersectionObserver(([voce]) => {
    visibile = voce.isIntersecting;
    if (visibile) chiediFile();
    if (visibile && pronta && misura()) { disegna(performance.now()); sveglia(); }
  }, { rootMargin: '200px' }).observe(figura);
  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => { if (visibile && misura()) disegna(performance.now()); }, 150);
  });
  aggiornaValore();
}
