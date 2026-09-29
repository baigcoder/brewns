// @ts-nocheck
/* Pizza, pasta, rolls, fries, tenders and garlic bread: procedural 3D models
   for the kitchen menu. Built with the tools in foodKit.ts. */
import type * as THREE from 'three';
import { Kit, assemble, blob, clamp01, displace, draw, dipCup, fbm, hex, lathe, leaf, mix, paint, paperSheet, plate, rng, roundBox, ruffle, scatter, surface, sweep, woodBoard } from './foodKit';
import { friedCrust, friesCarton } from './foodModels3d';
import type { VariantEngine } from './pdp3dEngine';

type Sel = Record<string, number>;
const TAU = Math.PI * 2;
const V = (T: typeof THREE, x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const crustLook = (T: typeof THREE, kit: Kit, seed = 3) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const n = fbm(u * 8, v * 8, seed, 4, seed);
      const blister = smoothstep(0.58, 0.72, fbm(u * 6, v * 6, seed + 5, 3, seed + 3));
      let c = mix([206, 146, 72], [184, 116, 48], n);
      c = mix(c, [92, 44, 16], blister * 0.85);
      const flour = smoothstep(0.7, 0.9, fbm(u * 30, v * 30, 2, 2, 8));
      c = mix(c, [232, 208, 168], flour * 0.28);
      return [c[0], c[1], c[2], 0.35 + n * 0.4 + blister * 0.25];
    }),
    { roughness: 0.6, bumpScale: 4 },
  );

/** A piece of grilled chicken with char marks. */
const chickenPiece = (T: typeof THREE, kit: Kit, mat: THREE.Material, rx = 0.06, ry = 0.03, rz = 0.045, seed = 3) => new T.Mesh(blob(T, kit, rx, ry, rz, { amp: 0.008, freq: 14, seed }), mat);

const grilledMaterial = (T: typeof THREE, kit: Kit, base = [206, 152, 88]) =>
  surface(
    T,
    kit,
    paint(T, kit, 128, 128, (u, v) => {
      const n = fbm(u * 10, v * 10, 4, 3, 2);
      const bar = smoothstep(0.86, 0.95, Math.abs(Math.sin((u + v) * 9)));
      let c = mix(base, [236, 196, 132], n);
      c = mix(c, [64, 34, 16], bar * 0.75);
      return [c[0], c[1], c[2], 0.4 + n * 0.5 - bar * 0.2];
    }),
    { roughness: 0.55, bumpScale: 2.5 },
  );

/* ── pizza ── */

const pizzaTop = (T: typeof THREE, kit: Kit, patchy: boolean, seed: number) =>
  paint(T, kit, 512, 512, (u, v) => {
    const x = (u - 0.5) * 2, y = (v - 0.5) * 2;
    const r = Math.hypot(x, y);
    const n = fbm(x * 3.2 + 2, y * 3.2 + 2, 1, 4, seed);
    const b = fbm(x * 9, y * 9, 2, 3, seed + 1);
    const mask = patchy ? smoothstep(0.44, 0.52, n) : 1;
    let cheese = mix([232, 190, 106], [240, 208, 130], n);
    cheese = mix(cheese, [190, 112, 34], smoothstep(0.55, 0.74, b) * 0.9);
    cheese = mix(cheese, [246, 220, 150], smoothstep(0.75, 0.92, fbm(x * 16, y * 16, 6, 2, seed + 4)) * 0.4);
    const sauce = mix([176, 34, 16], [206, 58, 26], fbm(x * 12, y * 12, 3, 2, seed + 2));
    let c = mix(sauce, cheese, mask);
    c = mix(c, [170, 96, 30], smoothstep(0.86, 1, r) * 0.6);
    const a = Math.atan2(y, x);
    const cut = Math.abs(((a + Math.PI) / (TAU / 8)) % 1);
    if (Math.min(cut, 1 - cut) < 0.006) c = mix(c, [110, 60, 24], 0.55);
    return [c[0], c[1], c[2], mask * (0.45 + b * 0.5) + 0.05];
  });

/** A wood-fired Neapolitan rim: pale gold dough, blistered, with the leopard spotting of char a hot oven leaves. */
const leopardCrust = (T: typeof THREE, kit: Kit, seed = 3) =>
  surface(
    T,
    kit,
    paint(T, kit, 512, 256, (u, v) => {
      const n = fbm(u * 10, v * 5, seed, 4, seed);
      const blister = smoothstep(0.6, 0.72, fbm(u * 18, v * 9, seed + 5, 3, seed + 3));
      // Leopard spots: small round char marks, some with a paler halo.
      const s1 = fbm(u * 70, v * 35, seed + 1, 2, seed + 7) * (0.75 + 0.35 * fbm(u * 6, v * 3, seed, 2, 2));
      const spot = smoothstep(0.64, 0.7, s1);
      const halo = smoothstep(0.58, 0.66, s1) * (1 - spot);
      let c = mix([228, 184, 118], [206, 150, 82], n);
      c = mix(c, [178, 112, 50], blister * 0.7);
      c = mix(c, [150, 92, 44], halo * 0.6);
      c = mix(c, [40, 22, 12], spot * 0.92);
      const flour = smoothstep(0.72, 0.9, fbm(u * 40, v * 20, 2, 2, 8));
      c = mix(c, [240, 226, 196], flour * 0.25);
      return [c[0], c[1], c[2], 0.35 + n * 0.3 + blister * 0.3 - spot * 0.1];
    }),
    { roughness: 0.66, bumpScale: 4 },
  );

const pepperoni = (T: typeof THREE, kit: Kit) => {
  const g = lathe(T, kit, [[0, 0.004], [0.05, 0.007], [0.07, 0.016], [0.08, 0.026], [0.074, 0.027], [0.055, 0.011], [0, 0.008]], 28);
  const tex = paint(T, kit, 64, 64, (u, v) => {
    const n = fbm(u * 8, v * 8, 2, 3, 5);
    let c = mix([140, 30, 16], [176, 54, 26], n);
    c = mix(c, [214, 150, 100], smoothstep(0.74, 0.9, fbm(u * 18, v * 18, 5, 2, 3)) * 0.5);
    c = mix(c, [86, 26, 12], smoothstep(0.85, 1, v) * 0.5);
    return [c[0], c[1], c[2], n];
  });
  return { geo: g, mat: surface(T, kit, tex, { roughness: 0.5, bumpScale: 1.5, physical: true, clearcoat: 0.25, clearcoatRoughness: 0.4, side: T.DoubleSide }) };
};

