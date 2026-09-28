'use client';

import { useEffect, useRef, useState } from 'react';
import { playKitchenChime, playSuccessChime } from '@/lib/audio-alerts';
import './brew.css';

type BrewMethod = {
  id: string;
  name: string;
  ratio: number; // water:coffee
  defaultDose: number; // grams
  grind: string;
  temp: string;
  totalTimeSec: number;
  steps: { name: string; startSec: number; endSec: number; waterPct: number; instructions: string }[];
};

const BREW_METHODS: BrewMethod[] = [
  {
    id: 'v60',
    name: 'Hario V60',
    ratio: 16,
    defaultDose: 15,
    grind: 'Medium-Fine (like kosher salt)',
    temp: '93°C / 200°F (30s off boil)',
    totalTimeSec: 180,
    steps: [
      { name: 'Bloom', startSec: 0, endSec: 45, waterPct: 0.2, instructions: 'Wet all grounds gently in concentric circles. Let CO2 escape.' },
      { name: 'First Pour', startSec: 45, endSec: 90, waterPct: 0.6, instructions: 'Pour in a slow, steady spiral from center outward, washing down the walls.' },
      { name: 'Second Pour', startSec: 90, endSec: 135, waterPct: 1.0, instructions: 'Top up to target water weight with a gentle center pour.' },
      { name: 'Drawdown', startSec: 135, endSec: 180, waterPct: 1.0, instructions: 'Give the dripper a gentle swirl and let gravity finish the draw.' },
    ],
  },
  {
    id: 'chemex',
    name: 'Chemex',
    ratio: 16,
    defaultDose: 25,
    grind: 'Medium-Coarse',
    temp: '94°C / 202°F',
    totalTimeSec: 240,
    steps: [
      { name: 'Bloom', startSec: 0, endSec: 50, waterPct: 0.2, instructions: 'Saturate coffee bed completely. Allow blooming for 50 seconds.' },
      { name: 'Main Pour 1', startSec: 50, endSec: 120, waterPct: 0.65, instructions: 'Pour gently in smooth spirals, keeping water level below the rim.' },
      { name: 'Main Pour 2', startSec: 120, endSec: 180, waterPct: 1.0, instructions: 'Pour remaining water steadily into the center.' },
      { name: 'Drawdown', startSec: 180, endSec: 240, waterPct: 1.0, instructions: 'Allow full filter drain. Discard filter and swirl Chemex.' },
    ],
  },
  {
    id: 'aeropress',
    name: 'AeroPress (Inverted)',
    ratio: 13,
    defaultDose: 16,
    grind: 'Fine (finer than pour-over)',
    temp: '88°C / 190°F',
    totalTimeSec: 120,
    steps: [
      { name: 'Pour & Stir', startSec: 0, endSec: 30, waterPct: 1.0, instructions: 'Add all water rapidly and stir paddle 5 times to submerge all grounds.' },
      { name: 'Steep', startSec: 30, endSec: 80, waterPct: 1.0, instructions: 'Attach cap with rinsed filter and let brew steep.' },
      { name: 'Flip & Press', startSec: 80, endSec: 120, waterPct: 1.0, instructions: 'Carefully flip onto your server and press gently for 30–40 seconds.' },
    ],
  },
  {
    id: 'frenchpress',
    name: 'French Press',
    ratio: 15,
    defaultDose: 20,
    grind: 'Coarse (sea salt consistency)',
    temp: '95°C / 203°F',
    totalTimeSec: 240,
    steps: [
      { name: 'Saturate', startSec: 0, endSec: 60, waterPct: 1.0, instructions: 'Pour all water quickly. Make sure all coffee grounds are soaked.' },
      { name: 'Break Crust', startSec: 60, endSec: 90, waterPct: 1.0, instructions: 'Stir crust 3 times with a spoon so grounds fall to the bottom.' },
      { name: 'Steep', startSec: 90, endSec: 210, waterPct: 1.0, instructions: 'Place plunger on top to retain heat. Do not press yet.' },
      { name: 'Plunge & Pour', startSec: 210, endSec: 240, waterPct: 1.0, instructions: 'Press plunger smoothly down. Pour immediately to avoid over-extraction.' },
    ],
  },
];

