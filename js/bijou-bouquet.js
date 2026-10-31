/* ==========================================================================
   bijou-bouquet.js: il bouquet di gigli in ASCII art colorata, il premio
   del gioco con Bijou

   I caratteri e i colori vengono dalla fotografia del bouquet (sono in
   bijou-bouquet-dati.js, generati una volta sola): ogni cella monospace ha
   il suo carattere (dalla luminosità) e il suo colore (quello vero del punto).
   La fioritura, come nel video di riferimento: all'inizio ci sono steli,
   foglie, boccioli e fiorellini; ogni giglio aperto parte come un bocciolo
   chiuso, piccolo e verdino, poi si gonfia e i petali si allargano dal
   centro fino alla forma finale. Uno dopo l'altro; il centro del fiore resta
   fermo. Alla fine il bouquet resta aperto.

   fioritura() è scritta senza dipendere da niente fuori di sé: la stessa
   funzione finisce, copiata, dentro il file HTML che si scarica.
   ========================================================================== */

function fioritura(tela, dati, opzioni) {
  opzioni = opzioni || {};
  const g = tela.getContext('2d');
  const CORPO = 15;                                        // grandezza dei caratteri
  const FONT = CORPO + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';
  g.font = FONT;
  const CW = g.measureText('M').width, CH = CORPO;          // la cella: larga quanto un carattere, alta quanto il corpo
  const L = dati.colonne * CW, A = dati.righe * CH;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  tela.width = Math.round(L * dpr); tela.height = Math.round(A * dpr);
  const FONDO = dati.fondo || '#201D24';
  const meno = opzioni.menoMovimento != null ? opzioni.menoMovimento : window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // le celle: quelle ferme (steli, foglie, boccioli, fiorellini) e quelle dei gigli che si aprono
  const ferme = [], fiori = dati.fiori.map(() => []);
  const n = dati.colonne * dati.righe;
  for (let i = 0; i < n; i++) {
    const car = dati.caratteri[i];
    if (car === ' ') continue;
    const h = dati.colori.substr(i * 3, 3);
    const rgb = [0, 1, 2].map((k) => parseInt(h[k], 16) * 17);
    const c = i % dati.colonne, r = (i / dati.colonne) | 0;
    const quale = parseInt(dati.gruppi[i], 36);
    if (!quale) ferme.push([c, r, car, 'rgb(' + rgb.join(',') + ')']);
    else { const f = dati.fiori[quale - 1]; fiori[quale - 1].push([c - f.c, r - f.r, car, rgb]); }
  }
  // lo strato fermo si disegna una volta sola
  const fermo = document.createElement('canvas');
  fermo.width = tela.width; fermo.height = tela.height;
  const gf = fermo.getContext('2d');
  gf.setTransform(dpr, 0, 0, dpr, 0, 0);
  gf.font = FONT; gf.textBaseline = 'top';
  for (const [c, r, car, col] of ferme) { gf.fillStyle = col; gf.fillText(car, c * CW, r * CH); }

  // il rimbalzo morbido dei petali che si allargano (un po' oltre, poi tornano)
  const allarga = (p) => { const a = 1.25, b = a + 1, q = p - 1; return 1 + b * q * q * q + a * q * q; };
  const dentro = (p) => Math.max(0, Math.min(1, p));
  // il colore del bocciolo: lo stesso del petalo, scurito e tirato verso il verde dei boccioli veri
  const bocciolo = (rgb) => [rgb[0] * 0.42 + 70, rgb[1] * 0.5 + 85, rgb[2] * 0.3 + 40];

  function disegna(t) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = FONDO; g.fillRect(0, 0, L, A);
    g.drawImage(fermo, 0, 0, L, A);
    g.font = FONT; g.textBaseline = 'top';
    dati.fiori.forEach((f, k) => {
      const p = dentro((t - f.inizio) / dati.durata);
      const e = p >= 1 ? 1 : allarga(p);
      // da bocciolo chiuso (stretto e allungato) a fiore aperto
      const sx = 0.16 + 0.84 * e, sy = 0.32 + 0.68 * e;
      const k2 = dentro(p * 1.4);                             // il colore arriva un po' prima della forma
      for (const [dc, dr, car, rgb] of fiori[k]) {
        const x = Math.round(f.c + dc * sx), y = Math.round(f.r + dr * sy);
        const b = bocciolo(rgb);
        g.fillStyle = 'rgb(' + Math.round(b[0] + (rgb[0] - b[0]) * k2) + ',' + Math.round(b[1] + (rgb[1] - b[1]) * k2) + ',' + Math.round(b[2] + (rgb[2] - b[2]) * k2) + ')';
        g.fillText(car, x * CW, y * CH);
      }
    });
  }

  const fineTutto = Math.max(...dati.fiori.map((f) => f.inizio)) + dati.durata;
  let ciclo = null;
  function avvia() {
    if (ciclo) cancelAnimationFrame(ciclo);
    if (meno) { disegna(Infinity); if (opzioni.finito) opzioni.finito(); return; }
    const inizio = performance.now();
    const passo = (adesso) => {
      const t = adesso - inizio;
      disegna(t);
      if (t < fineTutto) ciclo = requestAnimationFrame(passo);
      else { ciclo = null; if (opzioni.finito) opzioni.finito(); }
    };
    ciclo = requestAnimationFrame(passo);
  }
  if (opzioni.istante != null) disegna(opzioni.istante); else avvia();
  return { rifiorisci: avvia, ferma() { if (ciclo) cancelAnimationFrame(ciclo); ciclo = null; } };
}

// Il file da scaricare: una pagina HTML sola, che funziona offline (niente immagini,
// font, librerie o file esterni). Dentro ci sono i dati del bouquet e la stessa fioritura.
function paginaBouquet(dati) {
  const descr = 'Un bouquet di gigli bianchi disegnato con caratteri monospace colorati: petali bianchi e avorio, boccioli verdi chiari, foglie e steli verdi, piccoli fiori bianchi. All\'apertura i gigli fioriscono uno dopo l\'altro.';
  return '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>Il bouquet di Bijou</title>\n<style>\n'
    + 'html,body{margin:0;min-height:100%;background:#201D24;color:#F4F0E7;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}\n'
    + 'main{min-height:100vh;display:grid;place-items:center;align-content:center;gap:1.25rem;padding:1.5rem;box-sizing:border-box;text-align:center}\n'
    + 'h1{margin:0;font-size:1.25rem;font-weight:700}\n'
    + 'canvas{display:block;width:min(92vw,60vh,640px);height:auto}\n'
    + 'button{font:inherit;font-weight:700;padding:.7rem 1.4rem;border-radius:999px;border:2px solid #B9A2D2;background:#B9A2D2;color:#201D24;cursor:pointer}\n'
    + 'button:focus-visible{outline:2px solid #F4F0E7;outline-offset:3px}\n'
    + '</style>\n</head>\n<body>\n<main>\n<h1>Un regalo da Bijou</h1>\n'
    + '<canvas role="img" aria-label="' + descr + '"></canvas>\n'
    + '<button type="button">Fai rifiorire</button>\n</main>\n<script>\n'
    + 'const DATI = ' + JSON.stringify(dati) + ';\n'
    + fioritura.toString() + '\n'
    + 'const bouquet = fioritura(document.querySelector("canvas"), DATI);\n'
    + 'document.querySelector("button").addEventListener("click", () => bouquet.rifiorisci());\n'
    + '<\/script>\n</body>\n</html>\n';
}
