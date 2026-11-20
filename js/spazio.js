/* ==========================================================================
   spazio.js: le finestrelle non coprono mai il nome e il menu

   Le finestrelle e la striscia sono ancorate in fondo alla scena, il nome e il menu
   in alto. Sugli schermi bassi (iPhone SE, telefono in orizzontale, finestra del
   browser stretta e bassa) quelle in fondo salirebbero sopra le voci del menu.
   Qui si misura: se qualcosa si tocca, la scena si allunga quanto basta (la variabile
   --scena-extra, vedi css/home.css) e la parte in basso si raggiunge scorrendo.
   Sugli schermi normali non cambia niente.
   ========================================================================== */
(() => {
  const radice = document.documentElement;
  const palco = document.querySelector('[data-palco]');
  if (!palco || !radice.classList.contains('js')) return;

  const computer = window.matchMedia('(min-width: 40.01rem) and (min-aspect-ratio: 1/1)');
  const STACCO = 16;   // lo spazio minimo tra il menu (o i link in alto) e la finestra sotto (px); col nome 24 px di aria

  // ancorati in alto, con la parte dell'altezza della scena di cui scendono (chi_sono.txt sta al 13%)
  const inAlto = () => [['.azioni', 0], ['.ruolo', 0], ['.nome', 0], ['.finestra--me', 0.13]]
    .concat(computer.matches ? [] : [['.menu ul', 0]]);
  // ancorati in fondo: scendono con il fondo della scena (sul computer anche il menu, che è una finestra)
  const inFondo = () => ['.finestra--spark', '.finestra--firmamento', '.nastro', '.piede']
    .concat(computer.matches ? ['.menu ul'] : []);

  const scatola = (sel) => {
    const el = palco.querySelector(sel);
    const r = el && el.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    if (sel !== '.nome') return r;
    // il nome: conta dove arrivano le lettere, non la sua scatola (che è più larga della scritta)
    let destra = r.left;
    el.querySelectorAll('.nome__riga').forEach((riga) => {
      const t = document.createRange(); t.selectNodeContents(riga);
      destra = Math.max(destra, t.getBoundingClientRect().right);
    });
    return { left: r.left, right: destra, top: r.top, bottom: r.bottom };
  };

  // l'altezza dello schermo come la usa il CSS (100svh): un elemento invisibile che la misura
  const metro = document.createElement('div');
  metro.setAttribute('aria-hidden', 'true');
  metro.style.cssText = 'position:absolute;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(metro);

  let extra = 0;   // di quanto è allungata la scena adesso
  function controlla() {
    // le distanze dal fondo della scena (per chi sta in basso) e dalla cima (per chi sta in alto)
    // non cambiano allungandola: da quelle si calcola l'altezza che serve
    const p = palco.getBoundingClientRect();
    const H = p.height;
    let serve = 0;
    const su = inAlto().map(([s, quota]) => [scatola(s), quota, s === '.nome' ? 24 : STACCO]).filter(([r]) => r);
    // sul telefono anche la stella di strass, appoggiata sotto il nome (js/stella.js dice dove finisce)
    const st = window.stellaFine;
    if (st && !computer.matches) {
      su.push([{ left: p.left + st.x - st.r, right: p.left + st.x + st.r, top: p.top + st.y - st.r, bottom: p.top + st.y + st.r }, 0, 24]);   // 24: un po' d'aria sotto le punte
    }
    for (const b of inFondo().map(scatola).filter(Boolean)) {
      const dalFondo = p.bottom - b.top;
      for (const [a, quota, stacco] of su) {
        if (b.left >= a.right || b.right <= a.left) continue;   // non stanno una sopra l'altra
        const dallaCima = a.bottom - p.top - quota * H;
        serve = Math.max(serve, (dallaCima + stacco + dalFondo) / (1 - quota));
      }
    }
    const schermo = metro.offsetHeight || window.innerHeight;
    const nuovo = Math.min(Math.max(0, Math.ceil(serve - schermo)), schermo);   // al massimo uno schermo in più
    if (Math.abs(nuovo - extra) < 2) return;
    extra = nuovo;
    radice.style.setProperty('--scena-extra', `${extra}px`);
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    document.dispatchEvent(new CustomEvent('scena-alta'));
  }

  let attesa;
  const presto = () => { clearTimeout(attesa); attesa = setTimeout(controlla, 80); };
  // sul telefono l'altezza cambia di poco mentre la barra di Safari si nasconde: quella non conta
  let larghezza = window.innerWidth, altezza = window.innerHeight;
  window.addEventListener('resize', () => {
    if (window.innerWidth === larghezza && Math.abs(window.innerHeight - altezza) < 120) return;
    larghezza = window.innerWidth; altezza = window.innerHeight;
    presto();
  });
  window.addEventListener('load', presto);
  document.addEventListener('stella-piazzata', presto);
  // ScrollTrigger rifà le misure dopo un resize o una rotazione: si ricontrolla dopo di lui
  if (window.ScrollTrigger) window.ScrollTrigger.addEventListener('refresh', presto);
  if (document.fonts) document.fonts.ready.then(presto);
  presto();
})();
