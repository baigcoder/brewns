// @ts-nocheck
/* Procedural 3D models for the kitchen, the coolers and the bakery. Each
   builder returns a VariantEngine like the older models in pdp3dEngine.ts.
   Everything is drawn from noise and geometry (see foodKit.ts): no asset files. */
import type * as THREE from 'three';
import { Kit, assemble, blob, clamp01, displace, draw, dipCup, fbm, hex, lathe, leaf, mix, paint, paperSheet, plate, rng, roundBox, ruffle, scatter, surface, sweep, woodBoard } from './foodKit';
import type { VariantEngine } from './pdp3dEngine';

type Sel = Record<string, number>;

const TAU = Math.PI * 2;
const V = (T: typeof THREE, x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ── shared pieces ── */

/** The breaded, craggy golden crust of a fried fillet, ring or tender. */
export const friedCrust = (T: typeof THREE, kit: Kit, seed = 3, golden = false) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const big = fbm(u * 7, v * 7, seed, 4, seed);
      const crag = Math.abs(fbm(u * 22, v * 22, seed + 4, 3, seed + 2) - 0.5) * 2;
      const t = clamp01(big * 1.25 - 0.1);
      let c = golden ? mix([176, 112, 46], [226, 168, 84], t) : mix([104, 54, 20], [162, 98, 42], t);
      c = mix(c, [220, 176, 112], clamp01((crag - 0.55) * 2.4) * 0.7);
      c = mix(c, [78, 40, 14], clamp01((0.36 - big) * 3) * 0.8);
      return [c[0], c[1], c[2], 0.3 + big * 0.35 + crag * 0.45];
    }),
    { roughness: 0.6, bumpScale: 8 },
  );

/** A paper carton of fries, with an optional dusting of parmesan and rosemary. */
export function friesCarton(T: typeof THREE, kit: Kit, o: { truffle?: boolean; seed?: number; bare?: boolean } = {}) {
  const g = new T.Group();
  const label = draw(T, kit, 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#171514';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    for (let q = 0; q < 4; q++) {
      const x = q * 256 + 128;
      ctx.fillStyle = '#d9a866';
      ctx.font = 'italic bold 64px Georgia, serif';
      ctx.fillText('brewns', x, 130);
      ctx.fillStyle = '#b8b0a2';
      ctx.font = '600 15px monospace';
      ctx.fillText(o.truffle ? 'TRUFFLE FRIES' : 'HOT FRIES', x, 172);
    }
  });
  const cartonGeo = kit.add(new T.CylinderGeometry(0.28, 0.2, 0.42, 4, 1, true));
  cartonGeo.rotateY(Math.PI / 4);
  const carton = new T.Mesh(cartonGeo, kit.add(new T.MeshStandardMaterial({ map: label, roughness: 0.8, side: T.DoubleSide })));
  carton.position.y = 0.21;
  // Bare: the fries alone, for a basket that brings its own lining.
  if (!o.bare) g.add(carton);

  const fryGeo = kit.add(new T.BoxGeometry(0.022, 0.022, 0.36));
  const tex = paint(T, kit, 64, 64, (u, v) => {
    const n = fbm(u * 9, v * 9, 1, 3, 4);
    const c = mix([204, 150, 66], [238, 200, 118], n);
    return [c[0], c[1], c[2], n];
  });
  const fryMat = surface(T, kit, tex, { roughness: 0.65, bumpScale: 2 });
  const shade = new T.Color();
  scatter(T, kit, g, fryGeo, fryMat, 190, (i, r) => {
    const a = r() * TAU;
    const rad = Math.sqrt(r()) * 0.17;
    const tilt = 0.04 + rad * 1.1 + r() * 0.1;
    return { pos: [Math.cos(a) * rad, 0.34 + r() * 0.1, Math.sin(a) * rad], rot: [Math.sin(a) * tilt + (r() - 0.5) * 0.1, r() * 3, -Math.cos(a) * tilt + (r() - 0.5) * 0.1], scale: [1, 1, 0.75 + r() * 0.3], order: 'XYZ', color: shade.setHSL(0.11 + r() * 0.03, 0.7, 0.5 + r() * 0.16).getHex() };
  }, o.seed ?? 4);
  if (o.truffle) {
    const flake = kit.add(new T.BoxGeometry(0.03, 0.006, 0.02));
    scatter(T, kit, g, flake, kit.add(new T.MeshStandardMaterial({ color: 0xf6eed8, roughness: 0.7 })), 60, (i, r) => {
      const a = r() * TAU;
      const rad = Math.sqrt(r()) * 0.2;
      return { pos: [Math.cos(a) * rad, 0.5 + r() * 0.05, Math.sin(a) * rad], rot: [r() * 3, r() * 3, r() * 3], scale: 0.35 + r() * 0.45 };
    }, 9);
    // A sprig of rosemary laid across the top.
    const stem = new T.Mesh(kit.add(new T.CylinderGeometry(0.004, 0.005, 0.24, 6)), kit.add(new T.MeshStandardMaterial({ color: 0x5a4a2c, roughness: 0.8 })));
    stem.position.set(0.02, 0.56, 0.02);
    stem.rotation.set(0.25, 0.4, 1.35);
    g.add(stem);
    const needle = kit.add(new T.ConeGeometry(0.004, 0.05, 4));
    needle.rotateX(Math.PI / 2);
    scatter(T, kit, stem, needle, kit.add(new T.MeshStandardMaterial({ color: 0x486a35, roughness: 0.6 })), 26, (i, r) => ({ pos: [0.008 * (r() < 0.5 ? -1 : 1), (r() - 0.5) * 0.22, 0], rot: [0.5 + r() * 0.5, r() * TAU, 0.6 * (r() < 0.5 ? -1 : 1)] }), 11);
  }
  return g;
}

