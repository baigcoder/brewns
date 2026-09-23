import fs from 'fs';

const cssToAdd = `
/* ═══════════ Next-Level Sound Toggle in Header ═══════════ */
.hdr-sound {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid currentColor;
  border-radius: 9999px;
  font-family: var(--font-space-mono);
  font-size: var(--font-size-fine);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  transition: opacity var(--duration-fast), background-color var(--duration-fast), color var(--duration-fast);
  cursor: pointer;
}
.hdr-sound:hover { opacity: 0.8; }
.hdr-sound.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #070707 !important;
}
.hdr-sound-bars {
  display: flex;
  align-items: center;
  gap: 1.5px;
  height: 9px;
}
.hdr-sound-bars span {
  display: block;
  width: 1.5px;
  height: 100%;
  background: currentColor;
  transform-origin: bottom center;
}
.hdr-sound.active .hdr-sound-bars span:nth-child(1) { animation: soundEq 0.6s ease-in-out infinite alternate; }
.hdr-sound.active .hdr-sound-bars span:nth-child(2) { animation: soundEq 0.8s ease-in-out infinite alternate 0.2s; }
.hdr-sound.active .hdr-sound-bars span:nth-child(3) { animation: soundEq 0.5s ease-in-out infinite alternate 0.4s; }
@keyframes soundEq {
  0% { transform: scaleY(0.2); }
  100% { transform: scaleY(1); }
}

/* ═══════════ Calibrator Modal ═══════════ */
.calibrator-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(7, 7, 7, 0.82);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
.calibrator-dialog {
  position: relative;
  width: 100%;
  max-width: 34rem;
  background: #0E0D0C;
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: 2.5rem 2rem 2rem;
  color: #fff;
  box-shadow: 0 2rem 4rem rgba(0, 0, 0, 0.75);
}
.calibrator-dialog .calibrator-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  --x-bg: #0E0D0C;
}
.calibrator-title {
  font-family: var(--font-geist);
  font-weight: 700;
  font-size: 2rem;
  line-height: 1;
  letter-spacing: var(--letter-spacing-tight);
  text-transform: uppercase;
  margin-top: 0.5rem;
  margin-bottom: 0.35rem;
}
.calibrator-options {
  margin-top: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.calibrator-opt-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.02);
  text-align: left;
  transition: border-color 200ms, background-color 200ms;
}
.calibrator-opt-card:hover {
  border-color: #fff;
  background: rgba(255, 255, 255, 0.06);
}
.calibrator-opt-name {
  display: block;
  font-family: var(--font-geist);
  font-weight: 700;
  font-size: 1rem;
  text-transform: uppercase;
  color: #fff;
}
.calibrator-opt-desc {
  display: block;
  font-family: var(--font-space-mono);
  font-size: var(--font-size-fine);
  color: rgba(255, 255, 255, 0.55);
  margin-top: 0.2rem;
}
.calibrator-opt-arrow {
  font-size: 1.25rem;
  color: var(--accent);
  transition: transform 200ms;
}
.calibrator-opt-card:hover .calibrator-opt-arrow {
  transform: translateX(4px);
}
.calibrator-footer {
  margin-top: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1rem;
}
.calibrator-dots {
  display: flex;
  gap: 0.5rem;
}
.calibrator-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.2);
  transition: background-color 200ms;
}
.calibrator-dot.active {
  background: var(--accent);
}
.calibrator-result-card {
  margin-top: 1.5rem;
  padding: 1.5rem;
  border: 1px solid rgba(213, 140, 61, 0.35);
  background: rgba(213, 140, 61, 0.04);
}

/* ═══════════ Interactive Receipt Tear Gesture ═══════════ */
.paper.torn-state {
  animation: receiptTearSnap 0.6s cubic-bezier(0.2, 0, 0, 1) forwards;
}
@keyframes receiptTearSnap {
  0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
  40% { transform: translate3d(0, 30px, 0) rotate(2deg); opacity: 0.9; }
  100% { transform: translate3d(0, 150px, 0) rotate(6deg); opacity: 0; pointer-events: none; }
}
.receipt-tear-handle {
  cursor: grab;
  padding: 0.5rem;
  text-align: center;
  font-family: var(--font-space-mono);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #666;
  border-top: 1px dashed rgba(17, 17, 17, 0.25);
  margin-top: 0.5rem;
  user-select: none;
  touch-action: none;
  transition: color 200ms, background-color 200ms;
}
.receipt-tear-handle:hover {
  color: #111;
  background: rgba(0, 0, 0, 0.04);
}
.receipt-tear-handle:active {
  cursor: grabbing;
}

/* ═══════════ Liquid Pour Droplet Fly-in ═══════════ */
.pour-drop {
  position: fixed;
  z-index: 150;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

/* ═══════════ Live Location Counter Badges ═══════════ */
.loc-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  font-family: var(--font-space-mono);
  font-size: var(--font-size-fine);
  letter-spacing: var(--letter-spacing-label);
  color: var(--accent);
}
`;

fs.appendFileSync('app/globals.css', cssToAdd);
console.log('Successfully appended styles to app/globals.css');
