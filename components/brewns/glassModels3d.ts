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

/** Cellular noise tiling horizontally: returns [distance to nearest point, to second nearest, that cell's random value]. */
function cells(u: number, v: number, gx: number, gy: number, seed = 1) {
  const x = u * gx, y = v * gy;
  const ix = Math.floor(x), iy = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j;
    const wx = ((cx % gx) + gx) % gx;
    const h1 = Math.sin(wx * 127.1 + cy * 311.7 + seed * 74.7) * 43758.5453;
    const h2 = Math.sin(wx * 269.5 + cy * 183.3 + seed * 12.9) * 43758.5453;
    const px = cx + (h1 - Math.floor(h1)), py = cy + (h2 - Math.floor(h2));
    const d = Math.hypot(px - x, py - y);
    if (d < d1) { d2 = d1; d1 = d; id = h1 - Math.floor(h1); } else if (d < d2) d2 = d;
  }
  return [d1, d2, id];
}

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
const BODY_PX = 512;
const bodyLook = (T: typeof THREE, kit: Kit, fn: (u: number, v: number) => number[], o: Record<string, unknown> = {}) =>
  surface(T, kit, paint(T, kit, BODY_PX, BODY_PX, fn), { physical: true, roughness: 0.25, clearcoat: 0.4, clearcoatRoughness: 0.2, bumpScale: 0.6, specularIntensity: 0.5, ...o });

/* ── what goes in and on the glass ── */

/** Ice cubes, rounded by melting, tinted by the drink round them. Solid, so the glass shows them. */
function iceCubes(T: typeof THREE, kit: Kit, parent: THREE.Object3D, tint: number, place: (i: number, r: () => number) => number[], count: number, seed: number, size = 1) {
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
  return scatter(T, kit, parent, geo, mat, count, (i, r) => ({ pos: place(i, r), rot: [r() * 0.8, r() * TAU, r() * 0.8], scale: (0.8 + r() * 0.35) * size }), seed);
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

/** A mint leaf: ovate and pointed, toothed along the edge, folded along the midrib, with veins painted on it. */
function mintLeafGeo(T: typeof THREE, kit: Kit, len: number, wid: number, fold: number) {
  const s = new T.Shape();
  const half = (sign: number) => {
    const out: number[][] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // ovate: widest a third of the way up, pointed tip
      const w = wid * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.78)), 0.8);
      const tooth = i > 1 && i < N - 1 ? (i % 2 ? 1 : 0.93) : 1;
      out.push([sign * w * tooth, len * t]);
    }
    return out;
  };
  const right = half(1), left = half(-1).reverse();
  s.moveTo(0, 0);
  right.forEach((p) => s.lineTo(p[0], p[1]));
  left.forEach((p) => s.lineTo(p[0], p[1]));
  const g = kit.add(new T.ShapeGeometry(s, 4));
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.abs(x) * fold + Math.sin((y / len) * Math.PI) * 0.014);
    uv.setXY(i, 0.5 + x / (wid * 2.1), y / len);
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function mintLeafTexture(T: typeof THREE, kit: Kit, base: string, light: string) {
  return draw(T, kit, 128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, base);
    g.addColorStop(1, light);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(214,240,170,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    ctx.lineTo(w / 2, h * 0.04);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(200,232,150,0.6)';
    for (let k = 1; k < 9; k++) {
      const y = h - (k / 9.5) * h;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w / 2, y);
        ctx.quadraticCurveTo(w / 2 + sgn * w * 0.25, y - h * 0.03, w / 2 + sgn * w * 0.44, y - h * 0.09);
        ctx.stroke();
      }
    }
  });
}

/**
 * A peach slice: a thick crescent. The flat faces are golden flesh deepening to orange towards the skin, the curved
 * outer edge is skin with a red blush. Colour is per vertex, so no texture is needed and nothing stretches.
 */
