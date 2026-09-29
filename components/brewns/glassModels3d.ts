// @ts-nocheck
/* The drinks served in tall glasses, built to match their photographs: the four coolers in highballs with their
   garnish (mint margarita, peach iced tea, mango smoothie, fresh lime soda) and the Spanish latte, layered over ice on
   a saucer. The glass is real glass (transmission), so what sits inside it has to be solid for the glass to show it:
   the drink is a painted body a little inside the wall, and the ice and fruit are pressed between it and the glass,
   where a photograph sees them. */
import type * as THREE from 'three';
import { Kit, assemble, blob, clamp01, draw, fbm, lathe, leaf, mix, paint, rng, roundBox, scatter, surface, sweep } from './foodKit';
import { glassShell } from './drinkModels3d';
import { saucer, spoon } from './cupModels3d';
import type { VariantEngine } from './pdp3dEngine';

type Sel = Record<string, number>;
const TAU = Math.PI * 2;
const V = (T: typeof THREE, x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ── the drink ── */

/**
 * The drink's body: a wall of revolution from y0 to y1 whose v is its height (so a painted gradient or layering
 * lands at the right height), closed top and bottom. `r(y)` is its radius.
 */
function drinkBody(T: typeof THREE, kit: Kit, r: (y: number) => number, y0: number, y1: number, side: THREE.Material, top: THREE.Material) {
  const g = new T.Group();
  const N = 24;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N;
    pts.push(new T.Vector2(r(y), y));
  }
  g.add(new T.Mesh(kit.add(new T.LatheGeometry(pts, 80)), side));
  const cap = (y: number, mat: THREE.Material, up: boolean) => {
    const c = kit.add(new T.CircleGeometry(r(y), 64));
    c.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
    const m = new T.Mesh(c, mat);
    m.position.y = y;
    g.add(m);
    return m;
  };
  cap(y0, side, false);
  const lid = cap(y1, top, true);
  return { group: g, top: lid };
}

/** A vertical texture for the body: `fn(u, v)` with v up the glass. */
const bodyLook = (T: typeof THREE, kit: Kit, fn: (u: number, v: number) => number[], o: Record<string, unknown> = {}) =>
  surface(T, kit, paint(T, kit, 256, 256, fn), { physical: true, roughness: 0.25, clearcoat: 0.4, clearcoatRoughness: 0.2, bumpScale: 0.6, specularIntensity: 0.5, ...o });

/* ── what goes in and on the glass ── */

/** Ice cubes, rounded by melting, tinted by the drink round them. Solid, so the glass shows them. */
function iceCubes(T: typeof THREE, kit: Kit, parent: THREE.Object3D, tint: number, place: (i: number, r: () => number) => number[], count: number, seed: number) {
  const geo = roundBox(T, kit, 0.11, 0.1, 0.11, 0.022, 6);
  // Clear at the edges (the drink's colour shows through), frosted in the core where the air froze in, with cracks.
  const tex = paint(T, kit, 64, 64, (u, v) => {
    const n = fbm(u * 6, v * 6, 2, 3, seed);
    const core = smoothstep(0.42, 0.1, Math.hypot(u - 0.5, v - 0.5)) * (0.6 + n * 0.4);
    const crack = smoothstep(0.47, 0.5, n) * smoothstep(0.53, 0.5, n);
    const c = mix([214, 214, 214], [255, 255, 255], core * 0.8 + crack * 0.6);
    return [...c, 0.5 + crack * 0.5];
  });
  const mat = surface(T, kit, tex, { physical: true, color: tint, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, bumpScale: 1, envMapIntensity: 1.4 });
  return scatter(T, kit, parent, geo, mat, count, (i, r) => ({ pos: place(i, r), rot: [r() * 0.8, r() * TAU, r() * 0.8], scale: 0.8 + r() * 0.35 }), seed);
}

