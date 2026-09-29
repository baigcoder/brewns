// @ts-nocheck
/* The hot drinks served in ceramic, built to match their photographs: the americano in a black stoneware mug with a
   spoon beside it, the cappuccino in a glossy black cup on its saucer, the flat white in a cup glazed cream over
   speckled black, and the mocha in a rustic black bowl under cocoa and chocolate curls. Each is a lathe-turned cup
   with a glaze painted per pixel, a drink surface painted to match (crema, rosetta, heart), a handle and a spoon. */
import type * as THREE from 'three';
import { Kit, assemble, blob, clamp01, draw, fbm, mix, paint, rng, scatter, surface, sweep } from './foodKit';
import type { VariantEngine } from './pdp3dEngine';

type Sel = Record<string, number>;
const TAU = Math.PI * 2;
const V = (T: typeof THREE, x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ── the cup ── */

/**
 * A lathe whose v runs along the profile by arc length (the stock lathe spaces v by point index), so a glaze painted
 * by height lands where it should. Returns the geometry and the v at each profile point.
 */
function turned(T: typeof THREE, kit: Kit, pts: number[][], seg = 96) {
  const g = kit.add(new T.LatheGeometry(pts.map((p) => new T.Vector2(p[0], p[1])), seg));
  const s = [0];
  for (let j = 1; j < pts.length; j++) s.push(s[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
  const vs = s.map((x) => x / s[s.length - 1]);
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setY(k, vs[k % pts.length]);
  return { geo: g, vs };
}

/**
 * A cup as one closed shell: foot, outside wall, rolled rim, inside wall and floor. `wall(t)` gives the outside
 * radius at height fraction t (0 at the foot, 1 at the rim). Returns the geometry, the v where the rim is (for the
 * glaze), the inner radius at a height, and the rim height.
 */
function cupShell(T: typeof THREE, kit: Kit, o: { h: number; wall: (t: number) => number; thick: number; foot: number }) {
  const { h, thick } = o;
  const N = 18;
  const out: number[][] = [[0, 0.004], [o.foot * 0.92, 0.004], [o.foot, 0.012]];
  for (let i = 1; i <= N; i++) out.push([o.wall(i / N), (i / N) * h]);
  const r1 = o.wall(1);
  const rim = [[r1 + thick * 0.15, h + thick * 0.35], [r1 - thick * 0.5, h + thick * 0.55], [r1 - thick, h]];
  const ins: number[][] = [];
  for (let i = N - 1; i >= 1; i--) ins.push([Math.max(0, o.wall(i / N) - thick), (i / N) * h + thick * 0.4 * (1 - i / N)]);
  const floorY = thick * 1.6;
  ins.push([o.wall(0.08) * 0.6, floorY], [0, floorY]);
  const pts = [...out, ...rim, ...ins];
  const { geo, vs } = turned(T, kit, pts);
  return {
    geo,
    rimV: vs[out.length + 1],
    innerR: (y: number) => Math.max(0, o.wall(clamp01(y / h)) - thick),
    h,
  };
}

type Glaze = (u: number, v: number, rimV: number) => number[];

/** Black stoneware: matte, with iron speckle and a faint brown bloom where the glaze ran thin. */
const stoneware: Glaze = (u, v, rimV) => {
  const n = fbm(u * 16, v * 10, 2, 4, 3);
  const speck = smoothstep(0.8, 0.9, fbm(u * 120, v * 70, 5, 2, 7));
  const thin = smoothstep(0.55, 0.8, fbm(u * 5, v * 3, 1, 3, 9)) * 0.4 + smoothstep(rimV - 0.03, rimV, v) * smoothstep(rimV + 0.03, rimV, v) * 0.6;
  let c = mix([22, 21, 20], [36, 33, 31], n);
  c = mix(c, [74, 56, 42], thin * 0.5);
  c = mix(c, [80, 74, 66], speck * 0.3);
  return [...c, 0.4 + n * 0.3 + speck * 0.3];
};

/** Glossy black glaze with a deep, even colour. */
const glossBlack: Glaze = (u, v) => {
  const n = fbm(u * 10, v * 8, 4, 3, 5);
  const c = mix([14, 13, 13], [26, 24, 23], n);
  return [...c, 0.5];
};

/** Cream glaze poured over speckled black clay: the cream stops in an uneven line with runs down into the black. */
const creamOverBlack: Glaze = (u, v, rimV) => {
  const inside = v > rimV;
  // The cream stops in a soft, wandering line, with a few runs dripping lower.
  const line = 0.8 + (fbm(u * 6, 0, 3, 3, 4) - 0.5) * 0.2 - Math.pow(smoothstep(0.55, 0.8, fbm(u * 14, 0, 6, 2, 8)), 2) * 0.14;
  const vv = inside ? 1 : v / rimV;
  const cream = inside ? 1 : smoothstep(line - 0.025, line + 0.01, vv);
  const speck = smoothstep(0.72, 0.86, fbm(u * 140, v * 90, 5, 2, 7));
  let c = mix([30, 27, 25], [52, 46, 42], fbm(u * 20, v * 20, 2, 3, 2));
  c = mix(c, [150, 140, 128], speck * 0.35);
  let top = mix([214, 202, 182], [196, 182, 160], fbm(u * 12, v * 12, 1, 3, 3));
  top = mix(top, [120, 96, 70], speck * 0.4);
  // Where the cream thins over the rim edge it goes toasty brown.
  top = mix(top, [150, 104, 62], smoothstep(rimV - 0.02, rimV, v) * smoothstep(rimV + 0.025, rimV, v) * 0.8);
  c = mix(c, top, cream);
  return [...c, 0.45 + speck * 0.3 + (1 - cream) * 0.2];
};

/** Rustic black: a heavy glaze mottled with rust brown, pooled darker at the foot. */
const rusticBlack: Glaze = (u, v, rimV) => {
  const n = fbm(u * 8, v * 6, 2, 4, 11);
  const rust = smoothstep(0.55, 0.78, fbm(u * 14, v * 9, 3, 3, 13));
  let c = mix([20, 18, 17], [40, 34, 30], n);
  c = mix(c, [88, 58, 36], rust * 0.55 * (v < rimV ? 1 : 0.3));
  c = mix(c, [10, 9, 9], smoothstep(0.25, 0.0, v) * 0.6);
  return [...c, 0.3 + n * 0.4 + rust * 0.3];
};

/* ── the drink's surface ── */

/** Americano crema: golden with tiger striping swirled round it, darker at the edge where it meets the cup. */
const cremaSurface = (T: typeof THREE, kit: Kit, dark: boolean) =>
  paint(T, kit, 384, 384, (u, v) => {
    const x = u * 2 - 1, y = v * 2 - 1;
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const swirl = 0.5 + 0.5 * Math.sin(a * 3 + r * 9 + fbm(x * 3, y * 3, 1, 3, 5) * 7);
    const fleck = smoothstep(0.62, 0.8, fbm(x * 30, y * 30, 2, 2, 8));
    let c = mix([196, 136, 70], [150, 92, 40], swirl * 0.6);
    c = mix(c, [226, 176, 110], smoothstep(0.5, 0.0, r) * 0.35 * (1 - swirl));
    c = mix(c, [92, 50, 20], fleck * 0.35);
    c = mix(c, [60, 32, 14], smoothstep(0.72, 0.98, r));
    if (dark) c = mix(c, [70, 40, 18], 0.35);
    // Fine bubbles caught at the edge.
    const bub = smoothstep(0.8, 0.92, fbm(x * 60, y * 60, 3, 2, 3)) * smoothstep(0.7, 0.95, r);
    c = mix(c, [236, 206, 160], bub * 0.6);
    return [...c, 0.5 + swirl * 0.2 + bub * 0.3];
  });

const heartPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 1.5, cy + s * 0.1, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.5, cy + s * 0.1, cx, cy + s * 0.95);
  ctx.closePath();
};

/**
 * Milk foam on espresso, poured as a rosetta (stacked wings under a small heart, pulled through) or a single heart,
 * with optional cocoa dusted over it.
 */
const foamArt = (T: typeof THREE, kit: Kit, o: { art: 'rosetta' | 'heart'; base: string[]; cocoa: number; seed: number }) =>
  draw(T, kit, 512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
    g.addColorStop(0, o.base[0]);
    g.addColorStop(0.72, o.base[1]);
    g.addColorStop(1, o.base[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const milk = '#f5ead8';
    ctx.filter = 'blur(3.5px)';
    ctx.fillStyle = milk;
    ctx.strokeStyle = milk;
    ctx.lineCap = 'round';
    if (o.art === 'rosetta') {
      // Wings from the bottom up, each narrower, drawn as thick arcs that bow downwards.
      for (let i = 0; i < 9; i++) {
        const y = 385 - i * 27;
        const wdt = 160 - i * 13 + Math.sin(i * 1.7) * 6;
        ctx.lineWidth = 19 - i * 0.8;
        ctx.beginPath();
        ctx.ellipse(256, y - 30, wdt, 44, 0, 0.18 * Math.PI, 0.82 * Math.PI);
        ctx.stroke();
      }
      heartPath(ctx, 256, 128, 34);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,90,50,0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(256, 100);
      ctx.lineTo(256, 420);
      ctx.stroke();
    } else {
      heartPath(ctx, 256, 250, 130);
      ctx.fill();
      ctx.fillStyle = o.base[0];
      heartPath(ctx, 256, 262, 82);
      ctx.fill();
      ctx.fillStyle = milk;
      heartPath(ctx, 256, 272, 48);
      ctx.fill();
    }
    ctx.filter = 'none';
    // Cocoa dusted through a shaker: dense fine grains, heavier towards the rim.
    const R = rng(o.seed);
    for (let i = 0; i < o.cocoa; i++) {
      const a = R() * TAU, r = Math.pow(R(), 0.6) * 256;
      ctx.fillStyle = `rgba(${60 + R() * 30},${30 + R() * 16},${14 + R() * 8},${0.25 + R() * 0.5})`;
      ctx.fillRect(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 1 + R() * 2.4, 1 + R() * 2.4);
    }
    // Microfoam sheen: tiny light specks.
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(255,245,225,${0.05 + R() * 0.1})`;
      ctx.fillRect(R() * w, R() * h, 1.5, 1.5);
    }
  });

/* ── handle, saucer, spoon ── */

/** A loop handle in the cup's xy plane on its +x side, flattened like a pulled strap. */
function handle(T: typeof THREE, kit: Kit, mat: THREE.Material, o: { x0: number; y0: number; y1: number; reach: number; r: number; flat?: number }) {
  const { x0, y0, y1, reach } = o;
  const pts = [
    V(T, x0 - 0.02, y1, 0), V(T, x0 + reach * 0.55, y1 + 0.01, 0), V(T, x0 + reach, y1 - (y1 - y0) * 0.22, 0),
    V(T, x0 + reach * 0.95, y0 + (y1 - y0) * 0.3, 0), V(T, x0 + reach * 0.45, y0, 0), V(T, x0 - 0.02, y0 + 0.01, 0),
  ];
  const geo = kit.add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 64, o.r, 14, false));
  geo.scale(1, 1, o.flat ?? 0.62);
  return new T.Mesh(geo, mat);
}

function saucer(T: typeof THREE, kit: Kit, mat: THREE.Material, r: number) {
  const pts = [[0, 0.004], [r * 0.34, 0.004], [r * 0.38, 0.016], [r * 0.46, 0.03], [r * 0.43, 0.036], [r * 0.4, 0.034], [r * 0.5, 0.036], [r * 0.9, 0.07], [r, 0.09], [r * 0.99, 0.1], [r * 0.93, 0.088], [r * 0.5, 0.05], [0, 0.046]];
  return new T.Mesh(turned(T, kit, pts, 96).geo, mat);
}

/** A teaspoon lying on its back: a shallow bowl and a handle that rises off the table and flares at the end. */
function spoon(T: typeof THREE, kit: Kit, mat: THREE.Material, len = 0.5) {
  const g = new T.Group();
  const bowlGeo = kit.add(new T.SphereGeometry(1, 28, 14, 0, TAU, Math.PI / 2, Math.PI / 2));
  bowlGeo.scale(len * 0.19, len * 0.065, len * 0.13);
  const bowl = new T.Mesh(bowlGeo, mat);
  bowl.position.y = len * 0.06;
  g.add(bowl);
  const curve = new T.CatmullRomCurve3([V(T, len * 0.12, len * 0.05, 0), V(T, len * 0.3, len * 0.085, 0), V(T, len * 0.62, len * 0.07, 0), V(T, len * 0.92, len * 0.035, 0)]);
  g.add(new T.Mesh(sweep(T, kit, curve, { width: len * 0.075, thick: len * 0.022, segs: 48 }), mat));
  const end = new T.Mesh(blob(T, kit, len * 0.075, len * 0.016, len * 0.055, { amp: 0, seg: 20 }), mat);
  end.position.set(len * 0.94, len * 0.034, 0);
  g.add(end);
  return g;
}

/* ── the four cups ── */

type CupSpec = {
  h: number;
  wall: (t: number) => number;
  thick: number;
  foot: number;
  glaze: Glaze;
  gloss: { roughness: number; clearcoat: number };
  fill: number;
  top: 'crema' | 'rosetta' | 'heart';
  foamBase?: string[];
  cocoa?: number;
  curls?: boolean;
  handle?: { at: [number, number]; reach: number; r: number };
  saucer?: number;
  spoon?: { color: number; roughness: number; len: number; on: 'table' | 'saucer' };
  sizes?: number[];
};

const CUPS: Record<string, CupSpec> = {
  // A straight-sided mug, a touch wider at the rim, with a generous handle.
  americano: {
    h: 0.52, thick: 0.03, foot: 0.25,
    wall: (t) => 0.255 + 0.03 * t + 0.012 * Math.sin(Math.PI * Math.min(1, t * 3)),
    glaze: stoneware, gloss: { roughness: 0.62, clearcoat: 0.08 },
    fill: 0.86, top: 'crema',
    handle: { at: [0.22, 0.78], reach: 0.17, r: 0.032 },
    spoon: { color: 0x2b2724, roughness: 0.38, len: 0.6, on: 'table' },
    sizes: [0.9, 1, 1.1],
  },
  // A tulip cup: a round belly narrowing slightly to the rim, on a saucer.
  cappuccino: {
    h: 0.36, thick: 0.022, foot: 0.13,
    wall: (t) => 0.14 + 0.2 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.55) - 0.01 * t,
    glaze: glossBlack, gloss: { roughness: 0.18, clearcoat: 0.9 },
    fill: 0.9, top: 'rosetta', foamBase: ['#a8703f', '#6e4222', '#3e2412'], cocoa: 2600,
    handle: { at: [0.42, 0.86], reach: 0.12, r: 0.022 },
    saucer: 0.58,
    spoon: { color: 0x303236, roughness: 0.3, len: 0.42, on: 'saucer' },
    sizes: [0.94, 1.06],
  },
  // A small round cup, cream glaze over speckled black.
  'flat-white': {
    h: 0.3, thick: 0.02, foot: 0.12,
    wall: (t) => 0.13 + 0.17 * Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.6),
    glaze: creamOverBlack, gloss: { roughness: 0.34, clearcoat: 0.55 },
    fill: 0.92, top: 'rosetta', foamBase: ['#c7925a', '#a06634', '#6a3e1c'], cocoa: 0,
    handle: { at: [0.42, 0.86], reach: 0.1, r: 0.019 },
    spoon: { color: 0xb48a48, roughness: 0.3, len: 0.34, on: 'table' },
  },
  // A wide rustic bowl, no handle, brimming with foam, cocoa and curls.
  mocha: {
    h: 0.42, thick: 0.03, foot: 0.12,
    wall: (t) => 0.13 + 0.3 * Math.sin(Math.min(1, t) * Math.PI * 0.5) + 0.015 * fbm(t * 4, 0, 0, 2, 3),
    glaze: rusticBlack, gloss: { roughness: 0.5, clearcoat: 0.25 },
    fill: 0.93, top: 'heart', foamBase: ['#8a5530', '#5e3419', '#3a1f0e'], cocoa: 9000, curls: true,
    sizes: [0.95, 1.05],
  },
};

export const isCeramicCup = (id: string) => id in CUPS;

export function createCeramicCupModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const spec = CUPS[id] || CUPS.americano;
  const seed = id.length * 7;

  const cup = new T.Group();
  inner.add(cup);
  const shell = cupShell(T, kit, spec);
  const glazeTex = paint(T, kit, 512, 512, (u, v) => spec.glaze(u, v, shell.rimV));
  const glazeMat = surface(T, kit, glazeTex, { physical: true, bumpScale: 0.8, roughness: spec.gloss.roughness, clearcoat: spec.gloss.clearcoat, clearcoatRoughness: 0.2, side: T.DoubleSide });
  glazeTex.map.wrapT = glazeTex.bump.wrapT = T.ClampToEdgeWrapping;
  cup.add(new T.Mesh(shell.geo, glazeMat));
  if (spec.handle) {
    const [a, b] = spec.handle.at;
    const x0 = spec.wall((a + b) / 2);
    // The handle takes the glaze colour of the wall it joins.
    const hMat = kit.add(new T.MeshPhysicalMaterial({ color: spec.glaze === creamOverBlack ? 0xd9ccb6 : 0x1e1c1b, roughness: spec.gloss.roughness, clearcoat: spec.gloss.clearcoat, clearcoatRoughness: 0.2 }));
    cup.add(handle(T, kit, hMat, { x0, y0: a * spec.h, y1: b * spec.h, reach: spec.handle.reach, r: spec.handle.r }));
  }

  // The drink's surface, with a slight meniscus up the wall.
  const level = spec.h * spec.fill;
  const rTop = shell.innerR(level);
  const topGeo = kit.add(new T.CircleGeometry(rTop, 72));
  topGeo.rotateX(-Math.PI / 2);
  const tp = topGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const r = Math.hypot(tp.getX(i), tp.getZ(i)) / rTop;
    tp.setY(i, smoothstep(0.85, 1, r) * 0.008 + (spec.top === 'crema' ? 0 : (1 - r * r) * 0.012));
  }
  topGeo.computeVertexNormals();
  let topMat: THREE.MeshPhysicalMaterial;
  let cremaDark = null, cremaLight = null;
  if (spec.top === 'crema') {
    cremaLight = cremaSurface(T, kit, false);
    cremaDark = cremaSurface(T, kit, true);
    topMat = surface(T, kit, cremaLight, { physical: true, roughness: 0.4, specularIntensity: 0.35, bumpScale: 0.4, envMapIntensity: 0.5 });
  } else {
    const art = foamArt(T, kit, { art: spec.top, base: spec.foamBase, cocoa: spec.cocoa ?? 0, seed });
    topMat = kit.add(new T.MeshPhysicalMaterial({ map: art, bumpMap: art, bumpScale: 0.6, roughness: 0.6, specularIntensity: 0.4, envMapIntensity: 0.5 }));
  }
  // The drink faces straight up into the key light: hold it down to the tone it has in the photograph.
  const topTone = spec.top === 'crema' ? 0.85 : 0.8;
  topMat.color.setScalar(topTone);
  const top = new T.Mesh(topGeo, topMat);
  top.position.y = level;
  top.rotation.y = Math.PI / 2 + 0.3;
  cup.add(top);

  // Chocolate curls heaped in the middle of the mocha.
  if (spec.curls) {
    // A shaving is a thin sheet of chocolate that rolled up as it was scraped: an open, curled-up tube.
    const curl = kit.add(new T.CylinderGeometry(0.014, 0.014, 0.075, 16, 1, true, 0, Math.PI * 1.7));
    curl.rotateZ(Math.PI / 2);
    const chocolate = kit.add(new T.MeshPhysicalMaterial({ color: 0x3a1c0e, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.3, side: T.DoubleSide }));
    scatter(T, kit, cup, curl, chocolate, 24, (i, r) => {
      const a = r() * TAU, d = Math.sqrt(r()) * rTop * 0.32;
      return { pos: [Math.cos(a) * d, level + 0.024 + (1 - d / (rTop * 0.32)) * 0.022 + r() * 0.012, Math.sin(a) * d], rot: [r() * TAU, r() * TAU, (r() - 0.5) * 0.8], scale: [0.7 + r() * 0.6, 0.8 + r() * 0.5, 0.8 + r() * 0.5] };
    }, seed + 3);
  }

  // Ice for the iced versions: a few cubes breaking the surface.
  const ice = scatter(T, kit, cup, kit.add(new T.BoxGeometry(0.075, 0.07, 0.075)), kit.add(new T.MeshPhysicalMaterial({ color: 0xe8f0f2, roughness: 0.08, transmission: 0.7, thickness: 0.05, ior: 1.31, transparent: true, opacity: 0.75 })), 4, (i, r) => {
    const a = (i / 4) * TAU + r(), d = rTop * 0.45;
    return { pos: [Math.cos(a) * d, level + 0.01, Math.sin(a) * d], rot: [r() * 0.6, r() * TAU, r() * 0.6] };
  }, seed + 5);
  ice.userData.noAO = true;

  let base = 0;
  if (spec.saucer) {
    // Glossy black, but the studio's back softbox would mirror across a flat saucer seen from the front: keep the
    // reflection soft and low, so it reads black with a sheen as in the photo.
    const sMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x121111, roughness: 0.28, specularIntensity: 0.3, envMapIntensity: 0.5 }));
    inner.add(saucer(T, kit, sMat, spec.saucer));
    base = 0.034;
  }
  cup.position.y = base;

  if (spec.spoon) {
    const sp = spoon(T, kit, kit.add(new T.MeshStandardMaterial({ color: spec.spoon.color, metalness: 1, roughness: spec.spoon.roughness })), spec.spoon.len);
    if (spec.spoon.on === 'saucer') {
      // In the saucer's well, in front of the cup, the handle riding up over the rim.
      sp.position.set(-0.12, 0.05, spec.saucer * 0.5);
      sp.rotation.set(0, -0.2, -0.07);
    } else {
      const r0 = spec.wall(0.2);
      sp.position.set(r0 + 0.06, 0, r0 * 0.6 + 0.05);
      sp.rotation.set(0, -0.75, 0);
    }
    inner.add(sp);
  }

  const apply = (s: Sel) => {
    const iced = s.temp === 1;
    ice.count = iced ? 4 : 0;
    if (cremaDark) {
      const t = s.shots === 1 ? cremaDark : cremaLight;
      topMat.map = t.map;
      topMat.bumpMap = t.bump;
      topMat.needsUpdate = true;
    }
    // Oat and almond pour a warmer, slightly darker foam.
    if (!cremaDark) topMat.color.setRGB(topTone, topTone * ([1, 0.97, 0.94][s.milk ?? 0] ?? 1), topTone * ([1, 0.92, 0.88][s.milk ?? 0] ?? 1));
    const k = spec.sizes?.[s.size ?? 0] ?? 1;
    cup.scale.set(k, k, k);
  };
  const piece = assemble(T, kit, inner, { sel, apply, steam: { count: 20, height: 0.02, on: (s) => s.temp !== 1 }, shadow: [1.5, 1.3], fill: 0.95 });
  // Opened from a little above, as the photographs are, so the art on the drink shows.
  piece.group.userData.viewPitch = 0.42;
  return piece;
}
