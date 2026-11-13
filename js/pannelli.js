/* ==========================================================================
   pannelli.js: la bolla che si apre

   L'apertura è un'animazione di clip-path "inset(... round ...)": un
   rettangolo con gli angoli arrotondati. Se gli angoli sono arrotondati
   quanto il raggio, il rettangolo è un cerchio: la bolla.
   1. si parte dal cerchio della bolla, dov'è in quel momento;
   2. si arriva ai quattro vertici della pagina (angoli a zero);
   3. si torna un po' indietro, sul pannello con i margini e gli angoli morbidi.
   Intanto il colore della bolla svanisce e compare il contenuto.
   Prima del pop, sullo schermo si forma un disegno di stelle: Saturno per
   Progetti, il Capricorno per Chi sono, la sfera di cristallo per Contatti,
   la falena per Portfolio. La stella del quiz si apre dalla stella cliccata.
   Da un suo punto parte uno scoppio di stelline, e il pannello esce da lì.
   L'indirizzo cambia (#imaze, #contatti…): si può mandare il link a un pannello.
   ========================================================================== */

(function () {
  const pannelli = [...document.querySelectorAll('[data-pannello]')];
  if (!pannelli.length) return;
  const palco = document.querySelector('[data-palco]');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CURVA = 'cubic-bezier(0.76, 0, 0.24, 1)';
  let aperto = null;
  let ultimoAttivatore = null;

  // Il cerchio della bolla, scritto come inset() rispetto allo schermo (da un punto dato, o dalla voce del menu)
  function cerchio(id, punto) {
    const b = punto || (window.palco && window.palco.bolla(id));
    const L = window.innerWidth;
    const A = window.innerHeight;
    if (!b) return `inset(${A / 2}px ${L / 2}px ${A / 2}px ${L / 2}px round 0px)`;
    return `inset(${b.y - b.raggio}px ${L - b.x - b.raggio}px ${A - b.y - b.raggio}px ${b.x - b.raggio}px round ${b.raggio}px)`;
  }
  /* ---------- Prima del pop: un disegno di stelle sullo schermo ----------
     Ogni voce ha il suo, legato a Matilde: Saturno per Progetti, il Capricorno
     (il suo segno, governato da Saturno) per Chi sono, la sfera di cristallo
     per Contatti. Il disegno si forma, poi da un punto parte uno scoppio di
     stelline e il pannello esce proprio da lì. */
  const formeStelle = ['01', '02', '03', '04'].map((n) => `url("${new URL(`assets/img/stelle/singole/essenziale-${n}.svg`, document.baseURI).href}")`);
  const NS = 'http://www.w3.org/2000/svg';

  // lo scoppio: piccole stelline delle costellazioni che volano via da un punto, girano e svaniscono
  function scoppioStelline(x, y) {
    const quante = 18;
    for (let i = 0; i < quante; i++) {
      const s = document.createElement('span');
      s.className = 'stellina';
      s.style.setProperty('--forma', formeStelle[i % formeStelle.length]);
      document.body.append(s);
      const angolo = (i / quante) * Math.PI * 2 + Math.random() * 0.4;
      const distanza = 50 + Math.random() * 90;
      const misura = 0.7 + Math.random() * 0.9, giro = (Math.random() - 0.5) * 220;
      const fx = x - 8 + Math.cos(angolo) * distanza, fy = y - 8 + Math.sin(angolo) * distanza;
      s.animate([
        { transform: `translate(${x - 8}px, ${y - 8}px) scale(0.2) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${fx}px, ${fy}px) scale(${misura}) rotate(${giro}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${fx + Math.cos(angolo) * distanza * 0.25}px, ${fy + Math.sin(angolo) * distanza * 0.25 + 8}px) scale(0) rotate(${giro * 1.4}deg)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 250, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }).onfinish = () => s.remove();
    }
  }
  window.scoppioStelline = scoppioStelline;   // lo usa anche il quiz delle stelle (js/quiz.js)

  // il cielo: un velo sulla scena, un svg per le linee e un posto per le stelle
  function cielo() {
    const L = window.innerWidth, A = window.innerHeight;
    const el = document.createElement('div');
    el.className = 'firmamento';
    el.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${L} ${A}`);
    el.append(svg);
    document.body.append(el);
    // il velo: il disegno si legge anche sopra la stella
    el.animate([{ backgroundColor: 'transparent' }, { backgroundColor: 'var(--velo)' }], { duration: 300, fill: 'forwards' });
    return { el, svg, L, A };
  }
  // un tratto che si disegna (il trattino che scorre: stroke-dashoffset); d è un path svg
  function tratto(svg, d, ritardo, durata = 260, classe = '') {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    if (classe) p.setAttribute('class', classe);
    svg.append(p);
    const lungo = p.getTotalLength();
    p.style.strokeDasharray = lungo;
    p.style.strokeDashoffset = lungo;
    p.animate([{ strokeDashoffset: lungo }, { strokeDashoffset: 0 }], { duration: durata, delay: ritardo, easing: 'ease-out', fill: 'forwards' });
    return p;
  }
  // una stella delle costellazioni che compare con un piccolo salto
  function stella(c, x, y, misura, ritardo, i) {
    const s = document.createElement('span');
    s.className = 'firmamento__stella';
    s.style.setProperty('--forma', formeStelle[i % formeStelle.length]);
    Object.assign(s.style, { left: `${x}px`, top: `${y}px`, width: `${misura}px`, height: `${misura}px` });
    c.el.append(s);
    s.animate([{ transform: 'translate(-50%, -50%) scale(0) rotate(-40deg)' }, { transform: 'translate(-50%, -50%) scale(1.3) rotate(10deg)', offset: 0.6 }, { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)' }],
      { duration: 380, delay: ritardo, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'backwards' });
    return s;
  }
  // la fine, uguale per tutti: dal punto parte lo scoppio, il resto brilla un'ultima volta e svanisce, e il pannello esce da lì
  function finale(c, punto, dopo) {
    return new Promise((fatto) => setTimeout(() => {
      scoppioStelline(punto.x, punto.y);
      c.el.querySelectorAll('.firmamento__stella').forEach((s, i) => {
        s.animate([{ transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(1.9) rotate(45deg)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%, -50%) scale(0) rotate(90deg)', opacity: 0 }],
          { duration: 520, delay: i * 25, easing: 'ease-out', fill: 'forwards' });
      });
      c.svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
      c.el.animate([{ backgroundColor: 'var(--velo)' }, { backgroundColor: 'transparent' }], { duration: 500, fill: 'forwards' });
      setTimeout(() => c.el.remove(), 900);
      setTimeout(() => fatto(punto), 250);
    }, dopo));
  }

  /* Il Capricorno: le stelle principali, dalle coordinate vere del cielo (ascensione retta e
     declinazione, con l'est a sinistra come nelle carte del cielo). δ è Deneb Algedi, la più luminosa */
  const CAPRICORNO = {
    stelle: { a: [22.25, 12.5], b: [21.5, 14.8], th: [10.25, 17.2], io: [6.25, 16.8], g: [1.75, 16.7], d: [0, 16.1], psi: [15.25, 25.3], om: [13.75, 26.9], z: [5, 22.4], e: [2.5, 19.5] },
    ordine: ['a', 'b', 'th', 'psi', 'io', 'om', 'g', 'z', 'e', 'd'],   // l'ordine in cui compaiono: da destra verso Deneb Algedi
    linee: [['a', 'b'], ['b', 'th'], ['th', 'io'], ['io', 'g'], ['g', 'd'], ['b', 'psi'], ['psi', 'om'], ['om', 'z'], ['z', 'e'], ['e', 'd']],
    luminosa: 'd',
  };
  function capricorno() {
    const c = cielo();
    // al centro dello schermo: larga al massimo il 70%, alta al massimo il 60%
    const k = Math.min(c.L * 0.7 / 22.25, c.A * 0.6 / 14.4);
    const ox = (c.L - 22.25 * k) / 2, oy = (c.A - 14.4 * k) / 2 - 12.5 * k;
    const punto = (id) => ({ x: ox + CAPRICORNO.stelle[id][0] * k, y: oy + CAPRICORNO.stelle[id][1] * k });
    CAPRICORNO.linee.forEach(([da, a], i) => { const p = punto(da), q = punto(a); tratto(c.svg, `M${p.x} ${p.y}L${q.x} ${q.y}`, 120 + i * 50); });
    CAPRICORNO.ordine.forEach((id, i) => { const p = punto(id); stella(c, p.x, p.y, id === CAPRICORNO.luminosa ? 44 : 26, i * 55, i); });
    const p = punto(CAPRICORNO.luminosa);
    return finale(c, { x: p.x, y: p.y, raggio: 15 }, 120 + CAPRICORNO.linee.length * 50 + 260);
  }

  /* Saturno: il pianeta che governa il Capricorno. Prima la metà dietro dell'anello, poi il
     pianeta (che la copre), poi la metà davanti; intorno compaiono le lune, Titano più grande */
  function saturno() {
    const c = cielo();
    const cx = c.L / 2, cy = c.A / 2, R = Math.min(c.L, c.A) * 0.13;
    const rx = R * 2.3, ry = R * 0.62, incl = -16;   // l'anello: un'ellisse inclinata
    const anello = (sopra) => `M${cx - rx} ${cy}A${rx} ${ry} 0 0 ${sopra ? 1 : 0} ${cx + rx} ${cy}`;
    const gruppo = document.createElementNS(NS, 'g');
    gruppo.setAttribute('transform', `rotate(${incl} ${cx} ${cy})`);
    c.svg.append(gruppo);
    tratto(gruppo, anello(true), 0, 450);                                    // la metà dietro
    tratto(gruppo, `M${cx} ${cy - R}A${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}`, 150, 550, 'pieno');   // il pianeta
    tratto(gruppo, `M${cx - R * 0.92} ${cy - R * 0.32}Q${cx} ${cy - R * 0.18} ${cx + R * 0.92} ${cy - R * 0.32}`, 500, 300);   // una banda
    tratto(gruppo, anello(false), 400, 450);                                 // la metà davanti, sopra il pianeta
    tratto(gruppo, `M${cx - rx * 0.8} ${cy}A${rx * 0.8} ${ry * 0.8} 0 0 0 ${cx + rx * 0.8} ${cy}`, 550, 400);   // la divisione di Cassini
    // le lune, su un'orbita più larga (la stessa inclinazione)
    const lune = [[200, 1.25, 30], [-20, 1.45, 18], [80, 1.6, 16], [140, 1.35, 14], [310, 1.55, 16]];
    const giro = (incl * Math.PI) / 180;
    lune.forEach(([a, d, misura], i) => {
      const t = (a * Math.PI) / 180, x = Math.cos(t) * rx * d, y = Math.sin(t) * ry * d * 1.6;
      stella(c, cx + x * Math.cos(giro) - y * Math.sin(giro), cy + x * Math.sin(giro) + y * Math.cos(giro), misura, 600 + i * 70, i);
    });
    return finale(c, { x: cx, y: cy, raggio: R }, 1100);
  }

  /* La sfera di cristallo: si disegna tratto dopo tratto con lo stesso tratto di Saturno e del
     Capricorno. Prima la sfera, poi il riflesso della luce, la nebbia che gira dentro, il piccolo
     cielo di stelline e la falce di luna, infine qualche scintilla intorno. Dal centro della sfera
     parte lo scoppio. Le misure sono in un riquadro 100 × 100, poi scalate allo schermo. */
  // una stellina a quattro punte, larga 2·s
  const scintilla = (x, y, s) => `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;
  // una falce di luna di raggio r, aperta verso destra (verso = 1) o sinistra (verso = −1)
  const falce = (x, y, r, verso) => `M${x} ${y - r}A${r} ${r} 0 1 ${verso > 0 ? 0 : 1} ${x} ${y + r}A${r * 0.72} ${r * 0.9} 0 1 ${verso > 0 ? 1 : 0} ${x} ${y - r}Z`;
  const SFERA = {
    centro: { x: 50, y: 43, r: 31 },
    riflesso: ['M25 36A26 26 0 0 1 41 18', 'M27.6 42A23 23 0 0 1 28.4 38.4', 'M66 64A24 24 0 0 0 72 56'],   // la luce sul vetro: in alto a sinistra, e un filo in basso a destra
    nebbia: ['M26 50Q38 38 50 48Q62 58 74 44', 'M30 59Q44 52 56 60Q65 66 71 57', 'M36 40Q46 34 54 39'],   // la nebbia che gira dentro
    // dentro la sfera un piccolo cielo: stelline, una falce di luna, puntini di luce
    stelle: [scintilla(43, 27, 3), scintilla(62, 31, 2), scintilla(36, 51, 1.6), scintilla(57, 56, 2.2), scintilla(68, 44, 1.2),
      scintilla(48, 40, 1), falce(58, 22, 2.4, -1), ...[[33, 31.5], [54, 47], [66, 37], [44, 62], [29, 46]].map(([px, py]) => `M${px} ${py - 0.5}A0.5 0.5 0 1 1 ${px - 0.01} ${py - 0.5}`)],
    intorno: [scintilla(13, 18, 3), scintilla(87, 24, 2.4), scintilla(89, 62, 2), scintilla(11, 58, 1.8), scintilla(80, 8, 1.4)],
  };
  function sfera() {
    const c = cielo();
    // al centro dello schermo: alta al massimo il 62%, larga al massimo il 70%
    const k = Math.min(c.A * 0.62 / 100, c.L * 0.7 / 100);
    const ox = (c.L - 100 * k) / 2, oy = c.A / 2 - SFERA.centro.y * k;   // il centro della sfera al centro dello schermo
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${ox} ${oy}) scale(${k})`);
    g.setAttribute('class', 'scalato');
    g.style.setProperty('--k', k);
    c.svg.append(g);
    const disegna = (lista, inizio, passo, durata, classe) => lista.forEach((d, i) => tratto(g, d, inizio + i * passo, durata, classe));
    const { x, y, r } = SFERA.centro;
    tratto(g, `M${x} ${y - r}A${r} ${r} 0 1 1 ${x - 0.01} ${y - r}`, 0, 550);
    disegna(SFERA.riflesso, 350, 80, 260, 'sottile');
    disegna(SFERA.nebbia, 450, 110, 380, 'sottile');
    disegna(SFERA.stelle, 700, 60, 160, 'sottile');
    disegna(SFERA.intorno, 800, 50, 160, 'sottile');
    const centro = { x: ox + x * k, y: oy + y * k };
    [[-6, 10, 20], [104, 40, 16], [100, 92, 22]].forEach(([cx, cy, m], i) => stella(c, ox + cx * k, oy + cy * k, m, 700 + i * 80, i));
    return finale(c, { x: centro.x, y: centro.y, raggio: r * k }, 1200);
  }

  /* La falena luna, come il tatuaggio di Matilde: vista di fronte, simmetrica. Il corpo pieno a goccia,
     le antenne arricciate, le ali davanti con il bordo spesso, quelle dietro con l'orlo mosso che
     finiscono in due code lunghe e ondulate, una falce di luna in ogni ala, le venature a raggiera,
     e sopra l'arco di puntini. Si disegna solo la metà sinistra (misure prese dalla foto) e la
     destra è la stessa, specchiata sull'asse del corpo. Dal corpo parte lo scoppio. */
  // una falce di luna di raggio r, aperta verso l'angolo a (in gradi, 0 = verso destra, 90 = verso il basso)
  function falceVerso(x, y, r, a) {
    const p = (g, rr = r) => `${(x + Math.cos((g * Math.PI) / 180) * rr).toFixed(2)} ${(y + Math.sin((g * Math.PI) / 180) * rr).toFixed(2)}`;
    return `M${p(a + 68)}A${r} ${r} 0 1 1 ${p(a - 68)}A${(r * 0.8).toFixed(2)} ${(r * 0.8).toFixed(2)} 0 1 0 ${p(a + 68)}Z`;
  }
  const FALENA = {
    asse: 375,                         // l'asse del corpo: la metà destra è la sinistra specchiata qui
    riquadro: { x: -80, y: 0, L: 940, A: 900 },
    centro: { x: 375, y: 290 },        // il corpo: da qui parte lo scoppio
    // il corpo e la testa (non si specchiano: stanno sull'asse)
    corpo: ['M375 222C397 222 406 240 404 262C401 300 388 335 375 364C362 335 349 300 346 262C344 240 353 222 375 222Z',
      'M384 213A9 9 0 1 1 366 213A9 9 0 1 1 384 213Z'],
    // metà sinistra: i bordi spessi (l'ala davanti, l'orlo mosso dell'ala dietro, la coda)
    bordi: ['M343 232C300 205 230 180 150 172C95 168 45 178 38 205C32 235 70 290 110 330C125 345 160 350 200 346',
      'M140 348C118 378 122 418 158 444C175 457 195 452 212 468C230 484 256 478 272 500C290 522 306 548 318 578',
      'M318 578C332 622 300 662 305 702C310 752 342 782 332 832C327 860 334 878 340 892'],
    // l'antenna, con il ricciolo in cima
    antenna: ['M364 222C345 200 318 180 306 160C300 150 299 143 305 140'],
    // le linee sottili: il secondo bordo, le venature, le falci, l'interno della coda
    dettagli: ['M70 208C72 238 100 282 132 314', 'M110 190C180 188 260 200 330 236', 'M200 346C262 340 318 320 346 294',
      'M342 262Q200 228 62 212', 'M342 266Q200 250 72 252', 'M342 272Q220 280 100 294', 'M344 280Q250 310 152 332', 'M346 288Q290 320 234 340',
      'M118 186C112 240 130 290 168 334', 'M218 192C214 248 232 300 272 336',
      'M356 360C352 450 346 520 346 590C346 640 326 680 331 722C336 772 356 802 346 852C343 872 341 884 340 892',
      'M335 600C330 640 315 670 318 705C322 745 345 780 338 830',
      'M352 345Q240 360 142 392', 'M352 350Q260 400 172 444', 'M354 356Q290 430 234 478', 'M356 364Q326 450 300 528',
      'M180 360C200 395 228 430 268 456', 'M150 362C140 390 148 418 178 436',
      falceVerso(168, 222, 22, -90), falceVerso(258, 408, 24, -50)],
    // l'arco di puntini sopra la falena, come sul tatuaggio (qui non è specchiato: è com'è nella foto)
    // (x, y e grandezza di ogni puntino sono presi dalla foto intera)
    puntini: [[1006, 252, 16], [984, 260, 35], [305, 267, 29], [980, 267, 10], [325, 273, 63], [376, 277, 22], [327, 282, 16], [363, 283, 55], [891, 286, 41], [823, 289, 33], [477, 292, 38], [932, 293, 35], [411, 295, 55], [884, 294, 30], [836, 296, 49], [464, 303, 70], [418, 304, 26], [772, 306, 50], [372, 307, 63], [522, 311, 69], [763, 316, 26], [707, 320, 24], [821, 320, 47], [719, 321, 52], [531, 322, 17], [903, 322, 22], [571, 326, 77], [584, 324, 21], [474, 332, 56], [397, 340, 54], [675, 341, 75], [612, 345, 67], [642, 368, 76]]
      .sort((p, q) => p[0] - q[0])   // si accendono da sinistra a destra
      .map(([X, Y, area]) => {   // dalle misure della foto intera a quelle del disegno; d è il punto, w la sua grandezza
        const x = +((X - 360) * 1.3235).toFixed(1), y = +((Y - 240) * 1.3235).toFixed(1);
        return { d: `M${x} ${y}L${x + 0.01} ${y}`, w: +(2 * Math.sqrt(area / Math.PI) * 1.3235).toFixed(1) };
      }),
  };
  function falena() {
    const c = cielo();
    const { riquadro: q, asse } = FALENA;
    const k = Math.min(c.A * 0.8 / q.A, c.L * 0.7 / q.L);
    const ox = c.L / 2 - (q.x + q.L / 2) * k, oy = c.A / 2 - (q.y + q.A / 2) * k;   // la falena al centro dello schermo
    const gruppo = (trasforma) => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', trasforma);
      g.setAttribute('class', 'scalato');
      g.style.setProperty('--k', k);
      c.svg.append(g);
      return g;
    };
    const sx = gruppo(`translate(${ox} ${oy}) scale(${k})`);
    const dx = gruppo(`translate(${ox + 2 * asse * k} ${oy}) scale(${-k} ${k})`);   // la metà destra, specchiata
    const disegna = (lista, inizio, passo, durata, classe, gruppi = [sx, dx]) =>
      gruppi.forEach((g) => lista.forEach((d, i) => tratto(g, d, inizio + i * passo, durata, classe)));
    disegna(FALENA.corpo, 0, 60, 260, 'pieno-corpo', [sx]);
    disegna(FALENA.antenna, 80, 0, 300, '');
    disegna(FALENA.bordi, 140, 110, 380, 'spesso');
    disegna(FALENA.dettagli, 480, 16, 220, 'sottile');
    // i puntini: ognuno grande com'è nel tatuaggio (lo spessore è nelle misure del disegno, non in pixel)
    FALENA.puntini.forEach(({ d, w }, i) => { tratto(sx, d, 560 + i * 18, 80, 'punto').style.strokeWidth = w; });
    [[-40, 120, 18], [800, 90, 20], [720, 720, 16]].forEach(([cx, cy, m], i) => stella(c, ox + cx * k, oy + cy * k, m, 850 + i * 80, i));
    const { x, y } = FALENA.centro;
    return finale(c, { x: ox + x * k, y: oy + y * k, raggio: 30 * k }, 1300);
  }

  /* La stella del quiz: il disegno è la stella stessa, che l'utente ha appena cliccato nel nastro
     (js/quiz.js ha già fatto lo scoppio di stelline e ha lasciato in window.partenzaStella da dove
     partire). Il pannello esce proprio da lì; se si arriva con il link #stella, esce dal centro */
  function stellaScelta() {
    const punto = window.partenzaStella || null;
    window.partenzaStella = null;
    return new Promise((fatto) => setTimeout(() => fatto(punto), punto ? 260 : 0));
  }

  // quale disegno per quale voce (i progetti aperti da un link diretto prendono Saturno)
  const DISEGNI = { 'chi-sono': capricorno, contatti: sfera, progetti: saturno, portfolio: falena, stella: stellaScelta };
  function disegno(id) {
    if (menoMovimento) { window.partenzaStella = null; return Promise.resolve(null); }
    return (DISEGNI[id] || saturno)();
  }

  function margine() {
    return Math.max(10, Math.min(36, window.innerWidth * 0.025));
  }
  // Dove si ferma il ritaglio: quasi tutto lo schermo, oppure, per un pannello piccolo (Portfolio),
  // un riquadro al centro grande quanto il suo contenuto più un po' d'aria. "piu" lo allarga (il rimbalzo)
  function ritaglio(pannello, piu = 0) {
    const m = margine();
    if (!pannello.hasAttribute('data-piccolo')) return `inset(${m}px ${m}px ${m}px ${m}px round 28px)`;
    // il riquadro si costruisce attorno al contenuto, con lo stesso margine su ogni lato:
    // così il testo sta sempre al centro del riquadro, ovunque la griglia lo abbia messo
    const L = window.innerWidth, A = window.innerHeight, dentro = pannello.querySelector('[data-riquadro]').getBoundingClientRect();
    const aria = pannello.id === 'stella' ? 56 : Math.min(72, L * 0.06);   // 56: in alto ci sta giusto Chiudi
    const sopra = Math.max(m, dentro.top - aria) - piu, sotto = Math.max(m, A - dentro.bottom - aria) - piu;
    const sx = Math.max(m, dentro.left - aria) - piu, dx = Math.max(m, L - dentro.right - aria) - piu;
    // il pulsante Chiudi va nell'angolo in alto a destra del riquadro, non dello schermo
    pannello.style.setProperty('--riquadro-sopra', `${sopra + piu}px`);
    pannello.style.setProperty('--riquadro-lato', `${dx + piu}px`);
    return `inset(${sopra}px ${dx}px ${sotto}px ${sx}px round 28px)`;
  }

  function apri(pannello) {
    if (aperto === pannello) return;
    if (aperto) chiudi(aperto, { senzaAnimazione: true });
    aperto = pannello;
    ultimoAttivatore = document.activeElement;
    // apertura diretta: arriva dal pannello Progetti (progetti.js), che fa volare il titolo;
    // niente scoppio né ritaglio, il pannello compare subito sotto il titolo che vola
    const diretta = window.aperturaDiretta === pannello.id;
    window.aperturaDiretta = null;
    // prima si forma il disegno della voce (Saturno, Capricorno o la sfera di cristallo), poi da lì si apre il pannello
    const scoppio = diretta ? Promise.resolve(null) : disegno(pannello.id);
    window.palco && window.palco.ferma();
    scoppio.then((punto) => { if (aperto === pannello) mostra(pannello, diretta, punto); });
  }

  function mostra(pannello, diretta = false, punto = null) {
    pannello.classList.add('e-aperto');
    pannello.setAttribute('role', 'dialog');
    pannello.setAttribute('aria-modal', 'true');
    palco.inert = true;                       // la scena dietro non si può usare
    pannello.scrollTop = 0;

    const finale = ritaglio(pannello);
    const piccolo = pannello.hasAttribute('data-piccolo');

    if (diretta) {
      // il pannello è già lì; il contenuto (tranne il titolo, che sta volando) entra con calma
      pannello.style.clipPath = finale;
      for (const figlio of pannello.querySelectorAll('.scheda, .pannello__immagini, .pannello__dopo, .pannello__frase, .pannello__sotto, .pannello__testo > p, .pannello__chiudi')) {
        figlio.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 0, offset: 0.45 }, { opacity: 1, transform: 'none' }],
          { duration: menoMovimento ? 1 : 1100, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    } else if (menoMovimento) {
      pannello.style.clipPath = finale;
      pannello.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    } else {
      // la forma: bolla → vertici della pagina → pannello
      pannello.animate(
        [
          { clipPath: cerchio(pannello.id, punto) },
          { clipPath: piccolo ? ritaglio(pannello, 18) : 'inset(0px 0px 0px 0px round 0px)', offset: 0.55 },   // il piccolo rimbalza appena oltre la sua misura
          { clipPath: finale },
        ],
        { duration: 1150, easing: CURVA, fill: 'forwards' }
      );
      // il colore della bolla, che poi svanisce lasciando la carta
      pannello.animate(
        [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }],
        { duration: 1150, easing: 'ease-out', fill: 'forwards', pseudoElement: '::before' }
      );
      // il contenuto arriva dopo
      for (const figlio of pannello.children) {
        figlio.animate(
          [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 0, transform: 'translateY(24px)', offset: 0.55 }, { opacity: 1, transform: 'none' }],
          { duration: 1150, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
      }
    }
    pannello.querySelector('h2').focus({ preventScroll: true });
  }

  function chiudi(pannello, { senzaAnimazione = false } = {}) {
    const fine = () => {
      pannello.classList.remove('e-aperto');
      pannello.removeAttribute('role');
      pannello.removeAttribute('aria-modal');
      pannello.getAnimations().forEach((a) => a.cancel());
      pannello.style.clipPath = '';
      palco.inert = false;
      if (window.palco) { window.palco.riparti(); window.palco.riforma(pannello.id); }
      if (ultimoAttivatore && document.contains(ultimoAttivatore)) ultimoAttivatore.focus({ preventScroll: true });
    };
    if (aperto === pannello) aperto = null;
    if (senzaAnimazione || menoMovimento) { fine(); return; }

    // al contrario: il pannello torna nella sua bolla
    const animazione = pannello.animate(
      [
        { clipPath: ritaglio(pannello), opacity: 1 },
        { clipPath: cerchio(pannello.id), opacity: 1 },
      ],
      { duration: 700, easing: CURVA, fill: 'forwards' }
    );
    animazione.onfinish = fine;
  }

  /* ---------- L'indirizzo comanda: #imaze apre Imaze, niente chiude tutto ---------- */
  function seguiIndirizzo() {
    const id = decodeURIComponent(location.hash.slice(1));
    const pannello = pannelli.find((p) => p.id === id);
    if (pannello) apri(pannello);
    else if (aperto) chiudi(aperto);
  }
  window.addEventListener('hashchange', seguiIndirizzo);

  function chiudiEdEsci() {
    // torna all'indirizzo della scena senza aggiungere un passo alla cronologia
    history.replaceState(null, '', location.pathname + location.search);
    seguiIndirizzo();
  }
  pannelli.forEach((p) => p.querySelector('[data-chiudi]').addEventListener('click', chiudiEdEsci));
  // nel pannello Portfolio, scelta la versione il download parte e il pannello si chiude da solo
  document.querySelectorAll('[data-scarica]').forEach((a) => a.addEventListener('click', () => setTimeout(chiudiEdEsci, 400)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aperto) chiudiEdEsci(); });
  // il pannello piccolo resta al centro anche se la finestra cambia misura
  window.addEventListener('resize', () => {
    if (!aperto || !aperto.hasAttribute('data-piccolo')) return;
    aperto.getAnimations().forEach((x) => x.cancel());
    aperto.style.clipPath = ritaglio(aperto);
  });

  // Se si arriva con un link diretto (es. .../#synapses), si apre subito
  if (location.hash) {
    if (document.readyState === 'complete') seguiIndirizzo();
    else window.addEventListener('load', seguiIndirizzo);
  }
})();
