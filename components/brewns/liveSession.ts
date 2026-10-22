'use client';

/* One Gemini Live call over a WebSocket: the caller's mic goes up as 16 kHz
   PCM, the model's voice comes back as 24 kHz PCM and is scheduled gap-free
   on the page's AudioContext. Gemini hears the caller talk over it and says
   "interrupted"; we drop whatever is still queued so it stops mid-word, like
   a person would. Tool calls arrive on the same open line. */

export type LiveEvent =
  | { type: 'agent-text'; text: string }
  | { type: 'user-text'; text: string }
  | { type: 'turn-complete' }
  | { type: 'interrupted' }
  | { type: 'tool-call'; calls: { id: string; name: string; args: Record<string, unknown> }[] }
  | { type: 'closed'; code: number; reason: string };

const IN_RATE = 16000;
const OUT_RATE = 24000;
/** How much mic audio goes up per message: small enough to feel instant, big enough not to flood the socket. */
const SEND_EVERY_SAMPLES = IN_RATE / 20; // 50 ms

/** Hands the mic's raw samples to the page (public/assets/voice/capture-worklet.js). */
const WORKLET_URL = '/assets/voice/capture-worklet.js';

/** A worklet can only be registered once per AudioContext. */
const registered = new WeakSet<BaseAudioContext>();

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private playAt = 0;
  private capture: AudioWorkletNode | ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private pending: number[] = [];
  private carry = 0;
  muted = false;
  /** Seconds to wait before a reply starts playing (0.05 is just a jitter cushion). */
  beat: () => number = () => 0.05;

  constructor(
    private ctx: AudioContext,
    /** Where the voice plays: a node that reaches the speakers (through the level meter). */
    private out: AudioNode,
    private onEvent: (e: LiveEvent) => void,
  ) {}

  /** Open the line and send the setup; resolves once Gemini says it's ready. */
  connect(url: string, setup: unknown, timeoutMs = 12000) {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let ready = false;
      const timer = setTimeout(() => {
        if (!ready) {
          reject(new Error('Live setup timed out'));
          ws.close();
        }
      }, timeoutMs);
      ws.onopen = () => ws.send(JSON.stringify({ setup }));
      ws.onerror = () => {
        if (!ready) {
          clearTimeout(timer);
          reject(new Error('Live connection failed'));
        }
      };
      ws.onclose = (e) => {
        clearTimeout(timer);
        if (!ready) reject(new Error(`Live closed before setup (${e.code}) ${e.reason}`));
        else this.onEvent({ type: 'closed', code: e.code, reason: e.reason });
        this.ws = null;
      };
      ws.onmessage = async (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text());
        } catch {
          return;
        }
        if (msg.setupComplete && !ready) {
          ready = true;
          clearTimeout(timer);
          resolve();
          return;
        }
        this.handle(msg);
      };
    });
  }

  private handle(msg: any) {
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) {
        this.stopPlayback();
        this.onEvent({ type: 'interrupted' });
      }
      for (const part of sc.modelTurn?.parts ?? []) if (part.inlineData?.data) this.play(part.inlineData.data);
      if (sc.inputTranscription?.text) this.onEvent({ type: 'user-text', text: sc.inputTranscription.text });
      if (sc.outputTranscription?.text) this.onEvent({ type: 'agent-text', text: sc.outputTranscription.text });
      if (sc.turnComplete) this.onEvent({ type: 'turn-complete' });
    }
    if (msg.toolCall?.functionCalls?.length) {
      this.onEvent({ type: 'tool-call', calls: msg.toolCall.functionCalls.map((c: any) => ({ id: c.id, name: c.name, args: c.args || {} })) });
    }
  }

  /* ── voice out ── */

  private play(b64: string) {
    const bin = atob(b64);
    const n = bin.length >> 1;
    if (!n) return;
    const buf = this.ctx.createBuffer(1, n, OUT_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
      ch[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    // The first words of a reply wait a human beat, a breath before answering,
    // never quite the same twice. The rest follow on without a gap.
    const fresh = this.playAt <= this.ctx.currentTime;
    const at = fresh ? this.ctx.currentTime + this.beat() : this.playAt;
    src.start(at);
    this.playAt = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** True while the model's voice is still coming out of the speakers. */
  get speaking() {
    return this.playAt > this.ctx.currentTime + 0.02;
  }

  stopPlayback() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
    this.playAt = 0;
  }

  /* ── voice in ── */

  async startMic(stream: MediaStream) {
    this.micSource = this.ctx.createMediaStreamSource(stream);
    const ratio = this.ctx.sampleRate / IN_RATE;
    const onFrame = (frame: Float32Array) => {
      if (this.muted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      // Average down to 16 kHz, carrying the fractional position across frames.
      let pos = this.carry;
      while (pos < frame.length) {
        const end = Math.min(frame.length, pos + ratio);
        let sum = 0;
        let count = 0;
        for (let i = Math.floor(pos); i < end; i++) {
          sum += frame[i];
          count++;
        }
        this.pending.push(count ? sum / count : 0);
        pos += ratio;
      }
      this.carry = pos - frame.length;
      if (this.pending.length >= SEND_EVERY_SAMPLES) this.flush();
    };
    try {
      if (!this.ctx.audioWorklet) throw new Error('no worklet');
      if (!registered.has(this.ctx)) {
        await this.ctx.audioWorklet.addModule(WORKLET_URL);
        registered.add(this.ctx);
      }
      const node = new AudioWorkletNode(this.ctx, 'brewns-capture');
      node.port.onmessage = (e) => onFrame(e.data as Float32Array);
      this.micSource.connect(node);
      this.capture = node;
    } catch {
      // Older Safari: the deprecated processor still works everywhere.
      const node = this.ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => onFrame(e.inputBuffer.getChannelData(0));
      this.micSource.connect(node);
      node.connect(this.ctx.destination); // must be pulled to run; it outputs silence
      this.capture = node;
    }
  }

  private flush() {
    const samples = this.pending;
    this.pending = [];
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.send({ realtimeInput: { audio: { data: toBase64(new Uint8Array(pcm.buffer)), mimeType: `audio/pcm;rate=${IN_RATE}` } } });
  }

  setMuted(muted: boolean) {
    if (muted === this.muted) return;
    this.muted = muted;
    this.pending = [];
    // Tell Gemini the caller stopped, so it doesn't wait on a half-heard sentence.
    if (muted) this.send({ realtimeInput: { audioStreamEnd: true } });
  }

  /* ── text and tools ── */

  sendText(text: string) {
    this.send({ realtimeInput: { text } });
  }

  sendToolResponses(responses: { id: string; name: string; response: unknown }[]) {
    this.send({ toolResponse: { functionResponses: responses } });
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.stopPlayback();
    try {
      this.micSource?.disconnect();
      this.capture?.disconnect();
    } catch {}
    if (this.capture && 'port' in this.capture) this.capture.port.onmessage = null;
    this.capture = null;
    this.micSource = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = ws.onmessage = ws.onerror = null;
      try {
        ws.close(1000);
      } catch {}
    }
  }
}
