/**
 * Pictures for the kitchen menu (burgers, pasta, rolls, pizza, coolers).
 *
 * There are no photographs of these dishes yet (a real photo in
 * public/assets/kitchen/<id>.webp replaces the drawing), so each dish is drawn
 * as a studio shot: a warm backdrop and table, soft top light, vignette and
 * grain, the dish on its own serveware, with texture from SVG noise filters.
 * Every picture is a full-bleed square, used like a photo.
 */

export type FoodKind = 'burger' | 'pizza' | 'pasta' | 'roll' | 'drink';

type Palette = Record<string, string>;

const VARIANTS: Record<FoodKind, Record<string, Palette>> = {
  burger: {
    smash: { style: 'smash', bg: '#e9c79a', bg2: '#8a5a33', table: '#5a3a24' },
    zinger: { style: 'zinger', bg: '#efd2a0', bg2: '#94622f', table: '#5e3d22' },
    bbq: { style: 'bbq', bg: '#e2b98e', bg2: '#7a4526', table: '#4c2e1c' },
  },
  pizza: {
    margherita: { style: 'margherita', bg: '#e8c9a4', bg2: '#7f4f30', table: '#4a2f1e' },
    fajita: { style: 'fajita', bg: '#ebcc9c', bg2: '#85532c', table: '#4e311d' },
    pepperoni: { style: 'pepperoni', bg: '#e6c1a0', bg2: '#7d4630', table: '#472b1c' },
  },
  pasta: {
    alfredo: { style: 'ribbon', sauce: '#f3e2b4', sauce2: '#dcc27f', noodle: '#f6dc98', noodle2: '#e0b865', chicken: '1', herb: '#6f9c3a', bg: '#ece0c6', bg2: '#8c7652', table: '#d9cdb5' },
    arrabbiata: { style: 'penne', sauce: '#cf4a2c', sauce2: '#9e2c18', noodle: '#f2c77a', noodle2: '#d99a45', chicken: '', herb: '#4f8f34', bg: '#ecd3c4', bg2: '#8a5040', table: '#d8c6b8' },
    pesto: { style: 'fusilli', sauce: '#86ad3f', sauce2: '#5d8428', noodle: '#efd07e', noodle2: '#c9a24b', chicken: '1', herb: '#fff4d6', bg: '#e1e6c9', bg2: '#6d7a48', table: '#d3d6bf' },
  },
  roll: {
    tikka: { fill: '#d4582a', fill2: '#f0a060', sauce: '#6fb04a', bg: '#ecd1a6', bg2: '#8a5b31', table: '#5a3a22' },
    behari: { fill: '#6a3320', fill2: '#9b5532', sauce: '#8a4a2a', bg: '#e7c9a0', bg2: '#7d4f2c', table: '#523420' },
    crispy: { fill: '#d99a3e', fill2: '#f3c46b', sauce: '#f4ead2', bg: '#efdcae', bg2: '#8d6a35', table: '#5d4124' },
  },
  drink: {
    mint: { liquid: '#9fd47a', liquid2: '#5f9f3f', clear: '1', garnish: 'mint', bg: '#d6ead0', bg2: '#4f7a4a', table: '#cfd8c9', ice: 'crushed' },
    peach: { liquid: '#f2a45c', liquid2: '#c9652a', clear: '1', garnish: 'peach', bg: '#f1d6bf', bg2: '#8d5337', table: '#dcc8b6', ice: 'cubes' },
    mango: { liquid: '#f8bd3c', liquid2: '#e58f16', clear: '', garnish: 'mango', bg: '#f3dfae', bg2: '#8f6428', table: '#dccbab', ice: '' },
    lime: { liquid: '#e7f3b8', liquid2: '#bcd47a', clear: '1', garnish: 'lime', bg: '#e3eecb', bg2: '#667a3f', table: '#d4d9c1', ice: 'cubes' },
  },
};

/* ── small helpers ── */
const f = (n: number) => n.toFixed(1);
const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};

/* ── the studio: backdrop, table, light, vignette, grain ── */
const defs = (p: Palette) => `
  <defs>
    <radialGradient id="bg" cx="50%" cy="28%" r="80%"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/></radialGradient>
    <linearGradient id="table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.table}" stop-opacity="0"/><stop offset=".18" stop-color="${p.table}" stop-opacity=".85"/><stop offset="1" stop-color="${p.table}"/></linearGradient>
    <radialGradient id="light" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#fff6e6" stop-opacity=".3"/><stop offset=".6" stop-color="#fff6e6" stop-opacity=".08"/><stop offset="1" stop-color="#fff6e6" stop-opacity="0"/></radialGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="72%"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .4  0 0 0 0 .3  0 0 0 .5 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="tex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves="4" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.1 -.35"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="fine" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.2 -.45"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="blur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="goo"><feGaussianBlur stdDeviation="5"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9824d"/><stop offset=".5" stop-color="#d6a067"/><stop offset="1" stop-color="#a8703e"/></linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>`;

