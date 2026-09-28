'use client';

/* The AI voice call, in the browser.

   It behaves like a phone call rather than a walkie-talkie:
   - hands-free: when Sarah / Hamza finishes a sentence the mic opens by itself,
     and it sends what you said once you pause, so you just talk;
   - you can interrupt: speak over the voice and it stops to listen (a level
     meter on an echo-cancelled mic, so it doesn't hear itself);
   - it thinks out loud a little: the wave pulses while the reply is on its way;
   - it always has a voice: ElevenLabs, streamed so it starts speaking as soon
     as the first words are ready, or the browser's own speech otherwise.
   - it speaks your language: talk in Urdu and it listens and answers in Urdu,
     switch to English and it follows (or pick EN / اردو on the call);
   The mic button mutes and unmutes; the keypad, typing and the quick chips
   still work. A ringback tone plays while the line connects. */

export interface VoiceCallingDeps {
  cart: {
    add: (id: string, sel: Record<string, number>, qty?: number, message?: string) => void;
    count: () => number;
  };
  productById: (id: string) => any;
  defaultSel: (product: any) => Record<string, number>;
  openBag: () => void;
  toast: (msg: string, actionLabel?: string, onAction?: () => void) => void;
  playChime?: () => void;
  playSoftClick?: () => void;
  triggerHaptic?: (ms?: number) => void;
}

type Phase = 'idle' | 'connecting' | 'speaking' | 'listening' | 'thinking' | 'muted';
type Turn = { role: 'user' | 'assistant'; content: string };
type Action = { type: string; data?: any };

