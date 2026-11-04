/* ==========================================================================
   strass.js: i pezzi comuni per costruire un oggetto di strass in 3D (Three.js)

   Una pietra è una gemma di vetro con il suo taglio: tavola in alto e faccette intorno.
   Lo shader segue la luce: una parte si riflette sulla faccetta, il resto entra nel
   vetro, rimbalza sul fondo sfaccettato ed esce. Da lì vengono le zone chiare e
   scure dentro la pietra e i lampi, che cambiano mentre l'oggetto gira.
   ========================================================================== */

import * as THREE from 'three';

// numeri casuali sempre uguali: l'oggetto viene identico a ogni visita
export function casuale(seme) {
  let s = seme >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// la stanza che si riflette nelle pietre: buia, con tante piccole luci bianche e qualche grande finestra
export function stanzaDiLuci(motore) {
  const stanza = new THREE.Scene();
  stanza.background = new THREE.Color(0x4c4c52);
  const dado = casuale(11);
  const luce = (l, a, forza) => new THREE.Mesh(new THREE.PlaneGeometry(l, a), new THREE.MeshBasicMaterial({ color: new THREE.Color(forza, forza, forza), side: THREE.DoubleSide }));
  // tre grandi finestre morbide danno il tono argento; tante luci piccole danno il lampo
  for (const [x, y, z, l, a, f] of [[-6, 7, 6, 10, 7, 1.9], [7, 4, 5, 7, 8, 1.3], [0, -7, 6, 12, 5, 0.7]]) { const m = luce(l, a, f); m.position.set(x, y, z); m.lookAt(0, 0, 0); stanza.add(m); }
  for (let i = 0; i < 46; i++) {
    const m = luce(0.25 + dado() * 0.7, 0.25 + dado() * 0.7, 8 + dado() * 26);
    const v = new THREE.Vector3(dado() - 0.5, dado() - 0.3, dado() - 0.5).normalize().multiplyScalar(8.5);
    m.position.copy(v); m.lookAt(0, 0, 0); stanza.add(m);
  }
  const generatore = new THREE.PMREMGenerator(motore);
  const mappa = generatore.fromScene(stanza, 0).texture;
  generatore.dispose();
  return mappa;
}

// il taglio: tavola ottagonale, un giro di faccette, un giro verso il bordo. Raggio 1, la tavola guarda verso +z.
// alta: quanto sporge la pietra. semplice: meno faccette, per quando sono tante (quelle disegnate dallo shader restano)
export function geometriaPietra({ alta = 1, semplice = false } = {}) {
  const giro = (n, r, z, sfasa) => Array.from({ length: n }, (_, i) => { const a = ((i + sfasa) / n) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z); });
  const tavola = giro(8, 0.56, 0.52 * alta, 0), medio = giro(8, 0.8, 0.36 * alta, 0.5), bordo = giro(16, 1, 0.08 * alta, 0), base = giro(16, 1, -0.14, 0), punti = [];
  for (let i = 1; i < 7; i++) punti.push(tavola[0], tavola[i], tavola[i + 1]);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, b0 = bordo[i * 2], b1 = bordo[i * 2 + 1], b2 = bordo[(i * 2 + 2) % 16];
    if (semplice) punti.push(tavola[i], b0, b1, tavola[i], b1, b2, tavola[i], b2, tavola[j]);
    else {
      punti.push(tavola[i], medio[i], tavola[j]);          // le stelle
      punti.push(tavola[i], b0, medio[i], tavola[j], medio[i], b2);   // i rombi
      punti.push(medio[i], b0, b1, medio[i], b1, b2);      // verso il bordo
    }
  }
  if (alta > 1) for (let i = 0; i < 16; i++) { const j = (i + 1) % 16; punti.push(bordo[i], base[i], base[j], bordo[i], base[j], bordo[j]); }   // il fianco: si vede di taglio
  const g = new THREE.BufferGeometry().setFromPoints(punti);
  g.computeVertexNormals();                              // ogni faccetta ha la sua normale: spigoli netti
  return g;
}