function fruitSlice(T: typeof THREE, kit: Kit, R: number, thick: number, arc: number, paintFace: (ctx: CanvasRenderingContext2D) => void) {
  // a circle segment: curved skin edge, flat cut chord, like a wedge cut from a peach half
  const s = new T.Shape();
  const a0 = Math.PI / 2 - arc / 2, a1 = Math.PI / 2 + arc / 2;
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N;
    const x = Math.cos(a) * R, y = Math.sin(a) * R;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  const g = kit.add(new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 12 }));
  g.translate(0, -R * 0.25, -thick / 2);
  g.computeVertexNormals();
  // UVs from position, so a radial painting sits on the flat faces: gold flesh at the middle, orange, then the red-blushed skin.
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * R), 0.5 + (pos.getY(i) + R * 0.25) / (2 * R));
  const map = draw(T, kit, 256, 256, paintFace);
  return new T.Mesh(g, kit.add(new T.MeshPhysicalMaterial({ map, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.2 })));
}

/** One loose mint leaf with a toothed edge and painted veins. */
function mintLeaf(T: typeof THREE, kit: Kit, size = 1) {
  const mat = kit.add(new T.MeshPhysicalMaterial({ map: mintLeafTexture(T, kit, '#2c8a2a', '#62c84c'), roughness: 0.4, sheen: 0.5, sheenColor: new T.Color(0xd8f8c0), side: T.DoubleSide }));
  return new T.Mesh(mintLeafGeo(T, kit, 0.2 * size, 0.08 * size, 0.2), mat);
}

/** Sets a loose piece down on the floor: lowers or raises it until its lowest point is at y = 0. */
function rest(T: typeof THREE, obj: THREE.Object3D, parent: THREE.Object3D) {
  parent.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(obj);
  obj.position.y -= box.min.y - parent.getWorldPosition(new T.Vector3()).y;
}

const peachFace = (ctx: CanvasRenderingContext2D) => {
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#f6c14a');
  gr.addColorStop(0.45, '#f3a737');
  gr.addColorStop(0.78, '#ec7c2a');
  gr.addColorStop(0.93, '#e0702a');
  gr.addColorStop(1, '#c9402a');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  // fibres running out from the stone, and a few darker flecks where the flesh meets the pit
  ctx.strokeStyle = 'rgba(255,214,120,0.35)';
  ctx.lineWidth = 1.4;
  const rr = rng(11);
  for (let k = 0; k < 70; k++) {
    const an = rr() * TAU, r0 = 10 + rr() * 40, r1 = r0 + 50 + rr() * 50;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(an) * r0, 128 + Math.sin(an) * r0);
    ctx.lineTo(128 + Math.cos(an) * r1, 128 + Math.sin(an) * r1);
    ctx.stroke();
  }
  };

const limeFace = (ctx: CanvasRenderingContext2D) => {
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#f1f7b8');
  gr.addColorStop(0.55, '#d3e86a');
  gr.addColorStop(0.84, '#bcd94c');
  gr.addColorStop(0.88, '#f2f6d2');
  gr.addColorStop(0.93, '#f2f6d2');
  gr.addColorStop(0.945, '#4b9a24');
  gr.addColorStop(1, '#2f7a1a');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  // segment walls and juice vesicles
  ctx.strokeStyle = 'rgba(248,252,222,0.8)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 10; k++) {
    const an = (k / 10) * TAU;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(an) * 106, 128 + Math.sin(an) * 106);
    ctx.stroke();
  }
  const rr = rng(21);
  ctx.fillStyle = 'rgba(255,255,230,0.5)';
  for (let k = 0; k < 220; k++) {
    const an = rr() * TAU, r = 14 + rr() * 92;
    ctx.beginPath();
    ctx.ellipse(128 + Math.cos(an) * r, 128 + Math.sin(an) * r, 3, 6, an, 0, TAU);
    ctx.fill();
  }
};
const peachSlice = (T: typeof THREE, kit: Kit, R = 0.11, thick = 0.05, arc = 2.5) => fruitSlice(T, kit, R, thick, arc, peachFace);
const limeWedge = (T: typeof THREE, kit: Kit, R = 0.13, thick = 0.05) => fruitSlice(T, kit, R, thick, 2.7, limeFace);

