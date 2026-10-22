// @ts-nocheck
/* The house packaging's printed labels, drawn onto the bag and cup models. Kept
   apart from pdp3dEngine so the home page hero can dress its model without loading
   every product model. */
import type * as THREE from 'three';

/**
 * The packaging's print. The asset's own print (cream bag, white cup) is
 * replaced wholesale: the bag in charcoal with copper foil and a curved lower
 * panel (sage for Slow Roast, sand for Ethiopia), the cup in matte black with
 * gold foil, type in cream. Each product carries its own name, notes and size;
 * anything without an entry (the hero) wears the house label.
 *
 * Every print is drawn twice from the same layout: once in colour, and once as
 * a surface map (G = roughness, B = metalness, as three.js reads them) so the
 * gold is foil and the stock stays matte.
 *
 * Bag atlas (2048px): both faces side by side, stored upside down; each face is
 * drawn upright in a 770 × 1300 frame. Cup atlas (1536px): upright; the label
 * sits in the 320px column at the left, which the pose turns to the lens.
 */
/* A bag's lower panel, below the curve: its colour and the ink printed on it. */
type Panel = { colour: string; ink: string; dim: string; accent: string };
type BagLabel = {
  script: string[]; notes: string[]; about: string[]; size: string; panel: Panel;
  /** An origin bag: its title in copper, ETHIOPIA / SINGLE ORIGIN under an emblem, a mountain landscape over a flat panel. */
  origin?: { name: string; sub: string };
};
/* A product cup wears a coloured sleeve with the drink's name; the house cup
   (hero, story) keeps the plain print. */
type CupLabel = {
  lines: [string, string];
  option: (sel: Record<string, number>) => string;
  sleeve?: { colour: string; ink: string; accent: string; size: number };
  /** The cup's own stock and print, when it isn't the house black and gold. */
  print?: { ground: string; mark: string; ink: string; dim: string };
  /** The line of small words round the foot. */
  band?: string;
  /** The photographed cup is clear: below the sleeve the drink shows through, with tapioca pearls in the bottom. */
  liquid?: { top: string; bottom: string; pearls?: boolean };
};
const HOUSE_BAG: BagLabel = {
  script: ['slow', 'roast'],
  notes: ['CARAMEL', 'BROWN SUGAR', 'ROASTED ALMOND'],
  about: ['CRAFT ROASTED IN', 'SMALL BATCHES FOR', 'CLEAN SWEETNESS', 'AND A SMOOTH FINISH.'],
  size: '250 G',
  // Sage green, with cream type and copper rules.
  panel: { colour: '#6f7866', ink: '#efe6d6', dim: 'rgba(239,230,214,0.8)', accent: '#d39a6c' },
};
const HOUSE_CUP: CupLabel = { lines: ['GOOD COFFEE', 'GOOD MOOD'], option: () => '250 ML' };
const PACKAGING_LABELS: Record<string, { bag?: BagLabel; cup?: CupLabel }> = {
  'slow-roast': {
    bag: { ...HOUSE_BAG, size: '' },
  },
  'single-origin': {
    bag: {
      // Reconstructed from the product photograph (public/assets/menu/bag-yirgacheffe.webp), which carries the
      // "slow roast" title, ETHIOPIA / SINGLE ORIGIN, the house copy and its own sand panel.
      script: ['slow', 'roast'],
      // Flavour notes come from lib/catalog.ts (the authoritative entry), not from the photograph, which prints the Slow
      // Roast notes (caramel, brown sugar, roasted almond): that conflict is documented for the owner, not copied.
      notes: ['JASMINE', 'BERGAMOT', 'WHITE PEACH'],
      // Also from the catalogue entry (description and details: washed heirloom varieties, smallholders in Yirgacheffe, 2,100 m).
      about: ['WASHED HEIRLOOM', 'VARIETIES FROM', 'SMALLHOLDERS IN', 'YIRGACHEFFE, 2,100 M.'],
      size: '250 G',
      panel: { colour: '#e4d3b2', ink: '#1f1a14', dim: 'rgba(31,26,20,0.86)', accent: '#c45a26' },
      // No roasting city is printed: the photograph says Copenhagen, the catalogue says Slow Roast is roasted in Lahore and says
      // nothing for this coffee, so the claim is left off until the owner confirms it (docs/3d-product-audit.md).
      origin: { name: 'ETHIOPIA', sub: 'SINGLE ORIGIN' },
    },
  },
  // The latte: a milky, latte-coloured cup, navy print and a navy sleeve.
  latte: {
    cup: {
      lines: ['LATTE', 'SMOOTH · BALANCED · STEAMED'],
      option: (sel) => ['8 OZ', '12 OZ', '16 OZ'][sel.size ?? 1],
      sleeve: { colour: '#2e3a4b', ink: '#f1e6d2', accent: '#c9b597', size: 92 },
      print: { ground: '#d9c5a6', mark: '#26303f', ink: '#26303f', dim: 'rgba(38,48,63,0.78)' },
      band: '100% COFFEE · NO ARTIFICIAL · ',
      liquid: { top: '#d2b284', bottom: '#97693e', pearls: true },
    },
  },
  // The espresso: black, with terracotta print and a terracotta sleeve.
  espresso: {
    cup: {
      lines: ['ESPRESSO', 'RICH · INTENSE · NO SUGAR'],
      option: (sel) => (sel.shots === 1 ? 'DOUBLE SHOT' : 'SINGLE SHOT'),
      sleeve: { colour: '#b5582b', ink: '#f6ead6', accent: '#f1c98a', size: 66 },
      print: { ground: '#171513', mark: '#c9642f', ink: '#efe6d6', dim: 'rgba(239,230,214,0.7)' },
      band: '100% COFFEE · NO ARTIFICIAL · ',
    },
  },
};
const BAG_SIZES = ['250 G', '500 G', '1 KG'];

