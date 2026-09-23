import fs from 'fs';
import path from 'path';

const contentPath = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\9f1fe5b9-d7e3-44db-a6cb-76af064ad67d\\.system_generated\\steps\\180\\content.md';
const content = fs.readFileSync(contentPath, 'utf8');

// Find <script type="module"> and </script>
const scriptStart = content.indexOf('<script type="module">');
const scriptEnd = content.indexOf('</script>', scriptStart);

if (scriptStart === -1 || scriptEnd === -1) {
  console.error('Could not find script tag in content.md');
  process.exit(1);
}

let scriptCode = content.slice(scriptStart + '<script type="module">'.length, scriptEnd).trim();

// Remove `import Lenis from "lenis";` since we will put imports at the top of the file
scriptCode = scriptCode.replace(/import Lenis from ["']lenis["'];?/, '');

// Replace asset constants
scriptCode = scriptCode.replace(/const ASSET_BASE_URL = ["']assets\/["'];/, 'const ASSET_BASE_URL = "/assets/";');
scriptCode = scriptCode.replace(
  /const DRACO_PATH = ["'][^"']+["'];/,
  'const DRACO_PATH = "/draco/gltf/";'
);

// Replace dynamic imports of three with direct imports
const threePromiseRegex = /const threeReady = Promise\.all\(\[[^\]]+\]\)\.then\([^)]+\) => \(\{ \.\.\.THREE, GLTFLoader, DRACOLoader, RoomEnvironment \}\)\);/;
scriptCode = scriptCode.replace(
  threePromiseRegex,
  'const threeReady = Promise.resolve({ ...THREE, GLTFLoader, DRACOLoader, RoomEnvironment });'
);

const headerImports = `// @ts-nocheck
'use client';

import Lenis from 'lenis';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function initBrewns(container: HTMLElement = document.body) {
  if (typeof window === 'undefined') return () => {};
`;

const footerExports = `
  return () => {
    try {
      lenis?.destroy();
      cancelAnimationFrame(tickRaf);
    } catch {}
  };
}
`;

// Also wrap the RAF in a stoppable variable
scriptCode = scriptCode.replace(
  'requestAnimationFrame(tick);',
  'let tickRaf = requestAnimationFrame(tick);'
);
scriptCode = scriptCode.replace(
  'requestAnimationFrame(tick);',
  'tickRaf = requestAnimationFrame(tick);'
);

const fullTs = headerImports + '\n' + scriptCode + '\n' + footerExports;

fs.mkdirSync('components/brewns', { recursive: true });
fs.writeFileSync('components/brewns/initBrewns.ts', fullTs);
console.log('Successfully wrote components/brewns/initBrewns.ts, length:', fullTs.length);
