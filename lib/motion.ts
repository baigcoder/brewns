export interface SpringConfig {
  tension?: number;
  friction?: number;
  duration?: number;
  easing?: (t: number) => number;
  clamp?: boolean;
}

export const SpringConfigs = {
  soft: { tension: 90, friction: 26 },
  punchy: { tension: 220, friction: 28 },
  snappy: { tension: 260, friction: 30 },
  gentle: { tension: 55, friction: 22 },
  drastic: { tension: 300, friction: 14 },
};

export const easings = {
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

const NUM_REGEX = /-?\d*\.?\d+/g;

function parseValues(v: number | string) {
  if (typeof v === 'number') return { template: null, nums: [v] };
  const str = String(v);
  return {
    template: str.split(NUM_REGEX),
    nums: (str.match(NUM_REGEX) || []).map(Number),
  };
}

function buildValue(template: string[] | null, nums: number[]): string | number {
  if (!template) return nums[0];
  return template.reduce((out, part, i) => out + part + (i < nums.length ? +nums[i].toFixed(4) : ''), '');
}

export class Spring {
  private apply: (values: Record<string, string | number>) => void;
  private currentVals: Record<string, number[]> = {};
  private targetVals: Record<string, number[]> = {};
  private velocities: Record<string, number[]> = {};
  private templates: Record<string, string[] | null> = {};
  private config: SpringConfig = SpringConfigs.soft;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private resolvePromise: (() => void) | null = null;

  constructor(
    initial: Record<string, string | number>,
    apply: (values: Record<string, string | number>) => void
  ) {
    this.apply = apply;
    this.set(initial);
  }

  set(values: Record<string, string | number>) {
    for (const k in values) {
      const parsed = parseValues(values[k]);
      this.templates[k] = parsed.template;
      this.currentVals[k] = parsed.nums;
      this.velocities[k] = parsed.nums.map(() => 0);
    }
    this.emit();
  }

  private emit() {
    const out: Record<string, string | number> = {};
    for (const k in this.currentVals) {
      out[k] = buildValue(this.templates[k], this.currentVals[k]);
    }
    this.apply(out);
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
    }
  }

  start(
    to: Record<string, string | number>,
    opts: { config?: SpringConfig; delay?: number; immediate?: boolean } = {}
  ): Promise<void> {
    this.stop();

    if (opts.immediate) {
      this.set(to);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const initStart = () => {
        this.config = opts.config || SpringConfigs.soft;
        for (const k in to) {
          const parsed = parseValues(to[k]);
          this.templates[k] = parsed.template;
          this.targetVals[k] = parsed.nums;
          if (!this.currentVals[k] || this.currentVals[k].length !== parsed.nums.length) {
            this.currentVals[k] = parsed.nums.slice();
            this.velocities[k] = parsed.nums.map(() => 0);
          }
        }
        this.isRunning = true;
        this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.resolvePromise = resolve;
        this.tick();
      };

      if (opts.delay && opts.delay > 0) {
        setTimeout(initStart, opts.delay);
      } else {
        initStart();
      }
    });
  }

  private tick = () => {
    if (!this.isRunning) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = Math.min(64, Math.max(0, now - this.lastTime));
    this.lastTime = now;

    const tension = this.config.tension ?? 90;
    const friction = this.config.friction ?? 26;
    let isMoving = false;

    for (const k in this.targetVals) {
      const curr = this.currentVals[k];
      const target = this.targetVals[k];
      const vel = this.velocities[k];

      for (let i = 0; i < target.length; i++) {
        let x = curr[i];
        let v = vel[i];
        const dest = target[i];

        for (let step = 0; step < dt; step++) {
          v += -tension * 1e-6 * (x - dest) - friction * 1e-3 * v;
          x += v;
        }

        const precision = 0.001;
        if (Math.abs(dest - x) <= precision && Math.abs(v) <= precision / 10) {
          x = dest;
          v = 0;
        } else {
          isMoving = true;
        }

        curr[i] = x;
        vel[i] = v;
      }
    }

    this.emit();

    if (isMoving) {
      this.animFrameId = requestAnimationFrame(this.tick);
    } else {
      this.isRunning = false;
      this.animFrameId = null;
      if (this.resolvePromise) {
        const r = this.resolvePromise;
        this.resolvePromise = null;
        r();
      }
    }
  };
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const lerp = (start: number, end: number, factor: number): number =>
  start + (end - start) * factor;
