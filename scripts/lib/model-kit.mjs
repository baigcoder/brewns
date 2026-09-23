/**
 * Geometry and glTF plumbing shared by the model build scripts.
 *
 * No dependencies: glTF is JSON plus one binary blob, and writing it directly
 * keeps the assets diffable through the source that produced them.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/* ── Surfaces of revolution ─────────────────────────────────────────────────
   A profile is [radius, y] walked in one direction. The outward normal is the
   profile tangent turned a quarter turn, which is exactly d/dtheta x d/ds of the
   revolved surface — so winding the quads u-then-v gives front faces outward.

   That quarter turn is counter-clockwise, which fixes the direction of travel:
   walk each profile so the solid stays on your left. Walk it the other way and
   the surface is built inside out — back-face culling then drops the near wall
   and you see straight through the object. */
export function revolve(profile, segments = 64, { flipV = false } = {}) {
  const rows = profile.length;
  const cols = segments + 1;
  const position = [], normal = [], uv = [], index = [];

  // Arc length along the profile drives v, so the texture does not pool where
  // the wall turns.
  const arc = [0];
  for (let s = 1; s < rows; s++) {
    arc.push(arc[s - 1] + Math.hypot(profile[s][0] - profile[s - 1][0], profile[s][1] - profile[s - 1][1]));
  }
  const total = arc[rows - 1] || 1;

  for (let s = 0; s < rows; s++) {
    const [x, y] = profile[s];
    const prev = profile[Math.max(0, s - 1)];
    const next = profile[Math.min(rows - 1, s + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const nx = -ty;
    const ny = tx;
    for (let c = 0; c < cols; c++) {
      const t = c / segments;
      const a = t * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      position.push(x * cos, y, x * sin);
      normal.push(nx * cos, ny, nx * sin);
      const v = arc[s] / total;
      // u runs backwards: theta sweeps right-to-left across the face nearest the
      // camera, so printed artwork comes out mirrored. Flipped here rather than by
      // negating z, which would mirror the positions and invert the winding.
      uv.push(1 - t, flipV ? 1 - v : v);
    }
  }
  for (let s = 0; s < rows - 1; s++) {
    for (let c = 0; c < segments; c++) {
      const a = s * cols + c;
      index.push(a, a + 1, a + 1 + cols, a, a + 1 + cols, a + cols);
    }
  }
  return { position, normal, uv, index };
}

/* ── Rounded box ────────────────────────────────────────────────────────────
   A superellipsoid. Ice read as broken glass when it was a hard-edged cube:
   real cubes come out of a tray with every edge softened, and it is those
   rounded edges that catch the light and say "ice" rather than "polygon". */
export function roundedBox(size, roundness = 0.3, seg = 16) {
  const p = (w, m) => Math.sign(Math.cos(w)) * Math.pow(Math.abs(Math.cos(w)), m);
  const q = (w, m) => Math.sign(Math.sin(w)) * Math.pow(Math.abs(Math.sin(w)), m);
  const position = [], uv = [], index = [];
  const cols = seg * 2 + 1;
  for (let i = 0; i <= seg; i++) {
    const u = -Math.PI / 2 + (i / seg) * Math.PI;
    for (let j = 0; j <= seg * 2; j++) {
      const v = -Math.PI + (j / (seg * 2)) * Math.PI * 2;
      position.push(
        (size / 2) * p(u, roundness) * p(v, roundness),
        (size / 2) * q(u, roundness),
        (size / 2) * p(u, roundness) * q(v, roundness),
      );
      uv.push(j / (seg * 2), i / seg);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg * 2; j++) {
      const a = i * cols + j;
      index.push(a, a + cols, a + cols + 1, a, a + cols + 1, a + 1);
    }
  }
  return { position, normal: accumulateNormals(position, index), uv, index };
}

/* ── Sweep ──────────────────────────────────────────────────────────────────
   Carries a closed 2D section along a 3D path. Each step builds a frame from the
   path tangent and world up, so the section keeps its footing rather than
   barrel-rolling: `right` is horizontal and points outward, `up` stays up.

   This is what a cinnamon roll actually is — one band of dough coiled about the
   centre — and no stack of cylinders will imitate it, because the thing you read
   is the groove spiralling between the turns. */
export function sweep(frames, section, { capStart = true, capEnd = true } = {}) {
  const cols = section.length;
  const position = [], uv = [], index = [];

  frames.forEach((frame, f) => {
    const [px, py, pz] = frame.position;
    const [rx, ry, rz] = frame.right;
    const [ux, uy, uz] = frame.up;
    section.forEach(([sx, sy], s) => {
      const scale = frame.scale || [1, 1];
      const a = sx * scale[0];
      const b = sy * scale[1];
      position.push(px + rx * a + ux * b, py + ry * a + uy * b, pz + rz * a + uz * b);
      uv.push(frame.v, s / (cols - 1));
    });
  });

  for (let f = 0; f < frames.length - 1; f++) {
    for (let s = 0; s < cols - 1; s++) {
      const a = f * cols + s;
      index.push(a, a + cols, a + cols + 1, a, a + cols + 1, a + 1);
    }
  }

  // Caps: a fan to the centre of the end ring, so the cut end of the dough is
  // closed off rather than showing the inside of the tube.
  const fan = (f, flip) => {
    const base = f * cols;
    let cx = 0, cy = 0, cz = 0;
    for (let s = 0; s < cols; s++) {
      cx += position[(base + s) * 3];
      cy += position[(base + s) * 3 + 1];
      cz += position[(base + s) * 3 + 2];
    }
    const centre = position.length / 3;
    position.push(cx / cols, cy / cols, cz / cols);
    uv.push(frames[f].v, 0.5);
    for (let s = 0; s < cols - 1; s++) {
      if (flip) index.push(centre, base + s + 1, base + s);
      else index.push(centre, base + s, base + s + 1);
    }
  };
  if (capStart) fan(0, true);
  if (capEnd) fan(frames.length - 1, false);

  return { position, normal: accumulateNormals(position, index), uv, index };
}

/* Area-weighted face normals. Steadier than the analytic form on superellipsoids
   (which degenerates at the poles) and on swept caps. */
export function accumulateNormals(position, index) {
  const normal = new Array(position.length).fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const ia = index[t] * 3, ib = index[t + 1] * 3, ic = index[t + 2] * 3;
    const ux = position[ib] - position[ia], uy = position[ib + 1] - position[ia + 1], uz = position[ib + 2] - position[ia + 2];
    const vx = position[ic] - position[ia], vy = position[ic + 1] - position[ia + 1], vz = position[ic + 2] - position[ia + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [ia, ib, ic]) {
      normal[o] += nx;
      normal[o + 1] += ny;
      normal[o + 2] += nz;
    }
  }
  for (let o = 0; o < normal.length; o += 3) {
    const l = Math.hypot(normal[o], normal[o + 1], normal[o + 2]) || 1;
    normal[o] /= l;
    normal[o + 1] /= l;
    normal[o + 2] /= l;
  }
  return normal;
}

/* ── Small helpers ── */
export const arcPoints = (cx, cy, r, from, to, steps) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

export const eulerToQuat = (x, y, z) => {
  const c1 = Math.cos(x / 2), s1 = Math.sin(x / 2);
  const c2 = Math.cos(y / 2), s2 = Math.sin(y / 2);
  const c3 = Math.cos(z / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
};

/* A closed superelliptical section in the frame's (right, up) plane, walked from
   the bottom so v runs bottom -> top -> bottom and a texture can band it. */
export const roundedSection = (width, height, roundness = 0.5, steps = 28) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    return [
      (width / 2) * Math.sign(c) * Math.pow(Math.abs(c), roundness),
      (height / 2) * Math.sign(s) * Math.pow(Math.abs(s), roundness),
    ];
  });

