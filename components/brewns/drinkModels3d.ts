// @ts-nocheck
/* The cortado, the nitro cold brew and the travel tumbler: glass and metal
   built from lathe profiles with real glass (transmission) and a liquid that
   stays inside the wall. Uses the tools in foodKit.ts. */
import type * as THREE from 'three';
import { Kit, assemble, clamp01, draw, fbm, lathe, mix, paint, plate, rng, roundBox, scatter, surface } from './foodKit';
import type { VariantEngine } from './pdp3dEngine';

type Sel = Record<string, number>;
const TAU = Math.PI * 2;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** A thick-based drinking glass as one closed shell: outside, rim, inside, floor. */
export function glassShell(T: typeof THREE, kit: Kit, o: { rb: number; rt: number; h: number; wall: number; base: number; bevel?: number }) {
  const { rb, rt, h, wall, base } = o;
  const bev = o.bevel ?? 0.03;
  const rAt = (y: number) => rb + ((rt - rb) * y) / h;
  const pts = [
    [0, 0], [rb - bev, 0], [rb - bev * 0.3, 0.004], [rb, bev],
    [rAt(h * 0.5), h * 0.5], [rt, h],
    [rt + 0.004, h + 0.004], [rt - wall * 0.5, h + 0.008], [rt - wall - 0.002, h],
    [rAt(base + (h - base) * 0.5) - wall, base + (h - base) * 0.5], [rAt(base) - wall, base],
    [(rb - wall) * 0.6, base - 0.006], [0, base - 0.008],
  ];
  const geo = lathe(T, kit, pts, 96);
  const mat = kit.add(
    new T.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0,
      transmission: 1,
      thickness: 0.05,
      ior: 1.5,
      attenuationColor: new T.Color(0xdff2ea),
      attenuationDistance: 0.6,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.3,
      side: T.DoubleSide,
    }),
  );
  const mesh = new T.Mesh(geo, mat);
  mesh.userData.noShadow = true;
  return { mesh, innerR: (y: number) => rAt(y) - wall - 0.002 };
}

/** The drink inside: an opaque body that sits against the inner wall, with a painted vertical gradient. */
function liquidBody(T: typeof THREE, kit: Kit, innerR: (y: number) => number, y0: number, y1: number, tex: THREE.Texture | { map: THREE.Texture; bump: THREE.Texture }, o: Record<string, unknown> = {}) {
  const pts = [[0, y0], [innerR(y0), y0], [innerR((y0 + y1) / 2), (y0 + y1) / 2], [innerR(y1), y1], [0, y1]];
  const geo = lathe(T, kit, pts, 80);
  const mat = tex && tex.map ? surface(T, kit, tex, { roughness: 0.3, bumpScale: 0.6, ...o }) : kit.add(new T.MeshStandardMaterial({ map: tex, roughness: 0.3, ...o }));
  return new T.Mesh(geo, mat);
}

const heart = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 1.5, cy + s * 0.1, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.5, cy + s * 0.1, cx, cy + s * 0.95);
  ctx.closePath();
};