/** A line drawing of each brewer, in the text colour. */
function MethodIcon({ id }: { id: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (id === 'v60')
    return (
      <svg {...common}>
        <path d="M4 5h16l-6 9h-4z" />
        <path d="M9 14h6v2H9z" />
        <path d="M6 20h12" />
        <path d="M12 16v4" />
      </svg>
    );
  if (id === 'chemex')
    return (
      <svg {...common}>
        <path d="M7 3h10l-4 8 4 10H7l4-10z" />
        <path d="M9.5 11h5" />
      </svg>
    );
  if (id === 'aeropress')
    return (
      <svg {...common}>
        <rect x="8" y="6" width="8" height="14" rx="1" />
        <path d="M6 20h12" />
        <path d="M12 2v4" />
        <path d="M9 3h6" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M6 7h10v12a1 1 0 01-1 1H7a1 1 0 01-1-1z" />
      <path d="M16 10h2a1 1 0 011 1v4a1 1 0 01-1 1h-2" />
      <path d="M11 3v4" />
      <path d="M8 3h6" />
    </svg>
  );
}

export function BrewTimer() {
  const [method, setMethod] = useState<BrewMethod>(BREW_METHODS[0]);
  const [doseText, setDoseText] = useState(String(method.defaultDose));
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // The clock runs on real time, so a slow tab or a pause never drifts it.
  const startedAt = useRef(0);
  const banked = useRef(0);
  const discard = useRef(false);
  const sound = useRef(audioEnabled);
  useEffect(() => {
    sound.current = audioEnabled;
  }, [audioEnabled]);
  const lastStepIndex = useRef<number>(0);

  const dose = Math.min(60, Math.max(5, Number(doseText) || method.defaultDose));
  const totalWater = Math.round(dose * method.ratio);
  const done = sec >= method.totalTimeSec;

  const reset = () => {
    setRunning(false);
    setSec(0);
    banked.current = 0;
    discard.current = true; // a running clock's cleanup banks nothing
    lastStepIndex.current = 0;
  };

  // Switch method
  const handleSelectMethod = (m: BrewMethod) => {
    setMethod(m);
    setDoseText(String(m.defaultDose));
    reset();
  };

  // Timer loop: it stops itself and rings once at the end of the brew.
  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    discard.current = false;
    const t = setInterval(() => {
      const s = Math.floor((banked.current + Date.now() - startedAt.current) / 1000);
      setSec(Math.min(method.totalTimeSec, s));
      if (s >= method.totalTimeSec) {
        setRunning(false);
        if (sound.current) playSuccessChime();
      }
    }, 200);
    return () => {
      clearInterval(t);
      if (!discard.current) banked.current += Date.now() - startedAt.current;
    };
  }, [running, method.totalTimeSec]);

  // Current active step
  const activeStepIdx = method.steps.findIndex(
    (step) => sec >= step.startSec && sec < step.endSec
  );
  const currentStep = activeStepIdx !== -1 ? method.steps[activeStepIdx] : method.steps[method.steps.length - 1];

  // Sound chime when step changes
  useEffect(() => {
    if (running && activeStepIdx !== -1 && activeStepIdx !== lastStepIndex.current) {
      if (audioEnabled) playKitchenChime();
      lastStepIndex.current = activeStepIdx;
    }
  }, [activeStepIdx, running, audioEnabled]);

  const togglePlay = () => {
    if (done) reset();
    setRunning((r) => !r);
  };
  const handleReset = reset;

  const togglePlayRef = useRef(togglePlay);
  useEffect(() => {
    togglePlayRef.current = togglePlay;
  });

  // Space starts and pauses, unless you're typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(el.tagName)) return;
      e.preventDefault();
      togglePlayRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const formatMinSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const remainder = s % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const setDose = (g: number) => setDoseText(String(Math.min(60, Math.max(5, g))));
  const stepIdx = done ? method.steps.length : Math.max(0, activeStepIdx);
  const nextStep = method.steps[stepIdx + 1];
  const stepLeft = done ? 0 : currentStep.endSec - sec;
  const pourTo = Math.round(totalWater * currentStep.waterPct);

  // The ring: one arc per step, and the elapsed time drawn over it.
  const R = 118;
  const C = 2 * Math.PI * R;
  const gap = 6;
  const arcs = method.steps.map((st, i) => {
    const from = (st.startSec / method.totalTimeSec) * C;
    const len = ((st.endSec - st.startSec) / method.totalTimeSec) * C - gap;
    return { i, from, len: Math.max(2, len) };
  });
  const elapsed = (sec / method.totalTimeSec) * C;

  return (
    <div className="bt">
      <div className="bt-head">
        <div>
          <p className="bt-eyebrow">{'//'} Brew companion</p>
          <h1 className="bt-title">Brew timer</h1>
          <p className="bt-sub">Pick a brewer, set your dose, and follow each pour. A chime marks every step.</p>
        </div>
        <button type="button" className={`bt-sound${audioEnabled ? ' on' : ''}`} onClick={() => setAudioEnabled((a) => !a)} aria-pressed={audioEnabled} aria-label={audioEnabled ? 'Mute step chimes' : 'Turn on step chimes'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5L6 9H3v6h3l5 4z" />
            {audioEnabled ? <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /> : <path d="M16 9l5 6M21 9l-5 6" />}
          </svg>
          <span>{audioEnabled ? 'Chimes on' : 'Chimes off'}</span>
        </button>
      </div>

      <div className="bt-methods" role="tablist" aria-label="Brewer">
        {BREW_METHODS.map((m) => {
          const active = method.id === m.id;
          return (
            <button key={m.id} type="button" role="tab" aria-selected={active} className={`bt-method${active ? ' on' : ''}`} onClick={() => handleSelectMethod(m)}>
              <span className="bt-method-icon">
                <MethodIcon id={m.id} />
              </span>
              <span className="bt-method-text">
                <b>{m.name.replace(' (Inverted)', '')}</b>
                <small>
                  1:{m.ratio} · {Math.round(m.totalTimeSec / 60)} min{m.id === 'aeropress' ? ' · inverted' : ''}
                </small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="bt-main">
        <div className="bt-clock">
          <div className="bt-ring">
            <svg viewBox="0 0 280 280" aria-hidden="true">
              {arcs.map((a) => (
                <circle key={a.i} cx="140" cy="140" r={R} className={`bt-arc${a.i < stepIdx ? ' past' : a.i === stepIdx && (running || sec > 0) ? ' now' : ''}`} strokeDasharray={`${a.len} ${C}`} strokeDashoffset={-a.from} />
              ))}
              <circle cx="140" cy="140" r={R} className="bt-progress" strokeDasharray={`${elapsed} ${C}`} />
            </svg>
            <div className="bt-ring-in">
              <span className="bt-ring-step">{done ? 'Done' : sec === 0 && !running ? 'Ready' : currentStep.name}</span>
              <span className={`bt-time${done ? ' done' : ''}`} aria-live="off">
                {formatMinSec(sec)}
              </span>
              <span className="bt-ring-of">of {formatMinSec(method.totalTimeSec)}</span>
            </div>
          </div>
          <div className="bt-controls">
            <button type="button" className="bt-play" onClick={togglePlay}>
              {running ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" />
                </svg>
              )}
              <span>{running ? 'Pause' : done ? 'Brew again' : sec === 0 ? 'Start brew' : 'Resume'}</span>
            </button>
            <button type="button" className="bt-reset" onClick={handleReset} disabled={sec === 0 && !running} aria-label="Reset timer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
          <p className="bt-hint">
            <kbd>Space</kbd> to start or pause
          </p>
        </div>

        <div className="bt-side">
          <div className={`bt-now${done ? ' done' : ''}`} aria-live="polite">
            <div className="bt-now-top">
              <span className="bt-now-label">{done ? 'Brew complete' : `Step ${stepIdx + 1} of ${method.steps.length}`}</span>
              {!done && (running || sec > 0) && <span className="bt-now-left">next in {formatMinSec(stepLeft)}</span>}
            </div>
            <h2 className="bt-now-name">{done ? 'Enjoy your cup' : currentStep.name}</h2>
            <p className="bt-now-text">{done ? 'Let it cool a minute, then taste. Too sour next time? Grind a little finer. Too bitter? A little coarser.' : currentStep.instructions}</p>
            <div className="bt-pour">
              <span>{done ? 'Poured' : 'Pour until the scale reads'}</span>
              <b>
                {done ? totalWater : pourTo}
                <small> g</small>
              </b>
            </div>
            {nextStep && !done && (
              <p className="bt-next">
                Then: <b>{nextStep.name}</b> at {formatMinSec(nextStep.startSec)}
                {Math.round(totalWater * nextStep.waterPct) !== pourTo ? ` · to ${Math.round(totalWater * nextStep.waterPct)} g` : ''}
              </p>
            )}
          </div>

          <div className="bt-recipe">
            <div className="bt-dose">
              <span className="bt-k">Coffee</span>
              <div className="bt-stepper">
                <button type="button" onClick={() => setDose(dose - 1)} disabled={running || dose <= 5} aria-label="One gram less">
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={60}
                  value={doseText}
                  aria-label="Coffee dose in grams"
                  onChange={(e) => setDoseText(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                  onBlur={() => setDoseText(String(dose))}
                  disabled={running}
                />
                <span className="bt-unit">g</span>
                <button type="button" onClick={() => setDose(dose + 1)} disabled={running || dose >= 60} aria-label="One gram more">
                  +
                </button>
              </div>
            </div>
            <dl className="bt-specs">
              <div>
                <dt>Water</dt>
                <dd className="gold">{totalWater} g</dd>
              </div>
              <div>
                <dt>Ratio</dt>
                <dd>1:{method.ratio}</dd>
              </div>
              <div>
                <dt>Grind</dt>
                <dd>{method.grind}</dd>
              </div>
              <div>
                <dt>Water temp</dt>
                <dd>{method.temp}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="bt-schedule">
        <p className="bt-k">Pour schedule</p>
        <ol>
          {method.steps.map((st, i) => {
            const state = done || i < stepIdx ? 'past' : i === stepIdx && (running || sec > 0) ? 'now' : '';
            return (
              <li key={i} className={state}>
                <span className="bt-dot" aria-hidden="true">
                  {state === 'past' ? '✓' : i + 1}
                </span>
                <span className="bt-sch-name">{st.name}</span>
                <span className="bt-sch-time">
                  {formatMinSec(st.startSec)}–{formatMinSec(st.endSec)}
                </span>
                <span className="bt-sch-g">{Math.round(totalWater * st.waterPct)} g</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
