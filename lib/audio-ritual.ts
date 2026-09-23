/**
 * brewns Audio-Tactile Immersion Engine
 * Uses Web Audio API synthesis for zero-latency, zero-asset café sounds
 * plus native mobile haptic feedback.
 */

let audioCtx: AudioContext | null = null;
let isAudioEnabled = false;

// Initialize on first user gesture
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function initAudioState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem('brewns-audio-enabled');
    isAudioEnabled = saved === 'true';
  } catch {
    isAudioEnabled = false;
  }
  return isAudioEnabled;
}

export function toggleAudioState(): boolean {
  isAudioEnabled = !isAudioEnabled;
  if (isAudioEnabled) {
    getAudioContext();
    playSoftClick();
  }
  try {
    localStorage.setItem('brewns-audio-enabled', String(isAudioEnabled));
  } catch {}
  return isAudioEnabled;
}

export function getIsAudioEnabled(): boolean {
  return isAudioEnabled;
}

/**
 * Mobile Haptic feedback (10-15ms gentle tap)
 */
export function triggerHaptic(duration = 12) {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {}
  }
}

/**
 * Ceramic Cup Clink
 * Resonant high frequencies simulating porcelain/ceramic contact
 */
export function playCupClink(pitchMultiplier = 1.0) {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.09, now);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  master.connect(ctx.destination);

  // Fundamental frequency
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1760 * pitchMultiplier, now); // A6
  osc1.connect(master);
  osc1.start(now);
  osc1.stop(now + 0.35);

  // Overtone resonance
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2640 * pitchMultiplier, now); // E7
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.04, now);
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc2.connect(g2);
  g2.connect(master);
  osc2.start(now);
  osc2.stop(now + 0.25);
}

/**
 * Coffee Bean Clatter
 * Micro noise burst simulating roasted bean tumbling/clatter
 */
export function playBeanClatter() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.05; // 50ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200 + Math.random() * 800, now);
  filter.Q.setValueAtTime(3, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * Thermal Printer Stepper Motor Feed
 */
export function playPaperFeed() {
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.03);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.03);
}

/**
 * Paper Tear Sound
 * Bandpassed decaying noise burst simulating tearing receipt paper
 */
export function playPaperTear() {
  triggerHaptic(25);
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.18);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const p = i / bufferSize;
    // Granular modulated noise
    const mod = Math.sin(p * 50) * 0.3 + 0.7;
    data[i] = (Math.random() * 2 - 1) * mod * Math.exp(-p * 3.5);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2400, now);
  filter.frequency.linearRampToValueAtTime(1200, now + 0.18);
  filter.Q.setValueAtTime(1.5, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
}

/**
 * Liquid Drop / Pour Sound
 * Resonant descending droplet when adding coffee to bag
 */
export function playPourDrop() {
  triggerHaptic(15);
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/**
 * Subtle Muted Switch / Tab Click
 */
export function playSoftClick() {
  triggerHaptic(8);
  if (!isAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(540, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.035, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.02);
}
