'use client';

/* One Gemini Live call over a WebSocket: the caller's mic goes up as 16 kHz
   PCM, the model's voice comes back as 24 kHz PCM and is scheduled gap-free
   on the page's AudioContext. Gemini hears the caller talk over it and says
   "interrupted"; we drop whatever is still queued so it stops mid-word, like
   a person would. Tool calls arrive on the same open line.

   One session can outlive its connection: Gemini hands over a resumption
   handle every few turns, warns ("goAway") before it recycles a connection,
   and connect() can be called again on the same session, keeping the mic and
   the speakers running, to carry on the same conversation on a new line. */

export type LiveEvent =
  | { type: 'agent-text'; text: string }
  | { type: 'user-text'; text: string }
  | { type: 'turn-complete' }
  | { type: 'interrupted' }
  /** Gemini heard the caller start talking (its own voice activity detection). */
  | { type: 'caller-start' }
  | { type: 'tool-call'; calls: { id: string; name: string; args: Record<string, unknown> }[] }
  /** The connection will be recycled in `ms`; reconnect with the resume handle before then. */
  | { type: 'go-away'; ms: number }
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
  /** The latest handle Gemini gave for resuming this conversation on a new connection. */
  resumeHandle = '';
  /** Seconds to wait before a reply starts playing (0.05 is just a jitter cushion). */
  beat: () => number = () => 0.05;

  constructor(
    private ctx: AudioContext,
    /** Where the voice plays: a node that reaches the speakers (through the level meter). */
    private out: AudioNode,
    private onEvent: (e: LiveEvent) => void,
  ) {}

  /** Open the line and send the setup; resolves once Gemini says it's ready.
      Called again on a live session, it replaces the connection: the old one
      is let go quietly and the mic carries on into the new one. */
  connect(url: string, setup: unknown, timeoutMs = 12000) {
    this.dropSocket();
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      let ready = false;
      const timer = setTimeout(() => {
        if (!ready) {
          reject(new Error('Live setup timed out'));
          ws.onclose = null;
          ws.close();
          if (this.ws === ws) this.ws = null;
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
        if (this.ws === ws) this.ws = null;
        if (!ready) reject(new Error(`Live closed before setup (${e.code}) ${e.reason}`));
        else this.onEvent({ type: 'closed', code: e.code, reason: e.reason });
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
        // Report first, so the caption can still be cut back to what was heard.
        this.onEvent({ type: 'interrupted' });
        this.stopPlayback();
        this.endReply();
      }
      for (const part of sc.modelTurn?.parts ?? []) if (part.inlineData?.data) this.play(part.inlineData.data);
      if (sc.inputTranscription?.text) this.onEvent({ type: 'user-text', text: sc.inputTranscription.text });
      // A hushed reply's words aren't shown either: the caller never heard them.
      if (sc.outputTranscription?.text && !this.hushed) this.onEvent({ type: 'agent-text', text: sc.outputTranscription.text });
      if (sc.turnComplete) this.endReply();
      // Generation done: nothing more of this reply will arrive, so nothing more to drop.
      else if (sc.generationComplete) this.replying = this.hushed = false;
      if (sc.turnComplete) this.onEvent({ type: 'turn-complete' });
    }
    const activity = msg.voiceActivity || sc?.voiceActivity;
    if (activity?.type === 'ACTIVITY_START' || activity?.voiceActivityType === 'ACTIVITY_START') this.onEvent({ type: 'caller-start' });
    const update = msg.sessionResumptionUpdate;
    if (update?.newHandle && update.resumable !== false) this.resumeHandle = update.newHandle;
    if (msg.goAway) this.onEvent({ type: 'go-away', ms: parseDuration(msg.goAway.timeLeft) });
    if (msg.toolCall?.functionCalls?.length) {
      this.onEvent({ type: 'tool-call', calls: msg.toolCall.functionCalls.map((c: any) => ({ id: c.id, name: c.name, args: c.args || {} })) });
    }
  }

  /* ── voice out ── */

  /** Mid-reply: true from the reply's first audio until its turn completes or is interrupted. */
  private replying = false;
  /** The caller cut in: what's left of this reply is dropped as it arrives. */
  private hushed = false;

  /** This reply so far: seconds of voice received, and when its first words started playing. */
  private replySeconds = 0;
  private replyStart = 0;

  /** Stop talking now, and don't pick the same reply up again as more of it streams in.
      The next reply plays as normal. Returns how much of what had arrived was
      actually heard (0–1), since the words run ahead of the voice. */
  hush() {
    const heard = this.replySeconds ? Math.min(1, Math.max(0, (this.ctx.currentTime - this.replyStart) / this.replySeconds)) : 1;
    this.stopPlayback();
    if (this.replying) this.hushed = true;
    return heard;
  }

  private endReply() {
    this.replying = this.hushed = false;
    this.replySeconds = 0;
  }

  private play(b64: string) {
    this.replying = true;
    if (this.hushed) return;
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
    if (!this.replySeconds) this.replyStart = at;
    this.replySeconds += buf.duration;
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

  /** Let the current connection go without reporting it as a drop. */
  private dropSocket() {
    const ws = this.ws;
    this.ws = null;
    this.pending = [];
    if (ws) {
      ws.onclose = ws.onmessage = ws.onerror = null;
      try {
        ws.close(1000);
      } catch {}
    }
  }

  /** A new microphone (the old one was unplugged, or a headset connected): the line carries on from it. */
  async swapMic(stream: MediaStream) {
    this.stopMic();
    await this.startMic(stream);
  }

  private stopMic() {
    try {
      this.micSource?.disconnect();
      this.capture?.disconnect();
    } catch {}
    if (this.capture && 'port' in this.capture) this.capture.port.onmessage = null;
    this.capture = null;
    this.micSource = null;
  }

  close() {
    this.stopPlayback();
    this.stopMic();
    this.dropSocket();
  }
}

/** "12.5s" (a protobuf Duration as JSON) → 12500 ms; unknown means "soon". */
function parseDuration(d: unknown) {
  const s = typeof d === 'string' ? parseFloat(d) : typeof d === 'object' && d ? Number((d as any).seconds || 0) : NaN;
  return Number.isFinite(s) ? s * 1000 : 5000;
}
