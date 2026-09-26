/* Pure TypeScript byte-mode QR Code SVG generator (Versions 1-6, Low/Medium EC).
   Produces clean vector SVGs for table ordering QR codes without external dependencies. */

// Galois Field GF(256) math with primitive polynomial 0x11d (285)
const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  EXP[i + 255] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, [1, EXP[i]]);
  }
  return g;
}

function calculateReedSolomon(data: number[], ecCount: number): number[] {
  const gen = getGeneratorPoly(ecCount);
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// Version table capacities (Byte mode, Medium EC): [version, totalBytes, dataBytes, ecBytes, size]
const VERSIONS = [
  { version: 1, total: 26, data: 16, ec: 10, size: 21 },
  { version: 2, total: 44, data: 28, ec: 16, size: 25 },
  { version: 3, total: 70, data: 44, ec: 26, size: 29 },
  { version: 4, total: 100, data: 64, ec: 36, size: 33 },
  { version: 5, total: 134, data: 86, ec: 48, size: 37 },
  { version: 6, total: 172, data: 108, ec: 64, size: 41 },
];

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const v = VERSIONS.find((ver) => ver.data >= bytes.length + 3) || VERSIONS[VERSIONS.length - 1];
  const size = v.size;

  // Encode data bits: Mode (0100 for Byte) + Character Count + Payload + Terminator
  const bitBuffer: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(bytes.length, 8); // 8-bit character count indicator for v1-9
  for (const b of bytes) {
    pushBits(b, 8);
  }
  // Terminator
  const maxBits = v.data * 8;
  const termLen = Math.min(4, maxBits - bitBuffer.length);
  pushBits(0, termLen);
  // Pad to byte
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0);
  }
  // Pad bytes
  const padPatterns = [0xec, 0x11];
  let pIdx = 0;
  while (bitBuffer.length < maxBits) {
    pushBits(padPatterns[pIdx % 2], 8);
    pIdx++;
  }

  // Convert bitBuffer to data bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bitBuffer[i + j];
    }
    dataBytes.push(byte);
  }

  // Calculate EC bytes
  const ecBytes = calculateReedSolomon(dataBytes, v.ec);
  const fullCodewords = [...dataBytes, ...ecBytes];

  // Initialize matrix
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );

  // Place Finder Patterns (7x7) + Separators
  const placeFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack =
          r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        matrix[r0 + r][c0 + c] = isBlack;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Separators
  for (let i = 0; i < 8; i++) {
    if (i < size) {
      if (matrix[7][i] === null) matrix[7][i] = false;
      if (matrix[i][7] === null) matrix[i][7] = false;
      if (matrix[7][size - 1 - i] === null) matrix[7][size - 1 - i] = false;
      if (matrix[i][size - 8] === null) matrix[i][size - 8] = false;
      if (matrix[size - 8][i] === null) matrix[size - 8][i] = false;
      if (matrix[size - 1 - i][7] === null) matrix[size - 1 - i][7] = false;
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[4 * v.version + 9][8] = true;

  // Reserved format info areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }

  // Alignment patterns for v2+
  if (v.version >= 2) {
    const pos = [6, v.size - 7];
    for (const r of pos) {
      for (const c of pos) {
        if (matrix[r][c] !== null) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            matrix[r + dr][c + dc] =
              Math.max(Math.abs(dr), Math.abs(dc)) === 2 || (dr === 0 && dc === 0);
          }
        }
      }
    }
  }

  // Place codewords in zig-zag
  const allBits: number[] = [];
  for (const byte of fullCodewords) {
    for (let i = 7; i >= 0; i--) {
      allBits.push((byte >> i) & 1);
    }
  }

  let bitIdx = 0;
  let dir = -1; // up
  let c = size - 1;
  while (c > 0) {
    if (c === 6) c--; // Skip vertical timing column
    const rStart = dir === -1 ? size - 1 : 0;
    const rEnd = dir === -1 ? -1 : size;
    for (let r = rStart; r !== rEnd; r += dir === -1 ? -1 : 1) {
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = c - colOffset;
        if (matrix[r][col] === null) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Mask 0: (r + col) % 2 === 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = (bit ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    dir = -dir;
    c -= 2;
  }

  // Format Information (Mask 0, Error Level M: 00)
  // Format bit string for EC M + Mask 0: 101010000010010 (BCH 15,5 code)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix.map((row) => row.map((cell) => cell === true));
}

export function generateQrSvg(text: string, options: { size?: number; fill?: string; bg?: string } = {}): string {
  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const padding = 2;
  const total = matrixSize + padding * 2;
  const displaySize = options.size || 200;
  const fill = options.fill || '#111110';
  const bg = options.bg || '#F7F5F0';

  let rects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + padding}" y="${r + padding}" width="1" height="1" fill="${fill}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${displaySize}" height="${displaySize}" shape-rendering="crispEdges">
    <rect width="${total}" height="${total}" fill="${bg}"/>
    ${rects}
  </svg>`;
}
