/* The brewns concierge, two ways: a live phone call (it rings, Sarah picks
   up, an orb moves with her voice) or messages, like a chat. Both share one
   conversation, so you can start typing and then call, or the other way round.
   voiceCalling.ts drives it; the ids are its hooks. */

const icon = (d: string, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const MIC = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>';
const MIC_OFF = '<path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M19 11a7 7 0 0 1-1.1 3.8M5 11a7 7 0 0 0 10.4 6.1M12 18v3"/>';
const KEYS = '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>';
const HANGUP = '<path d="M3.6 14.6c-.6-.6-.6-1.6.1-2.1C6 10.6 8.9 9.6 12 9.6s6 1 8.3 2.9c.7.5.7 1.5.1 2.1l-1.6 1.6c-.5.5-1.3.6-1.9.2l-1.9-1.2c-.4-.3-.7-.8-.6-1.3l.1-1.2c-1.6-.5-3.3-.5-4.9 0l.1 1.2c.1.5-.2 1-.6 1.3l-1.9 1.2c-.6.4-1.4.3-1.9-.2z" fill="currentColor" stroke="none"/>';
const PHONE = '<path d="M5 4h3.5l1.6 4-2.2 1.4a11 11 0 0 0 6.7 6.7l1.4-2.2 4 1.6V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>';
const CHAT = '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/>';
const SEND = '<path d="M5 12h13M13 6l6 6-6 6"/>';
const SWAP = '<path d="M7 7h11l-3-3M17 17H6l3 3"/>';
const CLOSE = '<path d="M6 6l12 12M18 6L6 18"/>';

const CHIPS = [
  ['Order a classic smash burger and an iced latte for delivery', 'Burger &amp; iced latte'],
  ['I want to book a table for 4 at Gulberg tomorrow evening', 'Book a table'],
  ['I want to book a private party for 15 guests at the DHA terrace', 'Plan a party'],
  ['Order a bag of Slow Roast whole beans', 'Slow Roast beans'],
  ['What are your hours and where are you?', 'Hours &amp; locations'],
];

export const VOICE_CALL_MARKUP = `
<!-- The concierge: call or message -->
<div class="vcall" id="voice-call-modal" hidden role="dialog" aria-modal="true" aria-labelledby="vc-agent-title" data-phase="idle" data-mode="call">
  <div class="vcall-backdrop" id="voice-call-backdrop"></div>
  <div class="vcall-card">
    <div class="vcall-glow" aria-hidden="true"></div>
    <header class="vcall-top">
      <div class="vcall-tabs" role="tablist" aria-label="Call or message">
        <button type="button" role="tab" class="vcall-tab" data-mode="call" aria-selected="true">${icon(PHONE, 15)}<span>Call</span></button>
        <button type="button" role="tab" class="vcall-tab" data-mode="message" aria-selected="false">${icon(CHAT, 15)}<span>Message</span></button>
      </div>
      <div class="vcall-top-r">
        <button type="button" class="vcall-lang" id="vc-lang-toggle" data-lang="en" aria-label="Speaking English. Switch to Urdu"><span class="en">EN</span><span class="ur" lang="ur">اردو</span></button>
        <button type="button" class="vcall-x" id="voice-call-close" aria-label="Close">${icon(CLOSE, 18)}</button>
      </div>
    </header>

    <section class="vcall-stage">
      <div class="vcall-orb" id="vc-orb" aria-hidden="true">
        <span class="vcall-ring r3"></span><span class="vcall-ring r2"></span><span class="vcall-ring r1"></span>
        <span class="vcall-core"><span id="vc-avatar-mono">S</span></span>
        <span class="vcall-bars"><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <div class="vcall-who">
        <h2 class="vcall-name" id="vc-agent-title">Sarah</h2>
        <p class="vcall-role"><span id="vc-agent-subtitle">Front desk · brewns Lahore</span><span class="vcall-voice" id="vc-voice-tag" hidden></span></p>
        <p class="vcall-meta"><span class="vcall-hours" id="voice-hours-status" data-state="open" role="status"><i aria-hidden="true"></i><span id="voice-hours-label">OPEN · UNTIL 9 PM</span></span><span class="vcall-timer" id="voice-call-timer" hidden>00:00</span></p>
      </div>
      <p class="vcall-phase" id="voice-caption-status" aria-live="polite">Ready</p>
      <button type="button" class="vcall-switch" id="vc-voice-switch">${icon(SWAP, 14)}<span>Talk to <span id="vc-voice-current">Hamza</span></span></button>
    </section>

    <ol class="vcall-log" id="vc-log" aria-live="polite" aria-label="Conversation"></ol>

    <div class="vcall-alert" id="voice-unblock-actions" hidden>
      <p id="vc-alert-text">Your microphone is off for this site.</p>
      <div class="vcall-alert-btns">
        <button type="button" class="vcall-pill solid" id="voice-unblock-btn">Try the mic again</button>
        <button type="button" class="vcall-pill" id="voice-type-mode-btn">Message instead</button>
      </div>
    </div>

    <div class="vcall-chips" id="voice-chips-wrap" role="group" aria-label="Quick requests">
      ${CHIPS.map(([prompt, label]) => `<button type="button" class="voice-chip" data-prompt="${prompt}">${label}</button>`).join('')}
    </div>

    <form class="vcall-input" id="voice-input-row" autocomplete="off">
      <input type="text" id="voice-text-input" aria-label="Type a message" placeholder="Type a message…" enterkeyhint="send" maxlength="500" />
      <button type="submit" id="voice-send-btn" aria-label="Send">${icon(SEND, 18)}</button>
    </form>

    <div class="vcall-start" id="vc-start">
      <button type="button" class="vcall-dial" id="vc-dial">${icon(PHONE, 22)}<span>Call <span id="vc-dial-name">Sarah</span></span></button>
    </div>

    <footer class="vcall-controls">
      <button type="button" class="vcall-ctl" id="voice-keypad-toggle" aria-label="Type during the call" aria-expanded="false">${icon(KEYS)}<span>Type</span></button>
      <button type="button" class="vcall-mic" id="voice-mic-toggle" aria-pressed="false" aria-label="Mute">
        <span class="on">${icon(MIC, 26)}</span><span class="off">${icon(MIC_OFF, 26)}</span>
        <span class="vcall-mic-label" id="voice-mic-label">Mute</span>
      </button>
      <button type="button" class="vcall-ctl end" id="voice-hangup-btn" aria-label="End call">${icon(HANGUP, 26)}<span>End</span></button>
    </footer>
  </div>
</div>`;
