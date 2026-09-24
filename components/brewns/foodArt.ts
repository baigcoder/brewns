/**
 * Illustrations for the kitchen menu (burgers, pasta, rolls, pizza, coolers).
 * There are no photographs of these dishes, so each is drawn: flat shapes, soft
 * shading, one warm halo behind the food so it sits on the light menu cards and
 * the dark shop cards alike. Returned as an SVG data URI, used like a photo.
 */

export type FoodKind = 'burger' | 'pizza' | 'pasta' | 'roll' | 'drink';

type Palette = Record<string, string>;

const VARIANTS: Record<FoodKind, Record<string, Palette>> = {
  burger: {
    smash: { patty: '#5b2f1d', sauce: '#f4b53c', extra: 'cheese', halo: '#f6d9a8' },
    zinger: { patty: '#c8852f', sauce: '#fff3dc', extra: 'crumb', halo: '#f7d7a0' },
    bbq: { patty: '#3f2014', sauce: '#8a2a1a', extra: 'onion', halo: '#f1c9a0' },
  },
  pizza: {
    margherita: { top: 'basil', halo: '#f3d2b0' },
    fajita: { top: 'fajita', halo: '#f2cfa2' },
    pepperoni: { top: 'pepperoni', halo: '#f0c4a8' },
  },
  pasta: {
    alfredo: { sauce: '#f1dfb0', noodle: '#f4d58c', garnish: '#7fa843', halo: '#f3e2bd' },
    arrabbiata: { sauce: '#c8432c', noodle: '#f2c878', garnish: '#5f9b3a', halo: '#f2c7b6' },
    pesto: { sauce: '#7ea53c', noodle: '#efd07e', garnish: '#fff4d6', halo: '#dfe8bf' },
  },
  roll: {
    tikka: { wrap: '#e6bb72', fill: '#cf5f2c', fill2: '#f3d9d1', halo: '#f4d3a8' },
    behari: { wrap: '#dfb068', fill: '#6b3520', fill2: '#e8c48f', halo: '#efcfa4' },
    crispy: { wrap: '#f0dcaa', fill: '#d99a3e', fill2: '#8cc152', halo: '#f5e0ae' },
  },
  drink: {
    mint: { liquid: '#a8dc84', top: '#d6f2c0', garnish: 'mint', halo: '#d5ecc8', ice: '1' },
    peach: { liquid: '#ee9a4f', top: '#f6c08c', garnish: 'peach', halo: '#f7d5b4', ice: '1' },
    mango: { liquid: '#f6b53a', top: '#fbd57c', garnish: 'mango', halo: '#f8dfa6', ice: '' },
    lime: { liquid: '#dff2a9', top: '#f1fad6', garnish: 'lime', halo: '#e4f1c8', ice: '1' },
  },
};

const halo = (c: string) => `
  <defs>
    <radialGradient id="h" cx="50%" cy="46%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".72" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <circle cx="200" cy="200" r="190" fill="url(#h)"/>
  <ellipse cx="200" cy="330" rx="130" ry="14" fill="#000" opacity=".16"/>`;

