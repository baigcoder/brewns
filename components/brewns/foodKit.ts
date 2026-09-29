// @ts-nocheck
/* Shared tools for the procedural food models (foodModels3d.ts): value noise,
   textures painted per pixel with a matching bump map, rounded and organic
   shapes, scattering, and the props food sits on. Everything a model creates
   goes through a Kit so one call disposes it all.

   Models are authored roughly one unit across, y up; `assemble` then measures
   the finished piece, centres it and fits it to the stage. */
import type * as THREE from 'three';
import { createShadowMesh, createSteamSystem, type VariantEngine } from './pdp3dEngine';

/* ── noise ── */

const hash = (x: number, y: number, z: number, s: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth value noise in 0..1. */
export function noise3(x: number, y: number, z: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, s);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}

/** Layered noise in 0..1. */
export function fbm(x: number, y: number, z = 0, octaves = 4, s = 0) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f, s + i * 17);
    norm += amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

/** A small seeded random generator, so a model looks the same every time it opens. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: number[], b: number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const hex = (h: number) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

/* ── the kit ── */

export class Kit {
  list: { dispose?: () => void }[] = [];
  add<O extends { dispose?: () => void }>(o: O): O {
    this.list.push(o);
    return o;
  }
  dispose() {
    this.list.forEach((o) => o.dispose?.());
    this.list = [];
  }
}

/**
 * Paints a colour map and a matching bump map per pixel. `fn(u, v)` returns
 * [r, g, b, height] with colour 0..255 and height 0..1; v runs up the image.
 */
export function paint(T: typeof THREE, kit: Kit, w: number, h: number, fn: (u: number, v: number) => number[]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const b = document.createElement('canvas');
  b.width = w;
  b.height = h;
  const ctx = c.getContext('2d')!;
  const bctx = b.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const bimg = bctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = 1 - y / (h - 1);
    for (let x = 0; x < w; x++) {
      const [r, g, bl, hh] = fn(x / (w - 1), v);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = bl;
      img.data[i + 3] = 255;
      const k = Math.max(0, Math.min(255, hh * 255));
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = k;
      bimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  const map = kit.add(new T.CanvasTexture(c));
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  const bump = kit.add(new T.CanvasTexture(b));
  bump.wrapS = bump.wrapT = T.RepeatWrapping;
  return { map, bump };
}

/** A canvas 2D drawing as a colour texture, for things easier drawn than computed. */
export function draw(T: typeof THREE, kit: Kit, w: number, h: number, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  fn(ctx, w, h);
  const map = kit.add(new T.CanvasTexture(c));
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

/** A standard material from a painted texture pair. */
export function surface(T: typeof THREE, kit: Kit, tex: { map: THREE.Texture; bump: THREE.Texture } | null, o: Record<string, unknown> = {}) {
  const { physical, bumpScale = 2, ...rest } = o as { physical?: boolean; bumpScale?: number };
  const params: Record<string, unknown> = { roughness: 0.6, metalness: 0, ...rest };
  if (tex) {
    params.map = tex.map;
    params.bumpMap = tex.bump;
    params.bumpScale = bumpScale;
  }
  return kit.add(physical ? new T.MeshPhysicalMaterial(params) : new T.MeshStandardMaterial(params));
}

/* ── geometry ── */

export const lathe = (T: typeof THREE, kit: Kit, pts: number[][], seg = 72) => kit.add(new T.LatheGeometry(pts.map((p) => new T.Vector2(p[0], p[1])), seg));

/** Pushes every vertex along its normal by noise, for an organic surface. Noise is sampled in 3D, so seams stay closed. */
export function displace(geo: THREE.BufferGeometry, amp: number, freq: number, seed = 0, octaves = 3) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = (fbm(x * freq + 11.3, y * freq + 7.7, z * freq + 3.1, octaves, seed) - 0.5) * 2 * amp;
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A lumpy ellipsoid: bread, a breaded fillet, a piece of chicken. */
export function blob(T: typeof THREE, kit: Kit, rx: number, ry: number, rz: number, o: { amp?: number; freq?: number; seed?: number; seg?: number } = {}) {
  const g = kit.add(new T.SphereGeometry(1, o.seg || 40, o.seg ? o.seg / 2 : 24));
  g.scale(rx, ry, rz);
  g.computeVertexNormals();
  return displace(g, o.amp ?? 0.02, o.freq ?? 4, o.seed ?? 1);
}

/** A box with rounded edges and smooth analytic normals; UVs stay per face, so a material array still works. */
export function roundBox(T: typeof THREE, kit: Kit, w: number, h: number, d: number, r: number, seg = 14) {
  const g = kit.add(new T.BoxGeometry(w, h, d, seg, Math.max(6, Math.round(seg * (h / w))), seg));
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = Math.max(-hx, Math.min(hx, x)), cy = Math.max(-hy, Math.min(hy, y)), cz = Math.max(-hz, Math.min(hz, z));
    let dx = x - cx, dy = y - cy, dz = z - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    p.setXYZ(i, cx + dx * r, cy + dy * r, cz + dz * r);
    n.setXYZ(i, dx, dy, dz);
  }
  return g;
}

/** A sheet of leaf, lettuce or paper: a disc or plane whose height ripples. */
export function ruffle(T: typeof THREE, kit: Kit, radius: number, o: { waves?: number; amp?: number; seed?: number; seg?: number } = {}) {
  const g = kit.add(new T.CircleGeometry(radius, o.seg || 64, 0, Math.PI * 2));
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const waves = o.waves ?? 8;
  const amp = o.amp ?? 0.03;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z) / radius;
    const a = Math.atan2(z, x);
    p.setY(i, Math.sin(a * waves + fbm(x * 3, z * 3, 0, 2, o.seed ?? 3) * 6) * amp * r * r + fbm(x * 5, z * 5, 1, 2, o.seed ?? 3) * amp * 0.6 * r);
  }
  g.computeVertexNormals();
  return g;
}

