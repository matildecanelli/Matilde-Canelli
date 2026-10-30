/* ==========================================================================
   tema.js: il pulsante che passa dal tema scuro al tema chiaro e ritorno

   Il tema è un attributo sull'html: data-tema="chiaro". Il CSS cambia i
   colori (le variabili di base.css) quando c'è. La scelta si ricorda nel
   browser (localStorage), così tornando sul sito la ritrovi.
   Al clic, dal pulsante parte un piccolo scoppio di stelline.
   ========================================================================== */

(function () {
  const bottone = document.querySelector('[data-tema-bottone]');
  if (!bottone) return;
  const radice = document.documentElement;
  const coloreBarra = document.querySelector('meta[name="theme-color"]');
  const menoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mostra() {
    const chiaro = radice.dataset.tema === 'chiaro';
    // il nome resta "Tema chiaro"; aria-pressed dice ai lettori di schermo se è attivo
    bottone.setAttribute('aria-pressed', String(chiaro));
    if (coloreBarra) coloreBarra.content = getComputedStyle(radice).getPropertyValue('--fondo').trim();
  }

  // Lo scoppio: 9 stelline partono dal centro del pulsante in direzioni diverse,
  // ruotano un po', rimpiccioliscono e svaniscono
  function stelline() {
    if (menoMovimento) return;
    const box = bottone.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const quante = 9;
    for (let i = 0; i < quante; i++) {
      const s = document.createElement('span');
      s.className = 'stellina';
      document.body.append(s);
      const angolo = (i / quante) * Math.PI * 2 + Math.random() * 0.5;
      const distanza = 28 + Math.random() * 26;
      const misura = 0.6 + Math.random() * 0.7;
      const giro = (Math.random() - 0.5) * 180;
      s.animate(
        [
          { transform: `translate(${cx - 7}px, ${cy - 7}px) scale(0.2) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${cx - 7 + Math.cos(angolo) * distanza}px, ${cy - 7 + Math.sin(angolo) * distanza}px) scale(${misura}) rotate(${giro}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${cx - 7 + Math.cos(angolo) * distanza * 1.25}px, ${cy - 7 + Math.sin(angolo) * distanza * 1.25 + 6}px) scale(0) rotate(${giro * 1.4}deg)`, opacity: 0 },
        ],
        { duration: 650 + Math.random() * 200, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }
      ).onfinish = () => s.remove();
    }
  }

  bottone.addEventListener('click', () => {
    const chiaro = radice.dataset.tema !== 'chiaro';
    if (chiaro) radice.dataset.tema = 'chiaro';
    else delete radice.dataset.tema;
    try { localStorage.setItem('tema', chiaro ? 'chiaro' : 'scuro'); } catch (e) { /* in navigazione privata non si salva */ }
    mostra();
    stelline();     // le stelline prendono già il colore del nuovo tema
  });

  mostra();
})();