export function createPizzaModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const isMarg = id === 'margherita-pizza';
  const isPep = id === 'pepperoni-pizza';
  const seed = isMarg ? 3 : isPep ? 7 : 11;

  // Served straight on the table, as photographed: no board.
  const pizza = new T.Group();
  inner.add(pizza);

  const crust = leopardCrust(T, kit, seed);
  const baseGeo = kit.add(new T.CylinderGeometry(0.62, 0.62, 0.05, 72));
  const base = new T.Mesh(baseGeo, crust);
  base.position.y = 0.025;
  pizza.add(base);
  // A puffed, uneven cornicione: fat in places, pinched in others.
  const rimGeo = kit.add(new T.TorusGeometry(0.585, 0.095, 24, 96));
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.scale(1, 0.85, 1);
  displace(rimGeo, 0.034, 4.5, seed);
  const rim = new T.Mesh(rimGeo, crust);
  rim.position.y = 0.07;
  pizza.add(rim);
  // Cheese-stuffed crust: a fatter, bumpier rim.
  const stuffedGeo = kit.add(new T.TorusGeometry(0.6, 0.1, 22, 84));
  stuffedGeo.rotateX(Math.PI / 2);
  displace(stuffedGeo, 0.026, 8, seed + 4);
  const stuffed = new T.Mesh(stuffedGeo, crust);
  stuffed.position.y = 0.075;
  pizza.add(stuffed);

  const topTex = pizzaTop(T, kit, isMarg, seed);
  const topGeo = kit.add(new T.CircleGeometry(0.565, 96, 0, TAU));
  topGeo.rotateX(-Math.PI / 2);
  const tp = topGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, (fbm(tp.getX(i) * 6, tp.getZ(i) * 6, 0, 3, seed) - 0.4) * 0.03);
  topGeo.computeVertexNormals();
  const top = new T.Mesh(topGeo, surface(T, kit, topTex, { roughness: 0.55, bumpScale: 3, physical: true, clearcoat: 0.18, clearcoatRoughness: 0.5 }));
  top.position.y = 0.06;
  pizza.add(top);

  const R = rng(seed);
  const spots = (n: number, radius: number, minD: number) => {
    const out: number[][] = [];
    for (let tries = 0; out.length < n && tries < n * 60; tries++) {
      const a = R() * TAU, rr = Math.sqrt(R()) * radius;
      const p = [Math.cos(a) * rr, Math.sin(a) * rr];
      if (out.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > minD)) out.push(p);
    }
    return out;
  };
  const topY = 0.072;

  if (isPep) {
    const pep = pepperoni(T, kit);
    spots(30, 0.5, 0.13).forEach(([x, z], i) => {
      const m = new T.Mesh(pep.geo, pep.mat);
      m.position.set(x, topY, z);
      m.rotation.y = R() * TAU;
      m.scale.setScalar(0.9 + R() * 0.2);
      pizza.add(m);
    });
  } else if (isMarg) {
    // Fior di latte melts into flat, milky pools, browned a little at the edges.
    const mozz = kit.add(new T.MeshPhysicalMaterial({ color: 0xf6efe0, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.5, sheenColor: new T.Color(0xffffff) }));
    spots(9, 0.44, 0.19).forEach(([x, z], i) => {
      const m = new T.Mesh(blob(T, kit, 0.1 + R() * 0.03, 0.014, 0.09 + R() * 0.03, { amp: 0.018, freq: 7, seed: 40 + i }), mozz);
      m.position.set(x, topY - 0.002, z);
      m.rotation.y = R() * TAU;
      pizza.add(m);
    });
    const leafGeo = leaf(T, kit, 0.16, 0.1, 0.35);
    const leafMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x2f7a22, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2, side: T.DoubleSide }));
    spots(9, 0.44, 0.17).forEach(([x, z], i) => {
      const m = new T.Mesh(leafGeo, leafMat);
      m.position.set(x, topY + 0.03 + R() * 0.01, z);
      m.rotation.set((R() - 0.5) * 0.4, R() * TAU, (R() - 0.5) * 0.3);
      pizza.add(m);
    });
  } else {
    // Fajita: chicken, peppers and onion.
    const chick = grilledMaterial(T, kit, [204, 140, 74]);
    spots(15, 0.46, 0.12).forEach(([x, z], i) => {
      const m = chickenPiece(T, kit, chick, 0.055, 0.03, 0.045, 60 + i);
      m.position.set(x, topY + 0.02, z);
      m.rotation.y = R() * TAU;
      pizza.add(m);
    });
    const strip = (tone: number, n: number, seedOff: number) => {
      const mat = kit.add(new T.MeshPhysicalMaterial({ color: tone, roughness: 0.3, clearcoat: 0.5, side: T.DoubleSide }));
      spots(n, 0.44, 0.14).forEach(([x, z], i) => {
        const a = R() * TAU;
        const pts = [0, 1, 2, 3].map((k) => V(T, Math.cos(a + k * 0.5) * 0.11 - 0.16 + k * 0.1, topY + 0.02 + Math.sin(k * 1.1) * 0.012, Math.sin(a + k * 0.5) * 0.06));
        const m = new T.Mesh(sweep(T, kit, new T.CatmullRomCurve3(pts), { width: 0.034, thick: 0.014, segs: 12 }), mat);
        m.position.set(x, 0, z);
        m.rotation.y = R() * TAU;
        pizza.add(m);
      });
    };
    strip(0x2f8f2e, 11, 1);
    strip(0xd2301f, 10, 2);
    strip(0xefe4f0, 9, 3);
    const dust = kit.add(new T.BoxGeometry(0.016, 0.004, 0.011));
    scatter(T, kit, pizza, dust, kit.add(new T.MeshStandardMaterial({ color: 0xb03a14, roughness: 0.7 })), 70, (i, r) => {
      const a = r() * TAU, rr = Math.sqrt(r()) * 0.5;
      return { pos: [Math.cos(a) * rr, topY + 0.03, Math.sin(a) * rr], rot: [0, r() * 3, 0] };
    }, 19);
  }

  const apply = (s: Sel) => {
    const size = [0.8, 1, 1.2][s.size ?? 1] ?? 1;
    pizza.scale.set(size / 1.14, 1, size / 1.14);
    const cheeseCrust = s.crust === 1;
    stuffed.visible = cheeseCrust;
    rim.visible = !cheeseCrust;
  };
  // Built for the biggest size and the fattest crust, so the fit holds for every choice.
  pizza.scale.set(1, 1, 1);
  return assemble(T, kit, inner, { sel, apply, steam: { count: 22, height: 0.05, on: () => true }, shadow: [2.3, 2.1] });
}

/* ── pasta ── */

const sauceLook = {
  'alfredo-pasta': { noodle: 0xecd6a2, sauce: 0xf1e2b4 },
  'arrabbiata-pasta': { noodle: 0xd4622e, sauce: 0xa8321a },
  'pesto-pasta': { noodle: 0x8ea336, sauce: 0x4e6a22 },
};

