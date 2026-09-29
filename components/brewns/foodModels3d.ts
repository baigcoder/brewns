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

/* ── shared pieces ── */

/** The breaded, craggy golden crust of a fried fillet, ring or tender. */
export const friedCrust = (T: typeof THREE, kit: Kit, seed = 3) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const big = fbm(u * 7, v * 7, seed, 4, seed);
      const crag = Math.abs(fbm(u * 22, v * 22, seed + 4, 3, seed + 2) - 0.5) * 2;
      const t = clamp01(big * 1.25 - 0.1);
      let c = mix([150, 82, 26], [206, 138, 56], t);
      c = mix(c, [232, 190, 112], clamp01((crag - 0.55) * 2.2) * 0.7);
      c = mix(c, [104, 52, 16], clamp01((0.34 - big) * 3) * 0.75);
      return [c[0], c[1], c[2], 0.3 + big * 0.35 + crag * 0.45];
    }),
    { roughness: 0.6, bumpScale: 8 },
  );

/** A paper carton of fries, with an optional dusting of parmesan and rosemary. */
export function friesCarton(T: typeof THREE, kit: Kit, o: { truffle?: boolean; seed?: number } = {}) {
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
  g.add(carton);

  const fryGeo = kit.add(new T.BoxGeometry(0.034, 0.034, 0.36));
  const tex = paint(T, kit, 64, 64, (u, v) => {
    const n = fbm(u * 9, v * 9, 1, 3, 4);
    const c = mix([214, 152, 58], [244, 205, 108], n);
    return [c[0], c[1], c[2], n];
  });
  const fryMat = surface(T, kit, tex, { roughness: 0.65, bumpScale: 2 });
  const shade = new T.Color();
  scatter(T, kit, g, fryGeo, fryMat, 96, (i, r) => {
    const a = r() * TAU;
    const rad = Math.sqrt(r()) * 0.17;
    const tilt = 0.04 + rad * 1.1 + r() * 0.1;
    return { pos: [Math.cos(a) * rad, 0.34 + r() * 0.1, Math.sin(a) * rad], rot: [Math.sin(a) * tilt + (r() - 0.5) * 0.1, r() * 3, -Math.cos(a) * tilt + (r() - 0.5) * 0.1], scale: [1, 1, 0.75 + r() * 0.3], order: 'XYZ', color: shade.setHSL(0.11 + r() * 0.03, 0.7, 0.5 + r() * 0.16).getHex() };
  }, o.seed ?? 4);
  if (o.truffle) {
    const flake = kit.add(new T.BoxGeometry(0.03, 0.006, 0.02));
    scatter(T, kit, g, flake, kit.add(new T.MeshStandardMaterial({ color: 0xf6eed8, roughness: 0.7 })), 34, (i, r) => {
      const a = r() * TAU;
      const rad = Math.sqrt(r()) * 0.2;
      return { pos: [Math.cos(a) * rad, 0.5 + r() * 0.05, Math.sin(a) * rad], rot: [r() * 3, r() * 3, r() * 3], scale: 0.7 + r() * 0.9 };
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

const bunTexture = (T: typeof THREE, kit: Kit, cut: number, seed: number) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const n = fbm(u * 8, v * 8, seed, 4, seed);
      if (v < cut) {
        const c = mix([248, 226, 178], [236, 200, 138], n);
        return [c[0], c[1], c[2], 0.3 + n * 0.6];
      }
      const shell = clamp01((v - cut) / (1 - cut));
      const c = mix(mix([214, 146, 62], [178, 100, 34], n), [136, 70, 22], Math.pow(shell, 1.6) * 0.8);
      const sheen = clamp01((fbm(u * 3, v * 5, 9, 2, 4) - 0.5) * 2);
      return [c[0] + sheen * 22, c[1] + sheen * 14, c[2] + sheen * 6, 0.45 + n * 0.3];
    }),
    { roughness: 0.5, bumpScale: 1.6, physical: true, clearcoat: 0.28, clearcoatRoughness: 0.4 },
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

/** The cheese slice, corners drooping over the patty. */
const cheeseSlice = (T: typeof THREE, kit: Kit, tone = 0xf0a72a, size = 0.86) => {
  const g = kit.add(new T.PlaneGeometry(size, size, 20, 20));
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    p.setY(i, -Math.max(0, r - 0.36) * 0.75 + (fbm(x * 5, z * 5, 0, 2, 5) - 0.5) * 0.012);
  }
  g.computeVertexNormals();
  return new T.Mesh(g, kit.add(new T.MeshPhysicalMaterial({ color: tone, roughness: 0.32, clearcoat: 0.35, sheen: 0.4, sheenColor: new T.Color(0xffe0a0), side: T.DoubleSide })));
};

const pattyMaterial = (T: typeof THREE, kit: Kit, glaze = false) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const n = fbm(u * 10, v * 10, 2, 4, 6);
      const crust = clamp01((n - 0.35) * 2.2);
      let c = mix([72, 40, 24], [128, 74, 44], n);
      c = mix(c, [30, 16, 10], clamp01((0.36 - n) * 3));
      c = mix(c, [150, 92, 56], crust * 0.25);
      return [c[0], c[1], c[2], 0.3 + n * 0.7];
    }),
    glaze ? { roughness: 0.32, bumpScale: 3, physical: true, clearcoat: 0.9, clearcoatRoughness: 0.18 } : { roughness: 0.62, bumpScale: 4 },
  );

