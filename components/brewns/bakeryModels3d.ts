// @ts-nocheck
/* Croissants, cheesecake, brownie, tiramisu, financier and the cooler drinks:
   procedural 3D models built with the tools in foodKit.ts. */
import type * as THREE from 'three';
import { Kit, assemble, blob, clamp01, displace, draw, dipCup, fbm, lathe, mix, paint, plate, rng, roundBox, scatter, surface, sweep, woodBoard } from './foodKit';
import type { VariantEngine } from './pdp3dEngine';

type Sel = Record<string, number>;
const TAU = Math.PI * 2;
const V = (T: typeof THREE, x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* ── croissants ── */

const BANDS = 6;

/** Where the croissant's spine runs and how thick it is, for t along the pastry (0 to 1). */
const spine = (T: typeof THREE, t: number) => {
  const phi = (t - 0.5) * 2.9;
  return V(T, Math.sin(phi) * 0.46, 0, (1 - Math.cos(phi)) * 0.5 - 0.14);
};
const thickness = (t: number) => 0.24 * Math.pow(Math.sin(Math.PI * t), 0.72) * (1 + 0.1 * (Math.abs(Math.sin(Math.PI * BANDS * t + 0.3)) - 0.62));

/** A point on the croissant's skin and its outward normal, a being the angle round the body (0 side, PI/2 top). */
const skin = (T: typeof THREE, t: number, a: number) => {
  const eps = 0.002;
  const p = spine(T, t);
  const tan = spine(T, Math.min(1, t + eps)).sub(spine(T, Math.max(0, t - eps))).normalize();
  const up = V(T, 0, 1, 0);
  const side = new T.Vector3().crossVectors(tan, up).normalize();
  const r = thickness(t);
  const sy = Math.sin(a) > 0 ? 0.86 : 0.5;
  const normal = side.clone().multiplyScalar(Math.cos(a)).add(up.clone().multiplyScalar(Math.sin(a) / sy)).normalize();
  const pos = p.clone().add(side.multiplyScalar(Math.cos(a) * r)).add(up.multiplyScalar(Math.sin(a) * r * sy + r * 0.5));
  return { pos, normal };
};

const croissantGeometry = (T: typeof THREE, kit: Kit) => {
  const N = 140, M = 36;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    for (let j = 0; j <= M; j++) {
      const { pos: p } = skin(T, t, (j / M) * TAU);
      pos.push(p.x, p.y, p.z);
      uv.push(t, j / M);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + 1, c = (i + 1) * (M + 1) + j, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = kit.add(new T.BufferGeometry());
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

const croissantSkin = (T: typeof THREE, kit: Kit, glaze: boolean) =>
  surface(
    T,
    kit,
    paint(T, kit, 512, 256, (u, v) => {
      const top = clamp01(Math.sin(v * TAU));
      const n = fbm(u * 26, v * 10, 3, 4, 7);
      const fine = fbm(u * 90, v * 36, 5, 2, 11);
      const crease = smoothstep(0.7, 1, 1 - Math.abs(Math.sin(Math.PI * BANDS * u + 0.3)) * 1.0) * 0.9 + fbm(u * 60, v * 20, 2, 2, 5) * 0.12;
      const bulge = 1 - crease;
      let c = mix([206, 134, 52], [178, 106, 36], n);
      c = mix(c, [118, 60, 20], top * (0.55 + n * 0.4));
      c = mix(c, [86, 42, 14], crease * 0.7);
      c = mix(c, [226, 174, 100], smoothstep(0.68, 0.86, fine) * 0.45 * bulge);
      return [c[0], c[1], c[2], 0.25 + bulge * 0.5 + n * 0.25];
    }),
    glaze
      ? { roughness: 0.4, bumpScale: 5, physical: true, clearcoat: 0.4, clearcoatRoughness: 0.35 }
      : { roughness: 0.48, bumpScale: 5, physical: true, clearcoat: 0.32, clearcoatRoughness: 0.35 },
  );

export function createCroissantModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const almond = id === 'almond-croissant';
  inner.add(plate(T, kit, 0.74));

  const body = new T.Mesh(croissantGeometry(T, kit), croissantSkin(T, kit, almond));
  body.position.y = 0.04;
  body.rotation.y = -0.2;
  inner.add(body);

  if (almond) {
    // Flaked almonds and powdered sugar over the top of the pastry.
    const flake = kit.add(new T.SphereGeometry(1, 10, 6));
    flake.scale(0.05, 0.006, 0.026);
    const flakeMat = kit.add(new T.MeshStandardMaterial({ color: 0xe6c993, roughness: 0.5 }));
    const up = V(T, 0, 1, 0);
    const q = new T.Quaternion();
    const spin = new T.Quaternion();
    const holder = new T.Group();
    holder.position.copy(body.position);
    holder.rotation.copy(body.rotation);
    inner.add(holder);
    scatter(T, kit, holder, flake, flakeMat, 58, (i, r) => {
      const t = 0.1 + r() * 0.8, a = 0.2 + r() * (Math.PI - 0.4);
      const { pos, normal } = skin(T, t, a);
      q.setFromUnitVectors(up, normal);
      spin.setFromAxisAngle(normal, r() * TAU);
      return { pos: [pos.x + normal.x * 0.004, pos.y + normal.y * 0.004, pos.z + normal.z * 0.004], quat: spin.clone().multiply(q.clone()), scale: 0.8 + r() * 0.5 };
    }, 5);
    const sugar = kit.add(new T.SphereGeometry(0.0065, 6, 4));
    scatter(T, kit, holder, sugar, kit.add(new T.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.9 })), 240, (i, r) => {
      const t = 0.08 + r() * 0.84, a = 0.15 + r() * (Math.PI - 0.3);
      const { pos, normal } = skin(T, t, a);
      return { pos: [pos.x + normal.x * 0.003, pos.y + normal.y * 0.003, pos.z + normal.z * 0.003] };
    }, 9);
  }

  const apply = () => {};
  return assemble(T, kit, inner, { sel, apply, steam: { count: 22, height: 0.02, on: (s) => (almond ? s.serve === 0 : s.serve === 1) }, shadow: [1.9, 1.5] });
}

