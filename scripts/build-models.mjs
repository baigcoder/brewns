/**
 * Authors the product models under public/assets/shop/ as real assets rather
 * than primitives assembled at runtime.
 *
 *   iced-cup.glb      Cup, Liquid, Surface, Lid, Straw, Ice_0..Ice_4
 *   cinnamon-roll.glb Plate, Roll, Glaze, GlazeExtra
 *
 * Everything here is geometry. Materials and textures stay in the engine, which
 * knows which drink is in the cup and which variant is selected; the glb carries
 * named nodes for it to bind to.
 *
 * Run: bun run build:models
 */
import { revolve, roundedBox, sweep, arcPoints, eulerToQuat, roundedSection, writeGLB } from './lib/model-kit.mjs';

const SEG = 64; // radial segments — the silhouette is the whole read at this size

/* ══════════════════════════════════════════════════════════════════════════
   Iced cup
   ══════════════════════════════════════════════════════════════════════════ */

/* The cup: a shell with real wall thickness. Walked from the middle of the
   inside floor, up the inside, over the rolled rim, down the outside and back
   under the foot. A single closed profile, so the plastic has an inner and an
   outer surface the way moulded PET does — which is what gives the rim and the
   foot their bright double edge. */
const CUP = [
  [0.0, -0.402],
  [0.23, -0.402],
  [0.248, -0.392],
  [0.34, 0.372],
  ...arcPoints(0.352, 0.384, 0.013, Math.PI, 0, 10), // rolled lip, inside over to outside
  [0.366, 0.372],
  [0.272, -0.376],
  [0.276, -0.386], // moulded step above the foot
  [0.268, -0.398],
  [0.258, -0.41],
  [0.25, -0.421],
  [0.232, -0.426],
  [0.0, -0.426],
];

const LID_BASE = 0.4;
const LID_DOME = 0.2;
const LID_RADIUS = 0.366;
const LID_HOLE = 0.055;
const capSphere = (LID_RADIUS * LID_RADIUS + LID_DOME * LID_DOME) / (2 * LID_DOME);
const capCentre = LID_DOME - capSphere;
const capPoints = [];
for (let i = 0; i <= 14; i++) {
  const y = (i / 14) * LID_DOME;
  const x = Math.sqrt(Math.max(0, capSphere * capSphere - (y - capCentre) * (y - capCentre)));
  if (x <= LID_HOLE) break;
  capPoints.push([x, y]);
}
const LID_OUTSIDE_IN = [
  [0.366, -0.062],
  [0.38, -0.054],
  [0.382, -0.014],
  [0.372, 0.0],
  ...capPoints,
  [LID_HOLE, LID_DOME],
  // Back down the underside, so the lid is a shell and not a decal.
  [LID_HOLE - 0.006, LID_DOME - 0.004],
  ...capPoints.map(([x, y]) => [x - 0.006, y - 0.004]).reverse(),
  [0.366, -0.004],
  [0.376, -0.016],
  [0.374, -0.052],
  [0.36, -0.06],
];
const LID = LID_OUTSIDE_IN.slice().reverse();

/* Liquid sits inside the wall, so the plastic reads as having thickness. */
const LIQUID_BODY = [
  [0.324, 0.33],
  [0.238, -0.396],
  [0.0, -0.396],
];
const LIQUID_TOP = [
  [0.0, 0.33],
  [0.324, 0.33],
];

const STRAW = [
  [0.0, 0.506],
  [0.016, 0.51],
  [0.02, 0.51],
  [0.02, -0.51],
  [0.0, -0.51],
];

const ICE = [
  [-0.11, 0.33, 0.06, 0.4, 0.6, 0.2],
  [0.1, 0.32, -0.06, -0.3, 0.8, -0.2],
  [0.0, 0.37, 0.08, 0.2, 0.1, 0.5],
  [-0.05, 0.34, -0.1, 0.5, -0.4, 0.3],
  [0.12, 0.35, 0.05, -0.2, 0.5, 0.4],
];

/* Planar UVs for the drink's surface: that texture is drawn looking down at it. */
function planarTopUV(geo, radius) {
  for (let i = 0, u = 0; i < geo.position.length; i += 3, u += 2) {
    geo.uv[u] = geo.position[i] / (radius * 2) + 0.5;
    geo.uv[u + 1] = geo.position[i + 2] / (radius * 2) + 0.5;
  }
  return geo;
}

writeGLB(
  [
    { name: 'Cup', geo: revolve(CUP, SEG) },
    // Walked top-down for the winding, so v is flipped back: the body texture is
    // painted with the milk at the bottom of the canvas.
    { name: 'Liquid', geo: revolve(LIQUID_BODY, SEG, { flipV: true }) },
    { name: 'Surface', geo: planarTopUV(revolve(LIQUID_TOP, SEG), 0.324) },
    { name: 'Lid', geo: revolve(LID, SEG), translation: [0, LID_BASE, 0] },
    {
      name: 'Straw',
      geo: revolve(STRAW, 28),
      translation: [-0.067, 0.34, 0],
      rotation: eulerToQuat(0.07, 0, -0.22),
    },
    ...ICE.map(([x, y, z, rx, ry, rz], i) => ({
      name: `Ice_${i}`,
      geo: roundedBox(0.13),
      translation: [x, y, z],
      rotation: eulerToQuat(rx, ry, rz),
    })),
  ],
  'public/assets/shop/iced-cup.glb',
  'IcedCup',
);

