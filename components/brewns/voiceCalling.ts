'use client';

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

export function initVoiceCalling({
  cart,
  productById,
  defaultSel,
  openBag,
  toast,
  playChime,
  playSoftClick,
  triggerHaptic,
}: VoiceCallingDeps) {
  if (typeof window === 'undefined') return () => {};

  // Elements
  const hdrBtn = document.getElementById('hdr-voice-btn');
  const floatBtn = document.getElementById('voice-call-float');
  const menuLink = document.getElementById('menu-voice-call-link');
  const modal = document.getElementById('voice-call-modal') as HTMLElement | null;
  const backdrop = document.getElementById('voice-call-backdrop');
  const closeBtn = document.getElementById('voice-call-close');
  const hangupBtn = document.getElementById('voice-hangup-btn');
  const timerEl = document.getElementById('voice-call-timer');
  const voiceSwitchBtn = document.getElementById('vc-voice-switch');
  const voiceCurrentEl = document.getElementById('vc-voice-current');
  const agentTitleEl = document.getElementById('vc-agent-title');
  const agentSubtitleEl = document.getElementById('vc-agent-subtitle');
  const avatarRing = document.getElementById('vc-avatar-ring');
  const avatarIcon = document.getElementById('vc-avatar-icon');
  const soundwave = document.getElementById('voice-soundwave');
  const captionStatus = document.getElementById('voice-caption-status');
  const captionText = document.getElementById('voice-caption-text');
  const textInput = document.getElementById('voice-text-input') as HTMLInputElement | null;
  const sendBtn = document.getElementById('voice-send-btn');
  const micToggleBtn = document.getElementById('voice-mic-toggle');
  const micLabel = document.getElementById('voice-mic-label');
  const micIcon = document.getElementById('voice-mic-icon');
  const chipsWrap = document.getElementById('voice-chips-wrap');
  const keypadToggleBtn = document.getElementById('voice-keypad-toggle');
  const inputRow = document.getElementById('voice-input-row');

  if (!modal) return () => {};

  // State
  let isCallActive = false;
  let callTimerInterval: any = null;
  let callSeconds = 0;
  let currentGender: 'female' | 'male' = 'female';
  let isListening = false;
  let recognition: any = null;
  let audioElement: HTMLAudioElement | null = null;
  let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  let isProcessing = false;

  // Initialize Speech Recognition if supported
  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  function updateTimerDisplay() {
    if (!timerEl) return;
    const m = Math.floor(callSeconds / 60);
    const s = callSeconds % 60;
    timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function startTimer() {
    clearInterval(callTimerInterval);
    callSeconds = 0;
    updateTimerDisplay();
    callTimerInterval = setInterval(() => {
      callSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(callTimerInterval);
  }

  function setSpeaking(isSpeaking: boolean) {
    if (soundwave) {
      soundwave.classList.toggle('speaking', isSpeaking);
    }
    if (avatarRing) {
      avatarRing.classList.toggle('active', isSpeaking);
    }
    const avatarPulse = document.getElementById('vc-avatar-pulse');
    if (avatarPulse) {
      avatarPulse.classList.toggle('active', isSpeaking);
    }
  }

  function stopAudio() {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement = null;
    }
    setSpeaking(false);
  }

  function playRingbackTone(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) { resolve(); return; }
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();

        // Realistic telephone PBX ringback: dual frequency 440Hz + 480Hz
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.85);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.05);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 1.1);
        osc2.stop(ctx.currentTime + 1.1);

        setTimeout(() => {
          try { ctx.close(); } catch {}
          resolve();
        }, 1050);
      } catch {
        resolve();
      }
    });
  }

  function playHangupTone() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      setTimeout(() => { try { ctx.close(); } catch {} }, 220);
    } catch {}
  }

  function playVoiceAudio(audioBase64: string | undefined, onComplete?: () => void) {
    stopAudio();
    if (!audioBase64) {
      setSpeaking(false);
      onComplete?.();
      return;
    }

    try {
      const audio = new Audio(audioBase64);
      audioElement = audio;

      audio.onplay = () => {
        setSpeaking(true);
        if (captionStatus) captionStatus.textContent = `// ${currentGender === 'female' ? 'SARAH' : 'HAMZA'} ON LINE`;
      };

      audio.onended = () => {
        setSpeaking(false);
        if (captionStatus) captionStatus.textContent = '// LISTENING TO YOU';
        audioElement = null;
        onComplete?.();
      };

      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        setSpeaking(false);
        if (captionStatus) captionStatus.textContent = '// READY';
        audioElement = null;
        onComplete?.();
      };

      audio.play().catch((err) => {
        console.warn('Audio autoplay failed:', err);
        setSpeaking(false);
        onComplete?.();
      });
    } catch (e) {
      console.error('Failed to create Audio instance:', e);
      setSpeaking(false);
      onComplete?.();
    }
  }

  async function sendPrompt(promptText: string) {
    if (!promptText || isProcessing) return;
    isProcessing = true;
    playSoftClick?.();

    if (captionStatus) captionStatus.textContent = '// PROCESSING...';
    if (captionText) captionText.textContent = `You: "${promptText}"`;
    if (textInput) textInput.value = '';

    // Stop recognition while concierge replies
    if (isListening && recognition) {
      try {
        recognition.stop();
      } catch {}
      isListening = false;
      updateMicUI();
    }

    try {
      const res = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          conversationHistory,
          gender: currentGender,
        }),
      });

      if (!res.ok) {
        throw new Error(`Voice server responded with ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || "Certainly! How else may I assist you at Brewns today?";

      // Update history
      conversationHistory.push({ role: 'user', content: promptText });
      conversationHistory.push({ role: 'assistant', content: reply });

      // Update Subtitles
      if (captionText) {
        captionText.innerHTML = reply;
      }

      // Execute returned action if any
      if (data.action) {
        handleAction(data.action);
      }

      // Play ultra-natural voice audio
      playVoiceAudio(data.audioBase64);
    } catch (err) {
      console.error('Voice call error:', err);
      if (captionStatus) captionStatus.textContent = '// CONCIERGE';
      if (captionText) {
        captionText.textContent = "I'm having a momentary connection hitch, but our Brewns team is right here for you. Please tap one of the direct shortcuts or try again.";
      }
      setSpeaking(false);
    } finally {
      isProcessing = false;
    }
  }

  function handleAction(action: { type: string; data?: any }) {
    if (!action) return;

    if (action.type === 'ADD_TO_BAG') {
      const pIds: string[] = action.data?.productIds || [];
      if (pIds.length > 0) {
        for (const pid of pIds) {
          try {
            const p = productById(pid);
            if (p) {
              const sel = defaultSel(p);
              cart.add(pid, sel, 1);
            }
          } catch (e) {
            console.warn('Could not add product to cart:', pid, e);
          }
        }
        playChime?.();
        triggerHaptic?.(40);
        toast(`ORDER PLACED — ADDED ${pIds.length} ITEM(S) TO BAG`, 'VIEW BAG', () => openBag());
      }
    } else if (action.type === 'RESERVE_TABLE') {
      const code = action.data?.code || 'CONFIRMED';
      playChime?.();
      triggerHaptic?.(50);
      toast(`TABLE RESERVED: ${code}`, 'VIEW', () => {
        window.location.href = '/reserve';
      });
    } else if (action.type === 'BOOK_PARTY') {
      const code = action.data?.code || 'CONFIRMED';
      playChime?.();
      triggerHaptic?.(50);
      toast(`PARTY BOOKING SAVED: ${code}`, 'DETAILS');
    }
  }

  function updateMicUI() {
    if (!micToggleBtn) return;
    micToggleBtn.classList.toggle('active', isListening);
    if (micLabel) {
      micLabel.textContent = isListening ? 'LISTENING...' : 'TAP TO TALK';
    }
    if (micIcon) {
      micIcon.innerHTML = isListening
        ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
    }
  }

  function toggleMic() {
    if (!SpeechRec) {
      if (captionStatus) captionStatus.textContent = '// MIC NOTICE';
      if (captionText) {
        captionText.textContent = "Voice speech recognition is supported in modern browsers. You can also type your order or request directly!";
      }
      if (inputRow) inputRow.classList.add('open');
      textInput?.focus();
      return;
    }

    if (isListening) {
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
      isListening = false;
      updateMicUI();
      return;
    }

    try {
      recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListening = true;
        updateMicUI();
        if (captionStatus) captionStatus.textContent = '// LISTENING...';
        stopAudio();
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (textInput) textInput.value = transcript;
        if (captionText) captionText.textContent = `Hearing: "${transcript}"...`;

        // If final result
        if (event.results[0] && event.results[0].isFinal) {
          isListening = false;
          updateMicUI();
          sendPrompt(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        isListening = false;
        updateMicUI();
        if (event.error === 'not-allowed') {
          if (captionStatus) captionStatus.textContent = '// MIC PERMISSION NEEDED';
          if (captionText) captionText.textContent = 'Microphone permission was denied. Please allow microphone access or type your message below.';
        }
      };

      recognition.onend = () => {
        isListening = false;
        updateMicUI();
      };

      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      isListening = false;
      updateMicUI();
    }
  }

  function setVoiceGender(gender: 'female' | 'male') {
    currentGender = gender;
    const isFemale = gender === 'female';
    if (voiceCurrentEl) {
      voiceCurrentEl.textContent = isFemale ? 'HOST: SARAH' : 'HOST: HAMZA';
    }
    if (agentTitleEl) {
      agentTitleEl.textContent = isFemale ? 'Sarah · Brewns Front Desk' : 'Hamza · Roastery & Bar';
    }
    if (agentSubtitleEl) {
      agentSubtitleEl.textContent = isFemale
        ? 'Guest Concierge · Direct Line · MM Alam & DHA'
        : 'Specialty Roaster & Hospitality Lead';
    }
    if (avatarIcon) {
      avatarIcon.innerHTML = `<span class="vc-avatar-badge">${isFemale ? 'S' : 'H'}</span><span class="vc-avatar-status-dot"></span>`;
    }
    playSoftClick?.();
  }

  async function startCall() {
    if (!modal) return;
    isCallActive = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    conversationHistory = [];
    startTimer();

    playChime?.();
    triggerHaptic?.(50);

    if (captionStatus) captionStatus.textContent = '// DIALING BREWNS DIRECT LINE...';
    if (captionText) captionText.textContent = `Connecting to ${currentGender === 'female' ? 'Sarah' : 'Hamza'} at Brewns Concierge...`;

    // Realistic telephone ringback tone before greeting
    await playRingbackTone();
    if (!isCallActive) return;

    playChime?.();

    const initialGreeting = currentGender === 'female'
      ? "Assalam-o-Alaikum! Thank you for calling Brewns Coffee House. My name is Sarah at our guest concierge. How may I assist you today? I can prepare your food or coffee order for delivery, reserve a table at any of our three counters, or arrange a private terrace party."
      : "Assalam-o-Alaikum and welcome to Brewns! This is Hamza from our roastery and bar. How can I take care of you today? Would you like to place an order, book a table, or schedule a gathering?";

    conversationHistory.push({ role: 'assistant', content: initialGreeting });

    if (captionStatus) captionStatus.textContent = `// ${currentGender === 'female' ? 'SARAH' : 'HAMZA'} ON LINE`;
    if (captionText) captionText.textContent = initialGreeting;

    // Fetch initial greeting audio
    fetch('/api/voice/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'call_init',
        gender: currentGender,
        conversationHistory: [],
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.audioBase64 && isCallActive) {
          playVoiceAudio(data.audioBase64);
        }
      })
      .catch((err) => console.warn('Init voice call failed:', err));
  }

  function endCall() {
    if (!modal) return;
    isCallActive = false;
    modal.hidden = true;
    document.body.style.removeProperty('overflow');
    stopTimer();
    stopAudio();

    if (isListening && recognition) {
      try {
        recognition.stop();
      } catch {}
      isListening = false;
      updateMicUI();
    }

    playHangupTone();
    playSoftClick?.();
  }

  // Bind Listeners
  hdrBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    startCall();
  });

  floatBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    startCall();
  });

  menuLink?.addEventListener('click', (e) => {
    e.preventDefault();
    startCall();
  });

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    endCall();
  });

  hangupBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    endCall();
  });

  backdrop?.addEventListener('click', () => {
    endCall();
  });

  voiceSwitchBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const nextGender = currentGender === 'female' ? 'male' : 'female';
    setVoiceGender(nextGender);
    sendPrompt(`Switching voice line to ${nextGender === 'female' ? 'Sarah' : 'Hamza'}. Please greet me in your new voice.`);
  });

  micToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMic();
  });

  keypadToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (inputRow) {
      inputRow.classList.toggle('open');
      textInput?.focus();
    } else {
      textInput?.focus();
    }
    playSoftClick?.();
  });

  sendBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const txt = textInput?.value.trim() || '';
    if (txt) sendPrompt(txt);
  });

  textInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const txt = textInput.value.trim();
      if (txt) sendPrompt(txt);
    }
  });

  chipsWrap?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.voice-chip') as HTMLElement | null;
    if (chip && chip.dataset.prompt) {
      e.preventDefault();
      sendPrompt(chip.dataset.prompt);
    }
  });

  // Cleanup on unmount
  return () => {
    endCall();
  };
}
