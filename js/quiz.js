/* ==========================================================================
   quiz.js: "Scegli la tua stella", il firmamento

   Le 12 stelle sono quelle disegnate da Matilde, ognuna da un tratto del suo
   carattere, sparse in un cielo pieno di puntini (stelle lontane).
   - Sul computer il cielo è largo quanto lo schermo e si vedono tutte e 12.
   - Più lo schermo è stretto, meno stelle si vedono (gradualmente, fino a 6 sul
     telefono): il cielo diventa più largo dello schermo e si trascina col pollice
     o col mouse per scoprire le altre.
   - Il firmamento è un foglio che si apre e si chiude solo con la freccia, su ogni schermo.
   Si tocca una stella: si solleva col bagliore, fa lo scoppio
   di stelline e da lì si apre il pannello piccolo #stella con la risposta (i testi
   sono nell'HTML), che porta a un progetto o a una scheda del sito.
   ========================================================================== */

(function () {
  const quiz = document.querySelector('[data-quiz]');
  const cielo = document.querySelector('[data-cielo]');
  if (!quiz || !cielo) return;
  const tela = cielo.querySelector('[data-tela]');
  const mano = document.querySelector('[data-mano]');
  const invito = document.querySelector('[data-invito]');
  const stelle = [...cielo.querySelectorAll('[data-stella]')];
  const risposte = [...document.querySelectorAll('[data-risposta]')];
  const meno = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REGOLAZIONI ---------- */
  const REGOLA = {
    tutte: 1200,     // da questa larghezza di schermo in su si vedono tutte e 12 le stelle
    poche: 380,      // a questa larghezza (il telefono) se ne vedono 6
    minima: 56,      // la stella non è mai più piccola di così (in pixel): a prova di pollice
    massima: 150,    // né più grande di così
    puntini: 160,    // quante stelle lontane nel cielo
  };

  // numeri casuali sempre uguali: il cielo è lo stesso a ogni visita
  let seme = 9;
  const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };

  /* ---------- Le stelle lontane ---------- */
  const puntini = cielo.querySelector('[data-puntini]');
  for (let i = 0; i < REGOLA.puntini; i++) {
    const p = document.createElement('i');
    const d = 1 + caso() * 2.4;
    Object.assign(p.style, { left: `${caso() * 100}%`, top: `${caso() * 100}%`, width: `${d}px`, height: `${d}px`, opacity: (0.2 + caso() * 0.6).toFixed(2) });
    puntini.append(p);
  }

  /* ---------- Dove sta ogni stella ----------
     Le 12 stelle stanno in fila da sinistra a destra, a passo regolare, e salgono e scendono
     tra 3 fasce (in alto, in basso, in mezzo): due stelle vicine non sono mai alla stessa
     altezza, e due alla stessa altezza sono lontane. Le misure assicurano che non si tocchino
     mai: c'è sempre aria intorno. Un po' di disordine (spostamento e inclinazione) fa il firmamento.
     Se lo spazio è basso, le fasce diventano 2. */
  const sposti = stelle.map(() => ({ x: (caso() - 0.5) * 0.24, y: (caso() - 0.5) * 0.16, giro: Math.round((caso() - 0.5) * 30) }));
  stelle.forEach((b, i) => { b.style.rotate = `${sposti[i].giro}deg`; });

  let largo = 0, telaLarga = 0, x = 0;
  function quanteSiVedono(W) {
    const t = Math.min(1, Math.max(0, (W - REGOLA.poche) / (REGOLA.tutte - REGOLA.poche)));
    return 6 + t * 6;   // da 6 a 12, gradualmente
  }
  function disponi() {
    const W = cielo.clientWidth, H = cielo.clientHeight;
    if (!W || !H) return;
    largo = W;
    telaLarga = W * 12 / quanteSiVedono(window.innerWidth);
    tela.style.width = `${telaLarga}px`;
    const passo = telaLarga / 12;
    // 3 fasce se c'è altezza per stelle grandi abbastanza, sennò 2
    const fasce = H / 3.3 >= REGOLA.minima ? 3 : 2;
    const ordine = fasce === 3 ? [0, 2, 1] : [0, 1];
    // la stella: abbastanza piccola da lasciare aria in verticale (tra fasce) e in orizzontale (nella stessa fascia)
    const m = Math.max(REGOLA.minima, Math.min(H / (1 + 1.15 * (fasce - 1)), passo * 1.6, REGOLA.massima));
    cielo.style.setProperty('--m', `${m}px`);
    const salto = (H - m) / (fasce - 1);
    stelle.forEach((b, i) => {
      const s = sposti[i], fascia = ordine[i % fasce];
      const li = b.parentElement;
      // i centri vanno da mezza stella dal bordo sinistro a mezza stella dal destro: nessuna tagliata
      li.style.left = `${((i + 0.5 + s.x) / 12) * (telaLarga - m)}px`;
      li.style.top = `${Math.min(H - m, Math.max(0, fascia * salto + s.y * salto * 0.5))}px`;
    });
    cielo.classList.toggle('si-trascina', telaLarga > W + 1);
    muovi(x);
  }
  function muovi(nuova) {
    x = Math.min(Math.max(0, nuova), Math.max(0, telaLarga - largo));
    tela.style.transform = `translate3d(${-x}px, 0, 0)`;
  }
  new ResizeObserver(disponi).observe(cielo);

  /* ---------- Trascinare il cielo (col pollice o col mouse) ----------
     Il cielo segue la mano e, lasciato, scivola ancora un poco. Se è stato un
     trascinamento, il clic che segue non vale come scelta. */
  let presa = null, spostato = false, spinta = 0, ultimoX = 0, ultimoT = 0;
  cielo.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !cielo.classList.contains('si-trascina')) return;
    presa = { x: e.clientX, y: e.clientY, da: x, id: e.pointerId };
    spostato = false; spinta = 0; ultimoX = e.clientX; ultimoT = performance.now();
  });
  cielo.addEventListener('pointermove', (e) => {
    if (!presa || e.pointerId !== presa.id) return;
    const dx = e.clientX - presa.x;
    if (!spostato && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - presa.y)) {
      spostato = true;
      cielo.setPointerCapture(e.pointerId);
      cielo.classList.add('e-preso');
    }
    if (!spostato) return;
    const t = performance.now();
    spinta = (e.clientX - ultimoX) / Math.max(1, t - ultimoT); ultimoX = e.clientX; ultimoT = t;
    muovi(presa.da - dx);
  });
  const lascia = (e) => {
    if (!presa || (e && e.pointerId !== presa.id)) return;
    presa = null;
    cielo.classList.remove('e-preso');
    if (!spostato) return;
    setTimeout(() => { spostato = false; }, 0);   // il clic che arriva subito dopo non vale
    if (meno) return;
    let v = -spinta * 16;   // pixel per fotogramma
    const scivola = () => { if (Math.abs(v) < 0.3 || presa) return; muovi(x + v); v *= 0.92; requestAnimationFrame(scivola); };
    requestAnimationFrame(scivola);
  };
  cielo.addEventListener('pointerup', lascia);
  cielo.addEventListener('pointercancel', lascia);
  cielo.addEventListener('dragstart', (e) => e.preventDefault());   // niente trascinamento "fantasma" dei disegni
  // con la tastiera: la stella col focus si porta dentro lo schermo
  cielo.addEventListener('focusin', (e) => {
    const li = e.target.closest('li');
    if (li) muovi(li.offsetLeft - (largo - li.offsetWidth) / 2);
    cielo.scrollLeft = 0;   // il browser non deve scorrere il cielo da sé
  });

  /* ---------- La freccia apre e chiude il firmamento (su ogni schermo) ----------
     Il firmamento è un foglio che sale sopra la home e la copre: la pagina sotto resta ferma
     e si esce solo ripremendo la freccia, che intanto sta in fondo girata verso l'alto. */
  const giu = document.querySelector('[data-giu]');
  if (giu) {
    // al passaggio sulla freccia compare la scritta, con uno scoppio di stelline
    giu.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || meno || !window.scoppioStelline) return;
      const b = giu.getBoundingClientRect();
      window.scoppioStelline(b.left + b.width / 2, b.top + b.height / 2);
    });
    // lo stato si ricorda per la scheda del browser: ricaricando, il firmamento resta aperto
    const RICORDA = 'quiz-aperto';
    const giuTesto = giu.querySelector('[data-giu-testo]');
    const ricorda = (si) => { try { si ? sessionStorage.setItem(RICORDA, '1') : sessionStorage.removeItem(RICORDA); } catch (errore) { /* senza memoria, pazienza */ } };
    // la freccia vive nella scena: col foglio aperto passa sopra il foglio, chiuso torna al suo posto
    const casaGiu = giu.parentElement, dopoGiu = giu.nextSibling;
    const giuSopra = (si) => { if (si) document.body.append(giu); else casaGiu.insertBefore(giu, dopoGiu); };
    // sul telefono e sugli schermi in verticale il firmamento è un foglio che sale sopra la home;
    // sul computer è la fascia sotto la home: la pagina ci scende e lì si blocca
    const foglio = window.matchMedia('(max-width: 40rem), (max-aspect-ratio: 1/1)');
    const radice = document.documentElement;
    const dopoLoScorrimento = (fatto) => {
      let una = false;
      const fine = () => { if (una) return; una = true; fatto(); };
      window.addEventListener('scrollend', fine, { once: true });
      setTimeout(fine, 1200);   // se il browser non conosce "scrollend" (o non c'era niente da scorrere)
    };
    function apri(conTastiera, subito) {
      quiz.classList.remove('e-chiude');
      quiz.classList.add('e-aperto');
      giuSopra(true);
      giu.focus({ preventScroll: true });
      quiz.scrollTop = 0;
      giu.setAttribute('aria-expanded', 'true');
      giu.setAttribute('aria-label', 'Chiudi il firmamento');
      if (giuTesto) giuTesto.textContent = 'Chiudi il firmamento';
      ricorda(true);
      disponi();
      const alleStelle = () => { if (conTastiera) stelle[0].focus({ preventScroll: true }); };   // con la tastiera si continua dalle stelle
      if (foglio.matches) {
        radice.classList.add('firmamento-aperto');
        requestAnimationFrame(alleStelle);
        return;
      }
      // la fascia: la pagina si allunga, si scende fin lì e poi lo scorrimento si blocca
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      requestAnimationFrame(() => {
        const blocca = () => { radice.classList.add('firmamento-aperto'); alleStelle(); };
        if (subito || meno) { quiz.scrollIntoView({ block: 'start' }); blocca(); return; }
        quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
        dopoLoScorrimento(blocca);
      });
    }
    function chiudi() {
      giu.setAttribute('aria-expanded', 'false');
      giu.setAttribute('aria-label', 'Apri il firmamento: scegli la tua stella');
      if (giuTesto) giuTesto.textContent = 'Vai al firmamento e scegli la tua stella';
      ricorda(false);
      const rimettiFreccia = () => {
        const aFuoco = document.activeElement === giu;
        giuSopra(false);
        if (aFuoco) giu.focus({ preventScroll: true });
      };
      if (!quiz.classList.contains('e-aperto')) return;
      if (foglio.matches || getComputedStyle(quiz).position === 'fixed') {
        // il foglio scende e sparisce; la home è rimasta dov'era
        const togli = () => { quiz.classList.remove('e-aperto', 'e-chiude'); radice.classList.remove('firmamento-aperto'); rimettiFreccia(); };
        if (meno) { togli(); return; }
        quiz.classList.add('e-chiude');
        quiz.addEventListener('animationend', togli, { once: true });
        setTimeout(() => { if (quiz.classList.contains('e-chiude')) togli(); }, 600);
        return;
      }
      // la fascia: si sblocca, si torna su alla scena finita e solo dopo la fascia sparisce (niente salti)
      radice.classList.remove('firmamento-aperto');
      const st = window.ScrollTrigger && window.ScrollTrigger.getAll()[0];
      const su = st ? st.end : 0;
      const togli = () => { quiz.classList.remove('e-aperto'); rimettiFreccia(); if (window.ScrollTrigger) window.ScrollTrigger.refresh(); };
      if (window.scrollY <= su + 2) { togli(); return; }
      window.scrollTo({ top: su, behavior: meno ? 'auto' : 'smooth' });
      dopoLoScorrimento(togli);
    }
    giu.addEventListener('click', (e) => {
      if (giu.getAttribute('aria-expanded') === 'true') chiudi();
      else apri(e.detail === 0);
    });
    // ricaricando la pagina: se era aperta, resta aperta (e il browser può tornare dov'eri)
    let eraAperto = false;
    try { eraAperto = sessionStorage.getItem(RICORDA) === '1'; } catch (errore) { /* niente */ }
    if (eraAperto) apri(false, true);
  }

  /* ---------- La scelta: la stella si solleva, scoppia e da lì si apre il pannello ---------- */
  function mostra(n) {
    risposte.forEach((r) => { r.hidden = r.dataset.risposta !== String(n); });
  }
  stelle.forEach((b) => b.addEventListener('click', (e) => {
    if (spostato) { e.preventDefault(); return; }
    cielo.classList.add('e-scelto');
    stelle.forEach((s) => s.classList.toggle('scelta', s === b));
    mostra(Number(b.dataset.stella));
    const box = b.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    if (!meno && window.scoppioStelline) window.scoppioStelline(cx, cy);
    window.partenzaStella = { x: cx, y: cy, raggio: box.width / 2 };   // il pannello esce da qui (js/pannelli.js)
    location.hash = 'stella';
  }));
  // chiuso il pannello, le stelle tornano tutte accese
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#stella') { cielo.classList.remove('e-scelto'); stelle.forEach((s) => s.classList.remove('scelta')); }
  });

  // se si arriva con il link #stella senza aver scelto, la stella è a sorpresa
  if (!risposte.some((r) => !r.hidden)) mostra(1 + Math.floor(Math.random() * risposte.length));
})();