/* ── burgers ── */

/** Bun crust with a pale crumb face. `cut` is where the crumb stops along the profile; `crumbAbove` puts the crumb at
    the top of the profile (the bottom bun's cut face) instead of the bottom (the top bun's). */
const bunTexture = (T: typeof THREE, kit: Kit, cut: number, seed: number, crumbAbove = false) =>
  surface(
    T,
    kit,
    paint(T, kit, 512, 512, (u, v) => {
      const n = fbm(u * 8, v * 8, seed, 4, seed);
      // Fine texture: the pores and tiny cracks of a baked crust, and a mottle from the egg wash.
      const pore = fbm(u * 90, v * 90, seed + 3, 2, seed + 5);
      const mottle = fbm(u * 18, v * 14, seed + 7, 3, seed + 2);
      if (crumbAbove) v = 1 - v;
      if (v < cut) {
        // The toasted cut face: pale crumb browned in patches on the griddle.
        let c = mix([240, 214, 162], [222, 184, 122], n);
        c = mix(c, [176, 116, 56], smoothstep(0.55, 0.75, mottle) * 0.6);
        return [c[0], c[1], c[2], 0.3 + n * 0.3 + pore * 0.4];
      }
      // Egg-washed brioche: deep mahogany on the crown, amber down the sides, a pale gold waist where it rose.
      const shell = clamp01((v - cut) / (1 - cut));
      let c = mix([206, 140, 66], [160, 84, 30], smoothstep(0.0, 0.3, shell));
      c = mix(c, [96, 38, 10], smoothstep(0.3, 1, shell) * 0.95);
      c = mix(c, [96, 42, 14], smoothstep(0.6, 0.85, mottle) * 0.35 * shell);
      c = mix(c, [220, 150, 80], smoothstep(0.7, 0.9, pore) * 0.18);
      return [c[0], c[1], c[2], 0.45 + n * 0.2 + pore * 0.35];
    }),
    { roughness: 0.6, bumpScale: 1.6, physical: true, clearcoat: 0.22, clearcoatRoughness: 0.45, specularIntensity: 0.4 },
  );

