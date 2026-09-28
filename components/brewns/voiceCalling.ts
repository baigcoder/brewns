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
const END_OF_SPEECH_MS = 450;
/** Mic level (RMS, 0..1) and how long it must hold to count as talking over the voice. */
// Phone mics report much quieter RMS levels than desktop mics. 0.06 only
// detected shouting on several mobile devices, making interruption feel dead.
const BARGE_IN_LEVEL = 0.018;
const BARGE_IN_MS = 360;
/** True on phones and iPads (including iPadOS desktop-mode Safari). */
const IS_MOBILE = typeof navigator !== 'undefined' && (
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

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
  let manualLangRevision = 0;
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
  let lastMobileRecoveryAt = 0;
  /** Live watcher: fires the instant the browser flips mic permission to 'granted'. */
  let permissionWatcher: { status: PermissionStatus | null; cleanup: () => void } | null = null;

  let audioEl: HTMLAudioElement | null = null;
  let utterance: SpeechSynthesisUtterance | null = null;

  let micStream: MediaStream | null = null;
  let meterCtx: AudioContext | null = null;
  let meterRaf = 0;

  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let vadSilenceTimer: ReturnType<typeof setTimeout> | undefined;
  let vadSpeechDetected = false;
  let vadMeterRaf = 0;
  let vadActive = false;

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
    const canCaptureAudio = typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined';
    const canListen = Boolean(SpeechRec || canCaptureAudio);
    micToggleBtn?.classList.toggle('active', live);
    micToggleBtn?.classList.toggle('muted', muted || !canListen);
    micToggleBtn?.setAttribute('aria-pressed', String(!muted));
    if (micLabel) {
      micLabel.textContent = !canListen
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
      // Safari on iOS can route a dynamically-created audio element as video
      // unless it is explicitly marked inline. That can hide call controls or
      // refuse playback after an asynchronous server response.
      a.setAttribute('playsinline', '');
      a.setAttribute('webkit-playsinline', '');
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
    } catch {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        muted = false;
        return micStream;
      } catch (err: any) {
        console.warn('[brewns-mic] getUserMedia failed:', err?.name, err?.message);
        return null;
      }
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
    clearTimeout(vadSilenceTimer);
    cancelAnimationFrame(vadMeterRaf);
    vadActive = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
    }
    mediaRecorder = null;
    const r = recognition;
    recognition = null;
    if (r) {
      r.onresult = r.onerror = r.onend = r.onstart = null;
      try {
        r.abort();
      } catch {}
    }
  }

  async function listenWithRecorder() {
    if (!callActive) return;
    stopListening();
    vadActive = true;
    audioChunks = [];
    vadSpeechDetected = false;

    const stream = await ensureMic();
    if (!stream) {
      muted = true;
      setPhase('muted', 'MIC MUTED · KEYPAD ACTIVE');
      unblockActions?.removeAttribute('hidden');
      inputRow?.classList.add('open');
      textInput?.focus();
      return;
    }

    muted = false;
    setPhase('listening');
    caption('Listening… speak into mic / headset', 'agent');
    unblockActions?.setAttribute('hidden', '');

    let mimeType = '';
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        mimeType = t;
        break;
      }
    }

    try {
      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (e) {
        console.warn('[brewns-recorder] MediaRecorder initialization error:', e);
        muted = true;
        setPhase('muted', 'MIC MUTED · KEYPAD ACTIVE');
        caption('Your browser could not start voice capture. Tap Connect & Test Mic or type your message below.', 'agent');
        unblockActions?.removeAttribute('hidden');
        inputRow?.classList.add('open');
        return;
      }
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      cancelAnimationFrame(vadMeterRaf);
      clearTimeout(vadSilenceTimer);
      if (!callActive || !vadActive) return;

      const chunks = audioChunks;
      audioChunks = [];
      const hadSpeech = vadSpeechDetected;
      vadSpeechDetected = false;

      if (!hadSpeech || chunks.length === 0) {
        if (callActive && phase === 'listening' && !muted) {
          setTimeout(() => phase === 'listening' && listenWithRecorder(), 150);
        }
        return;
      }

      const audioType = chunks.find((chunk) => chunk.type)?.type || mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: audioType });
      if (blob.size < 1200) {
        if (callActive && phase === 'listening' && !muted) {
          setTimeout(() => phase === 'listening' && listenWithRecorder(), 150);
        }
        return;
      }

      setPhase('thinking', `${agent().toUpperCase()} IS THINKING…`);
      caption('Processing voice…', 'you');

      try {
        const formData = new FormData();
        const extension = audioType.includes('mp4') ? 'mp4' : audioType.includes('ogg') ? 'ogg' : 'webm';
        formData.append('file', blob, `voice.${extension}`);
        formData.append('language', lang);
        formData.append('callId', callId);
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Transcription unavailable (${res.status})`);
        const text = (data.text || '').trim();
        if (text && text.length > 1 && !/^(thank you|subtitles|transcription|you|bye)\.?$/i.test(text)) {
          caption(text, 'you');
          sendPrompt(text);
        } else {
          if (callActive && !muted) {
            setPhase('listening');
            caption('I didn’t catch that. Please speak again, or type your message below.', 'agent');
            listenWithRecorder();
          }
        }
      } catch (err) {
        console.warn('[brewns-transcribe] Error:', err);
        if (callActive && !muted) {
          setPhase('muted', 'VOICE TRANSCRIPTION UNAVAILABLE');
          caption('Voice transcription is unavailable right now. Type your message below and Sarah will reply.', 'agent');
          unblockActions?.removeAttribute('hidden');
          inputRow?.classList.add('open');
          textInput?.focus();
        }
      }
    };

    try {
      await resumeAudioCtx();
      if (meterCtx) {
        const src = meterCtx.createMediaStreamSource(stream);
        const an = meterCtx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const data = new Float32Array(an.fftSize);
        let silenceStart = 0;
        const speechLevel = 0.006; // Quiet phone/headset input needs a lower floor than desktop.

        const vadLoop = () => {
          if (!callActive || phase !== 'listening' || !vadActive || mediaRecorder?.state !== 'recording') {
            try { src.disconnect(); } catch {}
            return;
          }
          an.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
          const rms = Math.sqrt(sum / data.length);
          const now = performance.now();

          if (rms > speechLevel) {
            vadSpeechDetected = true;
            silenceStart = 0;
            caption('Listening to you…', 'you');
          } else if (vadSpeechDetected) {
            if (!silenceStart) silenceStart = now;
            else if (now - silenceStart > (IS_MOBILE ? 520 : 600)) {
              try { mediaRecorder?.stop(); } catch {}
              try { src.disconnect(); } catch {}
              return;
            }
          }
          vadMeterRaf = requestAnimationFrame(vadLoop);
        };

        mediaRecorder.start(200);
        vadMeterRaf = requestAnimationFrame(vadLoop);
        return;
      }
    } catch {}

    // Fallback if AudioContext analyser is unavailable: record in 3.5s slices
    mediaRecorder.start();
    vadSilenceTimer = setTimeout(() => {
      if (mediaRecorder?.state === 'recording') {
        vadSpeechDetected = true;
        try { mediaRecorder.stop(); } catch {}
      }
    }, 3500);
  }

  async function listen() {
    if (!callActive) return;
    if (muted) return setPhase('muted', 'MIC MUTED · KEYPAD ACTIVE');

    // Mobile SpeechRecognition is frequently missing, stops after one phrase, or
    // reports a transcript without reliably retaining the live microphone stream.
    // Capture directly from the permitted mic on phones/tablets; keep recognition
    // as a fast path on desktop and as a fallback when mobile recording is absent.
    if (IS_MOBILE && typeof MediaRecorder !== 'undefined' && Boolean(navigator?.mediaDevices?.getUserMedia)) {
      return listenWithRecorder();
    }

    // Use native live recognition first when the browser supports it. This avoids
    // waiting for a recording to finish and uploading it for a separate transcript.
    // MediaRecorder + Whisper stays available as a fallback.
    if (!SpeechRec) {
      if (typeof MediaRecorder !== 'undefined' && Boolean(navigator?.mediaDevices?.getUserMedia)) {
        return listenWithRecorder();
      }
      return setPhase('idle', 'TYPE YOUR REPLY BELOW');
    }
    stopListening();
    heard = '';

    // Pre-warm mic stream in background for barge-in analyser if available
    if (!micStream && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)) {
      ensureMic().catch(() => {});
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
      }, interim ? END_OF_SPEECH_MS + 200 : END_OF_SPEECH_MS);
    };

    r.onerror = (event: any) => {
      console.warn('[brewns-mic] Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
        if (typeof MediaRecorder !== 'undefined' && Boolean(navigator?.mediaDevices?.getUserMedia)) {
          console.log('[brewns-mic] Switching to MediaRecorder engine');
          listenWithRecorder();
          return;
        }
        muted = true;
        stopListening();
        setPhase('muted', 'MIC MUTED · KEYPAD ACTIVE');
        unblockActions?.removeAttribute('hidden');
        inputRow?.classList.add('open');
        textInput?.focus();
      } else if (event.error === 'no-speech') {
        // Normal pause; onend will automatically cycle listening cleanly
      } else if (event.error === 'network') {
        if (typeof MediaRecorder !== 'undefined' && Boolean(navigator?.mediaDevices?.getUserMedia)) {
          listenWithRecorder();
          return;
        }
        muted = true;
        stopListening();
        setPhase('muted', 'VOICE INPUT OFFLINE');
        unblockActions?.removeAttribute('hidden');
        inputRow?.classList.add('open');
        textInput?.focus();
      } else if (event.error === 'aborted') {
        // Ignore – this fires when we call r.abort() ourselves
      } else {
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

  async function recoverMobileListener() {
    const now = Date.now();
    // focus and visibilitychange commonly fire together on mobile browsers.
    if (now - lastMobileRecoveryAt < 1200) return;
    lastMobileRecoveryAt = now;
    await resumeAudioCtx();
    if (!callActive || muted || phase !== 'listening') return;
    stopListening();
    listen();
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
    const languageRevisionAtStart = manualLangRevision;
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
      if ((data.lang === 'ur' || data.lang === 'en') && languageRevisionAtStart === manualLangRevision) setLang(data.lang);
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
    } else if (action.type === 'WHATSAPP_VOUCHER') {
      triggerHaptic?.(40);
      toast(`${action.data?.sent ? 'WHATSAPP VOUCHER SENT' : 'WHATSAPP VOUCHER READY TO SHARE'} · ${action.data?.code || ''}`, 'OPEN WHATSAPP', () => {
        if (action.data?.whatsappUrl) {
          window.open(action.data.whatsappUrl, '_blank', 'noopener,noreferrer');
        }
      });
    } else if (action.type === 'END_CALL') {
      hangUpAfterSpeech = true;
    }
  }

  function setLang(next: 'en' | 'ur', manual = false) {
    if (next === lang) return;
    lang = next;
    if (manual) manualLangRevision++;
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
    muted = !(SpeechRec || (typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined'));
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
    if (!SpeechRec && !(typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined')) inputRow?.classList.add('open');
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

    // Request microphone access synchronously during this user click gesture!
    // This provides the essential user gesture token required by modern browsers to prompt for mic permission.
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
        .then((stream) => {
          micStream = stream;
          muted = false;
          updateMicUI();
        })
        .catch((err) => {
          console.warn('[brewns-mic] Initial user-gesture mic check:', err?.name);
        });
    }

    const id = ++turnId;
    // Start the greeting as soon as the call endpoint responds; a fixed ringback
    // tone previously added more than a second of artificial setup delay.
    const data = await post({ message: 'call_init', history: [] }).catch(() => null);

    // Set up a live permission watcher so if the user allows mic in Chrome settings while
    // the call is active, we instantly recover without needing to reload.
    if (!permissionWatcher) {
      try {
        const status = await navigator.permissions?.query?.({ name: 'microphone' as any }).catch(() => null);
        if (status) {
          const onChange = () => {
            if (status.state === 'granted' && callActive) {
              muted = false;
              micRetryCount = 0;
              unblockActions?.setAttribute('hidden', '');
              captionBox?.classList.remove('mic-alert');
              caption("Microphone allowed! Speak now — Sarah is listening!", 'agent');
              toast("MICROPHONE ALLOWED", "SPEAK NOW");
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

    micRetryCount++;

    // Request or resume microphone stream inside this direct user gesture
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        let stream: MediaStream | null = micStream;
        const alive = stream && stream.getAudioTracks().length > 0 &&
                      stream.getAudioTracks().every((t) => t.readyState === 'live' && t.enabled);
        if (!alive) {
          stream?.getTracks().forEach((t) => t.stop());
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
        }
        micStream = stream;
      } catch (err: any) {
        console.warn('[brewns-mic] Microphone permission request in toggleMic:', err?.name, err?.message);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          caption('Microphone access is blocked for this site. Allow it in your browser’s site settings, then tap Connect & test mic.', 'agent');
          toast('ALLOW MICROPHONE IN SITE SETTINGS', 'GOT IT');
        }
        muted = true;
        setPhase('muted', err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' ? 'MIC BLOCKED · KEYPAD ACTIVE' : 'MIC UNAVAILABLE · KEYPAD ACTIVE');
        if (err?.name !== 'NotAllowedError' && err?.name !== 'PermissionDeniedError') {
          caption('We couldn’t start your microphone. Check that it is connected and not being used by another app, then try again or type below.', 'agent');
        }
        unblockActions?.removeAttribute('hidden');
        inputRow?.classList.add('open');
        textInput?.focus();
        return;
      }
    } else {
      muted = true;
      setPhase('muted', 'MIC UNAVAILABLE · KEYPAD ACTIVE');
      caption('This browser cannot access a microphone. Type your message below and Sarah will reply.', 'agent');
      unblockActions?.removeAttribute('hidden');
      inputRow?.classList.add('open');
      return;
    }

    muted = false;
    micRetryCount = 0;
    listenRestartCount = 0;
    captionBox?.classList.remove('mic-alert');
    unblockActions?.setAttribute('hidden', '');

    stopListening();
    setPhase('listening');
    caption('Listening… Speak now', 'agent');
    setTimeout(() => {
      if (callActive && !muted) {
        listen();
      }
    }, IS_MOBILE ? 200 : 80);
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
    if (!callActive) return;
    if (!muted) {
      // Mobile browsers can suspend both the mic track and AudioContext while
      // the caller switches apps. Rebuild the recorder after returning so the
      // call does not look live while silently listening to a dead track.
      if (phase === 'listening' && IS_MOBILE) void recoverMobileListener();
      return;
    }
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

  on(document, 'visibilitychange', () => {
    if (!callActive || document.visibilityState !== 'visible' || muted || phase !== 'listening' || !IS_MOBILE) return;
    void recoverMobileListener();
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
    muted = true;
    stopListening();
    setPhase('muted', 'KEYPAD ACTIVE · SARAH SPEAKS LIVE');
    caption('Type your question or tap any option below. Sarah will answer in live voice!');
    unblockActions?.setAttribute('hidden', '');
    captionBox?.classList.remove('mic-alert');
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
    setLang(lang === 'en' ? 'ur' : 'en', true);
    playSoftClick?.();
    // Restart capture in the selected language. If the concierge is speaking,
    // acknowledge the switch in the new voice immediately rather than finishing
    // an entire sentence in the old language.
    if (callActive && phase === 'listening') listen();
    else if (callActive && phase === 'speaking') {
      const id = ++turnId;
      stopSpeaking();
      stopListening();
      setPhase('thinking');
      post({ message: 'language_switch' }).then((data) => {
        if (id !== turnId || !callActive) return;
        const line = data?.reply || (lang === 'ur' ? 'جی، اب ہم اردو میں بات کریں گے۔ فرمائیے، میں آپ کی کیا مدد کروں؟' : 'Sure, I’ll speak English. What can I help you with?');
        history.push({ role: 'assistant', content: line });
        caption(line);
        speak(line, data?.audioUrl, id);
      }).catch(() => {
        if (id === turnId && callActive) speak(lang === 'ur' ? 'جی، اب ہم اردو میں بات کریں گے۔ فرمائیے؟' : 'Sure, I’ll speak English. What can I help you with?', undefined, id);
      });
    }
  });

  const sendTyped = () => {
    const txt = textInput?.value.trim() || '';
    if (txt) {
      unblockActions?.setAttribute('hidden', '');
      captionBox?.classList.remove('mic-alert');
      sendPrompt(txt);
    }
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
      unblockActions?.setAttribute('hidden', '');
      captionBox?.classList.remove('mic-alert');
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