/* ── San Sebastian cheesecake ── */

export function createCheesecakeModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  inner.add(plate(T, kit, 0.84));
  const R = 0.66, H = 0.36, A = Math.PI / 3;

  const wedge = new T.Group();
  wedge.position.y = 0.04;
  inner.add(wedge);

  // The burnt top.
  const topTex = paint(T, kit, 256, 256, (u, v) => {
    const n = fbm(u * 6, v * 6, 1, 4, 3);
    const r = fbm(u * 14, v * 14, 4, 3, 8);
    let c = mix([50, 24, 10], [112, 56, 20], n);
    c = mix(c, [160, 96, 40], smoothstep(0.66, 0.82, r) * 0.6);
    const crack = 1 - smoothstep(0.0, 0.03, Math.abs(fbm(u * 5, v * 5, 9, 3, 12) - 0.5));
    c = mix(c, [214, 158, 84], crack * 0.7);
    return [c[0], c[1], c[2], 0.4 + n * 0.4 - crack * 0.3];
  });
  const shape = new T.Shape();
  shape.moveTo(0, 0);
  shape.absarc(0, 0, R, -A / 2, A / 2, false);
  shape.lineTo(0, 0);
  const topGeo = kit.add(new T.ShapeGeometry(shape, 24));
  const tuv = topGeo.attributes.uv, tpos = topGeo.attributes.position;
  for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tpos.getX(i) / R, (tpos.getY(i) / R) * 0.5 + 0.5);
  topGeo.rotateX(-Math.PI / 2);
  displace(topGeo, 0.006, 8, 5);
  const top = new T.Mesh(topGeo, surface(T, kit, topTex, { roughness: 0.55, bumpScale: 4 }));
  top.position.y = H;
  wedge.add(top);

  // The curved outer wall.
  const wallTex = paint(T, kit, 128, 128, (u, v) => {
    const n = fbm(u * 10, v * 4, 2, 3, 6);
    let c = mix([214, 160, 84], [150, 88, 34], smoothstep(0.2, 0.7, v));
    c = mix(c, [56, 28, 12], smoothstep(0.72, 0.95, v + n * 0.12));
    return [c[0], c[1], c[2], 0.4 + n * 0.4];
  });
  const wallGeo = kit.add(new T.CylinderGeometry(R, R, H, 36, 1, true, Math.PI / 2 - A / 2, A));
  const wall = new T.Mesh(wallGeo, surface(T, kit, wallTex, { roughness: 0.6, bumpScale: 3, side: T.DoubleSide }));
  wall.position.y = H / 2;
  wedge.add(wall);

  // The cut faces: burnt crust, a caramel line, then pale creamy custard.
  const faceTex = paint(T, kit, 256, 128, (u, v) => {
    const n = fbm(u * 12, v * 12, 5, 3, 4);
    const pores = smoothstep(0.7, 0.86, fbm(u * 40, v * 40, 8, 2, 2));
    let c = mix([246, 224, 150], [252, 238, 178], n);
    c = mix(c, [232, 200, 120], pores * 0.5);
    c = mix(c, [206, 150, 70], smoothstep(0.24, 0.0, v) * 0.9);
    c = mix(c, [176, 108, 46], smoothstep(0.86, 0.94, v) * 0.85);
    c = mix(c, [60, 30, 12], smoothstep(0.93, 0.99, v));
    return [c[0], c[1], c[2], 0.4 + n * 0.3 + pores * 0.3];
  });
  const faceMat = surface(T, kit, faceTex, { roughness: 0.62, bumpScale: 1.5, side: T.DoubleSide });
  [1, -1].forEach((s) => {
    const th = (s * A) / 2;
    const g = kit.add(new T.PlaneGeometry(R, H));
    g.rotateY(-th);
    g.translate((R / 2) * Math.cos(th), H / 2, (R / 2) * Math.sin(th));
    wedge.add(new T.Mesh(g, faceMat));
  });
  // Point the tip at the camera so both cut faces show.
  wedge.rotation.y = Math.PI / 2;
  wedge.position.z = -R * 0.45 + 0.16;
  wedge.position.x = 0.0;

  // Warm Belgian chocolate: poured beside it, in a ramekin, or left off.
  const chocMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x2a1208, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const pool = new T.Group();
  const poolGeo = kit.add(new T.CircleGeometry(0.24, 40));
  poolGeo.rotateX(-Math.PI / 2);
  const pp = poolGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const a = Math.atan2(pp.getZ(i), pp.getX(i));
    const k = 1 + (fbm(Math.cos(a) * 2, Math.sin(a) * 2, 3, 3, 9) - 0.5) * 0.5;
    pp.setXYZ(i, pp.getX(i) * k * 1.15, 0.006 + (fbm(pp.getX(i) * 6, pp.getZ(i) * 6, 1, 2, 3) - 0.5) * 0.004, pp.getZ(i) * k);
  }
  poolGeo.computeVertexNormals();
  const puddle = new T.Mesh(poolGeo, chocMat);
  puddle.position.set(0.32, 0.05, 0.3);
  pool.add(puddle);
  const drizzle = new T.Mesh(sweep(T, kit, new T.CatmullRomCurve3([V(T, -0.02, 0.005, -0.05), V(T, 0.08, 0.006, -0.02), V(T, 0.17, 0.005, 0.02), V(T, 0.26, 0.006, 0.05), V(T, 0.36, 0.005, 0.03)]), { round: true, radius: 0.012, segs: 40 }), chocMat);
  drizzle.position.set(0, H + 0.006, 0);
  drizzle.rotation.y = 0;
  wedge.add(drizzle);
  inner.add(pool);
  const ramekin = dipCup(T, kit, 0x2a1208, 0.15);
  ramekin.group.position.set(0.5, 0.05, 0.25);
  inner.add(ramekin.group);

  const apply = (s: Sel) => {
    const mode = s.serve ?? 0;
    pool.visible = mode === 0;
    drizzle.visible = mode === 0;
    ramekin.group.visible = mode === 1;
  };
  return assemble(T, kit, inner, { sel, apply, shadow: [2.2, 1.9] });
}