export function createPastaModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const look = sauceLook[id];
  const R = rng(id.length * 13);

  // The bowl.
  const bowlGeo = lathe(T, kit, [[0, 0], [0.22, 0], [0.3, 0.02], [0.52, 0.12], [0.68, 0.29], [0.705, 0.33], [0.69, 0.34], [0.66, 0.325], [0.5, 0.18], [0.3, 0.07], [0, 0.06]], 80);
  // Dark grey stoneware, speckled, as in the photographs; the rim where the glaze thins goes paler.
  const bowlTex = paint(T, kit, 512, 256, (u, v) => {
    const n = fbm(u * 14, v * 8, 2, 4, 5);
    const speck = smoothstep(0.78, 0.88, fbm(u * 140, v * 70, 4, 2, 9));
    let c = mix([54, 56, 58], [72, 74, 76], n);
    c = mix(c, [130, 128, 122], smoothstep(0.52, 0.6, v) * smoothstep(0.66, 0.58, v) * 0.7);
    c = mix(c, [170, 164, 150], speck * 0.5);
    return [c[0], c[1], c[2], 0.4 + n * 0.3 + speck * 0.3];
  });
  const bowl = new T.Mesh(bowlGeo, surface(T, kit, bowlTex, { physical: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3, bumpScale: 0.8, side: T.DoubleSide }));
  inner.add(bowl);
  const pool = new T.Mesh(kit.add(new T.CircleGeometry(0.46, 40)), kit.add(new T.MeshPhysicalMaterial({ color: look.sauce, roughness: 0.25, clearcoat: 0.8 })));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.075;
  inner.add(pool);

  const mound = new T.Group();
  inner.add(mound);
  const heightAt = (r: number) => 0.09 + 0.3 * Math.sqrt(Math.max(0, 1 - (r / 0.56) * (r / 0.56)));
  const noodleMat = kit.add(new T.MeshPhysicalMaterial({ color: look.noodle, roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.25, side: T.DoubleSide }));

  if (id === 'alfredo-pasta') {
    // Fettuccine: long flat ribbons looping over the mound.
    for (let i = 0; i < 74; i++) {
      const a0 = R() * TAU, r0 = 0.06 + R() * 0.38;
      const dir = R() < 0.5 ? -1 : 1;
      const pts = Array.from({ length: 7 }, (_, k) => {
        const a = a0 + dir * k * (0.5 + R() * 0.25);
        const r = Math.max(0.04, Math.min(0.47, r0 + Math.sin(k * 1.3 + i) * 0.11));
        return V(T, Math.cos(a) * r, heightAt(r) + (R() - 0.5) * 0.05 + Math.sin(k * 1.9 + i) * 0.025, Math.sin(a) * r);
      });
      mound.add(new T.Mesh(sweep(T, kit, new T.CatmullRomCurve3(pts), { width: 0.058, thick: 0.012, segs: 42 }), noodleMat));
    }
  } else {
    const one = id === 'arrabbiata-pasta'
      ? (() => {
          // Penne: ridged tubes cut at an angle.
          const g = kit.add(new T.CylinderGeometry(0.036, 0.036, 0.17, 18, 1, true));
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
            const ang = Math.atan2(z, x);
            const k = 1 + 0.07 * Math.sin(ang * 14);
            p.setXYZ(i, x * k, y + x * 0.8 * Math.sign(y), z * k);
          }
          g.computeVertexNormals();
          return g;
        })()
      : (() => {
          // Fusilli: a tube wound into a spiral.
          class Helix extends T.Curve {
            getPoint(t, target = new T.Vector3()) {
              return target.set(Math.cos(t * TAU * 3.4) * 0.024, Math.sin(t * TAU * 3.4) * 0.024, (t - 0.5) * 0.15);
            }
          }
          return kit.add(new T.TubeGeometry(new Helix(), 60, 0.016, 8, false));
        })();
    const col = new T.Color();
    // Pasta coated in its sauce: arrabbiata orange-red over golden penne, pesto a deep basil green.
    const tone = id === 'arrabbiata-pasta' ? [0.055, 0.58] : [0.2, 0.5];
    noodleMat.roughness = 0.45;
    noodleMat.clearcoat = 0.2;
    scatter(T, kit, mound, one, noodleMat, 150, (i, r) => {
      const a = r() * TAU, rr = Math.sqrt(r()) * 0.47;
      return { pos: [Math.cos(a) * rr, heightAt(rr) - 0.03 + (r() - 0.3) * 0.11, Math.sin(a) * rr], rot: [r() * 3, r() * 3, r() * 3], color: col.setHSL(tone[0] + r() * 0.025, tone[1], 0.4 + r() * 0.16).getHex() };
    }, 23);
  }

  // Toppings.
  const top = new T.Group();
  mound.add(top);
  const chick = grilledMaterial(T, kit);
  // A grilled breast, sliced across and fanned out over the top, each slice leaning on the one before.
  const sliceGeo = displace(roundBox(T, kit, 0.075, 0.1, 0.22, 0.025, 8), 0.005, 18, 7);
  const chickenAt = (n: number, radius: number, y = 0.4) => {
    const g = new T.Group();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const m = new T.Mesh(sliceGeo, chick);
      m.position.set(t * 0.3, y + Math.cos(t * 2) * 0.015, t * t * 0.16 - 0.02);
      m.rotation.set(0, t * 0.4, -1.0);
      g.add(m);
    }
    g.rotation.y = 0.5;
    return g;
  };
  const herb = kit.add(new T.PlaneGeometry(0.024, 0.014));
  herb.rotateX(-Math.PI / 2);
  const herbMat = kit.add(new T.MeshStandardMaterial({ color: 0x4d9a2c, roughness: 0.6, side: T.DoubleSide }));
  const speck = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, seed: number, dy = 0.02) =>
    scatter(T, kit, top, geo, mat, n, (i, r) => {
      const a = r() * TAU, rr = Math.sqrt(r()) * 0.46;
      return { pos: [Math.cos(a) * rr, heightAt(rr) + dy, Math.sin(a) * rr], rot: [0, r() * 3, 0] };
    }, seed);

  let proteinSets: THREE.Object3D[] = [];
  let chickenOptional: THREE.Object3D | null = null;
  let hotChilli: THREE.InstancedMesh | null = null;

  if (id === 'alfredo-pasta') {
    const chicken = chickenAt(5, 0.17, 0.445);
    const mush = new T.Group();
    const mushMat = kit.add(new T.MeshStandardMaterial({ color: 0xcdb08a, roughness: 0.55 }));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const m = new T.Mesh(blob(T, kit, 0.07, 0.02, 0.05, { amp: 0.006, freq: 12, seed: 90 + i }), mushMat);
      m.position.set(Math.cos(a) * 0.17, 0.44 + (i % 2) * 0.012, Math.sin(a) * 0.15);
      m.rotation.y = a;
      mush.add(m);
    }
    const prawn = new T.Group();
    const prawnMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xea8a54, roughness: 0.3, clearcoat: 0.7 }));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.3;
      const curve = new T.CatmullRomCurve3([V(T, -0.1, 0, 0), V(T, -0.06, 0.05, 0.03), V(T, 0.03, 0.07, 0.03), V(T, 0.09, 0.03, 0)]);
      const m = new T.Mesh(sweep(T, kit, curve, { round: true, radius: 0.034, segs: 20 }), prawnMat);
      m.position.set(Math.cos(a) * 0.2, 0.41, Math.sin(a) * 0.19);
      m.rotation.y = -a + 1;
      prawn.add(m);
    }
    top.add(chicken, mush, prawn);
    proteinSets = [chicken, mush, prawn];
    speck(herb, herbMat, 46, 31);
    speck(kit.add(new T.SphereGeometry(0.006, 6, 4)), kit.add(new T.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.6 })), 70, 32, 0.012);
  } else if (id === 'arrabbiata-pasta') {
    chickenOptional = chickenAt(5, 0.17, 0.45);
    top.add(chickenOptional);
    // A fork resting against the bowl, as in the photo.
    const steel = kit.add(new T.MeshStandardMaterial({ color: 0xc8cacd, metalness: 1, roughness: 0.25 }));
    const fork = new T.Group();
    const handleCurve = new T.CatmullRomCurve3([V(T, 0, 0, 0), V(T, 0.2, 0.03, 0), V(T, 0.45, 0.02, 0)]);
    fork.add(new T.Mesh(sweep(T, kit, handleCurve, { width: 0.04, thick: 0.012, segs: 30 }), steel));
    for (let k = 0; k < 4; k++) {
      const tine = new T.Mesh(kit.add(new T.BoxGeometry(0.12, 0.008, 0.007)), steel);
      tine.position.set(-0.06, -0.004, (k - 1.5) * 0.011);
      fork.add(tine);
    }
    fork.position.set(-0.8, 0.02, 0.35);
    fork.rotation.set(0, 0.6, -0.05);
    inner.add(fork);
    const leafGeo = leaf(T, kit, 0.15, 0.085, 0.5);
    const leafMat = kit.add(new T.MeshStandardMaterial({ color: 0x3f8a2b, roughness: 0.42, side: T.DoubleSide }));
    [[0.02, 0.05], [-0.1, -0.08], [0.11, -0.05]].forEach(([x, z], i) => {
      const m = new T.Mesh(leafGeo, leafMat);
      m.position.set(x, 0.43 + i * 0.006, z);
      m.rotation.set(0.1, i * 2.1, 0.1);
      top.add(m);
    });
    speck(kit.add(new T.BoxGeometry(0.014, 0.004, 0.009)), kit.add(new T.MeshStandardMaterial({ color: 0xc02a10, roughness: 0.6 })), 60, 33, 0.014);
    hotChilli = speck(kit.add(new T.TorusGeometry(0.018, 0.005, 6, 12)), kit.add(new T.MeshStandardMaterial({ color: 0xd42c12, roughness: 0.4 })), 26, 34, 0.02);
  } else {
    chickenOptional = chickenAt(5, 0.17, 0.445);
    top.add(chickenOptional);
    const tomMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xd42a1c, roughness: 0.25, clearcoat: 0.8 }));
    const halfGeo = kit.add(new T.SphereGeometry(0.075, 18, 12, 0, TAU, 0, Math.PI / 2));
    const cutMat = kit.add(new T.MeshStandardMaterial({ color: 0xf0a08a, roughness: 0.4 }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.2;
      const t = new T.Group();
      t.add(new T.Mesh(halfGeo, tomMat));
      const face = new T.Mesh(kit.add(new T.CircleGeometry(0.075, 18)), cutMat);
      face.rotation.x = Math.PI / 2;
      t.add(face);
      t.position.set(Math.cos(a) * 0.3, heightAt(0.3) + 0.03, Math.sin(a) * 0.27);
      t.rotation.set(0.2, a, 0.3);
      top.add(t);
    }
    const shave = leaf(T, kit, 0.11, 0.05, 1.1);
    const parm = kit.add(new T.MeshStandardMaterial({ color: 0xf5e8c4, roughness: 0.55, side: T.DoubleSide }));
    speck(shave, parm, 10, 35, 0.035);
    const nut = kit.add(new T.SphereGeometry(0.014, 8, 6));
    nut.scale(1.5, 0.7, 0.8);
    speck(nut, kit.add(new T.MeshStandardMaterial({ color: 0xefe0b0, roughness: 0.5 })), 22, 36, 0.02);
    const leafGeo = leaf(T, kit, 0.15, 0.085, 0.5);
    const leafMat = kit.add(new T.MeshStandardMaterial({ color: 0x3a8a26, roughness: 0.42, side: T.DoubleSide }));
    const bl = new T.Mesh(leafGeo, leafMat);
    bl.position.set(0, 0.44, 0);
    top.add(bl);
  }

  const apply = (s: Sel) => {
    if (id === 'alfredo-pasta') proteinSets.forEach((o, i) => (o.visible = (s.protein ?? 0) === i));
    if (id === 'arrabbiata-pasta') {
      chickenOptional.visible = s.add === 1;
      hotChilli.count = [0, 10, 26][s.spice ?? 1] ?? 10;
    }
    if (id === 'pesto-pasta') chickenOptional.visible = (s.protein ?? 0) === 0;
  };
  return assemble(T, kit, inner, { sel, apply, steam: { count: 24, height: 0.05, on: () => true }, shadow: [1.9, 1.8] });
}