const tomatoSlice = (T: typeof THREE, kit: Kit, r = 0.3) => {
  const top = draw(T, kit, 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, '#e0503a');
    g.addColorStop(0.8, '#cc2a1c');
    g.addColorStop(1, '#a01d12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const R = rng(3);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.3;
      ctx.fillStyle = 'rgba(240,190,90,0.85)';
      ctx.beginPath();
      ctx.ellipse(128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62, 34, 20, a, 0, TAU);
      ctx.fill();
      for (let s = 0; s < 5; s++) {
        ctx.fillStyle = 'rgba(250,236,170,0.95)';
        ctx.beginPath();
        ctx.arc(128 + Math.cos(a) * (46 + R() * 34), 128 + Math.sin(a) * (46 + R() * 34) + (R() - 0.5) * 12, 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(250,150,120,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, TAU);
    ctx.stroke();
  });
  const skin = kit.add(new T.MeshPhysicalMaterial({ color: 0xc8291c, roughness: 0.3, clearcoat: 0.6 }));
  const face = kit.add(new T.MeshPhysicalMaterial({ map: top, roughness: 0.28, clearcoat: 0.5 }));
  const m = new T.Mesh(kit.add(new T.CylinderGeometry(r, r, 0.04, 48)), [skin, face, face]);
  return m;
};

/**
 * A slice of cheddar melted over a patty of radius `rim`: flat on top, then slumped over the edge and hugging the side,
 * the corners running furthest and ending in drips, the edge rounded and uneven as melted cheese is.
 */
const cheeseSlice = (T: typeof THREE, kit: Kit, tone = 0xf0a72a, size = 0.86, rim = 0.4, seed = 5) => {
  const g = kit.add(new T.PlaneGeometry(size, size, 48, 48));
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI / 4 + seed * 0.3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    const edge = rim * (0.96 + (fbm(Math.cos(a) * 2, Math.sin(a) * 2, seed, 2, seed) - 0.5) * 0.12);
    const over = Math.max(0, r - edge);
    // Past the edge the cheese folds down the side: it keeps its length but spends it going down, not out.
    const outR = edge + over * 0.22;
    // It runs down the side a little way and stops: melted cheese hangs, it does not pour.
    const drop = Math.min(0.075, over * 0.9 + over * over * 2);
    const k = r > 1e-4 ? outR / r : 1;
    const sag = (fbm(x * 7, z * 7, seed + 1, 2, seed + 3) - 0.5) * 0.01;
    p.setXYZ(i, x * (r > edge ? k : 1), -drop + sag + (r < edge ? (1 - (r / edge) ** 2) * 0.006 : 0), z * (r > edge ? k : 1));
  }
  g.computeVertexNormals();
  return new T.Mesh(g, kit.add(new T.MeshPhysicalMaterial({ color: tone, roughness: 0.26, clearcoat: 0.55, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: new T.Color(0xffe6a0), specularIntensity: 0.6, side: T.DoubleSide })));
};

/** Drips of sauce or cheese running over an edge at radius `rim`, from height 0 down, each ending in a bead. */
const drips = (T: typeof THREE, kit: Kit, mat: THREE.Material, rim: number, n: number, seed: number, len = 0.1, w = 0.022) => {
  const g = new T.Group();
  const r = rng(seed);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + r() * 0.7;
    const l = len * (0.5 + r());
    const path = new T.CatmullRomCurve3([V(T, Math.cos(a) * (rim - 0.04), 0.004, Math.sin(a) * (rim - 0.04)), V(T, Math.cos(a) * (rim + 0.012), -0.012, Math.sin(a) * (rim + 0.012)), V(T, Math.cos(a) * (rim + 0.016), -l * 0.6, Math.sin(a) * (rim + 0.016)), V(T, Math.cos(a) * (rim + 0.012), -l, Math.sin(a) * (rim + 0.012))]);
    const ww = w * (0.7 + r() * 0.6);
    g.add(new T.Mesh(sweep(T, kit, path, { width: ww * 2, thick: ww * 0.7, segs: 24 }), mat));
    const bead = new T.Mesh(kit.add(new T.SphereGeometry(ww * 0.95, 12, 10)), mat);
    bead.position.copy(path.getPoint(1));
    bead.scale.set(1, 1.3, 1);
    g.add(bead);
  }
  return g;
};

/**
 * Thick sauce hanging off an edge: each run is a soft, uneven lobe (a stretched blob) that widens where it leaves the edge
 * and swells slightly at its lower end, with a fat blob where it joins the sauce on top. No thin ribbons or beads.
 */