/* ── brownie ── */

export function createBrownieModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  inner.add(plate(T, kit, 0.74));
  const W = 0.58, Hh = 0.24;

  const sideTex = paint(T, kit, 256, 128, (u, v) => {
    const n = fbm(u * 10, v * 6, 2, 4, 5);
    const pore = smoothstep(0.72, 0.84, fbm(u * 34, v * 20, 4, 2, 9));
    let c = mix([64, 32, 18], [104, 56, 30], n);
    c = mix(c, [36, 18, 10], pore * 0.7);
    c = mix(c, [130, 78, 42], smoothstep(0.8, 0.95, fbm(u * 50, v * 30, 3, 2, 12)) * 0.5);
    c = mix(c, [120, 66, 34], smoothstep(0.9, 1, v) * 0.8);
    return [c[0], c[1], c[2], 0.35 + n * 0.5 - pore * 0.3];
  });
  const topTex = paint(T, kit, 256, 256, (u, v) => {
    const f = fbm(u * 7, v * 7, 1, 4, 3);
    const crack = 1 - smoothstep(0.0, 0.035, Math.abs(f - 0.5));
    let c = mix([66, 30, 14], [96, 46, 22], fbm(u * 18, v * 18, 5, 3, 8));
    c = mix(c, [182, 124, 82], crack * 0.75);
    return [c[0], c[1], c[2], 0.55 + f * 0.3 - crack * 0.35];
  });
  const sideMat = surface(T, kit, sideTex, { roughness: 0.7, bumpScale: 2.5 });
  const topMat = surface(T, kit, topTex, { roughness: 0.32, bumpScale: 3.5, physical: true, clearcoat: 0.7, clearcoatRoughness: 0.22 });
  const cake = new T.Mesh(roundBox(T, kit, W, Hh, W, 0.03, 18), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  cake.position.set(-0.05, 0.04 + Hh / 2, 0.02);
  cake.rotation.y = 0.28;
  inner.add(cake);

  // Sea salt on top.
  const saltGeo = kit.add(new T.ConeGeometry(0.014, 0.018, 4));
  scatter(T, kit, cake, saltGeo, kit.add(new T.MeshStandardMaterial({ color: 0xfaf6ec, roughness: 0.4 })), 18, (i, r) => ({ pos: [(r() - 0.5) * W * 0.8, Hh / 2 + 0.008, (r() - 0.5) * W * 0.8], rot: [0, r() * 3, 0], scale: 0.7 + r() * 0.8 }), 6);

  // A scoop of vanilla gelato with chocolate over it.
  const scoop = new T.Group();
  const gTex = paint(T, kit, 128, 128, (u, v) => {
    const n = fbm(u * 12, v * 12, 1, 3, 4);
    const fleck = smoothstep(0.78, 0.86, fbm(u * 44, v * 44, 2, 2, 9));
    let c = mix([250, 238, 200], [244, 226, 176], n);
    c = mix(c, [60, 40, 24], fleck * 0.85);
    return [c[0], c[1], c[2], n];
  });
  const gGeo = kit.add(new T.SphereGeometry(0.19, 48, 32));
  const gp = gGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i);
    const k = 1 + 0.035 * Math.sin(y * 42) + (fbm(x * 8, y * 8, z * 8, 2, 4) - 0.5) * 0.06;
    gp.setXYZ(i, x * k, y * (y < 0 ? 0.6 : 1) * 0.92, z * k);
  }
  gGeo.computeVertexNormals();
  scoop.add(new T.Mesh(gGeo, surface(T, kit, gTex, { roughness: 0.55, bumpScale: 1.2 })));
  const sauceMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x2a1208, roughness: 0.14, clearcoat: 1 }));
  [[-0.1, 0.02], [0.02, 0.1], [0.1, -0.03]].forEach(([a, b], i) => {
    const pts = [V(T, a * 0.5, 0.185, b * 0.5), V(T, a, 0.14, b), V(T, a * 1.5, 0.05, b * 1.4), V(T, a * 1.7, -0.06 - i * 0.01, b * 1.7)];
    scoop.add(new T.Mesh(sweep(T, kit, new T.CatmullRomCurve3(pts), { round: true, radius: 0.011, segs: 18 }), sauceMat));
  });
  scoop.position.set(-0.03, 0.04 + Hh + 0.13, 0.02);
  inner.add(scoop);

  const apply = (s: Sel) => {
    scoop.visible = (s.serve ?? 0) === 0;
  };
  return assemble(T, kit, inner, { sel, apply, steam: { count: 22, height: 0.02, on: (s) => (s.serve ?? 0) <= 1 }, shadow: [1.9, 1.6] });
}

