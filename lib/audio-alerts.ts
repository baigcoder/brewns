/**
 * Web Audio API synthesizer for console operational sound alerts.
 * Generates natural chimes and service bell rings with zero external asset dependencies.
 */

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Pleasant two-tone kitchen chime for new tickets (KDS)
 */
export function playKitchenChime() {
  try {
    const ctx = getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: A5 (880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Tone 2: D6 (1174.66 Hz) slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.85);
  } catch {}
}

/**
 * High-pitched crisp service bell for table waiter calls
 */
export function playWaiterBell() {
  try {
    const ctx = getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Fundamental strike: 2489 Hz (D#7)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2489, now);

    // Shimmer harmonic: 4978 Hz
    const oscHarmonic = ctx.createOscillator();
    const gainHarmonic = ctx.createGain();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(4978, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    gainHarmonic.gain.setValueAtTime(0.15, now);
    gainHarmonic.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    oscHarmonic.connect(gainHarmonic);
    gain.connect(ctx.destination);
    gainHarmonic.connect(ctx.destination);

    osc.start(now);
    oscHarmonic.start(now);
    osc.stop(now + 1.2);
    oscHarmonic.stop(now + 0.7);
  } catch {}
}

/**
 * Success confirmation chime for timer milestones or reservation approvals
 */
export function playSuccessChime() {
  try {
    const ctx = getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const time = now + i * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.5);
    });
  } catch {}
}
