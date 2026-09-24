// @ts-nocheck
/**
 * A live 3D map for a delivery: a few city blocks at dusk, the shop and your
 * door, the route along the streets between them, and the rider's scooter
 * riding it. `update(progress, state)` places the rider (0 = at the shop,
 * 1 = at your door); the camera drifts round and leans toward the rider.
 *
 * It is a picture of the trip, not a street map: the blocks are generated
 * from the order number so every order gets its own, stable neighbourhood.
 */
export function createRiderMap(T, mount, seed = 1, riderName = 'RIDER') {
  const W = () => mount.clientWidth || 400;
  const H = () => mount.clientHeight || 260;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  mount.append(renderer.domElement);

  const scene = new T.Scene();
  scene.fog = new T.Fog(0x0d0a08, 26, 60);
  const camera = new T.PerspectiveCamera(38, W() / H(), 0.1, 200);

  // light: a low warm sun and a cool sky
  scene.add(new T.HemisphereLight(0x8fa7c9, 0x2a1a10, 0.9));
  const sun = new T.DirectionalLight(0xffc78a, 2.2);
  sun.position.set(-12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22 });
  scene.add(sun);

  let s = seed >>> 0 || 1;
  const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;

  // ground and streets: a 6 × 6 grid of blocks, streets between them
  const N = 6, BLOCK = 4, STREET = 1.4, SPAN = N * BLOCK + (N + 1) * STREET;
  const origin = -SPAN / 2;
  const ground = new T.Mesh(new T.PlaneGeometry(SPAN + 20, SPAN + 20), new T.MeshStandardMaterial({ color: 0x1b1714, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const streetAt = (k) => origin + k * (BLOCK + STREET) + STREET / 2; // centre line of street k
  const streetMat = new T.MeshStandardMaterial({ color: 0x2c2825, roughness: 0.95 });
  const lineMat = new T.MeshBasicMaterial({ color: 0x5a5148 });
  for (let k = 0; k <= N; k++) {
    const c = streetAt(k);
    for (const horiz of [true, false]) {
      const road = new T.Mesh(new T.PlaneGeometry(horiz ? SPAN : STREET, horiz ? STREET : SPAN), streetMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horiz ? 0 : c, 0.01, horiz ? c : 0);
      road.receiveShadow = true;
      scene.add(road);
      for (let d = -SPAN / 2; d < SPAN / 2; d += 1.2) {
        const dash = new T.Mesh(new T.PlaneGeometry(horiz ? 0.5 : 0.06, horiz ? 0.06 : 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horiz ? d : c, 0.02, horiz ? c : d);
        scene.add(dash);
      }
    }
  }

  // buildings with lit windows (a canvas texture, shared)
  const winCanvas = document.createElement('canvas');
  winCanvas.width = 64;
  winCanvas.height = 128;
  const wc = winCanvas.getContext('2d');
  wc.fillStyle = '#231d19';
  wc.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 12)
    for (let x = 6; x < 64; x += 14) {
      const lit = Math.random() < 0.45;
      wc.fillStyle = lit ? (Math.random() < 0.5 ? '#ffcf8a' : '#ffe2b0') : '#2f2823';
      wc.fillRect(x, y, 8, 6);
    }
  const winTex = new T.CanvasTexture(winCanvas);
  winTex.colorSpace = T.SRGBColorSpace;
  winTex.wrapS = winTex.wrapT = T.RepeatWrapping;
  const buildings = [];
  const shopCell = [0, N - 1], homeCell = [N - 1, 0];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const bx = origin + STREET + i * (BLOCK + STREET) + BLOCK / 2;
      const bz = origin + STREET + j * (BLOCK + STREET) + BLOCK / 2;
      const isShop = i === shopCell[0] && j === shopCell[1];
      const isHome = i === homeCell[0] && j === homeCell[1];
      const pieces = isShop || isHome ? 1 : 1 + Math.floor(rand() * 3);
      for (let p = 0; p < pieces; p++) {
        const w = isShop || isHome ? BLOCK * 0.8 : BLOCK * (0.35 + rand() * 0.4);
        const d = isShop || isHome ? BLOCK * 0.8 : BLOCK * (0.35 + rand() * 0.4);
        const h = isShop ? 1.6 : isHome ? 2.4 : 0.9 + rand() * rand() * 3.6;
        const tex = winTex.clone();
        tex.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h / 2)));
        tex.needsUpdate = true;
        const mat = new T.MeshStandardMaterial({ color: isShop ? 0x17130f : 0x3a332d, map: isShop ? null : tex, emissive: 0xffc27a, emissiveMap: isShop ? null : tex, emissiveIntensity: isShop ? 0 : 0.22, roughness: 0.85 });
        const b = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
        b.position.set(bx + (pieces > 1 ? (rand() - 0.5) * (BLOCK - w) : 0), h / 2, bz + (pieces > 1 ? (rand() - 0.5) * (BLOCK - d) : 0));
        b.castShadow = b.receiveShadow = true;
        scene.add(b);
        buildings.push(b);
      }
      // a few trees on the corners
      if (!isShop && !isHome && rand() < 0.5) {
        const tree = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), new T.MeshStandardMaterial({ color: 0x3f5f36, roughness: 1 }));
        tree.position.set(bx + BLOCK / 2 - 0.4, 0.8, bz - BLOCK / 2 + 0.4);
        tree.castShadow = true;
        scene.add(tree);
      }
    }

  // the route: along the streets from the shop's door to yours
  const shopDoor = new T.Vector3(streetAt(0) + 0.0, 0, origin + STREET + (N - 1) * (BLOCK + STREET) + BLOCK / 2);
  const homeDoor = new T.Vector3(origin + STREET + (N - 1) * (BLOCK + STREET) + BLOCK / 2, 0, streetAt(0));
  const turnA = 1 + Math.floor(rand() * (N - 2)), turnB = 1 + Math.floor(rand() * (N - 2));
  const pts = [
    shopDoor,
    new T.Vector3(streetAt(0), 0, streetAt(turnA + 1)),
    new T.Vector3(streetAt(turnB + 1), 0, streetAt(turnA + 1)),
    new T.Vector3(streetAt(turnB + 1), 0, streetAt(0)),
    homeDoor,
  ].map((p) => p.setY(0.06));
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
  const routeMat = new T.LineDashedMaterial({ color: 0xd8b777, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.55 });
  const routeLine = new T.Line(new T.BufferGeometry().setFromPoints(pts), routeMat);
  routeLine.computeLineDistances();
  scene.add(routeLine);
  // the part already ridden, brighter
  const doneGeo = new T.BufferGeometry();
  const doneLine = new T.Line(doneGeo, new T.LineBasicMaterial({ color: 0xffd28f }));
  scene.add(doneLine);

  // markers
  const pin = (color, label) => {
    const g = new T.Group();
    const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.4, 8), new T.MeshStandardMaterial({ color: 0xdddddd }));
    pole.position.y = 1.2;
    const head = new T.Mesh(new T.SphereGeometry(0.42, 20, 16), new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
    head.position.y = 2.5;
    const ring = new T.Mesh(new T.RingGeometry(0.5, 0.75, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(pole, head, ring);
    // floating label
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(16,13,11,.85)';
    x.fillRect(0, 8, 256, 48);
    x.fillStyle = '#' + color.toString(16).padStart(6, '0');
    x.font = 'bold 26px Arial';
    x.textAlign = 'center';
    x.fillText(label, 128, 42);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.scale.set(4.4, 1.1, 1);
    sprite.position.y = 3.5;
    g.add(sprite);
    g.userData.ring = ring;
    scene.add(g);
    return g;
  };
  const shopPin = pin(0xd8b777, 'BREWNS');
  shopPin.position.copy(shopDoor).setY(0);
  const homePin = pin(0xffffff, 'YOU');
  homePin.position.copy(homeDoor).setY(0);

  // the rider: a scooter with a delivery box, and a pulse around it
  const rider = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(0.9, 0.35, 0.35), new T.MeshStandardMaterial({ color: 0xd58c3d, roughness: 0.5 }));
  body.position.y = 0.45;
  const box = new T.Mesh(new T.BoxGeometry(0.45, 0.45, 0.45), new T.MeshStandardMaterial({ color: 0x17130f }));
  box.position.set(-0.35, 0.85, 0);
  const logo = new T.Mesh(new T.PlaneGeometry(0.34, 0.12), new T.MeshBasicMaterial({ color: 0xd8b777 }));
  logo.position.set(-0.35, 0.9, 0.23);
  const person = new T.Mesh(new T.CapsuleGeometry(0.16, 0.35, 4, 8), new T.MeshStandardMaterial({ color: 0x2b2b30 }));
  person.position.set(0.1, 0.95, 0);
  const helmet = new T.Mesh(new T.SphereGeometry(0.17, 16, 12), new T.MeshStandardMaterial({ color: 0xd8b777, metalness: 0.3, roughness: 0.4 }));
  helmet.position.set(0.12, 1.33, 0);
  const wheelGeo = new T.CylinderGeometry(0.2, 0.2, 0.1, 16);
  const wheelMat = new T.MeshStandardMaterial({ color: 0x111111 });
  const w1 = new T.Mesh(wheelGeo, wheelMat), w2 = new T.Mesh(wheelGeo, wheelMat);
  [w1, w2].forEach((w, k) => {
    w.rotation.x = Math.PI / 2;
    w.position.set(k ? 0.38 : -0.38, 0.2, 0);
  });
  const lamp = new T.PointLight(0xffe0a8, 2.5, 4);
  lamp.position.set(0.6, 0.5, 0);
  rider.add(body, box, logo, person, helmet, w1, w2, lamp);
  rider.traverse((m) => m.isMesh && (m.castShadow = true));
  const pulse = new T.Mesh(new T.RingGeometry(0.6, 0.8, 40), new T.MeshBasicMaterial({ color: 0xd58c3d, transparent: true, opacity: 0.6, side: T.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.05;
  const riderRoot = new T.Group();
  rider.scale.setScalar(1.7);
  riderRoot.add(rider, pulse);
  // the rider's name floating over the scooter
  {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#d58c3d';
    x.beginPath();
    x.roundRect(8, 10, 240, 44, 22);
    x.fill();
    x.fillStyle = '#17130f';
    x.font = 'bold 26px Arial';
    x.textAlign = 'center';
    x.fillText(riderName, 128, 42);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const tag = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
    tag.scale.set(2.6, 0.65, 1);
    tag.position.y = 3.1;
    riderRoot.add(tag);
  }
  scene.add(riderRoot);

  let progress = 0, shown = 0, visible = false, moving = false, raf = 0, disposed = false, onScreen = true;
  const look = new T.Vector3();
  const place = (f) => {
    const { p, dir } = at(f);
    riderRoot.position.copy(p);
    rider.rotation.y = Math.atan2(-dir.z, dir.x);
    // the ridden part of the route
    const d = f * total;
    const done = [pts[0]];
    for (const g of segs) {
      if (d >= g.from + g.len) done.push(g.b);
      else {
        done.push(p.clone().setY(0.08));
        break;
      }
    }
    doneGeo.setFromPoints(done);
  };
  const t0 = performance.now();
  const frame = () => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!onScreen) return;
    const t = (performance.now() - t0) / 1000;
    shown += (progress - shown) * 0.15;
    place(shown);
    riderRoot.visible = visible;
    const bob = moving ? Math.sin(t * 14) * 0.02 : 0;
    rider.position.y = bob;
    w1.rotation.y = w2.rotation.y = moving ? t * 12 : 0;
    const k = (t % 1.6) / 1.6;
    pulse.scale.setScalar(1 + k * 1.8);
    pulse.material.opacity = 0.6 * (1 - k);
    [shopPin, homePin].forEach((g, n) => {
      const r = g.userData.ring;
      const kk = ((t + n * 0.8) % 2) / 2;
      r.scale.setScalar(1 + kk);
      r.material.opacity = 0.5 * (1 - kk);
    });
    // camera: a slow orbit, leaning toward the rider while riding
    const target = visible ? riderRoot.position : new T.Vector3(0, 0, 0);
    look.lerp(target, 0.12);
    const ang = t * 0.05 + 0.8;
    const dist = visible ? 12 : 24;
    camera.position.lerp(new T.Vector3(look.x + Math.cos(ang) * dist, visible ? 9 : 17, look.z + Math.sin(ang) * dist), 0.08);
    // look a touch ahead of the rider, so it sits in the middle of the frame
    look.y = 0.8;
    camera.lookAt(look);
    renderer.render(scene, camera);
  };
  camera.position.set(20, 18, 20);
  frame();

  const ro = new ResizeObserver(() => {
    renderer.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
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
          m.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