/* ── tiramisu ── */

export function createTiramisuModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const dish = plate(T, kit, 0.7);
  inner.add(dish);
  const tray = woodBoard(T, kit, 0.8, 0.045, { rect: [1.9, 0.78], tone: [184, 146, 98] });
  inner.add(tray);

  const W = 0.6, Hh = 0.36, D = 0.46;
  const sideTex = paint(T, kit, 256, 256, (u, v) => {
    const n = fbm(u * 14, v * 6, 2, 4, 3);
    const air = smoothstep(0.74, 0.86, fbm(u * 40, v * 30, 6, 2, 9));
    const cream = [248, 238, 208], sponge = [128, 82, 46];
    let layer: number[];
    if (v < 0.03) layer = [188, 150, 96];
    else if (v < 0.30) layer = mix(sponge, [156, 108, 62], fbm(u * 30, v * 20, 5, 2, 4));
    else if (v < 0.50) layer = cream;
    else if (v < 0.74) layer = mix(sponge, [150, 102, 58], fbm(u * 30, v * 20, 7, 2, 6));
    else if (v < 0.94) layer = cream;
    else layer = [96, 58, 34];
    // The sponge is soaked at its edges with espresso.
    const edge = smoothstep(0.02, 0.0, Math.abs(v - 0.30)) + smoothstep(0.02, 0.0, Math.abs(v - 0.50)) + smoothstep(0.02, 0.0, Math.abs(v - 0.74));
    let c = mix(layer, [88, 54, 30], clamp01(edge) * 0.35);
    c = mix(c, [220, 208, 176], air * 0.4);
    return [c[0], c[1], c[2], 0.4 + n * 0.4];
  });
  const cocoaTex = paint(T, kit, 256, 256, (u, v) => {
    const n = fbm(u * 14, v * 14, 4, 4, 7);
    let c = mix([84, 50, 30], [126, 84, 54], n);
    c = mix(c, [186, 148, 110], smoothstep(0.7, 0.9, fbm(u * 50, v * 50, 6, 2, 3)) * 0.4);
    return [c[0], c[1], c[2], 0.3 + n * 0.7];
  });
  const sideMat = surface(T, kit, sideTex, { roughness: 0.7, bumpScale: 2 });
  const topMat = surface(T, kit, cocoaTex, { roughness: 0.92, bumpScale: 4 });
  const sliceGeo = roundBox(T, kit, W, Hh, D, 0.014, 16);
  const slices: THREE.Object3D[] = [];
  const slice = (x: number, z: number, rot: number, s = 1) => {
    const g = new T.Group();
    g.add(new T.Mesh(sliceGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]));
    g.position.set(x, 0.04 + Hh / 2, z);
    g.rotation.y = rot;
    g.scale.setScalar(s);
    inner.add(g);
    slices.push(g);
    return g;
  };
  const hero = slice(0, 0.02, 0.18);
  slice(-0.62, -0.12, -0.1, 0.9);
  slice(0.66, -0.1, 0.12, 0.9);

  // Chocolate curls and coffee beans on the hero slice.
  const chocMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x3a1c0e, roughness: 0.3, clearcoat: 0.5 }));
  for (let i = 0; i < 4; i++) {
    const g = kit.add(new T.TorusGeometry(0.032, 0.007, 6, 14, Math.PI * 1.5));
    const m = new T.Mesh(g, chocMat);
    m.position.set((i - 1.5) * 0.11, Hh / 2 + 0.014, (i % 2 ? 0.06 : -0.06));
    m.rotation.set(Math.PI / 2 + 0.2 * i, i * 1.2, 0);
    hero.add(m);
  }
  const bean = kit.add(new T.SphereGeometry(0.03, 14, 10));
  bean.scale(1, 0.55, 0.75);
  [[-0.16, 0.1], [0.2, -0.02]].forEach(([x, z], i) => {
    const b = new T.Mesh(bean, kit.add(new T.MeshPhysicalMaterial({ color: 0x24140b, roughness: 0.35, clearcoat: 0.5 })));
    b.position.set(x, Hh / 2 + 0.016, z);
    b.rotation.y = i * 1.4;
    hero.add(b);
  });

  let fit = null, baseScale = 1;
  const apply = (s: Sel) => {
    const share = s.portion === 1;
    slices[1].visible = slices[2].visible = share;
    tray.visible = share;
    dish.visible = !share;
    if (fit) fit.scale.setScalar(baseScale * (share ? 1 : 1.45));
  };
  const out = assemble(T, kit, inner, { sel, apply, shadow: [2.4, 1.4] });
  fit = out.group.children[0];
  baseScale = fit.scale.x;
  apply(sel);
  return out;
}

