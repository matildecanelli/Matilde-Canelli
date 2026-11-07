/* ==========================================================================
   bijou-asset.js: la CONFIGURAZIONE del gioco con Bijou (solo dati, niente logica)

   Le pose sono le illustrazioni di Matilde, scontornate (fondo trasparente,
   bianchi del pelo e degli occhi intatti). Ogni posa è scalata perché il
   cappuccio sia sempre largo 300 unità e le zampe poggino sul pavimento
   (y 580) del palco, al centro (x 500): così, cambiando posa, Bijou non salta e non cambia misura.
   Misure di partenza (in pixel dell'illustrazione): cappuccio, centro, piedi.

   Le zone sono dove si possono lasciare gli strumenti (o accarezzare),
   in unità del palco, e cambiano con la posa: ellissi [centro x, centro y, raggio x, raggio y].
   ========================================================================== */

window.BIJOU_ASSET = {
  palco: { viewBox: '0 40 1000 580', pavimento: 580, perno: [500, 580] },

  // le pose: file, misure originali, e come metterle sul palco (scala, poi spostamento)
  pose: {
      base: {
          file: 'assets/img/bijou-base.png',
          larghezza: 1254,
          altezza: 1254,
          scala: 0.4231,
          x: 164.7,
          y: 111.2
      },
      patting: {
          file: 'assets/img/bijou-seduta.png',
          larghezza: 1254,
          altezza: 1254,
          scala: 0.4249,
          x: 222.5,
          y: 87.1
      },
      chin: {
          file: 'assets/img/bijou-mento.png',
          larghezza: 1254,
          altezza: 1254,
          scala: 0.4717,
          x: 199.1,
          y: 29.1
      },
      belly: {
          file: 'assets/img/bijou-sdraiata.png',
          larghezza: 1536,
          altezza: 1024,
          scala: 0.4286,
          x: 170.0,
          y: 161.7
      },
      stalking: {
          file: 'assets/img/bijou-agguato.png',
          larghezza: 1536,
          altezza: 1024,
          scala: 0.5291,
          x: 76.5,
          y: 109.1
      },
      pawing: {
          file: 'assets/img/bijou-zampetta.png',
          larghezza: 1254,
          altezza: 1254,
          scala: 0.4808,
          x: 235.6,
          y: 39.6
      },
      sleeping: {
          file: 'assets/img/bijou-riposo.png',
          larghezza: 1254,
          altezza: 1254,
          scala: 0.4184,
          x: 273.4,
          y: 123.1
      },
      reward: {
          file: 'assets/img/bijou-bouquet.png',
          larghezza: 1536,
          altezza: 1024,
          scala: 0.62,
          x: 49.4,
          y: 15.8
      }
  },

  // dove si può usare ogni strumento, posa per posa
  zone: {
    base: {
      testa: [502, 262, 150, 92],      // la parte alta del cappuccio
      mento: [512, 440, 62, 44],       // sotto il musetto
      pancia: [442, 482, 150, 72],     // il corpo
      davanti: [850, 450, 140, 130],   // il pavimento davanti a Bijou, per la stellina
      nanna: [500, 400, 210, 180],     // tutta Bijou, per il cuscino
    },
    belly: { pancia: [624, 406, 118, 90] },            // il pancino esposto, da accarezzare (posa centrata sul palco)
    stalking: { zampe: [710, 470, 120, 110] },         // davanti alle zampe anteriori
    pawing: { zampe: [710, 300, 120, 120] },
  },

  // dove si appoggiano mano e stellina durante i gesti (unità del palco)
  gesti: {
    patMano: [560, 150],               // la mano aperta sulla cima del cappuccio, da seduta
    stellaAgguato: [830, 430],         // dove compare la stellina lasciata davanti
    stellaZampa: [770, 235],           // vicino alla zampetta protesa
  },

  // le mani disegnate (strumenti e gesti sul palco): file e misure
  mani: {
    pat: { file: 'assets/img/mano-pat.png', larghezza: 360, altezza: 321 },
    mento: { file: 'assets/img/mano-mento.png', larghezza: 360, altezza: 338 },
    pancia: { file: 'assets/img/mano-pancia.png', larghezza: 360, altezza: 123 },
  },

  // le quattro attività che accendono una stellina ciascuna
  attivita: ['pat', 'mento', 'pancia', 'stellina'],
};
