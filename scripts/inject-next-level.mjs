import fs from 'fs';

let content = fs.readFileSync('components/brewns/initBrewns.ts', 'utf8');

// 1. Add imports at the top
const audioImports = `import {
  initAudioState,
  toggleAudioState,
  getIsAudioEnabled,
  playCupClink,
  playBeanClatter,
  playPaperFeed,
  playPaperTear,
  playPourDrop,
  playSoftClick,
  triggerHaptic
} from '@/lib/audio-ritual';
import { TasteCalibrator } from './TasteCalibrator';
`;

content = content.replace(
  "import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';",
  `import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';\n${audioImports}`
);

// 2. Add Audio state & Header Sound toggle initialization near applyGrid()
const soundInitCode = `
/* ═══════════ Audio Immersion & Header Sound Toggle ═══════════ */
initAudioState();
const soundBtn = $("#sound-toggle");
const soundLabel = $("#sound-label");
const updateSoundUI = () => {
  const on = getIsAudioEnabled();
  soundBtn?.classList.toggle("active", on);
  if (soundLabel) soundLabel.textContent = on ? "SOUND: ON" : "SOUND";
};
updateSoundUI();
soundBtn?.addEventListener("click", () => {
  toggleAudioState();
  updateSoundUI();
});

/* ═══════════ Liquid Pour Droplet Fly-in ═══════════ */
const flyLiquidDrop = (fromElement) => {
  if (!fromElement) return;
  const startRect = fromElement.getBoundingClientRect();
  const targetRect = $("#bag-count")?.getBoundingClientRect() || $("#bag-open")?.getBoundingClientRect();
  if (!targetRect) return;

  const drop = document.createElement("div");
  drop.className = "pour-drop";
  document.body.appendChild(drop);

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const startTime = performance.now();
  const duration = 600;

  const animateDrop = (now) => {
    const elapsed = now - startTime;
    const p = Math.min(1, elapsed / duration);
    const arcHeight = Math.min(120, Math.abs(targetX - startX) * 0.25 + 50);
    const currX = startX + (targetX - startX) * p;
    const currY = startY + (targetY - startY) * p - Math.sin(p * Math.PI) * arcHeight;

    drop.style.left = \`\${currX}px\`;
    drop.style.top = \`\${currY}px\`;
    drop.style.transform = \`translate(-50%, -50%) scale(\${1 - p * 0.3})\`;

    if (p < 1) {
      requestAnimationFrame(animateDrop);
    } else {
      drop.remove();
      playPourDrop();
      countBump.set({ scale: 1.5 });
      countBump.start({ scale: 1 }, { config: C(300, 14) });
    }
  };
  requestAnimationFrame(animateDrop);
};

/* ═══════════ Live Location Counter Wait Times ═══════════ */
const updateLiveLocations = () => {
  const now = new Date();
  const sfTimeStr = now.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour12: false, hour: "numeric", minute: "numeric" });
  const [h, m] = sfTimeStr.split(":").map(Number);
  const currentMin = h * 60 + m;

  let b0 = "● STEADY BREW · ~4 MIN";
  let b1 = "● STEADY BREW · ~3 MIN";
  let b2 = "● STEADY BREW · ~5 MIN";

  if (currentMin < 7 * 60 || currentMin >= 21 * 60) {
    b0 = "○ CLOSED · OPENS 07:00";
    b1 = "○ CLOSED · OPENS 07:00";
    b2 = "○ CLOSED · OPENS 07:00";
  } else if (currentMin >= 7 * 60 && currentMin <= 9 * 60 + 30) {
    b0 = "● MORNING PEAK · ~7 MIN";
    b1 = "● MORNING PEAK · ~6 MIN";
    b2 = "● MORNING PEAK · ~8 MIN";
  } else if (currentMin >= 12 * 60 && currentMin <= 13 * 60 + 45) {
    b0 = "● MIDDAY RUSH · ~5 MIN";
    b1 = "● MIDDAY RUSH · ~4 MIN";
    b2 = "● MIDDAY RUSH · ~6 MIN";
  }

  const el0 = $("#loc-status-0");
  const el1 = $("#loc-status-1");
  const el2 = $("#loc-status-2");
  if (el0) el0.textContent = b0;
  if (el1) el1.textContent = b1;
  if (el2) el2.textContent = b2;
};
updateLiveLocations();
setInterval(updateLiveLocations, 30000);
`;