type Palette = { ground: string; gold: string; cream: string; dim: string };
// The bag: charcoal stock, copper foil, cream type.
const BAG_INK: Palette = { ground: '#2a2a28', gold: '#d39a6c', cream: '#efe6d6', dim: 'rgba(239,230,214,0.7)' };
// The cup: matte black stock, gold foil, cream type.
const CUP_INK: Palette = { ground: '#141414', gold: '#d6ad55', cream: '#efe6d6', dim: 'rgba(239,230,214,0.62)' };
const SURFACE: Palette = { ground: 'rgb(0,205,0)', gold: 'rgb(0,100,160)', cream: 'rgb(0,175,0)', dim: 'rgb(0,185,0)' };
const MONO = '"Space Mono", ui-monospace, monospace';

// Loaded on first use, not at import: this module is also evaluated on the server.
let wordmark: HTMLImageElement | null = null;
let printReady: Promise<void> | null = null;
let printLoaded = false;
/** Start fetching the print's wordmark and faces, so labels dressed later paint once. */
export const loadPrint = () =>
  (printReady ||= Promise.all([
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        wordmark = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = '/assets/shared/wordmark-large.webp';
    }),
    document.fonts?.load('190px Allura').catch(() => {}),
    document.fonts?.load('24px "Space Mono"').catch(() => {}),
  ]).then(() => {
    printLoaded = true;
  }));

