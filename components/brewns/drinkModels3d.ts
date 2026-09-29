// @ts-nocheck
/* The cortado, the nitro cold brew and the travel tumbler: glass and metal
   built from lathe profiles with real glass (transmission) and a liquid that
   stays inside the wall. Uses the tools in foodKit.ts. */
import type * as THREE from 'three';
import { Kit, assemble, clamp01, draw, fbm, lathe, mix, paint, plate, rng, scatter, surface } from './foodKit';
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

/* ── cortado ── */

export function createCortadoModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();

  // A small saucer under the glass.
  const saucer = plate(T, kit, 0.5);
  inner.add(saucer);

  const g = { rb: 0.235, rt: 0.27, h: 0.44, wall: 0.026, base: 0.075 };
  const glass = glassShell(T, kit, g);
  glass.mesh.position.y = 0.045;
  const drink = new T.Group();
  drink.position.y = 0.045;
  inner.add(drink);

  // Espresso through steamed milk, dark at the bottom and lightening to the crema.
  const body = paint(T, kit, 8, 128, (u, v) => {
    const c = mix(mix([48, 24, 12], [104, 62, 32], smoothstep(0.0, 0.5, v)), [186, 132, 82], smoothstep(0.45, 1, v));
    return [c[0], c[1], c[2], 0.5 + fbm(u * 3, v * 10, 1, 3, 4) * 0.4];
  });
  const fillTop = 0.375;
  const liquid = liquidBody(T, kit, glass.innerR, g.base + 0.004, fillTop, body, { bumpScale: 0.2, roughness: 0.35 });
  drink.add(liquid);

  // Foam surface with the heart.
  const art = latteArt(T, kit, '#f7ead4', '#efe0c4');
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
  return assemble(T, kit, inner, { sel, apply, steam: { count: 18, height: 0.03, on: (s) => s.temp === 1 }, shadow: [1.5, 1.3] });
}

/* ── nitro cold brew ── */

export function createNitroColdBrewModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();
  const g = { rb: 0.2, rt: 0.28, h: 0.92, wall: 0.03, base: 0.11 };
  const glass = glassShell(T, kit, g);
  glass.mesh.position.y = 0;

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
  const fillTop = 0.72;
  const liquid = liquidBody(T, kit, glass.innerR, g.base + 0.004, fillTop, plain, { roughness: 0.22, bumpScale: 0.1 });
  inner.add(liquid);

  // The thick nitro head, domed, with a creamy collar down the glass.
  const headTex = paint(T, kit, 128, 128, (u, v) => {
    const n = fbm(u * 10, v * 10, 3, 4, 3);
    const c = mix([242, 226, 200], [250, 240, 220], n);
    return [c[0], c[1], c[2], 0.4 + n * 0.5];
  });
  const headH = 0.15;
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
    const a = r() * TAU, y = 0.12 + r() * 0.6;
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
  return assemble(T, kit, inner, { sel, apply, shadow: [1.2, 1.2] });

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
  { body: [44, 44, 46], sheen: 0x555560 },
  { body: [214, 196, 164], sheen: 0xffffff },
  { body: [176, 112, 52], sheen: 0xffd9a0 },
];

