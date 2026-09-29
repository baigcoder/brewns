// @ts-nocheck
/* The product viewer's stage: the studio the pieces are lit in, the renderer
   settings, the key light's soft shadows, and an optional post-processing chain
   (ambient occlusion and multisampling). The viewer in initBrewns.ts builds its
   scene from these, and so do the render checks in scripts/, so what is checked
   is what ships. */
import type * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/* A photo studio to reflect: a big softbox front-left, a strip light on the right, a rim light behind and a warm bounce
   from below, on a mid-grey room. Glass, glaze, sauce and metal pick these up as the soft window highlights a product
   photograph has; the old blocky "room" gave them nothing believable to show. */
const studioEnvironment = (T, pmrem) => {
  const room = new T.Scene();
  room.add(new T.Mesh(new T.SphereGeometry(30, 32, 16), new T.MeshBasicMaterial({ color: new T.Color(0.42, 0.42, 0.44), side: T.BackSide })));
  const panel = (w, h, pos, k, tint = [1, 1, 1]) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(tint[0] * k, tint[1] * k, tint[2] * k), side: T.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(12, 8, [-9, 7, 8], 9);
  panel(4, 14, [10, 3, 6], 5, [0.95, 0.98, 1]);
  // The rim light behind. Kept moderate: every flat, glossy, upward-facing surface (a saucer, a patty, a pool of sauce)
  // mirrors it towards a camera in front, and at full strength it greyed them all out.
  panel(14, 4, [0, 10, -8], 3.2);
  panel(16, 4, [0, -6, 8], 1.2, [1, 0.92, 0.82]);
  const env = pmrem.fromScene(room, 0.02);
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
};

export const makeStudio = (T, renderer) => {
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const env = studioEnvironment(T, pmrem);
  pmrem.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = 0.6;
  const amb = new T.AmbientLight(0xffffff, 0.85);
  scene.add(amb);
  for (const [position, intensity] of [[[-4.2, 3, 3.4], 3.2], [[3.9, 2.5, 2.3], 1.4], [[0.6, 3, -3.2], 1.1]]) {
    const light = new T.DirectionalLight(0xfcfff9, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  return { scene, env };
};

export const setupRenderer = (T, renderer) => {
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.16;
};

/* Food is lit like a photograph: a slightly lower exposure so colour holds, and real soft shadows from the key light
   (toppings shade the cheese, the dish shades the board) instead of only a blob under the plate. With ambient
   occlusion on, the flat ambient fill is eased back a little: the occlusion now does the job of keeping crevices dark,
   and the open surfaces can take a touch more light. */
export const lightProduct = (T, renderer, scene, isFood, ao = false) => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if (isFood) {
    renderer.toneMappingExposure = ao ? 0.95 : 0.9;
    scene.environmentIntensity = 0.45;
  }
  const key = scene.children.find((o) => o.isDirectionalLight);
  if (key) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -1.3;
    cam.right = cam.top = 1.3;
    cam.near = 1;
    cam.far = 12;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 5;
  }
};

/* Models that do not bring their own get real shadows too: every solid part casts and receives the key light's shadow,
   and a catcher under the piece shows only what falls on the floor. Returns the catcher, if one was added. */
export const shadowPiece = (T, piece) => {
  if (piece.userData.hasCatcher) return null;
  piece.traverse((m) => {
    if (!m.isMesh) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    m.castShadow = !(m.userData.noShadow || mat?.transmission > 0 || (mat?.transparent && mat.opacity < 0.9));
    m.receiveShadow = true;
  });
  const box = new T.Box3().setFromObject(piece);
  if (!Number.isFinite(box.min.y)) return null;
  const catcher = new T.Mesh(new T.CircleGeometry(1.4, 48), new T.ShadowMaterial({ opacity: 0.26 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = box.min.y - 0.003;
  catcher.receiveShadow = true;
  return catcher;
};

/* ── ambient occlusion ──

   GTAO darkens the places light cannot reach: where the patty meets the bun, between penne, under a croissant's
   curl. Two changes to the stock pass:

   - What goes into its depth and normal buffer. Steam, the painted blob shadow and anything marked `noAO` are left
     out: they are see-through, and occlusion "cast" by a wisp of steam reads as a grey smudge. The floor's shadow
     catcher stays in, so the floor occludes like a floor.
   - How the result is laid on. The stock blend multiplies the colour, which does nothing where the floor is
     transparent (its colour is zero). Here the occlusion is laid on as black at alpha (1 − ao): on solid surfaces
     that is the same multiply, and on the see-through floor it builds up alpha, so every piece gets a soft contact
     shadow where it meets the table. */

const isSeeThrough = (o) => {
  if (!o.isMesh) return false;
  if (o.userData.noAO) return true;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  return !!mat && !mat.isShadowMaterial && mat.transparent && mat.opacity < 0.9;
};

class StageAOPass extends GTAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (o.visible && isSeeThrough(o)) {
        o.visible = false;
        cache.push(o);
      }
    });
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    // The depth and normal pass is a second full render of the scene; the shadow map from the beauty pass just
    // before is still good, so do not draw it again.
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    renderer.shadowMap.autoUpdate = auto;
  }
}