/** Top-down latte art: a crema-brown surface with a poured rosetta of nested hearts. */
const latteArt = (T: typeof THREE, kit: Kit, milk: string, milkEdge: string) =>
  draw(T, kit, 512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    g.addColorStop(0, '#c98d55');
    g.addColorStop(0.7, '#9a5f30');
    g.addColorStop(1, '#5a3218');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(2.2px)';
    const shades = [milk, '#c99a68', milk, '#c99a68', milk, milkEdge];
    for (let i = 0; i < shades.length; i++) {
      ctx.fillStyle = shades[i];
      heart(ctx, 256, 292 - i * 30, 176 - i * 27);
      ctx.fill();
    }
    // The pull-through, drawn from the top of the heart down.
    ctx.strokeStyle = 'rgba(96,58,28,0.85)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(256, 130);
    ctx.lineTo(256, 430);
    ctx.stroke();
    ctx.filter = 'none';
    const R = rng(7);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,240,210,${0.05 + R() * 0.12})`;
      ctx.beginPath();
      ctx.arc(R() * w, R() * h, 1 + R() * 3, 0, TAU);
      ctx.fill();
    }
  });

/**
 * A Gibraltar glass: round above, with the heavy lower part cut into eight flat panels. The material is the same glass
 * as glassShell's; the facets are flat-shaded so each panel catches the light as one plane.
 */
function gibraltarShell(T: typeof THREE, kit: Kit, o: { rb: number; rt: number; h: number; wall: number; base: number; facetH: number }) {
  const { rb, rt, h, wall, base, facetH } = o;
  const rAt = (y: number) => rb + ((rt - rb) * y) / h;
  const bev = 0.02;
  const mat = (glassShell(T, kit, o).mesh as THREE.Mesh).material as THREE.Material;
  const g = new T.Group();
  // the octagonal foot: outer panels from the bottom edge up to the shoulder, closed on top by the round wall
  const foot = lathe(T, kit, [[0, 0], [rb - bev, 0], [rb * 1.02, bev], [rAt(facetH) * 1.03, facetH]], 8).toNonIndexed();
  foot.computeVertexNormals();
  kit.add(foot);
  g.add(new T.Mesh(foot, mat));
  // the round upper wall, outside and in, down to the thick floor
  const upper = lathe(T, kit, [
    [rAt(facetH), facetH], [rAt(h * 0.6), h * 0.6], [rt, h], [rt + 0.004, h + 0.004], [rt - wall * 0.5, h + 0.008], [rt - wall - 0.002, h],
    [rAt(base + (h - base) * 0.5) - wall, base + (h - base) * 0.5], [rAt(base) - wall, base], [(rb - wall) * 0.6, base - 0.006], [0, base - 0.008],
  ], 96);
  g.add(new T.Mesh(upper, mat));
  g.children.forEach((c) => (c.userData.noShadow = true));
  g.userData.noShadow = true;
  return { mesh: g, innerR: (y: number) => rAt(y) - wall - 0.002 };
}

/** Top-down cortado art: dark crema with a swirl, and a single white heart poured into it. */
const cortadoArt = (T: typeof THREE, kit: Kit) =>
  draw(T, kit, 512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(256, 256, 10, 256, 256, 256);
    g.addColorStop(0, '#a8601f');
    g.addColorStop(0.65, '#8a4f1c');
    g.addColorStop(1, '#53290f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const R = rng(5);
    ctx.filter = 'blur(2px)';
    // pale ripples of crema round the heart
    ctx.strokeStyle = 'rgba(210,160,100,0.45)';
    ctx.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(256, 262, 150 + i * 28, 120 + i * 24, 0, 0.3 + i * 0.1, TAU - 0.3 - i * 0.1);
      ctx.stroke();
    }
    // the heart: milk, then a darker line inside it, then the milk again
    ctx.fillStyle = '#f6ead4';
    heart(ctx, 256, 262, 158);
    ctx.fill();
    ctx.fillStyle = '#c99a68';
    heart(ctx, 256, 276, 104);
    ctx.fill();
    ctx.fillStyle = '#f6ead4';
    heart(ctx, 256, 284, 76);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,30,0.7)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(256, 180);
    ctx.lineTo(256, 392);
    ctx.stroke();
    ctx.filter = 'none';
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(60,30,12,${0.05 + R() * 0.12})`;
      ctx.beginPath();
      ctx.arc(R() * w, R() * h, 1 + R() * 2.5, 0, TAU);
      ctx.fill();
    }
  });

/* ── cortado ── */