/** A sprig of mint: a stem with pairs of toothed, veined leaves, smaller towards the tip, arching outwards. */
export function mintSprig(T: typeof THREE, kit: Kit, size = 1, seed = 3) {
  const g = new T.Group();
  const mk = (base: string, light: string) =>
    kit.add(new T.MeshPhysicalMaterial({ map: mintLeafTexture(T, kit, base, light), roughness: 0.42, sheen: 0.5, sheenColor: new T.Color(0xd8f8c0), side: T.DoubleSide }));
  const mat = mk('#2f8a2c', '#5fc24a');
  const young = mk('#4fae3c', '#8be06a');
  const R = rng(seed);
  const pairs = 5;
  for (let k = 0; k < pairs; k++) {
    const s = (1 - k * 0.16) * size;
    const geo = mintLeafGeo(T, kit, 0.2 * s, 0.075 * s, 0.34);
    for (const side of [-1, 1]) {
      const m = new T.Mesh(geo, k === pairs - 1 ? young : mat);
      m.position.y = k * 0.034 * size;
      m.rotation.set(-0.75 + R() * 0.35, (k % 2 ? Math.PI / 2 : 0) + (side < 0 ? Math.PI : 0) + (R() - 0.5) * 0.5, 0);
      g.add(m);
    }
  }
  const stem = new T.Mesh(kit.add(new T.CylinderGeometry(0.004 * size, 0.006 * size, 0.17 * size, 6)), mat);
  stem.position.y = 0.04 * size;
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
  /** Small crushed-ice chunks packed against the glass and heaped on the surface (count). */
  crushed?: number;
  /** The thick glass foot, tinted by the drink above it. */
  baseTint?: number;
  saucer?: boolean;
  steamOn?: (s: Sel) => boolean;
  tone?: (s: Sel) => number;
};

const highball = { rb: 0.19, rt: 0.215, h: 0.95, wall: 0.018, base: 0.09 };

