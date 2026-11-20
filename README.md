# Matilde Canelli · Portfolio

Il mio portfolio di digital designer: [matildecanelli.com](https://matildecanelli.com).

Una sola pagina con una stella di strass in 3D, il nome, un menu e qualche finestrella
da vecchio computer. Ogni progetto si apre in un pannello con contesto, ruolo, processo
e risultato, e finisce con uno dei miei oggetti di strass (veri) ricostruito in 3D.

## Tecnologie

- **HTML, CSS e JavaScript scritti a mano**, senza framework né build: si apre `index.html` e funziona.
- **[three.js](https://threejs.org/) 0.169** (da jsDelivr, con un import map) per la stella e gli oggetti 3D.
- **[GSAP](https://gsap.com/) 3.12 con ScrollTrigger** per l'animazione d'ingresso legata allo scroll.
- Font self-hosted (Anton, Bricolage Grotesque) e Space Mono da Google Fonts.
- Pubblicato su **Netlify** a ogni push sul ramo `main`.

## Struttura

```
index.html          la pagina: home, firmamento e pannelli dei progetti
css/
  base.css          variabili, colori dei due temi, tipografia
  home.css          la scena e i pannelli che si aprono
  stella.css        nome, menu, firmamento, contenuto dei pannelli
  finestre.css      la home a finestrelle, il nastro che scorre
js/
  stella.js         la stella di strass (three.js) e l'ingresso con lo scroll (GSAP)
  spazio.js         sugli schermi bassi allunga la scena, così le finestre non coprono il menu
  strass.js         i pezzi comuni per costruire un oggetto di strass (gemme e shader)
  lattina.js, statua.js, occhiali.js, barattolo.js, fotocamera.js
                    gli oggetti 3D dei progetti, costruiti sulle foto vere
  pannelli.js       apertura e chiusura dei pannelli
  progetti.js       il pannello Progetti, con i nomi giganti
  nomi-strass.js    i nomi dei progetti che si riempiono di strass
  quiz.js           "Scegli la tua stella", il firmamento
  bijou*.js         il piccolo gioco con Bijou nella scheda Contatti
  tema.js           tema chiaro e scuro
assets/
  3d/               modelli e texture degli oggetti (WebP)
  img/, video/      immagini e video dei progetti
  fonts/            i font usati
  docs/             CV e portfolio in PDF
```

## Accessibilità e prestazioni

- Tutte le immagini hanno il testo alternativo; immagini e video si caricano in modo lazy.
- Con "riduci movimento" attivo la pagina si mostra subito ferma, senza animazioni.
- Senza WebGL o senza JavaScript i contenuti restano leggibili.
- Link per saltare al menu, focus visibile, tutto raggiungibile da tastiera.
- Le texture 3D sono in WebP e si scaricano solo quando l'oggetto si vede.

## Provarlo in locale

Serve un piccolo server (i moduli JavaScript non partono aprendo il file direttamente):

```bash
python3 -m http.server 8000
```

poi si apre `http://localhost:8000`.

## Uso dell'AI

Parte del codice è stata scritta insieme a un assistente AI (Claude), con le mie
indicazioni, i miei disegni, le mie foto e le mie revisioni. Le scelte di design e i
contenuti sono miei.
