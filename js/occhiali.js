/* ==========================================================================
   occhiali.js: gli occhiali da sole di strass di Matilde, in 3D (Three.js)

   Il lato creativo di Matilde dentro la scheda di Ju1ce. La forma è misurata sulle
   sagome delle sue foto: montatura e aste sono un solo pezzo che avvolge il viso e si
   assottiglia verso i terminali. Fuori è coperto di pietre chiare, dentro è bianco
   perlato e liscio, davanti alle lenti ci sono pietre nere. Ogni pietra è un oggetto
   a sé. Forma e pietre sono calcolate una volta sola (strumenti/occhiali-genera.js,
   assets/3d/occhiali.bin).
   Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
   nessuno li tocca girano piano da soli. Con "riduci movimento" stanno fermi.
   Si disegna solo quando il pannello è aperto e gli occhiali si vedono.
   ========================================================================== */

import * as THREE from 'three';
import { stanzaDiLuci, pietre, materialeGemma, geometriaPietra } from './strass.js';

const figura = document.querySelector('[data-occhiali]');
if (figura) prepara();

function prepara() {
  const palco = figura.querySelector('[data-occhiali-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    scala: 0.36,             // da pixel del foglio delle viste a millimetri
    stacco: 0.5,            // lo spazio bianco tra le pietre e la lente
    giroDaSola: 16,          // quanto girano da soli, in gradi al secondo
    trascina: 0.63,          // quanti gradi per ogni pixel trascinato
    attrito: 3.2,            // quanto in fretta si fermano dopo una spinta
    passoTastiera: 30,       // gradi per ogni freccia
  };

  let motore;
  try {
    motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (errore) {
    return;                  // senza WebGL resta la foto
  }
  motore.setClearColor(0x000000, 0);
  motore.toneMapping = THREE.ACESFilmicToneMapping;
  motore.toneMappingExposure = 1.05;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(13, 4 / 3, 50, 2000);   // un teleobiettivo, come nelle foto: non schiaccia le estremità
  camera.position.set(0, 80, 560);
  camera.lookAt(0, 0, 0);
  const perno = new THREE.Group();
  scena.add(perno);
  const occhiali = new THREE.Group();
  occhiali.position.z = 61;      // il perno sta a metà tra le lenti e la fine delle stanghette
  perno.add(occhiali);

  // La forma è già calcolata (strumenti/occhiali-genera.js): qui si legge il file e si monta
  function costruisci(dati) {
    const testa = new Uint32Array(dati, 0, 4), [nParti, nChiare, nNere, nCerniere] = testa;
    const misure = new Uint32Array(dati, 16, nParti * 2);
    let o = 16 + nParti * 8;
    const prendi = (Tipo, n) => { o = Math.ceil(o / Tipo.BYTES_PER_ELEMENT) * Tipo.BYTES_PER_ELEMENT; const a = new Tipo(dati, o, n); o += a.byteLength; return a; };

    /* ---------- I materiali ---------- */
    const stanza = stanzaDiLuci(motore);   // assegnata a ogni materiale: così ognuno decide quanto riflettere
    const luce = new THREE.DirectionalLight(0xffffff, 1);
    luce.position.set(-0.4, 1, 0.8);
    scena.add(luce);
    const metallo = new THREE.MeshStandardMaterial({ color: 0xdcdde0, metalness: 1, roughness: 0.35, envMap: stanza });
    scena.add(new THREE.HemisphereLight(0xffffff, 0xb9b4b8, 1.5));
    // la plastica è bianca e liscia; sotto le pietre nere è scuro; da dietro le lenti sono vetro scuro
    const corpi = [
      new THREE.MeshStandardMaterial({ color: 0xeeebea, vertexColors: true, metalness: 0.1, roughness: 0.2, side: THREE.DoubleSide, envMap: stanza, envMapIntensity: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x030304, metalness: 0, roughness: 0.75, side: THREE.DoubleSide, envMap: stanza, envMapIntensity: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x060507, metalness: 0.2, roughness: 0.22, side: THREE.DoubleSide, envMap: stanza, envMapIntensity: 0.35 }),
    ];
    for (let i = 0; i < nParti; i++) {
      const q = prendi(Int16Array, misure[i * 2]), idx = prendi(Uint16Array, misure[i * 2 + 1]), fronte = prendi(Uint8Array, misure[i * 2] / 3), p = new Float32Array(q.length);
      for (let k = 0; k < q.length; k++) p[k] = q[k] / 100;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      // dentro è bianca; il filo attorno alla lente è chiaro; sotto le pietre è scuro: da lì viene il rilievo
      const col = new Float32Array(q.length), TONI = [[1, 1, 1], [0.72, 0.7, 0.68], [0.1, 0.09, 0.085]];
      for (let k = 0; k < fronte.length; k++) col.set(TONI[fronte[k]], k * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      occhiali.add(new THREE.Mesh(g, corpi[i]));
    }
    const voci = (n) => { const b = prendi(Int16Array, n * 8), l = []; for (let i = 0; i < n; i++) { const a = i * 8; l.push({ p: new THREE.Vector3(b[a] / 100, b[a + 1] / 100, b[a + 2] / 100), n: new THREE.Vector3(b[a + 3] / 32767, b[a + 4] / 32767, b[a + 5] / 32767), r: b[a + 6] / 1000 }); } return l; };
    occhiali.add(pietre(voci(nChiare), materialeGemma(), geometriaPietra({ alta: 1.2 })), pietre(voci(nNere), materialeGemma(true)));
    const mat = prendi(Float32Array, nCerniere * 16), scatola = new THREE.BoxGeometry(3.2, 5, 0.8);
    for (let i = 0; i < nCerniere; i++) { const c = new THREE.Mesh(scatola, metallo); c.matrixAutoUpdate = false; c.matrix.fromArray(mat, i * 16); occhiali.add(c); }
  }

  /* ---------- Il giro: trascinando, con la tastiera, o da soli ---------- */
  const rad = THREE.MathUtils.degToRad;
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
    stato.inclina = Math.max(-0.45, Math.min(0.45, stato.inclina + dy * 0.004));
    stato.velocita = (dx * REGOLA.trascina) / dt;
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
    stato.angolo = e.key === 'Home' ? 0 : stato.angolo + gradi;
    aggiornaValore();
    sveglia();
  });

  // per i lettori di schermo: di quanto sono girati, e quale lato si vede
  function aggiornaValore() {
    const gradi = ((Math.round(stato.angolo) % 360) + 360) % 360;
    const lato = gradi < 45 || gradi >= 315 ? 'davanti, con le lenti nere' : gradi < 135 ? 'una stanghetta' : gradi < 225 ? 'dietro, con l’interno bianco' : 'l’altra stanghetta';
    palco.setAttribute('aria-valuenow', String(gradi));
    palco.setAttribute('aria-valuetext', `${gradi} gradi: si vede ${lato}`);
  }

  /* ---------- Il disegno: solo quando gli occhiali si vedono ---------- */
  let visibile = false, ciclo = 0, ultimo = 0;
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
      stato.angolo += stato.velocita * dt;
      stato.velocita *= Math.exp(-REGOLA.attrito * dt);
      if (!menoMovimento && t - stato.tocco > 2.5) stato.angolo += REGOLA.giroDaSola * dt * Math.min(1, (t - stato.tocco - 2.5) / 1.5);
      stato.inclina *= Math.exp(-2 * dt);
    }
    perno.rotation.set(stato.inclina, rad(stato.angolo), 0);
    motore.render(scena, camera);
  }
  function passo(adesso) {
    ciclo = 0;
    if (!visibile) return;
    disegna(adesso);
    // con "riduci movimento" si ridisegna solo finché qualcuno li sta girando o la spinta si spegne
    if (!menoMovimento || stato.preso || Math.abs(stato.velocita) > 0.5 || Math.abs(stato.inclina) > 0.002) ciclo = requestAnimationFrame(passo);
  }
  function sveglia() { if (visibile && !ciclo && pronti) { ultimo = 0; ciclo = requestAnimationFrame(passo); } }

  // il modello si scarica solo la prima volta che gli occhiali si vedono: al suo posto, intanto, la foto
  let chiesto = false, pronti = false;
  function chiedi() {
    if (chiesto) return;
    chiesto = true;
    fetch('assets/3d/occhiali.bin').then((r) => { if (!r.ok) throw new Error('modello'); return r.arrayBuffer(); }).then((dati) => {
      costruisci(dati);
      pronti = true;
      figura.classList.add('e-3d');
      if (visibile && misura()) { disegna(performance.now()); sveglia(); }
    }).catch(() => {});                       // se non arriva, resta la foto
  }
  new IntersectionObserver(([voce]) => {
    visibile = voce.isIntersecting;
    if (visibile) chiedi();
    if (visibile && pronti && misura()) { disegna(performance.now()); sveglia(); }
  }, { rootMargin: '200px' }).observe(figura);
  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => { if (visibile && pronti && misura()) disegna(performance.now()); }, 150);
  });
  aggiornaValore();
}