/** A leaf outline (basil, parsley) folded along its length. */
export function leaf(T: typeof THREE, kit: Kit, len = 0.16, wid = 0.09, fold = 0.35) {
  const s = new T.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.9, len * 0.1, wid * 0.9, len * 0.65, 0, len);
  s.bezierCurveTo(-wid * 0.9, len * 0.65, -wid * 0.9, len * 0.1, 0, 0);
  const g = kit.add(new T.ShapeGeometry(s, 10));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.abs(x) * fold + Math.sin((y / len) * Math.PI) * 0.012);
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Scatters instances: `place(i, rand)` returns { pos:[x,y,z], rot:[x,y,z], scale } per instance. */
export function scatter(T: typeof THREE, kit: Kit, parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, count: number, place: (i: number, r: () => number) => { pos: number[]; rot?: number[]; scale?: number | number[]; order?: string; color?: number; quat?: THREE.Quaternion }, seed = 5) {
  const mesh = new T.InstancedMesh(geo, mat, count);
  const r = rng(seed);
  const m = new T.Matrix4();
  const q = new T.Quaternion();
  const e = new T.Euler();
  const s = new T.Vector3();
  const pos = new T.Vector3();
  const col = new T.Color();
  for (let i = 0; i < count; i++) {
    const o = place(i, r);
    const rot = o.rot || [0, 0, 0];
    e.set(rot[0], rot[1], rot[2], o.order || 'XYZ');
    if (o.quat) q.copy(o.quat);
    else q.setFromEuler(e);
    const sc = o.scale ?? 1;
    Array.isArray(sc) ? s.set(sc[0], sc[1], sc[2]) : s.setScalar(sc);
    pos.set(o.pos[0], o.pos[1], o.pos[2]);
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
    if (o.color !== undefined) mesh.setColorAt(i, col.setHex(o.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  parent.add(mesh);
  return mesh;
}

/** A ribbon or tube swept along a curve, for noodles, drizzle and pepper strips. */
export function sweep(T: typeof THREE, kit: Kit, curve: THREE.Curve<THREE.Vector3>, o: { segs?: number; width?: number; thick?: number; round?: boolean; radius?: number } = {}) {
  const segs = o.segs ?? 40;
  if (o.round) return kit.add(new T.TubeGeometry(curve, segs, o.radius ?? 0.02, 6, false));
  const frames = curve.computeFrenetFrames(segs, false);
  const w = (o.width ?? 0.06) / 2;
  const t = (o.thick ?? 0.012) / 2;
  const pos: number[] = [];
  const idx: number[] = [];
  const uv: number[] = [];
  const corners = [[-w, t], [w, t], [w, -t], [-w, -t]];
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs);
    const N = frames.normals[i], B = frames.binormals[i];
    for (const [a, b] of corners) pos.push(c.x + N.x * a + B.x * b, c.y + N.y * a + B.y * b, c.z + N.z * a + B.z * b);
    for (let k = 0; k < 4; k++) uv.push(i / segs, k / 3);
  }
  for (let i = 0; i < segs; i++)
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + k, d = (i + 1) * 4 + ((k + 1) % 4);
      idx.push(a, c, b, b, c, d);
    }
  const g = kit.add(new T.BufferGeometry());
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ── props ── */

/** A glazed white plate, rim and well, sitting on y = 0. */
export function plate(T: typeof THREE, kit: Kit, r = 0.75) {
  const pts = [[0, 0], [r * 0.5, 0], [r * 0.58, 0.012], [r * 0.96, 0.085], [r, 0.11], [r * 0.985, 0.122], [r * 0.94, 0.104], [r * 0.7, 0.04], [0, 0.03]];
  const g = lathe(T, kit, pts, 80);
  const m = kit.add(new T.MeshPhysicalMaterial({ color: 0xe4dfd4, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.25, side: T.DoubleSide }));
  return new T.Mesh(g, m);
}

/** A round wooden board with grain. */
export function woodBoard(T: typeof THREE, kit: Kit, r = 0.78, h = 0.045, o: { rect?: [number, number]; tone?: number[] } = {}) {
  const tone = o.tone || [176, 128, 78];
  const tex = paint(T, kit, 256, 256, (u, v) => {
    const grain = fbm(u * 3, v * 40, 0, 4, 21);
    const ring = 0.5 + 0.5 * Math.sin((u * 6 + fbm(u * 2, v * 2, 3, 2, 8) * 2.5) * Math.PI * 2);
    const t = clamp01(0.55 * grain + 0.45 * ring * grain);
    const c = mix(mix(tone, [tone[0] * 0.7, tone[1] * 0.68, tone[2] * 0.66], t), [tone[0] * 1.08, tone[1] * 1.08, tone[2] * 1.08], fbm(u * 20, v * 3, 5, 2, 4) * 0.5);
    return [c[0], c[1], c[2], 0.4 + grain * 0.6];
  });
  const mat = surface(T, kit, tex, { roughness: 0.62, bumpScale: 0.6 });
  let geo: THREE.BufferGeometry;
  if (o.rect) {
    const [w, d] = o.rect;
    const s = new T.Shape();
    const rr = 0.05;
    s.moveTo(-w / 2 + rr, -d / 2);
    s.lineTo(w / 2 - rr, -d / 2);
    s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr);
    s.lineTo(w / 2, d / 2 - rr);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
    s.lineTo(-w / 2 + rr, d / 2);
    s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr);
    s.lineTo(-w / 2, -d / 2 + rr);
    s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
    geo = kit.add(new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }));
    geo.rotateX(-Math.PI / 2);
    // Extruded UVs are in world units; scale them to one grain pass.
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / d + 0.5);
  } else {
    geo = kit.add(new T.CylinderGeometry(r, r * 0.98, h, 72));
  }
  const mesh = new T.Mesh(geo, mat);
  if (!o.rect) mesh.position.y = h / 2;
  return mesh;
}

