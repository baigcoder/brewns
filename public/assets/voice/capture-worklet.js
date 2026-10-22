/* The concierge call's microphone tap: passes each block of raw samples to the
   page, which downsamples them to 16 kHz for the live line (liveSession.ts). */
class BrewnsCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('brewns-capture', BrewnsCapture);