content = content.replace(
  'window.addEventListener("resize", applyGrid);',
  `window.addEventListener("resize", applyGrid);\n${soundInitCode}`
);

// 3. Connect audio clink in hero model raycast hover
content = content.replace(
  'onPiece?.(next?.role ?? null);',
  'onPiece?.(next?.role ?? null); if (next) playCupClink(next.role === "bag" ? 0.9 : 1.2);'
);

// 4. Connect bean field clatter in philosophy scene on pointer movement
content = content.replace(
  'world.pointer.active = true;',
  'world.pointer.active = true; if (Math.random() < 0.15) playBeanClatter();'
);

// 5. Connect paper feed ratchet when receipt feeds
content = content.replace(
  'paper.style.setProperty("--p", String(p));',
  'paper.style.setProperty("--p", String(p)); if (p > 0.1 && p < 0.95 && Math.random() < 0.25) playPaperFeed();'
);

// 6. Connect Taste Calibrator and Tear Handle in shop & order
const nextLevelShopOrder = `
/* ═══════════ Taste Calibrator & Receipt Tear Gesture ═══════════ */
const calibrator = new TasteCalibrator(
  (productId) => {
    quickAdd(productId);
  },
  (productId) => {
    openProduct(productId);
  }
);
$("#open-calibrator")?.addEventListener("click", () => calibrator.open());

const initReceiptTear = () => {
  const handle = $("#tear-handle");
  const paperEl = $("#paper");
  if (!handle || !paperEl) return;

  let startY = 0;
  let isDragging = false;
  let isTorn = false;

  handle.addEventListener("pointerdown", (e) => {
    if (isTorn) return;
    isDragging = true;
    startY = e.clientY;
    try { handle.setPointerCapture(e.pointerId); } catch {}
  });

  handle.addEventListener("pointermove", (e) => {
    if (!isDragging || isTorn) return;
    const dy = Math.max(0, e.clientY - startY);
    paperEl.style.transform = \`translate3d(0, \${dy * 0.5}px, 0)\`;
    if (dy > 65) {
      isTorn = true;
      isDragging = false;
      playPaperTear();
      paperEl.classList.add("torn-state");
      handle.textContent = "✓ RECEIPT TORN / COLLECTED";
      setTimeout(() => {
        paperEl.classList.remove("torn-state");
        paperEl.style.transform = "";
        isTorn = false;
        handle.textContent = "↓ DRAG DOWN TO TEAR OFF ↓";
      }, 3500);
    }
  });

  const onEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (!isTorn) paperEl.style.transform = "";
    try { handle.releasePointerCapture(e.pointerId); } catch {}
  };
  handle.addEventListener("pointerup", onEnd);
  handle.addEventListener("pointercancel", onEnd);
};
setTimeout(initReceiptTear, 1000);
`;

content = content.replace(
  'window.addEventListener("popstate", routeFromHash);',
  `window.addEventListener("popstate", routeFromHash);\n${nextLevelShopOrder}`
);

// 7. Connect liquid droplet fly-in to quickAdd and tab clicks
content = content.replace(
  'const quickAdd = (id, btn) => {',
  'const quickAdd = (id, btn) => { if (btn) flyLiquidDrop(btn); else playPourDrop();'
);
content = content.replace(
  'const setFilter = (cat) => {',
  'const setFilter = (cat) => { playSoftClick();'
);

fs.writeFileSync('components/brewns/initBrewns.ts', content);
console.log('Successfully injected next-level features into initBrewns.ts');
