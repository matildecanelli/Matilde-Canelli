/* ==========================================================================
   calice.js: il calice da spritz tempestato di strass, da girare (Three.js)

   Il lato creativo di Matilde dentro la scheda di Energia Pura, al posto della borraccia.
   1. La forma: un tornio misurato sul contorno del calice vero (il calice Aperol):
      la coppa, lo stelo sottile e il piede largo.
   2. Sotto le pietre il vetro ha il colore di quello che c'è dietro: rosso dove c'è lo
      spritz, chiaro sopra, sullo stelo e sul piede. Dentro lo spritz e i cubetti di ghiaccio
      con gli spigoli smussati e il cuore torbido, ammucchiati fino al bordo.
   3. Le pietre sono gemme 3D vere (js/strass.js), in file sfalsate lungo il profilo:
      rosse nella coppa, trasparenti nel resto, e un giro sul bordo.
   4. Lo stecchino di metallo con il cristallo in punta e l'oliva tempestata di strass verdi.
   5. Si gira trascinando (mouse o dito), con le frecce della tastiera, e quando
      nessuno lo tocca gira piano da solo. Con "riduci movimento" sta fermo.
   Si costruisce la prima volta che si vede, e si disegna solo quando si vede.
   ========================================================================== */

import * as THREE from 'three';
import { casuale, pietre, materialeGemma, geometriaPietra, stanzaDiLuci } from './strass.js';

const figura = document.querySelector('[data-calice]');
if (figura) prepara();

