import fs from 'fs';

let content = fs.readFileSync('components/brewns/brewnsMarkup.ts', 'utf8');

// 1. Add Sound Toggle into hdr-right
const soundButton = `<button type="button" class="hdr-sound" id="sound-toggle" aria-label="Toggle café audio" data-iv="print" data-d="520" style="clip-path:inset(0 100% 0 0)"><span class="hdr-sound-bars" aria-hidden="true"><span></span><span></span><span></span></span><span id="sound-label">SOUND</span></button>`;
content = content.replace(
  '<div class=\\"hdr-right\\">',
  `<div class=\\"hdr-right\\">${soundButton}`
);

// 2. Add Taste Calibrator button into shop-head
const calibratorBtn = `<div style=\\"margin-top: 1.25rem; display: flex; align-items: center; gap: 1rem;\\"><button type=\\"button\\" class=\\"btn btn-line\\" id=\\"open-calibrator\\" style=\\"height: 2.75rem; font-size: 0.8125rem; padding-inline: 1rem;\\"><span>FIND YOUR POUR · TASTE QUIZ</span><span aria-hidden=\\"true\\">→</span></button></div>`;
content = content.replace(
  'ORDER AHEAD AND PICK UP AT ANY OF OUR THREE COUNTERS.</p>\\n  </div>',
  `ORDER AHEAD AND PICK UP AT ANY OF OUR THREE COUNTERS.</p>${calibratorBtn}\\n  </div>`
);

// 3. Add live status badges to locations
content = content.replace(
  '<span class=\\"blk\\">139 Coffee Street</span><span class=\\"blk\\">San Francisco, CA</span>',
  '<span class=\\"blk\\">139 Coffee Street</span><span class=\\"blk\\">San Francisco, CA</span><span class=\\"loc-badge\\" id=\\"loc-status-0\\">● LIVE WAIT: ~4 MIN</span>'
);
content = content.replace(
  '<span class=\\"blk\\">310 Valencia Street</span><span class=\\"blk\\">San Francisco, CA</span>',
  '<span class=\\"blk\\">310 Valencia Street</span><span class=\\"blk\\">San Francisco, CA</span><span class=\\"loc-badge\\" id=\\"loc-status-1\\">● LIVE WAIT: ~3 MIN</span>'
);
content = content.replace(
  '<span class=\\"blk\\">56 Columbus Avenue</span><span class=\\"blk\\">San Francisco, CA</span>',
  '<span class=\\"blk\\">56 Columbus Avenue</span><span class=\\"blk\\">San Francisco, CA</span><span class=\\"loc-badge\\" id=\\"loc-status-2\\">● LIVE WAIT: ~5 MIN</span>'
);

// 4. Add tear handle to the order receipt
content = content.replace(
  '<svg aria-hidden=\\"true\\" width=\\"328\\" height=\\"9\\" viewBox=\\"0 0 328 9\\" preserveAspectRatio=\\"none\\" style=\\"display:block\\"><path id=\\"torn\\" fill=\\"#F2F0EA\\"/></svg>',
  '<svg aria-hidden=\\"true\\" width=\\"328\\" height=\\"9\\" viewBox=\\"0 0 328 9\\" preserveAspectRatio=\\"none\\" style=\\"display:block\\"><path id=\\"torn\\" fill=\\"#F2F0EA\\"/></svg><div class=\\"receipt-tear-handle\\" id=\\"tear-handle\\">↓ DRAG DOWN TO TEAR OFF ↓</div>'
);

fs.writeFileSync('components/brewns/brewnsMarkup.ts', content);
console.log('Successfully updated brewnsMarkup.ts');