const studio = () => `
  <rect width="400" height="400" fill="url(#bg)"/>
  <rect y="238" width="400" height="162" fill="url(#table)"/>
  <rect y="238" width="400" height="162" filter="url(#fine)" opacity=".25"/>`;

const finish = () => `
  <rect width="400" height="400" fill="url(#light)"/>
  <rect width="400" height="400" fill="url(#vig)"/>
  <rect width="400" height="400" filter="url(#grain)" opacity=".18"/>`;

const shadow = (cx: number, cy: number, rx: number, ry: number, o = 0.45) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1a0f08" opacity="${o}" filter="url(#soft)"/>`;

/* A wooden board, seen at a low angle: top face, front edge, grain. */
const board = (x: number, y: number, w: number, h: number) => {
  const r = rng(w * 7 + h);
  const grain = Array.from({ length: 7 }, (_, i) => {
    const yy = y + 5 + i * ((h - 10) / 6);
    return `<path d="M${x + 14} ${f(yy)} q ${w / 3} ${f((r() - 0.5) * 6)} ${w / 1.6} 0 t ${w / 3} 0" stroke="#8a5a30" stroke-opacity=".35" stroke-width="1.2" fill="none"/>`;
  }).join('');
  return `${shadow(x + w / 2, y + h + 8, w / 2, 12, 0.55)}
    <rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="${h / 2}" fill="#7a4a24"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#wood)"/>
    <g clip-path="none">${grain}</g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" filter="url(#tex)" opacity=".25"/>`;
};

/* ── burger ── */
function burger(p: Palette) {
  const r = rng(p.style.length * 31);
  const seeds = Array.from({ length: 18 }, () => {
    const a = -Math.PI * (0.12 + r() * 0.76), d = 30 + r() * 62;
    const x = 200 + Math.cos(a) * d * 1.25, y = 188 + Math.sin(a) * d * 0.8;
    const rot = f(r() * 180);
    return `<g transform="rotate(${rot} ${f(x)} ${f(y)})"><ellipse cx="${f(x)}" cy="${f(y + 0.8)}" rx="5.2" ry="2.6" fill="#a86a2c" opacity=".5"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="5" ry="2.4" fill="#fff3d6"/></g>`;
  }).join('');
  const patty =
    p.style === 'zinger'
      ? `<path d="M88 232 ${Array.from({ length: 16 }, (_, i) => `q 7 ${i % 2 ? -7 : -3} 14 0`).join(' ')} L 316 262 ${Array.from({ length: 16 }, (_, i) => `q -7 ${i % 2 ? 8 : 4} -14 0`).join(' ')} Z" fill="url(#crumb)"/>
         <path d="M88 232 H312 V262 H88 Z" filter="url(#tex)" opacity=".45"/>
         ${Array.from({ length: 22 }, () => `<circle cx="${f(95 + r() * 210)}" cy="${f(236 + r() * 24)}" r="${f(1.5 + r() * 2.5)}" fill="#fbe0a3" opacity=".8"/>`).join('')}`
      : `<rect x="84" y="228" width="232" height="${p.style === 'bbq' ? 40 : 34}" rx="17" fill="url(#beef)"/>
         <rect x="84" y="228" width="232" height="${p.style === 'bbq' ? 40 : 34}" rx="17" filter="url(#tex)" opacity=".6"/>
         <path d="M96 234 q 104 -10 208 0" stroke="#8a4a26" stroke-width="3" fill="none" opacity=".6"/>
         ${Array.from({ length: 14 }, () => `<circle cx="${f(96 + r() * 208)}" cy="${f(236 + r() * 22)}" r="${f(1 + r() * 2)}" fill="#1a0b05" opacity=".7"/>`).join('')}`;
  const cheese =
    p.style === 'smash' || p.style === 'bbq'
      ? `<path d="M80 226 H320 L318 232 Q300 232 298 246 Q296 258 288 246 Q282 232 262 234 L258 256 Q254 266 248 254 L242 234 Q222 232 214 240 Q206 262 198 244 Q190 232 170 234 Q164 250 158 236 Q150 230 132 234 Q128 258 120 240 Q112 230 96 234 Q90 246 84 236 Z" fill="url(#cheese)"/>
         <path d="M90 228 H310" stroke="#fff3b0" stroke-width="2" opacity=".7"/>`
      : '';
  const bbqSauce = p.style === 'bbq' ? `<path d="M94 270 Q 150 282 200 272 T 306 270" stroke="#5a1a0c" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M140 274 q 2 12 -2 18" stroke="#5a1a0c" stroke-width="5" fill="none" stroke-linecap="round"/>` : '';
  const onion = p.style === 'bbq' ? `<g>${[118, 170, 226, 280].map((x) => `<ellipse cx="${x}" cy="218" rx="26" ry="11" fill="none" stroke="#c9832f" stroke-width="9"/><ellipse cx="${x}" cy="217" rx="26" ry="11" fill="none" stroke="#e8b060" stroke-width="4"/>`).join('')}</g>` : '';
  const slaw = p.style === 'zinger' ? `<path d="M86 226 Q120 212 150 224 T210 222 T270 224 T318 222 L316 232 H86 Z" fill="#f6f0dc"/>${Array.from({ length: 16 }, () => `<path d="M${f(95 + r() * 210)} ${f(218 + r() * 10)} l ${f(6 + r() * 6)} ${f((r() - 0.5) * 4)}" stroke="${r() > 0.5 ? '#8fbf52' : '#c86a8a'}" stroke-width="2" stroke-linecap="round"/>`).join('')}` : '';
  const lettuce = `<path d="M74 214 ${Array.from({ length: 12 }, (_, i) => `q 11 ${i % 2 ? 14 : 8} 22 ${i % 3 ? 2 : -2}`).join(' ')} L 330 208 Q 320 202 200 200 Q 80 202 74 214 Z" fill="url(#leaf)"/>`;
  const tomato = p.style === 'smash' ? `<ellipse cx="150" cy="212" rx="44" ry="9" fill="#c8321f"/><ellipse cx="252" cy="212" rx="44" ry="9" fill="#d23c24"/><ellipse cx="252" cy="210" rx="30" ry="4" fill="#f07a58" opacity=".6"/>` : '';
  return `
    <defs>
      <radialGradient id="bun" cx="38%" cy="22%" r="80%"><stop offset="0" stop-color="#f8cf8c"/><stop offset=".45" stop-color="#e3953f"/><stop offset=".85" stop-color="#b8661f"/><stop offset="1" stop-color="#8e4a16"/></radialGradient>
      <linearGradient id="bun2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9a456"/><stop offset="1" stop-color="#b56420"/></linearGradient>
      <linearGradient id="beef" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3419"/><stop offset=".5" stop-color="#4a220f"/><stop offset="1" stop-color="#2c1206"/></linearGradient>
      <linearGradient id="crumb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b358"/><stop offset=".6" stop-color="#cf8430"/><stop offset="1" stop-color="#9d5a1b"/></linearGradient>
      <linearGradient id="cheese" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd562"/><stop offset="1" stop-color="#f0a41c"/></linearGradient>
      <linearGradient id="leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9e07a"/><stop offset="1" stop-color="#5f9a2c"/></linearGradient>
    </defs>
    ${board(50, 300, 300, 26)}
    <path d="M110 300 L 96 282 L 300 278 L 318 300 Z" fill="#f4ecd8" opacity=".9"/>
    ${shadow(200, 298, 120, 10, 0.55)}
    <path d="M82 256 H318 Q326 256 322 270 L316 290 Q312 300 298 300 H102 Q88 300 84 290 L78 270 Q74 256 82 256 Z" fill="url(#bun2)"/>
    <rect x="80" y="254" width="240" height="7" rx="3.5" fill="#f4c27c" opacity=".8"/>
    ${patty}${bbqSauce}${cheese}${slaw}${tomato}${onion}${lettuce}
    <path d="M76 206 Q 72 110 200 100 Q 328 110 324 206 Q 200 216 76 206 Z" fill="url(#bun)"/>
    <path d="M76 206 Q 72 110 200 100 Q 328 110 324 206 Q 200 216 76 206 Z" filter="url(#fine)" opacity=".25"/>
    <ellipse cx="150" cy="130" rx="46" ry="16" fill="#fff" opacity=".28" filter="url(#blur2)" transform="rotate(-14 150 130)"/>
    ${seeds}
    <g transform="rotate(8 206 70)"><rect x="203" y="40" width="5" height="120" rx="2.5" fill="#d9b27a"/><path d="M208 44 h 50 l -8 11 l 8 11 h -50 Z" fill="#17130f"/><text x="229" y="59" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="11" fill="#d8b777">brewns</text></g>
    <g>${[0, 1, 2, 3, 4].map((i) => `<rect x="${310 + i * 7}" y="${278 - (i % 2) * 4}" width="7" height="30" rx="2" fill="${i % 2 ? '#f2c05c' : '#e4a743'}" transform="rotate(${-58 + i * 6} ${313 + i * 7} 300)"/>`).join('')}</g>`;
}

/* ── pizza (from above, on a round board, one slice pulled out) ── */
function pizza(p: Palette) {
  const r = rng(p.style.length * 53 + 5);
  const around = (n: number, rMin: number, rMax: number, draw: (x: number, y: number, i: number) => string) =>
    Array.from({ length: n }, (_, i) => {
      const a = r() * Math.PI * 2, d = rMin + Math.sqrt(r()) * (rMax - rMin);
      return draw(200 + Math.cos(a) * d, 200 + Math.sin(a) * d, i);
    }).join('');
  const cheese = around(26, 0, 100, (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(12 + r() * 12)}"/>`);
  const browned = around(24, 0, 104, (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2 + r() * 4)}" fill="#c9832e" opacity="${f(0.35 + r() * 0.4)}"/>`);
  const char = around(30, 116, 132, (x, y) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(3 + r() * 5)}" ry="${f(2 + r() * 3)}" fill="#3a1d0c" opacity="${f(0.3 + r() * 0.4)}"/>`);
  const tops =
    p.style === 'pepperoni'
      ? around(14, 10, 96, (x, y) => `<circle cx="${f(x)}" cy="${f(y + 1.5)}" r="15" fill="#5c140c" opacity=".6"/><circle cx="${f(x)}" cy="${f(y)}" r="15" fill="url(#pep)"/><circle cx="${f(x - 4)}" cy="${f(y - 4)}" r="4" fill="#fff" opacity=".25"/>${[0, 1, 2].map(() => `<circle cx="${f(x + (r() - 0.5) * 16)}" cy="${f(y + (r() - 0.5) * 16)}" r="1.4" fill="#f2d28c" opacity=".7"/>`).join('')}`)
      : p.style === 'fajita'
        ? around(12, 10, 96, (x, y, i) => `<g transform="rotate(${i * 41} ${f(x)} ${f(y)})"><rect x="${f(x - 10)}" y="${f(y - 7)}" width="20" height="14" rx="4" fill="#b8703a"/><rect x="${f(x - 10)}" y="${f(y - 7)}" width="20" height="5" rx="2" fill="#d99a5c"/><path d="M${f(x - 6)} ${f(y - 7)} v14 M${f(x + 2)} ${f(y - 7)} v14" stroke="#6e3a18" stroke-width="1.5" opacity=".6"/></g>`) +
          around(12, 10, 98, (x, y, i) => `<path d="M${f(x - 12)} ${f(y)} q 12 -12 24 0" stroke="${['#2f8a38', '#d8392a', '#f2b632'][i % 3]}" stroke-width="6" fill="none" stroke-linecap="round" transform="rotate(${i * 53} ${f(x)} ${f(y)})"/>`) +
          around(8, 10, 96, (x, y, i) => `<path d="M${f(x - 9)} ${f(y)} q 9 -8 18 0" stroke="#e7d2e8" stroke-width="3" fill="none" transform="rotate(${i * 67} ${f(x)} ${f(y)})"/>`)
        : around(7, 20, 90, (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(15 + r() * 5)}" fill="#fbf6ea"/><circle cx="${f(x - 3)}" cy="${f(y - 3)}" r="6" fill="#fff" opacity=".7"/>`) +
          around(6, 20, 90, (x, y, i) => `<g transform="rotate(${i * 60} ${f(x)} ${f(y)})"><path d="M${f(x - 14)} ${f(y)} Q ${f(x)} ${f(y - 11)} ${f(x + 14)} ${f(y)} Q ${f(x)} ${f(y + 11)} ${f(x - 14)} ${f(y)} Z" fill="#3c8a32"/><path d="M${f(x - 12)} ${f(y)} H${f(x + 12)}" stroke="#7fc267" stroke-width="1.2"/></g>`);
  const flakes = around(40, 0, 118, (x, y) => `<rect x="${f(x)}" y="${f(y)}" width="2" height="1.4" fill="${r() > 0.5 ? '#6a7d2c' : '#a02a14'}" opacity=".8"/>`);
  const a0 = -Math.PI / 2 - Math.PI / 8;
  const pt = (a: number, d: number) => `${f(200 + Math.cos(a) * d)} ${f(200 + Math.sin(a) * d)}`;
  const cuts = [0, 1, 2, 3].map((i) => {
    const a = a0 + (i * Math.PI) / 4;
    return `<path d="M${pt(a, -132)} L${pt(a, 132)}" stroke="#6b3616" stroke-width="2.5" opacity=".45"/>`;
  }).join('');
  const pie = `
        <circle cx="200" cy="200" r="138" fill="url(#crust)"/>
        ${char}
        <circle cx="200" cy="200" r="138" filter="url(#fine)" opacity=".3"/>
        <circle cx="200" cy="200" r="116" fill="url(#sauce)"/>
        <g filter="url(#goo)" fill="url(#melt)">${cheese}</g>
        ${browned}${tops}${flakes}${cuts}
`;
  return `
    <defs>
      <radialGradient id="crust" cx="50%" cy="50%" r="50%"><stop offset=".82" stop-color="#f0b35c"/><stop offset=".93" stop-color="#d88a38"/><stop offset="1" stop-color="#a55a1e"/></radialGradient>
      <radialGradient id="sauce" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#d9502c"/><stop offset="1" stop-color="#a8321a"/></radialGradient>
      <radialGradient id="melt" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff0b8"/><stop offset="1" stop-color="#f6cf6a"/></radialGradient>
      <radialGradient id="pep" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#c8402a"/><stop offset=".75" stop-color="#9a2a18"/><stop offset="1" stop-color="#6d1a0e"/></radialGradient>
      <linearGradient id="steelP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f3f5"/><stop offset="1" stop-color="#8d9196"/></linearGradient>
    </defs>
    <rect width="400" height="400" fill="${p.table}"/>
    <rect width="400" height="400" filter="url(#tex)" opacity=".35"/>
    ${[40, 110, 180, 250, 320, 390].map((y) => `<path d="M0 ${y} q 200 ${y % 3 ? 8 : -8} 400 0" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/>`).join('')}
    <circle cx="200" cy="212" r="176" fill="#1a0f08" opacity=".5" filter="url(#soft)"/>
    <circle cx="200" cy="204" r="172" fill="#c08a52"/>
    <circle cx="200" cy="204" r="172" filter="url(#tex)" opacity=".3"/>
    <circle cx="200" cy="204" r="164" fill="none" stroke="#9a6a3c" stroke-width="2" opacity=".6"/>
    <g transform="translate(0 4)">
      <circle cx="200" cy="206" r="140" fill="#1a0f08" opacity=".35" filter="url(#soft)"/>
      ${pie}
      <g transform="translate(318 318) rotate(-35)"><rect x="-4" y="0" width="8" height="58" rx="4" fill="#17130f"/><circle r="24" fill="url(#steelP)"/><circle r="24" fill="none" stroke="#6d7277" stroke-width="1.5"/><circle r="5" fill="#17130f"/></g>
    </g>
    <g transform="rotate(30 64 344)"><ellipse cx="64" cy="344" rx="18" ry="8" fill="#3c8a32"/><ellipse cx="84" cy="338" rx="14" ry="7" fill="#4c9a3e"/><path d="M48 344 H 96" stroke="#7fc267" stroke-width="1.5"/></g>`;
}

/* ── pasta (a ceramic bowl on linen) ── */
function pasta(p: Palette) {
  const r = rng(p.style.length * 17 + 9);
  const inBowl = (n: number, draw: (x: number, y: number, i: number) => string) =>
    Array.from({ length: n }, (_, i) => {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = 200 + Math.cos(a) * d * 104, y = 196 + Math.sin(a) * d * 40 - (1 - d) * 22;
      return draw(x, y, i);
    }).join('');
  const noodles =
    p.style === 'penne'
      ? inBowl(34, (x, y, i) => `<g transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"><rect x="${f(x - 14)}" y="${f(y - 5)}" width="28" height="10" rx="3" fill="url(#noodle)"/><path d="M${f(x - 12)} ${f(y - 2)} h24 M${f(x - 12)} ${f(y + 2)} h24" stroke="${p.noodle2}" stroke-width="1" opacity=".7"/><ellipse cx="${f(x + 14)}" cy="${f(y)}" rx="2.5" ry="5" fill="${i % 2 ? p.sauce2 : p.sauce}"/></g>`)
      : p.style === 'fusilli'
        ? inBowl(30, (x, y) => `<g transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})">${[0, 1, 2, 3].map((k) => `<ellipse cx="${f(x - 12 + k * 8)}" cy="${f(y)}" rx="5" ry="7" fill="${k % 2 ? p.noodle : p.noodle2}"/>`).join('')}</g>`)
        : Array.from({ length: 34 }, (_, i) => {
            const y = 168 + (i % 17) * 3.6, x0 = 110 + r() * 40, w = 120 + r() * 50, lift = -10 - r() * 18;
            return `<path d="M${f(x0)} ${f(y + 10)} C ${f(x0 + w * 0.3)} ${f(y + lift)}, ${f(x0 + w * 0.7)} ${f(y + lift)}, ${f(x0 + w)} ${f(y + 8)}" stroke="${i % 3 ? 'url(#noodle)' : p.noodle2}" stroke-width="${f(5 + r() * 2)}" fill="none" stroke-linecap="round"/>`;
          }).join('');
  const chicken = p.chicken ? inBowl(6, (x, y, i) => `<g transform="rotate(${i * 50} ${f(x)} ${f(y)})"><rect x="${f(x - 11)}" y="${f(y - 6)}" width="22" height="13" rx="4" fill="#d9a36a"/><path d="M${f(x - 8)} ${f(y - 6)} l 5 13 M${f(x)} ${f(y - 6)} l 5 13" stroke="#8a4f22" stroke-width="2.2"/></g>`) : '';
  const shavings = p.style === 'fusilli' ? inBowl(7, (x, y, i) => `<path d="M${f(x)} ${f(y)} l 12 -3 l 4 6 l -13 3 Z" fill="#fff8e2" transform="rotate(${i * 40} ${f(x)} ${f(y)})"/>`) : inBowl(5, (x, y, i) => `<path d="M${f(x)} ${f(y)} l 10 -2 l 3 5 l -11 2 Z" fill="#fffaf0" opacity=".9" transform="rotate(${i * 40} ${f(x)} ${f(y)})"/>`);
  const herbs = p.style === 'fusilli'
    ? inBowl(4, (x, y, i) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4" ry="4" fill="#d24a30" transform="rotate(${i * 30} ${f(x)} ${f(y)})"/>`)
    : `<g transform="rotate(-20 222 162)"><ellipse cx="222" cy="162" rx="16" ry="8" fill="${p.herb}"/><ellipse cx="240" cy="168" rx="13" ry="7" fill="${p.herb}" opacity=".9"/><path d="M208 162 H 252" stroke="#bfe39a" stroke-width="1.2"/></g>`;
  const pepper = inBowl(40, (x, y) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.8 + r())}" fill="#2a1a10" opacity=".75"/>`);
  return `
    <defs>
      <linearGradient id="bowl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e9e5dc"/><stop offset="1" stop-color="#bfb8aa"/></linearGradient>
      <radialGradient id="sauceP" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="${p.sauce}"/><stop offset="1" stop-color="${p.sauce2}"/></radialGradient>
      <linearGradient id="noodle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.noodle}"/><stop offset="1" stop-color="${p.noodle2}"/></linearGradient>
      <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d9196"/><stop offset=".5" stop-color="#eef0f2"/><stop offset="1" stop-color="#9da1a6"/></linearGradient>
      <clipPath id="inner"><ellipse cx="200" cy="190" rx="120" ry="44"/></clipPath>
    </defs>
    <g transform="rotate(-8 200 300)"><rect x="40" y="250" width="320" height="130" rx="6" fill="#f3efe6"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="40" y="${262 + i * 24}" width="320" height="5" fill="${p.bg2}" opacity=".35"/>`).join('')}<rect x="40" y="250" width="320" height="130" rx="6" filter="url(#fine)" opacity=".25"/></g>
    ${shadow(200, 306, 150, 22, 0.55)}
    <path d="M58 190 Q 62 300 200 314 Q 338 300 342 190 Z" fill="url(#bowl)"/>
    <path d="M70 200 Q 90 286 180 302" stroke="#fff" stroke-width="6" opacity=".55" fill="none" stroke-linecap="round"/>
    <ellipse cx="200" cy="190" rx="142" ry="54" fill="#fbfaf6"/>
    <ellipse cx="200" cy="190" rx="142" ry="54" fill="none" stroke="#d8d2c6" stroke-width="2"/>
    <ellipse cx="200" cy="192" rx="124" ry="45" fill="#cfc8ba"/>
    <g clip-path="url(#inner)">
      <ellipse cx="200" cy="198" rx="122" ry="44" fill="url(#sauceP)"/>
      <ellipse cx="200" cy="198" rx="122" ry="44" filter="url(#fine)" opacity=".2"/>
      ${noodles}${chicken}
    </g>
    ${herbs}${shavings}${pepper}
    <ellipse cx="170" cy="176" rx="34" ry="5" fill="#fff" opacity=".35" filter="url(#blur2)"/>
    <g transform="rotate(34 300 150)"><rect x="296" y="42" width="9" height="150" rx="4.5" fill="url(#steel)"/><path d="M288 42 h 25 v 20 q -12 10 -25 0 Z" fill="url(#steel)"/><path d="M294 30 v 14 M300 30 v 14 M306 30 v 14" stroke="#b9bdc2" stroke-width="3"/></g>`;
}

/* ── roll (two halves of a paratha roll on paper, with chutney) ── */
function roll(p: Palette) {
  const r = rng(p.fill.length * 29 + p.fill.charCodeAt(1));
  const half = (tx: number, ty: number, rot: number, band: boolean) => {
    const spots = Array.from({ length: 16 }, () => `<ellipse cx="${f(r() * 170)}" cy="${f(6 + r() * 64)}" rx="${f(3 + r() * 6)}" ry="${f(2 + r() * 3)}" fill="#9a5a1e" opacity="${f(0.25 + r() * 0.4)}"/>`).join('');
    const filling = Array.from({ length: 10 }, (_, i) => `<circle cx="${f(170 + (r() - 0.5) * 22)}" cy="${f(14 + r() * 50)}" r="${f(4 + r() * 5)}" fill="${[p.fill, p.fill2, '#f3e3e6', p.sauce][i % 4]}"/>`).join('');
    return `<g transform="translate(${tx} ${ty}) rotate(${rot})">
      ${shadow(90, 84, 100, 12, 0.5)}
      <rect x="0" y="0" width="176" height="76" rx="30" fill="url(#para)"/>
      <rect x="0" y="0" width="176" height="76" rx="30" filter="url(#tex)" opacity=".35"/>
      ${spots}
      <path d="M20 10 Q 90 2 160 10" stroke="#fff3d6" stroke-width="5" opacity=".5" fill="none" stroke-linecap="round"/>
      <ellipse cx="170" cy="38" rx="22" ry="38" fill="#e3b06a"/>
      <ellipse cx="170" cy="38" rx="18" ry="33" fill="#f5dca8"/>
      <ellipse cx="170" cy="38" rx="14" ry="28" fill="${p.fill}"/>
      ${filling}
      <path d="M160 24 q 10 6 18 0 M158 50 q 10 6 20 0" stroke="${p.sauce}" stroke-width="3" fill="none"/>
      ${band ? `<rect x="10" y="-2" width="70" height="80" rx="4" fill="#f6f1e6"/><rect x="10" y="-2" width="70" height="80" rx="4" filter="url(#fine)" opacity=".15"/><text x="45" y="44" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="17" fill="#17130f">brewns</text><path d="M18 56 H 72" stroke="#d8b777" stroke-width="2"/>` : ''}
    </g>`;
  };
  return `
    <defs>
      <linearGradient id="para" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1cf8c"/><stop offset=".6" stop-color="#dca55a"/><stop offset="1" stop-color="#b87a34"/></linearGradient>
    </defs>
    ${board(40, 286, 320, 28)}
    <path d="M78 290 L 70 222 L 318 208 L 336 286 Z" fill="#efe6d2"/>
    <path d="M78 290 L 70 222 L 318 208 L 336 286 Z" filter="url(#fine)" opacity=".2"/>
    ${half(84, 196, -6, true)}
    ${half(112, 128, -14, false)}
    ${shadow(318, 290, 34, 8, 0.5)}
    <ellipse cx="318" cy="280" rx="34" ry="12" fill="#e9e3d8"/><ellipse cx="318" cy="276" rx="28" ry="9" fill="${p.sauce === '#f4ead2' ? '#f4ead2' : '#6fae45'}"/><ellipse cx="312" cy="274" rx="10" ry="3" fill="#fff" opacity=".35"/>
    <g transform="rotate(-20 300 262)"><ellipse cx="300" cy="262" rx="9" ry="4.5" fill="#4f9a3a"/><ellipse cx="312" cy="258" rx="8" ry="4" fill="#5fae45"/></g>
    ${Array.from({ length: 12 }, () => `<circle cx="${f(70 + r() * 250)}" cy="${f(292 + r() * 14)}" r="1.4" fill="#7a2a14" opacity=".6"/>`).join('')}`;
}

/* ── drink (a tall glass on a coaster, condensation, garnish) ── */
function drink(p: Palette) {
  const r = rng(p.garnish.length * 41 + 3);
  const body = 'M128 96 L 272 96 L 258 318 Q 256 330 244 330 H 156 Q 144 330 142 318 Z';
  const liquidTop = p.garnish === 'mango' ? 118 : 132;
  const liquid = `M${f(128 + (liquidTop - 96) * 0.063)} ${liquidTop} L ${f(272 - (liquidTop - 96) * 0.063)} ${liquidTop} L 257 314 Q 255 324 244 324 H 156 Q 145 324 143 314 Z`;
  const cubes =
    p.ice === 'cubes'
      ? [[170, 134, 12], [214, 150, -10], [186, 178, 22], [228, 196, 6], [168, 214, -16]].map(([x, y, a], i) => `<g transform="rotate(${a} ${x + 17} ${y + 17})" opacity="${i < 2 ? 0.95 : 0.55}"><rect x="${x}" y="${y}" width="34" height="34" rx="7" fill="url(#ice)"/><path d="M${x + 5} ${y + 8} q 10 -5 22 0" stroke="#fff" stroke-width="2.5" fill="none" opacity=".9"/></g>`).join('')
      : p.ice === 'crushed'
        ? Array.from({ length: 34 }, () => `<path d="M${f(150 + r() * 100)} ${f(128 + r() * 70)} l ${f(4 + r() * 6)} ${f(-3 + r() * 6)} l ${f(-2 + r() * 4)} ${f(5 + r() * 4)} Z" fill="#fff" opacity="${f(0.5 + r() * 0.4)}"/>`).join('') +
          Array.from({ length: 6 }, (_, i) => `<ellipse cx="${f(160 + r() * 80)}" cy="${f(190 + r() * 100)}" rx="10" ry="5" fill="#3f8a34" opacity=".75" transform="rotate(${i * 40} 200 240)"/>`).join('')
        : `<path d="M140 ${liquidTop} Q 200 ${liquidTop - 16} 262 ${liquidTop}" fill="#ffe2a0"/><path d="M146 ${liquidTop + 4} q 54 -8 110 0" stroke="#fff" stroke-width="3" opacity=".5" fill="none"/>`;
  const bubbles = p.garnish === 'lime' || p.garnish === 'peach'
    ? Array.from({ length: 24 }, () => `<circle cx="${f(152 + r() * 96)}" cy="${f(150 + r() * 160)}" r="${f(1 + r() * 2.4)}" fill="#fff" opacity="${f(0.4 + r() * 0.4)}"/>`).join('')
    : '';
  const drops = Array.from({ length: 30 }, () => {
    const y = 140 + r() * 170, x = 146 + ((y - 96) / 222) * 0 + r() * 108;
    const rr = 1.5 + r() * 3.2;
    return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rr * 0.8)}" ry="${f(rr)}" fill="#fff" opacity=".55"/><ellipse cx="${f(x + rr * 0.2)}" cy="${f(y + rr * 0.3)}" rx="${f(rr * 0.5)}" ry="${f(rr * 0.6)}" fill="${p.liquid2}" opacity=".35"/>`;
  }).join('');
  const garnish =
    p.garnish === 'lime'
      ? `<g transform="translate(268 104)"><circle r="34" fill="#7fb236"/><circle r="30" fill="#d9ef9a"/><circle r="26" fill="#eaf7c2"/>${Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<path d="M0 0 L ${f(Math.cos(a) * 25)} ${f(Math.sin(a) * 25)}" stroke="#c8e27c" stroke-width="2"/>`; }).join('')}<circle r="4" fill="#fff"/></g>`
      : p.garnish === 'peach'
        ? `<g transform="translate(262 100) rotate(-20)"><path d="M-30 0 A 30 30 0 0 1 30 0 Z" fill="#f48f4a"/><path d="M-24 0 A 24 24 0 0 1 24 0 Z" fill="#fbc27a"/><path d="M-10 0 A 10 10 0 0 1 10 0 Z" fill="#e0703a"/></g>`
        : p.garnish === 'mango'
          ? `<g transform="translate(250 84) rotate(18)"><rect x="-2" y="-40" width="4" height="70" rx="2" fill="#d9b27a"/>${[0, 1, 2].map((i) => `<rect x="-10" y="${-38 + i * 20}" width="20" height="18" rx="4" fill="${i % 2 ? '#f6b02c' : '#fbc84c'}"/>`).join('')}</g>`
          : `<g transform="translate(248 88)">${[[-18, 0, -30], [0, -10, 10], [16, 2, 40], [-4, 10, -60]].map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><ellipse rx="16" ry="8" fill="#3f8f36"/><path d="M-14 0 H 14" stroke="#8fd07a" stroke-width="1.4"/></g>`).join('')}</g>`;
  return `
    <defs>
      <linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.liquid}"/><stop offset="1" stop-color="${p.liquid2}"/></linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".18" stop-color="#fff" stop-opacity=".08"/><stop offset=".8" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/></linearGradient>
      <linearGradient id="ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient>
      <clipPath id="glassClip"><path d="${body}"/></clipPath>
    </defs>
    ${shadow(200, 340, 96, 12, 0.5)}
    <ellipse cx="200" cy="334" rx="92" ry="16" fill="#8b6a48"/><ellipse cx="200" cy="330" rx="92" ry="16" fill="#c49a6a"/><ellipse cx="200" cy="330" rx="92" ry="16" filter="url(#fine)" opacity=".35"/>
    <ellipse cx="200" cy="334" rx="70" ry="10" fill="${p.liquid2}" opacity=".35" filter="url(#blur2)"/>
    <rect x="226" y="40" width="11" height="220" rx="5.5" fill="#17130f" transform="rotate(12 232 150)"/>
    <rect x="226" y="40" width="3" height="220" rx="1.5" fill="#fff" opacity=".25" transform="rotate(12 232 150)"/>
    <g clip-path="url(#glassClip)">
      <path d="${liquid}" fill="url(#liq)" opacity="${p.clear ? 0.92 : 1}"/>
      <rect x="120" y="96" width="160" height="240" filter="url(#fine)" opacity=".12"/>
      ${cubes}${bubbles}
    </g>
    <path d="${body}" fill="url(#glass)"/>
    <path d="${body}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.5"/>
    <ellipse cx="200" cy="96" rx="72" ry="7" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2.5"/>
    <path d="M144 112 L 156 312" stroke="#fff" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/>
    <path d="M256 120 L 248 250" stroke="#fff" stroke-opacity=".25" stroke-width="4" stroke-linecap="round"/>
    ${drops}
    ${garnish}`;
}

const DRAW: Record<FoodKind, (p: Palette) => string> = { burger, pizza, pasta, roll, drink };

export function foodArt(kind: FoodKind, variant: string): string {
  const p = VARIANTS[kind][variant];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 400" width="800" height="800">${defs(p)}${studio()}${DRAW[kind](p)}${finish()}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