/* ── rolls and wraps ──
   Each half is a flatbread wound one and a bit turns round its filling and cut on a slant. The cut shows what a real
   one does: the bread's spiral with its flaky layers, the seam where the flap ends, sauce in the gap between the turns,
   and a filling that is modelled rather than painted (pieces of tikka, kebab or fried chicken, onion, herbs and a
   drizzle of chutney), so every piece stands proud of the cut and throws its own shadow. */

type RollSpec = { turns: number; gap: number; thick: number; bread: 'paratha' | 'tortilla'; base: number[][]; sauce: number; paper: string };

const ROLL_R = 0.19, ROLL_LEN = 0.6, ROLL_SLOPE = 0.55;
const ROLLS: Record<string, RollSpec> = {
  'tikka-roll': { turns: 1.2, gap: 0.03, thick: 0.02, bread: 'paratha', base: [[150, 72, 30], [112, 48, 18]], sauce: 0x5f9a2e, paper: '#8a3b16' },
  'behari-roll': { turns: 1.2, gap: 0.03, thick: 0.02, bread: 'paratha', base: [[104, 52, 24], [70, 32, 14]], sauce: 0x5c2610, paper: '#3a2a20' },
  'crispy-wrap': { turns: 1.35, gap: 0.022, thick: 0.011, bread: 'tortilla', base: [[222, 204, 160], [184, 160, 108]], sauce: 0xf1ead4, paper: '#1f3a2c' },
};

/** Height of the slanted cut at x (half-local; the cut faces −x). */
const cutY = (x: number) => ROLL_LEN / 2 + x * ROLL_SLOPE;

/** The outside of the bread: a golden, blistered lachha paratha with ghee on it, or a tortilla toasted on the tawa. */
const breadSkin = (T: typeof THREE, kit: Kit, spec: RollSpec) =>
  surface(
    T,
    kit,
    paint(T, kit, 512, 256, (u, v) => {
      const n = fbm(u * 10, v * 5, 2, 4, 9);
      const patch = smoothstep(0.42, 0.62, fbm(u * 4, v * 2, 7, 2, 11));
      const spot = smoothstep(0.58, 0.74, fbm(u * 34, v * 17, 5, 3, 3)) * (0.35 + patch * 0.65);
      const speck = smoothstep(0.74, 0.86, fbm(u * 70, v * 35, 8, 2, 6));
      let c: number[];
      let h: number;
      if (spec.bread === 'tortilla') {
        c = mix([238, 220, 178], [222, 196, 146], n);
        c = mix(c, [176, 120, 60], spot * 0.8);
        c = mix(c, [120, 76, 34], speck * 0.5);
        h = 0.5 + n * 0.2 + spot * 0.25;
      } else {
        // Lachha paratha is laminated: faint swirls of layers run round it under the blisters.
        const layers = 0.5 + 0.5 * Math.sin((u * 46 + fbm(u * 3, v * 3, 3, 2, 5) * 7) * Math.PI);
        c = mix([222, 172, 98], [196, 138, 66], n);
        c = mix(c, [238, 202, 138], layers * 0.22);
        c = mix(c, [132, 72, 28], spot * 0.85);
        c = mix(c, [86, 44, 16], speck * 0.6);
        h = 0.35 + layers * 0.25 + spot * 0.3 + n * 0.15;
      }
      return [c[0], c[1], c[2], h];
    }),
    { physical: true, roughness: 0.52, clearcoat: spec.bread === 'paratha' ? 0.22 : 0.05, clearcoatRoughness: 0.5, bumpScale: 3, side: T.DoubleSide },
  );