/* ── matcha financier ── */

export function createFinancierModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  inner.add(plate(T, kit, 0.8));
  const W = 0.62, Hh = 0.19, D = 0.34;

  const crustTex = paint(T, kit, 256, 128, (u, v) => {
    const n = fbm(u * 12, v * 8, 2, 4, 3);
    let c = mix([152, 104, 46], [176, 124, 56], n);
    c = mix(c, [96, 128, 46], smoothstep(0.25, 0.0, v) * 0.55);
    c = mix(c, [110, 66, 26], smoothstep(0.7, 0.95, fbm(u * 26, v * 14, 4, 3, 8)) * 0.6);
    return [c[0], c[1], c[2], 0.35 + n * 0.5];
  });
  const topTex = paint(T, kit, 256, 128, (u, v) => {
    const n = fbm(u * 14, v * 10, 5, 4, 6);
    let c = mix([170, 118, 52], [198, 146, 70], n);
    c = mix(c, [118, 132, 50], smoothstep(0.55, 0.85, fbm(u * 5, v * 5, 1, 3, 4)) * 0.35);
    c = mix(c, [250, 246, 236], smoothstep(0.55, 0.8, fbm(u * 34, v * 20, 9, 3, 2)) * 0.6);
    return [c[0], c[1], c[2], 0.35 + n * 0.5];
  });
  const crumbTex = paint(T, kit, 256, 256, (u, v) => {
    const n = fbm(u * 12, v * 12, 7, 4, 5);
    const pores = smoothstep(0.66, 0.8, fbm(u * 46, v * 46, 3, 2, 9));
    let c = mix([124, 150, 60], [156, 176, 84], n);
    c = mix(c, [72, 98, 30], pores * 0.75);
    c = mix(c, [226, 212, 168], smoothstep(0.82, 0.9, fbm(u * 60, v * 60, 8, 2, 12)) * 0.6);
    c = mix(c, [158, 108, 48], smoothstep(0.1, 0.0, Math.min(v, 1 - v, u, 1 - u)) * 0.85);
    return [c[0], c[1], c[2], 0.35 + n * 0.4 + pores * 0.2];
  });
  const crust = surface(T, kit, crustTex, { roughness: 0.6, bumpScale: 3 });
  const topMat = surface(T, kit, topTex, { roughness: 0.55, bumpScale: 3 });
  const crumb = surface(T, kit, crumbTex, { roughness: 0.78, bumpScale: 3 });

  const dome = (g: THREE.BufferGeometry, w: number) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) p.setY(i, y + (1 - Math.pow(p.getZ(i) / (D / 2), 2)) * 0.03 * (1 - Math.pow(p.getX(i) / (w / 2), 2) * 0.4));
    }
    g.computeVertexNormals();
    return g;
  };
  // [+x, -x, +y, -y, +z, -z]
  const whole = new T.Mesh(dome(roundBox(T, kit, W, Hh, D, 0.05, 20), W), [crust, crust, topMat, crust, crust, crust]);
  whole.position.set(-0.26, 0.04 + Hh / 2, -0.06);
  whole.rotation.y = 0.32;
  inner.add(whole);
  const half = new T.Mesh(dome(roundBox(T, kit, W * 0.5, Hh, D, 0.05, 16), W * 0.5), [crumb, crust, topMat, crust, crust, crust]);
  half.position.set(0.28, 0.04 + Hh / 2, 0.16);
  half.rotation.y = -0.55;
  inner.add(half);

  const flake = kit.add(new T.SphereGeometry(1, 10, 6));
  flake.scale(0.05, 0.006, 0.028);
  const flakeMat = kit.add(new T.MeshStandardMaterial({ color: 0xe8d1a0, roughness: 0.5 }));
  scatter(T, kit, whole, flake, flakeMat, 3, (i, r) => ({ pos: [(i - 1) * 0.16, Hh / 2 + 0.035, (r() - 0.5) * 0.1], rot: [(r() - 0.5) * 0.2, r() * 3, (r() - 0.5) * 0.2] }), 3);
  const sugar = kit.add(new T.SphereGeometry(0.006, 6, 4));
  const sugarMat = kit.add(new T.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.9 }));
  [whole, half].forEach((m, k) => {
    const w = k ? W * 0.5 : W;
    scatter(T, kit, m, sugar, sugarMat, 90, (i, r) => {
      const x = (r() - 0.5) * w * 0.8, z = (r() - 0.5) * D * 0.7;
      return { pos: [x, Hh / 2 + 0.03 * (1 - Math.pow(z / (D / 2), 2)) + 0.004, z] };
    }, 5 + k);
  });

  return assemble(T, kit, inner, { sel, steam: { count: 22, height: 0.02, on: (s) => s.serve === 1 }, shadow: [2.0, 1.5] });
}