export function createCortadoModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();

  // No saucer: in the photograph the glass stands on its own.
  const g = { rb: 0.205, rt: 0.27, h: 0.6, wall: 0.026, base: 0.12, facetH: 0.2 };
  const glass = gibraltarShell(T, kit, g);
  const drink = new T.Group();
  inner.add(drink);

  // Espresso through steamed milk, dark at the bottom and lightening to the crema.
  const body = paint(T, kit, 8, 128, (u, v) => {
    // caramel milk coffee, a little darker at the foot, with a paler band of foam just under the crema
    const c = mix(mix([96, 62, 38], [150, 106, 68], smoothstep(0.0, 0.55, v)), [200, 164, 120], smoothstep(0.82, 1, v));
    return [c[0], c[1], c[2], 0.5 + fbm(u * 3, v * 10, 1, 3, 4) * 0.4];
  });
  const fillTop = 0.52;
  const liquid = liquidBody(T, kit, glass.innerR, g.base + 0.004, fillTop, body, { bumpScale: 0.2, roughness: 0.35 });
  drink.add(liquid);

  // Foam surface with the heart.
  const art = cortadoArt(T, kit);
  const foamGeo = kit.add(new T.CircleGeometry(glass.innerR(fillTop), 64));
  foamGeo.rotateX(-Math.PI / 2);
  const fp = foamGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setY(i, (1 - Math.hypot(fp.getX(i), fp.getZ(i)) / glass.innerR(fillTop)) * 0.012);
  foamGeo.computeVertexNormals();
  const foamMat = kit.add(new T.MeshPhysicalMaterial({ map: art, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5 }));
  const foam = new T.Mesh(foamGeo, foamMat);
  foam.position.y = fillTop + 0.002;
  foam.rotation.y = Math.PI;
  drink.add(foam);
  // A crest of foam clinging to the wall.
  const ringGeo = kit.add(new T.TorusGeometry(glass.innerR(fillTop) - 0.003, 0.009, 10, 64));
  ringGeo.rotateX(Math.PI / 2);
  const ring = new T.Mesh(ringGeo, kit.add(new T.MeshStandardMaterial({ color: 0xead8b8, roughness: 0.5 })));
  ring.position.y = fillTop;
  drink.add(ring);

  inner.add(glass.mesh);

  const dark = new T.Color(), tint = new T.Color();
  const apply = (s: Sel) => {
    // Triple shot darkens the body; oat and almond warm the milk.
    const shots = s.shots === 1 ? 0.78 : 1;
    const milk = [1, 0.96, 0.94][s.milk ?? 0] ?? 1;
    liquid.material.color.setScalar(shots * milk);
    foam.material.color.setRGB(1, [1, 0.97, 0.93][s.milk ?? 0] ?? 1, [1, 0.92, 0.86][s.milk ?? 0] ?? 1);
  };
  const piece = assemble(T, kit, inner, { sel, apply, steam: { count: 18, height: 0.03, on: (s) => s.temp === 1 }, shadow: [1.5, 1.3] });
  // Seen from above, as in the photograph, so the heart on the foam shows.
  piece.group.userData.viewPitch = 0.5;
  return piece;
}

/* ── nitro cold brew ── */

