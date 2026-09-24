// @ts-nocheck
import * as THREE from 'three';

export interface VariantEngine {
  group: THREE.Group;
  updateVariant: (sel: Record<string, number>) => void;
  tick: (dt: number, time: number) => void;
  dispose: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMON PROCEDURAL UTILITIES (Shadows, Plates, Steam, Coffee Beans)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Creates a soft radial contact shadow plane on the tabletop.
 */
function createShadowMesh(T: typeof THREE, width = 1.4, depth = 0.7, opacity = 0.85): { mesh: THREE.Mesh; dispose: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 15, 128, 128, 120);
    grad.addColorStop(0, 'rgba(25, 20, 15, 0.45)');
    grad.addColorStop(0.45, 'rgba(25, 20, 15, 0.18)');
    grad.addColorStop(1, 'rgba(25, 20, 15, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new T.CanvasTexture(canvas);
  const geo = new T.PlaneGeometry(width, depth);
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false });
  const mesh = new T.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return {
    mesh,
    dispose: () => {
      tex.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}

/**
 * Creates an authentic speckled ceramic dessert saucer matching the bakery product photos.
 */
function createCeramicPlate(T: typeof THREE): { group: THREE.Group; dispose: () => void } {
  const group = new T.Group();

  // Procedural speckled ceramic texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Warm off-white base with slight radial gradient
    const bg = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
    bg.addColorStop(0, '#f0ece3');
    bg.addColorStop(0.8, '#e8e2d5');
    bg.addColorStop(1.0, '#dfd8ca');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 512);

    // Natural stoneware speckles
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 0.6 + Math.random() * 2.0;
      const alpha = 0.12 + Math.random() * 0.45;
      ctx.fillStyle = `rgba(${50 + Math.random() * 30}, ${35 + Math.random() * 20}, ${20 + Math.random() * 15}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const plateTex = new T.CanvasTexture(canvas);
  plateTex.colorSpace = T.SRGBColorSpace;

  const plateMat = new T.MeshStandardMaterial({
    map: plateTex,
    roughness: 0.35,
    metalness: 0.02,
  });

  // Base disc
  const plateGeo = new T.CylinderGeometry(0.64, 0.58, 0.045, 64);
  const plate = new T.Mesh(plateGeo, plateMat);
  plate.position.y = -0.295;
  group.add(plate);

  // Raised rim
  const rimGeo = new T.TorusGeometry(0.60, 0.024, 16, 64);
  rimGeo.rotateX(Math.PI / 2);
  const rim = new T.Mesh(rimGeo, plateMat);
  rim.position.y = -0.274;
  group.add(rim);

  return {
    group,
    dispose: () => {
      plateTex.dispose();
      plateGeo.dispose();
      rimGeo.dispose();
      plateMat.dispose();
    },
  };
}

/**
 * Creates rising thermal steam particles for warm drinks and freshly baked pastries.
 */
function createSteamSystem(T: typeof THREE, count = 28, yOffset = 0.25): {
  group: THREE.Group;
  light: THREE.PointLight;
  setWarm: (warm: boolean) => void;
  tick: (dt: number, time: number) => void;
  dispose: () => void;
} {
  const group = new T.Group();
  group.position.y = yOffset;

  const warmLight = new T.PointLight(0xff9944, 0, 1.8);
  warmLight.position.set(0, yOffset + 0.1, 0);

  const steamGeo = new T.SphereGeometry(0.038, 8, 8);
  const steamMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });

  const particles: { mesh: THREE.Mesh; seed: number; y: number; maxLife: number; life: number }[] = [];
  for (let i = 0; i < count; i++) {
    const mesh = new T.Mesh(steamGeo, steamMat.clone());
    mesh.scale.setScalar(0.4 + Math.random() * 0.8);
    group.add(mesh);
    particles.push({
      mesh,
      seed: Math.random() * Math.PI * 2,
      y: Math.random() * 0.7,
      maxLife: 1.5 + Math.random() * 1.5,
      life: Math.random() * 2,
    });
  }

  let targetOpacity = 0;
  let currentOpacity = 0;

  return {
    group,
    light: warmLight,
    setWarm(warm: boolean) {
      targetOpacity = warm ? 0.32 : 0;
    },
    tick(dt: number, time: number) {
      currentOpacity += (targetOpacity - currentOpacity) * Math.min(1, dt * 3.5);
      warmLight.intensity = (currentOpacity / 0.32) * 1.6;

      if (currentOpacity > 0.01) {
        particles.forEach((p) => {
          p.life += dt;
          p.y += dt * 0.22;
          if (p.life > p.maxLife || p.y > 0.8) {
            p.life = 0;
            p.y = 0;
            p.seed = Math.random() * Math.PI * 2;
          }
          const progress = p.life / p.maxLife;
          const alpha = Math.sin(progress * Math.PI) * currentOpacity;
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
          const wobbleX = Math.sin(time * 1.7 + p.seed) * 0.06 * progress;
          const wobbleZ = Math.cos(time * 2.0 + p.seed) * 0.06 * progress;
          p.mesh.position.set(wobbleX, p.y, wobbleZ);
          p.mesh.scale.setScalar(0.5 + progress * 1.6);
        });
      } else {
        particles.forEach((p) => {
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
        });
      }
    },
    dispose() {
      steamGeo.dispose();
      particles.forEach((p) => (p.mesh.material as THREE.Material).dispose());
    },
  };
}

/**
 * Creates 3D roasted coffee beans scattered across the tabletop around bean bags.
 */
function createScatteredBeans(T: typeof THREE, count = 28, radius = 0.52): { group: THREE.Group; dispose: () => void } {
  const group = new T.Group();

  // Authentic coffee bean geometry: ellipsoid with central crease indentation
  const beanGeo = new T.SphereGeometry(0.042, 12, 10);
  beanGeo.scale(0.70, 0.44, 1.0);

  const beanMat = new T.MeshStandardMaterial({
    color: 0x362013,
    roughness: 0.65,
    metalness: 0.02,
  });

  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const mesh = new T.Mesh(beanGeo, beanMat);
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = radius * (0.65 + Math.random() * 0.55);
    const x = Math.cos(angle) * dist + (Math.random() - 0.5) * 0.08;
    const z = Math.sin(angle) * dist * 0.65 + (Math.random() - 0.5) * 0.08;
    mesh.position.set(x, -0.47 + Math.random() * 0.005, z);
    mesh.rotation.set(
      Math.random() * 0.3,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.3,
    );
    const s = 0.75 + Math.random() * 0.5;
    mesh.scale.setScalar(s);
    group.add(mesh);
    meshes.push(mesh);
  }

  return {
    group,
    dispose: () => {
      beanGeo.dispose();
      beanMat.dispose();
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CANVAS TEXTURE GENERATORS (Latte Art, Printed Cups, Drink Marbling, Bags)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Generates an authentic latte art microfoam surface with a poured nested heart
 * and a rich golden-hazelnut espresso crema perimeter ring.
 */
function createLatteArtTexture(T: typeof THREE, isEspresso = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new T.CanvasTexture(canvas);

  const cx = 512, cy = 512;

  // 1. Base Crema Gradient
  const crema = ctx.createRadialGradient(cx, cy, 50, cx, cy, 510);
  if (isEspresso) {
    crema.addColorStop(0, '#a8652d');
    crema.addColorStop(0.35, '#8a4c1c');
    crema.addColorStop(0.75, '#5c2c0a');
    crema.addColorStop(1.0, '#361504');
  } else {
    crema.addColorStop(0, '#d8aa76');
    crema.addColorStop(0.55, '#ba8249');
    crema.addColorStop(0.85, '#8c5222');
    crema.addColorStop(1.0, '#5e3212');
  }
  ctx.fillStyle = crema;
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Microfoam porosity texture
  ctx.save();
  for (let i = 0; i < 4000; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 490;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const pr = 0.8 + Math.random() * 2.2;
    const alpha = 0.08 + Math.random() * 0.18;
    ctx.fillStyle = isEspresso
      ? `rgba(220, 150, 70, ${alpha})`
      : `rgba(255, 248, 235, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Poured Latte Art Heart (Outer White Foam Lobes)
  ctx.save();
  ctx.translate(cx, cy - 20);

  const scale = isEspresso ? 0.68 : 1.0;
  ctx.scale(scale, scale);

  // Outer halo of white microfoam
  ctx.fillStyle = '#f8f4ec';
  ctx.beginPath();
  ctx.moveTo(0, 130);
  ctx.bezierCurveTo(-140, 40, -220, -100, -110, -180);
  ctx.bezierCurveTo(-30, -210, 0, -140, 0, -100);
  ctx.bezierCurveTo(0, -140, 30, -210, 110, -180);
  ctx.bezierCurveTo(220, -100, 140, 40, 0, 130);
  ctx.fill();

  // Intermediate crema ring inside heart
  ctx.fillStyle = isEspresso ? 'rgba(150, 80, 25, 0.65)' : 'rgba(180, 115, 60, 0.45)';
  ctx.beginPath();
  ctx.moveTo(0, 105);
  ctx.bezierCurveTo(-105, 30, -165, -75, -85, -135);
  ctx.bezierCurveTo(-25, -160, 0, -105, 0, -75);
  ctx.bezierCurveTo(0, -105, 25, -160, 85, -135);
  ctx.bezierCurveTo(165, -75, 105, 30, 0, 105);
  ctx.fill();

  // Inner bright white heart core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 80);
  ctx.bezierCurveTo(-75, 20, -120, -55, -60, -100);
  ctx.bezierCurveTo(-20, -120, 0, -80, 0, -60);
  ctx.bezierCurveTo(0, -80, 20, -120, 60, -100);
  ctx.bezierCurveTo(120, -55, 75, 20, 0, 80);
  ctx.fill();

  // Pulled stem drag line through center
  ctx.strokeStyle = '#f8f4ec';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -170);
  ctx.lineTo(0, 160);
  ctx.stroke();

  ctx.restore();

  // 4. Subtle tiger striping flecks around periphery
  ctx.save();
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const dist = 360 + Math.sin(a * 5) * 40;
    const fx = cx + Math.cos(a) * dist;
    const fy = cy + Math.sin(a) * dist;
    ctx.fillStyle = 'rgba(70, 30, 10, 0.4)';
    ctx.beginPath();
    ctx.arc(fx, fy, 4 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/**
 * Procedural texture generator for iced marbled drinks (Iced Matcha, Iced Latte).
 * Recreates the authentic two-tone swirl (milk at bottom, marbled matcha/espresso at top),
 * printed brewns cup typography, microfoam bubbles, and cold condensation droplets.
 */
function createDrinkTexture(T: typeof THREE, productId: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  // Drawn in 1024 units on a 2048 surface: the front of the cup is only a quarter
  // of the circumference, so the printed type was resolving to a couple of hundred
  // pixels. Scaling the context keeps every coordinate below unchanged.
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new T.CanvasTexture(canvas);
  ctx.scale(2, 2);

  const isMatcha = productId === 'iced-matcha';

  // 1. Base gradient: Creamy milk at bottom, rich emerald matcha / espresso at top
  const bgGrad = ctx.createLinearGradient(0, 1024, 0, 0);
  if (isMatcha) {
    bgGrad.addColorStop(0, '#ede7db');
    bgGrad.addColorStop(0.32, '#f4f0e6');
    bgGrad.addColorStop(0.58, '#52833e');
    bgGrad.addColorStop(0.82, '#386326');
    bgGrad.addColorStop(1, '#294c1a');
  } else {
    bgGrad.addColorStop(0, '#ebddcc');
    bgGrad.addColorStop(0.32, '#f2e8da');
    bgGrad.addColorStop(0.62, '#6b3f1f');
    bgGrad.addColorStop(1, '#381e0d');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Organic marbled fluid swirls dripping into the white milk
  ctx.save();
  // Multi-pass organic marbling
  const dripColor = isMatcha ? 'rgba(58, 99, 41, ' : 'rgba(78, 44, 20, ';
  const midMatcha = isMatcha ? 'rgba(78, 126, 52, ' : 'rgba(110, 62, 28, ';
  
  // Canvas filters soften the bezier edges — an unblurred drip reads as a hard
  // green spike over the milk rather than pigment bleeding through it.
  ctx.filter = 'blur(26px)';
  // Layer A: Wide soft backdrop sweeps
  for (let x = 40; x < 1024; x += 75) {
    const width = 60 + Math.sin(x * 0.04) * 30;
    const dripDepth = 560 + Math.sin(x * 0.07) * 200;
    const alpha = 0.20 + Math.sin(x * 1.5) * 0.10;

    ctx.fillStyle = midMatcha + alpha + ')';
    ctx.beginPath();
    ctx.moveTo(x - width / 2, 0);
    ctx.bezierCurveTo(x - width * 0.7, dripDepth * 0.4, x - width * 0.2, dripDepth * 0.8, x, dripDepth);
    ctx.bezierCurveTo(x + width * 0.2, dripDepth * 0.8, x + width * 0.7, dripDepth * 0.4, x + width / 2, 0);
    ctx.fill();
  }

  ctx.filter = 'blur(15px)';
  // Layer B: Pronounced vertical ribbons dripping past the middle
  for (let x = 20; x < 1024; x += 96) {
    const width = 28 + Math.cos(x * 0.06) * 16;
    const dripDepth = 480 + Math.sin(x * 0.09) * 280;
    const alpha = 0.22 + Math.sin(x) * 0.12;

    ctx.fillStyle = dripColor + alpha + ')';
    ctx.beginPath();
    ctx.moveTo(x - width / 2, 0);
    ctx.bezierCurveTo(x - width * 0.85, dripDepth * 0.45, x - width * 0.3, dripDepth * 0.88, x, dripDepth);
    ctx.bezierCurveTo(x + width * 0.3, dripDepth * 0.88, x + width * 0.85, dripDepth * 0.45, x + width / 2, 0);
    ctx.fill();
  }
  ctx.restore();

  // Secondary soft milk plumes swirling upward into the matcha
  ctx.save();
  for (let x = 60; x < 1024; x += 80) {
    const plumeGrad = ctx.createRadialGradient(x, 560, 10, x, 560, 140);
    plumeGrad.addColorStop(0, isMatcha ? 'rgba(246, 242, 232, 0.72)' : 'rgba(242, 230, 215, 0.72)');
    plumeGrad.addColorStop(0.6, isMatcha ? 'rgba(246, 242, 232, 0.35)' : 'rgba(242, 230, 215, 0.35)');
    plumeGrad.addColorStop(1, 'rgba(246, 242, 232, 0)');
    ctx.fillStyle = plumeGrad;
    ctx.beginPath();
    ctx.arc(x, 560, 140, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Foamy bubble froth at top liquid boundary
  ctx.save();
  ctx.filter = 'blur(2px)';
  for (let i = 0; i < 150; i++) {
    const bx = Math.random() * 1024;
    const by = Math.random() * 150;
    const br = 1.6 + Math.random() * 4.0;
    // Kept near the base colour — at full saturation these read as confetti
    // sprinkled over the drink rather than froth caught at the surface.
    ctx.fillStyle = isMatcha
      ? `rgba(${92 + Math.random() * 34}, ${142 + Math.random() * 28}, ${62 + Math.random() * 24}, 0.28)`
      : `rgba(${152 + Math.random() * 34}, ${110 + Math.random() * 28}, ${70 + Math.random() * 24}, 0.28)`;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. Fine cold condensation droplets scattered over the exterior
  ctx.save();
  for (let d = 0; d < 70; d++) {
    const dx = Math.random() * 1024;
    const dy = 100 + Math.random() * 820;
    const dr = 1.6 + Math.random() * 3.4;
    // Glint only. The paired dark dot this used to draw read as dirt on the drink
    // rather than as a bead of water catching the light.
    ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + Math.random() * 0.14})`;
    ctx.beginPath();
    ctx.arc(dx, dy, dr * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Droplet run trails
  for (let t = 0; t < 18; t++) {
    const tx = Math.random() * 1024;
    const ty = 200 + Math.random() * 500;
    const tlen = 25 + Math.random() * 60;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + (Math.random() - 0.5) * 4, ty + tlen);
    ctx.stroke();
  }
  ctx.restore();

  // 5. Authentic Printed brewns Cup Branding on Front (centered at x = 512)
  ctx.save();
  ctx.textAlign = 'center';

  // brewns® wordmark
  ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#111111';
  ctx.fillText('brewns®', 512, 475);

  // Subtitle
  ctx.font = '600 21px monospace';
  ctx.letterSpacing = '5px';
  ctx.fillStyle = '#1c1c1c';
  ctx.fillText(isMatcha ? 'ICED MATCHA' : 'ICED LATTE', 512, 524);

  // Tagline
  ctx.font = '19px monospace';
  ctx.fillStyle = '#2d2d2d';
  ctx.letterSpacing = '1px';
  if (isMatcha) {
    ctx.fillText('Fresh. Smooth.', 512, 574);
    ctx.fillText('Slow energy.', 512, 606);
  } else {
    ctx.fillText('Smooth. Bold.', 512, 574);
    ctx.fillText('Always a good idea.', 512, 606);
  }

  // Signature cursive "b."
  ctx.font = 'italic bold 46px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#111111';
  ctx.fillText('b.', 512, 735);
  ctx.restore();

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/**
 * Top-down texture for the drink's surface: a meniscus that darkens into the cup
 * wall, a drift of whisked colour across the middle, and foam gathered at the edge.
 */
function createSurfaceTexture(T: typeof THREE, isMatcha: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new T.CanvasTexture(canvas);

  // Meniscus: liquid is lit in the middle and falls into shadow against the wall.
  const grad = ctx.createRadialGradient(108, 100, 8, 128, 128, 132);
  if (isMatcha) {
    grad.addColorStop(0, '#6aa04c');
    grad.addColorStop(0.45, '#4f8636');
    grad.addColorStop(0.82, '#3a6a28');
    grad.addColorStop(1, '#27491b');
  } else {
    grad.addColorStop(0, '#9a6236');
    grad.addColorStop(0.45, '#7b4a26');
    grad.addColorStop(0.82, '#5b3519');
    grad.addColorStop(1, '#3d2110');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Whisked drift across the surface.
  ctx.filter = 'blur(11px)';
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 74;
    ctx.strokeStyle = isMatcha
      ? `rgba(150, 196, 120, ${0.08 + Math.random() * 0.12})`
      : `rgba(196, 156, 116, ${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 6 + Math.random() * 12;
    ctx.beginPath();
    ctx.arc(128, 128, r, a, a + 1.1 + Math.random());
    ctx.stroke();
  }
  ctx.filter = 'none';

  // Foam collects against the rim rather than sitting evenly over the top.
  for (let i = 0; i < 150; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.pow(Math.random(), 0.45) * 66;
    ctx.fillStyle = isMatcha
      ? `rgba(214, 232, 196, ${0.10 + Math.random() * 0.30})`
      : `rgba(232, 214, 190, ${0.10 + Math.random() * 0.30})`;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1 + Math.random() * 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/**
 * Texture for Swedish Cardamom Bun:
 * Golden-brown brioche dough with caramelized cardamom sugar syrup,
 * butter glaze sheen, and cracked green cardamom seed speckles.
 */
function createCardamomDoughTexture(T: typeof THREE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new T.CanvasTexture(canvas);

  // 1. Golden baked brioche dough base
  const bg = ctx.createLinearGradient(0, 0, 1024, 1024);
  bg.addColorStop(0, '#be7526');
  bg.addColorStop(0.3, '#ad621c');
  bg.addColorStop(0.65, '#8c4812');
  bg.addColorStop(1.0, '#5e2e0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Swirling caramelized syrup channels
  ctx.save();
  for (let i = 0; i < 28; i++) {
    const y = i * 38;
    ctx.strokeStyle = `rgba(55, 24, 6, ${0.4 + (i % 3) * 0.18})`;
    ctx.lineWidth = 14 + (i % 4) * 6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(340, y + 50, 680, y - 50, 1024, y + 20);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Cracked green cardamom seed flecks
  ctx.save();
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = 1.0 + Math.random() * 2.8;
    ctx.fillStyle = Math.random() > 0.4
      ? `rgba(${25 + Math.random() * 20}, ${38 + Math.random() * 25}, ${15 + Math.random() * 15}, 0.85)`
      : `rgba(${40 + Math.random() * 20}, ${18 + Math.random() * 10}, ${8 + Math.random() * 8}, 0.9)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r * 0.8, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. Glaze sheen highlights
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const gx = 100 + Math.random() * 824;
    const gy = 100 + Math.random() * 824;
    const grad = ctx.createRadialGradient(gx, gy, 10, gx, gy, 90);
    grad.addColorStop(0, 'rgba(255, 235, 190, 0.38)');
    grad.addColorStop(1, 'rgba(255, 235, 190, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/**
 * Texture for French Matcha Financier:
 * Deep golden-brown caramelized almond crust with vibrant jade green Uji matcha crumb.
 */
function createMatchaFinancierTexture(T: typeof THREE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new T.CanvasTexture(canvas);

  // Golden-brown crust base
  const bg = ctx.createLinearGradient(0, 0, 0, 1024);
  bg.addColorStop(0, '#9a5e20');
  bg.addColorStop(0.2, '#7e4512');
  bg.addColorStop(0.5, '#4b6b28'); // Deep Uji matcha green center
  bg.addColorStop(0.8, '#3c581e');
  bg.addColorStop(1.0, '#7e4512');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  // Porous crumb texture
  ctx.save();
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = 0.8 + Math.random() * 2.2;
    const isCenter = y > 250 && y < 770;
    ctx.fillStyle = isCenter
      ? `rgba(${50 + Math.random() * 35}, ${90 + Math.random() * 40}, ${30 + Math.random() * 20}, ${0.35 + Math.random() * 0.35})`
      : `rgba(${120 + Math.random() * 40}, ${70 + Math.random() * 30}, ${25 + Math.random() * 15}, ${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // White powdered sugar dusting across top
  ctx.save();
  for (let i = 0; i < 1800; i++) {
    const x = 120 + Math.random() * 784;
    const y = 280 + Math.random() * 464;
    const r = 0.6 + Math.random() * 1.8;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/**
 * 1. SWEDISH CARDAMOM BUN (Kardemummabulle)
 * Matches menu/menu-cardamom.webp:
 * - Speckled ceramic saucer with contact shadow
 * - Braided knot of golden-brown brioche dough with caramelized cardamom syrup
 * - 3D white pearl sugar crystals (Pärlsocker) scattered across crown
 * - Cracked dark green cardamom pod seed flecks
 * - Interactive WARMED steam particles
 */
export function createCardamomBunModel(T: typeof THREE, initialSel: Record<string, number> = {}): VariantEngine {
  const group = new T.Group();

  const shadow = createShadowMesh(T, 1.5, 0.8);
  shadow.mesh.position.set(0, -0.305, 0);
  group.add(shadow.mesh);

  const plate = createCeramicPlate(T);
  group.add(plate.group);

  // Braided knot bun assembly
  const doughTex = createCardamomDoughTexture(T);
  const bunMat = new T.MeshStandardMaterial({
    map: doughTex,
    roughness: 0.52,
    metalness: 0.02,
  });

  const bunGroup = new T.Group();
  bunGroup.position.y = -0.16;
  group.add(bunGroup);

  // Loop 1 & 2: Base twisted circular torus rings
  const ringGeo1 = new T.TorusGeometry(0.24, 0.082, 20, 48);
  ringGeo1.rotateX(Math.PI / 2);
  const ring1 = new T.Mesh(ringGeo1, bunMat);
  ring1.position.y = 0.04;
  bunGroup.add(ring1);

  const ringGeo2 = new T.TorusGeometry(0.20, 0.076, 20, 48);
  ringGeo2.rotateX(Math.PI / 2.1);
  ringGeo2.rotateZ(0.8);
  const ring2 = new T.Mesh(ringGeo2, bunMat);
  ring2.position.set(0.02, 0.08, -0.01);
  bunGroup.add(ring2);

  // Loop 3 & 4: Diagonal cross-braid dough ribbons
  const ribGeo1 = new T.TorusGeometry(0.18, 0.072, 16, 40, Math.PI * 1.4);
  ribGeo1.rotateY(0.7);
  ribGeo1.rotateZ(0.5);
  const rib1 = new T.Mesh(ribGeo1, bunMat);
  rib1.position.set(-0.04, 0.12, 0.02);
  bunGroup.add(rib1);

  const ribGeo2 = new T.TorusGeometry(0.17, 0.070, 16, 40, Math.PI * 1.4);
  ribGeo2.rotateY(-0.8);
  ribGeo2.rotateZ(-0.4);
  const rib2 = new T.Mesh(ribGeo2, bunMat);
  rib2.position.set(0.04, 0.13, -0.02);
  bunGroup.add(rib2);

  // Crown center knot
  const crownGeo = new T.SphereGeometry(0.13, 24, 16);
  crownGeo.scale(1.2, 0.65, 1.1);
  const crown = new T.Mesh(crownGeo, bunMat);
  crown.position.set(0, 0.16, 0);
  bunGroup.add(crown);

  // 3D White Pearl Sugar Crystals (Pärlsocker)
  const sugarGeo = new T.BoxGeometry(0.018, 0.016, 0.018);
  const sugarMat = new T.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.05,
  });

  const sugarGroup = new T.Group();
  bunGroup.add(sugarGroup);

  for (let i = 0; i < 48; i++) {
    const sMesh = new T.Mesh(sugarGeo, sugarMat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.04 + Math.random() * 0.20;
    const sx = Math.cos(angle) * dist;
    const sz = Math.sin(angle) * dist;
    const sy = 0.16 + (1 - dist / 0.24) * 0.06 + Math.random() * 0.015;
    sMesh.position.set(sx, sy, sz);
    sMesh.rotation.set(Math.random(), Math.random(), Math.random());
    const sc = 0.7 + Math.random() * 0.6;
    sMesh.scale.setScalar(sc);
    sugarGroup.add(sMesh);
  }

  // 3D Cracked Green Cardamom Seeds
  const seedGeo = new T.CylinderGeometry(0.008, 0.006, 0.022, 6);
  const seedMat = new T.MeshStandardMaterial({
    color: 0x243216,
    roughness: 0.7,
  });

  for (let i = 0; i < 28; i++) {
    const sdMesh = new T.Mesh(seedGeo, seedMat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.06 + Math.random() * 0.21;
    const sx = Math.cos(angle) * dist;
    const sz = Math.sin(angle) * dist;
    const sy = 0.15 + (1 - dist / 0.24) * 0.05;
    sdMesh.position.set(sx, sy, sz);
    sdMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    bunGroup.add(sdMesh);
  }

  // Warmed steam system
  const steam = createSteamSystem(T, 28, 0.12);
  group.add(steam.group);
  group.add(steam.light);

  const applyVariant = (sel: Record<string, number>) => {
    const isWarmed = sel.serve === 1 || sel.warm === 1;
    steam.setWarm(isWarmed);
  };
  applyVariant(initialSel);

  return {
    group,
    updateVariant: applyVariant,
    tick: steam.tick,
    dispose() {
      shadow.dispose();
      plate.dispose();
      doughTex.dispose();
      bunMat.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      ribGeo1.dispose();
      ribGeo2.dispose();
      crownGeo.dispose();
      sugarGeo.dispose();
      sugarMat.dispose();
      seedGeo.dispose();
      seedMat.dispose();
      steam.dispose();
    },
  };
}

/**
 * 2. FRENCH MATCHA FINANCIER
 * Matches menu/menu-financier.webp:
 * - Speckled ceramic plate with contact shadow
 * - Rectangular "lingot" bar cake with beveled edges
 * - Golden-brown browned butter crust with vibrant Uji matcha crumb
 * - Toasted sliced almond flakes on top
 * - Dusted confectioner's powdered sugar
 * - Interactive WARMED steam
 */
export function createMatchaFinancierModel(T: typeof THREE, initialSel: Record<string, number> = {}): VariantEngine {
  const group = new T.Group();

  const shadow = createShadowMesh(T, 1.5, 0.8);
  shadow.mesh.position.set(0, -0.305, 0);
  group.add(shadow.mesh);

  const plate = createCeramicPlate(T);
  group.add(plate.group);

  // Rectangular Lingot Cake Body
  const matchaTex = createMatchaFinancierTexture(T);
  const cakeMat = new T.MeshStandardMaterial({
    map: matchaTex,
    roughness: 0.60,
    metalness: 0.02,
  });

  const cakeGroup = new T.Group();
  cakeGroup.position.set(0, -0.21, 0);
  group.add(cakeGroup);

  // Main cake body: beveled rectangular box
  const cakeGeo = new T.BoxGeometry(0.56, 0.16, 0.32, 16, 4, 10);
  const cake = new T.Mesh(cakeGeo, cakeMat);
  cakeGroup.add(cake);

  // Top oven-spring arched crown
  const crownGeo = new T.CylinderGeometry(0.14, 0.14, 0.52, 24, 1, false, 0, Math.PI);
  crownGeo.rotateZ(Math.PI / 2);
  crownGeo.scale(1.0, 0.45, 1.0);
  const crown = new T.Mesh(crownGeo, cakeMat);
  crown.position.set(0, 0.08, 0);
  cakeGroup.add(crown);

  // Sliced toasted almond flakes
  const almondGeo = new T.CylinderGeometry(0.045, 0.045, 0.006, 16);
  almondGeo.scale(1.35, 1.0, 0.8);
  const almondMat = new T.MeshStandardMaterial({
    color: 0xeadbb8,
    roughness: 0.45,
  });

  const almondPositions = [
    [-0.14, 0.13, 0.02, 0.12, 0.35, -0.15],
    [0.08, 0.135, -0.03, -0.10, -0.42, 0.20],
    [-0.02, 0.14, 0.04, 0.08, 0.15, 0.10],
  ];

  almondPositions.forEach(([x, y, z, rx, ry, rz]) => {
    const almond = new T.Mesh(almondGeo, almondMat);
    almond.position.set(x, y, z);
    almond.rotation.set(rx, ry, rz);
    cakeGroup.add(almond);
  });

  // Warmed steam system
  const steam = createSteamSystem(T, 24, 0.08);
  group.add(steam.group);
  group.add(steam.light);

  const applyVariant = (sel: Record<string, number>) => {
    const isWarmed = sel.serve === 1 || sel.warm === 1;
    steam.setWarm(isWarmed);
  };
  applyVariant(initialSel);

  return {
    group,
    updateVariant: applyVariant,
    tick: steam.tick,
    dispose() {
      shadow.dispose();
      plate.dispose();
      matchaTex.dispose();
      cakeMat.dispose();
      cakeGeo.dispose();
      crownGeo.dispose();
      almondGeo.dispose();
      almondMat.dispose();
      steam.dispose();
    },
  };
}

/**
 * 3. GIBRALTAR GLASS CORTADO
 * Matches menu/menu-cortado.webp:
 * - Heavy 4.5 oz faceted Gibraltar glass with thick glass base
 * - Octagonal faceted lower half, smooth round upper rim
 * - Warm espresso-milk gradient liquid
 * - Dense microfoam surface with poured nested latte art heart
 * - NO straw, NO ice cubes!
 * - Interactive steam and shots variant
 */
export function createCortadoModel(T: typeof THREE, initialSel: Record<string, number> = {}): VariantEngine {
  const group = new T.Group();

  const shadow = createShadowMesh(T, 1.3, 0.6);
  shadow.mesh.position.set(0, -0.46, 0);
  group.add(shadow.mesh);

  // Heavy Faceted Gibraltar Glass Body
  const glassMat = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.03,
    metalness: 0.0,
    transmission: 0.94,
    thickness: 0.08,
    ior: 1.50,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });

  // Lower 8-sided faceted prism
  const lowerGeo = new T.CylinderGeometry(0.31, 0.23, 0.42, 8, 1, false);
  const lower = new T.Mesh(lowerGeo, glassMat);
  lower.position.y = -0.22;
  group.add(lower);

  // Upper smooth round rim
  const upperGeo = new T.CylinderGeometry(0.34, 0.31, 0.28, 48, 1, true);
  const upper = new T.Mesh(upperGeo, glassMat);
  upper.position.y = 0.13;
  group.add(upper);

  // Smooth rolled glass lip
  const rimGeo = new T.TorusGeometry(0.34, 0.015, 16, 48);
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.translate(0, 0.27, 0);
  const rim = new T.Mesh(rimGeo, glassMat);
  group.add(rim);

  // Solid heavy glass sham (base)
  const baseGeo = new T.CylinderGeometry(0.228, 0.228, 0.06, 8);
  const base = new T.Mesh(baseGeo, glassMat);
  base.position.y = -0.42;
  group.add(base);

  // Cortado Warm Coffee-Milk Liquid Body
  const liquidMat = new T.MeshStandardMaterial({
    color: 0xb58252,
    roughness: 0.25,
  });
  const liquidGeo = new T.CylinderGeometry(0.325, 0.22, 0.64, 32);
  const liquid = new T.Mesh(liquidGeo, liquidMat);
  liquid.position.y = -0.07;
  group.add(liquid);

  // Silky Microfoam Top Disc with Latte Art Heart
  const foamTex = createLatteArtTexture(T, false);
  const foamMat = new T.MeshStandardMaterial({
    map: foamTex,
    roughness: 0.40,
  });
  const foamGeo = new T.CircleGeometry(0.324, 48);
  foamGeo.rotateX(-Math.PI / 2);
  const foam = new T.Mesh(foamGeo, foamMat);
  foam.position.y = 0.252;
  group.add(foam);

  // Rising steam system
  const steam = createSteamSystem(T, 20, 0.28);
  group.add(steam.group);
  group.add(steam.light);
  steam.setWarm(true); // Cortado is naturally warm

  const applyVariant = (sel: Record<string, number>) => {
    // Triple shot darkens liquid and crema
    const isTriple = sel.shots === 1;
    liquidMat.color.setHex(isTriple ? 0x966034 : 0xb58252);
  };
  applyVariant(initialSel);

  return {
    group,
    updateVariant: applyVariant,
    tick: steam.tick,
    dispose() {
      shadow.dispose();
      glassMat.dispose();
      lowerGeo.dispose();
      upperGeo.dispose();
      rimGeo.dispose();
      baseGeo.dispose();
      liquidMat.dispose();
      liquidGeo.dispose();
      foamTex.dispose();
      foamMat.dispose();
      foamGeo.dispose();
      steam.dispose();
    },
  };
}

/**
 * 4. NITRO COLD BREW ON TAP
 * Matches menu/menu-cold-brew.webp:
 * - Chilled faceted pub tumbler glass with condensation
 * - Deep dark mahogany / black stout-like cold brew liquid
 * - Thick cascading velvety nitro foam head collar domed at rim
 * - NO straw!
 * - Interactive Vanilla Sweet Cream cascade variant
 */
export function createNitroColdBrewModel(T: typeof THREE, initialSel: Record<string, number> = {}): VariantEngine {
  const group = new T.Group();

  const shadow = createShadowMesh(T, 1.3, 0.6);
  shadow.mesh.position.set(0, -0.46, 0);
  group.add(shadow.mesh);

  // Chilled Faceted Tumbler Glass
  const glassMat = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.92,
    thickness: 0.06,
    ior: 1.48,
    clearcoat: 0.95,
  });

  const lowerGeo = new T.CylinderGeometry(0.32, 0.24, 0.46, 8, 1, false);
  const lower = new T.Mesh(lowerGeo, glassMat);
  lower.position.y = -0.19;
  group.add(lower);

  const upperGeo = new T.CylinderGeometry(0.35, 0.32, 0.32, 48, 1, true);
  const upper = new T.Mesh(upperGeo, glassMat);
  upper.position.y = 0.20;
  group.add(upper);

  const rimGeo = new T.TorusGeometry(0.35, 0.014, 16, 48);
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.translate(0, 0.36, 0);
  const rim = new T.Mesh(rimGeo, glassMat);
  group.add(rim);

  const baseGeo = new T.CylinderGeometry(0.238, 0.238, 0.05, 8);
  const base = new T.Mesh(baseGeo, glassMat);
  base.position.y = -0.42;
  group.add(base);

  // Deep Mahogany / Stout-Dark Cold Brew Liquid Core
  const liquidMat = new T.MeshStandardMaterial({
    color: 0x160c07,
    roughness: 0.2,
  });
  const liquidGeo = new T.CylinderGeometry(0.338, 0.23, 0.66, 32);
  const liquid = new T.Mesh(liquidGeo, liquidMat);
  liquid.position.y = -0.04;
  group.add(liquid);

  // Thick Cascading Nitro Foam Head Collar
  const foamMat = new T.MeshStandardMaterial({
    color: 0xf5ede1, // Velvety dense nitro foam
    roughness: 0.35,
  });

  // Foam collar ring
  const foamGeo = new T.CylinderGeometry(0.344, 0.338, 0.16, 48);
  const foam = new T.Mesh(foamGeo, foamMat);
  foam.position.y = 0.27;
  group.add(foam);

  // Domed foam top cap
  const topCapGeo = new T.SphereGeometry(0.344, 48, 12, 0, Math.PI * 2, 0, Math.PI * 0.18);
  topCapGeo.scale(1.0, 0.35, 1.0);
  const topCap = new T.Mesh(topCapGeo, foamMat);
  topCap.position.y = 0.35;
  group.add(topCap);

  // Floating ice cubes inside dark brew
  const iceMat = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    roughness: 0.05,
    transmission: 0.92,
    ior: 1.31,
  });
  const iceCubeGeo = new T.BoxGeometry(0.11, 0.11, 0.11);
  const ice1 = new T.Mesh(iceCubeGeo, iceMat);
  ice1.position.set(-0.06, 0.10, 0.05);
  ice1.rotation.set(0.3, 0.5, 0.2);
  group.add(ice1);

  const ice2 = new T.Mesh(iceCubeGeo, iceMat);
  ice2.position.set(0.08, 0.05, -0.04);
  ice2.rotation.set(-0.2, 0.8, -0.4);
  group.add(ice2);

  const applyVariant = (sel: Record<string, number>) => {
    // Vanilla sweet cream cascade
    const isSweetCream = sel.style === 1;
    if (isSweetCream) {
      liquidMat.color.setHex(0x382012);
      foamMat.color.setHex(0xfff8ee);
    } else {
      liquidMat.color.setHex(0x160c07);
      foamMat.color.setHex(0xf5ede1);
    }
  };
  applyVariant(initialSel);

  return {
    group,
    updateVariant: applyVariant,
    tick: () => {},
    dispose() {
      shadow.dispose();
      glassMat.dispose();
      lowerGeo.dispose();
      upperGeo.dispose();
      rimGeo.dispose();
      baseGeo.dispose();
      liquidMat.dispose();
      liquidGeo.dispose();
      foamMat.dispose();
      foamGeo.dispose();
      topCapGeo.dispose();
      iceMat.dispose();
      iceCubeGeo.dispose();
    },
  };
}

/**
 * 6. CERAMIC TRAVEL TUMBLER
 * Matches menu/menu-tumbler.webp:
 * - 12 oz matte ceramic / powder-coated double-wall insulated body
 * - Rounded bottom corner bevel
 * - Press-fit insulated sip lid with recessed drink well and sip opening
 * - Interactive Colorways: MATTE CHARCOAL, RAW OAT, AMBER CREMA
 * - Interactive Lid Types: SLIDE LOCK, 360° SIP LID
 */
export function createCeramicTumblerModel(T: typeof THREE, initialSel: Record<string, number> = {}): VariantEngine {
  const group = new T.Group();

  const shadow = createShadowMesh(T, 1.3, 0.65);
  shadow.mesh.position.set(0, -0.46, 0);
  group.add(shadow.mesh);

  // Colorway definitions matching product options
  const COLORWAYS = [
    { name: 'MATTE CHARCOAL', body: 0x222224, lid: 0x18181a, roughness: 0.72 },
    { name: 'RAW OAT', body: 0xd6cbb8, lid: 0x4a443b, roughness: 0.68 },
    { name: 'AMBER CREMA', body: 0xaf5c26, lid: 0x2c221a, roughness: 0.65 },
  ];

  const bodyMat = new T.MeshStandardMaterial({
    color: COLORWAYS[0].body,
    roughness: COLORWAYS[0].roughness,
    metalness: 0.05,
  });

  const lidMat = new T.MeshStandardMaterial({
    color: COLORWAYS[0].lid,
    roughness: 0.45,
    metalness: 0.08,
  });

  // Tapered cylindrical tumbler body
  const bodyGeo = new T.CylinderGeometry(0.33, 0.25, 0.78, 48);
  const body = new T.Mesh(bodyGeo, bodyMat);
  body.position.y = -0.05;
  group.add(body);

  // Rounded bottom taper bevel
  const bottomBevelGeo = new T.SphereGeometry(0.25, 32, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  bottomBevelGeo.scale(1.0, 0.22, 1.0);
  const bottomBevel = new T.Mesh(bottomBevelGeo, bodyMat);
  bottomBevel.position.y = -0.44;
  group.add(bottomBevel);

  // Insulated Sip Lid
  const lidGroup = new T.Group();
  lidGroup.position.y = 0.34;
  group.add(lidGroup);

  // Lid collar / gasket band
  const lidCollarGeo = new T.CylinderGeometry(0.342, 0.334, 0.08, 48);
  const lidCollar = new T.Mesh(lidCollarGeo, lidMat);
  lidGroup.add(lidCollar);

  // Recessed top sip well
  const sipWellGeo = new T.CylinderGeometry(0.315, 0.315, 0.03, 48);
  const sipWellMat = new T.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 });
  const sipWell = new T.Mesh(sipWellGeo, sipWellMat);
  sipWell.position.y = 0.035;
  lidGroup.add(sipWell);

  // Sip hole opening tab
  const sipTabGeo = new T.BoxGeometry(0.09, 0.02, 0.05);
  const sipTabMat = new T.MeshStandardMaterial({ color: 0x333336, roughness: 0.3 });
  const sipTab = new T.Mesh(sipTabGeo, sipTabMat);
  sipTab.position.set(0, 0.052, 0.16);
  lidGroup.add(sipTab);

  const applyVariant = (sel: Record<string, number>) => {
    const colIdx = sel?.color ?? 0;
    const col = COLORWAYS[colIdx] || COLORWAYS[0];
    bodyMat.color.setHex(col.body);
    bodyMat.roughness = col.roughness;
    lidMat.color.setHex(col.lid);

    const is360Lid = sel?.lid === 1;
    sipTab.visible = !is360Lid;
  };
  applyVariant(initialSel);

  return {
    group,
    updateVariant: applyVariant,
    tick: () => {},
    dispose() {
      shadow.dispose();
      bodyMat.dispose();
      bodyGeo.dispose();
      bottomBevelGeo.dispose();
      lidMat.dispose();
      lidCollarGeo.dispose();
      sipWellMat.dispose();
      sipWellGeo.dispose();
      sipTabMat.dispose();
      sipTabGeo.dispose();
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   BREWNS PACKAGING (public/assets/hero/models.glb)
   The cream stand-up bag and the black-lidded paper cup from the hero are the
   packaging every bean and hot-cup product is shown in: the shop cards, the
   product page's 3D view and the thumbnails all come from this one file.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The file's pieces: the bag is the tallest piece of the bag + cup composition,
 * the cup is the scene whose every material is the cup's. Returned clone is one
 * unit tall and centred on the origin.
 */
export function extractPackagingPiece(T: typeof THREE, gltf: any, kind: string): THREE.Group {
  const meshesIn = (rootNode: any) => {
    const found: any[] = [];
    rootNode.traverse((n: any) => n.isMesh && found.push(n));
    return found;
  };
  let source = null;
  if (kind === 'cup')
    source = gltf.scenes.find((s: any) => {
      const m = meshesIn(s);
      return m.length && m.every((mesh: any) => [].concat(mesh.material).every((mat: any) => mat.name.startsWith('CupCoffee')));
    });
  if (!source) {
    const composition = gltf.scenes.find((s: any) => meshesIn(s).length);
    composition.updateMatrixWorld(true);
    const pieces = composition.children
      .filter((n: any) => meshesIn(n).length)
      .map((n: any) => ({ n, h: new T.Box3().setFromObject(n).getSize(new T.Vector3()).y }))
      .sort((a: any, b: any) => b.h - a.h);
    source = (kind === 'cup' ? pieces[1] : pieces[0]).n;
  }
  source.updateMatrixWorld(true);
  const clone = source.clone(true);
  source.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
  const holder = new T.Group();
  holder.add(clone);
  holder.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(holder);
  const size = box.getSize(new T.Vector3());
  clone.position.sub(box.getCenter(new T.Vector3()));
  const unitGroup = new T.Group();
  unitGroup.scale.setScalar(1 / (size.y || 1));
  unitGroup.add(holder);
  return unitGroup;
}

/** Turns each piece's printed face to the lens. */
export const PACKAGING_POSE: Record<string, number> = { bag: -0.42, cup: Math.PI + 1.2 };

/**
 * Each product wears the shared bag or cup with its own print. The print is a
 * baked texture, so the product's lines are repainted over the generic ones and
 * everything else stays as printed.
 *
 * Bag atlas (2048px): both faces side by side, stored upside down. The "slow
 * roast" script and the flavour notes are repainted.
 * Cup atlas (1536px): upright. "GOOD COFFEE / GOOD MOOD" becomes the drink's
 * name and tagline, and "250 ML" follows the selected option.
 */
type BagLabel = { script: string; ink: string; notes: string[] };
type CupLabel = { lines: [string, string]; option: (sel: Record<string, number>) => string };
const PACKAGING_LABELS: Record<string, { bag?: BagLabel; cup?: CupLabel }> = {
  'single-origin': { bag: { script: 'ethiopia', ink: '#8a5a2b', notes: ['JASMINE', 'BERGAMOT', 'WHITE PEACH'] } },
  latte: { cup: { lines: ['LATTE', 'SMOOTH. BALANCED.'], option: (sel) => ['8 OZ', '12 OZ', '16 OZ'][sel.size ?? 1] } },
  espresso: { cup: { lines: ['ESPRESSO', 'SHORT. STRONG.'], option: (sel) => (sel.shots === 1 ? 'DOUBLE' : 'SINGLE') } },
};
const BAG_FACE_OFFSETS = [0, 786]; // x of each face in the 2048px atlas
const PRINT_FONT = '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif';

// Covers a patch of the atlas in paper colour and draws into it in upright local
// coordinates (flipped for the upside-down bag atlas). Units are atlas pixels at
// the atlas's authored width, scaled by `k` to the image actually loaded.
function printPatch(ctx: CanvasRenderingContext2D, k: number, flip: boolean, [x, y, w, h]: number[], paperAt: number[], draw: () => void) {
  const d = ctx.getImageData(paperAt[0] * k, paperAt[1] * k, 1, 1).data;
  ctx.save();
  ctx.translate(x * k, (flip ? y + h : y) * k);
  ctx.scale(k, flip ? -k : k);
  ctx.fillStyle = `rgb(${d[0]},${d[1]},${d[2]})`;
  ctx.fillRect(0, 0, w, h);
  draw();
  ctx.restore();
}

function paintBagLabel(ctx: CanvasRenderingContext2D, image: any, label: BagLabel) {
  const k = image.width / 2048;
  ctx.drawImage(image, 0, 0);
  for (const dx of BAG_FACE_OFFSETS) {
    printPatch(ctx, k, true, [dx + 40, 470, 720, 270], [dx + 60, 470], () => {
      ctx.fillStyle = label.ink;
      ctx.font = '230px Allura, cursive';
      ctx.translate(30, 150);
      ctx.rotate(-0.12);
      ctx.fillText(label.script, 0, 0);
    });
    printPatch(ctx, k, true, [dx + 450, 222, 250, 122], [dx + 700, 300], () => {
      ctx.fillStyle = '#1b1b1b';
      ctx.font = `600 22px ${PRINT_FONT}`;
      label.notes.forEach((note, i) => ctx.fillText(note, 12, 36 + i * 33));
    });
  }
}

function paintCupLabel(ctx: CanvasRenderingContext2D, image: any, label: CupLabel, sel: Record<string, number>) {
  const k = image.width / 1536;
  ctx.drawImage(image, 0, 0);
  printPatch(ctx, k, false, [80, 445, 290, 80], [380, 480], () => {
    ctx.fillStyle = '#1e1e1e';
    ctx.font = `400 25px ${PRINT_FONT}`;
    ctx.letterSpacing = '1px';
    label.lines.forEach((line, i) => ctx.fillText(line, 7, 32 + i * 31));
  });
  printPatch(ctx, k, false, [80, 582, 128, 42], [150, 650], () => {
    ctx.fillStyle = '#1e1e1e';
    ctx.font = `400 23px ${PRINT_FONT}`;
    ctx.letterSpacing = '1px';
    ctx.fillText(label.option(sel), 10, 31);
  });
}

/**
 * Dresses a packaging piece for a product. Materials are cloned, so the shared
 * asset is left untouched. `ready` settles once the script face has loaded and
 * the print is final; `update` reprints the parts that follow the options.
 */
export function dressPackaging(
  T: typeof THREE,
  piece: THREE.Object3D,
  productId?: string,
  initialSel: Record<string, number> = {},
): { ready: Promise<void>; update: (sel: Record<string, number>) => void; dispose: () => void } {
  const labels = (productId && PACKAGING_LABELS[productId]) || {};
  const owned: any[] = [];
  let sel = initialSel;
  piece.traverse((node: any) => {
    if (!node.isMesh || !node.material?.map) return;
    const source = node.material.map;
    const image = source.image;
    const paintFor =
      image?.width === 1536 && labels.cup
        ? (ctx: CanvasRenderingContext2D) => paintCupLabel(ctx, image, labels.cup!, sel)
        : image?.width >= 2048 && labels.bag
          ? (ctx: CanvasRenderingContext2D) => paintBagLabel(ctx, image, labels.bag!)
          : null;
    if (!paintFor) return;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const map = source.clone();
    map.source = new (T.TextureSource ?? T.Source)(canvas);
    const paint = () => {
      paintFor(ctx);
      map.needsUpdate = true;
    };
    paint();
    const material = node.material.clone();
    material.map = map;
    node.material = material;
    owned.push({ map, material, paint });
  });
  const ready = !labels.bag
    ? Promise.resolve()
    : (document.fonts?.load('230px Allura') ?? Promise.resolve()).catch(() => {}).then(() => owned.forEach((o) => o.paint()));
  return {
    ready,
    update(next) {
      if (!labels.cup) return;
      sel = next;
      owned.forEach((o) => o.paint());
    },
    dispose() {
      owned.forEach((o) => {
        o.map.dispose();
        o.material.dispose();
      });
    },
  };
}

/**
 * BREWNS BAG & CUP (Slow Roast, Ethiopia, Latte, Espresso)
 * - The hero's bag / cup, relabelled per product
 * - Scattered roasted beans around the bags
 * - Size option scales the piece, standing on the same spot
 */
export function createPackagingModel(T: typeof THREE, gltf: any, kind: string, productId: string, initialSel: Record<string, number> = {}): VariantEngine {
  const group = new T.Group();
  const isBag = kind === 'bag';

  const shadow = createShadowMesh(T, isBag ? 1.5 : 1.1, isBag ? 0.8 : 0.6);
  shadow.mesh.position.set(0, -0.49, 0);
  group.add(shadow.mesh);

  const beans = isBag ? createScatteredBeans(T, 32, 0.5) : null;
  if (beans) group.add(beans.group);

  const piece = extractPackagingPiece(T, gltf, kind);
  const dress = dressPackaging(T, piece, productId, initialSel);
  const unit = new T.Group();
  unit.add(piece);
  unit.rotation.y = PACKAGING_POSE[kind] ?? 0;
  group.add(unit);

  // Espresso goes out in the short cup.
  const base = productId === 'espresso' ? 0.78 : 1;
  const sizeScales = isBag ? [1.0, 1.15, 1.3] : [0.88, 1.0, 1.12];
  const applyVariant = (sel: Record<string, number>) => {
    const s = base * (sel?.size !== undefined ? sizeScales[sel.size] || 1 : 1);
    unit.scale.setScalar(s);
    unit.position.y = 0.5 * (s - 1); // keep the base on the counter
    if (sel) dress.update(sel);
  };
  applyVariant(initialSel);

  return {
    group,
    updateVariant: applyVariant,
    tick: () => {},
    dispose() {
      shadow.dispose();
      beans?.dispose();
      dress.dispose();
    },
  };
}

/**
 * Binds the iced-cup asset (public/assets/shop/iced-cup.glb, authored by
 * scripts/build-iced-cup-glb.mjs) to the drink being shown.
 *
 * The asset carries geometry only — a moulded shell with real wall thickness, a
 * domed lid pierced for the straw, and ice with softened edges. Which drink is in
 * the cup is decided here, because only this side knows, so every node is matched
 * to a material by name:
 *
 *   Cup      clear PET
 *   Liquid   the marbled body texture, printed branding and all
 *   Surface  the drink seen from above
 *   Lid      clear moulded cap
 *   Straw    matte black paper
 *   Ice_0..n frosted, tinted to the drink it is floating in
 */
export function createIcedGlassModel(
  T: typeof THREE,
  productId: string,
  _initialSel: Record<string, number> = {},
  gltf: { scene: THREE.Object3D } | null = null,
): VariantEngine {
  const group = new T.Group();
  // The stage frames a subject one unit across, centred on the origin. Building
  // into a nested group lets the model be measured and fitted to that once it is
  // assembled, instead of every part having to be authored in frame.
  const fitter = new T.Group();
  const inner = new T.Group();
  fitter.add(inner);
  group.add(fitter);

  // Ground Contact Shadow — stays procedural. It is a soft blob that belongs to
  // the stage rather than to the cup, and it costs one 256px canvas.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d');
  if (sctx) {
    const grad = sctx.createRadialGradient(128, 128, 20, 128, 128, 115);
    grad.addColorStop(0, 'rgba(30, 25, 20, 0.38)');
    grad.addColorStop(0.5, 'rgba(30, 25, 20, 0.14)');
    grad.addColorStop(1, 'rgba(30, 25, 20, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 256);
  }
  const shadowTex = new T.CanvasTexture(shadowCanvas);
  const shadowGeo = new T.PlaneGeometry(1.4, 0.6);
  const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.85 });
  const shadowMesh = new T.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, -0.47, 0);

  const isMatcha = productId === 'iced-matcha';
  const drinkTex = createDrinkTexture(T, productId);
  const surfaceTex = createSurfaceTexture(T, isMatcha);

  const cupMat = new T.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.11,
    metalness: 0.0,
    transmission: 0.9,
    thickness: 0.015,
    ior: 1.18,
    // Held well back. The shell has an inner and an outer wall, so a strong
    // clearcoat lights both along the silhouette and rings the cup in white.
    clearcoat: 0.3,
    clearcoatRoughness: 0.18,
  });
  const liquidMat = new T.MeshStandardMaterial({ map: drinkTex, roughness: 0.2, metalness: 0.02 });
  const surfaceMat = new T.MeshStandardMaterial({ map: surfaceTex, roughness: 0.22 });
  const lidMat = new T.MeshPhysicalMaterial({
    // Plain alpha rather than transmission. Transmission samples a render target
    // built from the opaque scene only, so a transmissive dome cannot show the
    // ice underneath it — it samples straight through to the backdrop and comes
    // out milk-white. Blended transparency composites over what is actually drawn
    // behind it, which is what a clear moulded lid looks like anyway: a faint
    // sheen and a bright edge, not a lens.
    color: 0xffffff,
    transparent: true,
    opacity: 0.24,
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
    depthWrite: false,
  });
  const strawMat = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.35, metalness: 0.05 });
  const iceMat = new T.MeshPhysicalMaterial({
    // Tinted to the drink it is sitting in, and lit by scattering rather than
    // refraction: frosted ice diffuses light, it does not act as a lens. Six flat
    // faces refracting the scene threw a starburst of hard edges instead.
    color: isMatcha ? 0xc7ddb2 : 0xdfcfb4,
    transparent: true,
    // Thinner, so the drink shows through the cubes and they sit in it rather
    // than on it. At 0.62 they were solid enough to read as bars of soap.
    opacity: 0.46,
    roughness: 0.32,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.28,
  });

  const byName: Record<string, THREE.Material> = {
    Cup: cupMat,
    Liquid: liquidMat,
    Surface: surfaceMat,
    Lid: lidMat,
    Straw: strawMat,
  };

  const iceCubes: { mesh: THREE.Mesh; origY: number; speed: number; rotSpeed: number }[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  if (!gltf?.scene) throw new Error('iced-cup.glb missing — run scripts/build-iced-cup-glb.mjs');
  const model = gltf.scene.clone(true);
  model.traverse((node: THREE.Object3D) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.push(mesh.geometry);
    if (node.name.startsWith('Ice_')) {
      mesh.material = iceMat;
      const i = Number(node.name.slice(4)) || 0;
      iceCubes.push({ mesh, origY: node.position.y, speed: 1.4 + i * 0.3, rotSpeed: 0.15 + i * 0.08 });
      return;
    }
    mesh.material = byName[node.name] || cupMat;
  });

  // The body texture is laid out with the printed face at the middle of the
  // canvas, which the revolve puts on the far side. Turn it to the lens.
  const liquid = model.getObjectByName('Liquid');
  if (liquid) liquid.rotation.y = Math.PI / 2;

  inner.add(model);

  // Fit the drink to the stage. The ground shadow is left out of the measurement:
  // it is a decal wider than the cup, and including it would shrink the subject to
  // fit a blur. Measured first, added second, so it still travels with the model.
  const fitBox = new T.Box3().setFromObject(inner);
  const fitCenter = fitBox.getCenter(new T.Vector3());
  const fitSize = fitBox.getSize(new T.Vector3());
  inner.add(shadowMesh);
  inner.position.sub(fitCenter);
  fitter.scale.setScalar(1 / Math.max(fitSize.x, fitSize.y, fitSize.z));

  return {
    group,
    updateVariant(_sel) {},
    tick(dt, time) {
      // Gentle micro bobbing of floating ice cubes
      iceCubes.forEach((cube) => {
        cube.mesh.position.y = cube.origY + Math.sin(time * cube.speed) * 0.008;
        cube.mesh.rotation.y += dt * cube.rotSpeed;
      });
    },
    dispose() {
      drinkTex.dispose();
      surfaceTex.dispose();
      shadowTex.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      cupMat.dispose();
      liquidMat.dispose();
      surfaceMat.dispose();
      lidMat.dispose();
      strawMat.dispose();
      iceMat.dispose();
      // Clones share the asset's buffers, so these are the clone's wrappers only.
      geometries.forEach((g) => g.dispose());
    },
  };
}

/**
 * Texture for the band of dough, laid out across its cross-section.
 *
 * The roll's UVs run u along the coil and v around the section — 0 at the
 * bottom of the band, 0.5 over the top, 1 back at the bottom. So this is a
 * horizontal ramp: caramelised gold where the coil crowns, darkening into
 * cinnamon at both edges, which is what fills the groove between the turns.
 */
function createDoughTexture(T: typeof THREE): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new T.CanvasTexture(canvas);

  // v = 0 is the foot of the band, which lands at the bottom of the canvas.
  const bake = ctx.createLinearGradient(0, 512, 0, 0);
  bake.addColorStop(0.0, '#3f2310');
  bake.addColorStop(0.1, '#6a3c1b');
  bake.addColorStop(0.28, '#a76a33');
  bake.addColorStop(0.46, '#d6a25d');
  bake.addColorStop(0.5, '#e0b070');
  bake.addColorStop(0.56, '#d29a54');
  bake.addColorStop(0.74, '#a1642f');
  bake.addColorStop(0.9, '#663919');
  bake.addColorStop(1.0, '#3f2310');
  ctx.fillStyle = bake;
  ctx.fillRect(0, 0, 512, 512);

  // Grain runs along the coil, so it streaks across the texture rather than up it.
  ctx.filter = 'blur(3px)';
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 512;
    const edge = Math.abs(y - 256) / 256; // darker towards the groove
    ctx.strokeStyle = `rgba(${60 + Math.random() * 40}, ${34 + Math.random() * 24}, 14, ${0.1 + edge * 0.3})`;
    ctx.lineWidth = 1 + Math.random() * 5;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(140, y + (Math.random() - 0.5) * 22, 330, y + (Math.random() - 0.5) * 22, 532, y);
    ctx.stroke();
  }
  ctx.filter = 'none';

  // Cinnamon sugar gathers in the crease, and the crown blisters where it baked.
  for (let i = 0; i < 700; i++) {
    const y = Math.random() * 512;
    const edge = Math.abs(y - 256) / 256;
    if (Math.random() > 0.25 + edge * 0.75) continue;
    ctx.fillStyle = `rgba(${44 + Math.random() * 40}, ${24 + Math.random() * 22}, 10, ${0.2 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, y, 0.8 + Math.random() * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 120; i++) {
    const y = 180 + Math.random() * 152;
    ctx.fillStyle = `rgba(255, 226, 176, ${0.06 + Math.random() * 0.16})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, y, 2 + Math.random() * 7, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  // u repeats once per turn of the coil, so the grain does not stretch.
  tex.wrapS = T.RepeatWrapping;
  tex.wrapT = T.ClampToEdgeWrapping;
  return tex;
}

/**
 * Binds the cinnamon roll asset (public/assets/shop/cinnamon-roll.glb, authored
 * by scripts/build-models.mjs) to the selected variant.
 *
 * The asset carries geometry only — a plate, one band of dough swept along an
 * Archimedean spiral, and two thicknesses of piped icing. Steam, the warming
 * light and the contact shadow stay here: they are stage effects that answer to
 * the variant, not parts of the pastry.
 *
 *   Plate       glazed ceramic
 *   Roll        baked dough
 *   Glaze       icing, regular
 *   GlazeExtra  icing, the EXTRA option — a second mesh rather than a scaled
 *               one, because scaling a spiral tube lifts it off the coil
 */
export function createBakeryModel(
  T: typeof THREE,
  initialSel: Record<string, number> = {},
  gltf: { scene: THREE.Object3D } | null = null,
): VariantEngine {
  const group = new T.Group();
  const fitter = new T.Group();
  const inner = new T.Group();
  fitter.add(inner);
  group.add(fitter);

  // Ground Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d');
  if (sctx) {
    const grad = sctx.createRadialGradient(128, 128, 20, 128, 128, 120);
    grad.addColorStop(0, 'rgba(40, 25, 10, 0.55)');
    grad.addColorStop(0.4, 'rgba(40, 25, 10, 0.25)');
    grad.addColorStop(1, 'rgba(40, 25, 10, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 256);
  }
  const shadowTex = new T.CanvasTexture(shadowCanvas);
  const shadowGeo = new T.PlaneGeometry(1.6, 0.7);
  const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.9, depthWrite: false });
  const shadowMesh = new T.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, -0.34, 0);

  const doughTex = createDoughTexture(T);
  const plateMat = new T.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.28, metalness: 0.0 });
  const doughMat = new T.MeshStandardMaterial({ map: doughTex, roughness: 0.62, metalness: 0.0 });
  const glazeMat = new T.MeshPhysicalMaterial({
    color: 0xfaf3e4,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    sheen: 0.4,
  });

  if (!gltf?.scene) throw new Error('cinnamon-roll.glb missing — run bun run build:models');
  const model = gltf.scene.clone(true);
  const geometries: THREE.BufferGeometry[] = [];
  let glazeRegular: THREE.Object3D | null = null;
  let glazeExtra: THREE.Object3D | null = null;

  model.traverse((node: THREE.Object3D) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.push(mesh.geometry);
    if (node.name === 'Plate') mesh.material = plateMat;
    else if (node.name === 'Roll') mesh.material = doughMat;
    else {
      mesh.material = glazeMat;
      if (node.name === 'Glaze') glazeRegular = node;
      if (node.name === 'GlazeExtra') glazeExtra = node;
    }
  });
  inner.add(model);

  // 4. Warmed Thermal Glow Light & Steam Particles
  const warmLight = new T.PointLight(0xff9944, 0, 2.0);
  warmLight.position.set(0, 0.3, 0);
  inner.add(warmLight);

  const particleCount = 32;
  const steamGeo = new T.SphereGeometry(0.04, 8, 8);
  const steamMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });

  const steamParticles: { mesh: THREE.Mesh; seed: number; y: number; maxLife: number; life: number }[] = [];
  const steamGroup = new T.Group();
  steamGroup.position.y = 0.05;
  inner.add(steamGroup);

  for (let i = 0; i < particleCount; i++) {
    const mesh = new T.Mesh(steamGeo, steamMat.clone());
    mesh.scale.setScalar(0.5 + Math.random() * 0.9);
    steamGroup.add(mesh);
    steamParticles.push({
      mesh,
      seed: Math.random() * Math.PI * 2,
      y: Math.random() * 0.8,
      maxLife: 1.6 + Math.random() * 1.4,
      life: Math.random() * 2,
    });
  }

  // Fit the pastry to the stage. Measured from the plate and the roll alone — the
  // shadow is wider than either, and the steam drifts a long way above them, so
  // including them would shrink the subject to frame a blur and some smoke.
  const fitBox = new T.Box3().setFromObject(model);
  const fitCenter = fitBox.getCenter(new T.Vector3());
  const fitSize = fitBox.getSize(new T.Vector3());
  inner.add(shadowMesh);
  inner.position.sub(fitCenter);
  fitter.scale.setScalar(1 / Math.max(fitSize.x, fitSize.y, fitSize.z));

  let isWarmed = initialSel.warm === 1;
  let targetSteamOpacity = isWarmed ? 0.3 : 0;
  let currentSteamOpacity = 0;

  const applyVariant = (sel: Record<string, number>) => {
    isWarmed = sel.warm === 1;
    targetSteamOpacity = isWarmed ? 0.35 : 0;
    const extra = sel.glaze === 1;
    if (glazeRegular) glazeRegular.visible = !extra;
    if (glazeExtra) glazeExtra.visible = extra;
  };
  applyVariant(initialSel);

  return {
    group,
    updateVariant(sel) {
      applyVariant(sel);
    },
    tick(dt, time) {
      currentSteamOpacity += (targetSteamOpacity - currentSteamOpacity) * Math.min(1, dt * 3.5);
      warmLight.intensity = (currentSteamOpacity / 0.35) * 1.8;

      if (currentSteamOpacity > 0.01) {
        steamParticles.forEach((p) => {
          p.life += dt;
          p.y += dt * 0.24;
          if (p.life > p.maxLife || p.y > 0.85) {
            p.life = 0;
            p.y = 0;
            p.seed = Math.random() * Math.PI * 2;
          }
          const progress = p.life / p.maxLife;
          const alpha = Math.sin(progress * Math.PI) * currentSteamOpacity;
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
          const wobbleX = Math.sin(time * 1.8 + p.seed) * 0.07 * progress;
          const wobbleZ = Math.cos(time * 2.1 + p.seed) * 0.07 * progress;
          p.mesh.position.set(wobbleX, p.y, wobbleZ);
          p.mesh.scale.setScalar(0.6 + progress * 1.8);
        });
      } else {
        steamParticles.forEach((p) => {
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
        });
      }
    },
    dispose() {
      shadowTex.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      doughTex.dispose();
      plateMat.dispose();
      doughMat.dispose();
      glazeMat.dispose();
      steamGeo.dispose();
      steamMat.dispose();
      steamParticles.forEach((p) => (p.mesh.material as THREE.Material).dispose());
      // Clones share the asset's buffers, so these are the clone's wrappers only.
      geometries.forEach((g) => g.dispose());
    },
  };
}

