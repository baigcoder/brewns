// @ts-nocheck
/**
 * A live 3D map for a delivery: a few city blocks at dusk, the shop and your
 * door, the route along the streets between them, and the rider's scooter
 * riding it. `update(progress, state)` places the rider (0 = at the shop,
 * 1 = at your door); the camera drifts round and follows the rider.
 *
 * It is a picture of the trip, not a street map: the blocks are generated
 * from the order number so every order gets its own, stable neighbourhood.
 * A soft bloom makes the windows, lamps, route and pins glow.
 */
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createRiderMap(T, mount, seed = 1, riderName = 'RIDER') {
  const W = () => mount.clientWidth || 400;
  const H = () => mount.clientHeight || 260;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  mount.prepend(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36, W() / H(), 0.1, 200);

  let s = seed >>> 0 || 1;
  const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  };

  // dusk sky, matched by the fog so the edges melt into it
  scene.background = canvasTex(4, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b1530');
    g.addColorStop(0.45, '#5b3a4a');
    g.addColorStop(0.75, '#c7784a');
    g.addColorStop(1, '#2a1a14');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  scene.fog = new T.Fog(0x2a2230, 46, 100);

  scene.add(new T.HemisphereLight(0xb8c4ff, 0x3a2418, 1.1));
  const sun = new T.DirectionalLight(0xffb070, 2.4);
  sun.position.set(-16, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24 });
  scene.add(sun);
  const fill = new T.DirectionalLight(0x7f8cff, 0.5);
  fill.position.set(14, 8, -12);
  scene.add(fill);

  const N = 6, BLOCK = 4, STREET = 1.6, SPAN = N * BLOCK + (N + 1) * STREET;
  const origin = -SPAN / 2;
  const streetAt = (k) => origin + k * (BLOCK + STREET) + STREET / 2;

  // ground, asphalt, lane markings
  const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: 0x1c1918, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);
  const asphalt = new T.Mesh(new T.PlaneGeometry(SPAN + 6, SPAN + 6), new T.MeshStandardMaterial({ color: 0x24211f, roughness: 0.9 }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  scene.add(asphalt);
  const kerbMat = new T.MeshStandardMaterial({ color: 0x5e5650, roughness: 0.85 });
  const dashMat = new T.MeshBasicMaterial({ color: 0x8f877c });
  for (let k = 0; k <= N; k++) {
    const c = streetAt(k);
    for (let d = -SPAN / 2 + 0.4; d < SPAN / 2; d += 1.1) {
      for (const horiz of [true, false]) {
        const dash = new T.Mesh(new T.PlaneGeometry(horiz ? 0.45 : 0.05, horiz ? 0.05 : 0.45), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horiz ? d : c, 0.01, horiz ? c : d);
        scene.add(dash);
      }
    }
  }

  // window textures: a few variants, rows of warm and dark panes
  const windows = [0, 1, 2].map((v) =>
    canvasTex(64, 96, (x) => {
      x.fillStyle = '#000';
      x.fillRect(0, 0, 64, 96);
      for (let y = 10; y < 96; y += 32)
        for (let xx = 8; xx < 64; xx += 32) {
          const r = Math.random();
          x.fillStyle = r < 0.3 + v * 0.12 ? (r < 0.12 ? '#ffe7bd' : '#ffb766') : '#0d0b0a';
          x.fillRect(xx, y, 16, 14);
        }
    }),
  );
  windows.forEach((t) => (t.wrapS = t.wrapT = T.RepeatWrapping));
  const PALETTE = [0x3f3a3c, 0x4a4241, 0x36383f, 0x514740, 0x3d3533, 0x2f3036];
  const edgeMat = new T.LineBasicMaterial({ color: 0x1a1412, transparent: true, opacity: 0.55 });
  const shopCell = [0, N - 1], homeCell = [N - 1, 0];
  const lamps = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const bx = origin + STREET + i * (BLOCK + STREET) + BLOCK / 2;
      const bz = origin + STREET + j * (BLOCK + STREET) + BLOCK / 2;
      // pavement slab for the block
      const slab = new T.Mesh(new T.BoxGeometry(BLOCK + 0.3, 0.12, BLOCK + 0.3), kerbMat);
      slab.position.set(bx, 0.06, bz);
      slab.receiveShadow = true;
      scene.add(slab);
      const isShop = i === shopCell[0] && j === shopCell[1];
      const isHome = i === homeCell[0] && j === homeCell[1];
      if (isShop || isHome) {
        // the shop: a low dark pavilion with a gold fascia; home: a warm house
        const h = isShop ? 1.4 : 2.2;
        const b = new T.Mesh(new T.BoxGeometry(BLOCK * 0.75, h, BLOCK * 0.75), new T.MeshStandardMaterial({ color: isShop ? 0x17130f : 0xe8dcc8, roughness: 0.6 }));
        b.position.set(bx, 0.12 + h / 2, bz);
        b.castShadow = b.receiveShadow = true;
        scene.add(b);
        const band = new T.Mesh(new T.BoxGeometry(BLOCK * 0.77, 0.22, BLOCK * 0.77), new T.MeshStandardMaterial({ color: isShop ? 0xd8b777 : 0xffcf8a, emissive: isShop ? 0xd8b777 : 0xffb35c, emissiveIntensity: 1.4 }));
        band.position.set(bx, 0.12 + h - 0.15, bz);
        scene.add(band);
        if (isHome) {
          const roof = new T.Mesh(new T.ConeGeometry(BLOCK * 0.6, 1.2, 4), new T.MeshStandardMaterial({ color: 0x8a4a34, roughness: 0.7 }));
          roof.rotation.y = Math.PI / 4;
          roof.position.set(bx, 0.12 + h + 0.6, bz);
          roof.castShadow = true;
          scene.add(roof);
        }
        continue;
      }
      const pieces = 1 + Math.floor(rand() * 3);
      for (let p = 0; p < pieces; p++) {
        const w = BLOCK * (pieces === 1 ? 0.7 + rand() * 0.2 : 0.38 + rand() * 0.3);
        const d = BLOCK * (pieces === 1 ? 0.7 + rand() * 0.2 : 0.38 + rand() * 0.3);
        const h = 0.8 + Math.pow(rand(), 1.8) * 2.8;
        const win = windows[Math.floor(rand() * windows.length)].clone();
        win.repeat.set(Math.max(1, Math.round(w * 0.9)), Math.max(1, Math.round(h * 0.75)));
        win.needsUpdate = true;
        const mat = new T.MeshStandardMaterial({ color: PALETTE[Math.floor(rand() * PALETTE.length)], roughness: 0.75, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 1.1 });
        const geo = new T.BoxGeometry(w, h, d);
        const b = new T.Mesh(geo, mat);
        const x = bx + (pieces > 1 ? (rand() - 0.5) * (BLOCK - w) : 0), z = bz + (pieces > 1 ? (rand() - 0.5) * (BLOCK - d) : 0);
        b.position.set(x, 0.12 + h / 2, z);
        b.castShadow = b.receiveShadow = true;
        scene.add(b);
        const edges = new T.LineSegments(new T.EdgesGeometry(geo), edgeMat);
        edges.position.copy(b.position);
        scene.add(edges);
        // a lighter roof cap
        const cap = new T.Mesh(new T.BoxGeometry(w + 0.08, 0.12, d + 0.08), new T.MeshStandardMaterial({ color: 0x5c5550, roughness: 0.9 }));
        cap.position.set(x, 0.12 + h + 0.06, z);
        cap.castShadow = true;
        scene.add(cap);
      }
      if (rand() < 0.65) {
        const tree = new T.Group();
        const trunk = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 0.5, 6), new T.MeshStandardMaterial({ color: 0x4a3222 }));
        trunk.position.y = 0.37;
        const crown = new T.Mesh(new T.IcosahedronGeometry(0.42, 1), new T.MeshStandardMaterial({ color: rand() < 0.5 ? 0x4f7a3f : 0x5f8a45, roughness: 0.9, flatShading: true }));
        crown.position.y = 0.85;
        tree.add(trunk, crown);
        tree.position.set(bx + BLOCK / 2 - 0.35, 0, bz - BLOCK / 2 + 0.35);
        tree.traverse((m) => m.isMesh && (m.castShadow = true));
        scene.add(tree);
      }
      // street lamp at the corner
      const lamp = new T.Group();
      const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.1, 6), new T.MeshStandardMaterial({ color: 0x222222 }));
      pole.position.y = 0.67;
      const bulb = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), new T.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.y = 1.25;
      lamp.add(pole, bulb);
      lamp.position.set(bx - BLOCK / 2 - 0.05, 0, bz + BLOCK / 2 + 0.05);
      scene.add(lamp);
      lamps.push(bulb);
    }

  // the route along the streets
  const shopDoor = new T.Vector3(streetAt(0), 0, origin + STREET + (N - 1) * (BLOCK + STREET) + BLOCK / 2);
  const homeDoor = new T.Vector3(origin + STREET + (N - 1) * (BLOCK + STREET) + BLOCK / 2, 0, streetAt(0));
  const turnA = 1 + Math.floor(rand() * (N - 2)), turnB = 1 + Math.floor(rand() * (N - 2));
  const pts = [
    shopDoor,
    new T.Vector3(streetAt(0), 0, streetAt(turnA + 1)),
    new T.Vector3(streetAt(turnB + 1), 0, streetAt(turnA + 1)),
    new T.Vector3(streetAt(turnB + 1), 0, streetAt(0)),
    homeDoor,
  ].map((p) => p.setY(0.08));
  const segs = [];
  let total = 0;
  for (let k = 1; k < pts.length; k++) {
    const len = pts[k].distanceTo(pts[k - 1]);
    segs.push({ a: pts[k - 1], b: pts[k], len, from: total });
    total += len;
  }
  const at = (f) => {
    const d = Math.max(0, Math.min(1, f)) * total;
    const seg = segs.find((g) => d <= g.from + g.len) || segs[segs.length - 1];
    const t = (d - seg.from) / seg.len;
    return { p: seg.a.clone().lerp(seg.b, t), dir: seg.b.clone().sub(seg.a).normalize() };
  };
  // a flat ribbon following the path
  const ribbon = (path, width) => {
    const pos = [], idx = [];
    path.forEach((p, k) => {
      const prev = path[Math.max(0, k - 1)], next = path[Math.min(path.length - 1, k + 1)];
      const dir = next.clone().sub(prev).setY(0).normalize();
      const side = new T.Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
      pos.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z);
      if (k) idx.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, k * 2, k * 2 + 1, (k - 1) * 2 + 1);
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  };
  const dense = [];
  segs.forEach((g, k) => {
    const n = Math.max(2, Math.ceil(g.len / 0.25));
    for (let q = k ? 1 : 0; q <= n; q++) dense.push(g.a.clone().lerp(g.b, q / n));
  });
  const cum = [];
  dense.forEach((q, k) => cum.push(k ? cum[k - 1] + q.distanceTo(dense[k - 1]) : 0));
  const ahead = new T.Mesh(ribbon(dense, 0.5), new T.MeshBasicMaterial({ color: 0xd8b777, transparent: true, opacity: 0.3, depthWrite: false }));
  ahead.position.y = 0.02;
  scene.add(ahead);
  const doneMesh = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xf2bd62 }));
  doneMesh.position.y = 0.03;
  scene.add(doneMesh);

  // location pins: a teardrop with a glowing core, a label, a pulse on the ground
  const label = (text, bg, fg) =>
    canvasTex(256, 72, (x) => {
      x.fillStyle = bg;
      x.beginPath();
      x.roundRect(6, 10, 244, 52, 26);
      x.fill();
      x.fillStyle = fg;
      x.font = 'bold 28px Arial';
      x.textAlign = 'center';
      x.fillText(text, 128, 46);
    });
  const pin = (color, text, bg, fg) => {
    const g = new T.Group();
    const headMat = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.35 });
    const head = new T.Mesh(new T.SphereGeometry(0.5, 24, 18), headMat);
    head.position.y = 2.4;
    const tip = new T.Mesh(new T.ConeGeometry(0.42, 1, 24), headMat);
    tip.rotation.x = Math.PI;
    tip.position.y = 1.85;
    const core = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), new T.MeshBasicMaterial({ color: 0xffffff }));
    core.position.set(0, 2.45, 0.34);
    const ring = new T.Mesh(new T.RingGeometry(0.4, 0.62, 40), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    const tag = new T.Sprite(new T.SpriteMaterial({ map: label(text, bg, fg), color: 0xdddddd, depthTest: false }));
    tag.scale.set(3.4, 0.95, 1);
    tag.position.y = 3.55;
    const top = new T.Group();
    top.add(head, tip, core);
    g.add(top, ring, tag);
    g.traverse((m) => m.isMesh && m !== ring && (m.castShadow = true));
    g.userData = { ring, top };
    scene.add(g);
    return g;
  };
  const shopPin = pin(0xd8b777, 'BREWNS', 'rgba(23,19,15,.92)', '#d8b777');
  // pins stand on the pavement in front of each door, clear of the street
  const kerbside = (door, i, j) => {
    const c = new T.Vector3(origin + STREET + i * (BLOCK + STREET) + BLOCK / 2, 0, origin + STREET + j * (BLOCK + STREET) + BLOCK / 2);
    return door.clone().setY(0).add(c.sub(door.clone().setY(0)).normalize().multiplyScalar(1.3));
  };
  shopPin.position.copy(kerbside(shopDoor, ...shopCell));
  const homePin = pin(0xe9e1d2, 'YOU', 'rgba(244,241,234,.95)', '#17130f');
  homePin.position.copy(kerbside(homeDoor, ...homeCell));
  const mid = shopDoor.clone().add(homeDoor).multiplyScalar(0.5).setY(0);

  // the rider
  const rider = new T.Group();
  const paint = new T.MeshStandardMaterial({ color: 0xd58c3d, roughness: 0.35, metalness: 0.2 });
  const body = new T.Mesh(new T.CapsuleGeometry(0.16, 0.7, 4, 12), paint);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.42;
  const seat = new T.Mesh(new T.BoxGeometry(0.35, 0.08, 0.26), new T.MeshStandardMaterial({ color: 0x1a1a1a }));
  seat.position.set(-0.05, 0.62, 0);
  const box = new T.Mesh(new T.BoxGeometry(0.46, 0.44, 0.46), new T.MeshStandardMaterial({ color: 0xd8b777, roughness: 0.45, metalness: 0.15 }));
  box.position.set(-0.38, 0.9, 0);
  const logo = new T.Mesh(new T.PlaneGeometry(0.34, 0.1), new T.MeshBasicMaterial({ color: 0x17130f }));
  logo.position.set(-0.38, 0.95, 0.235);
  const logo2 = logo.clone();
  logo2.position.z = -0.235;
  logo2.rotation.y = Math.PI;
  const person = new T.Mesh(new T.CapsuleGeometry(0.15, 0.34, 4, 10), new T.MeshStandardMaterial({ color: 0x2e3440 }));
  person.position.set(0.05, 0.95, 0);
  person.rotation.z = -0.25;
  const helmet = new T.Mesh(new T.SphereGeometry(0.17, 18, 14), new T.MeshStandardMaterial({ color: 0xf4f1ea, metalness: 0.2, roughness: 0.3 }));
  helmet.position.set(0.14, 1.32, 0);
  const wheelGeo = new T.TorusGeometry(0.16, 0.06, 8, 20);
  const wheelMat = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const w1 = new T.Mesh(wheelGeo, wheelMat), w2 = new T.Mesh(wheelGeo, wheelMat);
  w1.position.set(-0.4, 0.22, 0);
  w2.position.set(0.42, 0.22, 0);
  const headlight = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshBasicMaterial({ color: 0xfff2c8 }));
  headlight.position.set(0.6, 0.55, 0);
  const beam = new T.SpotLight(0xffe7b0, 6, 6, 0.5, 0.6);
  beam.position.set(0.6, 0.55, 0);
  beam.target.position.set(3, 0, 0);
  rider.add(body, seat, box, logo, logo2, person, helmet, w1, w2, headlight, beam, beam.target);
  rider.traverse((m) => m.isMesh && (m.castShadow = true));
  rider.scale.setScalar(1.6);
  const pulse = new T.Mesh(new T.RingGeometry(0.6, 0.85, 48), new T.MeshBasicMaterial({ color: 0xd58c3d, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false }));
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.06;
  const tag = new T.Sprite(new T.SpriteMaterial({ map: label(riderName, '#d58c3d', '#17130f'), depthTest: false }));
  tag.scale.set(2.8, 0.8, 1);
  tag.position.y = 3.0;
  const riderRoot = new T.Group();
  riderRoot.add(rider, pulse, tag);
  scene.add(riderRoot);

  // bloom
  let composer = null;
  try {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(W(), H());
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new T.Vector2(W(), H()), 0.5, 0.45, 0.9));
    composer.addPass(new OutputPass());
  } catch {
    composer = null;
  }

  let progress = 0, shown = -1, visible = false, moving = false, raf = 0, disposed = false, onScreen = true;
  const look = new T.Vector3();
  const heading = new T.Vector3(1, 0, 0);
  const place = (f) => {
    const { p, dir } = at(f);
    heading.copy(dir);
    riderRoot.position.copy(p).setY(0.08);
    rider.rotation.y = Math.atan2(-dir.z, dir.x);
    const d = f * total;
    let n = 0;
    while (n < cum.length && cum[n] <= d) n++;
    const upto = dense.slice(0, n);
    upto.push(p.clone().setY(0.08));
    doneMesh.geometry.dispose();
    doneMesh.geometry = upto.length > 1 ? ribbon(upto, 0.62) : new T.BufferGeometry();
  };
  const t0 = performance.now();
  let last = t0;
  const frame = () => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!onScreen) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    if (shown < 0 || Math.abs(progress - shown) > 0.0005) {
      shown = shown < 0 ? progress : shown + (progress - shown) * (1 - Math.exp(-dt * 4));
      place(shown);
    }
    riderRoot.visible = visible;
    rider.position.y = moving ? Math.sin(t * 14) * 0.015 : 0;
    w1.rotation.z = w2.rotation.z = moving ? -t * 14 : 0;
    const q = (t % 1.6) / 1.6;
    pulse.scale.setScalar(1 + q * 1.8);
    pulse.material.opacity = 0.7 * (1 - q);
    [shopPin, homePin].forEach((g, n) => {
      const kk = ((t + n * 0.8) % 2) / 2;
      g.userData.ring.scale.setScalar(1 + kk * 1.4);
      g.userData.ring.material.opacity = 0.6 * (1 - kk);
      g.userData.top.position.y = Math.sin(t * 2 + n) * 0.08;
    });
    lamps.forEach((b, n) => b.material.color.setRGB(1, 0.85 + 0.05 * Math.sin(t * 3 + n), 0.63));
    // camera: sways over the town with both pins in view, and looks down on
    // the rider from above while riding so the blocks never hide the scooter
    [shopPin, homePin].forEach((g) => g.scale.setScalar(g.scale.x + ((visible ? 1 : 2.6) - g.scale.x) * (1 - Math.exp(-dt * 3))));
    const target = visible ? riderRoot.position : mid;
    look.lerp(target, 1 - Math.exp(-dt * 5));
    let want;
    const arrived = visible && !moving && progress >= 1;
    if (arrived) {
      // delivered: a slow circle round your door
      const ang = t * 0.15;
      want = new T.Vector3(look.x + Math.cos(ang) * 8, 11, look.z + Math.sin(ang) * 8);
    } else if (visible) {
      // behind the rider and a little to the side, turning with the route
      const side = new T.Vector3(-heading.z, 0, heading.x);
      want = look.clone().addScaledVector(heading, -6).addScaledVector(side, 2.5).setY(10);
    } else {
      // the shop and your door sit left and right, so a narrow card needs
      // the camera further back to keep both in
      const k = Math.min(2, Math.max(1, 2.4 / camera.aspect));
      const ang = Math.PI / 4 + Math.sin(t * 0.12) * 0.12;
      want = new T.Vector3(look.x + Math.cos(ang) * 24 * k, 36 * k, look.z + Math.sin(ang) * 24 * k);
    }
    camera.position.lerp(want, 1 - Math.exp(-dt * 2));
    // aim a little ahead of the rider so the scooter sits above the stats bar
    const aim = visible && !arrived ? look.clone().addScaledVector(heading, 1.2) : look;
    camera.lookAt(aim.x, 0.4, aim.z);
    composer ? composer.render() : renderer.render(scene, camera);
  };
  camera.position.set(17, 36, 17);
  look.copy(mid);
  frame();

  const ro = new ResizeObserver(() => {
    renderer.setSize(W(), H());
    composer?.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    const k = Math.min(2, Math.max(1, 2.4 / camera.aspect));
    scene.fog.near = 46 * k;
    scene.fog.far = 100 * k;
  });
  ro.observe(mount);
  const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
  io.observe(mount);

  return {
    update(f, { riding = false, show = false } = {}) {
      progress = Math.max(0, Math.min(1, f));
      visible = show;
      moving = riding;
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        o.geometry?.dispose();
        [].concat(o.material || []).forEach((m) => {
          m.map?.dispose();
          m.emissiveMap?.dispose();
          m.dispose();
        });
      });
      composer?.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