export function createNitroColdBrewModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  // The photograph's glass is the same short, faceted Gibraltar as the cortado's, not a tall pint.
  const g = { rb: 0.205, rt: 0.28, h: 0.62, wall: 0.03, base: 0.12, facetH: 0.2 };
  const glass = gibraltarShell(T, kit, g);

  // The cascade: a mahogany body with lighter clouds falling through the bottom of it.
  const cascadeTex = (sweet: boolean) =>
    paint(T, kit, 256, 256, (u, v) => {
      const n = fbm(u * 6, v * 2.2, 2, 4, 5);
      const streak = fbm(u * 26, v * 1.4, 4, 3, 9);
      const fall = smoothstep(0.35, 0.95, v) * smoothstep(0.3, 0.75, streak + n * 0.3);
      let c = mix([30, 16, 9], [58, 32, 17], n);
      c = mix(c, sweet ? [206, 156, 108] : [138, 88, 50], fall * (sweet ? 0.7 : 0.55));
      c = mix(c, [24, 12, 7], smoothstep(0.35, 0.0, v) * 0.7);
      return [c[0], c[1], c[2], 0.5];
    });
  const plain = cascadeTex(false), sweet = cascadeTex(true);
  const fillTop = 0.5;
  // The coffee sits a little inside the wall so the ice pressed between them shows through the glass.
  const liquid = liquidBody(T, kit, (y: number) => glass.innerR(y) - 0.045, g.base + 0.004, fillTop, plain, { roughness: 0.22, bumpScale: 0.1 });
  inner.add(liquid);
  const skin = new T.Mesh(
    kit.add(new T.CylinderGeometry(glass.innerR(fillTop) - 0.004, glass.innerR(g.base) - 0.004, fillTop - g.base, 64, 1, true)),
    kit.add(new T.MeshPhysicalMaterial({ color: 0x2a1408, roughness: 0.2, transparent: true, opacity: 0.14, side: T.DoubleSide, depthWrite: false })),
  );
  skin.position.y = (fillTop + g.base) / 2;
  skin.userData.noShadow = true;
  inner.add(skin);
  // Clear ice with a warm coffee tint, pressed against the front and sides.
  const iceGeo = roundBox(T, kit, 0.11, 0.1, 0.11, 0.022, 6);
  const iceMat = kit.add(new T.MeshPhysicalMaterial({ // opaque on purpose: a transparent cube is lost inside the glass's transmission pass
    color: 0x8a5a2c, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, specularIntensity: 1, transparent: false }));
  scatter(T, kit, inner, iceGeo, iceMat, 6, (i, r) => {
    const A = [0.3, -0.55, 0.95, -1.15, 2.5, 3.7][i];
    const y = [0.3, 0.37, 0.25, 0.31, 0.34, 0.3][i];
    const rad = glass.innerR(y) - 0.03; // between the drink and the wall, where a photograph sees the cubes
    return { pos: [Math.sin(A) * rad, y, Math.cos(A) * rad], rot: [r() * 0.9, r() * TAU, r() * 0.9], scale: 0.5 + r() * 0.14 };
  }, 21);

  // The thick nitro head, domed, with a creamy collar down the glass.
  const headTex = paint(T, kit, 128, 128, (u, v) => {
    const n = fbm(u * 10, v * 10, 3, 4, 3);
    const c = mix([242, 226, 200], [250, 240, 220], n);
    return [c[0], c[1], c[2], 0.4 + n * 0.5];
  });
  const headH = 0.09;
  const r0 = glass.innerR(fillTop + headH);
  const headGeo = lathe(T, kit, [[0, fillTop - 0.01], [glass.innerR(fillTop), fillTop - 0.01], [r0, fillTop + headH * 0.5], [r0 * 0.99, fillTop + headH], [r0 * 0.78, fillTop + headH + 0.022], [r0 * 0.4, fillTop + headH + 0.034], [0, fillTop + headH + 0.036]], 72);
  displaceHead(headGeo);
  const head = new T.Mesh(headGeo, surface(T, kit, headTex, { roughness: 0.55, bumpScale: 2, physical: true, sheen: 0.4, sheenColor: new T.Color(0xfff2d8) }));
  inner.add(head);
  // The sweet cream: a marbled layer that sits under the head.
  const cream = new T.Mesh(lathe(T, kit, [[0, fillTop - 0.11], [glass.innerR(fillTop - 0.11), fillTop - 0.11], [glass.innerR(fillTop), fillTop - 0.005], [0, fillTop - 0.005]], 64), kit.add(new T.MeshStandardMaterial({ color: 0xe8cfa6, roughness: 0.4, transparent: true, opacity: 0.9 })));
  inner.add(cream);
  inner.add(glass.mesh);

  // A little condensation beading on the glass.
  const bead = kit.add(new T.SphereGeometry(0.006, 8, 6));
  const beadMat = kit.add(new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 0.02, ior: 1.33, transparent: true, opacity: 0.85 }));
  scatter(T, kit, inner, bead, beadMat, 46, (i, r) => {
    const a = r() * TAU, y = 0.14 + r() * 0.4;
    const rad = glass.innerR(y) + g.wall + 0.004;
    return { pos: [Math.sin(a) * rad, y, Math.cos(a) * rad], scale: [1, 1 + r() * 0.8, 0.6] };
  }, 8);

  const apply = (s: Sel) => {
    const sw = s.style === 1;
    liquid.material.map = sw ? sweet.map : plain.map;
    liquid.material.bumpMap = sw ? sweet.bump : plain.bump;
    liquid.material.needsUpdate = true;
    cream.visible = sw;
  };
  const piece = assemble(T, kit, inner, { sel, apply, shadow: [1.2, 1.2] });
  piece.group.userData.viewPitch = 0.22;
  return piece;

  function displaceHead(geo: THREE.BufferGeometry) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > fillTop + headH * 0.6) p.setY(i, y + (fbm(x * 12, y * 12, z * 12, 3, 4) - 0.5) * 0.012);
    }
    geo.computeVertexNormals();
  }
}

