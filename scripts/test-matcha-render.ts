import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\9f1fe5b9-d7e3-44db-a6cb-76af064ad67d';

async function testMatchaRender() {
  console.log('Testing matcha render prototype...');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to local test HTML or create a standalone page to verify Three.js render
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; background: #f2f0ea; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
        #canvas-wrap { width: 650px; height: 750px; position: relative; }
        canvas { width: 100%; height: 100%; display: block; }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    </head>
    <body>
      <div id="canvas-wrap"></div>
      <script>
        const wrap = document.getElementById('canvas-wrap');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(24, 650 / 750, 0.1, 100);
        camera.position.set(0, 0.1, 3.2);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(650, 750);
        renderer.setPixelRatio(2);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        wrap.appendChild(renderer.domElement);

        // Lighting
        const amb = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(amb);

        const dir1 = new THREE.DirectionalLight(0xfff8ee, 2.0);
        dir1.position.set(2, 4, 3);
        scene.add(dir1);

        const dir2 = new THREE.DirectionalLight(0xeef4ff, 1.2);
        dir2.position.set(-2, 2, 2);
        scene.add(dir2);

        const rim = new THREE.DirectionalLight(0xffffff, 1.5);
        rim.position.set(0, 3, -3);
        scene.add(rim);

        // Ground contact shadow
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 256; shadowCanvas.height = 256;
        const sctx = shadowCanvas.getContext('2d');
        const grad = sctx.createRadialGradient(128, 128, 20, 128, 128, 110);
        grad.addColorStop(0, 'rgba(40, 30, 20, 0.35)');
        grad.addColorStop(0.5, 'rgba(40, 30, 20, 0.12)');
        grad.addColorStop(1, 'rgba(40, 30, 20, 0)');
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 256, 256);
        const shadowTex = new THREE.CanvasTexture(shadowCanvas);
        const shadowMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.6),
          new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.85 })
        );
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(0, -0.62, 0);
        scene.add(shadowMesh);

        // Texture loader using local web server asset
        const texLoader = new THREE.TextureLoader();
        texLoader.load('http://localhost:3000/assets/menu/menu-iced-coffee.webp', (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;

          // Liquid core cylinder with front projection
          const cupGroup = new THREE.Group();
          cupGroup.position.y = -0.05;
          scene.add(cupGroup);

          // 1. Photo-faithful liquid core
          // We map the authentic texture to a curved tapered cylinder / relief card
          const coreGeo = new THREE.CylinderGeometry(0.395, 0.285, 0.94, 48, 1, false, Math.PI * 0.65, Math.PI * 1.7);
          const coreMat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.15,
            metalness: 0.02,
            side: THREE.DoubleSide
          });
          const core = new THREE.Mesh(coreGeo, coreMat);
          core.rotation.y = -Math.PI * 0.5;
          cupGroup.add(core);

          // 2. Outer Clear Refractive Cup
          const glassGeo = new THREE.CylinderGeometry(0.41, 0.295, 0.96, 48, 1, true);
          const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35,
            roughness: 0.04,
            transmission: 0.92,
            thickness: 0.3,
            ior: 1.48,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05
          });
          const glass = new THREE.Mesh(glassGeo, glassMat);
          cupGroup.add(glass);

          // Rolled Lip Rim
          const rimGeo = new THREE.TorusGeometry(0.41, 0.02, 16, 48);
          rimGeo.rotateX(Math.PI / 2);
          rimGeo.translate(0, 0.48, 0);
          const rim = new THREE.Mesh(rimGeo, glassMat);
          cupGroup.add(rim);

          // Bottom Ridge
          const ridgeGeo = new THREE.TorusGeometry(0.305, 0.015, 16, 48);
          ridgeGeo.rotateX(Math.PI / 2);
          ridgeGeo.translate(0, -0.42, 0);
          const ridge = new THREE.Mesh(ridgeGeo, glassMat);
          cupGroup.add(ridge);

          // 3. Protruding 3D Crystalline Ice Cubes on Top
          const iceMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.88,
            roughness: 0.06,
            transmission: 0.92,
            ior: 1.31,
            clearcoat: 1.0
          });

          const icePositions = [
            [-0.14, 0.44, 0.08, 0.4, 0.6, 0.2],
            [0.12, 0.42, -0.06, -0.3, 0.8, -0.2],
            [0.02, 0.46, 0.12, 0.2, 0.1, 0.5],
            [-0.08, 0.40, -0.12, 0.5, -0.4, 0.3],
            [0.18, 0.38, 0.10, -0.2, 0.5, 0.4]
          ];

          icePositions.forEach(([x, y, z, rx, ry, rz]) => {
            const cube = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), iceMat);
            cube.position.set(x, y, z);
            cube.rotation.set(rx, ry, rz);
            cupGroup.add(cube);
          });

          // 4. Angled Black Straw
          const strawGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.25, 24);
          const strawMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35 });
          const straw = new THREE.Mesh(strawGeo, strawMat);
          straw.position.set(0.12, 0.48, 0.02);
          straw.rotation.z = -0.26;
          straw.rotation.x = 0.14;
          cupGroup.add(straw);

          renderer.render(scene, camera);
          window.__rendered = true;
        });
      </script>
    </body>
    </html>
    `;

    await page.setContent(html);
    await page.waitForFunction('window.__rendered === true', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const prototypePath = path.join(ARTIFACTS_DIR, 'matcha_prototype_render.png');
    await page.screenshot({ path: prototypePath, fullPage: false });
    console.log('Saved prototype screenshot:', prototypePath);
  } finally {
    await browser.close();
  }
}

testMatchaRender().catch((err) => {
  console.error('Prototype failed:', err);
  process.exit(1);
});
