/* ==========================================================================
   bijou.js: fai le coccole a Bijou, la gatta di Matilde

   1. Accarezzando Bijou (mouse o dito) si riempie la barra delle fusa.
      Bijou si piega un po' verso la mano e si schiaccia appena a ogni
      carezza; dalla mano salgono le stelline delle costellazioni.
      Chi usa la tastiera ha il pulsante "Fai una coccola".
   2. A barra piena Bijou regala un giglio fatto di righe di codice:
      stelo e foglie verdi, petali bianchi, su fondo scuro come un editor.
      Il codice è vero: è questo file. Il giglio si scrive dal basso
      (prima lo stelo, poi sboccia) e si può scaricare come immagine.
   ========================================================================== */

(function () {
  const gioco = document.querySelector('[data-bijou]');
  if (!gioco) return;
  const gatta = gioco.querySelector('[data-bijou-gatta]');
  const foto = gatta.querySelector('img');
  const fusa = gioco.querySelector('[data-bijou-fusa]');
  const barra = gioco.querySelector('[data-bijou-barra]');
  const stato = gioco.querySelector('[data-bijou-stato]');
  const coccola = gioco.querySelector('[data-bijou-coccola]');
  const premio = gioco.querySelector('[data-bijou-premio]');
  const tela = gioco.querySelector('[data-bijou-giglio]');
  const scarica = gioco.querySelector('[data-bijou-scarica]');
  const ancora = gioco.querySelector('[data-bijou-ancora]');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    carezze: 12,          // quante "passate" su tutta la larghezza di Bijou servono per riempire la barra
    perBottone: 10,       // quanto riempie ogni clic su "Fai una coccola" (in percentuale)
    durataGiglio: 2800,   // quanto ci mette il giglio a scriversi (millisecondi)
  };
  // i messaggi mentre la barra si riempie (soglia in percentuale, testo)
  const messaggi = [[25, 'Prrr…'], [55, 'Bijou chiude gli occhi.'], [85, 'Ancora un pochino…']];

  let coccole = 0;        // da 0 a 100
  let detto = 0;          // quanti messaggi sono già stati detti
  let finito = false;
  let ultimo = null;      // l'ultima posizione della mano sopra Bijou
  let strada = 0;         // quanta strada ha fatto la mano dall'ultima reazione

  /* ---------- 1. Le coccole ---------- */
  function aggiungi(quanto) {
    if (finito) return;
    coccole = Math.min(100, coccole + quanto);
    barra.style.width = `${coccole}%`;
    fusa.setAttribute('aria-valuenow', String(Math.round(coccole)));
    while (detto < messaggi.length && coccole >= messaggi[detto][0]) stato.textContent = messaggi[detto++][1];
    if (coccole >= 100) vinci();
  }

  // Bijou reagisce: si schiaccia appena e manda su una stellina dal punto della carezza
  function reagisci(x, y) {
    if (menoMovimento) return;
    foto.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.035, 0.965)' }, { transform: 'scale(1)' }],
      { duration: 320, easing: 'ease-out' }
    );
    const s = document.createElement('span');
    s.className = 'stellina';
    s.style.setProperty('--forma', `url("assets/img/stelle/singole/essenziale-0${1 + Math.floor(Math.random() * 4)}.svg")`);
    document.body.append(s);
    const deriva = (Math.random() - 0.5) * 50;
    s.animate(
      [
        { transform: `translate(${x - 8}px, ${y - 8}px) scale(0.3)`, opacity: 1 },
        { transform: `translate(${x - 8 + deriva}px, ${y - 70}px) scale(1.1) rotate(${deriva}deg)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }
    ).onfinish = () => s.remove();
  }

  // la carezza: conta quanta strada fa la mano (o il dito) sopra Bijou
  gatta.addEventListener('pointermove', (e) => {
    if (finito) return;
    const box = gatta.getBoundingClientRect();
    // Bijou si piega un po' verso la mano
    gatta.style.setProperty('--inclina', `${((e.clientX - box.left) / box.width - 0.5) * 8}deg`);
    if (ultimo) {
      const passo = Math.hypot(e.clientX - ultimo.x, e.clientY - ultimo.y);
      if (passo < 80) {                     // un salto grande è il puntatore che rientra, non una carezza
        aggiungi((passo / (box.width * REGOLA.carezze)) * 100);
        strada += passo;
        if (strada > box.width * 0.22) { strada = 0; reagisci(e.clientX, e.clientY); }
      }
    }
    ultimo = { x: e.clientX, y: e.clientY };
  });
  gatta.addEventListener('pointerleave', () => { ultimo = null; gatta.style.setProperty('--inclina', '0deg'); });

  // per la tastiera (e per chi non può trascinare): una coccola a ogni clic
  coccola.addEventListener('click', () => {
    const box = foto.getBoundingClientRect();
    aggiungi(REGOLA.perBottone);
    reagisci(box.left + box.width * (0.35 + Math.random() * 0.3), box.top + box.height * 0.35);
  });

  /* ---------- 2. Il premio: il giglio di codice ---------- */
  function vinci() {
    finito = true;
    stato.textContent = 'Bijou fa le fusa. Ecco il tuo giglio!';
    gatta.hidden = true; fusa.hidden = true; coccola.hidden = true;
    premio.hidden = false;
    scarica.setAttribute('aria-disabled', 'true');
    leggiCodice().then((testo) => disegnaGiglio(testo));
  }

  ancora.addEventListener('click', () => {
    finito = false; coccole = 0; detto = 0; ultimo = null;
    barra.style.width = '0%';
    fusa.setAttribute('aria-valuenow', '0');
    stato.textContent = '';
    gatta.hidden = false; fusa.hidden = false; coccola.hidden = false;
    premio.hidden = true;
    coccola.focus();
  });

  // il codice con cui è scritto il giglio: questo stesso file, senza spazi
  let codice = null;
  function leggiCodice() {
    if (codice) return Promise.resolve(codice);
    return fetch('js/bijou.js')
      .then((r) => r.text())
      .catch(() => 'function giglio(){return petali.map((p)=>p.sboccia());}')
      .then((t) => (codice = t.replace(/\s+/g, '')));
  }

  /* Il disegno: un foglio 600 × 800 diviso in caselle, come le righe di un editor.
     Per ogni casella si chiede "qui c'è un petalo? una foglia? lo stelo?" e, se sì,
     ci si scrive il carattere successivo del codice, nel colore di quella parte. */
  const L = 600, A = 800, CW = 4.9, CH = 8;   // caselle piccole: il codice diventa la "trama" del fiore
  const colori = {
    fondo: '#201D24',     // quasi nero violaceo della palette
    petalo: [255, 255, 255],
    salvia: [125, 146, 125],
    avorio: [244, 240, 231],
    lilla: '#B9A2D2',
  };
  const gradi = (g) => (g * Math.PI) / 180;
  // larghezza di un petalo (o di una foglia) lungo il suo asse: zero alla base e in punta
  const sagoma = (t, esp) => Math.sin(Math.PI * Math.pow(t, esp));

  // una forma allungata (petalo, foglia, bocciolo): origine, angolo (0 = verso l'alto), lunghezza,
  // larghezza, quanto si piega, dove ha la pancia (esp). Restituisce la "luce" 0..1 o -1 se fuori.
  function forma(px, py, f) {
    const dx = px - f.x, dy = py - f.y;
    const a = gradi(f.angolo);
    const u = dx * Math.sin(a) - dy * Math.cos(a);           // lungo l'asse
    const v = dx * Math.cos(a) + dy * Math.sin(a);           // di lato
    const t = u / f.lungo;
    if (t <= 0.02 || t >= 1) return -1;
    const asse = f.piega * t * t;
    const w = f.largo * sagoma(t, f.esp);
    const dal = Math.abs(v - asse);
    return dal < w ? 1 - dal / w : -1;
  }
  // distanza di un punto da un segmento (per lo stelo e i filamenti)
  function segmento(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const k = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(px - (x1 + vx * k), py - (y1 + vy * k));
  }

  const C = { x: 300, y: 290 };                               // il centro del fiore
  const asseStelo = (y) => 300 + 14 * Math.sin((y - 290) / 120);
  // sei petali: tre davanti (pieni di luce) e tre dietro (un po' più in ombra), le punte piegate
  const petali = [0, 1, 2, 3, 4, 5].map((k) => ({
    x: C.x, y: C.y, angolo: k * 60 + 12, lungo: k % 2 ? 225 : 250, largo: k % 2 ? 34 : 42,
    piega: k % 2 ? 26 : -26, esp: 1.35, dietro: k % 2 === 1,
  }));
  const stami = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = gradi(k * 60 + 42), l = 105 + (k % 3) * 12;
    return { x: C.x + Math.sin(a) * l, y: C.y - Math.cos(a) * l };
  });
  const bocciolo = { x: 392, y: 395, angolo: 28, lungo: 88, largo: 22, piega: 6, esp: 0.6 };
  const attaccoBocciolo = { x: asseStelo(480), y: 480 };
  const foglie = [
    [600, 1, 235, 52, 22], [545, -1, 215, 48, 20], [690, -1, 195, 60, 18], [470, 1, 165, 42, 15], [735, 1, 150, 66, 15],
  ].map(([y, lato, lungo, ang, largo]) => ({ x: asseStelo(y), y, angolo: lato * ang, lungo, largo, piega: lato * 26, esp: 0.8 }));

  // che cosa c'è nella casella (x, y): [tipo, luce, ordine di comparsa]
  function cosaCe(x, y) {
    // davanti a tutto: le antere (lilla) e i filamenti, poi i petali davanti, poi quelli dietro
    for (const s of stami) if (Math.hypot(x - s.x, (y - s.y) * 1.5) < 11) return ['antera', 1, 0.9];
    for (const s of stami) if (segmento(x, y, C.x, C.y, s.x, s.y) < 2) return ['filamento', 0.85, 0.85];
    // il cuore del fiore, dove i petali si attaccano
    if (Math.hypot(x - C.x, y - C.y) < 16) return ['verde', 0.9, 0.5];
    const dist = Math.hypot(x - C.x, y - C.y) / 260;
    for (const avanti of [true, false]) {
      for (const p of petali) {
        if (p.dietro === avanti) continue;
        const luce = forma(x, y, p);
        if (luce >= 0) {
          // le macchioline tipiche del giglio, vicino alla base dei petali
          const t = Math.hypot(x - C.x, y - C.y) / p.lungo;
          const caso = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
          if (t > 0.15 && t < 0.42 && caso < 0.07) return ['macchia', 1, 0.5 + dist * 0.45];
          return ['petalo', (0.45 + 0.55 * luce) * (p.dietro ? 0.72 : 1), 0.5 + dist * 0.45];
        }
      }
    }
    const lb = forma(x, y, bocciolo);
    if (lb >= 0) return ['petalo', 0.4 + 0.5 * lb, 0.48];
    // il verde: stelo, rametto del bocciolo, foglie. Compare dal basso verso l'alto
    const sale = 0.45 * (1 - (y - 280) / (A - 280));
    if (y > C.y && Math.abs(x - asseStelo(y)) < 5) return ['verde', 0.85, sale];
    if (segmento(x, y, attaccoBocciolo.x, attaccoBocciolo.y, bocciolo.x, bocciolo.y) < 3) return ['verde', 0.75, sale];
    for (const f of foglie) {
      const luce = forma(x, y, f);
      if (luce >= 0) return ['verde', 0.4 + 0.6 * luce, sale];
    }
    return null;
  }

  function coloreDi(tipo, luce) {
    if (tipo === 'antera' || tipo === 'macchia') return colori.lilla;
    if (tipo === 'verde') {
      // il salvia della palette, più acceso lungo la nervatura (resta verde: si schiarisce senza ingrigire)
      const c = colori.salvia.map((v) => Math.min(255, Math.round(v * (0.85 + 0.4 * luce))));
      return `rgb(${c.join(',')})`;
    }
    if (tipo === 'filamento') return `rgba(${colori.avorio.join(',')}, ${luce})`;
    return `rgba(${colori.petalo.join(',')}, ${luce})`;
  }

  function disegnaGiglio(testo) {
    const g = tela.getContext('2d');
    g.setTransform(tela.width / L, 0, 0, tela.height / A, 0, 0);
    g.fillStyle = colori.fondo;
    g.fillRect(0, 0, L, A);
    g.font = '8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    g.textBaseline = 'top';
    // le caselle, riga per riga: ognuna prende il carattere successivo del codice
    const caselle = [];
    let n = 0;
    for (let y = 10; y < A - 50; y += CH) {
      for (let x = 8; x < L - 8; x += CW) {
        const c = cosaCe(x + CW / 2, y + CH / 2);
        if (!c) continue;
        caselle.push({ x, y, car: testo[n++ % testo.length], colore: coloreDi(c[0], c[1]), ordine: c[2] });
      }
    }
    caselle.sort((a, b) => a.ordine - b.ordine);
    const firma = () => {
      g.fillStyle = `rgba(${colori.avorio.join(',')}, 0.7)`;
      g.font = '500 13px Satoshi, "Helvetica Neue", Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText('Un giglio per te, da Bijou e Matilde Canelli', L / 2, A - 32);
      g.textAlign = 'start';
      // pronto: il link scarica l'immagine
      tela.toBlob((blob) => {
        if (scarica.dataset.url) URL.revokeObjectURL(scarica.dataset.url);
        scarica.dataset.url = URL.createObjectURL(blob);
        scarica.href = scarica.dataset.url;
        scarica.removeAttribute('aria-disabled');
      }, 'image/png');
    };
    const scrivi = (da, a) => { for (let i = da; i < a; i++) { const c = caselle[i]; g.fillStyle = c.colore; g.fillText(c.car, c.x, c.y); } };
    if (menoMovimento) { scrivi(0, caselle.length); firma(); return; }
    // si scrive un po' per volta: prima lo stelo dal basso, poi il fiore che si apre
    const inizio = performance.now();
    let fatte = 0;
    (function passo(adesso) {
      // (il tempo del fotogramma può essere un filo prima dell'inizio: lo teniamo tra 0 e 1)
      const k = Math.max(0, Math.min(1, (adesso - inizio) / REGOLA.durataGiglio));
      const fino = Math.floor(caselle.length * k);
      scrivi(fatte, fino);
      fatte = fino;
      if (k < 1) requestAnimationFrame(passo); else firma();
    })(inizio);
  }

  // finché il giglio non è pronto, il link non scarica niente
  scarica.addEventListener('click', (e) => { if (scarica.getAttribute('aria-disabled') === 'true') e.preventDefault(); });
})();

