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
  }

  function stopAudio() {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement = null;
    }
    setSpeaking(false);
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
        if (captionStatus) captionStatus.textContent = `// ${currentGender === 'female' ? 'SARAH' : 'GEORGE'} SPEAKING`;
      };

      audio.onended = () => {
        setSpeaking(false);
        if (captionStatus) captionStatus.textContent = '// LISTENING FOR YOUR REQUEST';
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

    // Stop recognition while AI replies
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
      const reply = data.reply || "I've noted that! How else can I assist you at Brewns?";

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

      // Play realistic ElevenLabs voice audio
      playVoiceAudio(data.audioBase64);
    } catch (err) {
      console.error('Voice call error:', err);
      if (captionStatus) captionStatus.textContent = '// CONCIERGE';
      if (captionText) {
        captionText.textContent = "I'm having trouble with the voice connection, but our team at Brewns is always ready to serve you! Please try again or tap one of the quick options.";
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
        toast(`AI CALL — ADDED ${pIds.length} ITEM(S) TO BAG`, 'VIEW BAG', () => openBag());
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
      micLabel.textContent = isListening ? 'LISTENING... (TAP TO SEND)' : 'TAP TO TALK';
    }
    if (micIcon) {
      micIcon.textContent = isListening ? '🔴' : '🎙️';
    }
  }

  function toggleMic() {
    if (!SpeechRec) {
      if (captionStatus) captionStatus.textContent = '// MIC NOTICE';
      if (captionText) {
        captionText.textContent = "Voice speech recognition is supported in Chrome, Edge, and Safari. You can easily type your order or question in the box below!";
      }
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
      voiceCurrentEl.textContent = isFemale ? 'SARAH (FEMALE)' : 'GEORGE (MALE)';
    }
    if (agentTitleEl) {
      agentTitleEl.textContent = isFemale ? 'Sarah · Brewns Concierge' : 'George · Brewns Concierge';
    }
    if (agentSubtitleEl) {
      agentSubtitleEl.textContent = isFemale ? 'Specialty Barista & Host · ElevenLabs Real Voice' : 'Master Roaster & Concierge · ElevenLabs Real Voice';
    }
    if (avatarIcon) {
      avatarIcon.textContent = isFemale ? '☕' : '🎙️';
    }
    playSoftClick?.();
  }

  function startCall() {
    if (!modal) return;
    isCallActive = true;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    conversationHistory = [];
    startTimer();

    playChime?.();
    triggerHaptic?.(50);

    // Initial greeting trigger
    const initialGreeting = "Welcome to Brewns Coffee House, Lahore! I'm Sarah, your AI barista and concierge. I can take your food or coffee order for delivery, reserve a table at any of our three counters, or book a private terrace party. How can I help you today?";
    conversationHistory.push({ role: 'assistant', content: initialGreeting });

    if (captionStatus) captionStatus.textContent = '// CONNECTED';
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
    sendPrompt(`Switching voice to ${nextGender === 'female' ? 'Sarah' : 'George'}. Please greet me in your new voice.`);
  });

  micToggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMic();
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