/* ── travel tumbler ── */

const COLORWAYS = [
  { body: [30, 30, 32], sheen: 0x3a3a40 },
  { body: [214, 196, 164], sheen: 0xffffff },
  { body: [176, 112, 52], sheen: 0xffd9a0 },
];

export function createCeramicTumblerModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();

  // The body: matte, tapering to a narrower base with a rounded foot, as in the photograph (about 0.77 of the height).
  const bodyPts = [[0, 0.012], [0.15, 0.012], [0.186, 0.03], [0.203, 0.09], [0.222, 0.4], [0.246, 0.7], [0.256, 0.765]];
  const bodyGeo = lathe(T, kit, bodyPts, 96);
  const powder = (tone: number[]) =>
    paint(T, kit, 128, 128, (u, v) => {
      const n = fbm(u * 40, v * 40, 1, 3, 4);
      const c = mix(tone, [tone[0] * 1.1, tone[1] * 1.1, tone[2] * 1.1], n);
      return [c[0], c[1], c[2], 0.45 + n * 0.55];
    });
  let texKey = -1, tex = null;
  const bodyMat = kit.add(new T.MeshPhysicalMaterial({ roughness: 0.62, metalness: 0.02, sheen: 0.35, sheenRoughness: 0.6, clearcoat: 0.06, clearcoatRoughness: 0.7 }));
  const body = new T.Mesh(bodyGeo, bodyMat);
  inner.add(body);

  // The lid is matte silicone, the same black as the cup: a wide band that grips the rim, a step in, a shallow dome
  // with a recessed top, a sip hole at the back and a drinking slot at the front.
  const lidMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x1f1f21, roughness: 0.8, clearcoat: 0, specularIntensity: 0.35, envMapIntensity: 0.6, sheen: 0.3, sheenRoughness: 0.7 }));
  const lidGeo = lathe(T, kit, [
    [0.246, 0.742], [0.272, 0.748], [0.284, 0.764], [0.286, 0.8], [0.282, 0.842], [0.262, 0.858],
    [0.24, 0.866], [0.238, 0.92], [0.232, 0.958], [0.214, 0.976], [0.18, 0.98], [0.172, 0.972], [0, 0.972],
  ], 96);
  const lid = new T.Mesh(lidGeo, lidMat);
  inner.add(lid);
  const dark = kit.add(new T.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 }));
  const hole = new T.Mesh(kit.add(new T.CylinderGeometry(0.01, 0.01, 0.006, 16)), dark);
  hole.position.set(0, 0.974, -0.095);
  inner.add(hole);
  const slot = new T.Mesh(kit.add(new T.CylinderGeometry(0.03, 0.03, 0.006, 24)), dark);
  slot.scale.set(1.7, 1, 0.7);
  slot.position.set(0, 0.974, 0.115);
  inner.add(slot);
  // The options: a slide cover over the drinking slot, or a raised 360-degree lip round the opening.
  const slide = new T.Mesh(kit.add(new T.BoxGeometry(0.15, 0.012, 0.07)), lidMat);
  slide.position.set(0, 0.981, 0.115);
  inner.add(slide);
  const lip = new T.Mesh(kit.add(new T.TorusGeometry(0.062, 0.016, 12, 40)), lidMat); // a visibly raised ring, so the 360-degree lid reads as different from the slide cover
  lip.rotation.x = Math.PI / 2;
  lip.scale.set(1.5, 1, 1);
  lip.position.set(0, 0.99, 0.1);
  inner.add(lip);

  // The printing is lifted from the product photograph itself: its gold pixels (wordmark and emblem) are cut out
  // and wrapped round the front of the cup, so letterforms and proportions are the real ones. Until the photograph
  // has loaded a plain gold wordmark stands in.
  const LW = 1024, LH = 640;
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = LW;
  logoCanvas.height = LH;
  const lctx = logoCanvas.getContext('2d')!;
  lctx.fillStyle = '#c9a25a';
  lctx.font = '700 230px Arial, sans-serif';
  lctx.textAlign = 'center';
  lctx.fillText('brewns', LW / 2, 300);
  const logo = new T.CanvasTexture(logoCanvas);
  logo.colorSpace = T.SRGBColorSpace;
  logo.anisotropy = 8;
  kit.add(logo);
  let logoAspect = LW / LH;
  let decal: THREE.Mesh;
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.drawImage(img, 0, 0);
      const data = x.getImageData(0, 0, c.width, c.height).data;
      const goldness = (i: number) => Math.max(0, Math.min(1, (data[i] - data[i + 2] - 30) / 60)) * (data[i + 3] / 255);
      // bounds from row and column counts, so a stray warm pixel elsewhere in the photograph cannot stretch the crop
      const colN = new Uint32Array(c.width), rowN = new Uint32Array(c.height);
      for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
        if (goldness((py * c.width + px) * 4) > 0.35) { colN[px]++; rowN[py]++; }
      }
      const span = (n: Uint32Array) => {
        let lo = -1, hi = -1;
        n.forEach((v, i) => { if (v >= 3) { if (lo < 0) lo = i; hi = i; } });
        return [lo, hi];
      };
      let [x0, x1] = span(colN);
      let [y0, y1] = span(rowN);
      if (x1 < 0 || y1 < 0) return;
      const pad = 6;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const scale = Math.min(LW / cw, LH / ch);
      const out = document.createElement('canvas');
      out.width = Math.round(cw * scale);
      out.height = Math.round(ch * scale);
      const crop = document.createElement('canvas');
      crop.width = cw;
      crop.height = ch;
      const cctx = crop.getContext('2d')!;
      const id2 = cctx.createImageData(cw, ch);
      for (let py = 0; py < ch; py++) for (let px = 0; px < cw; px++) {
        const si = ((py + y0) * c.width + (px + x0)) * 4, di = (py * cw + px) * 4;
        const a2 = Math.min(1, goldness(si) * 1.4);
        id2.data[di] = data[si]; id2.data[di + 1] = data[si + 1]; id2.data[di + 2] = data[si + 2]; id2.data[di + 3] = Math.round(a2 * 255);
      }
      cctx.putImageData(id2, 0, 0);
      const octx = out.getContext('2d')!;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(crop, 0, 0, out.width, out.height);
      logoCanvas.width = out.width;
      logoCanvas.height = out.height;
      lctx.clearRect(0, 0, out.width, out.height);
      lctx.drawImage(out, 0, 0);
      logoAspect = out.width / out.height;
      logo.needsUpdate = true;
      sizeDecal();
    } catch {
      /* keep the stand-in wordmark */
    }
  };
  img.src = '/assets/menu/tumbler-black.webp';
  // The decal's arc and height follow the cutout's proportions: about 0.34 of the cup's height wide on the front.
  const sizeDecal = () => {
    const wArc = 0.34, hh = wArc / logoAspect;
    const theta = wArc / 0.235;
    decal = decal ?? new T.Mesh(undefined, kit.add(new T.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.5, metalness: 0.35, depthWrite: false })));
    decal.geometry = kit.add(new T.CylinderGeometry(0.2395, 0.2385, hh, 48, 1, true, -theta / 2, theta));
    decal.position.y = 0.5;
    if (!decal.parent) inner.add(decal);
  };
  sizeDecal();

  const apply = (s: Sel) => {
    const cw = COLORWAYS[s.color ?? 0] ?? COLORWAYS[0];
    if (texKey !== (s.color ?? 0)) {
      texKey = s.color ?? 0;
      tex = powder(cw.body);
      bodyMat.map = tex.map;
      bodyMat.bumpMap = tex.bump;
      bodyMat.bumpScale = 0.6;
      bodyMat.sheenColor = new T.Color(cw.sheen);
      bodyMat.needsUpdate = true;
    }
    const sip = s.lid === 1;
    slide.visible = !sip;
    lip.visible = sip;
    // gold print on the black body; a dark print on the cream and the copper bodies, where gold would vanish
    decal.material.color.setHex(texKey === 1 ? 0x6a4a28 : texKey === 2 ? 0x4a2410 : 0xffffff);
  };
  return assemble(T, kit, inner, { sel, apply, shadow: [1.2, 1.2] });
}
