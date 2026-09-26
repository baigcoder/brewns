/* A QR code encoder, small enough to keep in the repo: byte mode, error
   correction level M, versions 1–10 (up to 213 bytes, far more than a table's
   link needs), with the standard mask chosen by penalty score. Follows the
   ISO/IEC 18004 construction; used for the table QR codes on the Shops page.
   Returns a square of booleans (true = dark), without the quiet zone. */

// Level M: [ecc codewords per block, blocks in group 1, data codewords each, blocks in group 2, data codewords each] for versions 1–10.
const M_BLOCKS: [number, number, number, number, number][] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
];
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* ── Reed–Solomon over GF(256), polynomial 0x11d ── */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsDivisor(degree: number) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly.slice(1);
}

function rsRemainder(data: number[], divisor: number[]) {
  const out = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ out.shift()!;
    out.push(0);
    for (let i = 0; i < divisor.length; i++) out[i] ^= mul(divisor[i], factor);
  }
  return out;
}

/* ── format bits: level M is 00, with BCH(15,5) and the fixed mask ── */
function formatBits(mask: number) {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
function versionBits(v: number) {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (v << 12) | rem;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export function qrMatrix(text: string, forceMask?: number): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  // Smallest version that fits: 4 bits mode + 8 (v1–9) or 16 (v10) bits length + data.
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const [, b1, d1, b2, d2] = M_BLOCKS[v - 1];
    const capBits = (b1 * d1 + b2 * d2) * 8;
    if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= capBits) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error('QR: text too long');
  const [eccLen, b1, d1, b2, d2] = M_BLOCKS[version - 1];
  const dataCap = b1 * d1 + b2 * d2;

  // Data bits, terminator, padding.
  const bits: number[] = [];
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; codewords.length < dataCap; pad ^= 0xec ^ 0x11) codewords.push(pad);

  // Blocks, error correction, interleaving.
  const div = rsDivisor(eccLen);
  const blocks: { data: number[]; ecc: number[] }[] = [];
  let k = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const len = i < b1 ? d1 : d2;
    const data = codewords.slice(k, k + len);
    k += len;
    blocks.push({ data, ecc: rsRemainder(data, div) });
  }
  const final: number[] = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.data.length) final.push(b.data[i]);
  for (let i = 0; i < eccLen; i++) for (const b of blocks) final.push(b.ecc[i]);

  // The grid, with its function patterns.
  const size = version * 4 + 17;
  const grid: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    grid[y][x] = dark;
    fixed[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const al = ALIGN[version - 1];
  for (const ay of al)
    for (const ax of al) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === al.at(-1)) || (ax === al.at(-1) && ay === 6)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  const drawFormat = (mask: number) => {
    const f = formatBits(mask);
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true); // the dark module
  };
  drawFormat(0);
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((vb >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  // Data, in the zig-zag.
  let bi = 0;
  const dataBits = final.flatMap((c) => Array.from({ length: 8 }, (_, i) => (c >>> (7 - i)) & 1));
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        grid[y][x] = bi < dataBits.length ? dataBits[bi++] === 1 : false;
      }
  }

  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[m](x, y)) grid[y][x] = !grid[y][x];
  };
  let best = forceMask ?? 0;
  if (forceMask === undefined) {
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      const s = penalty(grid);
      if (s < bestScore) (bestScore = s), (best = m);
      applyMask(m);
    }
  }
  applyMask(best);
  drawFormat(best);
  return grid;
}

function penalty(g: boolean[][]) {
  const n = g.length;
  let score = 0;
  const lines = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      let run = 1;
      for (let j = 1; j <= n; j++) {
        if (j < n && get(i, j) === get(i, j - 1)) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      // Finder-like runs: 1:1:3:1:1 with four light on either side.
      for (let j = 0; j + 10 < n; j++) {
        const p = Array.from({ length: 11 }, (_, k) => get(i, j + k));
        const a = [true, false, true, true, true, false, true, false, false, false, false];
        const b = [...a].reverse();
        if (p.every((v, k) => v === a[k]) || p.every((v, k) => v === b[k])) score += 40;
      }
    }
  };
  lines((i, j) => g[i][j]);
  lines((i, j) => g[j][i]);
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (g[y][x] === g[y][x + 1] && g[y][x] === g[y + 1][x] && g[y][x] === g[y + 1][x + 1]) score += 3;
  const dark = g.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return score;
}

/** The code as SVG markup, with a four-module quiet zone. */
export function qrSvg(text: string) {
  const m = qrMatrix(text);
  const n = m.length + 8;
  let d = '';
  m.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + 4} ${y + 4}h1v1h-1z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