/** How long a pause means "I'm done talking", after some words have come in. */
const END_OF_SPEECH_MS = 900;
/** Mic level (RMS, 0..1) and how long it must hold to count as talking over the voice. */
const BARGE_IN_LEVEL = 0.06;
const BARGE_IN_MS = 280;
/** True on iOS / iPadOS / Android – these need extra care for AudioContext & getUserMedia. */
const IS_MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function initVoiceCalling({ cart, productById, defaultSel, openBag, toast, playChime, playSoftClick, triggerHaptic }: VoiceCallingDeps) {
  if (typeof window === 'undefined') return () => {};

  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const modal = $('voice-call-modal');
  if (!modal) return () => {};

  const timerEl = $('voice-call-timer');
  const voiceCurrentEl = $('vc-voice-current');
  const agentTitleEl = $('vc-agent-title');
  const agentSubtitleEl = $('vc-agent-subtitle');
  const avatarRing = $('vc-avatar-ring');
  const avatarPulse = $('vc-avatar-pulse');
  const avatarContainer = $('vc-avatar-container');
  const avatarMono = $('vc-avatar-mono');
  const inputRow = $('voice-input-row');
  const soundwave = $('voice-soundwave');
  const captionBox = $('voice-caption-box');
  const captionStatus = $('voice-caption-status');
  const captionText = $('voice-caption-text');
  const unblockActions = $('voice-unblock-actions');
  const unblockBtn = $('voice-unblock-btn');
  const typeModeBtn = $('voice-type-mode-btn');
  const textInput = $<HTMLInputElement>('voice-text-input');
  const micToggleBtn = $('voice-mic-toggle');
  const micLabel = $('voice-mic-label');

  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const ac = new AbortController();
  const on = (el: EventTarget | null, ev: string, fn: (e: any) => void) => el?.addEventListener(ev, fn, { signal: ac.signal });

  let callActive = false;
  let phase: Phase = 'idle';
  let muted = false;
  let gender: 'female' | 'male' = 'female';
  /** The language the line listens in; follows the caller, or the EN / اردو switch. */
  let lang: 'en' | 'ur' = 'en';
  const langBtn = $('vc-lang-toggle');
  let history: Turn[] = [];
  let scriptState: unknown = {};
  let hangUpAfterSpeech = false;
  /** Names this call in the café's call log, so the dashboard can follow it live. */
  let callId = '';
  /** Bumped on every new turn, hang-up or interruption; late replies for an old turn are dropped. */
  let turnId = 0;

  let timer: ReturnType<typeof setInterval> | undefined;
  let seconds = 0;

  let recognition: any = null;
  let heard = '';
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  /** Counts rapid listen() restarts – prevents tight no-speech loops on mobile. */
  let listenRestartCount = 0;
  let listenRestartResetTimer: ReturnType<typeof setTimeout> | undefined;
  /** Tracks the last time recognition.onend fired – guards against instant-end loop. */
  let lastOnEndTs = 0;
  /** How many times RETRY MICROPHONE has been pressed this call without success. */
  let micRetryCount = 0;
  /** Live watcher: fires the instant the browser flips mic permission to 'granted'. */
  let permissionWatcher: { status: PermissionStatus | null; cleanup: () => void } | null = null;

  let audioEl: HTMLAudioElement | null = null;
  let utterance: SpeechSynthesisUtterance | null = null;

  let micStream: MediaStream | null = null;
  let meterCtx: AudioContext | null = null;
  let meterRaf = 0;

  const agent = () => (gender === 'female' ? 'Sarah' : 'Hamza');

  /* ── what the screen says ── */

  function setPhase(next: Phase, status?: string) {
    phase = next;
    soundwave?.classList.toggle('speaking', next === 'speaking');
    soundwave?.classList.toggle('thinking', next === 'thinking' || next === 'connecting');
    soundwave?.classList.toggle('listening', next === 'listening');
    avatarRing?.classList.toggle('active', next === 'speaking');
    avatarPulse?.classList.toggle('active', next === 'speaking');
    avatarContainer?.classList.toggle('speaking', next === 'speaking');
    modal!.dataset.phase = next;
    const label =
      status ||
      { idle: 'READY', connecting: 'DIALING DIRECT LINE…', speaking: `${agent().toUpperCase()} ON LINE`, listening: 'LISTENING…', thinking: `${agent().toUpperCase()} IS THINKING…`, muted: 'MIC MUTED' }[next];
    if (captionStatus) captionStatus.textContent = label;
    if (next === 'listening') {
      unblockActions?.setAttribute('hidden', '');
      captionBox?.classList.remove('mic-alert');
    }
    updateMicUI();
  }

  function caption(text: string, who: 'agent' | 'you' = 'agent') {
    if (!captionText) return;
    captionText.dir = /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr';
    captionText.textContent = who === 'you' ? `You: “${text}”` : text;
  }

  function updateMicUI() {
    const live = phase === 'listening';
    micToggleBtn?.classList.toggle('active', live);
    micToggleBtn?.classList.toggle('muted', muted || !SpeechRec);
    micToggleBtn?.setAttribute('aria-pressed', String(!muted));
    if (micLabel) {
      micLabel.textContent = !SpeechRec
        ? 'USE KEYPAD'
        : phase === 'listening'
        ? 'LISTENING…'
        : phase === 'connecting'
        ? 'CONNECTING…'
        : 'SPEAK LIVE';
    }
  }

  function tick() {
    seconds++;
    if (timerEl) timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  /* ── speaking ── */

  function stopSpeaking() {
    if (audioEl) {
      audioEl.onended = audioEl.onerror = null;
      audioEl.pause();
      audioEl = null;
    }
    if (utterance) {
      utterance.onend = utterance.onerror = null;
      utterance = null;
      try {
        speechSynthesis.cancel();
      } catch {}
    }
    stopMeter();
  }

  function pickBrowserVoice(urdu = false): SpeechSynthesisVoice | null {
    if (urdu) return speechSynthesis.getVoices().find((v) => /^ur/i.test(v.lang)) || null;
    const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) return null;
    const female = /female|samantha|victoria|karen|moira|tessa|serena|zira|aria|jenny|sonia|libby|google uk english female|google us english/i;
    const male = /male|daniel|alex|fred|oliver|arthur|george|guy|ryan|david|mark|google uk english male/i;
    const want = gender === 'female' ? female : male;
    return voices.find((v) => want.test(v.name) && !(gender === 'female' && /\bmale\b/i.test(v.name))) || voices.find((v) => /en-(GB|IN|PK)/i.test(v.lang)) || voices[0];
  }

  /** Speak one reply, then carry on the call (listen, or hang up if it said goodbye). */
  function speak(text: string, audioUrl: string | undefined, id: number) {
    stopSpeaking();
    const done = () => {
      if (id !== turnId || !callActive) return;
      audioEl = null;
      utterance = null;
      stopMeter();
      if (hangUpAfterSpeech) return void setTimeout(() => callActive && endCall(), 350);
      listen();
    };
    setPhase('speaking');
    startMeter(id);

    if (audioUrl) {
      const a = new Audio(audioUrl);
      a.preload = 'auto';
      audioEl = a;
      a.onended = done;
      a.onerror = () => speakWithBrowser(text, done);
      a.play().catch(() => speakWithBrowser(text, done));
      return;
    }
    speakWithBrowser(text, done);
  }

  function speakWithBrowser(text: string, done: () => void) {
    audioEl = null;
    if (!('speechSynthesis' in window)) return void setTimeout(done, Math.min(6000, 400 + text.length * 45));
    try {
      speechSynthesis.cancel();
      const urdu = /[\u0600-\u06FF]/.test(text);
      const v = pickBrowserVoice(urdu);
      // No Urdu voice on this device: show the words and carry on rather than mangle them.
      if (urdu && !v) return void setTimeout(done, Math.min(7000, 600 + text.length * 60));
      const u = new SpeechSynthesisUtterance(text);
      if (v) u.voice = v;
      u.lang = v?.lang || (urdu ? 'ur-PK' : 'en-GB');
      u.rate = 1.04;
      u.pitch = gender === 'female' ? 1.05 : 0.95;
      u.onend = done;
      u.onerror = done;
      utterance = u;
      speechSynthesis.speak(u);
    } catch {
      done();
    }
  }

  /* ── line tones ── */

  /** One ring of a Pakistani/US-style PBX ringback: 440 + 480 Hz for about a second. */
  function playRingbackTone(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return resolve();
        const ctx: AudioContext = new Ctx();
        ctx.resume().catch(() => {});
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.85);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.05);
        gain.connect(ctx.destination);
        for (const f of [440, 480]) {
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(f, ctx.currentTime);
          o.connect(gain);
          o.start();
          o.stop(ctx.currentTime + 1.1);
        }
        setTimeout(() => {
          ctx.close().catch(() => {});
          resolve();
        }, 1050);
      } catch {
        resolve();
      }
    });
  }

  function playHangupTone() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      ctx.resume().catch(() => {});
      const o = ctx.createOscillator();
      const gain = ctx.createGain();
      o.frequency.setValueAtTime(380, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      o.connect(gain);
      gain.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
      setTimeout(() => ctx.close().catch(() => {}), 220);
    } catch {}
  }

  /* ── barge-in: hear the caller talk over the voice ── */

  async function ensureMic() {
    // On mobile, streams that report 'live' can be stale after backgrounding – verify by checking
    // all tracks, not just some, and also test that the stream has at least one audio track.
    if (micStream) {
      const tracks = micStream.getAudioTracks();
      const allLive = tracks.length > 0 && tracks.every((t) => t.readyState === 'live' && t.enabled);
      if (allLive) return micStream;
      // Stream is stale – stop old tracks so the hardware is freed before re-acquiring.
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      muted = false;
      return micStream;
    } catch (err: any) {
      console.warn('[brewns-mic] getUserMedia failed:', err?.name, err?.message);
      return null;
    }
  }

  /** Ensure AudioContext is alive; on mobile it must be resumed inside a user-gesture. */
  async function resumeAudioCtx() {
    try {
      if (!meterCtx || meterCtx.state === 'closed') {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        meterCtx = new Ctx();
      }
      if (meterCtx.state === 'suspended') await meterCtx.resume();
    } catch {}
  }

  function startMeter(id: number) {
    if (!micStream || muted) return;
    try {
      // On mobile, meterCtx may have been closed after backgrounding; recreate if needed.
      if (!meterCtx || meterCtx.state === 'closed') {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        meterCtx = new Ctx();
      }
      meterCtx.resume().catch(() => {});
      const src = meterCtx.createMediaStreamSource(micStream);
      const an = meterCtx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let loudSince = 0;
      // Give the voice a moment to start so its first syllable isn't mistaken for the caller.
      const armAt = performance.now() + 450;
      const loop = () => {
        if (id !== turnId || phase !== 'speaking') return src.disconnect();
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        if (now > armAt && rms > BARGE_IN_LEVEL) {
          loudSince ||= now;
          if (now - loudSince > BARGE_IN_MS) {
            src.disconnect();
            interrupt();
            return;
          }
        } else loudSince = 0;
        meterRaf = requestAnimationFrame(loop);
      };
      meterRaf = requestAnimationFrame(loop);
    } catch (e) {
      console.warn('[brewns-mic] startMeter error:', e);
    }
  }

  function stopMeter() {
    cancelAnimationFrame(meterRaf);
  }

  function interrupt() {
    turnId++;
    stopSpeaking();
    hangUpAfterSpeech = false;
    triggerHaptic?.(15);
    listen();
  }

  /* ── listening ── */

  function stopListening() {
    clearTimeout(silenceTimer);
    const r = recognition;
    recognition = null;
    if (r) {
      r.onresult = r.onerror = r.onend = r.onstart = null;
      try {
        r.abort();
      } catch {}
    }
  }

  async function listen() {
    if (!callActive) return;
    if (!SpeechRec || muted) return setPhase(SpeechRec ? 'muted' : 'idle', SpeechRec ? undefined : 'TYPE YOUR REPLY BELOW');
    stopListening();
    heard = '';

    // On first listen, try to acquire the mic if we don't have it yet.
    // This is deferred from call start so the user already sees Sarah's greeting
    // and understands why the browser is asking for mic access.
    if (!micStream || !micStream.getAudioTracks().some((t) => t.readyState === 'live')) {
      // Pre-check: ask the Permissions API whether mic is granted/prompt/denied.
      // If Chrome has cached a 'denied', getUserMedia will fail instantly and silently
      // (no popup) — don't even try, go straight to the type + SPEAK LIVE UI.
      let permState: string | null = null;
      try {
        const ps = await navigator.permissions?.query?.({ name: 'microphone' as any }).catch(() => null);
        permState = ps?.state ?? null;
      } catch {}

      if (permState === 'denied') {
        // Chrome cached a previous denial. getUserMedia from a non-gesture (like this
        // speak-done callback) won't re-prompt. Guide the user to use SPEAK LIVE button
        // (which IS a user gesture and CAN re-prompt on some browsers), or type.
        muted = true;
        setPhase('muted', 'TAP SPEAK LIVE');
        caption(
          IS_MOBILE
            ? 'Tap SPEAK LIVE below to enable your mic, or type your reply in the text box.'
            : 'Tap SPEAK LIVE below to enable your mic, or type your reply in the text box.'
        );
        inputRow?.classList.add('open');
        textInput?.focus();
        return;
      }

      // Permission is 'prompt' or 'granted' — try to acquire the stream.
      setPhase('listening', 'REQUESTING MIC…');
      const got = await ensureMic();
      if (!callActive) return;  // call ended while we were waiting
      if (!got) {
        // getUserMedia failed even though permission wasn't 'denied'.
        // Could be no hardware mic, or user dismissed the prompt just now.
        muted = true;
        setPhase('muted', 'TAP SPEAK LIVE');
        caption('Mic not available right now. Tap SPEAK LIVE to try again, or type your reply below.');
        unblockActions?.removeAttribute('hidden');
        inputRow?.classList.add('open');
        textInput?.focus();
        return;
      }
    }
    setPhase('listening');

    // Rate-limit restarts: after 6 rapid restarts (usually no-speech loops on mobile),
    // back off for 2 seconds so the UI stays responsive and battery isn't drained.
    listenRestartCount++;
    clearTimeout(listenRestartResetTimer);
    listenRestartResetTimer = setTimeout(() => { listenRestartCount = 0; }, 5000);
    if (listenRestartCount > 6) {
      caption('Still listening… speak whenever you\'re ready.', 'agent');
      setTimeout(() => {
        listenRestartCount = 0;
        if (callActive && phase === 'listening' && !muted) listen();
      }, 2000);
      return;
    }

    let r: any;
    try {
      r = new SpeechRec();
    } catch (e) {
      console.warn('[brewns-mic] SpeechRec instantiation error:', e);
      setPhase('muted', 'MIC MUTED');
      return;
    }
    recognition = r;
    // On iOS Safari, continuous mode can cause immediate onend; use non-continuous there.
    r.continuous = !IS_MOBILE;
    r.interimResults = true;
    r.maxAlternatives = 1;
    // en-IN copes with Pakistani English and Roman Urdu; ur-PK writes proper Urdu.
    r.lang = lang === 'ur' ? 'ur-PK' : /^en-(GB|IN|PK|US|AU)/i.test(navigator.language) ? navigator.language : 'en-IN';

    const startedAt = performance.now();

    r.onstart = () => {
      if (recognition !== r) return;
      listenRestartCount = 0; // successful start — reset the rate-limiter
      setPhase('listening');
      caption('Listening… Speak now', 'agent');
    };

    r.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      heard = (finalText + ' ' + interim).replace(/\s+/g, ' ').trim();
      if (!heard) return;
      if (textInput) textInput.value = heard;
      caption(heard + '…', 'you');
      // Wait for a real pause rather than the first "final" chunk, so a caller
      // who stops to think mid-sentence isn't cut off.
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const said = heard;
        stopListening();
        if (said) sendPrompt(said);
      }, interim ? END_OF_SPEECH_MS + 400 : END_OF_SPEECH_MS);
    };

    r.onerror = (event: any) => {
      console.warn('[brewns-mic] Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        muted = true;
        stopListening();
        setPhase('muted', 'MIC BLOCKED');
        caption(
          IS_MOBILE
            ? 'Microphone blocked. Open your browser Settings → Site permissions → Microphone → Allow for this site. Or tap "Type message" below.'
            : 'To enable mic: Tap the 🔒 icon in your address bar → click ⚙️ Site settings → set Microphone to "Allow". Or tap "Type message" below.'
        );
        unblockActions?.removeAttribute('hidden');
        inputRow?.classList.add('open');
        textInput?.focus();
      } else if (event.error === 'no-speech') {
        // Keep listening – but use the rate-limited restart to avoid tight loops on mobile
        if (callActive && phase === 'listening' && !muted) {
          const delay = IS_MOBILE ? 600 : 300;
          setTimeout(() => {
            if (callActive && phase === 'listening' && !muted) listen();
          }, delay);
        }
      } else if (event.error === 'audio-capture' || event.error === 'network') {
        // No mic, or the browser's speech service is unreachable
        muted = true;
        stopListening();
        setPhase('muted', event.error === 'network' ? 'VOICE INPUT OFFLINE' : 'NO MICROPHONE FOUND');
        caption("I can't hear you right now, but you can type your reply below.");
        unblockActions?.removeAttribute('hidden');
        inputRow?.classList.add('open');
        textInput?.focus();
      } else if (event.error === 'aborted') {
        // Ignore – this fires when we call r.abort() ourselves
      } else {
        // language-not-supported, bad-grammar, etc.
        console.warn('[brewns-mic] Unhandled speech error:', event.error);
        if (callActive && phase === 'listening' && !muted) {
          setTimeout(() => {
            if (callActive && phase === 'listening' && !muted) listen();
          }, 800);
        }
      }
    };

    // Browsers close recognition after a stretch of silence; on a call the line stays open.
    r.onend = () => {
      if (recognition !== r) return;
      recognition = null;
      if (heard) {
        clearTimeout(silenceTimer);
        const said = heard;
        heard = '';
        return void sendPrompt(said);
      }
      // Guard: if onend fires within 120ms of start it means recognition never actually
      // started (common on iOS Safari). Back off longer before retrying.
      const elapsed = performance.now() - startedAt;
      const now = Date.now();
      if (elapsed < 120 || now - lastOnEndTs < 200) {
        lastOnEndTs = now;
        if (callActive && phase === 'listening' && !muted) {
          setTimeout(() => {
            if (callActive && phase === 'listening' && !muted) listen();
          }, IS_MOBILE ? 1200 : 500);
        }
        return;
      }
      lastOnEndTs = now;
      if (callActive && phase === 'listening' && !muted) {
        // Small delay on mobile to let the speech service fully release
        setTimeout(() => phase === 'listening' && listen(), IS_MOBILE ? 350 : 150);
      }
    };

    // On mobile, wait a tick after abort so the previous instance is fully released
    const startDelay = IS_MOBILE ? 120 : 0;
    setTimeout(() => {
      if (!callActive || recognition !== r || muted) return;
      try {
        r.start();
      } catch (err: any) {
        if (err?.name === 'InvalidStateError') {
          // Previous instance not yet fully stopped – retry after a longer delay
          setTimeout(() => {
            if (callActive && phase === 'listening' && !muted) {
              try { r.start(); } catch (e2) {
                console.warn('[brewns-mic] retry start failed:', e2);
                // Last resort: create a brand new instance
                setTimeout(() => {
                  if (callActive && phase === 'listening' && !muted) listen();
                }, 400);
              }
            }
          }, IS_MOBILE ? 500 : 250);
        } else {
          console.warn('[brewns-mic] Could not start recognition:', err);
          setPhase('muted', 'MIC UNAVAILABLE');
          caption('Voice input is temporarily unavailable. You can type your reply below.');
          inputRow?.classList.add('open');
          textInput?.focus();
        }
      }
    }, startDelay);
  }

  /* ── talking to the concierge ── */

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/voice/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender, history, state: scriptState, lang, callId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Voice server responded with ${res.status}`);
    return data;
  }

  async function sendPrompt(text: string) {
    const said = text.trim();
    if (!said || !callActive) return;
    const id = ++turnId;
    stopSpeaking();
    stopListening();
    hangUpAfterSpeech = false;
    playSoftClick?.();
    if (textInput) textInput.value = '';
    caption(said, 'you');
    setPhase('thinking');

    try {
      const data = await post({ message: said });
      if (id !== turnId || !callActive) return;
      history.push({ role: 'user', content: said }, { role: 'assistant', content: data.reply });
      if (data.lang === 'ur' || data.lang === 'en') setLang(data.lang);
      scriptState = data.state || {};
      caption(data.reply);
      // When Sarah asks for email / Gmail address, slide keypad open with clear placeholder
      if (/email|gmail|ای میل|جی میل/i.test(data.reply)) {
        inputRow?.classList.add('open');
        if (textInput) textInput.placeholder = 'Type your email or speak with mic…';
      }
      for (const a of (data.actions || []) as Action[]) handleAction(a);
      speak(data.reply, data.audioUrl, id);
    } catch (err) {
      if (id !== turnId || !callActive) return;
      console.warn('Voice call error:', err);
      const msg = err instanceof Error && /busy/i.test(err.message) ? err.message : "Sorry, the line broke up for a second there. Could you say that again?";
      caption(msg);
      speak(msg, undefined, id);
    }
  }

  function handleAction(action: Action) {
    if (action.type === 'ADD_TO_BAG') {
      let added = 0;
      for (const line of action.data?.items || []) {
        const p = productById(line.id);
        if (!p) continue;
        try {
          cart.add(line.id, line.sel || defaultSel(p), line.qty || 1);
          added += line.qty || 1;
        } catch (e) {
          console.warn('Could not add product to cart:', line.id, e);
        }
      }
      if (added) {
        playChime?.();
        triggerHaptic?.(40);
        toast(`ADDED ${added} ITEM${added > 1 ? 'S' : ''} TO YOUR BAG`, 'VIEW BAG', () => {
          endCall();
          openBag();
        });
      }
    } else if (action.type === 'RESERVE_TABLE') {
      playChime?.();
      triggerHaptic?.(50);
      toast(`TABLE BOOKED · ${action.data?.code || 'CONFIRMED'}`);
    } else if (action.type === 'BOOK_PARTY') {
      playChime?.();
      triggerHaptic?.(50);
      toast(`PARTY BOOKED · ${action.data?.code || 'CONFIRMED'} · WE'LL CALL YOU`);
    } else if (action.type === 'WHATSAPP_VOUCHER_SENT') {
      triggerHaptic?.(40);
      toast(`WHATSAPP VOUCHER SENT · ${action.data?.code || ''}`, 'OPEN WHATSAPP', () => {
        if (action.data?.whatsappUrl) {
          window.open(action.data.whatsappUrl, '_blank', 'noopener,noreferrer');
        }
      });
    } else if (action.type === 'END_CALL') {
      hangUpAfterSpeech = true;
    }
  }

  function setLang(next: 'en' | 'ur') {
    if (next === lang) return;
    lang = next;
    if (langBtn) {
      langBtn.dataset.lang = next;
      langBtn.setAttribute('aria-label', next === 'ur' ? 'Speaking Urdu. Switch to English' : 'Speaking English. Switch to Urdu');
    }
    if (textInput) textInput.dir = next === 'ur' ? 'rtl' : 'auto';
  }

  function setVoiceGender(next: 'female' | 'male') {
    gender = next;
    const female = next === 'female';
    if (voiceCurrentEl) voiceCurrentEl.textContent = agent().toUpperCase();
    if (agentTitleEl) agentTitleEl.textContent = female ? 'Sarah · Brewns Front Desk' : 'Hamza · Roastery & Bar';
    if (agentSubtitleEl) agentSubtitleEl.textContent = female ? 'Guest Concierge · Urdu & English' : 'Specialty Roaster & Hospitality Lead';
    if (avatarMono) avatarMono.textContent = agent()[0];
  }

  /* ── the call ── */

  async function startCall() {
    if (callActive) return;
    callActive = true;
    muted = !SpeechRec;
    history = [];
    scriptState = {};
    callId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    setLang(/^ur/i.test(navigator.language) ? 'ur' : 'en');
    hangUpAfterSpeech = false;
    modal!.hidden = false;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    seconds = -1;
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    playChime?.();
    triggerHaptic?.(50);
    caption(`Connecting to ${agent()} at brewns…`);
    if (!SpeechRec) inputRow?.classList.add('open');
    setPhase('connecting');
    // Voices load lazily in some browsers; ask early so the first reply has one.
    try {
      speechSynthesis.getVoices();
    } catch {}

    // Made inside the click so autoplay rules don't leave it suspended.
    // On mobile, AudioContext MUST be created + resumed inside a user gesture.
    try {
      if (!meterCtx || meterCtx.state === 'closed') {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) meterCtx = new Ctx();
      }
      if (meterCtx && meterCtx.state === 'suspended') meterCtx.resume().catch(() => {});
    } catch {}

    const id = ++turnId;
    // Don't request mic upfront — it triggers Chrome's permission prompt during the connecting
    // animation, and if the user dismisses/denies it, Chrome caches the denial permanently.
    // Instead, the first call to listen() (after Sarah's greeting) will request it, so the user
    // already understands what's happening on the call.
    // Ring the line meanwhile, so the wait sounds like a call connecting.
    const [data] = await Promise.all([post({ message: 'call_init', history: [] }).catch(() => null), playRingbackTone()]);

    // Set up a live permission watcher so if the user allows mic in Chrome settings while
    // the call is active, we instantly recover without needing to click RETRY.
    if (!permissionWatcher) {
      try {
        const status = await navigator.permissions?.query?.({ name: 'microphone' as any }).catch(() => null);
        if (status) {
          const onChange = () => {
            if (status.state === 'granted' && callActive && muted) {
              muted = false;
              micRetryCount = 0;
              toggleMic();
            }
          };
          status.addEventListener('change', onChange);
          permissionWatcher = { status, cleanup: () => status.removeEventListener('change', onChange) };
        }
      } catch {}
    }
    if (id !== turnId || !callActive) return;
    const hello = data?.reply || `Hi, thanks for calling brewns! This is ${agent()}. What can I do for you?`;
    history.push({ role: 'assistant', content: hello });
    caption(hello);
    speak(hello, data?.audioUrl, id);
  }

  function endCall() {
    if (!callActive) return;
    callActive = false;
    turnId++;
    // Tell the log the call is over; keepalive lets it go out even as the page closes.
    if (callId) {
      fetch('/api/voice/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'call_end', callId }), keepalive: true }).catch(() => {});
      callId = '';
    }
    clearInterval(timer);
    stopSpeaking();
    stopListening();
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    try { meterCtx?.close().catch(() => {}); } catch {}
    meterCtx = null;
    // Clean up permission watcher
    permissionWatcher?.cleanup();
    permissionWatcher = null;
    micRetryCount = 0;
    modal!.hidden = true;
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    setPhase('idle');
    playHangupTone();
  }

  async function toggleMic() {
    playSoftClick?.();
    triggerHaptic?.(40);

    // If Sarah/Hamza is currently speaking, tapping mic interrupts concierge to listen
    if (phase === 'speaking') {
      interrupt();
      return;
    }

    // If currently listening and unmuted, clicking mutes it
    if (phase === 'listening' && !muted) {
      muted = true;
      stopListening();
      setPhase('muted', 'MIC MUTED');
      caption('Microphone muted. Tap SPEAK LIVE to speak.');
      return;
    }

    // Otherwise caller wants to UNMUTE and SPEAK LIVE!
    if (captionStatus) captionStatus.textContent = 'CONNECTING MIC…';
    if (micLabel) micLabel.textContent = 'CONNECTING…';
    unblockActions?.setAttribute('hidden', '');

    // Resume AudioContext inside this user-gesture (critical for iOS)
    await resumeAudioCtx();

    if (!navigator.mediaDevices?.getUserMedia && !SpeechRec) {
      muted = true;
      setPhase('muted', 'MIC NOT SUPPORTED');
      caption('Voice microphone is not supported in this browser. Please use Chrome or Safari, or type your reply below.');
      inputRow?.classList.add('open');
      textInput?.focus();
      return;
    }

    micRetryCount++;

    // Request or resume microphone stream
    try {
      let stream: MediaStream | null = micStream;
      // Check ALL audio tracks, not just "some" – a partially dead stream is as bad as no stream
      const alive = stream && stream.getAudioTracks().length > 0 &&
                    stream.getAudioTracks().every((t) => t.readyState === 'live' && t.enabled);
      if (!alive) {
        // Release old tracks before requesting new ones
        stream?.getTracks().forEach((t) => t.stop());
        // Try advanced constraints first, fall back to simple { audio: true }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch {
          // Some devices/browsers reject advanced constraints; try bare minimum
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }
      micStream = stream;
      muted = false;
      micRetryCount = 0;
      listenRestartCount = 0;
      captionBox?.classList.remove('mic-alert');
      unblockActions?.setAttribute('hidden', '');

      stopListening();
      setTimeout(() => {
        if (callActive && !muted) listen();
      }, IS_MOBILE ? 200 : 80);
    } catch (err: any) {
      console.warn('[brewns-mic] Microphone permission request error:', err?.name, err?.message);
      muted = true;
      micStream = null;

      // AbortError = user dismissed the prompt; NotAllowedError = blocked in settings
      const blocked = err?.name === 'NotAllowedError' || err?.name === 'AbortError' ||
                      err?.name === 'PermissionDeniedError';
      setPhase('muted', blocked ? 'MIC BLOCKED' : 'MIC UNAVAILABLE');

      // After 2+ retries, tell the user to refresh the page (Chrome caches denials permanently)
      if (micRetryCount >= 2) {
        caption(
          IS_MOBILE
            ? 'Mic still blocked. Open browser menu → Settings → Site permissions → Allow microphone. Then refresh the page. Or type your message below!'
            : 'Mic is still blocked by your browser. Click the 🔒 in the address bar → ⚙️ Site settings → set Microphone to "Allow" → then refresh this page. Or just type below!'
        );
      } else {
        caption(
          IS_MOBILE
            ? 'Microphone is blocked. Open your browser menu → Settings → Site permissions → Microphone → Allow. Or tap "Type message" below.'
            : 'To enable mic: Click the 🔒 icon in your address bar → click ⚙️ Site settings → set Microphone to "Allow". Or tap "Type message" below.'
        );
      }
      unblockActions?.removeAttribute('hidden');
      captionBox?.classList.add('mic-alert');
      setTimeout(() => captionBox?.classList.remove('mic-alert'), 600);
      inputRow?.classList.add('open');
      textInput?.focus();
      toast(
        micRetryCount >= 2
          ? 'ALLOW MIC IN SITE SETTINGS → REFRESH PAGE'
          : (IS_MOBILE ? 'OPEN BROWSER SETTINGS → ALLOW MIC' : 'CLICK 🔒 → ⚙️ SITE SETTINGS → ALLOW MIC'),
        'TYPE MESSAGE',
        () => {
          inputRow?.classList.add('open');
          textInput?.focus();
        }
      );
    }
  }

  /* ── wiring ── */

  const openCall = (e: Event) => {
    e.preventDefault();
    startCall();
  };
  on($('hdr-voice-btn'), 'click', openCall);
  on($('hero-call-btn'), 'click', openCall);
  on($('voice-call-float'), 'click', openCall);
  on($('menu-voice-call-link'), 'click', openCall);
  for (const id of ['voice-call-close', 'voice-hangup-btn', 'voice-call-backdrop'])
    on($(id), 'click', (e: Event) => {
      e.preventDefault();
      endCall();
    });
  on(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && callActive) endCall();
  });
  // Closing the tab mid-call still ends the call in the café's log.
  on(window, 'pagehide', () => callActive && endCall());

  // If user switched to Site settings to allow mic and returned to this tab, auto-resume.
  // Also re-check even if we don't have a permission query (some browsers skip it).
  on(window, 'focus', async () => {
    if (!callActive || !muted) return;
    try {
      const p = await navigator.permissions?.query?.({ name: 'microphone' as any }).catch(() => null);
      if (p && p.state === 'granted') {
        micRetryCount = 0;
        toggleMic();
        return;
      }
      // Even if permission query says 'prompt' (not denied), try getUserMedia directly
      // — some browsers update the mic permission without updating the Permissions API.
      if (!p || p.state === 'prompt') {
        const test = await navigator.mediaDevices?.getUserMedia({ audio: true }).catch(() => null);
        if (test) {
          test.getTracks().forEach((t) => t.stop());
          micRetryCount = 0;
          toggleMic();
        }
      }
    } catch {}
  });

  on($('vc-voice-switch'), 'click', async (e: Event) => {
    e.preventDefault();
    setVoiceGender(gender === 'female' ? 'male' : 'female');
    playSoftClick?.();
    if (!callActive) return;
    const id = ++turnId;
    stopSpeaking();
    stopListening();
    setPhase('thinking');
    const data = await post({ message: 'voice_switch' }).catch(() => null);
    if (id !== turnId || !callActive) return;
    const line = data?.reply || `Hi, ${agent()} here. Where were we?`;
    caption(line);
    speak(line, data?.audioUrl, id);
  });

  on(micToggleBtn, 'click', (e: Event) => {
    e.preventDefault();
    toggleMic();
  });

  on(unblockBtn, 'click', (e: Event) => {
    e.preventDefault();
    toggleMic();
  });

  on(typeModeBtn, 'click', (e: Event) => {
    e.preventDefault();
    playSoftClick?.();
    triggerHaptic?.(25);
    setPhase('muted', 'KEYPAD ACTIVE · TYPE TO SARAH');
    caption('You can type any question or booking details below, and Sarah will answer in voice!');
    unblockActions?.setAttribute('hidden', '');
    inputRow?.classList.add('open');
    textInput?.focus();
  });

  on($('voice-keypad-toggle'), 'click', (e: Event) => {
    e.preventDefault();
    const open = inputRow ? inputRow.classList.toggle('open') : true;
    if (open) textInput?.focus();
    playSoftClick?.();
  });

  on(langBtn, 'click', (e: Event) => {
    e.preventDefault();
    setLang(lang === 'en' ? 'ur' : 'en');
    playSoftClick?.();
    // Reopen the mic in the new language straight away.
    if (callActive && phase === 'listening') listen();
  });

  const sendTyped = () => {
    const txt = textInput?.value.trim() || '';
    if (txt) sendPrompt(txt);
  };
  on($('voice-send-btn'), 'click', (e: Event) => {
    e.preventDefault();
    sendTyped();
  });
  on(textInput, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendTyped();
    }
  });
  // Typing pauses the mic so it doesn't talk over what you're writing.
  on(textInput, 'focus', () => {
    if (phase === 'listening') {
      stopListening();
      setPhase('muted', 'TYPING…');
    }
  });

  on($('voice-chips-wrap'), 'click', (e: Event) => {
    const chip = (e.target as HTMLElement).closest('.voice-chip') as HTMLElement | null;
    if (chip?.dataset.prompt) {
      e.preventDefault();
      sendPrompt(chip.dataset.prompt);
    }
  });

  setVoiceGender('female');
  updateMicUI();

  return () => {
    endCall();
    ac.abort();
  };
}
