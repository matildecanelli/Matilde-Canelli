/* ==========================================================================
   statua.js: la Madonna di strass di Matilde, in 3D (Three.js)

   Il lato creativo di Matilde dentro la scheda di Imaze. Si comporta come la
   lattina di Synapses, ma la forma è ricostruita dal suo video:
   1. La forma: 88 fotogrammi del video, passati in fotogrammetria (Object Capture
      di Apple), danno una sola statua vera, uguale da ogni lato (assets/3d/madonna.bin).
   2. Sotto: la pelle ricavata dal video, scurita, si vede solo negli spazi tra le pietre
      (assets/3d/madonna-pelle.jpg).
   3. Le pietre: gemme 3D vere posate sulla superficie, così sporgono anche dal
      contorno (assets/3d/madonna-pietre.bin, da strumenti/madonna-pietre.js).
      Hanno poche faccette, quindi vanno bene anche sui telefoni.
   4. Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
      nessuno la tocca gira piano da sola. Con "riduci movimento" sta ferma.
   Si disegna solo quando il pannello è aperto e la statua si vede.
   ========================================================================== */

import * as THREE from 'three';
import { pietre, materialeGemma, geometriaPietra } from './strass.js';

const figura = document.querySelector('[data-statua]');
if (figura) prepara();

function prepara() {
  const palco = figura.querySelector('[data-statua-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
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
    uLuce: { value: new THREE.Vector3(-0.45, 0.65, 0.75).normalize() },
    uLuce2: { value: new THREE.Vector3(0.7, 0.25, 0.55).normalize() },
  };
  // la superficie sotto le pietre: scura, si vede solo negli spazi e dà il rilievo
  const materiale = new THREE.ShaderMaterial({
    uniforms: uniformi,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN;
      void main(){
        vUv = uv;
        vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uPelle; uniform vec3 uLuce; uniform vec3 uLuce2;
      varying vec2 vUv; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN);
        vec3 c = texture2D(uPelle, vUv).rgb * 0.34 * (0.6 + 0.6 * max(dot(n, uLuce), 0.0) + 0.26 * max(dot(n, uLuce2), 0.0));
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

  // Le pietre: posizione, normale, raggio e colore, una per una
  function posaPietre(dati) {
    const dv = new DataView(dati), voci = [];
    for (let i = 0, n = dv.getUint32(0, true); i < n; i++) {
      const o = 4 + i * 16;
      voci.push({
        p: new THREE.Vector3(dv.getInt16(o, true) / 32767, dv.getInt16(o + 2, true) / 32767, dv.getInt16(o + 4, true) / 32767),
        n: new THREE.Vector3(dv.getInt8(o + 6) / 127, dv.getInt8(o + 7) / 127, dv.getInt8(o + 8) / 127).normalize(),
        r: dv.getUint8(o + 9) / 10000,
        colore: [dv.getUint8(o + 10) / 255, dv.getUint8(o + 11) / 255, dv.getUint8(o + 12) / 255],
      });
    }
    statua.add(pietre(voci, materialeGemma(), geometriaPietra({ alta: 1.2, semplice: true })));
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
    Promise.all([scarica('assets/3d/madonna.bin'), scarica('assets/3d/madonna-pietre.bin'), carica('assets/3d/madonna-pelle.jpg', true)]).then(([dati, sassi, pelle]) => {
      costruisci(dati);
      posaPietre(sassi);
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
