/* ==========================================================================
   bijou.js: la LOGICA del gioco con Bijou (le pose e le zone sono in
   bijou-asset.js, l'aspetto in stella.css)

   Si gioca con quattro strumenti: si trascinano su Bijou (o si toccano e poi
   si tocca lei; con la tastiera si sceglie e si preme Invio).
   - Pat pat (mano aperta) sulla testa: si siede e socchiude gli occhi.
   - Grattini (dita piegate) sotto il mento: alza il musetto, contenta.
   - Pancino (mano per le carezze) sul corpo: si sdraia a pancia in su e
     la si accarezza muovendo il cursore o il dito.
   - Stellina (bacchetta) davanti a lei: si mette in agguato; avvicinando la
     stellina alle zampe la colpisce con la zampetta; al terzo colpo la prende.
   Se nessuno gioca per un po', si acciambella e dorme (non serve per vincere).
   Ogni attività, la prima volta, accende una stellina; con tutte e quattro
   Bijou porta in regalo un bouquet di gigli. Niente tempo e niente penalità.

   Gli stati sono espliciti: idle, patting, chinScratch, bellyRub, stalking,
   pawing, sleeping, reward. Durante un passaggio gli strumenti sono fermi.
   ========================================================================== */

(function () {
  const gioco = document.querySelector('[data-bijou]');
  const CONF = window.BIJOU_ASSET;
  if (!gioco || !CONF) return;
  const $ = (s) => gioco.querySelector(s);
  const scena = $('[data-bijou-scena]'), posaG = $('[data-bijou-pose]');
  const zonaEl = $('[data-bijou-zona]'), manoG = $('[data-bijou-mano]'), giocattoloG = $('[data-bijou-giocattolo]');
  const barra = $('[data-bijou-strumenti]'), stato = $('[data-bijou-stato]');
  const fine = $('[data-bijou-fine]'), ancora = $('[data-bijou-ancora]');
  const bouquetTela = $('[data-bijou-bouquet]'), scarica = $('[data-bijou-scarica]');
  const progressi = $('[data-bijou-progressi]');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- REGOLAZIONI (tempi in millisecondi) ---------- */
  const REGOLA = {
    sonno: 12000,           // dopo quanto tempo senza giocare Bijou si addormenta da sola
    noiaAgguato: 9000,      // se nessuno muove la stellina, si stufa e si rialza
    noiaPancia: 8000,       // ...e se nessuno le accarezza il pancino
    pancia: 650,            // quanta strada (in unità del palco) di carezze serve sul pancino
    colpi: 3,               // quante zampate per prendere la stellina
    trascina: 6,            // di quanti pixel si muove il dito prima che diventi un trascinamento
  };
  const NOMI = { pat: 'Pat pat', mento: 'Grattini', pancia: 'Belly rub', stellina: 'Gioco con la stellina' };
  // lo strumento e la zona in cui si usa (sulla posa base)
  const ZONA_DI = { pat: 'testa', mento: 'mento', pancia: 'pancia', stellina: 'davanti', nanna: 'nanna' };
  // lo stato e la posa che gli corrisponde
  const POSA_DI = { idle: 'base', patting: 'patting', chinScratch: 'chin', bellyRub: 'belly', stalking: 'stalking', pawing: 'pawing', sleeping: 'sleeping', reward: 'reward' };

  /* ---------- 1. Le pose sul palco, tutte precaricate ---------- */
  const pose = {};
  for (const [nome, p] of Object.entries(CONF.pose)) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'bijou__posa');
    g.dataset.posa = nome;
    g.style.opacity = nome === 'sleeping' ? '1' : '0';      // all'apertura dorme
    const dentro = document.createElementNS(NS, 'g');
    dentro.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${p.scala})`);
    const im = document.createElementNS(NS, 'image');
    im.setAttribute('href', p.file);
    im.setAttribute('width', p.larghezza);
    im.setAttribute('height', p.altezza);
    dentro.append(im); g.append(dentro); posaG.append(g);
    pose[nome] = g;
    new Image().src = p.file;               // precaricata: il cambio di posa non lampeggia
  }
  gioco.classList.add('e-pronto');           // da qui il palco SVG sostituisce l'immagine di riserva

  /* ---------- 2. Gli stati e i passaggi tra le pose ----------
     Un passaggio è un piccolo gesto vero: la posa che esce lo comincia
     (si accuccia, si abbassa...) e a metà lascia il posto alla nuova, che lo
     finisce e si assesta. Le due Bijou stanno insieme solo per un attimo.
     Tutto ruota intorno al punto tra le zampe, sul pavimento. */
  const MOSSE = {
    siedi: { durata: 520,      // da in piedi a seduta: si accuccia e si siede
      esce: [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.02, 0.94)', opacity: 1, offset: 0.42 }, { transform: 'scale(1.02, 0.9)', opacity: 0, offset: 0.6 }, { transform: 'scale(1.02, 0.9)', opacity: 0 }],
      entra: [{ transform: 'scale(0.97, 0.92)', opacity: 0 }, { transform: 'scale(0.97, 0.92)', opacity: 0, offset: 0.42 }, { transform: 'scale(1.01, 0.98)', opacity: 1, offset: 0.62 }, { transform: 'scale(0.995, 1.01)', opacity: 1, offset: 0.82 }, { transform: 'none', opacity: 1 }] },
    alzati: { durata: 460,     // da seduta a in piedi: spinge sulle zampe
      esce: [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.02, 0.96)', opacity: 1, offset: 0.36 }, { transform: 'translateY(-8px) scale(0.99, 1.03)', opacity: 0, offset: 0.58 }, { transform: 'translateY(-8px) scale(0.99, 1.03)', opacity: 0 }],
      entra: [{ transform: 'translateY(-6px)', opacity: 0 }, { transform: 'translateY(-6px)', opacity: 0, offset: 0.38 }, { transform: 'scale(1.01, 0.98)', opacity: 1, offset: 0.66 }, { transform: 'none', opacity: 1 }] },
    giu: { durata: 560,        // si abbassa: per sdraiarsi, mettersi in agguato, acciambellarsi
      esce: [{ transform: 'none', opacity: 1 }, { transform: 'translateY(6px) scale(1.01, 0.95)', opacity: 1, offset: 0.42 }, { transform: 'translateY(14px) scale(1.02, 0.9)', opacity: 0, offset: 0.6 }, { transform: 'translateY(14px) scale(1.02, 0.9)', opacity: 0 }],
      entra: [{ transform: 'translateY(-8px)', opacity: 0 }, { transform: 'translateY(-8px)', opacity: 0, offset: 0.42 }, { transform: 'translateY(4px) scale(1.01, 0.98)', opacity: 1, offset: 0.66 }, { transform: 'translateY(-1px)', opacity: 1, offset: 0.84 }, { transform: 'none', opacity: 1 }] },
    su: { durata: 500,         // si rialza da sdraiata, dall'agguato o dal sonno
      esce: [{ transform: 'none', opacity: 1 }, { transform: 'translateY(4px) scale(1.01, 0.97)', opacity: 1, offset: 0.36 }, { transform: 'translateY(-10px)', opacity: 0, offset: 0.58 }, { transform: 'translateY(-10px)', opacity: 0 }],
      entra: [{ transform: 'translateY(10px) scale(1.02, 0.95)', opacity: 0 }, { transform: 'translateY(10px) scale(1.02, 0.95)', opacity: 0, offset: 0.38 }, { transform: 'translateY(-4px) scale(0.99, 1.02)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }] },
    rapido: { durata: 280,     // la zampata: veloce, come un gatto vero
      esce: [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }],
      entra: [{ transform: 'translateY(4px)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 0, offset: 0.4 }, { transform: 'translateY(-3px)', opacity: 1, offset: 0.62 }, { transform: 'none', opacity: 1 }] },
    regalo: { durata: 900,     // arriva spingendo il bouquet con il musetto
      esce: [{ opacity: 1 }, { opacity: 0, offset: 0.35 }, { opacity: 0 }],
      entra: [{ transform: 'translateX(-70px)', opacity: 0 }, { transform: 'translateX(-50px)', opacity: 1, offset: 0.35 }, { transform: 'translateX(6px)', opacity: 1, offset: 0.8 }, { transform: 'none', opacity: 1 }] },
  };

  let statoGioco = 'sleeping';  // all'apertura Bijou dorme: il gioco parte quando la si sveglia
  let occupato = false;          // durante un passaggio o un gesto: niente attivazioni in più
  const aspetta = (ms) => new Promise((ok) => setTimeout(ok, ms));
  // un'animazione è finita quando finisce davvero, o al più tardi poco dopo la sua durata
  // (se la scheda va in secondo piano il browser la ferma: il gioco non deve bloccarsi)
  const finita = (a, ms) => (a ? Promise.race([a.finished.catch(() => {}), aspetta(ms + 120)]) : Promise.resolve());
  const anima = (el, f, ms, easing = 'ease-in-out') => (menoMovimento ? null : el.animate(f, { duration: ms, easing }));
  const vedi = (nome, si) => { pose[nome].style.opacity = si ? '1' : '0'; };

  async function passa(nuovo, mossa) {
    const da = POSA_DI[statoGioco], a = POSA_DI[nuovo];
    statoGioco = nuovo;
    aggiornaZona();
    if (da === a) return;
    const m = MOSSE[mossa];
    if (!m || menoMovimento) { vedi(da, false); vedi(a, true); return; }
    const e = { duration: m.durata, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' };
    const uno = pose[da].animate(m.esce, e), due = pose[a].animate(m.entra, e);
    vedi(da, false); vedi(a, true);
    await Promise.all([finita(uno, m.durata), finita(due, m.durata)]);
  }

  /* ---------- 3. Le attività e le stelline del progresso ---------- */
  const fatte = new Set();
  function dici(testo) { stato.textContent = testo; }
  function completa(att) {
    if (fatte.has(att)) return;
    fatte.add(att);
    // si accende sempre la prossima stellina spenta: prima, seconda, terza, quarta
    const li = progressi.children[fatte.size - 1];
    li.classList.add('e-accesa');
    li.querySelector('[data-stato-attivita]').textContent = `accesa (${NOMI[att]})`;
    anima(li.querySelector('.bijou__stellina'), [{ transform: 'scale(0.6) rotate(-20deg)' }, { transform: 'scale(1.3) rotate(10deg)' }, { transform: 'none' }], 520, 'cubic-bezier(0.3, 1.4, 0.5, 1)');
    dici(`Stellina accesa: ${NOMI[att]} (${fatte.size} di ${CONF.attivita.length}).`);
  }

  /* ---------- 4. La mano e la stellina sul palco ----------
     Le mani sono le illustrazioni di Matilde (bijou-asset.js, "mani"): lato = larghezza in unità del palco. */
  // specchio: la mano girata (per il pancino arriva da destra, come nell'illustrazione della pancia)
  function mettiMano(id, x, y, lato = 220, giro = 0, specchio = false) {
    const m = CONF.mani[id], alto = (lato * m.altezza) / m.larghezza;
    const gira = specchio ? ` translate(${lato} 0) scale(-1 1)` : '';
    manoG.innerHTML = `<g transform="translate(${x - lato / 2} ${y - alto / 2}) rotate(${giro} ${lato / 2} ${alto / 2})${gira}"><image href="${m.file}" width="${lato}" height="${alto}"/></g>`;
    manoG.style.opacity = '1';
  }
  function togliMano() { manoG.style.opacity = '0'; manoG.innerHTML = ''; }
  // la stellina appesa al filo della bacchetta (la bacchetta esce dal palco in alto)
  let stella = null;
  function mettiStella(x, y) {
    stella = { x, y };
    giocattoloG.innerHTML = `<path d="M${x + 90} 20 Q ${x + 50} ${(y + 20) / 2} ${x} ${y - 34}" fill="none" stroke="#1E1C22" stroke-width="3"/>
      <circle cx="${x}" cy="${y - 30}" r="6" fill="#F2C14E" stroke="#1E1C22" stroke-width="3"/>
      <path d="M${x} ${y - 24} l9 18 20 3 -14.5 14 3.5 20 -18 -9.5 -18 9.5 3.5 -20 -14.5 -14 20 -3 Z" fill="#F2C14E" stroke="#1E1C22" stroke-width="3.5" stroke-linejoin="round"/>`;
    giocattoloG.style.opacity = '1';
  }
  function togliStella() { giocattoloG.style.opacity = '0'; giocattoloG.innerHTML = ''; stella = null; }

  // una stellina delle costellazioni sale da un punto dello schermo
  function stellina(x, y, lontano = 70) {
    if (menoMovimento) return;
    const s = document.createElement('span');
    s.className = 'stellina';
    s.style.setProperty('--forma', `url("assets/img/stelle/singole/essenziale-0${1 + Math.floor(Math.random() * 4)}.svg")`);
    document.body.append(s);
    const a = Math.random() * Math.PI * 2, dx = Math.cos(a) * lontano * 0.6, dy = -Math.abs(Math.sin(a)) * lontano - 20;
    s.animate([
      { transform: `translate(${x - 8}px, ${y - 8}px) scale(0.3)`, opacity: 1 },
      { transform: `translate(${x - 8 + dx}px, ${y - 8 + dy}px) scale(1.1) rotate(${dx}deg)`, opacity: 0 },
    ], { duration: 900, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }).onfinish = () => s.remove();
  }
  // dalle coordinate del palco allo schermo, e viceversa
  function schermo(x, y) { const p = scena.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(scena.getScreenCTM()); return [q.x, q.y]; }
  function palco(cx, cy) { const p = scena.createSVGPoint(); p.x = cx; p.y = cy; const q = p.matrixTransform(scena.getScreenCTM().inverse()); return [q.x, q.y]; }
  const zona = (nome) => (CONF.zone[POSA_DI[statoGioco]] || {})[nome];
  const dentroZona = ([x, y], z) => Boolean(z) && ((x - z[0]) / z[2]) ** 2 + ((y - z[1]) / z[3]) ** 2 <= 1;

  /* ---------- 5. I gesti ---------- */
  // PAT PAT: si siede, la mano batte piano sulla testa, lei socchiude gli occhi
  async function patPat() {
    occupato = true; aggiornaBarra();
    await passa('patting', 'siedi');
    const [mx, my] = CONF.gesti.patMano;
    mettiMano('pat', mx, my, 230);
    for (let i = 0; i < 3; i++) {
      anima(manoG, [{ transform: 'none' }, { transform: 'translateY(16px)' }, { transform: 'none' }], 420);
      anima(pose.patting, [{ transform: 'none' }, { transform: 'scale(1.01, 0.985)' }, { transform: 'none' }], 420);
      await aspetta(menoMovimento ? 250 : 440);
    }
    await aspetta(700);
    if (!menoMovimento) await finita(manoG.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }), 220);
    togliMano(); manoG.getAnimations().forEach((a) => a.cancel());
    await passa('idle', 'alzati');
    completa('pat');
    fineGesto();
  }

  // GRATTINI: la mano è già disegnata nella posa, quindi lo strumento torna nella barra.
  // Bijou alza il musetto e si dondola appena, poi torna in piedi
  async function grattini() {
    occupato = true; aggiornaBarra();
    await passa('chinScratch', 'siedi');
    for (let i = 0; i < 2; i++) {
      await finita(anima(pose.chin, [{ transform: 'none' }, { transform: 'rotate(-1.4deg)' }, { transform: 'rotate(1deg)' }, { transform: 'none' }], 700), 700);
    }
    await aspetta(600);
    await passa('idle', 'alzati');
    completa('mento');
    fineGesto();
  }

  // BELLY RUB: si abbassa e si sdraia; ora si accarezza il pancino con il cursore o il dito
  let strada = 0, ultimoPunto = null, noia = null, ultimoDondolo = 0;
  async function pancino(automatico) {
    occupato = true; aggiornaBarra();
    await passa('bellyRub', 'giu');
    strada = 0; ultimoPunto = null;
    gioco.classList.add('e-accarezza');
    if (automatico) {
      // da tastiera: la mano accarezza da sola, avanti e indietro
      const z = zona('pancia');
      for (let i = 0; i < 4; i++) {
        mettiMano('pancia', z[0] + 100 + (i % 2 ? 40 : -40), z[1] - 10, 240, 0, true);
        dondola();
        await aspetta(menoMovimento ? 300 : 520);
      }
      return finePancino(true);
    }
    occupato = false;           // ora si può accarezzare
    dici('Accarezzale il pancino: muovi il cursore o il dito sulla pancia.');
    clearTimeout(noia);
    noia = setTimeout(() => finePancino(false), REGOLA.noiaPancia);
  }
  function dondola() {
    const adesso = performance.now();
    if (adesso - ultimoDondolo < 480) return;
    ultimoDondolo = adesso;
    anima(pose.belly, [{ transform: 'none' }, { transform: 'rotate(-1.4deg) scale(1.01, 0.99)' }, { transform: 'rotate(1deg)' }, { transform: 'none' }], 520);
  }
  function accarezza(p, cx, cy) {
    const z = zona('pancia');
    if (!dentroZona(p, z)) { manoG.style.opacity = '0'; ultimoPunto = null; return; }
    mettiMano('pancia', p[0] + 100, p[1] - 10, 240, 0, true);     // arriva da destra, le dita sotto il cursore
    if (ultimoPunto) {
      const passo = Math.hypot(p[0] - ultimoPunto[0], p[1] - ultimoPunto[1]);
      if (passo < 120) {
        strada += passo;
        dondola();
        if (Math.random() < passo / 140) stellina(cx, cy);
        clearTimeout(noia);
        noia = setTimeout(() => finePancino(false), REGOLA.noiaPancia);
      }
    }
    ultimoPunto = p;
    if (strada >= REGOLA.pancia) finePancino(true);
  }
  async function finePancino(fatto) {
    if (statoGioco !== 'bellyRub') return;
    clearTimeout(noia);
    statoGioco = 'bellyRub';
    occupato = true; aggiornaBarra();
    gioco.classList.remove('e-accarezza');
    togliMano();
    await passa('idle', 'su');
    if (fatto) completa('pancia'); else dici('Bijou si è stufata e si è rialzata.');
    fineGesto();
  }

  // GIOCO CON LA STELLINA: agguato; la stellina vicino alle zampe → zampata; al terzo colpo la prende
  let colpi = 0, fuoriZona = true, ultimaZampata = 0;
  async function stellinaGioco(x, y, automatico) {
    occupato = true; aggiornaBarra();
    colpi = 0; fuoriZona = true;
    await passa('stalking', 'giu');
    const [sx, sy] = x == null ? CONF.gesti.stellaAgguato : [x, y];
    mettiStella(sx, sy);
    gioco.classList.add('e-gioca');
    if (automatico) {
      // da tastiera: la stellina si avvicina da sola, fino alla presa
      const z = CONF.zone.stalking.zampe;
      occupato = false;
      while (statoGioco === 'stalking' && colpi < REGOLA.colpi) {
        await aspetta(menoMovimento ? 200 : 450);
        mettiStella(...CONF.gesti.stellaAgguato);
        fuoriZona = true;
        await aspetta(menoMovimento ? 100 : 300);
        await muoviStella(z[0] + 10, z[1] - 10);
      }
      return;
    }
    occupato = false;
    dici('Muovi la stellina vicino alle zampe di Bijou.');
    clearTimeout(noia);
    noia = setTimeout(fineStellina, REGOLA.noiaAgguato);
  }
  async function muoviStella(x, y) {
    if (statoGioco !== 'stalking' || occupato) return;    // durante la zampata la stellina è sua
    mettiStella(x, y);
    const vicino = dentroZona([x, y], CONF.zone.stalking.zampe);
    // una zampata solo se la stellina era uscita dalla zona: un movimento solo = un colpo solo
    if (!vicino) { fuoriZona = true; return; }
    if (!fuoriZona || performance.now() - ultimaZampata < 700) return;
    fuoriZona = false; ultimaZampata = performance.now();
    clearTimeout(noia);
    await zampata();
  }
  async function zampata() {
    occupato = true;
    colpi++;
    await passa('pawing', 'rapido');
    const [zx, zy] = CONF.gesti.stellaZampa;
    mettiStella(zx, zy);
    anima(giocattoloG, [{ transform: 'none' }, { transform: 'translate(10px, -8px) rotate(6deg)' }, { transform: 'translate(-4px, 3px)' }, { transform: 'none' }], 420);
    const [cx, cy] = schermo(zx, zy);
    stellina(cx, cy, 50);
    if (colpi >= REGOLA.colpi) {
      // presa! la stellina resta un attimo tra le zampe, poi Bijou si rialza soddisfatta
      dici('Presa!');
      await aspetta(700);
      if (!menoMovimento) await finita(giocattoloG.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(30px) scale(0.6)' }], { duration: 300, fill: 'forwards' }), 300);
      togliStella(); giocattoloG.getAnimations().forEach((a) => a.cancel());
      gioco.classList.remove('e-gioca');
      await passa('idle', 'alzati');
      completa('stellina');
      fineGesto();
      return;
    }
    dici(`Zampata! (${colpi} di ${REGOLA.colpi})`);
    await aspetta(550);
    await passa('stalking', 'rapido');
    // la stellina scappa un po' indietro: per un'altra zampata bisogna riavvicinarla
    mettiStella(...CONF.gesti.stellaAgguato);
    fuoriZona = true;
    occupato = false;
    clearTimeout(noia);
    noia = setTimeout(fineStellina, REGOLA.noiaAgguato);
  }
  async function fineStellina() {
    if (statoGioco !== 'stalking' || occupato) return;
    occupato = true; aggiornaBarra();
    togliStella(); gioco.classList.remove('e-gioca');
    await passa('idle', 'su');
    dici('Bijou si è stufata di aspettare la stellina.');
    fineGesto();
  }

  // RIPOSO: se nessuno gioca per un po' si acciambella; un tocco o uno strumento la sveglia
  let attesaSonno = null;
  function sveglia() {
    clearTimeout(attesaSonno);
    attesaSonno = setTimeout(dormi, REGOLA.sonno);
  }
  async function dormi(colCuscino) {
    if (statoGioco !== 'idle' || occupato) return sveglia();
    clearTimeout(attesaSonno);
    occupato = true; aggiornaBarra();
    await passa('sleeping', 'giu');
    gioco.classList.add('e-dorme');
    occupato = false; aggiornaBarra();
    dici(colCuscino ? 'Bijou si è acciambellata sul cuscino e fa la nanna. Toccala per svegliarla.' : 'Bijou si è acciambellata e dorme. Toccala o scegli uno strumento per svegliarla.');
  }
  async function svegliati() {
    if (statoGioco !== 'sleeping' || occupato) return;
    occupato = true; aggiornaBarra();
    gioco.classList.remove('e-dorme');
    const primaVolta = gioco.classList.contains('e-in-attesa');
    gioco.classList.remove('e-in-attesa');         // da qui si vedono strumenti e stelline
    await passa('idle', 'su');
    dici(primaVolta ? 'Bijou si è svegliata: trascina uno strumento su di lei per giocare.' : 'Bijou si è svegliata.');
    occupato = false; aggiornaBarra();
    sveglia();
  }

  // alla fine di ogni gesto: controlli di nuovo attivi, e se le stelline sono tutte accese, il regalo
  function fineGesto() {
    occupato = false;
    aggiornaBarra();
    sveglia();
    if (fatte.size === CONF.attivita.length) vittoria();
  }

  /* ---------- 6. La vittoria: il bouquet ---------- */
  async function vittoria() {
    occupato = true; aggiornaBarra();
    clearTimeout(attesaSonno);
    // una piccola festa di stelline intorno a Bijou
    const b = pose.base.getBoundingClientRect();
    for (let i = 0; i < 12; i++) setTimeout(() => stellina(b.left + b.width * (0.2 + Math.random() * 0.6), b.top + b.height * (0.3 + Math.random() * 0.4), 110), i * 70);
    await aspetta(menoMovimento ? 0 : 900);
    // Bijou arriva spingendo il bouquet; poi il bouquet in ASCII fiorisce e si può scaricare
    await passa('reward', 'regalo');
    barra.hidden = true;
    vinto = true;
    fine.hidden = false;
    if (window.fioritura && window.BOUQUET_DATI) bouquet = window.fioritura(bouquetTela, window.BOUQUET_DATI);
    dici('Bijou ti ha portato un regalo.');
    scarica.focus({ preventScroll: true });
  }
  // il download parte solo quando si preme il pulsante, e solo dopo aver vinto
  let vinto = false, bouquet = null;
  scarica.addEventListener('click', () => {
    if (!vinto || !window.paginaBouquet) return;
    const file = new Blob([window.paginaBouquet(window.BOUQUET_DATI)], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = 'bouquet-di-bijou.html';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  ancora.addEventListener('click', async () => {
    vinto = false;
    if (bouquet) { bouquet.ferma(); bouquet = null; }
    fatte.clear();
    progressi.querySelectorAll('li').forEach((li) => { li.classList.remove('e-accesa'); li.querySelector('[data-stato-attivita]').textContent = 'spenta'; });
    fine.hidden = true; barra.hidden = false;
    await passa('idle', 'su');
    occupato = false; aggiornaBarra();
    dici('Si ricomincia: quattro stelline da accendere.');
    barra.querySelector('[data-strumento]').focus();
    sveglia();
  });

  /* ---------- 7. Gli strumenti: trascinare, toccare, tastiera ---------- */
  let scelto = null;            // lo strumento toccato (modalità "tocca e poi tocca Bijou")
  let inMano = null;            // lo strumento che si sta trascinando
  const bottoni = [...barra.querySelectorAll('[data-strumento]')];
  function aggiornaBarra() {
    const fermo = occupato || (statoGioco !== 'idle' && statoGioco !== 'sleeping');
    bottoni.forEach((b) => b.setAttribute('aria-disabled', String(fermo)));
    if (fermo && scelto) scegli(null);
  }
  function scegli(id) {
    scelto = id;
    bottoni.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.strumento === id)));
    aggiornaZona();
  }
  // la zona compatibile con lo strumento in mano si illumina, con discrezione
  function aggiornaZona(sopra = false) {
    const id = inMano || scelto;
    const z = id && statoGioco === 'idle' ? zona(ZONA_DI[id]) : null;
    zonaEl.classList.toggle('e-attiva', Boolean(z));
    zonaEl.classList.toggle('e-sopra', Boolean(z && sopra));
    if (z) { zonaEl.setAttribute('cx', z[0]); zonaEl.setAttribute('cy', z[1]); zonaEl.setAttribute('rx', z[2]); zonaEl.setAttribute('ry', z[3]); }
  }
  // usa uno strumento: punto (in unità del palco) dove è stato lasciato, o niente per la tastiera
  function usa(id, punto) {
    if (statoGioco === 'sleeping') { svegliati(); return false; }
    if (occupato || statoGioco !== 'idle') return false;
    const automatico = !punto;
    if (punto && !dentroZona(punto, zona(ZONA_DI[id]))) return false;
    scegli(null);
    clearTimeout(attesaSonno);
    if (id === 'nanna') dormi(true);
    if (id === 'pat') patPat();
    if (id === 'mento') grattini();
    if (id === 'pancia') pancino(automatico);
    if (id === 'stellina') stellinaGioco(punto ? punto[0] : null, punto ? punto[1] : null, automatico);
    return true;
  }

  // il trascinamento: una copia dello strumento segue il puntatore
  let trascina = null;
  bottoni.forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      trascina = { id: b.dataset.strumento, b, x0: e.clientX, y0: e.clientY, fantasma: null, mosso: false };
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* puntatore già rilasciato: si continua senza */ }
    });
    b.addEventListener('pointermove', (e) => {
      if (!trascina || trascina.b !== b) return;
      if (!trascina.mosso && Math.hypot(e.clientX - trascina.x0, e.clientY - trascina.y0) < REGOLA.trascina) return;
      if (!trascina.mosso) {
        trascina.mosso = true;
        if (statoGioco === 'sleeping') svegliati();             // prendere uno strumento la sveglia
        const f = document.createElement('div');
        f.className = 'bijou__fantasma';
        f.innerHTML = b.querySelector('img, svg').outerHTML;
        document.body.append(f);
        trascina.fantasma = f;
        inMano = trascina.id;
        gioco.classList.add('e-trascina');
      }
      trascina.fantasma.style.transform = `translate(${e.clientX - 55}px, ${e.clientY - 55}px)`;
      aggiornaZona(dentroZona(palco(e.clientX, e.clientY), zona(ZONA_DI[trascina.id])));
    });
    const lascia = (e, annulla) => {
      if (!trascina || trascina.b !== b) return;
      const t = trascina; trascina = null;
      if (!t.mosso) return;                     // era un tocco: ci pensa il "click"
      t.b.dataset.trascinato = '1';
      inMano = null; gioco.classList.remove('e-trascina');
      const preso = !annulla && usa(t.id, palco(e.clientX, e.clientY));
      aggiornaZona();
      if (preso) { t.fantasma.remove(); return; }
      // fuori bersaglio (o Bijou impegnata): lo strumento torna al suo posto, senza penalità
      const r = t.b.getBoundingClientRect();
      const torna = t.fantasma.animate([{ transform: t.fantasma.style.transform }, { transform: `translate(${r.left + r.width / 2 - 55}px, ${r.top - 10}px) scale(0.5)`, opacity: 0.3 }], { duration: menoMovimento ? 1 : 320, easing: 'ease-in', fill: 'forwards' });
      finita(torna, 320).then(() => t.fantasma.remove());
    };
    b.addEventListener('pointerup', (e) => lascia(e, false));
    b.addEventListener('pointercancel', (e) => lascia(e, true));
    b.addEventListener('click', (e) => {
      if (b.dataset.trascinato) { delete b.dataset.trascinato; return; }
      if (statoGioco === 'sleeping') { svegliati(); return; }
      if (b.getAttribute('aria-disabled') === 'true') return;
      // da tastiera (il "click" non ha un puntatore): il gesto parte subito
      if (e.detail === 0) { usa(b.dataset.strumento, null); return; }
      // con il mouse o il dito: lo strumento resta in mano, poi si tocca Bijou
      scegli(scelto === b.dataset.strumento ? null : b.dataset.strumento);
      if (scelto) dici(`${b.querySelector('span').textContent}: ora tocca Bijou nella zona illuminata.`);
    });
  });
  // Esc: annulla il trascinamento o lo strumento scelto
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (trascina && trascina.fantasma) { trascina.fantasma.remove(); trascina = null; inMano = null; gioco.classList.remove('e-trascina'); }
    if (scelto) scegli(null);
  });

  // sul palco: tocco (sveglia, oppure usa lo strumento scelto), carezze, stellina che segue
  scena.addEventListener('pointerdown', (e) => {
    if (statoGioco === 'sleeping') { svegliati(); return; }
    sveglia();
    const p = palco(e.clientX, e.clientY);
    if (scelto) { if (!usa(scelto, p)) dici('Qui non va: prova nella zona illuminata.'); return; }
    if (statoGioco === 'bellyRub') { ultimoPunto = null; accarezza(p, e.clientX, e.clientY); }
    if (statoGioco === 'stalking') muoviStella(...p);
  });
  scena.addEventListener('pointermove', (e) => {
    const p = palco(e.clientX, e.clientY);
    if (statoGioco === 'bellyRub' && !occupato) accarezza(p, e.clientX, e.clientY);
    if (statoGioco === 'stalking' && !occupato && (e.pointerType === 'mouse' || e.buttons)) muoviStella(...p);
  });
  scena.addEventListener('pointerleave', () => { if (statoGioco === 'bellyRub') { manoG.style.opacity = '0'; ultimoPunto = null; } });

  // all'apertura: Bijou dorme e fa compagnia; il gioco aspetta che qualcuno la svegli
  gioco.classList.add('e-dorme', 'e-in-attesa');
  const pulsanteSveglia = $('[data-bijou-sveglia]');
  pulsanteSveglia.addEventListener('click', async () => {
    await svegliati();
    barra.querySelector('[data-strumento]').focus({ preventScroll: true });
  });
  aggiornaBarra();
})();