/* ══════════════════════════════════════════════════════════════════════════
   Cinnamon roll

   One band of dough coiled about the centre, which is what the pastry is. The
   groove that spirals between the turns is the thing the eye reads, and a stack
   of cylinders cannot produce it at any level of detail.
   ══════════════════════════════════════════════════════════════════════════ */

const TURNS = 3.05;
const R_INNER = 0.055;
const R_OUTER = 0.395;
const BAND_HEIGHT = 0.255;
const THETA_END = TURNS * Math.PI * 2;
const SPIRAL_RATE = (R_OUTER - R_INNER) / THETA_END;
// Slightly narrower than the radial pitch, so consecutive turns leave a groove
// between them instead of fusing into a wall.
const BAND_WIDTH = SPIRAL_RATE * Math.PI * 2 * 0.80;

/* Frames along the Archimedean spiral. `right` is the horizontal normal to the
   path — cross(up, tangent) — so the band stands upright all the way round
   rather than rolling over as the curve tightens. */
function spiralFrames(steps, { lift = 0, heightScale = 1 } = {}) {
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * THETA_END;
    const r = R_INNER + SPIRAL_RATE * theta;
    const cos = Math.cos(theta), sin = Math.sin(theta);

    // d/dtheta of (r cos, r sin), with r' = SPIRAL_RATE
    let tx = SPIRAL_RATE * cos - r * sin;
    let tz = SPIRAL_RATE * sin + r * cos;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    // cross([0,1,0], [tx,0,tz]) = [tz, 0, -tx]
    const right = [tz, 0, -tx];

    // A baked roll stands tallest at the middle and settles at the rim.
    const h = BAND_HEIGHT * (1 - 0.26 * t) * heightScale;
    frames.push({
      position: [r * cos, h / 2 + lift, r * sin],
      right,
      up: [0, 1, 0],
      scale: [1, h / BAND_HEIGHT],
      v: t * TURNS, // repeats once per turn, so the dough grain does not stretch
    });
  }
  return frames;
}

const ROLL_STEPS = 260;
const rollFrames = spiralFrames(ROLL_STEPS);
const roll = sweep(rollFrames, roundedSection(BAND_WIDTH, BAND_HEIGHT, 0.68, 20));

/* Icing piped along the top of the coil. Its radius swells and thins along the
   path, the way a drizzle does, rather than running at one even thickness. */
function glazeAlong(scale) {
  const steps = 170;
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * THETA_END;
    const r = R_INNER + SPIRAL_RATE * theta;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    let tx = SPIRAL_RATE * cos - r * sin;
    let tz = SPIRAL_RATE * sin + r * cos;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const h = BAND_HEIGHT * (1 - 0.26 * t);
    const swell = 1 + 0.28 * Math.sin(theta * 3.1) + 0.14 * Math.sin(theta * 7.7);
    frames.push({
      position: [r * cos, h - 0.012 * scale, r * sin],
      right: [tz, 0, -tx],
      up: [0, 1, 0],
      scale: [swell * scale, swell * scale],
      v: t * TURNS,
    });
  }
  return sweep(frames, roundedSection(BAND_WIDTH * 0.46, BAND_WIDTH * 0.46, 1, 12));
}

/* A shallow saucer. Walked from the centre of the face outward, over the rim and
   back under to the foot ring. */
const PLATE = [
  [0.0, -0.292],
  [0.44, -0.294],
  [0.55, -0.282],
  [0.6, -0.272],
  [0.618, -0.28],
  [0.61, -0.296],
  [0.53, -0.304],
  [0.3, -0.32],
  [0.242, -0.322],
  [0.236, -0.336],
  [0.214, -0.336],
  [0.206, -0.32],
  [0.0, -0.314],
];

// The band's own bottom sits at y = 0, so the whole roll drops onto the plate.
const PLATE_FACE = -0.292;

writeGLB(
  [
    { name: 'Plate', geo: revolve(PLATE, SEG) },
    { name: 'Roll', geo: roll, translation: [0, PLATE_FACE, 0] },
    { name: 'Glaze', geo: glazeAlong(1), translation: [0, PLATE_FACE, 0] },
    { name: 'GlazeExtra', geo: glazeAlong(1.55), translation: [0, PLATE_FACE, 0] },
  ],
  'public/assets/shop/cinnamon-roll.glb',
  'CinnamonRoll',
);

/* ══════════════════════════════════════════════════════════════════════════
   Draco compression

   The assets above are written raw so the writer stays dependency-free and
   readable. This pass shrinks them for delivery: the site's loader already has
   a DRACOLoader pointed at public/draco/gltf/, so compressed files decode with
   no runtime change.

   Quantization: positions at 14 bits is well under a hundredth of a millimetre
   on a unit-sized cup; UVs at 12 bits give 4096 steps across a texture at most
   2048 wide, so the printed label cannot shimmer or drift.
   ══════════════════════════════════════════════════════════════════════════ */
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { statSync } from 'node:fs';

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

for (const path of ['public/assets/shop/iced-cup.glb', 'public/assets/shop/cinnamon-roll.glb']) {
  const before = statSync(path).size;
  const doc = await io.read(path);
  doc
    .createExtension(KHRDracoMeshCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
      encodeSpeed: 5,
      decodeSpeed: 5,
      quantizationBits: { POSITION: 14, NORMAL: 10, TEX_COORD: 12 },
    });
  await io.write(path, doc);
  const after = statSync(path).size;
  console.log(`${path}: draco ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
}