/** A sheet of baking paper or a napkin, lying flat. */
export function paperSheet(T: typeof THREE, kit: Kit, w = 1.2, d = 1.0, tone = 0xf3ecdc) {
  const g = kit.add(new T.PlaneGeometry(w, d, 24, 20));
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, (fbm(p.getX(i) * 4, p.getZ(i) * 4, 0, 3, 9) - 0.5) * 0.02);
  g.computeVertexNormals();
  return new T.Mesh(g, kit.add(new T.MeshStandardMaterial({ color: tone, roughness: 0.85, side: T.DoubleSide })));
}

/** A small round dipping pot with a glossy sauce in it. */
export function dipCup(T: typeof THREE, kit: Kit, sauce: number, r = 0.11) {
  const g = new T.Group();
  const cup = new T.Mesh(
    lathe(T, kit, [[0, 0], [r * 0.7, 0], [r, r * 0.9], [r * 1.02, r * 0.95], [r * 0.96, r * 0.93], [r * 0.66, 0.012], [0, 0.012]], 40),
    kit.add(new T.MeshPhysicalMaterial({ color: 0xf6f3ec, roughness: 0.25, clearcoat: 0.5, side: T.DoubleSide })),
  );
  g.add(cup);
  const fill = new T.Mesh(
    displace(kit.add(new T.CylinderGeometry(r * 0.94, r * 0.7, 0.02, 40, 3)), 0.004, 12, 3),
    kit.add(new T.MeshPhysicalMaterial({ color: sauce, roughness: 0.18, clearcoat: 0.9, clearcoatRoughness: 0.1 })),
  );
  fill.position.y = r * 0.78;
  g.add(fill);
  return { group: g, fill, mat: fill.material as THREE.MeshPhysicalMaterial };
}