/**
 * Creates the exact, bespoke photorealistic 3D model for any Brewns menu item.
 */
export function createProduct3DModel(
  T: typeof THREE,
  gltf: any,
  product: any,
  initialSel: Record<string, number> = {},
  kind = 'cup',
  shopModel: { scene: THREE.Object3D } | null = null,
): VariantEngine {
  const id = product?.id || kind;

  switch (id) {
    // 1. Specialty & Bakery Items
    case 'cardamom-bun':
      return createCardamomBunModel(T, initialSel);

    case 'matcha-financier':
      return createMatchaFinancierModel(T, initialSel);

    case 'cinnamon-roll':
      return createBakeryModel(T, initialSel, shopModel);

    // 2. Specialty Bar & Draft Drinks
    case 'cortado':
      return createCortadoModel(T, initialSel);

    case 'nitro-cold-brew':
      return createNitroColdBrewModel(T, initialSel);

    case 'iced-matcha':
    case 'iced-latte':
      return createIcedGlassModel(T, id, initialSel, shopModel);

    // 3. Hot Café Drinks
    case 'espresso':
    case 'latte':
      return createPackagingModel(T, gltf, 'cup', id, initialSel);

    // 4. Whole Bean Coffees
    case 'single-origin':
    case 'slow-roast':
      return createPackagingModel(T, gltf, 'bag', id, initialSel);

    // 5. Merch & Equipment
    case 'ceramic-tumbler':
      return createCeramicTumblerModel(T, initialSel);

    default:
      // Fallback router by kind
      if (kind === 'bakery') return createBakeryModel(T, initialSel, shopModel);
      if (kind === 'glass') return createIcedGlassModel(T, id, initialSel, shopModel);
      return createPackagingModel(T, gltf, kind === 'bag' ? 'bag' : 'cup', id, initialSel);
  }
}