/** The bread in section, at the cut: pale crumb between browned faces, and for paratha, its flaky layers. */
const breadSection = (T: typeof THREE, kit: Kit, spec: RollSpec) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 64, (u, v) => {
      const edge = Math.pow(Math.abs(v - 0.5) * 2, 4);
      const flakes = spec.bread === 'paratha' ? 0.5 + 0.5 * Math.sin(v * Math.PI * 9 + fbm(u * 30, v, 1, 2, 4) * 3) : 0.5;
      let c = mix([240, 214, 162], [214, 172, 108], flakes * 0.7);
      c = mix(c, [168, 108, 48], edge * 0.8);
      return [c[0], c[1], c[2], 0.3 + flakes * 0.5];
    }),
    { roughness: 0.75, bumpScale: 2, side: T.DoubleSide },
  );

/**
 * The bread: a spiral band `thick` deep, from radius R at the flap inwards by `gap` a turn, standing from the bottom
 * to the slanted cut. Walls, the cut strip and the two ends are separate vertex runs, so their edges stay crisp.
 * Returns the geometry (group 0 skin, group 1 section) and, per angle, the radius of the innermost turn: the filling's edge.
 */
function breadGeometry(T: typeof THREE, kit: Kit, spec: RollSpec, seed: number) {
  const THETA = spec.turns * TAU;
  const NT = Math.round(spec.turns * 110), NY = 22;
  const rAt = (t: number) => ROLL_R - (spec.gap * t) / TAU;
  const bulge = (t: number, y: number) => 1 + (fbm(Math.cos(t) * 2.4 + 4, y * 5, Math.sin(t) * 2.4, 3, seed) - 0.5) * 0.1;
  // A point on the band at spiral angle t, height y and depth `inset` (0 outside, `thick` inside). `top` snaps y to the cut.
  const at = (t: number, y: number, inset: number, top = false) => {
    const r = (rAt(t) - inset) * bulge(t, y);
    const x = Math.cos(t) * r, z = Math.sin(t) * r;
    return [x, top ? cutY(x) : y, z];
  };
  const pos: number[] = [], uv: number[] = [], skin: number[] = [], section: number[] = [];
  const gridRun = (cols: number, rows: number, fn: (i: number, j: number) => number[], uvFn: (i: number, j: number) => number[], into: number[], flip = false) => {
    const base = pos.length / 3;
    for (let i = 0; i <= cols; i++)
      for (let j = 0; j <= rows; j++) {
        pos.push(...fn(i, j));
        uv.push(...uvFn(i, j));
      }
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const a = base + i * (rows + 1) + j, b = a + rows + 1;
        flip ? into.push(a, a + 1, b, b, a + 1, b + 1) : into.push(a, b, a + 1, b, b + 1, a + 1);
      }
  };
  const wallY = (t: number, j: number, inset: number) => {
    const top = at(t, ROLL_LEN / 2, inset, true)[1];
    return -ROLL_LEN / 2 + (top + ROLL_LEN / 2) * (j / NY);
  };
  const tOf = (i: number) => (i / NT) * THETA;
  for (const [inset, flip] of [[0, false], [spec.thick, true]] as const)
    gridRun(NT, NY, (i, j) => at(tOf(i), wallY(tOf(i), j, inset), inset, j === NY), (i, j) => [tOf(i) / TAU, j / NY], skin, flip);
  // The cut: a strip across the band's thickness.
  gridRun(NT, 1, (i, j) => at(tOf(i), 0, j * spec.thick, true), (i, j) => [tOf(i) / TAU * 3, j], section);
  // The two ends of the band: the flap on the outside and the tucked-in end.
  for (const t of [0, THETA]) gridRun(1, NY, (i, j) => at(t, wallY(t, j, i * spec.thick), i * spec.thick, j === NY), (i, j) => [i, j / NY], section, t > 0);
  const g = kit.add(new T.BufferGeometry());
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex([...skin, ...section]);
  g.addGroup(0, skin.length, 0);
  g.addGroup(skin.length, section.length, 1);
  g.computeVertexNormals();
  // Where the filling ends at each angle: the inside of the innermost turn of bread there.
  const fillR = (a: number) => {
    let t = ((a % TAU) + TAU) % TAU;
    while (t + TAU <= THETA) t += TAU;
    return (rAt(t) - spec.thick) * bulge(t, ROLL_LEN / 2);
  };
  // The gap between the outer turn and the one inside it, where sauce shows.
  const gapR = (a: number) => {
    const t = ((a % TAU) + TAU) % TAU;
    return t + TAU <= THETA ? [(rAt(t + TAU)) * bulge(t, ROLL_LEN / 2), (rAt(t) - spec.thick) * bulge(t, ROLL_LEN / 2)] : null;
  };
  return { geo: g, fillR, gapR, THETA };
}

/** The filling's bed at the cut: a lumpy disc of sauce and crumbs that fills the bread's spiral, just under the cut. */
function fillingBed(T: typeof THREE, kit: Kit, fillR: (a: number) => number, gapR: (a: number) => number[] | null, THETA: number) {
  const NA = 120, NR = 5;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const lump = (x: number, z: number) => (fbm(x * 18, z * 18, 3, 3, 12) - 0.5) * 0.014;
  pos.push(0, cutY(0) - 0.008, 0);
  uv.push(0.5, 0.5);
  for (let k = 1; k <= NR; k++)
    for (let a = 0; a < NA; a++) {
      const ang = (a / NA) * TAU;
      const r = fillR(ang) * (k / NR) * (k === NR ? 1.02 : 1);
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      pos.push(x, cutY(x) - 0.008 + (k === NR ? -0.006 : lump(x, z)), z);
      uv.push(0.5 + x * 2, 0.5 + z * 2);
    }
  for (let a = 0; a < NA; a++) idx.push(0, 1 + ((a + 1) % NA), 1 + a);
  for (let k = 1; k < NR; k++)
    for (let a = 0; a < NA; a++) {
      const p = 1 + (k - 1) * NA, q = 1 + k * NA, a1 = (a + 1) % NA;
      idx.push(p + a, p + a1, q + a, p + a1, q + a1, q + a);
    }
  // Sauce sunk a little way into the gap between the turns of bread.
  const gapBase = pos.length / 3;
  let run = 0;
  for (let a = 0; a <= NA; a++) {
    const ang = (a / NA) * (THETA - TAU);
    const g = gapR(ang);
    if (!g) break;
    for (const r of g) {
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      pos.push(x, cutY(x) - 0.02, z);
      uv.push(0.5 + x * 2, 0.5 + z * 2);
    }
    run++;
  }
  for (let a = 0; a < run - 1; a++) {
    const p = gapBase + a * 2;
    idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
  }
  const g = kit.add(new T.BufferGeometry());
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Greaseproof paper round the bottom of each half, crinkled, torn unevenly along the top and printed with the name. */
function paperWrap(T: typeof THREE, kit: Kit, ink: string, seed: number) {
  const H = ROLL_LEN * 0.34, N = 96, NY = 10;
  const g = kit.add(new T.CylinderGeometry(ROLL_R * 1.08, ROLL_R * 1.05, H, N, NY, true));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const up = (y + H / 2) / H;
    // Pleats where the paper was gathered round the roll, deeper towards the top, and a crumple over everything.
    const pleat = Math.sin(a * 14 + fbm(a, y * 8, 0, 2, seed) * 5) * 0.006 * up;
    const crumple = (fbm(x * 30, y * 30, z * 30, 3, seed + 2) - 0.5) * 0.012;
    const k = 1 + (pleat + crumple) / ROLL_R + up * 0.03;
    const tear = y > H / 2 - 0.001 ? (fbm(a * 3, 0, 0, 3, seed + 5) - 0.5) * 0.07 + Math.sin(a) * 0.03 : 0;
    p.setXYZ(i, x * k, y + tear, z * k);
  }
  g.computeVertexNormals();
  const map = draw(T, kit, 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2eadb';
    ctx.fillRect(0, 0, w, h);
    const R = rng(seed);
    // Grease has soaked through in places.
    for (let k = 0; k < 18; k++) {
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 + R() * 60);
      gr.addColorStop(0, 'rgba(196,150,80,0.28)');
      gr.addColorStop(1, 'rgba(196,150,80,0)');
      ctx.save();
      ctx.translate(R() * w, R() * h);
      ctx.fillStyle = gr;
      ctx.fillRect(-100, -100, 200, 200);
      ctx.restore();
    }
    ctx.fillStyle = ink;
    ctx.fillRect(0, h * 0.14, w, 10);
    ctx.textAlign = 'center';
    ctx.font = 'italic bold 58px Georgia, serif';
    for (let q = 0; q < 4; q++) ctx.fillText('brewns', q * 256 + 128, h * 0.62);
  });
  map.wrapS = T.RepeatWrapping;
  const mesh = new T.Mesh(g, kit.add(new T.MeshPhysicalMaterial({ map, roughness: 0.62, sheen: 0.3, sheenColor: new T.Color(0xffffff), side: T.DoubleSide })));
  mesh.position.y = -ROLL_LEN / 2 + H / 2 - 0.004;
  return mesh;
}