/* ── putting it together ── */

export interface Assembled extends VariantEngine {
  /** The measured, fitted content, for models that want to hang things off it. */
  inner: THREE.Group;
}

/**
 * Centres and fits a finished piece to the stage, adds its ground shadow, and
 * wires the steam and variant handler. `apply` runs once at the start and again
 * on every option change; the fit is measured first, with every variant showing.
 */
export function assemble(
  T: typeof THREE,
  kit: Kit,
  inner: THREE.Group,
  o: { apply?: (sel: Record<string, number>) => void; sel?: Record<string, number>; steam?: { count?: number; height?: number; on?: (sel: Record<string, number>) => boolean }; shadow?: [number, number]; extraTick?: (dt: number, time: number) => void; fill?: number } = {},
): Assembled {
  const group = new T.Group();
  group.userData.hasCatcher = true;
  const fitter = new T.Group();
  fitter.add(inner);
  group.add(fitter);

  // Every part casts and receives the key light's shadow (the viewer switches shadows on for food).
  inner.traverse((m) => {
    if (m.isMesh) {
      const mat = m.material && (Array.isArray(m.material) ? m.material[0] : m.material);
      // Glass and clear plastic let light through, so they do not cast a solid shadow.
      m.castShadow = !(m.userData.noShadow || mat?.transmission > 0 || (mat?.transparent && mat.opacity < 0.9));
      m.receiveShadow = true;
    }
  });
  const box = new T.Box3().setFromObject(inner);
  const size = box.getSize(new T.Vector3());
  const center = box.getCenter(new T.Vector3());
  inner.position.sub(center);
  const bottom = -size.y / 2;
  const scale = (o.fill ?? 1) / Math.max(size.x, size.y, size.z);
  fitter.scale.setScalar(scale);

  const shadow = createShadowMesh(T, o.shadow?.[0] ?? size.x * 1.55, o.shadow?.[1] ?? size.z * 1.4, 0.8);
  shadow.mesh.position.set(0, bottom - 0.004, 0);
  fitter.add(shadow.mesh);
  // A catcher under the piece that shows only the shadow that falls on it.
  const catcher = new T.Mesh(new T.CircleGeometry(Math.max(size.x, size.z) * 1.6, 48), new T.ShadowMaterial({ opacity: 0.28 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = bottom - 0.002;
  catcher.receiveShadow = true;
  fitter.add(catcher);

  let steam: ReturnType<typeof createSteamSystem> | null = null;
  if (o.steam) {
    steam = createSteamSystem(T, o.steam.count ?? 26, 0);
    steam.group.position.set(0, size.y / 2 + (o.steam.height ?? 0.02), 0);
    steam.light.position.set(0, size.y / 2 + 0.2, 0);
    // No warm point light: next to pale food it washes the whole plate salmon.
    fitter.add(steam.group);
  }

  const apply = (sel: Record<string, number>) => {
    o.apply?.(sel);
    steam?.setWarm(o.steam?.on ? o.steam.on(sel) : false);
  };
  apply(o.sel || {});

  return {
    group,
    inner,
    updateVariant: apply,
    tick(dt, time) {
      steam?.tick(dt, time);
      o.extraTick?.(dt, time);
    },
    dispose() {
      shadow.dispose();
      catcher.geometry.dispose();
      catcher.material.dispose();
      steam?.dispose();
      kit.dispose();
    },
  };
}
