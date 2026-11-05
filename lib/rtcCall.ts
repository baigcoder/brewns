/* The browser half of a customer ↔ rider voice call (lib/server/rtc.ts passes the handshake).
   Each side sends its whole description once its network candidates are gathered, then polls
   every second for the other half or a hang-up. */

export type CallView = { from: 'you' | 'rider'; state: 'ringing' | 'live' | 'ended'; offer: string; answer: string | null };
export type CallPhase = 'ringing' | 'connecting' | 'live' | 'ended';

const ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(process.env.NEXT_PUBLIC_TURN_URL ? [{ urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USER, credential: process.env.NEXT_PUBLIC_TURN_PASS }] : []),
];

const gathered = (pc: RTCPeerConnection) =>
  new Promise<void>((done) => {
    if (pc.iceGatheringState === 'complete') return done();
    const t = setTimeout(done, 3000); // enough candidates by then; waiting longer only delays the ring
    pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && (clearTimeout(t), done()));
  });

/**
 * Starts a call (no `offer`) or picks one up (the caller's `offer`). `post` sends `{ op, sdp }`
 * to this side's call route, `get` polls it. Returns hang-up.
 */
export function rtcCall(opts: { get: () => Promise<CallView | null>; post: (b: { op: string; sdp?: string }) => Promise<unknown>; offer?: string; onPhase: (p: CallPhase, why?: string) => void }) {
  let pc: RTCPeerConnection | null = null;
  let stream: MediaStream | null = null;
  let timer = 0;
  let done = false;
  const audio = new Audio();
  audio.autoplay = true;

  const end = (tell: boolean, why = 'Call ended') => {
    if (done) return;
    done = true;
    clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
    pc?.close();
    audio.srcObject = null;
    if (tell) opts.post({ op: 'end' }).catch(() => {});
    opts.onPhase('ended', why);
  };

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return end(!!opts.offer, 'Allow the microphone to make calls');
    }
    if (done) return stream.getTracks().forEach((t) => t.stop());
    pc = new RTCPeerConnection({ iceServers: ICE });
    stream.getTracks().forEach((t) => pc!.addTrack(t, stream!));
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'connected') opts.onPhase('live');
      if (pc?.connectionState === 'failed') end(true, 'The call dropped');
    };
    if (opts.offer) {
      await pc.setRemoteDescription({ type: 'offer', sdp: opts.offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      if (done) return;
      opts.onPhase('connecting');
      await opts.post({ op: 'answer', sdp: pc.localDescription!.sdp });
    } else {
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (done) return; // hung up while it was getting ready
      await opts.post({ op: 'offer', sdp: pc.localDescription!.sdp });
      if (done) return void opts.post({ op: 'end' }).catch(() => {});
      opts.onPhase('ringing');
    }
    timer = window.setInterval(async () => {
      const c = await opts.get().catch(() => undefined);
      if (c === undefined || done || !pc) return; // a missed poll is not a hang-up
      if (!c || c.state === 'ended') return end(false, c?.answer || opts.offer ? 'Call ended' : 'No answer');
      if (!opts.offer && c.answer && !pc.remoteDescription) {
        opts.onPhase('connecting');
        await pc.setRemoteDescription({ type: 'answer', sdp: c.answer });
      }
    }, 1000);
  })().catch((e) => end(true, (e as Error).message || 'The call could not start'));

  return () => end(true);
}