/* ── cooler drinks (painted onto the shared iced cup) ── */

const COOLERS = {
  'mint-margarita': { stops: [[0, [220, 244, 206]], [0.5, [156, 214, 138]], [1, [88, 178, 84]]], ice: 0xd9f0d2, label: 'MINT MARGARITA', bits: 'mint' },
  'peach-iced-tea': { stops: [[0, [252, 204, 142]], [0.5, [232, 152, 74]], [1, [186, 100, 38]]], ice: 0xf6dcc0, label: 'PEACH ICED TEA', bits: 'peach' },
  'mango-smoothie': { stops: [[0, [255, 214, 96]], [0.5, [250, 168, 34]], [1, [240, 130, 14]]], ice: 0xf8e6b0, label: 'MANGO SMOOTHIE', bits: 'cream' },
  'spanish-latte': { stops: [[0, [248, 236, 210]], [0.45, [214, 170, 120]], [1, [92, 56, 30]]], ice: 0xe9d9bd, label: 'SPANISH LATTE', bits: 'cream' },
  'lime-soda': { stops: [[0, [238, 250, 214]], [0.5, [206, 234, 140]], [1, [166, 210, 92]]], ice: 0xe4f2d6, label: 'FRESH LIME SODA', bits: 'bubbles' },
};