const layOnOcclusion = (T, pass) => {
  const m = pass.blendMaterial;
  m.fragmentShader = /* glsl */ `
    uniform float intensity;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      float ao = texture2D(tDiffuse, vUv).r;
      gl_FragColor = vec4(0.0, 0.0, 0.0, clamp((1.0 - ao) * intensity, 0.0, 1.0));
    }`;
  m.blending = T.CustomBlending;
  m.blendEquation = m.blendEquationAlpha = T.AddEquation;
  m.blendSrc = T.ZeroFactor;
  m.blendDst = T.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = T.OneFactor;
  m.blendDstAlpha = T.OneMinusSrcAlphaFactor;
  m.needsUpdate = true;
};

/* The canvas is transparent, so the buffer holds premultiplied colour. The stock output pass tone-maps and encodes
   that as it is, which brightens anything half-transparent over the page (steam, a glass rim) and can push colour
   above alpha. Un-premultiply first, then premultiply back. */
const premultipliedOutput = (pass) => {
  const m = pass.material;
  m.fragmentShader = m.fragmentShader
    .replace('gl_FragColor = texture2D( tDiffuse, vUv );', 'gl_FragColor = texture2D( tDiffuse, vUv );\n\t\t\tfloat alpha = gl_FragColor.a;\n\t\t\tif ( alpha > 0.0 ) gl_FragColor.rgb /= alpha;')
    .replace(/\}\s*$/, '\tgl_FragColor.rgb *= alpha;\n\t\t}');
  m.needsUpdate = true;
};

export interface ViewerFX {
  render(): void;
  setSize(w: number, h: number): void;
  dispose(): void;
  /** Whether ambient occlusion is on. */
  ao: boolean;
}

/**
 * Draws the scene, through ambient occlusion and multisampling when `ao` is set, or straight to the canvas when it is
 * not (phones, reduced motion) or the chain cannot be built. Call `setSize` with the canvas's CSS size after the
 * renderer's pixel ratio is set.
 */
export function createViewerFX(T, renderer, scene, camera, o: { ao?: boolean } = {}): ViewerFX {
  const plain: ViewerFX = {
    ao: false,
    render: () => renderer.render(scene, camera),
    setSize: (w, h) => renderer.setSize(w, h, false),
    dispose: () => {},
  };
  if (!o.ao || !renderer.capabilities.isWebGL2) return plain;
  try {
    const size = renderer.getDrawingBufferSize(new T.Vector2());
    // Multisampled, half float so the occlusion and tone mapping work on linear light; the canvas's own antialias does
    // not reach an offscreen target.
    const target = new T.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: T.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const aoPass = new StageAOPass(scene, camera, size.x, size.y);
    // Pieces are fitted to about one unit, so the radius is in those units: wide enough to shade between a bun and its
    // patty, small enough that a pizza does not darken its own middle.
    aoPass.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.4, thickness: 0.6, distanceFallOff: 1, scale: 1.1, samples: 16 });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    aoPass.blendIntensity = 0.85;
    layOnOcclusion(T, aoPass);
    composer.addPass(aoPass);
    const output = new OutputPass();
    premultipliedOutput(output);
    composer.addPass(output);
    return {
      ao: true,
      render: () => composer.render(),
      setSize(w, h) {
        renderer.setSize(w, h, false);
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(w, h);
      },
      dispose() {
        aoPass.dispose();
        output.dispose();
        composer.dispose();
      },
    };
  } catch (error) {
    console.warn('viewer: ambient occlusion unavailable', error);
    return plain;
  }
}
