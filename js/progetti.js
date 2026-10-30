/* ==========================================================================
   progetti.js: il nome che vola

   Nel pannello "Progetti" ci sono cinque nomi giganti. Cliccandone uno:
   1. facciamo una copia del nome, ferma sopra tutto, esattamente dov'è;
   2. apriamo il progetto in modo "diretto" (pannelli.js non fa lo scoppio);
   3. la copia si rimpicciolisce e vola in alto a sinistra, sul titolo del
      progetto, come la stella che scende in home; arrivata, sparisce e
      resta il titolo vero.
   Il trucco si chiama FLIP: si misura dove parte e dove arriva, e si anima
   solo transform (spostamento e scala), che è leggero per il browser.
   ========================================================================== */

(function () {
  const pannello = document.getElementById('progetti');
  if (!pannello) return;
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  pannello.querySelectorAll('.elenco-progetti__voce').forEach((voce) => {
    voce.addEventListener('click', (e) => {
      const id = voce.getAttribute('href').slice(1);
      const destinazione = document.getElementById(id);
      if (!destinazione || menoMovimento) return;      // senza animazione: il link normale
      e.preventDefault();

      // 1. la copia del nome, nello stesso punto e della stessa misura
      const nome = voce.querySelector('.elenco-progetti__nome');
      const da = nome.getBoundingClientRect();
      const stile = getComputedStyle(nome);
      const copia = document.createElement('span');
      copia.className = 'titolo-in-volo';
      copia.textContent = nome.textContent;
      copia.setAttribute('aria-hidden', 'true');
      Object.assign(copia.style, {
        left: `${da.left}px`, top: `${da.top}px`,
        fontSize: stile.fontSize, lineHeight: stile.lineHeight, color: stile.color,
      });
      document.body.append(copia);

      // 2. il progetto si apre sotto, subito
      window.aperturaDiretta = id;
      location.hash = id;

      // 3. al fotogramma dopo, misuriamo il titolo vero e ci voliamo sopra
      setTimeout(() => {   // un attimo dopo: il pannello nuovo è già disegnato e si può misurare
        const arrivo = destinazione.querySelector('.pannello__nome');
        if (!arrivo) { copia.remove(); return; }
        arrivo.style.visibility = 'hidden';
        const a = arrivo.getBoundingClientRect();
        const scala = parseFloat(getComputedStyle(arrivo).fontSize) / parseFloat(stile.fontSize);
        const volo = copia.animate(
          [
            { transform: 'none', color: stile.color },
            { transform: `translate(${a.left - da.left}px, ${a.top - da.top}px) scale(${scala})`, color: getComputedStyle(arrivo).color },
          ],
          { duration: 900, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', fill: 'forwards' }
        );
        // a fine volo resta il nome vero; il timer è una sicurezza se il browser salta l'evento
        const atterra = () => { arrivo.style.visibility = ''; copia.remove(); };
        volo.onfinish = atterra;
        setTimeout(atterra, 1200);
      }, 40);
    });
  });

  /* ---------- Il ritorno: il titolo si allarga e torna al suo posto nella lista ---------- */
  document.querySelectorAll('.pannello__indietro').forEach((indietro) => {
    indietro.addEventListener('click', (e) => {
      const progetto = indietro.closest('[data-pannello]');
      const titolo = progetto && progetto.querySelector('.pannello__nome');
      const voce = progetto && pannello.querySelector(`.elenco-progetti__voce[href="#${progetto.id}"]`);
      if (!titolo || !voce || menoMovimento) return;      // senza animazione: il link normale
      e.preventDefault();

      // la copia del titolo, dov'è adesso
      const da = titolo.getBoundingClientRect();
      const stile = getComputedStyle(titolo);
      const copia = document.createElement('span');
      copia.className = 'titolo-in-volo';
      copia.textContent = titolo.textContent;
      copia.setAttribute('aria-hidden', 'true');
      Object.assign(copia.style, { left: `${da.left}px`, top: `${da.top}px`, fontSize: stile.fontSize, lineHeight: stile.lineHeight, color: stile.color });
      document.body.append(copia);

      // la lista si apre subito, sotto
      window.aperturaDiretta = 'progetti';
      location.hash = 'progetti';

      setTimeout(() => {   // un attimo dopo: il pannello nuovo è già disegnato e si può misurare
        const arrivo = voce.querySelector('.elenco-progetti__nome');
        arrivo.style.visibility = 'hidden';
        // gli altri nomi entrano piano, mentre il titolo vola al suo posto
        pannello.querySelectorAll('.elenco-progetti__voce').forEach((v, i) => {
          if (v !== voce) v.animate([{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 250 + i * 60, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
        });
        const a = arrivo.getBoundingClientRect();
        const scala = parseFloat(getComputedStyle(arrivo).fontSize) / parseFloat(stile.fontSize);
        const volo = copia.animate(
          [
            { transform: 'none', color: stile.color },
            { transform: `translate(${a.left - da.left}px, ${a.top - da.top}px) scale(${scala})`, color: getComputedStyle(arrivo).color },
          ],
          { duration: 900, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', fill: 'forwards' }
        );
        // a fine volo resta il nome vero; il timer è una sicurezza se il browser salta l'evento
        const atterra = () => { arrivo.style.visibility = ''; copia.remove(); };
        volo.onfinish = atterra;
        setTimeout(atterra, 1200);
      }, 40);
    });
  });
})();