function burger(p: Palette) {
  const seeds = [[150, 140, -20], [185, 128, 10], [222, 131, -8], [255, 146, 25], [168, 166, 30], [208, 158, -30], [242, 172, 5]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="3.4" fill="#fff4d8" transform="rotate(${r} ${x} ${y})"/>`)
    .join('');
  const extra =
    p.extra === 'cheese'
      ? `<path d="M78 236 H322 L310 250 L296 238 L280 262 L262 240 L240 256 L220 240 L196 266 L178 240 L156 256 L138 238 L116 258 L100 240 Z" fill="${p.sauce}"/>`
      : p.extra === 'onion'
        ? `<g fill="none" stroke="#e9b86a" stroke-width="7"><ellipse cx="130" cy="236" rx="26" ry="9"/><ellipse cx="196" cy="234" rx="30" ry="10"/><ellipse cx="266" cy="236" rx="26" ry="9"/></g><path d="M86 244 Q200 262 314 244" stroke="${p.sauce}" stroke-width="9" fill="none" stroke-linecap="round"/>`
        : `<path d="M92 238 Q140 252 170 240 T250 244 T312 238" stroke="${p.sauce}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  const crumb = p.extra === 'crumb' ? [100, 140, 180, 220, 260, 300].map((x, i) => `<circle cx="${x}" cy="${268 + (i % 2) * 6}" r="4" fill="#9c5f1f"/>`).join('') : '';
  return `
    <path d="M86 282 H314 Q322 282 320 294 L314 310 Q310 320 298 320 H102 Q90 320 86 310 L80 294 Q78 282 86 282 Z" fill="#cf8435"/>
    <rect x="80" y="282" width="240" height="10" rx="5" fill="#e8a354"/>
    <rect x="72" y="248" width="256" height="40" rx="20" fill="${p.patty}"/>
    ${crumb}
    <path d="M70 232 Q90 214 110 232 T150 232 T190 232 T230 232 T270 232 T310 232 T334 232 L330 244 H70 Z" fill="#79b544"/>
    ${extra}
    <path d="M78 224 Q76 116 200 108 Q324 116 322 224 Z" fill="#e39a45"/>
    <path d="M78 224 Q76 116 200 108 Q324 116 322 224 Z" fill="url(#shine)"/>
    <path d="M78 224 H322" stroke="#c77a2c" stroke-width="6" stroke-linecap="round"/>
    ${seeds}`;
}

function pizza(p: Palette) {
  const rnd = (seed: number) => {
    let s = seed;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  };
  const r = rnd(p.top.length * 97);
  const spots = (n: number, draw: (x: number, y: number, i: number) => string) =>
    Array.from({ length: n }, (_, i) => {
      const a = r() * Math.PI * 2, d = 20 + r() * 78;
      return draw(200 + Math.cos(a) * d, 196 + Math.sin(a) * d * 0.92, i);
    }).join('');
  const cheese = spots(14, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(10 + r() * 10).toFixed(1)}" fill="#f7d77e" opacity=".9"/>`);
  const tops =
    p.top === 'pepperoni'
      ? spots(11, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="#b3372a"/><circle cx="${(x - 4).toFixed(1)}" cy="${(y - 3).toFixed(1)}" r="3" fill="#8a2419"/>`)
      : p.top === 'fajita'
        ? spots(10, (x, y, i) => `<rect x="${(x - 11).toFixed(1)}" y="${(y - 8).toFixed(1)}" width="22" height="16" rx="5" fill="#d59a5c" transform="rotate(${i * 37} ${x.toFixed(1)} ${y.toFixed(1)})"/>`) +
          spots(9, (x, y, i) => `<path d="M${(x - 12).toFixed(1)} ${y.toFixed(1)} q12 -10 24 0" stroke="${i % 2 ? '#3f8f3a' : '#d8432f'}" stroke-width="6" fill="none" stroke-linecap="round"/>`)
        : spots(7, (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="#fbf4e4"/>`) +
          spots(8, (x, y, i) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="12" ry="6" fill="#3f8a34" transform="rotate(${i * 45} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
  return `
    <circle cx="200" cy="200" r="150" fill="#6b4125"/>
    <circle cx="200" cy="200" r="150" fill="url(#shine)" opacity=".4"/>
    <circle cx="200" cy="196" r="130" fill="#dc9444"/>
    <circle cx="200" cy="196" r="130" fill="none" stroke="#b8702c" stroke-width="3" stroke-dasharray="2 10"/>
    <circle cx="200" cy="196" r="112" fill="#c9452d"/>
    ${cheese}${tops}
    <g stroke="#7a3a1e" stroke-width="3" opacity=".35"><path d="M200 84 V308"/><path d="M103 140 L297 252"/><path d="M103 252 L297 140"/></g>`;
}

function pasta(p: Palette) {
  const noodles = Array.from({ length: 11 }, (_, i) => {
    const y = 150 + i * 9, w = 70 + Math.sin(i) * 20;
    return `<path d="M${200 - w} ${y} q ${w / 2} -22 ${w} 0 t ${w} 0" stroke="${p.noodle}" stroke-width="8" fill="none" stroke-linecap="round" opacity="${0.75 + (i % 3) * 0.1}"/>`;
  }).join('');
  return `
    <path d="M58 180 Q60 300 200 312 Q340 300 342 180 Z" fill="#f4f0e8"/>
    <path d="M58 180 Q60 300 200 312 Q340 300 342 180 Z" fill="#000" opacity=".06"/>
    <ellipse cx="200" cy="180" rx="142" ry="54" fill="#fbf8f2"/>
    <ellipse cx="200" cy="182" rx="122" ry="42" fill="${p.sauce}"/>
    <clipPath id="bowl"><ellipse cx="200" cy="182" rx="120" ry="40"/></clipPath>
    <g clip-path="url(#bowl)">${noodles}</g>
    <path d="M150 156 q40 -34 96 -6" stroke="${p.noodle}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="226" cy="160" rx="14" ry="7" fill="${p.garnish}" transform="rotate(-24 226 160)"/>
    <ellipse cx="244" cy="166" rx="12" ry="6" fill="${p.garnish}" transform="rotate(30 244 166)"/>
    ${[176, 190, 206, 168, 214].map((x, i) => `<circle cx="${x}" cy="${170 + (i % 3) * 8}" r="2.6" fill="#fff8e6"/>`).join('')}
    <g transform="rotate(28 300 150)"><rect x="294" y="60" width="10" height="130" rx="5" fill="#c9c4bb"/><rect x="286" y="54" width="26" height="28" rx="6" fill="#d8d3ca"/></g>`;
}

function roll(p: Palette) {
  return `
    <g transform="rotate(-24 200 200)">
      <rect x="70" y="160" width="270" height="86" rx="43" fill="${p.wrap}"/>
      <rect x="70" y="160" width="270" height="86" rx="43" fill="url(#shine)"/>
      ${[110, 150, 190, 230, 270].map((x, i) => `<circle cx="${x}" cy="${180 + (i % 2) * 44}" r="${5 + (i % 3)}" fill="#b98035" opacity=".55"/>`).join('')}
      <ellipse cx="330" cy="203" rx="22" ry="43" fill="#d8a45c"/>
      <ellipse cx="330" cy="203" rx="16" ry="35" fill="${p.fill}"/>
      <circle cx="326" cy="188" r="6" fill="${p.fill2}"/><circle cx="334" cy="212" r="5" fill="${p.fill2}"/><circle cx="324" cy="224" r="4" fill="#5c9d3c"/>
      <path d="M70 160 H176 V246 H70 Q56 203 70 160 Z" fill="#f4efe4"/>
      <path d="M176 160 V246" stroke="#d9d1c2" stroke-width="3"/>
      <text x="123" y="211" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="24" fill="#17130f" letter-spacing="-1">brewns</text>
    </g>`;
}

function drink(p: Palette) {
  const ice = p.ice
    ? `<g opacity=".55"><rect x="168" y="150" width="34" height="34" rx="7" fill="#fff" transform="rotate(12 185 167)"/><rect x="206" y="166" width="30" height="30" rx="7" fill="#fff" transform="rotate(-10 221 181)"/><rect x="180" y="198" width="28" height="28" rx="6" fill="#fff" transform="rotate(20 194 212)"/></g>`
    : `<path d="M150 150 Q200 132 250 150" stroke="#fff5da" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7"/>`;
  const garnish =
    p.garnish === 'lime'
      ? `<circle cx="262" cy="120" r="30" fill="#a6d157"/><circle cx="262" cy="120" r="24" fill="#e2f3a8"/><g stroke="#a6d157" stroke-width="3">${[0, 45, 90, 135].map((a) => `<path d="M262 120 l${(24 * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(24 * Math.sin((a * Math.PI) / 180)).toFixed(1)} M262 120 l${(-24 * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(-24 * Math.sin((a * Math.PI) / 180)).toFixed(1)}"/>`).join('')}</g>`
      : p.garnish === 'peach'
        ? `<path d="M236 108 q30 -26 54 6 q-24 22 -54 -6 Z" fill="#f4a261"/><path d="M240 108 q24 -14 44 4" stroke="#fbd3a8" stroke-width="4" fill="none"/>`
        : p.garnish === 'mango'
          ? `<path d="M232 112 q34 -30 58 0 q-10 20 -58 0 Z" fill="#f7b733"/><path d="M226 104 q0 -20 22 -24" stroke="#4f8f3a" stroke-width="5" fill="none"/>`
          : `<ellipse cx="238" cy="110" rx="18" ry="9" fill="#4f9b45" transform="rotate(-30 238 110)"/><ellipse cx="258" cy="104" rx="16" ry="8" fill="#63b057" transform="rotate(20 258 104)"/>`;
  return `
    <rect x="232" y="46" width="12" height="190" rx="6" fill="#17130f" transform="rotate(14 238 140)"/>
    <path d="M136 112 H264 L250 318 Q248 330 236 330 H164 Q152 330 150 318 Z" fill="#fff" opacity=".28"/>
    <path d="M142 140 H258 L248 314 Q246 324 236 324 H164 Q154 324 152 314 Z" fill="${p.liquid}"/>
    <path d="M142 140 H258 L256 160 H144 Z" fill="${p.top}"/>
    ${ice}
    ${p.garnish === 'lime' ? [170, 196, 224, 184, 212].map((x, i) => `<circle cx="${x}" cy="${230 + i * 16}" r="${3 + (i % 2)}" fill="#fff" opacity=".7"/>`).join('') : ''}
    <path d="M136 112 H264 L250 318 Q248 330 236 330 H164 Q152 330 150 318 Z" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3"/>
    <path d="M150 124 L162 312" stroke="#fff" stroke-opacity=".55" stroke-width="6" stroke-linecap="round"/>
    ${garnish}`;
}

const DRAW: Record<FoodKind, (p: Palette) => string> = { burger, pizza, pasta, roll, drink };

export function foodArt(kind: FoodKind, variant: string): string {
  const p = VARIANTS[kind][variant];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">${halo(p.halo)}${DRAW[kind](p)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