/** A slice of citrus as a wheel: rind, pith and segments painted on its faces. */
function citrusWheel(T: typeof THREE, kit: Kit, r: number, rind: string, flesh: string, thick = 0.018) {
  const face = draw(T, kit, 256, 256, (ctx) => {
    ctx.fillStyle = rind;
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f4f2dc';
    ctx.beginPath();
    ctx.arc(128, 128, 116, 0, TAU);
    ctx.fill();
    const R = rng(4);
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * TAU + 0.03, a1 = ((k + 1) / 10) * TAU - 0.03;
      ctx.fillStyle = flesh;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos((a0 + a1) / 2) * 10, 128 + Math.sin((a0 + a1) / 2) * 10);
      ctx.arc(128, 128, 106, a0, a1);
      ctx.closePath();
      ctx.fill();
      // Juice vesicles.
      for (let s = 0; s < 14; s++) {
        const a = a0 + R() * (a1 - a0), d = 20 + R() * 80;
        ctx.fillStyle = `rgba(255,255,230,${0.2 + R() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 5, 2, a, 0, TAU);
        ctx.fill();
      }
    }
  });
  const faceMat = kit.add(new T.MeshPhysicalMaterial({ map: face, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }));
  const rindMat = kit.add(new T.MeshPhysicalMaterial({ color: new T.Color(rind), roughness: 0.4, clearcoat: 0.4 }));
  const geo = kit.add(new T.CylinderGeometry(r, r, thick, 40));
  return new T.Mesh(geo, [rindMat, faceMat, faceMat]);
}

/** A wedge cut from a round fruit: a segment of the sphere, skin round the outside and flesh on its two cut faces. */
function fruitWedge(T: typeof THREE, kit: Kit, r: number, angle: number, skin: number, flesh: number) {
  const g = new T.Group();
  const fleshMat = kit.add(new T.MeshPhysicalMaterial({ color: flesh, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, side: T.DoubleSide }));
  const skinMat = kit.add(new T.MeshPhysicalMaterial({ color: skin, roughness: 0.45, clearcoat: 0.2, side: T.DoubleSide }));
  g.add(new T.Mesh(kit.add(new T.SphereGeometry(r, 16, 20, 0, angle)), skinMat));
  // A cut face is a half disc in the plane through the axis at the segment's edge.
  for (const phi of [0, angle]) {
    const face = kit.add(new T.CircleGeometry(r * 0.985, 20, Math.PI / 2, Math.PI));
    face.rotateY(phi);
    g.add(new T.Mesh(face, fleshMat));
  }
  // Squashed a little: a wedge is longer than it is deep.
  g.scale.set(1, 1.25, 1);
  return g;
}

/** A sprig of mint: a stem with pairs of leaves, smaller towards the tip. */
export function mintSprig(T: typeof THREE, kit: Kit, size = 1, seed = 3) {
  const g = new T.Group();
  const mat = kit.add(new T.MeshPhysicalMaterial({ color: 0x3f9a3a, roughness: 0.45, sheen: 0.4, sheenColor: new T.Color(0xc8f0b0), side: T.DoubleSide }));
  const young = kit.add(new T.MeshPhysicalMaterial({ color: 0x62b84c, roughness: 0.45, sheen: 0.4, sheenColor: new T.Color(0xd8f8c0), side: T.DoubleSide }));
  const R = rng(seed);
  const pairs = 4;
  for (let k = 0; k < pairs; k++) {
    const s = (1 - k * 0.2) * size;
    const geo = leaf(T, kit, 0.13 * s, 0.085 * s, 0.3);
    for (const side of [-1, 1]) {
      const m = new T.Mesh(geo, k === pairs - 1 ? young : mat);
      m.position.y = k * 0.03 * size;
      m.rotation.set(-0.5 + R() * 0.3, (k % 2 ? Math.PI / 2 : 0) + (side < 0 ? Math.PI : 0) + (R() - 0.5) * 0.4, 0);
      g.add(m);
    }
  }
  const stem = new T.Mesh(kit.add(new T.CylinderGeometry(0.004 * size, 0.005 * size, 0.13 * size, 6)), mat);
  stem.position.y = 0.03 * size;
  g.add(stem);
  return g;
}

/** A drinking straw: a tube along a path, clear, black or steel. */
function straw(T: typeof THREE, kit: Kit, pts: number[][], mat: THREE.Material, r = 0.014) {
  const m = new T.Mesh(kit.add(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => V(T, ...p))), 48, r, 12, false)), mat);
  m.userData.noShadow = false;
  return m;
}

/** Condensation beaded on the outside of a cold glass. */
function beads(T: typeof THREE, kit: Kit, parent: THREE.Object3D, outerR: (y: number) => number, y0: number, y1: number, count: number, seed: number) {
  const geo = kit.add(new T.SphereGeometry(0.0045, 8, 6));
  const mat = kit.add(new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.28, depthWrite: false }));
  const m = scatter(T, kit, parent, geo, mat, count, (i, r) => {
    const a = r() * TAU, y = y0 + r() * (y1 - y0), rad = outerR(y) + 0.003;
    return { pos: [Math.sin(a) * rad, y, Math.cos(a) * rad], scale: [1, 1 + r() * 1.2, 0.5] };
  }, seed);
  m.userData.noShadow = true;
  m.userData.noAO = true;
  return m;
}

/* ── the drinks ── */

type Look = {
  glass: { rb: number; rt: number; h: number; wall: number; base: number };
  fill: number;
  body: (u: number, v: number, sel: Sel) => number[];
  top: number;
  ice: number;
  iceTint: number;
  garnish: (T: typeof THREE, kit: Kit, g: { inner: THREE.Group; glass: THREE.Group; rim: number; h: number; innerR: (y: number) => number; level: number }) => void;
  saucer?: boolean;
  steamOn?: (s: Sel) => boolean;
  tone?: (s: Sel) => number;
};

const highball = { rb: 0.19, rt: 0.215, h: 0.95, wall: 0.018, base: 0.09 };

const LOOKS: Record<string, Look> = {
  // Blended mint and lime with crushed ice: bright green slush flecked with mint, frosty at the top.
  'mint-margarita': {
    glass: highball, fill: 0.9, ice: 0, iceTint: 0xe6f6dc, top: 0xd8efc4,
    body: (u, v) => {
      const n = fbm(u * 18, v * 30, 1, 3, 3);
      const fleck = smoothstep(0.66, 0.74, fbm(u * 60, v * 90, 2, 2, 5));
      const ice = smoothstep(0.6, 0.72, fbm(u * 30, v * 40, 3, 2, 7));
      let c = mix([118, 196, 60], [84, 164, 40], n);
      c = mix(c, [204, 236, 170], ice * 0.6 + smoothstep(0.8, 1, v) * 0.5);
      c = mix(c, [36, 104, 30], fleck * 0.8);
      return [...c, 0.3 + ice * 0.5 + n * 0.2];
    },
    garnish: (T, kit, g) => {
      const wheel = citrusWheel(T, kit, 0.085, '#4f8f26', '#c6e27e');
      wheel.rotation.set(Math.PI / 2, 0, 0.35);
      wheel.position.set(g.innerR(g.h) * 0.62, g.rim + 0.035, 0.06);
      g.glass.add(wheel);
      const sprig = mintSprig(T, kit, 1.3, 5);
      sprig.position.set(-0.05, g.level + 0.03, 0.02);
      g.glass.add(sprig);
      g.glass.add(straw(T, kit, [[0.06, g.level - 0.4, -0.05], [0.07, g.rim + 0.05, -0.08], [0.1, g.rim + 0.26, -0.13]], kit.add(new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.45 })), 0.014));
    },
  },
  // Black tea over ice: clear amber, darker below, with peach slices and cubes against the glass.
  'peach-iced-tea': {
    glass: highball, fill: 0.88, ice: 8, iceTint: 0xf0a868, top: 0xc98a3e,
    body: (u, v, s) => {
      const n = fbm(u * 5, v * 8, 2, 3, 5);
      const sweet = [0.92, 1, 1.08][s.sweet ?? 1] ?? 1;
      let c = mix([150, 66, 18], [214, 128, 48], smoothstep(0, 1, v));
      c = mix(c, [236, 168, 84], n * 0.25);
      return [c[0] * sweet, c[1] * sweet, c[2], 0.5];
    },
    garnish: (T, kit, g) => {
      const slice = () => fruitWedge(T, kit, 0.075, 0.9, 0xd4552a, 0xf6a642);
      // Slices sunk in the tea against the glass, and one hooked on the rim.
      for (const [a, y] of [[0.3, 0.3], [2.4, 0.5], [4.2, 0.24], [1.3, 0.62]]) {
        const s = slice();
        const r = g.innerR(y) - 0.03;
        s.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        s.rotation.set(0.2, a + Math.PI / 2, 0.4 + a);
        g.inner.add(s);
      }
      const rim = slice();
      rim.scale.multiplyScalar(1.2);
      rim.position.set(g.innerR(g.h) * 0.9, g.rim + 0.02, 0.05);
      rim.rotation.set(0, -0.3, Math.PI / 2 + 0.15);
      g.glass.add(rim);
      const sprig = mintSprig(T, kit, 1.1, 8);
      sprig.position.set(-0.06, g.level + 0.02, -0.04);
      g.glass.add(sprig);
    },
  },
  // Mango blended with yogurt: thick, opaque, sunny, with a steel straw and the fruit beside the glass.
  'mango-smoothie': {
    glass: { rb: 0.2, rt: 0.215, h: 0.82, wall: 0.018, base: 0.08 }, fill: 0.84, ice: 0, iceTint: 0xffffff, top: 0xf6b73a,
    body: (u, v, s) => {
      const n = fbm(u * 10, v * 14, 4, 3, 2);
      const oat = s.milk === 1 ? 0.25 : 0;
      let c = mix([248, 176, 30], [252, 198, 64], n);
      c = mix(c, [252, 220, 140], oat);
      c = mix(c, [252, 214, 110], smoothstep(0.85, 1, v) * 0.4);
      return [...c, 0.4 + n * 0.3];
    },
    tone: () => 0.95,
    garnish: (T, kit, g) => {
      const steel = kit.add(new T.MeshStandardMaterial({ color: 0xd6d8dc, metalness: 1, roughness: 0.18 }));
      g.glass.add(straw(T, kit, [[0.04, g.level - 0.35, 0], [0.06, g.rim + 0.08, 0.01], [0.12, g.rim + 0.2, 0.02], [0.26, g.rim + 0.25, 0.03]], steel, 0.012));
      // A whole mango, green at the stalk blushing to red, lying beside the glass.
      const skin = paint(T, kit, 256, 128, (u, v) => {
        const n = fbm(u * 6, v * 4, 1, 3, 4);
        let c = mix([96, 150, 46], [236, 190, 54], smoothstep(0.1, 0.55, u + n * 0.2));
        c = mix(c, [214, 72, 34], smoothstep(0.55, 0.95, u + (n - 0.5) * 0.3) * 0.8);
        const dot = smoothstep(0.82, 0.9, fbm(u * 80, v * 40, 3, 2, 6));
        c = mix(c, [246, 230, 170], dot * 0.4);
        return [...c, 0.5 + n * 0.2];
      });
      const mango = new T.Mesh(blob(T, kit, 0.2, 0.13, 0.14, { amp: 0.01, freq: 3, seed: 3, seg: 48 }), surface(T, kit, skin, { physical: true, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3, bumpScale: 0.5 }));
      mango.position.set(-0.4, 0.12, 0.12);
      mango.rotation.set(0, 0.5, 0.15);
      g.inner.add(mango);
      // And a cheek cut hedgehog style, its cubes pushed out.
      const flesh = kit.add(new T.MeshPhysicalMaterial({ color: 0xf5a623, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }));
      const cheek = new T.Mesh(blob(T, kit, 0.13, 0.05, 0.1, { amp: 0.004, freq: 6, seed: 5, seg: 32 }), kit.add(new T.MeshPhysicalMaterial({ color: 0xc9a02a, roughness: 0.4 })));
      cheek.position.set(-0.3, 0.035, 0.34);
      g.inner.add(cheek);
      scatter(T, kit, cheek, roundBox(T, kit, 0.04, 0.05, 0.04, 0.008, 3), flesh, 16, (i) => {
        const x = (i % 4) - 1.5, z = Math.floor(i / 4) - 1.5;
        const d = Math.hypot(x / 2, z / 2.2);
        return { pos: [x * 0.052, 0.045 - d * 0.02, z * 0.042], rot: [z * 0.25, 0, -x * 0.25], scale: d > 1 ? 0.001 : 1 };
      }, 3);
    },
  },
  // Lime over soda with ice: pale and fizzy, lime wheels and mint against the glass, a wedge beside it.
  'lime-soda': {
    glass: highball, fill: 0.9, ice: 11, iceTint: 0xe2f0d4, top: 0xe8f2d6,
    body: (u, v, s) => {
      const n = fbm(u * 6, v * 10, 2, 3, 9);
      const bubble = smoothstep(0.78, 0.86, fbm(u * 70, v * 110, 5, 2, 3));
      const cloud = s.style === 1 ? 0.15 : s.style === 2 ? 0.08 : 0;
      let c = mix([214, 234, 196], [232, 244, 220], n);
      c = mix(c, [236, 238, 226], cloud);
      c = mix(c, [255, 255, 255], bubble * 0.7);
      return [...c, 0.4 + bubble * 0.6];
    },
    garnish: (T, kit, g) => {
      for (const [a, y] of [[0.2, 0.28], [2.2, 0.5], [4.4, 0.66], [1.1, 0.72]]) {
        const w = citrusWheel(T, kit, 0.075, '#4d9a22', '#c9e67c');
        const r = g.innerR(y) - 0.02;
        w.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        w.rotation.set(Math.PI / 2, 0, -a);
        w.rotateX(0.2);
        g.inner.add(w);
      }
      const sprig = mintSprig(T, kit, 1.2, 11);
      sprig.position.set(0.02, g.level + 0.03, 0);
      g.glass.add(sprig);
      // Lying on its skin, cut faces up.
      const wedge = fruitWedge(T, kit, 0.075, 1.1, 0x3f8f1e, 0xd6ec9a);
      wedge.position.set(0.36, 0.06, 0.22);
      wedge.rotation.set(Math.PI / 2, 0.55 - Math.PI / 2, 0.5);
      g.inner.add(wedge);
      const loose = mintSprig(T, kit, 1.1, 13);
      loose.position.set(-0.36, 0.01, 0.2);
      loose.rotation.set(Math.PI / 2 - 0.1, 0, 0.8);
      g.inner.add(loose);
    },
  },
  // Condensed milk and cold milk under espresso: cream below, coffee above, marbled where they meet, over ice.
  'spanish-latte': {
    glass: { rb: 0.16, rt: 0.2, h: 0.88, wall: 0.016, base: 0.07 }, fill: 0.9, ice: 6, iceTint: 0xc8a684, top: 0x6a3e1e, saucer: true,
    body: (u, v, s) => {
      const sweet = [0.3, 0.38, 0.46][s.sweet ?? 1] ?? 0.38;
      const swirl = (fbm(u * 5, v * 3, 2, 3, 4) - 0.5) * 0.22;
      const t = smoothstep(sweet - 0.12, sweet + 0.22, v + swirl);
      const milk = mix([240, 226, 200], [228, 206, 170], smoothstep(0, sweet, v));
      let c = mix(milk, [74, 40, 18], t);
      c = mix(c, [126, 76, 38], t * (1 - t) * 3 * 0.4);
      return [...c, 0.5];
    },
    steamOn: (s) => s.temp === 1,
    garnish: (T, kit, g) => {},
  },
};

export const isTallGlass = (id: string) => id in LOOKS;

export function createTallGlassModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const look = LOOKS[id] || LOOKS['lime-soda'];
  const seed = id.length * 11;

  const glassGroup = new T.Group();
  inner.add(glassGroup);
  const shell = glassShell(T, kit, look.glass);
  const level = look.glass.base + (look.glass.h - look.glass.base) * look.fill;
  const bodyR = (y: number) => shell.innerR(y) - (look.ice || id === 'lime-soda' || id === 'peach-iced-tea' ? 0.035 : 0.002);

  // The body is repainted when an option changes its colour, so paint lazily and keep one texture per look.
  let key = '';
  const sideMat = bodyLook(T, kit, (u, v) => look.body(u, v, sel));
  const topMat = kit.add(new T.MeshPhysicalMaterial({ color: look.top, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, specularIntensity: 0.5 }));
  const body = drinkBody(T, kit, bodyR, look.glass.base + 0.004, level, sideMat, topMat);
  glassGroup.add(body.group);
  // The same drink fills the gap between the body and the glass above the ice, so the level reads as one line.
  if (bodyR(level) < shell.innerR(level) - 0.01) {
    const ring = new T.Mesh(kit.add(new T.RingGeometry(bodyR(level) - 0.001, shell.innerR(level) - 0.001, 64)), topMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = level;
    glassGroup.add(ring);
    // And a thin skin of it down the wall, tinted like the drink, so the ice sits in colour rather than in air.
    const wall = new T.Mesh(kit.add(new T.CylinderGeometry(shell.innerR(level) - 0.004, shell.innerR(look.glass.base) - 0.004, level - look.glass.base, 64, 1, true)), kit.add(new T.MeshPhysicalMaterial({ color: look.top, roughness: 0.2, transparent: true, opacity: 0.25, depthWrite: false })));
    wall.position.y = (level + look.glass.base) / 2;
    wall.userData.noAO = true;
    glassGroup.add(wall);
  }

  // Ice pressed between the drink and the glass, stacked up to just above the surface.
  let ice = null;
  if (look.ice) {
    ice = iceCubes(T, kit, glassGroup, look.iceTint, (i, r) => {
      const a = (i / look.ice) * TAU * 1.6 + r() * 0.6;
      const y = look.glass.base + 0.08 + (i / look.ice) * (level - look.glass.base - 0.02);
      const rad = shell.innerR(y) - 0.055;
      return [Math.sin(a) * rad, y, Math.cos(a) * rad];
    }, look.ice, seed);
  }
  glassGroup.add(shell.mesh);
  beads(T, kit, glassGroup, (y) => shell.innerR(y) + look.glass.wall + 0.002, look.glass.base + 0.05, level, 70, seed + 1);

  look.garnish(T, kit, { inner, glass: glassGroup, rim: look.glass.h, h: look.glass.h, innerR: shell.innerR, level });

  if (look.saucer) {
    const sMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x121111, roughness: 0.28, specularIntensity: 0.3, envMapIntensity: 0.5 }));
    inner.add(saucer(T, kit, sMat, 0.44));
    glassGroup.position.y = 0.046;
    const sp = spoon(T, kit, kit.add(new T.MeshStandardMaterial({ color: 0x9a9da2, metalness: 1, roughness: 0.25 })), 0.46);
    sp.position.set(0.1, 0.05, 0.28);
    sp.rotation.set(0, -0.9, -0.05);
    inner.add(sp);
  }

  const apply = (s: Sel) => {
    const next = JSON.stringify([s.sweet, s.milk, s.style]);
    if (next !== key) {
      key = next;
      const tex = paint(T, kit, 256, 256, (u, v) => look.body(u, v, s));
      sideMat.map = tex.map;
      sideMat.bumpMap = tex.bump;
      sideMat.needsUpdate = true;
    }
    const tone = look.tone?.(s) ?? 0.9;
    sideMat.color.setScalar(tone);
    // Hot Spanish latte: no ice.
    if (ice) ice.count = id === 'spanish-latte' && s.temp === 1 ? 0 : look.ice;
    const k = s.size === 1 ? 1.08 : 1;
    glassGroup.scale.set(1, k, 1);
  };
  const piece = assemble(T, kit, inner, { sel, apply, steam: look.steamOn ? { count: 16, height: 0.02, on: look.steamOn } : undefined, shadow: [1.3, 1.2] });
  piece.group.userData.viewPitch = 0.12;
  return piece;
}

/* ── iced matcha and iced latte: the printed takeaway cup ── */

/** The cup's wraparound print: a watercolour wash with leaves round the sides, a cream shield on the front with the
    wordmark, the drink's name and the signature. Transparent above and below the print, so the drink shows. */
function cupPrint(T: typeof THREE, kit: Kit, look: { name: string; tag: string[]; wash: string[]; leaf: string[]; ink: string; bean?: boolean }) {
  return draw(T, kit, 2048, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const top = h * 0.07, bottom = h * 0.93;
    const R = rng(look.name.length * 17);
    // Watercolour wash: soft layered blots, blurred, clipped to the printed band with ragged edges.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, top + 18);
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, top + 10 + Math.sin(x * 0.02) * 8 + R() * 14);
    for (let x = w; x >= 0; x -= 32) ctx.lineTo(x, bottom - 10 - Math.sin(x * 0.017) * 8 - R() * 14);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = look.wash[0];
    ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(18px)';
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = look.wash[1 + (i % (look.wash.length - 1))];
      ctx.globalAlpha = 0.3 + R() * 0.35;
      ctx.beginPath();
      ctx.ellipse(R() * w, top + R() * (bottom - top), 40 + R() * 160, 30 + R() * 110, R() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    // Leaves on long stems, painted in two or three tones with a vein.
    const leafAt = (x: number, y: number, ang: number, len: number, tone: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = tone;
      ctx.globalAlpha = 0.75 + R() * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(len * 0.35, -len * 0.28, len * 0.8, -len * 0.18, len, 0);
      ctx.bezierCurveTo(len * 0.8, len * 0.18, len * 0.35, len * 0.28, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(len * 0.05, 0);
      ctx.lineTo(len * 0.92, 0);
      ctx.stroke();
      ctx.restore();
    };
    const sprig = (x: number, y0: number, y1: number, lean: number) => {
      ctx.strokeStyle = look.leaf[0];
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + lean * 0.5, (y0 + y1) / 2, x + lean, y1);
      ctx.stroke();
      const n = 9;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const px = x + lean * t * t, py = y0 + (y1 - y0) * t;
        const len = 110 + (1 - t) * 110 + R() * 30;
        const side = k % 2 ? 1 : -1;
        leafAt(px, py, -Math.PI / 2 + side * (0.7 + R() * 0.3) + lean * 0.002, len, look.leaf[k % look.leaf.length]);
      }
      ctx.globalAlpha = 1;
    };
    for (const cx of [w * 0.3, w * 0.7, w * 0.05, w * 0.95]) sprig(cx + (R() - 0.5) * 60, bottom - 20, top + 90 + R() * 80, (R() - 0.5) * 160);
    // A coffee bean or two for the latte.
    if (look.bean) {
      for (const [bx, by] of [[w * 0.36, h * 0.6], [w * 0.64, h * 0.34]]) {
        ctx.fillStyle = look.leaf[0];
        ctx.beginPath();
        ctx.ellipse(bx, by, 26, 36, 0.4, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = look.wash[0];
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(bx - 6, by - 30);
        ctx.quadraticCurveTo(bx + 10, by, bx - 4, by + 30);
        ctx.stroke();
      }
    }
    ctx.restore();
    // The cream shield on the front (the middle of the canvas faces the camera).
    const cx = w / 2, sw = 330, st = h * 0.2, sb = h * 0.86;
    ctx.save();
    ctx.filter = 'blur(3px)';
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.moveTo(cx - sw, st + 20);
    ctx.quadraticCurveTo(cx, st - 30, cx + sw, st + 20);
    ctx.lineTo(cx + sw * 0.92, h * 0.62);
    ctx.quadraticCurveTo(cx + sw * 0.4, sb - 40, cx, sb);
    ctx.quadraticCurveTo(cx - sw * 0.4, sb - 40, cx - sw * 0.92, h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = look.ink;
    ctx.textAlign = 'center';
    ctx.font = '700 118px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText('brewns', cx, h * 0.38);
    ctx.font = '600 30px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText(look.name, cx, h * 0.46);
    ctx.letterSpacing = '1px';
    ctx.font = '400 26px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText(look.tag[0], cx, h * 0.53);
    ctx.fillText(look.tag[1], cx, h * 0.565);
    ctx.font = 'italic 64px "Brush Script MT", "Segoe Script", cursive';
    ctx.fillText('Br.', cx, h * 0.72);
  });
}

const ICED = {
  'iced-matcha': {
    name: 'ICED MATCHA', tag: ['Ceremonial Grade', 'Over Ice'], ink: '#24382a',
    wash: ['#cfe0b4', '#8fb266', '#6f9a4a', '#b7cf92', '#5c8a3e'], leaf: ['#355f33', '#4f8243', '#2a4d2a'],
    // Matcha poured over milk: grassy green above, marbling down into milk.
    body: (u: number, v: number, s: Sel) => {
      const swirl = (fbm(u * 6, v * 4, 2, 3, 5) - 0.5) * 0.3;
      const t = smoothstep(0.25, 0.6, v + swirl);
      const sweet = [0.96, 1, 1.03][s.sweet ?? 1] ?? 1;
      let c = mix([236, 238, 220], [112, 156, 72], t);
      c = mix(c, [150, 184, 100], smoothstep(0.85, 1, v) * 0.5);
      return [c[0] * sweet, c[1] * sweet, c[2], 0.5];
    },
    top: 0x9cbc6c, iceTint: 0xdcecc8,
  },
  'iced-latte': {
    name: 'ICED LATTE', tag: ['Smooth & Creamy', 'Over Ice'], ink: '#2a2a2a', bean: true,
    wash: ['#ead6c0', '#c48656', '#a8683c', '#dbb690', '#8e4f2a'], leaf: ['#7c3f1e', '#9c5a30', '#5e3014'],
    // Espresso over cold milk: coffee at the bottom rising into marbled milk.
    body: (u: number, v: number, s: Sel) => {
      const swirl = (fbm(u * 6, v * 4, 3, 3, 7) - 0.5) * 0.32;
      const t = smoothstep(0.15, 0.7, v + swirl);
      const dark = s.shots === 1 ? 0.82 : 1;
      let c = mix([104, 60, 32], [226, 200, 170], t);
      c = mix(c, [150, 98, 60], (1 - Math.abs(t - 0.5) * 2) * 0.35);
      const milk = [1, 0.98, 0.96][s.milk ?? 0] ?? 1;
      return [c[0] * dark * milk, c[1] * dark * milk, c[2] * dark * milk * milk, 0.5];
    },
    top: 0xc8a482, iceTint: 0xe8d8c4,
  },
};

export const isIcedCup = (id: string) => id in ICED;

export function createIcedCupModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const look = ICED[id] || ICED['iced-matcha'];
  const cup = new T.Group();
  inner.add(cup);

  // A clear PET cup, tapering to its foot.
  const g = { rb: 0.25, rt: 0.34, h: 0.84, wall: 0.012, base: 0.05 };
  const shell = glassShell(T, kit, g);
  (shell.mesh.material as THREE.MeshPhysicalMaterial).roughness = 0.08;
  (shell.mesh.material as THREE.MeshPhysicalMaterial).thickness = 0.02;
  const level = g.h - 0.04;
  let key = '';
  const sideMat = bodyLook(T, kit, (u, v) => look.body(u, v, sel), { roughness: 0.3, clearcoat: 0.2 });
  const topMat = kit.add(new T.MeshPhysicalMaterial({ color: look.top, roughness: 0.35, specularIntensity: 0.5 }));
  const body = drinkBody(T, kit, (y) => shell.innerR(y) - 0.004, g.base + 0.004, level, sideMat, topMat);
  cup.add(body.group);
  const ice = iceCubes(T, kit, cup, look.iceTint, (i, r) => {
    const a = (i / 5) * TAU + r() * 0.5, rad = shell.innerR(level) * 0.5;
    return [Math.sin(a) * rad, level + 0.01, Math.cos(a) * rad];
  }, 5, 9);
  cup.add(shell.mesh);

  // The print, wrapped on the outside of the wall; the front of it faces the camera.
  const rAt = (y: number) => g.rb + ((g.rt - g.rb) * y) / g.h + 0.004;
  const y0 = 0.04, y1 = g.h - 0.02;
  const labelGeo = kit.add(new T.CylinderGeometry(rAt(y1), rAt(y0), y1 - y0, 96, 1, true, Math.PI, TAU));
  const label = new T.Mesh(labelGeo, kit.add(new T.MeshPhysicalMaterial({ map: cupPrint(T, kit, look), transparent: true, alphaTest: 0.02, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1, side: T.DoubleSide })));
  label.position.y = (y0 + y1) / 2;
  label.userData.noShadow = true;
  cup.add(label);

  // A flat black lid with a thick rolled rim, a raised sip ring, and a black straw through it.
  // Glossy black, but its flat top would mirror the studio's back softbox into silver: keep the reflection low.
  const lidMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x111112, roughness: 0.3, specularIntensity: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.5 }));
  const rt = g.rt;
  const lid = new T.Mesh(lathe(T, kit, [[rt - 0.01, g.h - 0.01], [rt + 0.022, g.h - 0.005], [rt + 0.03, g.h + 0.02], [rt + 0.026, g.h + 0.05], [rt + 0.005, g.h + 0.056], [rt - 0.02, g.h + 0.058], [rt - 0.035, g.h + 0.075], [rt - 0.06, g.h + 0.082], [0, g.h + 0.082]], 96), lidMat);
  cup.add(lid);
  const strawMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x0e0e0f, roughness: 0.28, clearcoat: 0.6 }));
  const straw = new T.Mesh(kit.add(new T.CylinderGeometry(0.017, 0.017, 1.0, 16)), strawMat);
  straw.position.set(0.1, g.h + 0.1, -0.02);
  straw.rotation.z = -0.3;
  cup.add(straw);
  beads(T, kit, cup, (y) => rAt(y) + 0.002, 0.06, g.h - 0.06, 50, 5);

  const apply = (s: Sel) => {
    const next = JSON.stringify([s.sweet, s.milk, s.shots]);
    if (next !== key) {
      key = next;
      const tex = paint(T, kit, 256, 256, (u, v) => look.body(u, v, s));
      sideMat.map = tex.map;
      sideMat.bumpMap = tex.bump;
      sideMat.needsUpdate = true;
    }
    cup.scale.set(1, s.size === 1 ? 1.1 : 1, 1);
    ice.count = 5;
  };
  const piece = assemble(T, kit, inner, { sel, apply, shadow: [1.2, 1.2] });
  piece.group.userData.viewPitch = 0.1;
  return piece;
}
