'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { playKitchenChime, playSuccessChime } from '@/lib/audio-alerts';

type BrewMethod = {
  id: string;
  name: string;
  icon: string;
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
    icon: '⏳',
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
    icon: '⚗️',
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
    icon: '💉',
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
    icon: '🫖',
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

export function BrewTimer() {
  const [method, setMethod] = useState<BrewMethod>(BREW_METHODS[0]);
  const [dose, setDose] = useState(method.defaultDose);
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStepIndex = useRef<number>(0);

  const totalWater = Math.round(dose * method.ratio);

  // Switch method
  const handleSelectMethod = (m: BrewMethod) => {
    setMethod(m);
    setDose(m.defaultDose);
    setRunning(false);
    setSec(0);
    lastStepIndex.current = 0;
  };

  // Timer loop
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setSec((s) => {
          if (s >= method.totalTimeSec) {
            setRunning(false);
            if (audioEnabled) playSuccessChime();
            return method.totalTimeSec;
          }
          return s + 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, method.totalTimeSec, audioEnabled]);

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

  const togglePlay = () => setRunning((r) => !r);
  const handleReset = () => {
    setRunning(false);
    setSec(0);
    lastStepIndex.current = 0;
  };

  const formatMinSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const remainder = s % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const progressPct = Math.min(100, (sec / method.totalTimeSec) * 100);

  return (
    <div
      style={{
        background: '#141413',
        border: '1px solid var(--cx-line-2, #262624)',
        borderRadius: '20px',
        padding: '36px',
        maxWidth: '820px',
        margin: '0 auto',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <p className="cx-eyebrow" style={{ color: 'var(--cx-accent, #c99355)', marginBottom: 4 }}>
            <b>{'//'}</b> Brew Companion
          </p>
          <h1 style={{ fontSize: '28px', color: '#f5ede3', fontWeight: 600, margin: 0 }}>
            Precision Pour-Over Timer
          </h1>
          <p style={{ color: 'var(--cx-muted, #8e8d88)', fontSize: '14px', marginTop: 4 }}>
            Dial in grind, exact water ratio, and time each pour with interactive audio cues.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAudioEnabled((a) => !a)}
          style={{
            background: audioEnabled ? 'rgba(201, 147, 85, 0.15)' : '#222',
            border: '1px solid #333',
            color: audioEnabled ? 'var(--cx-accent, #c99355)' : '#888',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {audioEnabled ? '🔔 Sound On' : '🔕 Sound Muted'}
        </button>
      </div>

      {/* Method Switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: 28 }}>
        {BREW_METHODS.map((m) => {
          const active = method.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelectMethod(m)}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                border: active ? '1px solid var(--cx-accent, #c99355)' : '1px solid var(--cx-line-2, #262624)',
                background: active ? 'rgba(201, 147, 85, 0.12)' : '#181817',
                color: active ? '#f5ede3' : 'var(--cx-muted, #8e8d88)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '18px' }}>{m.icon}</span>
              <span style={{ fontSize: '13px' }}>{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* Calculator Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '16px',
          background: '#1a1a19',
          padding: '18px 20px',
          borderRadius: '12px',
          border: '1px solid #282826',
          marginBottom: 32,
        }}
      >
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cx-muted, #8e8d88)', letterSpacing: '0.08em' }}>Coffee Dose</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <input
              type="number"
              min={10}
              max={60}
              value={dose}
              onChange={(e) => setDose(Math.max(1, Number(e.target.value)))}
              disabled={running}
              style={{
                width: '60px',
                padding: '4px 8px',
                background: '#0d0d0c',
                border: '1px solid #333',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 700,
                borderRadius: '6px',
              }}
            />
            <span style={{ fontSize: '14px', color: '#ccc' }}>grams</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cx-muted, #8e8d88)', letterSpacing: '0.08em' }}>Ratio</span>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#f5ede3', marginTop: 4, fontFamily: 'var(--font-space-mono)' }}>
            1:{method.ratio}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cx-muted, #8e8d88)', letterSpacing: '0.08em' }}>Target Water</span>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--cx-accent, #c99355)', marginTop: 4, fontFamily: 'var(--font-space-mono)' }}>
            {totalWater} g (ml)
          </div>
        </div>

        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--cx-muted, #8e8d88)', letterSpacing: '0.08em' }}>Grind & Temp</span>
          <div style={{ fontSize: '12px', color: '#f5ede3', marginTop: 4, lineHeight: 1.4 }}>
            {method.grind} · {method.temp}
          </div>
        </div>
      </div>

      {/* Main Timer Display */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            fontFamily: 'var(--font-space-mono)',
            fontSize: '68px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: sec >= method.totalTimeSec ? 'var(--cx-accent, #c99355)' : '#ffffff',
            lineHeight: 1,
            textShadow: '0 4px 24px rgba(0,0,0,0.8)',
          }}
        >
          {formatMinSec(sec)}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--cx-muted, #8e8d88)', marginTop: 8 }}>
          Target: {formatMinSec(method.totalTimeSec)}
        </div>

        {/* Progress Bar */}
        <div style={{ height: '6px', background: '#252523', borderRadius: '3px', margin: '20px auto 0', maxWidth: '400px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #c99355, #f3ca8c)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Current Step Instruction Card */}
      <div
        style={{
          background: 'rgba(201, 147, 85, 0.08)',
          border: '1px solid rgba(201, 147, 85, 0.25)',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: 32,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--cx-accent, #c99355)' }}>
            Phase {activeStepIdx + 1} of {method.steps.length}: {currentStep.name}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f5ede3', fontFamily: 'var(--font-space-mono)' }}>
            Target: {Math.round(totalWater * currentStep.waterPct)}g
          </span>
        </div>
        <div style={{ fontSize: '15px', color: '#f5ede3', lineHeight: 1.5 }}>
          {currentStep.instructions}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={togglePlay}
          className="cx-btn primary big"
          style={{ minWidth: '150px', fontSize: '16px' }}
        >
          {running ? '⏸ Pause' : sec === 0 ? '▶ Start Brew' : '▶ Resume'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="cx-btn big"
          style={{ background: '#222', minWidth: '110px' }}
        >
          ↺ Reset
        </button>
      </div>

      {/* Step Breakdown Timeline */}
      <div style={{ marginTop: 40, borderTop: '1px solid #222', paddingTop: 24 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--cx-muted, #8e8d88)', marginBottom: 12, letterSpacing: '0.08em' }}>
          Pour Schedule & Water Targets
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          {method.steps.map((st, i) => {
            const stepWater = Math.round(totalWater * st.waterPct);
            const isCurrent = i === activeStepIdx;
            const isDone = sec >= st.endSec;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: isCurrent ? 'rgba(201, 147, 85, 0.1)' : '#181817',
                  border: isCurrent ? '1px solid var(--cx-accent, #c99355)' : '1px solid transparent',
                  opacity: isDone ? 0.6 : 1,
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-space-mono)', color: isCurrent ? 'var(--cx-accent, #c99355)' : '#888' }}>
                    {formatMinSec(st.startSec)} – {formatMinSec(st.endSec)}
                  </span>
                  <span style={{ fontWeight: isCurrent ? 700 : 500, color: '#f5ede3' }}>{st.name}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 600, color: 'var(--cx-accent, #c99355)' }}>
                  {stepWater}g total
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