// The wordmark is an alpha mask; tint it by filling through it.
const tinted: Record<string, HTMLCanvasElement> = {};
function drawWordmark(ctx: CanvasRenderingContext2D, colour: string, x: number, y: number, w: number) {
  const h = w * (528 / 2496);
  if (!wordmark) {
    ctx.fillStyle = colour;
    ctx.font = `700 ${h * 1.1}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('brewns', x + w / 2, y + h * 0.85);
    ctx.textAlign = 'left';
    return;
  }
  let mark = tinted[colour];
  if (!mark) {
    mark = tinted[colour] = document.createElement('canvas');
    mark.width = wordmark.naturalWidth;
    mark.height = wordmark.naturalHeight;
    const m = mark.getContext('2d')!;
    m.imageSmoothingQuality = 'high';
    m.drawImage(wordmark, 0, 0, mark.width, mark.height);
    m.globalCompositeOperation = 'source-in';
    m.fillStyle = colour;
    m.fillRect(0, 0, mark.width, mark.height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mark, x, y, w, h);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, colour: string, size: number, spacing = 0, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = colour;
  ctx.font = `400 ${size}px ${MONO}`;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
}

function rule(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, colour: string, width = 2) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/*
 * No roast date is printed on the bag artwork. The product photographs carry "12/06/24", which is one old batch; showing it
 * would present stale batch information as current, and a date made from the clock would invent a roast. The ROAST DATE
 * field is kept as an empty stamp line, as on a pack whose date is applied per batch. A real value must come from batch data
 * (none exists in this repository).
 */

/** The origin bag's landscape, redrawn from the photograph: layered copper and umber ridges, a pale sun and an acacia. */
function drawHighlands(ctx: CanvasRenderingContext2D) {
  const ridge = (colour: string, pts: number[][]) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-20, 990);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(790, 990);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#efe1c4';
  ctx.beginPath();
  ctx.arc(600, 940, 58, Math.PI, 0);
  ctx.fill();
  ridge('#c4682e', [[-20, 960], [60, 930], [150, 905], [250, 940], [330, 925], [430, 950], [560, 930], [680, 945], [790, 935]]);
  ridge('#9c4a22', [[-20, 975], [90, 950], [210, 962], [340, 944], [470, 968], [610, 952], [790, 962]]);
  ridge('#5e2f1a', [[-20, 988], [120, 972], [260, 984], [420, 970], [560, 984], [700, 974], [790, 982]]);
  // acacia: a leaning trunk and a broad, flat canopy of overlapping lobes
  ctx.fillStyle = '#241811';
  ctx.strokeStyle = '#241811';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(500, 990);
  ctx.quadraticCurveTo(508, 960, 520, 944);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(518, 946);
  ctx.lineTo(470, 934);
  ctx.moveTo(522, 944);
  ctx.lineTo(570, 930);
  ctx.stroke();
  for (const [cx, cy, rx] of [[462, 932, 26], [500, 925, 30], [540, 926, 32], [578, 932, 24], [520, 920, 28]]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBagFace(ctx: CanvasRenderingContext2D, p: Palette, label: BagLabel, size: string) {
  // Below the curve, the panel: its own colour, and its own ink (the surface map keeps it matte).
  const surface = p === SURFACE;
  const pn: Panel = surface ? { colour: SURFACE.ground, ink: SURFACE.cream, dim: SURFACE.dim, accent: SURFACE.gold } : label.panel;
  const og = label.origin;
  ctx.fillStyle = pn.colour;
  ctx.beginPath();
  if (og) {
    // an origin bag's panel is flat-topped, with the landscape standing on it
    ctx.moveTo(-20, 985);
    ctx.lineTo(790, 985);
  } else {
    ctx.moveTo(-20, 815);
    ctx.quadraticCurveTo(385, 905, 790, 815);
  }
  ctx.lineTo(790, 1320);
  ctx.lineTo(-20, 1320);
  ctx.closePath();
  ctx.fill();
  if (og && !surface) drawHighlands(ctx);

  text(ctx, 'ROAST DATE', 125, 112, p.gold, 24, 2);
  rule(ctx, 125, 142, 660, 142, p.gold);

  drawWordmark(ctx, og && !surface ? p.cream : p.gold, 150, 330, 470);
  text(ctx, 'COFFEE HOUSE', 385, 500, p.cream, 32, 12, 'center');
  rule(ctx, 345, 542, 425, 542, p.gold, 3);

  ctx.save();
  // origin bags carry the title in copper, as photographed
  ctx.fillStyle = og && !surface ? p.gold : p.cream;
  ctx.font = `${og ? 168 : label.script.length > 1 ? 196 : 220}px Allura, cursive`;
  ctx.rotate(-0.06);
  if (og) {
    ctx.fillText(label.script[0], 95, 660);
    ctx.fillText(label.script[1], 225, 752);
  } else if (label.script.length > 1) {
    ctx.fillText(label.script[0], 95, 680);
    ctx.fillText(label.script[1], 235, 790);
  } else ctx.fillText(label.script[0], 60, 750);
  ctx.restore();
  if (og) {
    // a small round emblem, then the origin and its descriptor
    ctx.save();
    ctx.strokeStyle = p.gold;
    ctx.lineWidth = 3;
    ctx.translate(385, 800);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 8; k++) {
      ctx.beginPath();
      ctx.moveTo(Math.cos((k * Math.PI) / 4) * 8, Math.sin((k * Math.PI) / 4) * 8);
      ctx.lineTo(Math.cos((k * Math.PI) / 4) * 22, Math.sin((k * Math.PI) / 4) * 22);
      ctx.stroke();
    }
    ctx.restore();
    text(ctx, og.name, 385, 866, p.cream, 30, 5, 'center');
    text(ctx, og.sub, 385, 894, p.cream, 15, 3, 'center');
  }

  const ay = og ? 1018 : 945, ny = og ? 1018 : 945, step = og ? 28 : 34;
  label.about.forEach((line, i) => text(ctx, line, 122, ay + i * step, pn.dim, og ? 19 : 21));
  text(ctx, 'FLAVOR NOTES', 460, ny, pn.accent, 21, 1);
  rule(ctx, 460, ny + 17, 675, ny + 17, pn.accent);
  label.notes.forEach((note, i) => text(ctx, note, 460, og ? ny + 42 + i * 25 : ny + 60 + i * step, pn.ink, og ? 19 : 21));

  rule(ctx, 120, 1120, 675, 1120, pn.accent);
  rule(ctx, 240, 1142, 240, 1210, pn.accent);
  if (!og) rule(ctx, 445, 1142, 445, 1210, pn.accent);
  text(ctx, size, 132, 1185, pn.ink, 22);
  text(ctx, 'WHOLE BEAN', 258, 1185, pn.ink, 22);
  // the house roast says where it is roasted (the catalogue does); the origin bag makes no claim about a city
  if (!og) {
    text(ctx, 'ROASTED IN', 465, 1170, pn.ink, 22);
    text(ctx, 'LAHORE', 465, 1202, pn.ink, 22);
  }
}

function paintBag(ctx: CanvasRenderingContext2D, p: Palette, label: BagLabel, sel: Record<string, number>) {
  const k = ctx.canvas.width / 2048;
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const size = label.size || BAG_SIZES[sel.size ?? 0];
  for (const dx of [0, 786]) {
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(dx, 1300);
    ctx.scale(1, -1);
    drawBagFace(ctx, p, label, size);
    ctx.restore();
  }
}

/* The face the camera sees runs from about x 90 to 480 (centre 280) and y 170
   to 695 of the 1536 × 921 atlas; everything that matters sits inside it. */
function paintSleevedCup(ctx: CanvasRenderingContext2D, p: Palette, label: CupLabel, sel: Record<string, number>) {
  const sv = label.sleeve!;
  const surface = p === SURFACE;
  const CX = 280;
  // the sleeve, all the way round: corrugated card between two folded edges
  ctx.fillStyle = surface ? 'rgb(0,235,0)' : sv.colour;
  ctx.fillRect(0, 352, 1536, 196);
  if (!surface) {
    for (let x = 0; x < 1536; x += 9) {
      ctx.fillStyle = x % 18 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, 352, 4, 196);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 352, 1536, 5);
    ctx.fillRect(0, 543, 1536, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 357, 1536, 2);
  }
  // a clear cup: the drink shows through below the sleeve, glossier than paper, with a few pearls resting at the bottom
  if (label.liquid) {
    const H = ctx.canvas.height / (ctx.canvas.width / 1536);
    const g = ctx.createLinearGradient(0, 548, 0, H);
    g.addColorStop(0, surface ? 'rgb(0,120,0)' : label.liquid.top);
    g.addColorStop(1, surface ? 'rgb(0,120,0)' : label.liquid.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 548, 1536, H - 548);
    if (label.liquid.pearls && !surface) {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      ctx.fillStyle = 'rgba(40,26,18,0.82)';
      for (let i = 0; i < 300; i++) {
        const y = 692 + rnd() * (H - 700);
        ctx.beginPath();
        ctx.arc(rnd() * 1536, y, 5 + rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // above the sleeve: wordmark and house line
  drawWordmark(ctx, p.gold, CX - 150, 206, 300);
  text(ctx, 'COFFEE HOUSE · LAHORE', CX, 312, p.gold, 17, 6, 'center');
  rule(ctx, CX - 30, 330, CX + 30, 330, p.gold, 2);
  // on the sleeve: the drink, big
  const ink = surface ? SURFACE.cream : sv.ink;
  const accent = surface ? SURFACE.gold : sv.accent;
  ctx.fillStyle = ink;
  ctx.font = `900 ${sv.size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.letterSpacing = '-2px';
  ctx.textAlign = 'center';
  ctx.fillText(label.lines[0], CX, 462);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
  rule(ctx, CX - 150, 486, CX + 150, 486, accent, 2);
  text(ctx, label.lines[1], CX, 520, ink, 15, 3, 'center');
  // below: size, and the promise
  text(ctx, label.option(sel), CX - 18, 612, p.cream, 20, 2, 'right');
  rule(ctx, CX, 588, CX, 640, p.gold, 2);
  text(ctx, 'BREWED', CX + 18, 606, p.dim, 16, 2);
  text(ctx, 'DAILY', CX + 18, 630, p.dim, 16, 2);
  // a thin line of the house words round the foot
  const band = label.band || 'BREWNS · GOOD COFFEE · NO WAITING · ';
  for (let x = 0; x < 1536; x += 470) text(ctx, band, x, 676, p.gold, 13, 3);
}

function paintCup(ctx: CanvasRenderingContext2D, base: Palette, label: CupLabel, sel: Record<string, number>) {
  const k = ctx.canvas.width / 1536;
  // A product cup can bring its own stock and print colours (the surface map stays as it is).
  const pr = base !== SURFACE && label.print;
  const p: Palette = pr ? { ground: pr.ground, gold: pr.mark, cream: pr.ink, dim: pr.dim } : base;
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.scale(k, k);
  if (label.sleeve) {
    paintSleevedCup(ctx, p, label, sel);
    ctx.restore();
    return;
  }
  drawWordmark(ctx, p.gold, 72, 236, 296);
  text(ctx, 'COFFEE HOUSE', 220, 345, p.cream, 21, 7, 'center');
  rule(ctx, 86, 428, 356, 428, p.gold);
  label.lines.forEach((line, i) => text(ctx, line, 88, 475 + i * 31, p.cream, 21));
  rule(ctx, 86, 550, 356, 550, p.gold);
  rule(ctx, 214, 574, 214, 640, p.gold);
  text(ctx, label.option(sel), 94, 614, p.cream, 21);
  text(ctx, 'BREWED', 250, 600, p.gold, 19);
  text(ctx, 'DAILY', 250, 628, p.gold, 19);
  ctx.restore();
}

/**
 * Dresses a packaging piece (or a whole scene holding the bag and cup) in the
 * dark edition, labelled for a product. Materials are cloned, so the loaded
 * asset is left untouched. `ready` settles once the wordmark and faces have
 * loaded and the print is final; `update` reprints what follows the options.
 */
export function dressPackaging(
  T: typeof THREE,
  piece: THREE.Object3D,
  productId?: string,
  initialSel: Record<string, number> = {},
): { ready: Promise<void>; update: (sel: Record<string, number>) => void; dispose: () => void } {
  const labels = (productId && PACKAGING_LABELS[productId]) || {};
  const bagLabel = labels.bag ?? HOUSE_BAG;
  const cupLabel = labels.cup ?? HOUSE_CUP;
  const owned: any[] = [];
  let sel = initialSel;
  piece.traverse((node: any) => {
    if (!node.isMesh || !node.material?.map) return;
    const source = node.material.map;
    const width = source.image?.width;
    const isCup = width === 1536;
    const paint = isCup
      ? (ctx: CanvasRenderingContext2D, p: Palette) => paintCup(ctx, p, cupLabel, sel)
      : width >= 2048
        ? (ctx: CanvasRenderingContext2D, p: Palette) => paintBag(ctx, p, bagLabel, sel)
        : null;
    if (!paint) return;
    const layer = (palette: Palette) => {
      const canvas = document.createElement('canvas');
      canvas.width = source.image.width;
      canvas.height = source.image.height;
      const ctx = canvas.getContext('2d')!;
      const tex = source.clone();
      tex.source = new (T.TextureSource ?? T.Source)(canvas);
      return { tex, draw: () => { paint(ctx, palette); tex.needsUpdate = true; } };
    };
    const colour = layer(isCup ? CUP_INK : BAG_INK);
    const surface = layer(SURFACE);
    surface.tex.colorSpace = T.NoColorSpace;
    const repaint = () => {
      colour.draw();
      surface.draw();
    };
    repaint();
    const material = node.material.clone();
    material.map = colour.tex;
    material.roughnessMap = surface.tex;
    material.metalnessMap = surface.tex;
    material.roughness = 1;
    material.metalness = 1;
    node.material = material;
    owned.push({ material, repaint, textures: [colour.tex, surface.tex] });
  });
  // Each repaint fills two big canvases and uploads them as textures: with the print
  // already in, the first paint above is final and the second would be wasted.
  const ready = printLoaded ? Promise.resolve() : loadPrint().then(() => owned.forEach((o) => o.repaint()));
  return {
    ready,
    update(next) {
      sel = next;
      owned.forEach((o) => o.repaint());
    },
    dispose() {
      owned.forEach((o) => {
        o.textures.forEach((t: any) => t.dispose());
        o.material.dispose();
      });
    },
  };
}