export const isCooler = (id: string) => id in COOLERS;

/** The drink's body and surface textures, laid out like the iced cup's own (front of the cup at the middle of the canvas). */
export function createCoolerLook(T: typeof THREE, id: string) {
  const look = COOLERS[id];
  const grad = (ctx: CanvasRenderingContext2D, h: number) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    look.stops.forEach(([o, c]) => g.addColorStop(o, `rgb(${c[0]},${c[1]},${c[2]})`));
    return g;
  };
  const R = rng(id.length * 31);
  const body = document.createElement('canvas');
  body.width = 2048;
  body.height = 2048;
  const ctx = body.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = grad(ctx, 1024);
  ctx.fillRect(0, 0, 1024, 1024);
  // Slush, pulp, tea swirls or bubbles, depending on the drink.
  ctx.save();
  if (look.bits === 'mint') {
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '40,120,44'},${0.12 + R() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(R() * 1024, 80 + R() * 880, 3 + R() * 9, 2 + R() * 6, R() * 3, 0, TAU);
      ctx.fill();
    }
  } else if (look.bits === 'peach') {
    ctx.filter = 'blur(20px)';
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = `rgba(255,${190 + R() * 40},${120 + R() * 40},0.3)`;
      ctx.beginPath();
      ctx.ellipse(R() * 1024, 200 + R() * 700, 60 + R() * 60, 20 + R() * 30, R() * 3, 0, TAU);
      ctx.fill();
    }
  } else if (look.bits === 'cream') {
    ctx.filter = 'blur(26px)';
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(255,238,180,0.45)';
      ctx.beginPath();
      ctx.ellipse(R() * 1024, 120 + R() * 800, 50 + R() * 90, 20 + R() * 40, R() * 3, 0, TAU);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 180; i++) {
      const x = R() * 1024, y = 60 + R() * 900, r = 2 + R() * 6;
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + R() * 0.4})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Condensation.
  for (let d = 0; d < 80; d++) {
    ctx.fillStyle = `rgba(255,255,255,${0.16 + R() * 0.14})`;
    ctx.beginPath();
    ctx.arc(R() * 1024, 100 + R() * 820, 1.4 + R() * 2.6, 0, TAU);
    ctx.fill();
  }
  // Print.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.fillText('brewns®', 512, 475);
  ctx.font = '600 21px monospace';
  ctx.letterSpacing = '5px';
  ctx.fillStyle = '#1c1c1c';
  ctx.fillText(look.label, 512, 524);
  ctx.font = 'italic bold 46px Georgia, "Times New Roman", serif';
  ctx.fillText('b.', 512, 735);
  const drink = new T.CanvasTexture(body);
  drink.colorSpace = T.SRGBColorSpace;

  const top = document.createElement('canvas');
  top.width = 256;
  top.height = 256;
  const t = top.getContext('2d')!;
  const c1 = look.stops[2][1], c0 = look.stops[1][1];
  const rg = t.createRadialGradient(108, 100, 8, 128, 128, 132);
  rg.addColorStop(0, `rgb(${Math.min(255, c1[0] + 30)},${Math.min(255, c1[1] + 30)},${Math.min(255, c1[2] + 24)})`);
  rg.addColorStop(0.6, `rgb(${c0[0]},${c0[1]},${c0[2]})`);
  rg.addColorStop(1, `rgb(${c1[0] * 0.7 | 0},${c1[1] * 0.7 | 0},${c1[2] * 0.7 | 0})`);
  t.fillStyle = rg;
  t.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    t.fillStyle = look.bits === 'mint' && R() < 0.4 ? `rgba(40,120,44,${0.2 + R() * 0.3})` : `rgba(255,255,255,${0.1 + R() * 0.3})`;
    t.beginPath();
    t.arc(128 + (R() - 0.5) * 200, 128 + (R() - 0.5) * 200, 1 + R() * 3.4, 0, TAU);
    t.fill();
  }
  const surfaceTex = new T.CanvasTexture(top);
  surfaceTex.colorSpace = T.SRGBColorSpace;
  return { drink, surface: surfaceTex, ice: look.ice };
}