const sauceLobes = (T: typeof THREE, kit: Kit, mat: THREE.Material, rim: number, n: number, seed: number, len = 0.1, w = 0.05) => {
  const g = new T.Group();
  const r = rng(seed);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + r() * 0.9;
    const l = len * (0.6 + r() * 0.7);
    const ww = w * (0.8 + r() * 0.5);
    const lobe = new T.Mesh(blob(T, kit, ww, l * 0.5, ww * 0.55, { amp: ww * 0.18, freq: 5, seed: seed + k * 3, seg: 28 }), mat);
    lobe.position.set(Math.cos(a) * (rim + 0.004), -l * 0.42, Math.sin(a) * (rim + 0.004));
    lobe.rotation.y = -a + Math.PI / 2;
    // lean the lower end slightly outward, as sauce does as it slumps
    lobe.rotation.x = 0.06;
    g.add(lobe);
    const top = new T.Mesh(blob(T, kit, ww * 1.5, 0.014, ww * 1.1, { amp: 0.008, freq: 6, seed: seed + 9 + k, seg: 20 }), mat);
    top.position.set(Math.cos(a) * (rim - ww * 0.55), 0.004, Math.sin(a) * (rim - ww * 0.55));
    top.rotation.y = -a;
    g.add(top);
  }
  return g;
};

const pattyMaterial = (T: typeof THREE, kit: Kit, glaze = false) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      // Seared on a hot griddle: a deep brown crust, craggy, charred almost black at the high points, with
      // glistening fat in the crevices.
      const n = fbm(u * 10, v * 10, 2, 4, 6);
      const crag = fbm(u * 40, v * 40, 3, 3, 9);
      let c = mix([54, 28, 15], [100, 54, 28], n);
      c = mix(c, [22, 11, 6], smoothstep(0.56, 0.74, crag) * 0.85);
      c = mix(c, [128, 72, 38], smoothstep(0.35, 0.2, crag) * 0.3);
      return [c[0], c[1], c[2], 0.25 + n * 0.35 + crag * 0.4];
    }),
    glaze ? { roughness: 0.42, bumpScale: 3, physical: true, clearcoat: 0.25, clearcoatRoughness: 0.35, specularIntensity: 0.35 } : { roughness: 0.62, bumpScale: 6, physical: true, specularIntensity: 0.45 },
  );

const onionRing = (T: typeof THREE, kit: Kit, mat: THREE.Material, r = 0.2) => {
  const g = kit.add(new T.TorusGeometry(r, 0.05, 16, 44));
  g.rotateX(Math.PI / 2);
  displace(g, 0.012, 9, 4);
  return new T.Mesh(g, mat);
};

/**
 * A frilled lettuce leaf: a disc with an irregular, lobed outline, a pale thick midrib region in the middle, ruffles that
 * grow towards the edge (at two frequencies) and an edge that droops, as a leaf does when it hangs over a bun. Painted
 * with veins and a pale base fading to green. Built on a polar grid so the ruffles are smooth, not a fan of triangles.
 */
const lettuceLeaf = (T: typeof THREE, kit: Kit, radius: number, seed: number, droop = 0.05) => {
  const RINGS = 22, SEG = 144;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= RINGS; i++) {
    const f = i / RINGS;
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      // lobed, uneven outline
      const lobe = 1 + (fbm(ca * 1.6 + seed, sa * 1.6, seed, 3, seed) - 0.5) * 0.34 + (fbm(ca * 5, sa * 5, seed + 2, 2, seed + 4) - 0.5) * 0.14;
      const r = radius * f * lobe;
      const edge = f * f;
      const wave = Math.sin(a * 11 + fbm(ca * 2, sa * 2, seed + 1, 2, seed + 3) * 7) * 0.022 * edge
        + Math.sin(a * 27 + f * 9 + seed) * 0.008 * edge;
      const y = wave - droop * Math.pow(f, 2.6) + (fbm(ca * 3 * f, sa * 3 * f, seed + 6, 2, seed + 7) - 0.5) * 0.03 * f;
      pos.push(ca * r, y, sa * r);
      uv.push(0.5 + 0.5 * f * ca, 0.5 + 0.5 * f * sa);
    }
  }
  for (let i = 0; i < RINGS; i++)
    for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j, b = a + 1, c = (i + 1) * (SEG + 1) + j, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = kit.add(new T.BufferGeometry());
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