/** What goes in each roll: chunk geometry and its look, plus the herbs and the chutney that go over it. */
function fillingParts(T: typeof THREE, kit: Kit, id: string) {
  const glossy = (color: number, roughness = 0.3) => kit.add(new T.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  const onion = kit.add(new T.MeshPhysicalMaterial({ color: id === 'behari-roll' ? 0xf2e6e8 : 0xe7c3d6, roughness: 0.28, clearcoat: 0.5, sheen: 0.5, sheenColor: new T.Color(0xffffff) }));
  const herb = kit.add(new T.MeshStandardMaterial({ color: 0x3f8a2c, roughness: 0.45, side: T.DoubleSide }));
  if (id === 'crispy-wrap')
    return {
      chunk: friedCrust(T, kit, 5),
      chunkShape: [0.07, 0.026, 0.028],
      extras: [
        { geo: ruffle(T, kit, 0.05, { waves: 5, amp: 0.018, seed: 2, seg: 24 }), mat: kit.add(new T.MeshStandardMaterial({ color: 0x86c14a, roughness: 0.5, side: T.DoubleSide })), count: 7, lift: 0.012, scale: [1, 1, 0.8] },
        { geo: roundBox(T, kit, 0.034, 0.024, 0.034, 0.006, 4), mat: glossy(0xd0341f, 0.25), count: 6, lift: 0.018, scale: [1, 1, 1] },
      ],
      drizzle: glossy(0xf4eedb, 0.22),
    };
  const meat =
    id === 'behari-roll'
      ? surface(T, kit, paint(T, kit, 128, 128, (u, v) => {
          const n = fbm(u * 9, v * 9, 3, 3, 7);
          const char = smoothstep(0.62, 0.78, fbm(u * 16, v * 16, 1, 2, 2));
          let c = mix([118, 58, 26], [82, 36, 14], n);
          c = mix(c, [40, 18, 8], char * 0.8);
          return [c[0], c[1], c[2], 0.3 + n * 0.5 + char * 0.2];
        }), { physical: true, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.3, bumpScale: 4 })
      : surface(T, kit, paint(T, kit, 128, 128, (u, v) => {
          const n = fbm(u * 9, v * 9, 4, 3, 2);
          const char = smoothstep(0.64, 0.8, fbm(u * 14, v * 14, 6, 2, 5));
          let c = mix([196, 92, 38], [158, 62, 24], n);
          c = mix(c, [226, 142, 76], smoothstep(0.55, 0.3, n) * 0.35);
          c = mix(c, [52, 22, 10], char * 0.9);
          return [c[0], c[1], c[2], 0.3 + n * 0.4 + char * 0.3];
        }), { physical: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.35, bumpScale: 4 });
  const arc = kit.add(new T.TorusGeometry(0.034, 0.0055, 6, 18, Math.PI * 1.1));
  arc.rotateX(Math.PI / 2);
  return {
    chunk: meat,
    chunkShape: id === 'behari-roll' ? [0.07, 0.018, 0.024] : [0.042, 0.028, 0.036],
    extras: [
      { geo: arc, mat: onion, count: 8, lift: 0.016, scale: [1, 1, 1] },
      { geo: leaf(T, kit, 0.036, 0.026, 0.25), mat: herb, count: 8, lift: 0.03, scale: [1, 1, 1] },
    ],
    drizzle: glossy(id === 'behari-roll' ? 0x5c2610 : 0x69a534, 0.22),
  };
}

/** Cheese melted over the filling: a thin sheet with a ragged edge, sagging between the pieces under it. */
function meltedSheet(T: typeof THREE, kit: Kit, fillR: (a: number) => number, seed: number) {
  const g = kit.add(new T.CircleGeometry(1, 72, 0, TAU));
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    const edge = fillR(a) * (0.55 + fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, 3, seed) * 0.55);
    const X = Math.cos(a) * r * edge, Z = Math.sin(a) * r * edge;
    p.setXYZ(i, X, (fbm(X * 22, Z * 22, 1, 2, seed + 4) - 0.5) * 0.02 - r * r * 0.012, Z);
  }
  g.computeVertexNormals();
  return g;
}