export function createCeramicTumblerModel(T: typeof THREE, id: string, sel: Sel = {}): VariantEngine {
  const kit = new Kit();
  const inner = new T.Group();

  // The double-wall body, tapering, with a rolled bottom edge.
  const bodyPts = [[0, 0.03], [0.205, 0.03], [0.238, 0.045], [0.252, 0.09], [0.264, 0.45], [0.282, 0.86], [0.286, 0.9]];
  const bodyGeo = lathe(T, kit, bodyPts, 96);
  const powder = (tone: number[]) =>
    paint(T, kit, 128, 128, (u, v) => {
      const n = fbm(u * 40, v * 40, 1, 3, 4);
      const c = mix(tone, [tone[0] * 1.12, tone[1] * 1.12, tone[2] * 1.12], n);
      return [c[0], c[1], c[2], 0.45 + n * 0.55];
    });
  let texKey = -1, tex = null;
  const bodyMat = kit.add(new T.MeshPhysicalMaterial({ roughness: 0.55, metalness: 0.05, sheen: 0.6, sheenRoughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.6 }));
  const body = new T.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.05;
  inner.add(body);

  // A stainless base ring and a rolled steel rim under the lid.
  const steel = kit.add(new T.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.28 }));
  const ring = new T.Mesh(lathe(T, kit, [[0.2, 0], [0.246, 0.012], [0.25, 0.05], [0.244, 0.058], [0.198, 0.05]], 80), steel);
  ring.position.y = 0.02;
  inner.add(ring);
  const rim = new T.Mesh(lathe(T, kit, [[0.284, 0.92], [0.292, 0.93], [0.29, 0.96], [0.28, 0.965], [0.276, 0.94]], 80), steel);
  rim.position.y = 0.05;
  inner.add(rim);

  // The lid: a silicone-sealed cap with a drink well and a sip opening.
  const lidMat = kit.add(new T.MeshPhysicalMaterial({ color: 0x1b1b1d, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.4 }));
  const lidGeo = lathe(T, kit, [[0, 1.05], [0.15, 1.05], [0.2, 1.04], [0.262, 1.02], [0.29, 1.012], [0.298, 0.99], [0.292, 0.972], [0.27, 0.975], [0.2, 0.985], [0, 0.985]], 80);
  const lid = new T.Mesh(lidGeo, lidMat);
  inner.add(lid);
  const slot = new T.Mesh(kit.add(new T.CylinderGeometry(0.052, 0.052, 0.014, 32)), kit.add(new T.MeshStandardMaterial({ color: 0x060606, roughness: 0.6 })));
  slot.scale.set(1.5, 1, 1);
  slot.position.set(0.11, 1.045, 0.05);
  inner.add(slot);
  // Slide-lock: a little sliding cover over the opening.
  const slide = new T.Mesh(kit.add(new T.BoxGeometry(0.2, 0.022, 0.1)), lidMat);
  slide.position.set(0.08, 1.058, 0.05);
  slide.rotation.y = 0.1;
  inner.add(slide);
  // 360-degree lid: a raised lip all round the opening.
  const lip = new T.Mesh(kit.add(new T.TorusGeometry(0.075, 0.014, 12, 40)), lidMat);
  lip.rotation.x = Math.PI / 2;
  lip.scale.set(1.3, 1, 1);
  lip.position.set(0.1, 1.05, 0.04);
  inner.add(lip);

  // The wordmark, printed on the front.
  const logo = draw(T, kit, 512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#d9b06a';
    ctx.font = 'italic bold 96px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('brewns', 256, 130);
    ctx.font = '600 22px monospace';
    ctx.letterSpacing = '6px';
    ctx.fillText('COFFEE HOUSE', 256, 180);
  });
  const decalGeo = kit.add(new T.CylinderGeometry(0.276, 0.27, 0.22, 40, 1, true, -0.62, 1.24));
  const decal = new T.Mesh(decalGeo, kit.add(new T.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.4, metalness: 0.3, depthWrite: false })));
  decal.position.y = 0.55;
  inner.add(decal);

  const apply = (s: Sel) => {
    const cw = COLORWAYS[s.color ?? 0] ?? COLORWAYS[0];
    if (texKey !== (s.color ?? 0)) {
      texKey = s.color ?? 0;
      tex = powder(cw.body);
      bodyMat.map = tex.map;
      bodyMat.bumpMap = tex.bump;
      bodyMat.bumpScale = 0.8;
      bodyMat.sheenColor = new T.Color(cw.sheen);
      bodyMat.needsUpdate = true;
    }
    const sip = s.lid === 1;
    slide.visible = !sip;
    lip.visible = sip;
    decal.material.color.setHex(texKey === 1 ? 0x6a4a28 : 0xffffff);
  };
  return assemble(T, kit, inner, { sel, apply, shadow: [1.2, 1.2] });
}