/* ── Swedish cardamom bun ── */

/** A twisted knot of enriched dough, glossy with cardamom syrup and scattered with pearl sugar. */
export function createCardamomBunModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  inner.add(plate(T, kit, 0.8));

  const geo = kit.add(new T.TorusKnotGeometry(0.29, 0.118, 240, 30, 2, 3));
  geo.rotateX(-Math.PI / 2);
  geo.scale(1, 0.82, 1);
  geo.computeVertexNormals();
  displace(geo, 0.01, 8, 4);
  const tex = paint(T, kit, 512, 256, (u, v) => {
    const n = fbm(u * 30, v * 8, 2, 4, 5);
    const fine = fbm(u * 120, v * 40, 4, 2, 9);
    const top = clamp01(Math.sin(v * TAU) * 0.5 + 0.5);
    let c = mix([206, 136, 58], [172, 100, 34], n);
    c = mix(c, [122, 64, 22], top * 0.5 * (0.4 + n));
    c = mix(c, [222, 168, 96], smoothstep(0.66, 0.85, fine) * 0.4);
    // Cardamom seed flecks and a brushed syrup sheen.
    const seed = smoothstep(0.8, 0.86, fbm(u * 90, v * 30, 8, 2, 13));
    c = mix(c, [52, 46, 22], seed * 0.8);
    return [c[0], c[1], c[2], 0.35 + n * 0.55];
  });
  const bun = new T.Mesh(geo, surface(T, kit, tex, { roughness: 0.4, bumpScale: 4, physical: true, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  bun.position.y = 0.04 + 0.118 * 0.82 + 0.02;
  inner.add(bun);

  // Pearl sugar on the upward-facing dough.
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const R = rng(17);
  const up: number[] = [];
  for (let i = 0; i < pos.count; i++) if (nor.getY(i) > 0.3) up.push(i);
  const pearl = kit.add(new T.SphereGeometry(1, 8, 6));
  pearl.scale(0.02, 0.011, 0.017);
  scatter(T, kit, bun, pearl, kit.add(new T.MeshPhysicalMaterial({ color: 0xf7f2e6, roughness: 0.35, clearcoat: 0.4 })), 120, () => {
    const i = up[Math.floor(R() * up.length)];
    return { pos: [pos.getX(i) + nor.getX(i) * 0.008, pos.getY(i) + nor.getY(i) * 0.008, pos.getZ(i) + nor.getZ(i) * 0.008], rot: [R() * 3, R() * 3, R() * 3] };
  }, 21);

  return assemble(T, kit, inner, { sel, steam: { count: 22, height: 0.02, on: (s) => s.serve === 1 }, shadow: [1.9, 1.7] });
}