export function createRollModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const spec = ROLLS[id] || ROLLS['tikka-roll'];

  const slab = woodBoard(T, kit, 0.8, 0.05, { rect: [1.6, 1.0], tone: [58, 54, 50] });
  inner.add(slab);
  const skinMat = breadSkin(T, kit, spec);
  const sectionMat = breadSection(T, kit, spec);
  const bedMat = surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const n = fbm(u * 14, v * 14, 1, 3, 3);
      const bit = smoothstep(0.7, 0.8, fbm(u * 40, v * 40, 2, 2, 8));
      let c = mix(spec.base[0], spec.base[1], n);
      c = mix(c, id === 'crispy-wrap' ? [110, 170, 70] : [70, 120, 44], bit * 0.5);
      return [c[0], c[1], c[2], n];
    }),
    { physical: true, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3, bumpScale: 3 },
  );
  const parts = fillingParts(T, kit, id);
  // Cut meat has faces and edges: rounded boxes, roughened, rather than balls.
  const chunkGeos = [0, 1].map((k) => {
    const [w, h, d] = parts.chunkShape;
    const g = roundBox(T, kit, w * 2, h * 2, d * 2, Math.min(w, h, d) * 0.55, 8);
    return displace(g, Math.min(w, h, d) * 0.22, 34, 3 + k * 5);
  });
  const chilliGeo = kit.add(new T.TorusGeometry(0.014, 0.0055, 8, 16));
  chilliGeo.rotateX(Math.PI / 2);
  const chilliMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x3f8a22, roughness: 0.3, clearcoat: 0.6 }));
  const cheeseMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xf3d77e, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new T.Color(0xfff0c0), side: T.DoubleSide }));

  // The cut's surface: turn things lying flat so they lie on the slant instead.
  const n = V(T, -ROLL_SLOPE, 1, 0).normalize();
  const tilt = new T.Quaternion().setFromAxisAngle(V(T, 0, 0, 1), Math.atan(ROLL_SLOPE));
  const onCut = (x: number, z: number, lift: number, e: number[] = [0, 0, 0]) => ({
    pos: [x + n.x * lift, cutY(x) + n.y * lift, z + n.z * lift],
    quat: tilt.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(e[0], e[1], e[2]))),
  });
  const inDisc = (r: () => number, fillR: (a: number) => number, k = 0.82) => {
    const a = r() * TAU, d = Math.sqrt(r()) * k;
    return [Math.cos(a) * fillR(a) * d, Math.sin(a) * fillR(a) * d];
  };

  const halves: { chilli: THREE.InstancedMesh; cheese: THREE.Object3D }[] = [];
  const half = (seed: number) => {
    const g = new T.Group();
    const bread = breadGeometry(T, kit, spec, seed);
    g.add(new T.Mesh(bread.geo, [skinMat, sectionMat]));
    g.add(new T.Mesh(fillingBed(T, kit, bread.fillR, bread.gapR, bread.THETA), bedMat));
    // The filling, standing proud of the cut, and a piece or two slumped over the low edge.
    chunkGeos.forEach((geo, k) =>
      scatter(T, kit, g, geo, parts.chunk, 6, (i, r) => {
        const spill = i === 0 && k === 0;
        const [x, z] = spill ? [-bread.fillR(Math.PI) * 0.95, (r() - 0.5) * 0.08] : inDisc(r, bread.fillR);
        const s = 0.8 + r() * 0.4;
        return { ...onCut(x, z, parts.chunkShape[1] * (spill ? -0.2 : 0.35), [(r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.5 + (spill ? 0.5 : 0)]), scale: [s, 0.85 + r() * 0.3, s] };
      }, seed + k * 13),
    );
    parts.extras.forEach((x, k) =>
      scatter(T, kit, g, x.geo, x.mat, x.count, (i, r) => {
        const [px, pz] = inDisc(r, bread.fillR, 0.88);
        const s = 0.75 + r() * 0.5;
        return { ...onCut(px, pz, x.lift, [(r() - 0.5) * 0.6, r() * TAU, (r() - 0.5) * 0.6]), scale: [x.scale[0] * s, x.scale[1] * s, x.scale[2] * s] };
      }, seed + 30 + k * 7),
    );
    // A zigzag of chutney or mayo across the top.
    const R = rng(seed + 50);
    const pts = [];
    for (let k = 0; k < 7; k++) {
      const along = (k / 6 - 0.5) * 1.5 * bread.fillR(Math.PI / 2);
      const across = (k % 2 ? 1 : -1) * bread.fillR(0) * (0.45 + R() * 0.25);
      const p = onCut(across, along, 0.028 + R() * 0.006).pos;
      pts.push(V(T, p[0], p[1], p[2]));
    }
    g.add(new T.Mesh(sweep(T, kit, new T.CatmullRomCurve3(pts), { width: 0.016, thick: 0.006, segs: 120 }), parts.drizzle));
    // Green chilli rings on top, by spice level.
    const chilli = scatter(T, kit, g, chilliGeo, chilliMat, 6, (i, r) => {
      const [x, z] = inDisc(r, bread.fillR, 0.75);
      return { ...onCut(x, z, 0.036, [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5]), scale: 0.8 + r() * 0.4 };
    }, seed + 70);
    // Cheese melted over the filling, when asked for.
    const cheese = new T.Mesh(meltedSheet(T, kit, bread.fillR, seed), cheeseMat);
    const c = onCut(0, 0, 0.026);
    cheese.position.set(c.pos[0], c.pos[1], c.pos[2]);
    cheese.quaternion.copy(c.quat);
    g.add(cheese);
    halves.push({ chilli, cheese });
    g.add(paperWrap(T, kit, spec.paper, seed));
    g.position.y = ROLL_LEN / 2 + 0.058;
    return g;
  };
  // Stood side by side, each cut turned out to the front so both show.
  const a = half(3);
  a.position.set(-0.3, a.position.y, -0.02);
  a.rotation.set(0, Math.PI / 2 - 0.55, -0.03);
  const b = half(9);
  b.position.set(0.3, b.position.y, 0.08);
  b.rotation.set(0, Math.PI / 2 + 0.55, 0.04);
  inner.add(a, b);

  // On the board: a pot of the roll's chutney and a few rings of onion.
  const dip = dipCup(T, kit, parts.drizzle.color.getHex(), 0.1);
  dip.group.position.set(0.6, 0.058, 0.3);
  inner.add(dip.group);
  // Onion sliced across: each slice is a few rings one inside the other, lying where they fell.
  const ringGeo = kit.add(new T.TorusGeometry(1, 0.16, 8, 40));
  ringGeo.rotateX(Math.PI / 2);
  ringGeo.scale(1, 0.55, 1);
  const slices = [[-0.56, 0.3, 0.058], [-0.44, 0.36, 0.05], [-0.62, 0.18, 0.046]];
  scatter(T, kit, inner, ringGeo, kit.add(new T.MeshPhysicalMaterial({ color: 0xf0dde6, roughness: 0.25, clearcoat: 0.6, sheen: 0.5, sheenColor: new T.Color(0xc9a0c0) })), 9, (i, r) => {
    const [x, z, big] = slices[Math.floor(i / 3)];
    const k = i % 3;
    const rad = big * (1 - k * 0.3);
    return { pos: [x + (r() - 0.5) * 0.01, 0.06 + rad * 0.09 + (k === 2 ? 0.006 : 0), z + (r() - 0.5) * 0.01], rot: [(r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08], scale: [rad * (1 + (r() - 0.5) * 0.1), rad * 0.9, rad] };
  }, 21);

  const apply = (s: Sel) => {
    halves.forEach((h) => {
      h.chilli.count = [0, 3, 6][s.spice ?? 1] ?? 3;
      h.cheese.visible = s.cheese === 1;
    });
  };
  return assemble(T, kit, inner, { sel, apply, steam: { count: 18, height: 0.03, on: () => true }, shadow: [2.0, 1.4] });
}

/* ── fries, tenders, garlic bread ── */

export function createFriesModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const board = woodBoard(T, kit, 0.8, 0.045, { rect: [1.5, 1.0] });
  inner.add(board);
  const carton = friesCarton(T, kit, { truffle: true, seed: 2 });
  carton.position.set(-0.22, 0.05, 0);
  carton.scale.setScalar(1.15);
  inner.add(carton);
  const cups = [dipCup(T, kit, 0xf3eddc, 0.12), dipCup(T, kit, 0xf3eddc, 0.12)];
  cups[0].group.position.set(0.42, 0.05, -0.12);
  cups[1].group.position.set(0.44, 0.05, 0.26);
  inner.add(cups[0].group, cups[1].group);
  // A shard of parmesan on the board.
  const shard = new T.Mesh(kit.add(new T.BoxGeometry(0.1, 0.03, 0.06)), kit.add(new T.MeshStandardMaterial({ color: 0xf0e0b2, roughness: 0.6 })));
  shard.position.set(0.05, 0.065, 0.36);
  shard.rotation.y = 0.5;
  inner.add(shard);
  const apply = (s: Sel) => {
    const colors = [0xf3eddc, 0xe2683a, 0xf3eddc];
    cups[0].mat.color.setHex(colors[s.dip ?? 0]);
    cups[1].group.visible = s.dip === 2;
  };
  return assemble(T, kit, inner, { sel, apply, steam: { count: 22, height: 0.02, on: () => true }, shadow: [2.0, 1.4] });
}

