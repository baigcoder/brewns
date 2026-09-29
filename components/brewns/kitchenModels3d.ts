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
    const sauce = mix([158, 30, 14], [190, 52, 22], fbm(x * 12, y * 12, 3, 2, seed + 2));
    let c = mix(sauce, cheese, mask);
    c = mix(c, [170, 96, 30], smoothstep(0.86, 1, r) * 0.6);
    const a = Math.atan2(y, x);
    const cut = Math.abs(((a + Math.PI) / (TAU / 8)) % 1);
    if (Math.min(cut, 1 - cut) < 0.006) c = mix(c, [110, 60, 24], 0.55);
    return [c[0], c[1], c[2], mask * (0.45 + b * 0.5) + 0.05];
  });

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

  const board = woodBoard(T, kit, 0.86, 0.05, { tone: [150, 104, 62] });
  inner.add(board);

  const pizza = new T.Group();
  pizza.position.y = 0.05;
  inner.add(pizza);

  const crust = crustLook(T, kit, seed);
  const baseGeo = kit.add(new T.CylinderGeometry(0.62, 0.62, 0.05, 72));
  const base = new T.Mesh(baseGeo, crust);
  base.position.y = 0.025;
  pizza.add(base);
  const rimGeo = kit.add(new T.TorusGeometry(0.6, 0.075, 22, 84));
  rimGeo.rotateX(Math.PI / 2);
  displace(rimGeo, 0.02, 7, seed);
  const rim = new T.Mesh(rimGeo, crust);
  rim.position.y = 0.062;
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
    spots(24, 0.5, 0.15).forEach(([x, z], i) => {
      const m = new T.Mesh(pep.geo, pep.mat);
      m.position.set(x, topY, z);
      m.rotation.y = R() * TAU;
      m.scale.setScalar(0.9 + R() * 0.2);
      pizza.add(m);
    });
  } else if (isMarg) {
    const mozz = kit.add(new T.MeshPhysicalMaterial({ color: 0xf8f1dc, roughness: 0.3, clearcoat: 0.6, sheen: 0.5 }));
    spots(8, 0.45, 0.2).forEach(([x, z], i) => {
      const m = new T.Mesh(blob(T, kit, 0.09, 0.03, 0.085, { amp: 0.012, freq: 9, seed: 40 + i }), mozz);
      m.position.set(x, topY + 0.005, z);
      pizza.add(m);
    });
    const leafGeo = leaf(T, kit, 0.17, 0.095, 0.5);
    const leafMat = kit.add(new T.MeshStandardMaterial({ color: 0x3f8a2b, roughness: 0.42, side: T.DoubleSide }));
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
  'arrabbiata-pasta': { noodle: 0xc2431d, sauce: 0xb5301a },
  'pesto-pasta': { noodle: 0x8ea336, sauce: 0x6f8f2c },
};