function prepara() {
  const palco = figura.querySelector('[data-calice-palco]');
  const canvas = palco.querySelector('canvas');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    pietra: 0.046,           // il raggio delle pietre sulla coppa (il raggio della coppa = 1)
    pietraMin: 0.026,        // le pietre più piccole, sullo stelo
    vicinanza: 0.98,         // la distanza tra due pietre (1 = si toccano)
    giroDaSola: 0.28,        // quanto gira da solo, in radianti al secondo
    trascina: 0.011,         // quanto gira per ogni pixel trascinato
    attrito: 3.2,            // quanto in fretta si ferma dopo una spinta
    passoTastiera: 30,       // gradi per ogni freccia
  };

  let motore;
  try {
    motore = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (errore) {
    return;                  // senza WebGL resta la foto del calice
  }
  motore.setClearColor(0x000000, 0);
  motore.outputColorSpace = THREE.SRGBColorSpace;

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(15.5, 3 / 5, 1, 80);
  camera.position.set(0, 3, 24);
  camera.lookAt(0, 0, 0);
  const calice = new THREE.Group();
  const sostegno = new THREE.Group();      // il calice un po' più in basso: sopra c'è lo stecchino
  sostegno.position.y = -0.42;
  sostegno.scale.setScalar(0.94);         // il calice Aperol è alto: un filo più piccolo, così ci stanno anche lo stecchino e il piede
  sostegno.add(calice);
  scena.add(sostegno);

  /* ---------- 1. La forma, misurata sulla foto del calice Aperol (in pixel: riga, raggio) ---------- */
  const S = 95;                                         // il raggio massimo della coppa, in pixel: diventa 1
  const Y = (riga) => (296 - riga) / S;                 // dalla riga all'altezza (il centro è a metà del calice)
  // la coppa a tulipano, lo stelo con il nodo in alto che si assottiglia verso il basso, il piede tondo
  const PROFILO = [[78, 78.5], [102, 80.5], [126, 84], [150, 88.5], [174, 93], [204, 95.5], [228, 94], [246, 89.5], [258, 84], [270, 75.5],
    [282, 61.5], [294, 50], [300, 45], [306, 37], [309, 27], [312, 19], [318, 15.5], [324, 14.5], [330, 15.5], [342, 19.5], [354, 19.5],
    [366, 18.5], [384, 16.5], [402, 14.5], [420, 13], [438, 11], [456, 9.5], [472, 8.5], [480, 10], [486, 41], [492, 65.5], [498, 77.5],
    [504, 81.5], [510, 83]];
  const RIGA_SPRITZ = 150, RIGA_FONDO = 290;            // dove arriva lo spritz, e il fondo della coppa dentro
  const R_BORDO = 78.5 / S, Y_BORDO = Y(78);
  // il profilo fitto, in unità: [raggio, altezza, riga]
  const punti = [];
  for (let i = 0; i < PROFILO.length - 1; i++) {
    const [r0, a0] = PROFILO[i], [r1, a1] = PROFILO[i + 1];
    for (let k = 0; k < 6; k++) { const t = k / 6, riga = r0 + (r1 - r0) * t; punti.push([(a0 + (a1 - a0) * t) / S, Y(riga), riga]); }
  }
  const [ultima, rPiede] = PROFILO[PROFILO.length - 1];
  const yPiede = Y(ultima);
  punti.push([rPiede / S, yPiede, ultima], [rPiede / S, yPiede - 0.03, ultima + 1], [rPiede / S - 0.04, yPiede - 0.05, ultima + 2], [0.001, yPiede - 0.055, ultima + 3]);   // il bordo del piede e il fondo

  const SEG = 128;
  // un tornio dai suoi punti [raggio, altezza], con un colore per riga
  function tornio(righe, colore) {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    righe.forEach((q) => {
      c.set(colore(q));
      for (let i = 0; i <= SEG; i++) { const a = (i / SEG) * Math.PI * 2; pos.push(q[0] * Math.sin(a), q[1], q[0] * Math.cos(a)); col.push(c.r, c.g, c.b); }
    });
    for (let j = 0; j < righe.length - 1; j++) for (let i = 0; i < SEG; i++) { const p = j * (SEG + 1) + i, s = p + SEG + 1; idx.push(p, s, p + 1, p + 1, s, s + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // un cubetto di ghiaccio vero: un cubo con gli spigoli tondi (smusso, in proporzione al lato)
  // e le facce appena ondulate, come quando il ghiaccio comincia a sciogliersi
  function cubettoDiGhiaccio(lato, smusso, onde, dado) {
    const g = new THREE.BoxGeometry(1, 1, 1, 10, 10, 10), pos = g.attributes.position, v = new THREE.Vector3(), dentro = new THREE.Vector3();
    const m = 0.5 - smusso / 2, fase = [dado() * 6, dado() * 6, dado() * 6];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      dentro.set(THREE.MathUtils.clamp(v.x, -m, m), THREE.MathUtils.clamp(v.y, -m, m), THREE.MathUtils.clamp(v.z, -m, m));
      v.sub(dentro).normalize();   // la direzione dal cubo interno: lì sopra si arrotonda
      const onda = 1 + onde * (Math.sin(v.x * 5 + dentro.y * 9 + fase[0]) + Math.sin(v.y * 4 + dentro.z * 8 + fase[1]) + Math.sin(v.z * 6 + dentro.x * 7 + fase[2])) / 3;
      v.multiplyScalar((smusso / 2) * onda).add(dentro.multiplyScalar(onda));
      pos.setXYZ(i, v.x * lato, v.y * lato, v.z * lato);
    }
    g.computeVertexNormals();
    // le facce del cubo sono pezzi separati: sugli spigoli i punti doppi si scambiano la normale, così non si vede la cucitura
    const nor = g.attributes.normal, somme = new Map(), chiave = (i) => `${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}`;
    for (let i = 0; i < pos.count; i++) { const k = chiave(i), n = somme.get(k) || new THREE.Vector3(); n.x += nor.getX(i); n.y += nor.getY(i); n.z += nor.getZ(i); somme.set(k, n); }
    for (let i = 0; i < pos.count; i++) { const n = somme.get(chiave(i)).clone().normalize(); nor.setXYZ(i, n.x, n.y, n.z); }
    return g;
  }

  function costruisci() {
    const stanza = stanzaDiLuci(motore);
    calice.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sole = new THREE.DirectionalLight(0xffffff, 1.4); sole.position.set(-3, 5, 6); calice.add(sole);

    // il vetro sotto le pietre: rosso dove dietro c'è lo spritz, chiaro altrove
    const nelloSpritz = (riga) => riga >= RIGA_SPRITZ && riga <= RIGA_FONDO + 30;
    const vetro = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.35, envMap: stanza, envMapIntensity: 0.8, side: THREE.DoubleSide });
    calice.add(new THREE.Mesh(tornio(punti, (q) => (nelloSpritz(q[2]) ? 0x8e0d14 : q[2] < RIGA_SPRITZ ? 0xd9c9c8 : 0xc9c4c4)), vetro));
    // la parete di dentro della coppa, un filo più stretta: si vede dall'alto, sopra lo spritz
    const dentro = punti.filter((q) => q[2] <= RIGA_FONDO).map((q) => [Math.max(0.001, q[0] - 0.035), q[1], q[2]]);
    dentro.push([0.001, Y(RIGA_FONDO + 10), RIGA_FONDO + 10]);
    calice.add(new THREE.Mesh(tornio(dentro, () => 0xe6d6d4), vetro));

    // lo spritz: il suo tornio dentro la coppa e la superficie in alto
    const spritz = new THREE.MeshStandardMaterial({ color: 0xd0141f, emissive: 0x5a0408, roughness: 0.12, metalness: 0.1, envMap: stanza, envMapIntensity: 1.2 });
    const liquido = dentro.filter((q) => q[2] >= RIGA_SPRITZ).map((q) => [Math.max(0.001, q[0] - 0.01), q[1], q[2]]);
    const rSpritz = liquido[0][0];
    calice.add(new THREE.Mesh(tornio(liquido, () => 0xd0141f), spritz));
    const superficie = new THREE.CircleGeometry(rSpritz, 64); superficie.rotateX(-Math.PI / 2); superficie.translate(0, Y(RIGA_SPRITZ), 0);
    calice.add(new THREE.Mesh(superficie, spritz));
    // i cubetti di ghiaccio, ammucchiati fino al bordo come nella foto: spigoli smussati, facce un po' mosse, il cuore torbido
    const ghiaccio = new THREE.MeshPhysicalMaterial({ color: 0xffe4df, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.55, envMap: stanza, envMapIntensity: 1.6 });
    const torbido = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.45, depthWrite: false });
    const dadoGhiaccio = casuale(7);
    const yS = Y(RIGA_SPRITZ) + 0.08, yB = Y_BORDO + 0.07;   // a galla nello spritz, e in cima che spuntano dal bordo
    [[-0.3, yS, 0.14, 0.4, 0.5, 0.25], [0.28, yS, -0.2, 0.38, -0.3, -0.18], [0.12, yB, 0.24, 0.38, 1.1, 0.4], [-0.24, yB - 0.04, -0.2, 0.36, 0.2, -0.3]].forEach(([x, y, z, l, ry, rz]) => {
      const cubo = new THREE.Group();
      cubo.add(new THREE.Mesh(cubettoDiGhiaccio(l, 0.16, 0.035, dadoGhiaccio), ghiaccio));
      cubo.add(new THREE.Mesh(cubettoDiGhiaccio(l * 0.55, 0.45, 0.08, dadoGhiaccio), torbido));   // il cuore bianco, dove l'acqua ha gelato per ultima
      cubo.position.set(x, y, z); cubo.rotation.set(0.3, ry, rz); calice.add(cubo);
    });

    /* ---------- Le pietre ---------- */
    const dado = casuale(2025), voci = [];
    const CHIARA = () => { const v = 0.93 + dado() * 0.06; return [v, v * 0.98, v]; };
    const ROSSA = () => { const k = dado(); return k < 0.15 ? [1, 0.72, 0.66] : [1, 0.3 + dado() * 0.14, 0.2 + dado() * 0.1]; };
    // lungo il profilo, una fila ogni diametro di pietra; ogni fila fa il giro, sfalsata di mezza pietra
    let s = 0, fila = 0;
    const lungo = [0];
    for (let i = 1; i < punti.length; i++) lungo.push(lungo[i - 1] + Math.hypot(punti[i][0] - punti[i - 1][0], punti[i][1] - punti[i - 1][1]));
    const qui = (s) => {   // il punto del profilo alla distanza s, con la sua normale verso fuori
      let i = 1; while (i < lungo.length - 1 && lungo[i] < s) i++;
      const t = (s - lungo[i - 1]) / ((lungo[i] - lungo[i - 1]) || 1), a = punti[i - 1], b = punti[i];
      const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
      return { r: a[0] + dr * t, y: a[1] + dy * t, riga: a[2] + (b[2] - a[2]) * t, nr: -dy / l, ny: dr / l };
    };
    const FINE = lungo[lungo.length - 4];   // fino al bordo del piede
    while (s < FINE) {
      const q = qui(s);
      const rg = Math.min(REGOLA.pietra, Math.max(REGOLA.pietraMin, q.r * 0.3));
      const n = Math.max(6, Math.floor((Math.PI * 2 * q.r) / (rg * 2 * REGOLA.vicinanza)));
      for (let i = 0; i < n; i++) {
        const a = ((i + (fila % 2) * 0.5) / n) * Math.PI * 2;
        voci.push({ p: new THREE.Vector3(q.r * Math.sin(a), q.y, q.r * Math.cos(a)), n: new THREE.Vector3(q.nr * Math.sin(a), q.ny, q.nr * Math.cos(a)), r: rg, colore: nelloSpritz(q.riga) ? ROSSA() : CHIARA() });
      }
      s += rg * 2 * REGOLA.vicinanza * 0.88; fila++;   // le file si incastrano: un po' più vicine del diametro
    }
    // il bordo: un giro sopra e due giri appena dentro
    const giro = (r, y, rg, normale) => { const n = Math.floor((Math.PI * 2 * r) / (rg * 2 * REGOLA.vicinanza)); for (let i = 0; i < n; i++) { const a = ((i + dado() * 0.1) / n) * Math.PI * 2; voci.push({ p: new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a)), n: normale(a), r: rg, colore: CHIARA() }); } };
    giro(R_BORDO - 0.02, Y_BORDO + 0.016, 0.03, () => new THREE.Vector3(0, 1, 0));
    for (const k of [1, 2]) giro(R_BORDO - 0.045 - k * 0.006, Y_BORDO - 0.03 - (k - 1) * 0.075, 0.036, (a) => new THREE.Vector3(-Math.sin(a), 0.15, -Math.cos(a)));

    /* ---------- Lo stecchino e l'oliva ---------- */
    const metallo = new THREE.MeshStandardMaterial({ color: 0xdedcd8, metalness: 1, roughness: 0.2, envMap: stanza, envMapIntensity: 1.2 });
    const verso = new THREE.Vector3(1, 0.62, -0.25).normalize(), centro = new THREE.Vector3(0.05, Y_BORDO + 0.08, 0.05), LUNGO = 2.1;
    const stecco = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, LUNGO, 12), metallo);
    stecco.position.copy(centro).addScaledVector(verso, 0.25); stecco.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), verso); calice.add(stecco);
    const punta = centro.clone().addScaledVector(verso, 0.25 + LUNGO / 2);
    voci.push({ p: punta, n: verso.clone().add(new THREE.Vector3(0, 0, 0.6)), r: 0.09, colore: CHIARA() });   // il cristallo in punta
    // l'oliva: un ovale lungo lo stecchino, tempestato di pietre verdi
    const oliva = centro.clone().addScaledVector(verso, 0.55), assi = new THREE.Vector3(0.36, 0.25, 0.25);
    const giraOliva = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), verso);
    const corpoOliva = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshStandardMaterial({ color: 0x3f4a12, roughness: 0.5 }));
    corpoOliva.scale.copy(assi).multiplyScalar(0.97); corpoOliva.position.copy(oliva); corpoOliva.quaternion.copy(giraOliva); calice.add(corpoOliva);
    const N_OLIVA = 90, oro = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N_OLIVA; i++) {
      const y = 1 - (i / (N_OLIVA - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * oro;
      const u = new THREE.Vector3(y, r * Math.cos(a), r * Math.sin(a));   // sulla sfera, con l'asse lungo su x
      const p = u.clone().multiply(assi).applyQuaternion(giraOliva).add(oliva);
      const n = u.clone().divide(assi).normalize().applyQuaternion(giraOliva);
      const v = 0.75 + dado() * 0.25;
      voci.push({ p, n, r: 0.04, colore: [0.62 * v, 0.68 * v, 0.16 * v] });
    }

    calice.add(pietre(voci, materialeGemma(), geometriaPietra({ alta: 1.1, semplice: true })));
  }

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
    const lato = gradi < 45 || gradi >= 315 ? 'davanti, con l’oliva' : gradi < 135 ? 'il fianco' : gradi < 225 ? 'il retro' : 'l’altro fianco';
    palco.setAttribute('aria-valuenow', String(gradi));
    palco.setAttribute('aria-valuetext', `${gradi} gradi: si vede ${lato}`);
  }

  /* ---------- Il disegno: solo quando il calice si vede ---------- */
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
    calice.rotation.set(stato.inclina, stato.angolo, 0);
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

  // le pietre sono migliaia, quindi il calice si costruisce solo la prima volta che si vede.
  // Quando è pronto, il calice 3D prende il posto della foto.
  function chiediCalice() {
    if (chiesta) return;
    chiesta = true;
    costruisci();
    pronta = true;
    figura.classList.add('e-3d');
    if (visibile && misura()) { disegna(performance.now()); sveglia(); }
  }

  new IntersectionObserver(([voce]) => {
    visibile = voce.isIntersecting;
    if (visibile) chiediCalice();
    if (visibile && pronta && misura()) { disegna(performance.now()); sveglia(); }
  }, { rootMargin: '200px' }).observe(figura);
  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => { if (visibile && pronta && misura()) disegna(performance.now()); }, 150);
  });
  aggiornaValore();
}