const lettuceSkin = (T: typeof THREE, kit: Kit) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const x = (u - 0.5) * 2, y = (v - 0.5) * 2;
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      const n = fbm(u * 6, v * 6, 2, 3, 3);
      // veins fan out from the base; the middle is pale and thick, the frilly edge a deeper, translucent green
      const vein = Math.pow(Math.abs(Math.sin(a * 9 + n * 3)), 18) * smoothstep(0.1, 0.5, r) * 0.55;
      let c = mix([196, 222, 140], [76, 138, 44], smoothstep(0.1, 0.8, r));
      c = mix(c, [44, 98, 28], smoothstep(0.6, 1, r) * (0.4 + n * 0.5));
      c = mix(c, [214, 234, 168], vein);
      return [c[0], c[1], c[2], 0.3 + vein * 0.5 + n * 0.3];
    }),
    { physical: true, roughness: 0.5, bumpScale: 2, sheen: 0.35, sheenColor: new T.Color(0xd8f0a8), side: T.DoubleSide },
  );

export function createBurgerModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const isZinger = id === 'zinger-burger';
  const isBbq = id === 'bbq-burger';
  const isSmash = id === 'smash-burger';

  // Straight on the table, as photographed.
  const stack = new T.Group();
  stack.position.y = 0;
  inner.add(stack);
  let y = 0;
  const put = (o: THREE.Object3D, h: number, lift = 0) => {
    o.position.y = y + lift;
    stack.add(o);
    y += h;
    return o;
  };

  // Bottom bun.
  const bunBottom = new T.Mesh(lathe(T, kit, [[0, 0], [0.38, 0], [0.43, 0.025], [0.445, 0.07], [0.42, 0.115], [0.3, 0.13], [0, 0.13]], 96), bunTexture(T, kit, 0.2, 4, true));
  put(bunBottom, 0.115);

  // Sauce on the bun.
  const sauce = new T.Mesh(blob(T, kit, 0.36, 0.028, 0.36, { amp: 0.008, freq: 9, seed: 12 }), kit.add(new T.MeshPhysicalMaterial({ color: isBbq ? 0x7a2f14 : 0xefb26a, roughness: 0.24, clearcoat: 0.8 })));
  put(sauce, 0.02, 0.02);

  // Lettuce.
  const lettuceMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x3c7424, roughness: 0.55, sheen: 0.2, sheenColor: new T.Color(0xc8e8a0), side: T.DoubleSide }));
  if (isBbq) {
    // Two leaves, one under the other and turned apart, each hanging a little over the bun, as photographed.
    const lettuce = new T.Group();
    const skinL = lettuceSkin(T, kit);
    const low = new T.Mesh(lettuceLeaf(T, kit, 0.54, 3, 0.07), skinL);
    const top = new T.Mesh(lettuceLeaf(T, kit, 0.5, 11, 0.06), skinL);
    top.position.y = 0.022;
    top.rotation.y = 2.1;
    lettuce.add(low, top);
    put(lettuce, 0.03, 0.03);
    const tomato = tomatoSlice(T, kit, 0.3);
    tomato.rotation.y = 0.6;
    put(tomato, 0.04, 0.02);
  }
  if (isZinger) {
    // Shredded iceberg: a nest of pale ribbons spilling past the bun.
    const shred = kit.add(new T.BoxGeometry(0.2, 0.012, 0.03));
    const shredMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xc6e08c, roughness: 0.45, sheen: 0.4, sheenColor: new T.Color(0xffffff) }));
    const nest = new T.Group();
    scatter(T, kit, nest, shred, shredMat, 190, (i, r) => {
      const a = r() * TAU, rad = Math.sqrt(r()) * 0.58;
      return { pos: [Math.cos(a) * rad, r() * 0.05, Math.sin(a) * rad], rot: [(r() - 0.5) * 0.8, r() * TAU, (r() - 0.5) * 0.8], color: new T.Color().setHSL(0.22 + r() * 0.04, 0.5, 0.62 + r() * 0.15).getHex() };
    }, 17);
    put(nest, 0.09, 0.02);
  }
  // Crinkle-cut pickle slices: dark green rind, paler flesh with a ring of seeds, glossy with brine.
  const pickleFace = draw(T, kit, 128, 128, (ctx) => {
    ctx.fillStyle = '#4f6a1e';
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#a9b457';
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c9c878';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24, 6, 3.5, a, 0, TAU);
      ctx.fill();
    }
  });
  const pickleRind = kit.add(new T.MeshPhysicalMaterial({ color: 0x455e18, roughness: 0.35, clearcoat: 0.7 }));
  const pickleMat = kit.add(new T.MeshPhysicalMaterial({ map: pickleFace, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
  const pickleGeo = kit.add(new T.CylinderGeometry(0.09, 0.09, 0.016, 28));
  const pickles = new T.Group();
  [[0.42, 0.14], [-0.3, 0.36], [0.06, -0.46], [-0.44, -0.18], [0.3, 0.38]].forEach(([px, pz], i) => {
    const pk = new T.Mesh(pickleGeo, [pickleRind, pickleMat, pickleMat]);
    pk.position.set(px, 0, pz);
    pk.rotation.y = i;
    pickles.add(pk);
  });


  // The protein.
  const meat = new T.Group();
  const extraPatty = new T.Group();
  extraPatty.visible = false;
  meat.add(extraPatty);
  const pattyMat = pattyMaterial(T, kit, isBbq);
  let meatH = 0;
  if (isZinger) {
    const crust = friedCrust(T, kit, 5);
    // Double-dipped and fried: a big fillet overhanging the bun, its coating craggy at two scales.
    // A whole thigh, not a disc: lumpy in outline and thickness, then the crumb's crags on top of that.
    const filletGeo = blob(T, kit, 0.62, 0.2, 0.52, { amp: 0.09, freq: 2.8, seed: 21, seg: 160 });
    displace(filletGeo, 0.06, 6, 22, 3);
    displace(filletGeo, 0.04, 20, 23, 3);
    displace(filletGeo, 0.022, 52, 24, 2);
    const fillet = new T.Mesh(filletGeo, crust);
    fillet.rotation.y = 0.3;
    meat.add(fillet);
    meatH = 0.22;
  } else {
    const n = isSmash ? 3 : 1; // the smash's third patty is the "+ PATTY" extra, hidden until chosen
    for (let i = 0; i < n; i++) {
      const rr = isSmash ? 0.5 : 0.45;
      const hh = isSmash ? 0.12 : isBbq ? 0.15 : 0.1;
      // Smashed beef is a lumpy, lacy-edged disc, not a cylinder: build it as a flattened blob, then crag it at two scales.
      const g = isSmash || isBbq
        ? blob(T, kit, rr * 1.04, hh * (isBbq ? 0.78 : 0.62), rr * 0.98, { amp: isBbq ? 0.03 : 0.05, freq: 3.2, seed: 50 + i, seg: 96 })
        : kit.add(new T.CylinderGeometry(rr, rr * 0.97, hh, 72, 2));
      if (isSmash || isBbq) {
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const x = p.getX(k), z = p.getZ(k), a = Math.atan2(z, x);
          // a ragged, lacy rim: the edge is pulled in and out by noise round the circle
          const lace = 1 + (fbm(Math.cos(a) * 4, Math.sin(a) * 4, i, 3, 60 + i) - 0.5) * 0.22 + (fbm(Math.cos(a) * 14, Math.sin(a) * 14, i, 2, 70) - 0.5) * 0.08;
          p.setXYZ(k, x * lace, p.getY(k), z * lace);
        }
        g.computeVertexNormals();
        displace(g, 0.03, 10, 30 + i, 3);
      } else {
        displace(g, 0.03, 4, 30 + i);
        displace(g, 0.012, 16, 31 + i);
      }
      const patty = new T.Mesh(g, pattyMat);
      patty.position.y = i * (hh + 0.05) + hh / 2;
      patty.rotation.y = i * 1.7;
      meat.add(patty);
      if (isSmash && i === 2) extraPatty.add(patty);
      if (isSmash) {
        // Wider than the patty, so it melts over the lacy edge where it can be seen.
        const cs = cheeseSlice(T, kit, 0xf2b52e, 1.0, 0.52, 5 + i);
        cs.position.y = i * (hh + 0.05) + hh * 1.12 + 0.012;
        meat.add(cs);
        if (i === 2) extraPatty.add(cs);
      }
    }
    meatH = isSmash ? 0.33 : isBbq ? 0.17 : 0.1;
  }
  put(meat, meatH, 0.02);
  const aboveMeat = stack.children.length; // everything added from here sits above the patties and rides up with an extra layer
  // House sauce running over the edge of the top patty.
  if (isSmash) {
    const houseSauce = kit.add(new T.MeshPhysicalMaterial({ color: 0xe39a66, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5, specularIntensity: 0.3 }));
    const run = sauceLobes(T, kit, houseSauce, 0.47, 3, 43, 0.3, 0.07);
    run.position.y = y - 0.005;
    stack.add(run);
    const pool = new T.Mesh(blob(T, kit, 0.42, 0.026, 0.4, { amp: 0.045, freq: 4, seed: 44, seg: 48 }), houseSauce);
    pool.position.y = y;
    stack.add(pool);
  }
  // Pickles on the smash burger's cheese.
  if (isSmash) put(pickles, 0.016, 0.0);
  // The hero patty's cheese: the BBQ burger gets cheddar over its patty.
  if (isBbq) {
    const cs = cheeseSlice(T, kit, 0xf3b03a, 0.92, 0.47, 9);
    put(cs, 0.02);
  }
  // BBQ glaze drizzle and onion rings.
  let rings: THREE.Group | null = null;
  if (isBbq) {
    // Two rashers of streaky bacon, crisped into waves.
    const bacon = new T.Group();
    const baconTex = paint(T, kit, 64, 256, (u, v) => {
      const fat = smoothstep(0.35, 0.45, Math.abs(Math.sin(u * Math.PI * 2 + fbm(u * 3, v * 6, 1, 2, 3) * 1.5)));
      let c = mix([150, 46, 26], [226, 176, 132], fat * 0.7);
      c = mix(c, [74, 24, 10], smoothstep(0.62, 0.78, fbm(u * 6, v * 20, 2, 2, 7)) * 0.7);
      return [...c, 0.4 + fat * 0.3];
    });
    const baconMat = surface(T, kit, baconTex, { physical: true, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3, bumpScale: 2, side: T.DoubleSide });
    for (let b = 0; b < 2; b++) {
      const pts = Array.from({ length: 9 }, (_, k) => V(T, -0.5 + k * 0.125, Math.sin(k * 2.1 + b) * 0.025, (b - 0.5) * 0.16 + Math.sin(k * 0.8) * 0.03));
      const m = new T.Mesh(sweep(T, kit, new T.CatmullRomCurve3(pts), { width: 0.1, thick: 0.012, segs: 60 }), baconMat);
      m.rotation.y = 0.4 + b * 0.25;
      bacon.add(m);
    }
    put(bacon, 0.03, 0.02);
    const glaze = new T.Group();
    const curve = new T.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => V(T, -0.34 + i * 0.062, 0.006 + Math.sin(i * 1.7) * 0.004, Math.sin(i * 1.3) * 0.16)));
    glaze.add(new T.Mesh(sweep(T, kit, curve, { round: true, radius: 0.012, segs: 60 }), kit.add(new T.MeshPhysicalMaterial({ color: 0x2e0f07, roughness: 0.12, clearcoat: 1 }))));
    put(glaze, 0.0, 0.02);
    rings = new T.Group();
    const crust = friedCrust(T, kit, 8);
    for (let i = 0; i < 2; i++) {
      const ring = onionRing(T, kit, crust, 0.25 - i * 0.05);
      ring.scale.set(1, 0.8, 1);
      ring.position.set(i * 0.06 - 0.03, i * 0.075, i * 0.03);
      ring.rotation.set(0.12 - i * 0.2, i, 0.1);
      rings.add(ring);
    }
    put(rings, 0.09, 0.0);
  }
  // Spicy mayo over the zinger's fillet.
  if (isZinger) {
    const mayoMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xe6bd94, roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5, specularIntensity: 0.3 }));
    const mayo = new T.Mesh(blob(T, kit, 0.42, 0.04, 0.4, { amp: 0.05, freq: 4, seed: 33, seg: 48 }), mayoMat);
    put(mayo, 0.02, 0.005);
    const mayoRun = sauceLobes(T, kit, mayoMat, 0.42, 3, 61, 0.34, 0.085);
    mayoRun.position.y = y - 0.01;
    stack.add(mayoRun);
  }

  // Top bun with sesame.
  const topBunGeo = lathe(T, kit, [[0, 0], [0.4, 0], [0.445, 0.03], [0.455, 0.09], [0.425, 0.19], [0.34, 0.275], [0.19, 0.318], [0, 0.328]], 96);
  const topBun = new T.Mesh(topBunGeo, bunTexture(T, kit, 0.34, 9));
  // The smash burger's bun is flatter and rides a little above the sauce, as photographed.
  if (isSmash) topBun.scale.set(1.02, 0.84, 1.02);
  const bunY = y + (isSmash ? 0.045 : isBbq ? -0.03 : 0.02);
  topBun.position.y = bunY;
  stack.add(topBun);
  const seedGeo = kit.add(new T.SphereGeometry(1, 8, 6));
  const seedMat = kit.add(new T.MeshStandardMaterial({ color: 0xf0e2bd, roughness: 0.5 }));
  const dome = [[0.445, 0.03], [0.455, 0.09], [0.425, 0.19], [0.34, 0.275], [0.19, 0.318], [0, 0.328]];
  if (!isSmash) scatter(T, kit, stack, seedGeo, seedMat, 170, (i, r) => {
    const s = Math.pow(r(), 0.75) * (dome.length - 1);
    const k = Math.min(dome.length - 2, Math.floor(s));
    const f = s - k;
    const rad = dome[k][0] + (dome[k + 1][0] - dome[k][0]) * f;
    const hgt = dome[k][1] + (dome[k + 1][1] - dome[k][1]) * f;
    const slope = Math.atan2(dome[k + 1][1] - dome[k][1], dome[k + 1][0] - dome[k][0]);
    const a = r() * TAU;
    return { pos: [Math.cos(a) * rad, bunY + hgt + 0.004, Math.sin(a) * rad], rot: [0, -a, slope + Math.PI], order: 'YZX', scale: [0.024, 0.009, 0.013] };
  }, 14);

  // Chilli on the zinger.
  let chilli: THREE.InstancedMesh | null = null;
  if (isZinger) {
    const flake = kit.add(new T.BoxGeometry(0.036, 0.008, 0.024)); // large enough to read as chilli on the bun
    chilli = scatter(T, kit, stack, flake, kit.add(new T.MeshStandardMaterial({ color: 0xb01c0c, roughness: 0.6 })), 90, (i, r) => {
      const a = r() * TAU, rad = Math.sqrt(r()) * 0.42;
      // on the bun's dome, not inside it: the crown falls away towards the edge
      const crown = 0.328 * Math.sqrt(Math.max(0, 1 - Math.pow(rad / 0.455, 3)));
      return { pos: [Math.cos(a) * rad, bunY + crown + 0.012, Math.sin(a) * rad], rot: [0, r() * 3, 0] };
    }, 15);
    chilli.position.y = 0;
  }

  // Extras (smash): a second slice of cheese, or a third patty with its own cheese. Both lift what sits above them.
  const upper = stack.children.slice(aboveMeat);
  upper.forEach((o) => (o.userData.baseY = o.position.y));
  const extraCheese = cheeseSlice(T, kit, 0xf6b53c, 0.96, 0.5, 11);
  extraCheese.position.y = 0.33 + 0.045;
  extraCheese.visible = false;
  meat.add(extraCheese);
  const fries = friesCarton(T, kit, { seed: 6 });
  fries.position.set(0.64, 0, -0.1);
  fries.scale.setScalar(0.9);
  // Added only when chosen, so the burger alone sets the framing and stays centred.
  const withFries = (on: boolean) => { if (on && !fries.parent) inner.add(fries); if (!on && fries.parent) inner.remove(fries); };

  const apply = (s: Sel) => {
    withFries(s.meal === 1);
    // The meal is a wider composition: draw the burger a little smaller and off to one side to make room for the fries.
    stack.position.x = s.meal === 1 ? -0.4 : 0;
    fries.position.x = 0.64;
    inner.scale.setScalar(s.meal === 1 ? 0.6 : 1);
    if (isSmash) {
      const extra = s.extra ?? 0;
      extraCheese.visible = extra === 1;
      extraPatty.visible = extra === 2;
      const lift = extra === 2 ? 0.17 : extra === 1 ? 0.035 : 0;
      upper.forEach((o) => (o.position.y = o.userData.baseY + lift));
    }
    if (isZinger && chilli) chilli.count = [0, 34, 90][s.spice ?? 1] ?? 34;
  };
  const piece = assemble(T, kit, inner, { sel, apply, shadow: [2.0, 1.7] });
  // The photographs look at the burger from the side, so the layers read; start nearly level.
  piece.group.userData.viewPitch = 0.1;
  return piece;
}
