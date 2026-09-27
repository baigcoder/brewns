'use client';

/* The AI voice call, in the browser.

   It behaves like a phone call rather than a walkie-talkie:
   - hands-free: when Sarah / George finishes a sentence the mic opens by itself,
     and it sends what you said once you pause, so you just talk;
   - you can interrupt: speak over the voice and it stops to listen (a level
     meter on an echo-cancelled mic, so it doesn't hear itself);
   - it thinks out loud a little: the wave pulses while the reply is on its way;
   - it always has a voice: ElevenLabs when the server sends audio, the
     browser's own speech otherwise.
   The mic button mutes and unmutes; typing and the quick chips still work. */

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

export function initVoiceCalling({ cart, productById, defaultSel, openBag, toast, playChime, playSoftClick, triggerHaptic }: VoiceCallingDeps) {
  if (typeof window === 'undefined') return () => {};

  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const modal = $('voice-call-modal');
  if (!modal) return () => {};

  const timerEl = $('voice-call-timer');
  const voiceCurrentEl = $('vc-voice-current');
  const agentTitleEl = $('vc-agent-title');
  const agentSubtitleEl = $('vc-agent-subtitle');
  const badgeEl = $('vc-badge-text');
  const avatarRing = $('vc-avatar-ring');
  const avatarIcon = $('vc-avatar-icon');
  const soundwave = $('voice-soundwave');
  const captionStatus = $('voice-caption-status');
  const captionText = $('voice-caption-text');
  const textInput = $<HTMLInputElement>('voice-text-input');
  const micToggleBtn = $('voice-mic-toggle');
  const micLabel = $('voice-mic-label');
  const micIcon = $('voice-mic-icon');

  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const ac = new AbortController();
  const on = (el: EventTarget | null, ev: string, fn: (e: any) => void) => el?.addEventListener(ev, fn, { signal: ac.signal });

  let callActive = false;
  let phase: Phase = 'idle';
  let muted = false;
  let gender: 'female' | 'male' = 'female';
  let history: Turn[] = [];
  let scriptState: unknown = {};
  let hangUpAfterSpeech = false;
  /** Bumped on every new turn, hang-up or interruption; late replies for an old turn are dropped. */
  let turnId = 0;

  let timer: ReturnType<typeof setInterval> | undefined;
  let seconds = 0;

  let recognition: any = null;
  let heard = '';
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  let audioEl: HTMLAudioElement | null = null;
  let utterance: SpeechSynthesisUtterance | null = null;

  let micStream: MediaStream | null = null;
  let meterCtx: AudioContext | null = null;
  let meterRaf = 0;

  const agent = () => (gender === 'female' ? 'Sarah' : 'George');

  /* ── what the screen says ── */

  function setPhase(next: Phase, status?: string) {
    phase = next;
    soundwave?.classList.toggle('speaking', next === 'speaking');
    soundwave?.classList.toggle('thinking', next === 'thinking' || next === 'connecting');
    soundwave?.classList.toggle('listening', next === 'listening');
    avatarRing?.classList.toggle('active', next === 'speaking');
    modal!.dataset.phase = next;
    const label =
      status ||
      { idle: '// READY', connecting: '// CONNECTING…', speaking: `// ${agent().toUpperCase()} SPEAKING`, listening: '// LISTENING. JUST TALK', thinking: `// ${agent().toUpperCase()} IS THINKING…`, muted: '// MIC MUTED. TAP TO TALK OR TYPE' }[next];
    if (captionStatus) captionStatus.textContent = label;
    updateMicUI();
  }

  function caption(text: string, who: 'agent' | 'you' = 'agent') {
    if (!captionText) return;
    captionText.textContent = who === 'you' ? `You: “${text}”` : text;
  }

  function updateMicUI() {
    const live = phase === 'listening';
    micToggleBtn?.classList.toggle('active', live);
    micToggleBtn?.setAttribute('aria-pressed', String(!muted));
    if (micLabel) micLabel.textContent = !SpeechRec ? 'TYPE BELOW' : muted ? 'TAP TO TALK' : live ? 'LISTENING · TAP TO MUTE' : 'MIC ON · TAP TO MUTE';
    if (micIcon) micIcon.textContent = muted || !SpeechRec ? '🎙️' : live ? '🔴' : '🎧';
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

  function pickBrowserVoice(): SpeechSynthesisVoice | null {
    const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) return null;
    const female = /female|samantha|victoria|karen|moira|tessa|serena|zira|aria|jenny|sonia|libby|google uk english female|google us english/i;
    const male = /male|daniel|alex|fred|oliver|arthur|george|guy|ryan|david|mark|google uk english male/i;
    const want = gender === 'female' ? female : male;
    return voices.find((v) => want.test(v.name) && !(gender === 'female' && /\bmale\b/i.test(v.name))) || voices.find((v) => /en-(GB|IN|PK)/i.test(v.lang)) || voices[0];
  }

  /** Speak one reply, then carry on the call (listen, or hang up if it said goodbye). */
  function speak(text: string, audioBase64: string | undefined, id: number) {
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

    if (audioBase64) {
      const a = new Audio(audioBase64);
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
      const u = new SpeechSynthesisUtterance(text);
      const v = pickBrowserVoice();
      if (v) u.voice = v;
      u.lang = v?.lang || 'en-GB';
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

  /* ── barge-in: hear the caller talk over the voice ── */

  async function ensureMic() {
    if (micStream || !navigator.mediaDevices?.getUserMedia) return micStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      micStream = null;
    }
    return micStream;
  }

  function startMeter(id: number) {
    if (!micStream || muted) return;
    try {
      meterCtx ||= new AudioContext();
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
    } catch {}
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
      r.onresult = r.onerror = r.onend = null;
      try {
        r.abort();
      } catch {}
    }
  }

  function listen() {
    if (!callActive) return;
    if (!SpeechRec || muted) return setPhase(SpeechRec ? 'muted' : 'idle', SpeechRec ? undefined : '// TYPE YOUR REPLY BELOW');
    stopListening();
    heard = '';
    setPhase('listening');

    const r = new SpeechRec();
    recognition = r;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.lang = /^en-(GB|IN|PK|US|AU)/i.test(navigator.language) ? navigator.language : 'en-IN';

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
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        muted = true;
        stopListening();
        setPhase('muted', '// MIC BLOCKED');
        caption('I need microphone access to hear you. Allow it in the address bar, or just type below.');
      } else if (event.error === 'audio-capture' || event.error === 'network') {
        // No mic, or the browser's speech service is unreachable: reopening would just spin.
        muted = true;
        stopListening();
        setPhase('muted', event.error === 'network' ? '// VOICE INPUT OFFLINE' : '// NO MICROPHONE FOUND');
        caption("I can't hear you right now, but you can type your reply below.");
      }
      // 'no-speech' and 'aborted' fall through to onend, which reopens the mic.
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
      if (callActive && phase === 'listening' && !muted) setTimeout(() => phase === 'listening' && listen(), 150);
    };

    try {
      r.start();
    } catch {
      setPhase('muted');
    }
  }

  /* ── talking to the concierge ── */

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/voice/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender, history, state: scriptState, ...body }),
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
      scriptState = data.state || {};
      caption(data.reply);
      for (const a of (data.actions || []) as Action[]) handleAction(a);
      speak(data.reply, data.audioBase64, id);
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
    } else if (action.type === 'END_CALL') {
      hangUpAfterSpeech = true;
    }
  }

  function setVoiceGender(next: 'female' | 'male') {
    gender = next;
    const female = next === 'female';
    if (voiceCurrentEl) voiceCurrentEl.textContent = female ? 'SARAH (FEMALE)' : 'GEORGE (MALE)';
    if (agentTitleEl) agentTitleEl.textContent = `${agent()} · Brewns Concierge`;
    if (agentSubtitleEl) agentSubtitleEl.textContent = female ? 'Barista & Host · Urdu & English' : 'Roaster & Concierge · Urdu & English';
    if (avatarIcon) avatarIcon.textContent = female ? '☕' : '🎙️';
  }

  /* ── the call ── */

  async function startCall() {
    if (callActive) return;
    callActive = true;
    muted = !SpeechRec;
    history = [];
    scriptState = {};
    hangUpAfterSpeech = false;
    modal!.hidden = false;
    document.body.style.overflow = 'hidden';
    seconds = -1;
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    playChime?.();
    triggerHaptic?.(50);
    caption('Connecting you to brewns…');
    setPhase('connecting');
    // Voices load lazily in some browsers; ask early so the first reply has one.
    try {
      speechSynthesis.getVoices();
    } catch {}

    // Made inside the click so autoplay rules don't leave it suspended.
    try {
      meterCtx ||= new AudioContext();
      meterCtx.resume().catch(() => {});
    } catch {}

    const id = ++turnId;
    // Ask for the mic while the greeting loads, so the prompt doesn't cut into the conversation.
    const [data] = await Promise.all([post({ message: 'call_init', history: [] }).catch(() => null), SpeechRec ? ensureMic() : null]);
    if (id !== turnId || !callActive) return;
    const hello = data?.reply || `Hi, thanks for calling brewns! This is ${agent()}. What can I do for you?`;
    if (badgeEl) badgeEl.textContent = data?.brain === 'claude' ? (data?.audioBase64 ? 'LIVE AI · ELEVENLABS VOICE' : 'LIVE AI CALL') : data?.audioBase64 ? 'ELEVENLABS · VOICE CONCIERGE' : 'VOICE CONCIERGE';
    history.push({ role: 'assistant', content: hello });
    caption(hello);
    speak(hello, data?.audioBase64, id);
  }

  function endCall() {
    if (!callActive) return;
    callActive = false;
    turnId++;
    clearInterval(timer);
    stopSpeaking();
    stopListening();
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    meterCtx?.close().catch(() => {});
    meterCtx = null;
    modal!.hidden = true;
    document.body.style.removeProperty('overflow');
    setPhase('idle');
    playSoftClick?.();
  }

  function toggleMic() {
    if (!SpeechRec) {
      caption('Voice input works in Chrome, Edge and Safari. You can type your request below instead.');
      textInput?.focus();
      return;
    }
    muted = !muted;
    playSoftClick?.();
    if (muted) {
      stopListening();
      if (phase !== 'speaking' && phase !== 'thinking') setPhase('muted');
      else updateMicUI();
    } else if (phase === 'speaking') {
      interrupt();
    } else if (phase !== 'thinking') {
      ensureMic().finally(listen);
    } else updateMicUI();
  }

  /* ── wiring ── */

  const openCall = (e: Event) => {
    e.preventDefault();
    startCall();
  };
  on($('hdr-voice-btn'), 'click', openCall);
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
    speak(line, data?.audioBase64, id);
  });

  on(micToggleBtn, 'click', (e: Event) => {
    e.preventDefault();
    toggleMic();
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
      setPhase('muted', '// TYPING…');
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
