// @ts-nocheck
/* A product's own photograph, given depth: the cutout is lifted into a relief whose shape comes from its silhouette
   (a distance field "inflated" into a rounded form) with a little surface detail from the picture itself. Shown unlit,
   so it looks exactly like the photograph, and turned within the range a single photo can honestly show. The effect
   is the "3D photo" of phone galleries: real parallax and a real silhouette that changes as it turns. */
import type * as THREE from 'three';
import type { VariantEngine } from './pdp3dEngine';

/** How far the viewer may turn a relief each way, in radians; beyond this a single photograph has nothing to show. */
export const RELIEF_YAW = 0.45;
export const RELIEF_PITCH = [-0.25, 0.35];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Where the product is in the photograph: the bounding box of everything not transparent (its baked shadow included),
    in 0..1 image coordinates, and how much of the picture is transparent at all. A photo with almost no transparency is
    not a cutout (a bag shot on a dark set, say) and has no silhouette to give depth. */
function measure(img: HTMLImageElement) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0, clear = 0;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const a = px[(y * S + x) * 4 + 3];
      if (a < 10) clear++;
      if (a > 24) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  const pad = 4;
  return {
    transparent: clear / (S * S),
    box: [Math.max(0, x0 - pad) / S, Math.max(0, y0 - pad) / S, Math.min(S, x1 + 1 + pad) / S, Math.min(S, y1 + 1 + pad) / S],
  };
}

/**
 * A height field for the cutout's region `box`, W×H, 0..1: the alpha mask's distance to its edge shaped into a rounded
 * profile, softened, plus fine relief from the picture's own light and shade.
 */
function heightField(img: HTMLImageElement, box: number[], W: number, H: number) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const [bx0, by0, bx1, by1] = box;
  ctx.drawImage(img, bx0 * img.width, by0 * img.height, (bx1 - bx0) * img.width, (by1 - by0) * img.height, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const n = W * H;
  const alpha = new Float32Array(n), lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    alpha[i] = px[i * 4 + 3] / 255;
    lum[i] = (0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2]) / 255;
  }
  // Chamfer distance to the outside of the solid part (baked shadows are faint, so they stay flat).
  const INF = 1e9;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = alpha[i] > 0.6 ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
    }
  let dmax = 1;
  for (let i = 0; i < n; i++) if (d[i] < INF) dmax = Math.max(dmax, d[i]);
  // Inflate: a circular profile, so the form rolls over at its edge the way a cup, a bun or a glass does.
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, d[i] / (dmax * 0.9));
    h[i] = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
  }
  const blur = (src: Float32Array, r: number) => {
    const tmp = new Float32Array(n), out = new Float32Array(n);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0, k = 0;
        for (let j = -r; j <= r; j++) {
          const xx = x + j;
          if (xx >= 0 && xx < W) (s += src[y * W + xx]), k++;
        }
        tmp[y * W + x] = s / k;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0, k = 0;
        for (let j = -r; j <= r; j++) {
          const yy = y + j;
          if (yy >= 0 && yy < H) (s += tmp[yy * W + x]), k++;
        }
        out[y * W + x] = s / k;
      }
    return out;
  };
  const smooth = blur(h, 2);
  // Surface detail: light areas stand a touch proud of dark ones (crevices are dark, crowns are lit).
  const lumBlur = blur(lum, 6);
  for (let i = 0; i < n; i++) smooth[i] = alpha[i] > 0.02 ? smooth[i] + (lum[i] - lumBlur[i]) * 0.12 * Math.min(1, smooth[i] * 3) : 0;
  return smooth;
}

/**
 * The relief as a VariantEngine. The photo loads asynchronously; the group is empty until then. `depth` is how deep the
 * relief is relative to the product's width in the picture. `onError` is called if the photo cannot be loaded or is
 * not a cutout, so the viewer can show a modelled piece instead.
 */
export function createPhotoRelief(T: typeof THREE, src: string, o: { depth?: number; onError?: (error: unknown) => void } = {}): VariantEngine {
  const group = new T.Group();
  group.userData.relief = true;
  group.userData.hasCatcher = true;
  group.userData.viewPitch = 0.05;
  const disposables: { dispose: () => void }[] = [];
  let disposed = false;

  loadImage(src)
    .then((img) => {
      if (disposed) return;
      const { transparent, box } = measure(img);
      if (transparent < 0.2) throw new Error('not a cutout');
      // Crop to the product so every piece fills the stage the same way, whatever margin its photo has.
      const bw = (box[2] - box[0]) * img.width, bh = (box[3] - box[1]) * img.height;
      const big = Math.max(bw, bh);
      const G = 200;
      const W = Math.max(8, Math.round((G * bw) / big)), H = Math.max(8, Math.round((G * bh) / big));
      const h = heightField(img, box, W, H);
      const geo = new T.PlaneGeometry(bw / big, bh / big, W - 1, H - 1);
      const p = geo.attributes.position;
      const depth = (o.depth ?? 0.32) * (bw / big);
      // PlaneGeometry runs its rows top to bottom, the same order as the image.
      for (let i = 0; i < p.count; i++) p.setZ(i, h[i] * depth);
      geo.computeVertexNormals();
      const tex = new T.Texture(img);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = 8;
      // Show only the cropped region (texture v runs up the image).
      tex.repeat.set(box[2] - box[0], box[3] - box[1]);
      tex.offset.set(box[0], 1 - box[3]);
      tex.needsUpdate = true;
      // Unlit and not tone-mapped: the photograph's own light, exactly as it was taken.
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.03, toneMapped: false, side: T.DoubleSide });
      // Where the relief turns steeply away from the eye, its few edge pixels would be stretched across the slope and
      // smear. Fade those slopes out instead, so the silhouette stays as crisp as the photograph's.
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vReliefN;\nvarying vec3 vReliefV;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvReliefN = normalize(normalMatrix * normal);\nvReliefV = -mvPosition.xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vReliefN;\nvarying vec3 vReliefV;')
          .replace('#include <alphatest_fragment>', 'diffuseColor.a *= smoothstep(0.26, 0.5, abs(dot(normalize(vReliefN), normalize(vReliefV))));\n#include <alphatest_fragment>');
      };
      const mesh = new T.Mesh(geo, mat);
      // Centre it on its solid part: sit it so the relief's middle depth is on the turning axis.
      mesh.position.z = -depth * 0.35;
      group.add(mesh);
      disposables.push(geo, tex, mat);
    })
    .catch((error) => {
      console.warn('relief: photo failed to load', src, error);
      if (!disposed) o.onError?.(error);
    });

  return {
    group,
    dispose() {
      disposed = true;
      disposables.forEach((d) => d.dispose());
    },
  };
}

/** How deep a product's relief is, relative to the photo's width: shot from above (pizza, pasta) it is shallow, a cup or
    a glass seen from the side is round and deep. */
export function reliefDepth(product: { id?: string; menuCat?: string; cat?: string } | null) {
  const id = product?.id || '';
  if (/pizza/.test(id)) return 0.12;
  if (/pasta/.test(id)) return 0.16;
  if (/fries|tenders|garlic-bread|roll|wrap/.test(id) && product?.cat === 'kitchen') return 0.24;
  if (product?.cat === 'bakery') return 0.26;
  return 0.32;
}