/* ── GLB container ── */
const pad4 = (n) => (n + 3) & ~3;

export function writeGLB(parts, outPath, sceneName) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let offset = 0;

  const addAccessor = (data, type, componentType, target) => {
    const array = componentType === 5126 ? new Float32Array(data) : new Uint32Array(data);
    const bytes = new Uint8Array(array.buffer);
    const view = new Uint8Array(pad4(bytes.length));
    view.set(bytes);
    chunks.push(view);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    offset += view.length;

    const components = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
    const min = new Array(components).fill(Infinity);
    const max = new Array(components).fill(-Infinity);
    for (let i = 0; i < data.length; i++) {
      const c = i % components;
      if (data[i] < min[c]) min[c] = data[i];
      if (data[i] > max[c]) max[c] = data[i];
    }
    accessors.push({ bufferView: bufferViews.length - 1, componentType, count: data.length / components, type, min, max });
    return accessors.length - 1;
  };

  const meshes = [];
  const nodes = [];
  for (const part of parts) {
    const { geo } = part;
    meshes.push({
      name: part.name,
      primitives: [
        {
          attributes: {
            POSITION: addAccessor(geo.position, 'VEC3', 5126, 34962),
            NORMAL: addAccessor(geo.normal, 'VEC3', 5126, 34962),
            TEXCOORD_0: addAccessor(geo.uv, 'VEC2', 5126, 34962),
          },
          indices: addAccessor(geo.index, 'SCALAR', 5125, 34963),
          material: 0,
        },
      ],
    });
    nodes.push({
      name: part.name,
      mesh: meshes.length - 1,
      ...(part.translation ? { translation: part.translation } : {}),
      ...(part.rotation ? { rotation: part.rotation } : {}),
    });
  }

  const json = {
    asset: { version: '2.0', generator: 'brewns scripts/build-models.mjs' },
    scene: 0,
    scenes: [{ name: sceneName, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    // One placeholder. The engine swaps in the real materials by node name,
    // because only it knows which variant is being shown.
    materials: [
      { name: 'Placeholder', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.5 } },
    ],
    bufferViews,
    accessors,
    buffers: [{ byteLength: offset }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(pad4(jsonBytes.length)).fill(0x20);
  jsonPadded.set(jsonBytes);

  const bin = new Uint8Array(offset);
  let cursor = 0;
  for (const c of chunks) {
    bin.set(c, cursor);
    cursor += c.length;
  }

  const total = 12 + 8 + jsonPadded.length + 8 + bin.length;
  const glb = new Uint8Array(total);
  const dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546c67, true); // "glTF"
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonPadded.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // "JSON"
  glb.set(jsonPadded, 20);
  const binStart = 20 + jsonPadded.length;
  dv.setUint32(binStart, bin.length, true);
  dv.setUint32(binStart + 4, 0x004e4942, true); // "BIN"
  glb.set(bin, binStart + 8);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, glb);
  console.log(`${outPath} — ${parts.length} nodes, ${(total / 1024).toFixed(1)} KB`);
  console.log(parts.map((p) => `  ${p.name}: ${p.geo.index.length / 3} tris`).join('\n'));
}
