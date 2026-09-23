import fs from 'fs';
import path from 'path';

const contentPath = 'C:\\Users\\Baigo\\.gemini\\antigravity-ide\\brain\\9f1fe5b9-d7e3-44db-a6cb-76af064ad67d\\.system_generated\\steps\\180\\content.md';
const content = fs.readFileSync(contentPath, 'utf8');

// Find <body> and <script type="module">
const bodyStart = content.indexOf('<body>');
const scriptStart = content.indexOf('<script type="module">');

if (bodyStart === -1 || scriptStart === -1) {
  console.error('Could not find body or script tag in content.md');
  process.exit(1);
}

let markup = content.slice(bodyStart + '<body>'.length, scriptStart).trim();

// Replace relative assets/ with /assets/
markup = markup.replace(/src=["']assets\//g, 'src="/assets/');

// 1. Sound Toggle in hdr-right
const soundButton = '<button type="button" class="hdr-sound" id="sound-toggle" aria-label="Toggle café audio" data-iv="print" data-d="520" style="clip-path:inset(0 100% 0 0)"><span class="hdr-sound-bars" aria-hidden="true"><span></span><span></span><span></span></span><span id="sound-label">SOUND</span></button>';
markup = markup.replace(
  '<div class="hdr-right">',
  `<div class="hdr-right">${soundButton}`
);

// 2. Taste Calibrator button in shop-head
const calibratorBtn = '<div style="margin-top: 1.25rem; display: flex; align-items: center; gap: 1rem;"><button type="button" class="btn btn-line" id="open-calibrator" style="height: 2.75rem; font-size: 0.8125rem; padding-inline: 1rem;"><span>FIND YOUR POUR · TASTE QUIZ</span><span aria-hidden="true">→</span></button></div>';
markup = markup.replace(
  'ORDER AHEAD AND PICK UP AT ANY OF OUR THREE COUNTERS.</p>',
  `ORDER AHEAD AND PICK UP AT ANY OF OUR THREE COUNTERS.</p>${calibratorBtn}`
);

// 3. Live wait status badges in locations
markup = markup.replace(
  '<span class="blk">139 Coffee Street</span><span class="blk">San Francisco, CA</span>',
  '<span class="blk">139 Coffee Street</span><span class="blk">San Francisco, CA</span><span class="loc-badge" id="loc-status-0">● LIVE WAIT: ~4 MIN</span>'
);
markup = markup.replace(
  '<span class="blk">310 Valencia Street</span><span class="blk">San Francisco, CA</span>',
  '<span class="blk">310 Valencia Street</span><span class="blk">San Francisco, CA</span><span class="loc-badge" id="loc-status-1">● LIVE WAIT: ~3 MIN</span>'
);
markup = markup.replace(
  '<span class="blk">56 Columbus Avenue</span><span class="blk">San Francisco, CA</span>',
  '<span class="blk">56 Columbus Avenue</span><span class="blk">San Francisco, CA</span><span class="loc-badge" id="loc-status-2">● LIVE WAIT: ~5 MIN</span>'
);

// 4. Tear handle in order receipt
markup = markup.replace(
  '<svg aria-hidden="true" width="328" height="9" viewBox="0 0 328 9" preserveAspectRatio="none" style="display:block"><path id="torn" fill="#F2F0EA"/></svg>',
  '<svg aria-hidden="true" width="328" height="9" viewBox="0 0 328 9" preserveAspectRatio="none" style="display:block"><path id="torn" fill="#F2F0EA"/></svg><div class="receipt-tear-handle" id="tear-handle">↓ DRAG DOWN TO TEAR OFF ↓</div>'
);

const output = `export const BREWNS_MARKUP = ${JSON.stringify(markup)};\n`;

fs.writeFileSync('components/brewns/brewnsMarkup.ts', output);
console.log('Successfully wrote components/brewns/brewnsMarkup.ts, length:', output.length);