export function createPastaModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const look = sauceLook[id];
  const R = rng(id.length * 13);

  // The bowl.
  const bowlGeo = lathe(T, kit, [[0, 0], [0.22, 0], [0.3, 0.02], [0.52, 0.12], [0.68, 0.29], [0.705, 0.33], [0.69, 0.34], [0.66, 0.325], [0.5, 0.18], [0.3, 0.07], [0, 0.06]], 80);
  const bowl = new T.Mesh(bowlGeo, kit.add(new T.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.1, side: T.DoubleSide })));
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
      const a0 = R() * TAU, r0 = 0.08 + R() * 0.42;
      const dir = R() < 0.5 ? -1 : 1;
      const pts = Array.from({ length: 7 }, (_, k) => {
        const a = a0 + dir * k * (0.5 + R() * 0.25);
        const r = Math.max(0.04, Math.min(0.55, r0 + Math.sin(k * 1.3 + i) * 0.11));
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
    const tone = id === 'arrabbiata-pasta' ? [0.04, 0.7] : [0.22, 0.5];
    noodleMat.roughness = 0.45;
    noodleMat.clearcoat = 0.2;
    scatter(T, kit, mound, one, noodleMat, 96, (i, r) => {
      const a = r() * TAU, rr = Math.sqrt(r()) * 0.5;
      return { pos: [Math.cos(a) * rr, heightAt(rr) - 0.03 + (r() - 0.3) * 0.11, Math.sin(a) * rr], rot: [r() * 3, r() * 3, r() * 3], color: col.setHSL(tone[0] + r() * 0.02, tone[1], 0.3 + r() * 0.1).getHex() };
    }, 23);
  }

  // Toppings.
  const top = new T.Group();
  mound.add(top);
  const chick = grilledMaterial(T, kit);
  const chickenAt = (n: number, radius: number, y = 0.4) => {
    const g = new T.Group();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU * 0.7 + 0.4;
      const m = chickenPiece(T, kit, chick, 0.11, 0.026, 0.06, 80 + i);
      m.position.set(Math.cos(a) * radius, y + i * 0.006, Math.sin(a) * radius * 0.8);
      m.rotation.set(0.15, -a + 0.4, 0.1);
      g.add(m);
    }
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
    const halfGeo = kit.add(new T.SphereGeometry(0.05, 18, 12, 0, TAU, 0, Math.PI / 2));
    const cutMat = kit.add(new T.MeshStandardMaterial({ color: 0xf0a08a, roughness: 0.4 }));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.2;
      const t = new T.Group();
      t.add(new T.Mesh(halfGeo, tomMat));
      const face = new T.Mesh(kit.add(new T.CircleGeometry(0.05, 18)), cutMat);
      face.rotation.x = Math.PI / 2;
      t.add(face);
      t.position.set(Math.cos(a) * 0.3, 0.29, Math.sin(a) * 0.27);
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

/* ── rolls and wraps ── */

const rollFilling = (T: typeof THREE, kit: Kit, id: string) =>
  draw(T, kit, 256, 256, (ctx, w, h) => {
    const R = rng(id.length * 7);
    const blobAt = (x: number, y: number, rx: number, ry: number, rot: number, fill: string, edge?: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fill();
      if (edge) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    };
    const each = (n: number, f: (i: number) => void) => {
      for (let i = 0; i < n; i++) f(i);
    };
    const inDisc = () => {
      const a = R() * TAU, r = Math.sqrt(R()) * 108;
      return [128 + Math.cos(a) * r, 128 + Math.sin(a) * r];
    };
    if (id === 'tikka-roll') {
      ctx.fillStyle = '#c0511f';
      ctx.fillRect(0, 0, w, h);
      each(9, () => { const [x, y] = inDisc(); blobAt(x, y, 30 + R() * 8, 16 + R() * 6, R() * 3, `hsl(${12 + R() * 8},${68 + R() * 10}%,${42 + R() * 8}%)`, '#5a1e0c'); });
      each(8, () => { const [x, y] = inDisc(); blobAt(x, y, 24, 6, R() * 3, '#efd4e2', '#c99ab4'); });
      each(6, () => { const [x, y] = inDisc(); blobAt(x, y, 18, 8, R() * 3, '#5aa23a'); });
    } else if (id === 'behari-roll') {
      ctx.fillStyle = '#6d3a1f';
      ctx.fillRect(0, 0, w, h);
      each(12, () => { const [x, y] = inDisc(); blobAt(x, y, 34 + R() * 10, 8 + R() * 3, R() * 3, `hsl(${22 + R() * 6},${45 + R() * 10}%,${26 + R() * 10}%)`, '#2a1408'); });
      each(6, () => { const [x, y] = inDisc(); blobAt(x, y, 24, 5, R() * 3, '#f0e2ee', '#c8a8c0'); });
      each(4, () => { const [x, y] = inDisc(); blobAt(x, y, 20, 9, R() * 3, '#b3702c'); });
    } else {
      ctx.fillStyle = '#e9d9b4';
      ctx.fillRect(0, 0, w, h);
      each(9, () => { const [x, y] = inDisc(); blobAt(x, y, 32, 9, R() * 3, `hsl(${34 + R() * 6},${72 + R() * 10}%,${50 + R() * 8}%)`, '#8a5416'); });
      each(6, () => { const [x, y] = inDisc(); blobAt(x, y, 28, 12, R() * 3, '#7cbc48', '#4d8a2c'); });
      each(6, () => { const [x, y] = inDisc(); blobAt(x, y, 12, 12, 0, '#cf3a24'); });
    }
    // Char and juice, so it does not read as flat print.
    each(90, () => { const [x, y] = inDisc(); ctx.fillStyle = `rgba(20,10,4,${0.06 + R() * 0.1})`; ctx.fillRect(x, y, 3 + R() * 6, 2 + R() * 3); });
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(128, 128, 126, 0, TAU);
    ctx.stroke();
  });

const rollWrapper = (T: typeof THREE, kit: Kit, tortilla: boolean) =>
  surface(
    T,
    kit,
    paint(T, kit, 256, 256, (u, v) => {
      const layers = 0.5 + 0.5 * Math.sin((u * 26 + fbm(u * 4, v * 4, 3, 2, 5) * 4) * Math.PI);
      const n = fbm(u * 8, v * 6, 2, 4, 9);
      let c = tortilla ? mix([222, 186, 122], [196, 150, 84], n) : mix([206, 150, 78], [176, 118, 52], n);
      c = mix(c, tortilla ? [206, 162, 96] : [214, 160, 88], layers * 0.35);
      const char = smoothstep(0.62, 0.76, fbm(u * 9, v * 5, 5, 3, 3));
      c = mix(c, [98, 52, 20], char * 0.8);
      if (tortilla) {
        const bar = smoothstep(0.88, 0.96, Math.abs(Math.sin((u * 10 + v * 4) * Math.PI)));
        c = mix(c, [120, 74, 30], bar * 0.55);
      }
      return [c[0], c[1], c[2], 0.35 + layers * 0.3 + n * 0.3 - char * 0.2];
    }),
    { roughness: 0.55, bumpScale: 3 },
  );

export function createRollModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const tortilla = id === 'crispy-wrap';

  const slab = woodBoard(T, kit, 0.8, 0.05, { rect: [1.6, 1.0], tone: [58, 54, 50] });
  inner.add(slab);
  const wrapMat = rollWrapper(T, kit, tortilla);
  wrapMat.side = T.DoubleSide;
  const fillTex = rollFilling(T, kit, id);
  const fillMat = kit.add(new T.MeshStandardMaterial({ map: fillTex, bumpMap: fillTex, bumpScale: 2, roughness: 0.5 }));
  const paperMat = kit.add(new T.MeshStandardMaterial({ color: 0xc9a878, roughness: 0.92, side: T.DoubleSide }));

  const len = 0.6, rad = 0.19, slope = 0.55;
  const chilliGeo = kit.add(new T.TorusGeometry(0.022, 0.006, 6, 12));
  chilliGeo.rotateX(Math.PI / 2);
  const chilliMat = kit.add(new T.MeshStandardMaterial({ color: 0x3e8a2a, roughness: 0.4 }));
  const cheeseMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xf6c95a, roughness: 0.3, clearcoat: 0.6 }));
  const halves: { chilli: THREE.InstancedMesh; cheese: THREE.Object3D }[] = [];

  const half = (flip: number) => {
    const g = new T.Group();
    const tube = kit.add(new T.CylinderGeometry(rad, rad, len, 44, 10, true));
    const p = tube.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      const bulge = 1 + fbm(x * 6, y * 6, z * 6, 2, 5) * 0.06;
      p.setXYZ(i, x * bulge, y + (y > 0 ? x * slope : 0), z * bulge);
    }
    tube.computeVertexNormals();
    g.add(new T.Mesh(tube, wrapMat));
    // The cut face, following the slanted cut.
    const cap = kit.add(new T.CircleGeometry(rad * 0.985, 44));
    cap.rotateX(-Math.PI / 2);
    const cp = cap.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setY(i, len / 2 + cp.getX(i) * slope);
    cap.computeVertexNormals();
    g.add(new T.Mesh(cap, fillMat));
    // A short paper sleeve round the base, torn along its top edge.
    const sleeveGeo = kit.add(new T.CylinderGeometry(rad * 1.07, rad * 1.07, len * 0.26, 44, 4, true));
    const sp = sleeveGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) if (sp.getY(i) > 0) sp.setY(i, sp.getY(i) + (fbm(sp.getX(i) * 9, sp.getZ(i) * 9, 0, 2, 4) - 0.4) * 0.05);
    sleeveGeo.computeVertexNormals();
    const sleeve = new T.Mesh(sleeveGeo, paperMat);
    sleeve.position.y = -len / 2 + len * 0.13;
    g.add(sleeve);
    // Green chilli and melted cheese sit on the cut face.
    const chilli = scatter(T, kit, g, chilliGeo, chilliMat, 5, (i, r) => {
      const x = (r() - 0.5) * rad * 1.1, z = (r() - 0.5) * rad * 1.1;
      return { pos: [x, len / 2 + x * slope + 0.012, z], rot: [0, r() * 3, -Math.atan(slope) * 0.9], scale: 1 };
    }, 8 + Math.round(flip * 3));
    const cheese = new T.Mesh(blob(T, kit, 0.11, 0.022, 0.09, { amp: 0.008, freq: 10, seed: 6 }), cheeseMat);
    cheese.position.set(0, len / 2 + 0.02, 0);
    cheese.rotation.z = -Math.atan(slope) * 0.9;
    g.add(cheese);
    halves.push({ chilli, cheese });
    g.position.y = len / 2 + 0.06;
    g.rotation.y = flip;
    return g;
  };
  const a = half(0.5);
  a.position.set(-0.3, a.position.y, -0.04);
  a.rotation.z = -0.04;
  const b = half(-2.5);
  b.position.set(0.28, b.position.y, 0.1);
  b.rotation.z = 0.05;
  inner.add(a, b);

  const apply = (s: Sel) => {
    halves.forEach((h) => {
      h.chilli.count = [0, 2, 5][s.spice ?? 1] ?? 2;
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