const LOOKS: Record<string, Look> = {
  // Blended mint and lime with crushed ice: bright green slush flecked with mint, frosty at the top.
  'mint-margarita': {
    glass: highball, fill: 0.97, ice: 0, iceTint: 0xeaf6e0, top: 0xe6f2d8,
    crushed: 64,
    baseTint: 0xdcebc9,
    body: (u, v) => {
      // Photo: deep olive muddle with dark mint bits at the foot, fading up through yellow-green into pale crushed ice.
      const n = fbm(u * 14, v * 22, 1, 3, 3);
      const bits = smoothstep(0.58, 0.66, fbm(u * 70, v * 110, 2, 3, 5));
      const [d1, d2, id] = cells(u, v, 16, 13, 4);
      const [e1, e2, id2] = cells(u + 0.31, v + 0.17, 28, 22, 8);
      const rim = Math.min(1, (d2 - d1) * 3.2);
      const rim2 = Math.min(1, (e2 - e1) * 3.6);
      const facet = 0.55 + id * 0.45;
      const up = smoothstep(0.2, 0.62, v);
      let c = mix([66, 104, 18], [96, 138, 30], n);
      c = mix(c, [168, 200, 74], smoothstep(0.2, 0.55, v));
      // each ice chunk is a slightly different tint, with bright cut edges and darker seams between them
      const ice = mix([206, 228, 190], [250, 253, 246], facet * (0.6 + id2 * 0.4));
      const seam = mix([120, 170, 90], ice, Math.min(rim, rim2 * 1.2));
      c = mix(c, seam, up * 0.9);
      c = mix(c, [255, 255, 252], (1 - rim) * up * 0.35);
      const dark = (1 - smoothstep(0.3, 0.7, v)) * 0.85 + 0.12;
      c = mix(c, [28, 78, 18], bits * dark * (1 - up * 0.55));
      return [...c, 0.3 + facet * 0.4];
    },
    garnish: (T, kit, g) => {
      const wheel = citrusWheel(T, kit, 0.12, '#4f8f26', '#c6e27e');
      wheel.rotation.set(Math.PI / 2 - 0.15, 0, 0.5);
      wheel.position.set(g.innerR(g.h) * 0.5, g.rim + 0.045, 0.1);
      g.glass.add(wheel);
      const sprig = mintSprig(T, kit, 1.45, 5);
      sprig.position.set(-0.09, g.rim - 0.01, 0.0);
      sprig.rotation.z = 0.22;
      g.glass.add(sprig);
      const steel = kit.add(new T.MeshStandardMaterial({ color: 0xdfe3e7, metalness: 1, roughness: 0.18, envMapIntensity: 1.2 }));
      g.glass.add(straw(T, kit, [[0.09, g.level - 0.5, -0.03], [0.12, g.rim + 0.04, -0.03], [0.19, g.rim + 0.3, -0.04]], steel, 0.0105));
    },
  },
  // Black tea over ice: clear amber, darker below, with peach slices and cubes against the glass.
  'peach-iced-tea': {
    glass: highball, fill: 0.9, ice: 9, iceTint: 0xf7c27a, top: 0xb86a1e,
    body: (u, v, s) => {
      // deep amber, a little lighter where the light comes through the top, with faint streaks of steeped tea
      const n = fbm(u * 5, v * 9, 2, 3, 5);
      const sweet = [0.94, 1, 1.06][s.sweet ?? 1] ?? 1;
      let c = mix([138, 62, 14], [196, 108, 30], smoothstep(0, 1, v));
      c = mix(c, [226, 150, 58], n * 0.3);
      return [c[0] * sweet, c[1] * sweet, c[2], 0.5];
    },
    garnish: (T, kit, g) => {
      // Big peach slices pressed against the glass between the tea and the wall, facing out so they show.
      for (const [a, y, tilt, size] of [[0.15, 0.62, 0.5, 1], [-0.65, 0.4, -0.35, 1.05], [0.75, 0.3, 0.9, 0.95], [-0.05, 0.2, -0.6, 1], [2.6, 0.5, 0.2, 1], [3.9, 0.3, -0.4, 1]]) {
        const sl = peachSlice(T, kit, 0.12 * size);
        const r = g.innerR(y) - 0.045;
        sl.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        sl.rotation.set(0, a, tilt);
        g.inner.add(sl);
      }
      // One leaning on the rim, tall and out of the glass.
      const rim = peachSlice(T, kit, 0.15, 0.036);
      rim.position.set(g.innerR(g.h) * 0.78, g.rim + 0.06, 0.04);
      rim.rotation.set(0.08, -0.25, -0.62);
      g.glass.add(rim);
      const sprig = mintSprig(T, kit, 0.95, 8);
      sprig.position.set(g.innerR(g.h) * 0.55, g.rim - 0.01, -0.03);
      sprig.rotation.z = -0.2;
      g.glass.add(sprig);
    },
  },
  // Mango blended with yogurt: thick, opaque, sunny, with a steel straw and the fruit beside the glass.
  'mango-smoothie': {
    glass: { rb: 0.168, rt: 0.225, h: 0.78, wall: 0.018, base: 0.07 }, fill: 0.9, ice: 0, iceTint: 0xffffff, top: 0xf6b73a,
    body: (u, v, s) => {
      const n = fbm(u * 10, v * 14, 4, 3, 2);
      const oat = s.milk === 1 ? 0.25 : 0;
      let c = mix([244, 164, 18], [250, 188, 38], n);
      c = mix(c, [252, 220, 140], oat);
      c = mix(c, [252, 214, 110], smoothstep(0.85, 1, v) * 0.4);
      return [...c, 0.4 + n * 0.3];
    },
    tone: () => 0.95,
    garnish: (T, kit, g) => {
      const steel = kit.add(new T.MeshStandardMaterial({ color: 0xd6d8dc, metalness: 1, roughness: 0.18 }));
      g.glass.add(straw(T, kit, [[0.0, g.level - 0.4, 0.01], [0.07, g.rim - 0.03, 0.02], [0.11, g.rim + 0.1, 0.02], [0.27, g.rim + 0.29, 0.03]], steel, 0.0115));
      // A whole mango, green at the stalk blushing to red, lying beside the glass.
      const skin = paint(T, kit, 256, 128, (u, v) => {
        const n = fbm(u * 6, v * 4, 1, 3, 4);
        let c = mix([104, 118, 38], [136, 136, 42], smoothstep(0.1, 0.9, u + n * 0.2));
        c = mix(c, [186, 62, 34], smoothstep(0.62, 0.96, u + (n - 0.5) * 0.3) * 0.9);
        const dot = smoothstep(0.82, 0.9, fbm(u * 80, v * 40, 3, 2, 6));
        c = mix(c, [246, 230, 170], dot * 0.4);
        return [...c, 0.5 + n * 0.2];
      });
      const mango = new T.Mesh(blob(T, kit, 0.3, 0.2, 0.21, { amp: 0.012, freq: 3, seed: 3, seg: 48 }), surface(T, kit, skin, { physical: true, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3, bumpScale: 0.5 }));
      mango.position.set(-0.4, 0.19, 0.08);
      mango.rotation.set(0, 3.5, 0.12);
      mango.scale.setScalar(0.88);
      g.inner.add(mango);
      rest(T, mango, g.inner);
      // And a cheek cut hedgehog style, its cubes pushed out.
      const flesh = kit.add(new T.MeshPhysicalMaterial({ color: 0xf5a623, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }));
      const cheek = new T.Mesh(blob(T, kit, 0.21, 0.07, 0.15, { amp: 0.004, freq: 6, seed: 5, seg: 32 }), kit.add(new T.MeshPhysicalMaterial({ color: 0xc9a02a, roughness: 0.4 })));
      cheek.position.set(-0.3, 0.05, 0.3);
      g.inner.add(cheek);
      scatter(T, kit, cheek, roundBox(T, kit, 0.05, 0.06, 0.05, 0.009, 3), flesh, 30, (i) => {
        const x = (i % 6) - 2.5, z = Math.floor(i / 6) - 2;
        const d = Math.hypot(x / 3, z / 2.5);
        return { pos: [x * 0.06, 0.06 - d * 0.03, z * 0.052], rot: [z * 0.28, 0, -x * 0.25], scale: d > 1 ? 0.001 : 1 };
      }, 3);
    },
  },
  // Lime over soda with ice: pale and fizzy, lime wheels and mint against the glass, a wedge beside it.
  'lime-soda': {
    glass: highball, fill: 0.93, ice: 14, iceTint: 0xeef6ea, top: 0xe9f3df,
    body: (u, v, s) => {
      // nearly clear fizzy water: a faint green, with bubbles
      const n = fbm(u * 6, v * 10, 2, 3, 9);
      const bubble = smoothstep(0.74, 0.84, fbm(u * 70, v * 110, 5, 2, 3));
      const cloud = s.style === 1 ? 0.15 : s.style === 2 ? 0.08 : 0;
      let c = mix([226, 240, 212], [240, 249, 232], n);
      c = mix(c, [236, 238, 226], cloud);
      c = mix(c, [255, 255, 255], bubble * 0.8);
      return [...c, 0.4 + bubble * 0.6];
    },
    garnish: (T, kit, g) => {
      // Big lime wheels pressed against the glass, facing out, and mint leaves between them.
      for (const [a, y, r, tilt] of [[0.1, 0.3, 0.145, 0.2], [-0.4, 0.58, 0.125, -0.25], [2.5, 0.45, 0.13, 0.1]]) {
        const w = citrusWheel(T, kit, r, '#4d9a22', '#c9e67c', 0.03);
        const rad = g.innerR(y) - 0.04;
        w.rotation.order = 'YXZ';
        w.rotation.set(Math.PI / 2 + tilt * 0.4, a, 0);
        w.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad);
        g.inner.add(w);
      }
      for (const [a, y, sz, rz] of [[-0.95, 0.74, 1.4, 0.5], [0.7, 0.62, 1.3, -0.4], [-0.35, 0.2, 1.2, 0.2], [3.4, 0.6, 1.3, 0.3]]) {
        const lf = mintLeaf(T, kit, sz);
        const rad = g.innerR(y) - 0.03;
        lf.rotation.order = 'YXZ';
        lf.rotation.set(0, a, rz);
        lf.rotateX(Math.PI / 2);
        lf.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad);
        g.inner.add(lf);
      }
      // Clear cubes piled above the rim.
      iceCubes(T, kit, g.glass, 0xeef6ea, (i, r) => [(r() - 0.5) * 0.22, g.rim - 0.03 + r() * 0.05 + (i % 2) * 0.03, (r() - 0.5) * 0.18], 4, 41, 1.05);
      const sprig = mintSprig(T, kit, 1.15, 11);
      sprig.position.set(0.08, g.rim + 0.04, -0.02);
      sprig.rotation.z = -0.25;
      g.glass.add(sprig);
      // Beside the glass: a wedge lying on its skin, and a few loose leaves.
      const wedge = limeWedge(T, kit, 0.15, 0.055);
      wedge.rotation.set(0.08, 0.3, 0.55);
      wedge.position.set(0.37, 0.1, 0.22);
      g.inner.add(wedge);
      rest(T, wedge, g.inner);
      const loose = mintSprig(T, kit, 1.5, 13);
      loose.rotation.set(Math.PI / 2 - 0.1, 0, 0.8);
      loose.position.set(-0.38, 0.1, 0.2);
      g.inner.add(loose);
      rest(T, loose, g.inner);
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
  const bodyR = (y: number) => shell.innerR(y) - (look.ice || look.crushed || id === 'lime-soda' || id === 'peach-iced-tea' ? 0.035 : 0.002);

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
  // Crushed ice: small irregular chunks against the glass in the upper drink, and a heap on the surface.
  if (look.crushed) {
    iceCubes(T, kit, glassGroup, look.iceTint, (i, r) => {
      const heap = i % 4 === 0;
      const a = r() * TAU;
      if (heap) {
        const rad = Math.sqrt(r()) * (bodyR(level) - 0.02);
        return [Math.sin(a) * rad, level + 0.005 + r() * 0.05, Math.cos(a) * rad];
      }
      const y = level * (0.45 + 0.52 * r());
      const rad = shell.innerR(y) - 0.03 - r() * 0.015;
      return [Math.sin(a) * rad, y, Math.cos(a) * rad];
    }, look.crushed, seed + 3, 0.42);
  }
  if (look.baseTint) {
    const r0 = shell.innerR(look.glass.base);
    const disc = new T.Mesh(kit.add(new T.CylinderGeometry(r0 - 0.004, (look.glass.rb - 0.035), look.glass.base - 0.012, 64)), kit.add(new T.MeshPhysicalMaterial({ color: look.baseTint, roughness: 0.18, clearcoat: 0.6 })));
    disc.position.y = 0.012 + (look.glass.base - 0.012) / 2;
    disc.userData.noShadow = true;
    disc.userData.noAO = true;
    glassGroup.add(disc);
  }
  glassGroup.add(shell.mesh);
  beads(T, kit, glassGroup, (y) => shell.innerR(y) + look.glass.wall + 0.002, look.glass.base + 0.05, level, 70, seed + 1);

  look.garnish(T, kit, { inner, glass: glassGroup, rim: look.glass.h, h: look.glass.h, innerR: shell.innerR, level });

  // The salted-rim choices (lime soda SALTED and MIXED): coarse salt crystals frosting the lip of the glass.
  const salt = id === 'lime-soda'
    ? scatter(T, kit, glassGroup, kit.add(new T.BoxGeometry(0.014, 0.01, 0.012)), kit.add(new T.MeshStandardMaterial({ color: 0xfbfaf4, roughness: 0.4 })), 150, (i, r) => {
        const a = r() * TAU, rad = shell.innerR(look.glass.h) + look.glass.wall * (0.2 + r() * 1.5);
        return { pos: [Math.sin(a) * rad, look.glass.h + 0.006 + r() * 0.01, Math.cos(a) * rad], rot: [r() * 3, r() * 3, r() * 3] };
      }, 77)
    : null;

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
      const tex = paint(T, kit, BODY_PX, BODY_PX, (u, v) => look.body(u, v, s));
      sideMat.map = tex.map;
      sideMat.bumpMap = tex.bump;
      sideMat.needsUpdate = true;
    }
    const tone = look.tone?.(s) ?? 0.9;
    sideMat.color.setScalar(tone);
    // Hot Spanish latte: no ice.
    if (ice) ice.count = id === 'spanish-latte' && s.temp === 1 ? 0 : look.ice;
    if (salt) salt.visible = id === 'lime-soda' && (s.style ?? 0) >= 1;
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