const onionRing = (T: typeof THREE, kit: Kit, mat: THREE.Material, r = 0.2) => {
  const g = kit.add(new T.TorusGeometry(r, 0.058, 16, 44));
  g.rotateX(Math.PI / 2);
  displace(g, 0.012, 9, 4);
  return new T.Mesh(g, mat);
};

export function createBurgerModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const isZinger = id === 'zinger-burger';
  const isBbq = id === 'bbq-burger';
  const isSmash = id === 'smash-burger';

  // Wooden board with a sheet of paper on it.
  const board = woodBoard(T, kit, 0.7, 0.045, { tone: [150, 104, 62] });
  inner.add(board);
  const paper = paperSheet(T, kit, 0.95, 0.95);
  paper.position.y = 0.05;
  paper.rotation.y = 0.5;
  inner.add(paper);

  const stack = new T.Group();
  stack.position.y = 0.055;
  inner.add(stack);
  let y = 0;
  const put = (o: THREE.Object3D, h: number, lift = 0) => {
    o.position.y = y + lift;
    stack.add(o);
    y += h;
    return o;
  };

  // Bottom bun.
  const bunBottom = new T.Mesh(lathe(T, kit, [[0, 0], [0.38, 0], [0.43, 0.025], [0.445, 0.07], [0.42, 0.115], [0.3, 0.13], [0, 0.13]]), bunTexture(T, kit, 0.6, 4));
  put(bunBottom, 0.115);

  // Sauce on the bun.
  const sauce = new T.Mesh(blob(T, kit, 0.36, 0.028, 0.36, { amp: 0.008, freq: 9, seed: 12 }), kit.add(new T.MeshPhysicalMaterial({ color: isBbq ? 0x7a2f14 : 0xefb26a, roughness: 0.24, clearcoat: 0.8 })));
  put(sauce, 0.02, 0.02);

  // Lettuce.
  const lettuceMat = kit.add(new T.MeshStandardMaterial({ color: 0x6fae35, roughness: 0.5, side: T.DoubleSide }));
  const lettuce = new T.Mesh(ruffle(T, kit, 0.53, { waves: 9, amp: 0.05, seed: 3 }), lettuceMat);
  put(lettuce, 0.03, 0.03);
  const lettuce2 = new T.Mesh(ruffle(T, kit, 0.42, { waves: 6, amp: 0.04, seed: 8 }), kit.add(new T.MeshStandardMaterial({ color: 0x6fb033, roughness: 0.5, side: T.DoubleSide })));
  lettuce2.rotation.y = 1;
  put(lettuce2, 0.02, 0.005);

  // Tomato and pickles (the smash burger and the zinger; the BBQ has onion rings).
  if (!isBbq) {
    const tomato = tomatoSlice(T, kit, 0.3);
    tomato.rotation.y = 0.6;
    put(tomato, 0.04, 0.02);
  }
  const pickleMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x8aa138, roughness: 0.3, clearcoat: 0.6, transmission: 0.0 }));
  const pickleGeo = kit.add(new T.CylinderGeometry(0.1, 0.1, 0.016, 28));
  const pickles = new T.Group();
  [[0.18, 0.05], [-0.14, 0.16], [-0.06, -0.2]].forEach(([px, pz], i) => {
    const pk = new T.Mesh(pickleGeo, pickleMat);
    pk.position.set(px, 0, pz);
    pk.rotation.y = i;
    pickles.add(pk);
  });
  if (!isBbq) put(pickles, 0.016, 0.005);

  // The protein.
  const meat = new T.Group();
  const pattyMat = pattyMaterial(T, kit, isBbq);
  let meatH = 0;
  if (isZinger) {
    const crust = friedCrust(T, kit, 5);
    const fillet = new T.Mesh(blob(T, kit, 0.5, 0.085, 0.42, { amp: 0.032, freq: 6, seed: 21, seg: 56 }), crust);
    fillet.rotation.y = 0.3;
    meat.add(fillet);
    meatH = 0.11;
  } else {
    const n = isSmash ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const rr = isSmash ? 0.475 : 0.45;
      const hh = isSmash ? 0.048 : 0.085;
      const g = kit.add(new T.CylinderGeometry(rr, rr * 0.97, hh, 64, 2));
      displace(g, isSmash ? 0.03 : 0.018, isSmash ? 8 : 6, 30 + i);
      const patty = new T.Mesh(g, pattyMat);
      patty.position.y = i * (hh + 0.055) + hh / 2;
      patty.rotation.y = i * 1.7;
      meat.add(patty);
      if (isSmash) {
        const cs = cheeseSlice(T, kit, 0xf0a72a);
        cs.position.y = i * (hh + 0.055) + hh;
        cs.rotation.y = i * 0.8;
        meat.add(cs);
      }
    }
    meatH = isSmash ? 0.16 : 0.09;
  }
  put(meat, meatH, 0.02);
  // The hero patty's cheese: the BBQ burger gets cheddar over its patty.
  if (isBbq) {
    const cs = cheeseSlice(T, kit, 0xf3b03a);
    put(cs, 0.02);
  }
  // BBQ glaze drizzle and onion rings.
  let rings: THREE.Group | null = null;
  if (isBbq) {
    const glaze = new T.Group();
    const curve = new T.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => V(T, -0.34 + i * 0.062, 0.006 + Math.sin(i * 1.7) * 0.004, Math.sin(i * 1.3) * 0.16)));
    glaze.add(new T.Mesh(sweep(T, kit, curve, { round: true, radius: 0.012, segs: 60 }), kit.add(new T.MeshPhysicalMaterial({ color: 0x2e0f07, roughness: 0.12, clearcoat: 1 }))));
    put(glaze, 0.0, 0.02);
    rings = new T.Group();
    const crust = friedCrust(T, kit, 8);
    for (let i = 0; i < 3; i++) {
      const ring = onionRing(T, kit, crust, 0.3 - i * 0.035);
      ring.position.set((i - 1) * 0.02, i * 0.085, (i - 1) * 0.015);
      ring.rotation.y = i;
      rings.add(ring);
    }
    put(rings, 0.25, 0.06);
  }
  // Garlic mayo for the zinger.
  if (isZinger) {
    const mayo = new T.Mesh(blob(T, kit, 0.3, 0.03, 0.3, { amp: 0.01, freq: 8, seed: 33 }), kit.add(new T.MeshPhysicalMaterial({ color: 0xf6efdc, roughness: 0.25, clearcoat: 0.7 })));
    put(mayo, 0.02, 0.005);
  }

  // Top bun with sesame.
  const topBunGeo = lathe(T, kit, [[0, 0], [0.4, 0], [0.445, 0.03], [0.455, 0.09], [0.425, 0.19], [0.34, 0.275], [0.19, 0.318], [0, 0.328]]);
  const topBun = new T.Mesh(topBunGeo, bunTexture(T, kit, 0.34, 9));
  const bunY = y + 0.02;
  topBun.position.y = bunY;
  stack.add(topBun);
  const seedGeo = kit.add(new T.SphereGeometry(1, 8, 6));
  const seedMat = kit.add(new T.MeshStandardMaterial({ color: 0xf0e2bd, roughness: 0.5 }));
  const dome = [[0.445, 0.03], [0.455, 0.09], [0.425, 0.19], [0.34, 0.275], [0.19, 0.318], [0, 0.328]];
  scatter(T, kit, stack, seedGeo, seedMat, 170, (i, r) => {
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
    const flake = kit.add(new T.BoxGeometry(0.02, 0.004, 0.014));
    chilli = scatter(T, kit, stack, flake, kit.add(new T.MeshStandardMaterial({ color: 0xb01c0c, roughness: 0.6 })), 90, (i, r) => {
      const a = r() * TAU, rad = Math.sqrt(r()) * 0.42;
      return { pos: [Math.cos(a) * rad, 0.36 + 0.005, Math.sin(a) * rad], rot: [0, r() * 3, 0] };
    }, 15);
    chilli.position.y = 0;
  }

  // Extras: a third patty or a second slice of cheese (smash), and the meal's fries.
  const extraCheese = cheeseSlice(T, kit, 0xf6b53c, 0.84);
  extraCheese.position.y = 0.4;
  extraCheese.visible = false;
  const fries = friesCarton(T, kit, { seed: 6 });
  fries.position.set(0.86, 0.05, -0.16);
  fries.scale.setScalar(0.9);
  inner.add(fries);

  const apply = (s: Sel) => {
    fries.visible = s.meal === 1;
    if (isZinger && chilli) chilli.count = [0, 34, 90][s.spice ?? 1] ?? 34;
  };
  return assemble(T, kit, inner, { sel, apply, shadow: [2.0, 1.7] });
}
