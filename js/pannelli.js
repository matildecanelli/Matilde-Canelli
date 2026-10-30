/* ==========================================================================
   pannelli.js: la bolla che si apre

   L'apertura è un'animazione di clip-path "inset(... round ...)": un
   rettangolo con gli angoli arrotondati. Se gli angoli sono arrotondati
   quanto il raggio, il rettangolo è un cerchio: la bolla.
   1. si parte dal cerchio della bolla, dov'è in quel momento;
   2. si arriva ai quattro vertici della pagina (angoli a zero);
   3. si torna un po' indietro, sul pannello con i margini e gli angoli morbidi.
   Intanto il colore della bolla svanisce e compare il contenuto.
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

  // Il cerchio della bolla, scritto come inset() rispetto allo schermo
  function cerchio(id) {
    const b = window.palco && window.palco.bolla(id);
    const L = window.innerWidth;
    const A = window.innerHeight;
    if (!b) return `inset(${A / 2}px ${L / 2}px ${A / 2}px ${L / 2}px round 0px)`;
    return `inset(${b.y - b.raggio}px ${L - b.x - b.raggio}px ${A - b.y - b.raggio}px ${b.x - b.raggio}px round ${b.raggio}px)`;
  }
  function margine() {
    return Math.max(10, Math.min(36, window.innerWidth * 0.025));
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
    // prima la bolla scoppia, poi dal punto dello scoppio si apre il pannello
    const scoppio = !diretta && window.palco ? window.palco.scoppia(pannello.id) : Promise.resolve();
    window.palco && window.palco.ferma();
    scoppio.then(() => { if (aperto === pannello) mostra(pannello, diretta); });
  }

  function mostra(pannello, diretta = false) {
    pannello.classList.add('e-aperto');
    pannello.setAttribute('role', 'dialog');
    pannello.setAttribute('aria-modal', 'true');
    palco.inert = true;                       // la scena dietro non si può usare
    pannello.scrollTop = 0;

    const m = margine();
    const finale = `inset(${m}px ${m}px ${m}px ${m}px round 28px)`;

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
          { clipPath: cerchio(pannello.id) },
          { clipPath: 'inset(0px 0px 0px 0px round 0px)', offset: 0.55 },
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
    const m = margine();
    const animazione = pannello.animate(
      [
        { clipPath: `inset(${m}px ${m}px ${m}px ${m}px round 28px)`, opacity: 1 },
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aperto) chiudiEdEsci(); });

  // Se si arriva con un link diretto (es. .../#synapses), si apre subito
  if (location.hash) {
    if (document.readyState === 'complete') seguiIndirizzo();
    else window.addEventListener('load', seguiIndirizzo);
  }
})();