export function createTendersModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const board = woodBoard(T, kit, 0.8, 0.045, { rect: [1.6, 1.05], tone: [58, 54, 50] });
  inner.add(board);
  const paper = paperSheet(T, kit, 1.1, 0.8);
  paper.position.set(-0.1, 0.05, 0);
  paper.rotation.y = 0.3;
  inner.add(paper);
  const crust = friedCrust(T, kit, 12);
  const strips = new T.Group();
  const layout = [[-0.06, 0.06, -0.2, 0.16, 0], [-0.02, 0.06, 0.05, -0.08, 0], [0.04, 0.06, 0.3, 0.1, 0], [0.0, 0.15, -0.04, -0.28, 0.06]];
  layout.forEach(([x, y, z, rot, tilt], i) => {
    const m = new T.Mesh(blob(T, kit, 0.3, 0.075, 0.105, { amp: 0.04, freq: 8, seed: 50 + i, seg: 60 }), crust);
    m.position.set(x, y + 0.05, z);
    m.rotation.set(tilt, rot, (i - 1.5) * 0.05);
    strips.add(m);
  });
  inner.add(strips);
  const chilliGeo = kit.add(new T.BoxGeometry(0.016, 0.004, 0.01));
  const chilli = scatter(T, kit, inner, chilliGeo, kit.add(new T.MeshStandardMaterial({ color: 0xb01c0c, roughness: 0.6 })), 70, (i, r) => ({ pos: [(r() - 0.5) * 0.5 - 0.05, 0.24 + r() * 0.02, (r() - 0.5) * 0.56], rot: [0, r() * 3, 0] }), 4);
  const cupA = dipCup(T, kit, 0xe2a83a, 0.12);
  const cupB = dipCup(T, kit, 0x5a2312, 0.12);
  cupA.group.position.set(0.56, 0.05, -0.2);
  cupB.group.position.set(0.58, 0.05, 0.14);
  inner.add(cupA.group, cupB.group);
  const parsley = leaf(T, kit, 0.06, 0.04, 0.4);
  scatter(T, kit, inner, parsley, kit.add(new T.MeshStandardMaterial({ color: 0x4a9a2a, roughness: 0.55, side: T.DoubleSide })), 8, (i, r) => ({ pos: [(r() - 0.5) * 0.7 - 0.05, 0.2, (r() - 0.5) * 0.5], rot: [0, r() * 3, 0] }), 7);
  const apply = (s: Sel) => {
    chilli.count = [0, 24, 70][s.spice ?? 1] ?? 24;
    const ranch = s.dip === 1;
    cupA.mat.color.setHex(ranch ? 0xf1ead4 : 0xe2a83a);
    cupB.mat.color.setHex(ranch ? 0xb8341a : 0x5a2312);
  };
  return assemble(T, kit, inner, { sel, apply, steam: { count: 20, height: 0.02, on: () => true }, shadow: [2.1, 1.5] });
}

export function createGarlicBreadModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const board = woodBoard(T, kit, 0.8, 0.05, { rect: [1.7, 0.95] });
  inner.add(board);

  const crustTex = paint(T, kit, 128, 128, (u, v) => {
    const n = fbm(u * 8, v * 8, 1, 4, 3);
    const c = mix([150, 92, 38], [196, 132, 64], n);
    return [c[0], c[1], c[2], 0.4 + n * 0.5];
  });
  const crustMat = surface(T, kit, crustTex, { roughness: 0.62, bumpScale: 3 });
  const crumbMat = kit.add(new T.MeshStandardMaterial({ color: 0xe6cf9a, roughness: 0.8 }));
  const meltTex = paint(T, kit, 128, 128, (u, v) => {
    const n = fbm(u * 6, v * 5, 2, 4, 6);
    const b = fbm(u * 14, v * 12, 3, 3, 2);
    let c = mix([238, 200, 108], [246, 218, 136], n);
    c = mix(c, [176, 100, 36], smoothstep(0.55, 0.72, b) * 0.9);
    const herb = smoothstep(0.78, 0.84, fbm(u * 26, v * 22, 5, 2, 9));
    c = mix(c, [74, 140, 42], herb * 0.9);
    return [c[0], c[1], c[2], 0.35 + b * 0.6];
  });
  const meltMat = surface(T, kit, meltTex, { roughness: 0.34, bumpScale: 2.5, physical: true, clearcoat: 0.55, clearcoatRoughness: 0.3 });

  const chunks = new T.Group();
  const count = 7, len = 0.15, wid = 0.42, hgt = 0.2;
  const bodyGeo = kit.add(new T.CylinderGeometry(1, 1, len, 30, 1, false, Math.PI / 2, Math.PI));
  bodyGeo.rotateZ(Math.PI / 2);
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.scale(1, hgt, wid / 2);
  const topGeo = kit.add(new T.PlaneGeometry(len, wid, 4, 14));
  topGeo.rotateX(-Math.PI / 2);
  const tp = topGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, (fbm(tp.getX(i) * 12, tp.getZ(i) * 12, 0, 3, 5) - 0.35) * 0.05 + (1 - Math.pow(tp.getZ(i) / (wid / 2), 2)) * 0.012);
  topGeo.computeVertexNormals();
  for (let i = 0; i < count; i++) {
    const c = new T.Group();
    const body = new T.Mesh(bodyGeo, [crustMat, crumbMat, crumbMat]);
    c.add(body);
    const top = new T.Mesh(topGeo, meltMat);
    top.position.y = 0.006;
    c.add(top);
    c.position.set((i - (count - 1) / 2) * (len + 0.018), hgt + 0.05, (i % 2 ? 1 : -1) * 0.01);
    c.rotation.y = (i % 3 - 1) * 0.06;
    chunks.add(c);
  }
  inner.add(chunks);
  // A little extra melted cheese to drape between the slices.
  const extra = new T.Group();
  const cheeseMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xf6d878, roughness: 0.3, clearcoat: 0.7 }));
  for (let i = 0; i < 6; i++) {
    const m = new T.Mesh(blob(T, kit, 0.07, 0.02, 0.06, { amp: 0.008, freq: 10, seed: 70 + i }), cheeseMat);
    m.position.set((i - 2.5) * 0.17, hgt + 0.075, (i % 2 ? 0.08 : -0.08));
    extra.add(m);
  }
  inner.add(extra);
  const parsley = leaf(T, kit, 0.05, 0.03, 0.3);
  scatter(T, kit, inner, parsley, kit.add(new T.MeshStandardMaterial({ color: 0x4a9a2a, roughness: 0.55, side: T.DoubleSide })), 26, (i, r) => ({ pos: [(r() - 0.5) * 1.0, hgt + 0.08, (r() - 0.5) * 0.3], rot: [0, r() * 3, 0] }), 3);
  const apply = (s: Sel) => {
    extra.visible = s.cheese === 1;
  };
  return assemble(T, kit, inner, { sel, apply, steam: { count: 22, height: 0.02, on: () => true }, shadow: [2.2, 1.3] });
}