// il materiale di vetro. chiara: trasparente, si vede la luce che rimbalza dentro. nera: vetro nero, solo riflessi sulla superficie
export function materialeGemma(nera = false) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    defines: nera ? { NERA: 1 } : {},
    vertexShader: `
      varying vec3 vW; varying vec3 vN; varying vec3 vL; varying mat3 vRot; varying float vCaso; varying vec3 vTinta;
      void main(){
        #ifdef USE_INSTANCING_COLOR
          vTinta = instanceColor;
        #else
          vTinta = vec3(1.0);
        #endif
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vL = position; vN = normal;
        vRot = mat3(normalize(m[0].xyz), normalize(m[1].xyz), normalize(m[2].xyz));
        vCaso = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec3 vW; varying vec3 vN; varying vec3 vL; varying mat3 vRot; varying float vCaso; varying vec3 vTinta;
      // la stanza che si riflette: soffitto chiaro, pavimento scuro, bande di contrasto, finestre e luci piccole
      vec3 stanza(vec3 d){
        float c = mix(0.05, 0.95, smoothstep(-0.15, 0.85, d.y));
        c *= mix(0.1, 1.0, smoothstep(-0.25, 0.25, sin(d.x * 6.5 + 1.0) * sin(d.z * 5.5 + d.y * 3.5)));
        c += 2.2 * smoothstep(0.92, 0.97, dot(d, vec3(-0.51, 0.62, 0.6)));
        c += 1.5 * smoothstep(0.94, 0.98, dot(d, vec3(0.62, 0.35, 0.7)));
        c += 1.0 * smoothstep(0.93, 0.97, dot(d, vec3(0.0, 0.2, -0.98)));
        c += 7.0 * pow(max(dot(d, vec3(0.27, 0.8, 0.53)), 0.0), 700.0);
        c += 6.0 * pow(max(dot(d, vec3(-0.75, 0.25, 0.61)), 0.0), 700.0);
        c += 6.0 * pow(max(dot(d, vec3(0.8, 0.5, -0.33)), 0.0), 700.0);
        c += 5.0 * pow(max(dot(d, vec3(-0.3, 0.45, -0.84)), 0.0), 700.0);
        return vec3(c);
      }
      void main(){
        vec3 n = normalize(vRot * vN), v = normalize(cameraPosition - vW);
        float nv = max(dot(n, v), 0.0);
        float fres = 0.05 + 0.95 * pow(1.0 - nv, 5.0);
        // quando la pietra è piccola sullo schermo si tiene il disegno d'insieme: niente rumore scintillante
        float piccola = smoothstep(0.26, 0.62, fwidth(vL.x));
        vec3 riflesso = stanza(reflect(-v, n));
        #ifdef NERA
          // il nero resta nero: si vedono solo le finestre e le luci riflesse, sulla faccetta girata giusta
          vec3 c = vec3(0.004) + pow(riflesso, vec3(2.6)) * (fres * 2.2 + 0.05);
          c = mix(c, vec3(0.012), piccola * 0.6);
        #else
          // dentro: entra, rimbalza su due faccette del fondo, esce
          vec3 t = refract(-v, n, 0.645);
          float a = atan(vL.y, vL.x) + vCaso * 6.283;
          float s = floor(a / 0.3927) * 0.3927 + 0.196, r = length(vL.xy);
          // il fondo ha sedici spicchi e due giri: tante piccole zone chiare e scure, non poche grandi
          float k = r < 0.5 ? 0.46 : r < 0.8 ? 0.68 : 0.86;
          vec3 f1 = normalize(vRot * vec3(cos(s) * k, sin(s) * k, 0.7));
          vec3 f2 = normalize(vRot * vec3(-cos(s + 1.18) * k, -sin(s + 1.18) * k, 0.7));
          vec3 u = reflect(reflect(t, f1), f2);
          // i colori si separano appena, come nel vetro vero
          vec3 dentro = vec3(stanza(normalize(u + 0.02 * f1)).r, stanza(u).g, stanza(normalize(u - 0.02 * f1)).b);
          // il volume: ogni pietra è una cupola, chiara dal lato della luce e scura dall'altro, con il bordo in ombra
          float r2 = dot(vL.xy, vL.xy);
          vec3 cupola = normalize(vRot * vec3(vL.xy * 0.85, sqrt(max(0.05, 1.0 - r2 * 0.72))));
          vec3 sole = normalize(vec3(-0.45, 0.75, 0.55));
          float volume = 0.55 + 0.6 * max(dot(cupola, sole), 0.0);
          float bordo = 1.0 - 0.45 * smoothstep(0.55, 1.0, r2);
          // la luce sulla statua intera: una pietra che guarda altrove è più scura, così pieghe e forme si leggono
          float forma = 0.5 + 0.72 * max(dot(normalize(vRot * vec3(0.0, 0.0, 1.0)), sole), 0.0);
          vec3 c = vTinta * (dentro * 0.78 + 0.34) * volume * bordo * forma + riflesso * fres;
          c += pow(min(dentro, vec3(1.0)), vec3(4.0)) * 0.55;     // dove la luce esce dritta è bianca, anche nelle pietre colorate
          c += vec3(1.0, 0.98, 0.96) * pow(max(dot(reflect(-v, cupola), sole), 0.0), 80.0) * 0.6;
          c = mix(c, vTinta * 0.62 * volume * forma, piccola * 0.4);
        #endif
        gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// tante pietre insieme. Ogni voce: { p: posizione, n: normale, r: raggio, gira: rotazione sulla sua normale, colore }
export function pietre(voci, materiale, forma = geometriaPietra()) {
  const mesh = new THREE.InstancedMesh(forma, materiale, voci.length);
  const o = new THREE.Object3D(), su = new THREE.Vector3(0, 0, 1), giro = new THREE.Quaternion();
  const dado = casuale(voci.length + 7), tinta = new THREE.Color();
  voci.forEach((v, i) => {
    // ogni pietra è incollata a mano: leggermente storta
    const n = v.n.clone().add(new THREE.Vector3(dado() - 0.5, dado() - 0.5, dado() - 0.5).multiplyScalar(0.11)).normalize();
    o.position.copy(v.p);
    o.quaternion.setFromUnitVectors(su, n);
    o.quaternion.multiply(giro.setFromAxisAngle(su, dado() * Math.PI));
    o.scale.setScalar(v.r);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    if (v.colore) mesh.setColorAt(i, tinta.setRGB(v.colore[0], v.colore[1], v.colore[2], THREE.SRGBColorSpace));
      });
  mesh.frustumCulled = false;
  return mesh;
}
