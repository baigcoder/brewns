// @ts-nocheck
'use client';

import Lenis from 'lenis';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  initAudioState,
  toggleAudioState,
  getIsAudioEnabled,
  playCupClink,
  playBeanClatter,
  playPaperFeed,
  playPaperTear,
  playPourDrop,
  playSoftClick,
  triggerHaptic
} from '@/lib/audio-ritual';
import { TasteCalibrator } from './TasteCalibrator';
import { foodArt } from './foodArt';
import { createBakeryModel, createIcedGlassModel, createProduct3DModel, dressPackaging, extractPackagingPiece, PACKAGING_POSE } from './pdp3dEngine';


export function initBrewns(container: HTMLElement = document.body) {
  if (typeof window === 'undefined') return () => {};



/* ═══════════ constants ═══════════ */
const ASSET_BASE_URL = "/assets/";
const MODEL_URL = ASSET_BASE_URL + "hero/models.glb";
/* Bump when scripts/build-models.mjs is re-run. The glb is served with an ETag
   and max-age=0, so a reload revalidates — but a tab left open across a rebuild
   keeps the model it already parsed, which reads as a rendering bug rather than a
   stale file. The query string makes a changed model a different URL. */
const MODELS_VERSION = "4";
const ICED_CUP_URL = `${ASSET_BASE_URL}shop/iced-cup.glb?v=${MODELS_VERSION}`;
/* Keyed by product, not by viewer kind: the cardamom bun is a bakery piece too,
   but it is modelled procedurally and has no use for the roll's half-megabyte.
   A new glass or bakery product that should use these assets needs a line here —
   without one its builder has no model to bind and the viewer says so. */
const SHOP_MODEL_URL = {
  "iced-matcha": ICED_CUP_URL,
  "iced-latte": ICED_CUP_URL,
  "cinnamon-roll": `${ASSET_BASE_URL}shop/cinnamon-roll.glb?v=${MODELS_VERSION}`,
};
const DRACO_PATH = "/draco/gltf/";
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const noHover = () => window.innerWidth < 768;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const banner = (message) => {
  const p = document.createElement("p");
  p.textContent = message;
  $("#banner").append(p);
};

/* ═══════════ root font-size above the board ═══════════ */
const FONT_BASE = 16, BASE_WIDTH = 1440, COEF = 0.6666;
const interpolateFontSize = (w) => {
  const widthReduction = ((BASE_WIDTH - w) / BASE_WIDTH) * 100;
  return FONT_BASE - (FONT_BASE * widthReduction * COEF) / 100;
};
/* Every desktop block is a 50rem-tall board. Sized by width alone, a window
   shorter than the board's proportion crops the bottom of every section, so the
   root is also held to the window's height — the board shrinks to fit instead. */
const BOARD_REM = 50;
const applyGrid = () => {
  const w = window.innerWidth;
  if (w < 1024) return document.documentElement.style.removeProperty("font-size");
  const byWidth = w >= BASE_WIDTH ? interpolateFontSize(w) : FONT_BASE - (BASE_WIDTH - w) / 128.57;
  const size = Math.min(byWidth, Math.max(window.innerHeight / BOARD_REM, byWidth * 0.7));
  document.documentElement.style.setProperty("font-size", `${size}px`);
};
applyGrid();
window.addEventListener("resize", applyGrid);

/* ═══════════ Audio Immersion & Header Sound Toggle ═══════════ */
initAudioState();
const soundBtn = $("#sound-toggle");
const soundLabel = $("#sound-label");
const updateSoundUI = () => {
  const on = getIsAudioEnabled();
  soundBtn?.classList.toggle("active", on);
  if (soundLabel) soundLabel.textContent = on ? "SOUND: ON" : "SOUND";
};
updateSoundUI();
soundBtn?.addEventListener("click", () => {
  toggleAudioState();
  updateSoundUI();
});

/* ═══════════ Liquid Pour Droplet Fly-in ═══════════ */
const flyLiquidDrop = (fromElement) => {
  if (!fromElement) return;
  const startRect = fromElement.getBoundingClientRect();
  const targetRect = $("#bag-count")?.getBoundingClientRect() || $("#bag-open")?.getBoundingClientRect();
  if (!targetRect) return;

  const drop = document.createElement("div");
  drop.className = "pour-drop";
  document.body.appendChild(drop);

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const startTime = performance.now();
  const duration = 600;

  const animateDrop = (now) => {
    const elapsed = now - startTime;
    const p = Math.min(1, elapsed / duration);
    const arcHeight = Math.min(120, Math.abs(targetX - startX) * 0.25 + 50);
    const currX = startX + (targetX - startX) * p;
    const currY = startY + (targetY - startY) * p - Math.sin(p * Math.PI) * arcHeight;

    drop.style.left = `${currX}px`;
    drop.style.top = `${currY}px`;
    drop.style.transform = `translate(-50%, -50%) scale(${1 - p * 0.3})`;

    if (p < 1) {
      requestAnimationFrame(animateDrop);
    } else {
      drop.remove();
      playPourDrop();
      countBump.set({ scale: 1.5 });
      countBump.start({ scale: 1 }, { config: C(300, 14) });
    }
  };
  requestAnimationFrame(animateDrop);
};

/* ═══════════ Live Location Counter Wait Times ═══════════ */
const updateLiveLocations = () => {
  const now = new Date();
  const sfTimeStr = now.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour12: false, hour: "numeric", minute: "numeric" });
  const [h, m] = sfTimeStr.split(":").map(Number);
  const currentMin = h * 60 + m;

  let b0 = "● STEADY BREW · ~4 MIN";
  let b1 = "● STEADY BREW · ~3 MIN";
  let b2 = "● STEADY BREW · ~5 MIN";

  if (currentMin < 7 * 60 || currentMin >= 21 * 60) {
    b0 = "○ CLOSED · OPENS 07:00";
    b1 = "○ CLOSED · OPENS 07:00";
    b2 = "○ CLOSED · OPENS 07:00";
  } else if (currentMin >= 7 * 60 && currentMin <= 9 * 60 + 30) {
    b0 = "● MORNING PEAK · ~7 MIN";
    b1 = "● MORNING PEAK · ~6 MIN";
    b2 = "● MORNING PEAK · ~8 MIN";
  } else if (currentMin >= 12 * 60 && currentMin <= 13 * 60 + 45) {
    b0 = "● MIDDAY RUSH · ~5 MIN";
    b1 = "● MIDDAY RUSH · ~4 MIN";
    b2 = "● MIDDAY RUSH · ~6 MIN";
  }

  const el0 = $("#loc-status-0");
  const el1 = $("#loc-status-1");
  const el2 = $("#loc-status-2");
  if (el0) el0.textContent = b0;
  if (el1) el1.textContent = b1;
  if (el2) el2.textContent = b2;
};
updateLiveLocations();
const liveLocationsTimer = setInterval(updateLiveLocations, 30000);


/* ═══════════ smooth scroll ═══════════ */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);
const lenis = new Lenis({ smoothWheel: true });
window.lenis = lenis;
const root = document.documentElement;
const stopScroll = () => {
  lenis.stop();
  Object.assign(root.style, { position: "relative", overflow: "hidden", height: "100%" });
};
const startScroll = () => {
  lenis.start();
  for (const p of ["position", "overflow", "height"]) root.style.removeProperty(p);
};

/* ═══════════ shared ticker ═══════════ */
const subscribers = new Set();
const loop = (fn, gap = 0) => {
  const s = { fn, gap, last: -Infinity };
  subscribers.add(s);
  return () => subscribers.delete(s);
};
let tickRaf = 0;
const tick = (time) => {
  lenis.raf(time);
  for (const s of subscribers) {
    if (time - s.last <= s.gap) continue;
    s.last = time;
    s.fn(time);
  }
  tickRaf = requestAnimationFrame(tick);
};
tickRaf = requestAnimationFrame(tick);

/* ═══════════ page-ready store ═══════════ */
const page = {
  revealing: REDUCED,
  ready: REDUCED,
  listeners: new Set(),
  set(patch) {
    Object.assign(this, patch);
    this.listeners.forEach((f) => f(this));
  },
  subscribe(f) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  },
};
const whenReady = (cb) => {
  if (page.ready) return cb();
  const off = page.subscribe((s) => {
    if (!s.ready) return;
    off();
    cb();
  });
};

/* ═══════════ spring solver ═══════════ */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const C = (tension, friction) => ({ tension, friction });

const NUM = /-?\d*\.?\d+/g;
const parse = (v) => {
  if (typeof v === "number") return { tpl: null, nums: [v] };
  const s = String(v);
  return { tpl: s.split(NUM), nums: (s.match(NUM) || []).map(Number) };
};
const build = (tpl, nums) =>
  tpl ? tpl.reduce((out, part, i) => out + part + (i < nums.length ? +nums[i].toFixed(4) : ""), "") : nums[0];

const active = new Set();
loop((now) => {
  for (const s of active) s.advance(now);
});

class Spring {
  constructor(from, apply) {
    this.apply = apply;
    this.gen = 0;
    this.tpl = {};
    this.x = {};
    this.v = {};
    this.set(from);
  }
  set(values) {
    for (const k in values) {
      const p = parse(values[k]);
      this.tpl[k] = p.tpl;
      this.x[k] = p.nums;
      this.v[k] = p.nums.map(() => 0);
    }
    this.emit();
  }
  emit() {
    const o = {};
    for (const k in this.x) o[k] = build(this.tpl[k], this.x[k]);
    this.apply(o);
  }
  stop() {
    this.gen++;
    clearTimeout(this.timer);
    active.delete(this);
  }
  start(to, { config = C(90, 26), delay = 0, immediate = false } = {}) {
    this.stop();
    const gen = this.gen;
    return new Promise((resolve) => {
      const go = () => {
        if (gen !== this.gen) return;
        if (immediate) {
          this.set(to);
          resolve();
          return;
        }
        this.to = {};
        this.from = {};
        for (const k in to) {
          const p = parse(to[k]);
          // "inset(0 100% 0 0)" → "inset(0 0 0 0)": keep the unit from whichever side has it,
          // or the in-between "inset(0 57 0 0)" is invalid CSS and never lands.
          const prev = this.tpl[k];
          this.tpl[k] = p.tpl && prev && prev.length === p.tpl.length ? p.tpl.map((part, i) => (prev[i].length > part.length ? prev[i] : part)) : p.tpl;
          this.to[k] = p.nums;
          if (!this.x[k] || this.x[k].length !== p.nums.length) {
            this.x[k] = p.nums.slice();
            this.v[k] = p.nums.map(() => 0);
          }
          this.from[k] = this.x[k].slice();
        }
        this.cfg = config;
        this.t0 = this.last = performance.now();
        this.resolve = resolve;
        active.add(this);
      };
      if (delay > 0) this.timer = setTimeout(go, delay);
      else go();
    });
  }
  advance(now) {
    const dt = Math.min(64, Math.max(0, now - this.last));
    this.last = Math.max(this.last, now);
    const c = this.cfg;
    let moving = false;
    for (const k in this.to) {
      const x = this.x[k], v = this.v[k], to = this.to[k], from = this.from[k];
      for (let i = 0; i < to.length; i++) {
        if (c.duration != null) {
          const p = Math.min(1, Math.max(0, (now - this.t0) / c.duration));
          x[i] = from[i] + (to[i] - from[i]) * (c.easing ? c.easing(p) : p);
          if (p < 1) moving = true;
          continue;
        }
        const precision = Math.max(1e-4, Math.min(0.01, Math.abs(to[i] - from[i]) * 1e-3));
        let xi = x[i], vi = v[i];
        for (let n = 0; n < dt; n++) {
          vi += -c.tension * 1e-6 * (xi - to[i]) - c.friction * 1e-3 * vi;
          xi += vi;
          if (c.clamp && (from[i] < to[i] ? xi > to[i] : xi < to[i])) {
            xi = to[i];
            vi = 0;
            break;
          }
        }
        if (Math.abs(to[i] - xi) <= precision && Math.abs(vi) <= precision / 10) {
          xi = to[i];
          vi = 0;
        } else moving = true;
        x[i] = xi;
        v[i] = vi;
      }
    }
    this.emit();
    if (!moving) {
      active.delete(this);
      const r = this.resolve;
      this.resolve = null;
      r?.();
    }
  }
}

const unit = (v, u = "px") => (typeof v === "number" ? v + u : v);
const styler = (el) => (o) => {
  let t = "";
  if ("x" in o || "y" in o) t += `translate3d(${unit(o.x ?? 0)}, ${unit(o.y ?? 0)}, 0)`;
  if ("scale" in o) t += ` scale(${o.scale})`;
  if ("rotate" in o) t += ` rotate(${unit(o.rotate, "deg")})`;
  if ("transform" in o) t += ` ${o.transform}`;
  if (t) el.style.transform = t;
  if ("opacity" in o) el.style.opacity = o.opacity;
  if ("clipPath" in o) el.style.clipPath = o.clipPath;
};

/* ═══════════ Inview / Hover ═══════════ */
const onceVisible = (el, cb, { rootMargin = "0px", gate = true, threshold = 0 } = {}) => {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      gate ? whenReady(cb) : cb();
    },
    { rootMargin, threshold },
  );
  io.observe(el);
};

const inview = (el, from, to, { config, delay = 0, rootMargin, gate = true, trigger = el } = {}) => {
  const s = new Spring(from, styler(el));
  if (REDUCED) s.set(to);
  else onceVisible(trigger, () => s.start(to, { config, delay }), { rootMargin, gate });
  return s;
};

const hover = (el, trigger, from, to, { config = C(90, 26), delayIn = 0, immediateOut = false, focus = false } = {}) => {
  const s = new Spring(from, styler(el));
  const on = () => !noHover() && s.start(to, { config, delay: delayIn });
  const off = () => !noHover() && s.start(from, { config, immediate: immediateOut });
  trigger.addEventListener("mouseenter", on);
  trigger.addEventListener("mouseleave", off);
  if (focus) {
    trigger.addEventListener("focus", on);
    trigger.addEventListener("blur", off);
  }
  return s;
};

/* ═══════════ scroll scrub ═══════════ */
const lerp = (a, b, t) => a + (b - a) * t;

const interpolate = (start, end, progress) => {
  const result = {};
  const extractNumber = (value) => {
    if (typeof value === "number") return { number: value, unit: null };
    if (typeof value === "string") {
      const functionMatch = value.match(/^([a-zA-Z]+)\(([-0-9.]+)([^)]*)\)$/);
      if (functionMatch) {
        return { number: parseFloat(functionMatch[2]), unit: `${functionMatch[1]}(${functionMatch[3]})` };
      }
      const match = value.match(/([-0-9.]+)([^0-9.]+)/);
      if (match) return { number: parseFloat(match[1]), unit: match[2] };
    }
    return { number: 0, unit: null };
  };
  for (const key in start) {
    const startVal = extractNumber(start[key]);
    const endVal = extractNumber(end[key]);
    if (startVal.unit !== null || endVal.unit !== null) {
      const u = startVal.unit || endVal.unit;
      if (u?.includes("(")) {
        result[key] = `${u.split("(")[0]}(${lerp(startVal.number, endVal.number, progress)}${u.split(")")[0].slice(u.split("(")[0].length)})`;
      } else {
        result[key] = `${lerp(startVal.number, endVal.number, progress)}${u}`;
      }
    } else {
      result[key] = lerp(startVal.number, endVal.number, progress);
    }
  }
  return result;
};

const progressOf = (el, start, end) => {
  const bb = el.getBoundingClientRect(), clientHeight = window.innerHeight;
  const poses = {
    top_top: bb.top,
    center_top: bb.top + bb.height / 2,
    bottom_top: bb.bottom,
    top_bottom: bb.top - clientHeight,
    center_bottom: bb.top + bb.height / 2 - clientHeight,
    bottom_bottom: bb.bottom - clientHeight,
    top_center: bb.top - clientHeight / 2,
    center_center: bb.top + bb.height / 2 - clientHeight / 2,
    bottom_center: bb.bottom - clientHeight / 2,
  };
  const scrollStart = poses[start.replace(" ", "_")], scrollEnd = poses[end.replace(" ", "_")];
  const length = Math.abs(scrollStart - scrollEnd);
  return Math.min(Math.max(0, 1 - (scrollStart + length) / length), 1);
};

const scrub = (el, trigger, start, end, from, to, reducedProgress = 1) => {
  const apply = styler(el);
  if (REDUCED) return apply(interpolate(from, to, reducedProgress));
  let last = -1;
  const update = () => {
    const p = Math.round(progressOf(trigger, start, end) * 1000) / 1000;
    if (p === last) return;
    last = p;
    apply(interpolate(from, to, p));
  };
  let off = null;
  const io = new IntersectionObserver(
    ([entry]) => {
      update();
      if (entry.isIntersecting) off ||= loop(update, 10);
      else if (off) {
        off();
        off = null;
      }
    },
    { rootMargin: "10% 0px" },
  );
  io.observe(trigger);
  update();
};

/* ═══════════ TextEngine ═══════════ */
const textEngine = (el) => {
  const d = el.dataset;
  const text = el.textContent.trim().replace(/\s+/g, " ");
  const lines = d.te === "lines";
  const duration = +(d.dur || (lines ? 900 : 650));
  const stagger = +(d.st || (lines ? 90 : 18));
  const delayIn = +(d.d || 0);
  const from = lines ? { y: "110%", opacity: 0 } : { y: +(d.y || 14), opacity: 0 };
  const to = lines ? { y: "0%", opacity: 1 } : { y: 0, opacity: 1 };
  const easing = lines ? easeOutCubic : easeOutQuart;
  el.classList.add("te");
  if (!lines) el.classList.add("te-words");
  if ("clip" in d) el.classList.add("te-clip");
  if ("tight" in d) el.classList.add("te-tight");

  let played = false, springs = [], width = 0;
  const span = (cls, txt) => {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    if (txt != null) s.textContent = txt;
    return s;
  };
  const render = () => {
    const sr = span("sr-only", text);
    const words = text.split(" ");
    let units;
    if (lines) {
      el.textContent = "";
      el.style.display = "block";
      const probes = words.map((w, i) => {
        const p = span(null, w);
        p.style.display = "inline-block";
        el.append(p);
        if (i < words.length - 1) el.append(" ");
        return p;
      });
      const groups = [];
      let top = null;
      probes.forEach((p, i) => {
        if (top === null || Math.abs(p.offsetTop - top) > 2) {
          groups.push([]);
          top = p.offsetTop;
        }
        groups[groups.length - 1].push(words[i]);
      });
      el.style.removeProperty("display");
      el.textContent = "";
      el.append(sr);
      units = groups.map((g) => {
        const line = span("te-line");
        line.setAttribute("aria-hidden", "true");
        const inner = span(null, g.join(" "));
        line.append(inner);
        el.append(line);
        return inner;
      });
    } else {
      el.textContent = "";
      el.append(sr);
      units = words.map((w) => {
        const s = span("te-word", w);
        s.setAttribute("aria-hidden", "true");
        el.append(s);
        return s;
      });
    }
    springs.forEach((s) => s.stop());
    springs = units.map((u) => new Spring(played || REDUCED ? to : from, styler(u)));
    width = el.clientWidth;
  };
  const play = () => {
    played = true;
    springs.forEach((s, i) => s.start(to, { config: { duration, easing }, delay: delayIn + i * stagger }));
  };
  render();
  if (!REDUCED) onceVisible(el, play, { rootMargin: d.margin });
  if (lines) {
    new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - width) < 1) return;
      render();
    }).observe(el);
  }
};

/* ═══════════ DigitRoll ═══════════ */
const digitRoll = (el) => {
  const text = el.textContent;
  const delayIn = +(el.dataset.d || 0);
  el.textContent = "";
  const box = document.createElement("span");
  box.className = "dr";
  const ghost = document.createElement("span");
  ghost.className = "dr-ghost";
  ghost.textContent = text;
  const cells = document.createElement("span");
  cells.className = "dr-cells";
  cells.setAttribute("aria-hidden", "true");
  const rolls = [];
  let order = 0;
  for (const ch of text) {
    if (/\d/.test(ch)) {
      const col = document.createElement("span");
      col.className = "dr-col";
      const stack = document.createElement("span");
      stack.className = "dr-stack";
      for (let n = 0; n < 10; n++) {
        const c = document.createElement("span");
        c.textContent = n;
        stack.append(c);
      }
      col.append(stack);
      cells.append(col);
      rolls.push({
        spring: new Spring({ transform: "translateY(0%)" }, styler(stack)),
        to: `translateY(-${+ch * 10}%)`,
        delay: delayIn + order++ * 70,
      });
    } else {
      const c = document.createElement("span");
      c.className = "dr-char";
      c.textContent = ch;
      cells.append(c);
    }
  }
  box.append(ghost, cells);
  el.append(box);
  if (REDUCED) rolls.forEach((r) => r.spring.set({ transform: r.to }));
  else onceVisible(el, () => rolls.forEach((r) => r.spring.start({ transform: r.to }, { config: C(90, 26), delay: r.delay })));
};

/* ═══════════ small primitives ═══════════ */
const rise = (el) => {
  el.classList.add("rise");
  const inner = document.createElement("span");
  inner.append(...el.childNodes);
  el.append(inner);
  inview(inner, { transform: "translateY(150%)" }, { transform: "translateY(0%)" }, { config: C(80, 26), delay: +(el.dataset.d || 0), trigger: el });
};

const underline = (a) => {
  const label = a.textContent;
  a.innerHTML = `<span class="ul-box"><span class="ul-clip"><span class="ul-a"></span><span class="ul-b" aria-hidden="true"></span></span></span>`;
  const [real, dup] = $$(".ul-a, .ul-b", a);
  real.textContent = dup.textContent = label;
  const cfg = { config: C(260, 30) };
  hover(real, a, { transform: "translateY(0%)" }, { transform: "translateY(-100%)" }, cfg);
  hover(dup, a, { transform: "translateY(100%)" }, { transform: "translateY(0%)" }, cfg);
  if ("rule" in a.dataset) {
    const rule = document.createElement("span");
    rule.className = "ul-rule";
    $(".ul-box", a).append(rule);
    hover(rule, a, { transform: "scaleX(0)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }, { config: C(220, 28) });
  }
};

const ARROW = `<span><svg viewBox="0 0 12.2137 13.2551" fill="none" aria-hidden="true" focusable="false"><path d="M11.9501 7.26396C12.3016 6.91249 12.3016 6.34264 11.9501 5.99117L6.22254 0.263604C5.87107 -0.0878682 5.30122 -0.0878682 4.94975 0.263604C4.59828 0.615076 4.59828 1.18492 4.94975 1.5364L10.0409 6.62756L4.94975 11.7187C4.59828 12.0702 4.59828 12.6401 4.94975 12.9915C5.30122 13.343 5.87107 13.343 6.22254 12.9915L11.9501 7.26396ZM0 6.62756V7.52756H11.3137V6.62756V5.72756H0V6.62756Z" fill="currentColor"/></svg></span>`;

const cta = (a) => {
  a.classList.add("cta");
  a.innerHTML = `<span class="cta-row"><span class="cta-label"></span><span class="cta-arrows"><span class="cta-arrow">${ARROW}</span><span class="cta-arrow">${ARROW}</span></span></span><span aria-hidden="true" class="cta-rule"><span></span><span></span></span>`;
  $(".cta-label", a).textContent = a.dataset.cta;
  const [a1, a2] = $$(".cta-arrow", a);
  const [r1, r2] = $$(".cta-rule > span", a);
  hover(a1, a, { x: "0%", opacity: 1 }, { x: "190%", opacity: 0 }, { config: C(200, 28) });
  hover(a2, a, { x: "-190%", opacity: 0 }, { x: "0%", opacity: 1 }, { config: C(200, 28), delayIn: 70 });
  hover(r1, a, { transform: "scaleX(1)" }, { transform: "scaleX(0)" }, { config: C(260, 30), immediateOut: true });
  hover(r2, a, { transform: "scaleX(0)" }, { transform: "scaleX(1)" }, { config: C(170, 26), delayIn: 140, immediateOut: true });
};

const clampUnit = (v) => Math.max(-1, Math.min(1, v));
const lean = (target, scope, max = 14) => {
  const s = new Spring({ rx: 0, ry: 0 }, (o) => (target.style.transform = `rotateX(${o.rx}deg) rotateY(${o.ry}deg)`));
  if (REDUCED) return;
  scope.addEventListener("pointermove", (e) => {
    if (noHover()) return;
    const b = scope.getBoundingClientRect();
    const dx = clampUnit(((e.clientX - b.left) / b.width) * 2 - 1);
    const dy = clampUnit(((e.clientY - b.top) / b.height) * 2 - 1);
    s.start({ rx: -dy * max, ry: dx * max }, { config: C(90, 22) });
  });
  scope.addEventListener("pointerleave", () => s.start({ rx: 0, ry: 0 }, { config: C(90, 22) }));
};

const pulse = (el) => {
  if (REDUCED) return;
  const s = new Spring({ opacity: 1 }, styler(el));
  const config = { duration: 700, easing: easeInOutSine };
  (async () => {
    for (;;) {
      await s.start({ opacity: 0.15 }, { config });
      await s.start({ opacity: 1 }, { config });
    }
  })();
};

const PRESET = {
  rise: (el) => [{ opacity: 0, y: +el.dataset.y }, { opacity: 1, y: 0 }],
  print: () => [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
  print30: () => [{ clipPath: "inset(0 100% -30% 0)" }, { clipPath: "inset(0 0 -30% 0)" }],
  fade: () => [{ opacity: 0 }, { opacity: 1 }],
  zoom: (el) => [{ opacity: 0, scale: +el.dataset.s }, { opacity: 1, scale: 1 }],
  script: () => [{ clipPath: "inset(-12% 100% -22% -4%)" }, { clipPath: "inset(-12% -8% -22% -4%)" }],
  "rule-x": () => [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
  "rule-y": () => [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
};

/* ═══════════ the kitchen: burgers, pasta, rolls, pizza, coolers ═══════════
   One list feeds the menu cards, the shop, the full menu and the product pages.
   Each dish is drawn (foodArt.ts) rather than photographed. Prices are rupees. */
const MEAL = { key: "meal", label: "MAKE IT A MEAL", choices: [["JUST THE BURGER", 0], ["+ FRIES & DRINK", 450]] };
const SPICE = { key: "spice", label: "SPICE", def: 1, choices: [["MILD", 0], ["MEDIUM", 0], ["HOT", 0]] };
const PIZZA_SIZE = { key: "size", label: "SIZE", def: 1, choices: [['8"', -600], ['10"', 0], ['12"', 700]] };
const COOLER_SIZE = { key: "size", label: "SIZE", choices: [["REGULAR", 0], ["LARGE", 150]] };
const KITCHEN = [
  { id: "smash-burger", name: "CLASSIC SMASH BURGER", menuCat: "burgers", art: ["burger", "smash"], tag: "HOUSE FAVOURITE", price: 1350,
    meta: "DOUBLE SMASHED BEEF · CHEDDAR · HOUSE SAUCE", notes: ["JUICY", "CRISPY EDGES"],
    desc: "Two beef patties smashed thin on a hot griddle so the edges crisp, melted cheddar, pickles and our house sauce in a toasted brioche bun.",
    options: [MEAL, { key: "extra", label: "EXTRA", choices: [["NONE", 0], ["+ CHEESE", 150], ["+ PATTY", 400]] }],
    details: [["PATTY", "2 × 90 G BEEF"], ["BUN", "BRIOCHE"], ["SERVED", "WITH A PICKLE"]] },
  { id: "zinger-burger", name: "CRISPY ZINGER BURGER", menuCat: "burgers", art: ["burger", "zinger"], price: 1150,
    meta: "BUTTERMILK FRIED CHICKEN · SLAW · MAYO", notes: ["CRUNCHY", "SPICY"],
    desc: "A thick fillet brined in buttermilk, fried to a loud crunch, with crisp lettuce, garlic mayo and a little heat.",
    options: [MEAL, SPICE], details: [["FILLET", "CHICKEN THIGH"], ["COATING", "DOUBLE-DIPPED"], ["BUN", "SESAME"]] },
  { id: "bbq-burger", name: "SMOKY BBQ BEEF BURGER", menuCat: "burgers", art: ["burger", "bbq"], price: 1550,
    meta: "BEEF · ONION RINGS · SMOKED BBQ", notes: ["SMOKY", "STICKY"],
    desc: "A thick beef patty glazed in smoked barbecue sauce, stacked with crisp onion rings and cheddar.",
    options: [MEAL], details: [["PATTY", "180 G BEEF"], ["SAUCE", "HICKORY BBQ"], ["BUN", "BRIOCHE"]] },
  { id: "alfredo-pasta", name: "CHICKEN ALFREDO FETTUCCINE", menuCat: "pasta", art: ["pasta", "alfredo"], price: 1450,
    meta: "CREAM · PARMESAN · GRILLED CHICKEN", notes: ["CREAMY", "COMFORT"],
    desc: "Fettuccine in a parmesan cream sauce with grilled chicken, black pepper and parsley.",
    options: [{ key: "protein", label: "PROTEIN", choices: [["CHICKEN", 0], ["MUSHROOM", -150], ["PRAWN", 450]] }],
    details: [["PASTA", "FETTUCCINE"], ["SAUCE", "PARMESAN CREAM"], ["SERVES", "ONE, GENEROUSLY"]] },
  { id: "arrabbiata-pasta", name: "PENNE ARRABBIATA", menuCat: "pasta", art: ["pasta", "arrabbiata"], price: 1250,
    meta: "TOMATO · GARLIC · CHILLI · BASIL", notes: ["FIERY", "VEGETARIAN"],
    desc: "Penne in slow-cooked tomato with garlic and red chilli, finished with basil and olive oil.",
    options: [SPICE, { key: "add", label: "ADD", choices: [["NOTHING", 0], ["+ CHICKEN", 300]] }],
    details: [["PASTA", "PENNE RIGATE"], ["SAUCE", "TOMATO & CHILLI"], ["DIET", "VEGETARIAN"]] },
  { id: "pesto-pasta", name: "PESTO CHICKEN FUSILLI", menuCat: "pasta", art: ["pasta", "pesto"], tag: "NEW", price: 1550,
    meta: "BASIL PESTO · CHICKEN · PARMESAN", notes: ["FRESH", "HERBY"],
    desc: "Fusilli tossed in basil pesto with grilled chicken, cherry tomatoes and shaved parmesan.",
    options: [{ key: "protein", label: "PROTEIN", choices: [["CHICKEN", 0], ["NONE", -250]] }],
    details: [["PASTA", "FUSILLI"], ["PESTO", "BASIL & PINE NUT"], ["TOP", "PARMESAN"]] },
  { id: "tikka-roll", name: "CHICKEN TIKKA PARATHA ROLL", menuCat: "rolls", art: ["roll", "tikka"], tag: "LAHORE CLASSIC", price: 650,
    meta: "CHARGRILLED TIKKA · MINT CHUTNEY · ONION", notes: ["SMOKY", "CHUTNEY"],
    desc: "Chargrilled chicken tikka, pickled onion and mint chutney, rolled in a flaky paratha straight off the tawa.",
    options: [SPICE, { key: "cheese", label: "CHEESE", choices: [["NO", 0], ["YES", 120]] }],
    details: [["WRAP", "LACHHA PARATHA"], ["FILLING", "CHICKEN TIKKA"], ["CHUTNEY", "MINT & YOGURT"]] },
  { id: "behari-roll", name: "BEHARI KEBAB ROLL", menuCat: "rolls", art: ["roll", "behari"], price: 700,
    meta: "TENDER BEEF BEHARI · ONION · IMLI", notes: ["MELT-IN-MOUTH", "SPICED"],
    desc: "Thin-sliced beef marinated overnight in papaya and spices, grilled soft, with onion and tamarind chutney in a paratha.",
    options: [SPICE], details: [["MEAT", "BEEF, OVERNIGHT MARINADE"], ["WRAP", "PARATHA"], ["CHUTNEY", "IMLI"]] },
  { id: "crispy-wrap", name: "CRISPY CHICKEN WRAP", menuCat: "rolls", art: ["roll", "crispy"], price: 850,
    meta: "FRIED CHICKEN · LETTUCE · GARLIC MAYO", notes: ["CRUNCHY", "LIGHT"],
    desc: "Crispy chicken strips, lettuce, tomato and garlic mayo in a toasted flour tortilla.",
    options: [SPICE], details: [["WRAP", "FLOUR TORTILLA"], ["FILLING", "CRISPY STRIPS"], ["SAUCE", "GARLIC MAYO"]] },
  { id: "margherita-pizza", name: "MARGHERITA PIZZA", menuCat: "pizza", art: ["pizza", "margherita"], price: 1650,
    meta: "TOMATO · FIOR DI LATTE · BASIL", notes: ["CLASSIC", "VEGETARIAN"],
    desc: "Hand-stretched dough, San Marzano-style tomato, fresh mozzarella and basil, baked hot until the crust blisters.",
    options: [PIZZA_SIZE], details: [["DOUGH", "48-HOUR PROOF"], ["CHEESE", "FRESH MOZZARELLA"], ["DIET", "VEGETARIAN"]] },
  { id: "fajita-pizza", name: "CHICKEN FAJITA PIZZA", menuCat: "pizza", art: ["pizza", "fajita"], tag: "BESTSELLER", price: 1850,
    meta: "FAJITA CHICKEN · PEPPERS · ONION", notes: ["SPICED", "LOADED"],
    desc: "Fajita-spiced chicken, green and red peppers and onion over mozzarella, the way Lahore likes it.",
    options: [PIZZA_SIZE, { key: "crust", label: "CRUST", choices: [["CLASSIC", 0], ["CHEESE-STUFFED", 350]] }],
    details: [["DOUGH", "48-HOUR PROOF"], ["TOPPING", "FAJITA CHICKEN"], ["CHEESE", "MOZZARELLA"]] },
  { id: "pepperoni-pizza", name: "BEEF PEPPERONI PIZZA", menuCat: "pizza", art: ["pizza", "pepperoni"], price: 1950,
    meta: "BEEF PEPPERONI · MOZZARELLA · OREGANO", notes: ["CRISPY CUPS", "SAVOURY"],
    desc: "Halal beef pepperoni that curls and crisps in the oven, over tomato and plenty of mozzarella.",
    options: [PIZZA_SIZE, { key: "crust", label: "CRUST", choices: [["CLASSIC", 0], ["CHEESE-STUFFED", 350]] }],
    details: [["PEPPERONI", "HALAL BEEF"], ["DOUGH", "48-HOUR PROOF"], ["FINISH", "OREGANO"]] },
  { id: "mint-margarita", name: "MINT MARGARITA", menuCat: "drinks", art: ["drink", "mint"], tag: "SUMMER", price: 550,
    meta: "MINT · LIME · CRUSHED ICE", notes: ["COOLING", "ZESTY"],
    desc: "Fresh mint and lime blended with crushed ice and a pinch of chaat masala. Alcohol-free, like everything we pour.",
    options: [COOLER_SIZE], details: [["BASE", "FRESH MINT & LIME"], ["ICE", "CRUSHED"], ["FINISH", "CHAAT MASALA"]] },
  { id: "peach-iced-tea", name: "PEACH ICED TEA", menuCat: "drinks", art: ["drink", "peach"], price: 600,
    meta: "BLACK TEA · PEACH · LEMON", notes: ["LIGHT", "FRUITY"],
    desc: "Black tea brewed strong, chilled, with peach and a squeeze of lemon.",
    options: [COOLER_SIZE, { key: "sweet", label: "SWEETNESS", def: 1, choices: [["LESS", 0], ["REGULAR", 0], ["EXTRA", 0]] }],
    details: [["TEA", "BLACK, COLD-STEEPED"], ["FRUIT", "PEACH"], ["SERVED", "OVER ICE"]] },
  { id: "mango-smoothie", name: "MANGO SMOOTHIE", menuCat: "drinks", art: ["drink", "mango"], price: 750,
    meta: "CHAUNSA MANGO · YOGURT · HONEY", notes: ["THICK", "SEASONAL"],
    desc: "Ripe mango blended with yogurt and a little honey. Chaunsa in season.",
    options: [COOLER_SIZE, { key: "milk", label: "BASE", choices: [["YOGURT", 0], ["OAT MILK", 150]] }],
    details: [["FRUIT", "MANGO"], ["BASE", "YOGURT"], ["SWEETENER", "HONEY"]] },
  { id: "lime-soda", name: "FRESH LIME SODA", menuCat: "drinks", art: ["drink", "lime"], price: 450,
    meta: "LIME · SODA · SWEET OR SALTED", notes: ["FIZZY", "REFRESHING"],
    desc: "Fresh lime over soda, sweet, salted or half-and-half, the way it's done across Lahore.",
    options: [{ key: "style", label: "STYLE", choices: [["SWEET", 0], ["SALTED", 0], ["MIXED", 0]] }],
    details: [["LIME", "FRESH-SQUEEZED"], ["SODA", "CHILLED"], ["STYLE", "YOUR CALL"]] },
].map((k) => ({
  ...k,
  cat: k.menuCat === "drinks" ? "coolers" : "kitchen",
  // A real photo at public/assets/kitchen/<id>.jpg wins; until one is there the
  // drawn dish stands in (see the error handler below).
  photo: `kitchen/${k.id}.jpg`,
  art: foodArt(k.art[0], k.art[1]),
  alt: `The brewns ${k.name.toLowerCase()}`,
  care: k.menuCat === "drinks" ? "Made to order and best within the hour. Ask for less ice or less sugar at the counter." : "Cooked to order when you arrive or when the rider is five minutes out, so it reaches you hot.",
}));
const rs = (n) => `Rs ${n.toLocaleString("en-US")}`;
const KITCHEN_ART = Object.fromEntries(KITCHEN.map((k) => [k.id, k.art]));
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (img?.tagName !== "IMG" || img.dataset.artFallback) return;
    const id = img.getAttribute("src")?.match(/\/kitchen\/([\w-]+)\.jpg/)?.[1];
    if (!id || !KITCHEN_ART[id]) return;
    img.dataset.artFallback = "1";
    img.src = KITCHEN_ART[id];
  },
  true,
);
// Photos are asset paths; drawn dishes arrive as data URIs.
const photoSrc = (photo) => (photo.startsWith("data:") ? photo : `${ASSET_BASE_URL}${photo}`);

/* ═══════════ generated markup: menu cards, footer columns ═══════════ */
const ALL_MENU_CARDS = [
  { id: "espresso", cat: "coffee", name: "ESPRESSO", price: "Rs 650", snap: "cup", size: [720, 720], frame: [170, 170, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: false, clip: true, alt: "A brewns espresso in the short black-lidded brewns paper cup" },
  { id: "latte", cat: "coffee", name: "LATTE", price: "Rs 950", snap: "cup", size: [720, 720], frame: [200, 200, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: false, clip: true, alt: "A brewns latte in the black-lidded brewns paper cup" },
  { id: "iced-matcha", cat: "specialty", name: "ICED MATCHA", price: "Rs 1,150", file: "menu-iced-coffee.webp", size: [1024, 1536], frame: [197, 261, 0, 0], crop: ["0.1%", "2.54%", "94.92%", "107.62%"], cover: false, clip: false, alt: "A brewns iced matcha in a clear cup with a straw" },
  { id: "cardamom-bun", cat: "bakery", name: "CARDAMOM BUN", price: "Rs 750", file: "menu-cardamom.webp", size: [1024, 1024], frame: [200, 200, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: true, clip: true, alt: "A freshly baked Swedish cardamom bun with pearl sugar" },
  { id: "cortado", cat: "coffee", name: "CORTADO", price: "Rs 850", file: "menu-cortado.webp", size: [1024, 1024], frame: [190, 190, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: true, clip: true, alt: "A brewns cortado in a faceted glass with steamed microfoam" },
  { id: "nitro-cold-brew", cat: "specialty", name: "NITRO COLD BREW", price: "Rs 1,100", file: "menu-cold-brew.webp", size: [1024, 1024], frame: [190, 190, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: true, clip: true, alt: "A nitro cold brew coffee in a chilled glass with creamy cascading head" },
  { id: "cinnamon-roll", cat: "bakery", name: "CINNAMON ROLL", price: "Rs 700", file: "menu-cinnamon.webp", size: [1536, 1024], frame: [327, 218, -8, 0], crop: ["0%", "0%", "100%", "100%"], cover: true, clip: true, alt: "A glazed cinnamon roll on a ceramic plate" },
  { id: "matcha-financier", cat: "bakery", name: "MATCHA FINANCIER", price: "Rs 650", file: "menu-financier.webp", size: [1024, 1024], frame: [200, 200, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: true, clip: true, alt: "A golden-green matcha financier cake with dusted icing sugar" },
  { id: "iced-latte", cat: "coffee", name: "ICED LATTE", price: "Rs 1,050", file: "menu-iced-latte.webp", size: [1024, 1536], frame: [175, 235, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: false, clip: false, alt: "A brewns iced latte in a clear cup with straw" },
  { id: "slow-roast", cat: "beans", name: "SLOW ROAST", price: "Rs 3,800", snap: "bag", size: [720, 720], frame: [210, 210, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: false, clip: true, alt: "A cream brewns Slow Roast whole bean bag" },
  { id: "single-origin", cat: "beans", name: "ETHIOPIA YIRGACHEFFE", price: "Rs 4,800", snap: "bag", size: [720, 720], frame: [210, 210, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: false, clip: true, alt: "A cream brewns Ethiopia Yirgacheffe whole bean bag" },
  { id: "ceramic-tumbler", cat: "beans", name: "CERAMIC TUMBLER", price: "Rs 6,500", file: "menu-tumbler.webp", size: [1024, 1024], frame: [190, 190, 0, 0], crop: ["0%", "0%", "100%", "100%"], cover: true, clip: true, alt: "Matte ceramic travel tumbler" },
  ...KITCHEN.map((k) => ({ shot: true, id: k.id, cat: k.menuCat, name: k.name, price: rs(k.price), art: `${ASSET_BASE_URL}${k.photo}`, size: [800, 800], frame: [255, 255, 0, 0.5], crop: ["0%", "0%", "100%", "100%"], cover: false, clip: true, alt: k.alt })),
];

const cardHTML = (c, o) => {
  const [w, h, bottom, offsetX] = c.frame;
  const [top, left, width, height] = c.crop;
  return `<li><div class="lean"><div><article class="card" data-iv="rise" data-y="28" data-c="80,26" data-d="${o * 90}" data-menu-id="${c.id}">
    <div aria-hidden="true" class="card-range"></div>
    <p class="card-idx"><span data-dr data-d="${o * 90 + 160}">0${o + 1}</span></p>
    <div class="card-media${c.clip ? " clip" : ""}${c.shot ? " shot" : ""}"><span><span class="card-par">
      <div class="still" style="width: calc(${w / 16}rem * var(--size-menu-still-scale)); max-width: var(--size-menu-still-max); aspect-ratio: ${w} / ${h}; bottom: calc(${bottom / 16}rem + var(--size-menu-still-lift)); margin-left: ${offsetX / 16}rem">
        <img loading="lazy" decoding="async" ${c.snap ? `data-snap="${c.snap}" data-snap-product="${c.id}"` : `src="${c.art || `${ASSET_BASE_URL}menu/${c.file}`}"`} alt="${c.alt}" width="${c.size[0]}" height="${c.size[1]}" style="top: ${top}; left: ${left}; width: ${width}; height: ${height};${c.cover ? " object-fit: cover;" : ""}">
      </div>
    </span></span></div>
    <div class="card-foot">
      <p data-iv="print30" data-c="58,26" data-d="${o * 90 + 300}" style="clip-path: inset(0 100% -30% 0)">${c.name}</p>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <p><span data-dr data-d="${o * 90 + 240}">${c.price}</span></p>
        <button type="button" class="card-quick-add" data-card-add="${c.id}" aria-label="Add ${c.name} to bag">+ ADD</button>
      </div>
    </div>
  </article></div></div></li>`;
};

$("#cards").innerHTML = ALL_MENU_CARDS.slice(0, 4).map(cardHTML).join("");

/* The shop prints a receipt for every order, so a review arrives the same way:
   on a slip, in the same mono, torn off at the bottom. What someone ordered is
   part of the review — it ties the words back to the menu two sections up. */
const REVIEWS = [
  { quote: "Four minutes from the door to the first sip, and it still tastes like someone cared how it came out.", name: "Maya R.", place: "Gulberg", order: "Iced Matcha · 12 oz", when: "12.05", stars: 5 },
  { quote: "Came in for a flat white and stayed two hours. Nobody once made me feel like I should be leaving.", name: "Daniel O.", place: "DHA", order: "Flat White · 8 oz", when: "04.05", stars: 5 },
  { quote: "The slow roast ruined every other bag in my kitchen. I have made my peace with that.", name: "Priya S.", place: "Johar Town", order: "Slow Roast · 250 g", when: "28.04", stars: 5 },
];

/* The breakdown behind the 4.9. A single headline number invites the question of
   what sits underneath it; the bars answer before anyone has to ask. */
const RATINGS = [
  [5, 91],
  [4, 7],
  [3, 1],
  [2, 0],
  [1, 1],
];
$("#rev-dist").innerHTML = RATINGS.map(
  ([stars, pct], i) => `<li>
    <span class="rev-dist-k">${stars}<span aria-hidden="true">★</span></span>
    <span class="rev-dist-bar"><i data-iv="rule-x" data-d="${560 + i * 70}" style="width: ${pct}%; transform: scaleX(0)"></i></span>
    <span class="rev-dist-v"><span data-dr data-d="${620 + i * 70}">${String(pct).padStart(2, "0")}</span>%</span>
  </li>`,
).join("");

$("#rev-cards").innerHTML = REVIEWS.map((r, o) => `<li><div class="lean"><div class="rev-hold"><article class="rev-slip" data-iv="rise" data-y="28" data-c="80,26" data-d="${o * 90}">
  <div class="rev-slip-head">
    <p class="rev-idx"><span data-dr data-d="${o * 90 + 160}">0${o + 1}</span></p>
    <p class="rev-when"><span data-dr data-d="${o * 90 + 200}">${r.when}</span></p>
  </div>
  <p class="rev-stars" role="img" aria-label="Rated ${r.stars} out of 5">${"★".repeat(r.stars)}</p>
  <blockquote class="rev-quote"><p data-te="words" data-dur="620" data-st="12" data-d="${o * 90 + 260}" data-margin="0px 0px -15% 0px">${r.quote}</p></blockquote>
  <div class="rc-rule" aria-hidden="true"></div>
  <div class="rev-foot"><p data-iv="print30" data-c="58,26" data-d="${o * 90 + 320}" style="clip-path: inset(0 100% -30% 0)">${r.name}</p><p>${r.place}</p></div>
  <p class="rev-order"><span>Ordered</span><span>${r.order}</span></p>
</article></div></div></li>`).join("");

/* A slow band of one-liners under the slips — the overheard half of a review,
   the part too short to letter onto a card. Doubled so the loop has no seam. */
const OVERHEARD = [
  "Best flat white in Gulberg",
  "The 7am queue actually moves",
  "They remember the order",
  "Oat milk done properly",
  "Cardamom bun, every Saturday",
  "Quiet enough to work, loud enough to think",
  "Third visit this week",
];
$("#rev-ticker").innerHTML = [...OVERHEARD, ...OVERHEARD]
  .map((line) => `<span>${line}</span><span class="rev-ticker-dot" aria-hidden="true">●</span>`)
  .join("");

const COLUMNS = [
  ["Shop", [["COFFEE", "#shop-coffee"], ["SUBSCRIPTIONS", "#subscriptions"], ["MERCH", "#merch"], ["GIFT CARDS", "#gift-cards"]]],
  ["Menu", [["COFFEE", "#menu-coffee"], ["NON-COFFEE", "#non-coffee"], ["SIGNATURE DRINKS", "#signature"], ["FOOD", "#food"]]],
  ["about us", [["OUR STORY", "#story"], ["COFFEE & SOURCING", "#sourcing"], ["journal", "#journal"], ["CAREERS", "#careers"]]],
];
$("#ftr-nav").innerHTML = COLUMNS.map(([heading, links], i) =>
  `<div class="ftr-col"><p data-rise data-d="${160 + i * 130}">${heading}</p><ul class="ftr-list">${links
    .map(([t, href], row) => `<li data-rise data-d="${160 + i * 130 + (row + 1) * 70}"><a href="${href}" data-ul data-rule>${t.replace("&", "&amp;")}</a></li>`)
    .join("")}</ul></div>`,
).join("");

/* ═══════════ wire the declarative primitives ═══════════ */
$$("[data-rise]").forEach(rise);
$$("a[data-ul]").forEach(underline);
$$("a[data-cta]").forEach(cta);
$$("[data-dr]").forEach(digitRoll);
$$("[data-iv]").forEach((el) => {
  const kind = el.dataset.iv;
  const [from, to] = PRESET[kind](el);
  const [t, f] = (el.dataset.c || (kind.startsWith("rule") ? "55,22" : "90,26")).split(",").map(Number);
  /* The soft clip springs (36–58 tension) spend seconds on their last few percent,
     which reads as cropped text — clips run on a fixed ease instead. */
  const clip = kind.startsWith("print") || kind === "script";
  const config = clip ? { duration: kind === "script" ? 1300 : 900, easing: easeOutCubic } : C(t, f);
  inview(el, from, to, { config, delay: +(el.dataset.d || 0), gate: el.dataset.gate !== "0" });
});
$$("[data-pulse]").forEach(pulse);
$$(".lean").forEach((outer) => lean(outer.firstElementChild, outer));

/* The footer's giant wordmark rises out of the bottom edge. It starts below the
   footer's clip, so it is triggered by its band, which is always in place. */
inview($(".ftr-giant"), { opacity: 0, y: 80 }, { opacity: 1, y: 0 }, { config: C(36, 26), delay: 120, trigger: $(".ftr-brand") });

/* The ambassador's polaroid shows her photo once it is in public/assets/hania/;
   until then (or if none loads) the initials stand in. Common names are tried in
   turn, including the doubled extensions Windows makes when extensions are hidden
   ("hania.jpg.png"). */
{
  const photo = $(".hania-photo");
  if (photo) {
    const names = ["hania.jpg", "hania.jpeg", "hania.png", "hania.webp", "hania.JPG", "hania.PNG", "hania.jpg.png", "hania.jpg.webp", "hania.jpg.jpeg", "hania.jpg.jpg", "hania.png.png", "hania.webp.webp"];
    let tried = 0;
    const show = () => photo.closest(".hania-shot").classList.add("has-photo");
    photo.addEventListener("load", show);
    photo.addEventListener("error", () => {
      tried += 1;
      if (tried < names.length) photo.src = `${ASSET_BASE_URL}hania/${names[tried]}`;
      else photo.remove();
    });
    // The first name may have failed before these listeners existed.
    if (photo.complete) photo.naturalWidth ? show() : photo.dispatchEvent(new Event("error"));
  }
}

/* ═══════════ header ═══════════ */
const header = $("#hdr");
const themed = $$("[data-header-theme]");
const footer = $("#ftr");
const PROBE_OFFSET = 35;
loop(() => {
  for (const s of themed) {
    const b = s.getBoundingClientRect();
    if (b.top <= PROBE_OFFSET && b.bottom > PROBE_OFFSET) {
      header.dataset.theme = s.dataset.headerTheme;
      break;
    }
  }
  header.classList.toggle("over-footer", footer.getBoundingClientRect().top <= PROBE_OFFSET);
}, 100);

const toggle = $("#menu-toggle");
const panel = $("#site-menu");
const setOpen = (open) => {
  panel.hidden = !open;
  header.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  open ? stopScroll() : startScroll();
};
toggle.addEventListener("click", () => setOpen(panel.hidden));
$$("a", panel).forEach((a) => a.addEventListener("click", () => setOpen(false)));
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || panel.hidden) return;
  setOpen(false);
  toggle.focus();
});

/* ═══════════ fonts must be visible when they fail ═══════════ */
for (const [family, file] of [["Space Mono", "SpaceMono-Regular.ttf"], ["Allura", "Allura-Regular.ttf"]]) {
  const url = `${ASSET_BASE_URL}fonts/${file}`;
  document.fonts
    .load(`16px "${family}"`)
    .then((faces) => faces.length || banner(`Font failed to load: ${url}`))
    .catch(() => banner(`Font failed to load: ${url}`));
}

/* ═══════════ preloader ═══════════ */
(() => {
  const el = $("#pre");
  if (REDUCED) {
    el.remove();
    return;
  }
  const count = $("#pre-count"), coffee = $("#pre-coffee");
  const STEP = { mount: 0.1, fonts: 0.6, loaded: 1 };
  const MIN_VISIBLE = 620, MAX_WAIT = 4000, HOLD = 180;
  const FILL = C(120, 26), POUR = C(90, 18);
  const t0 = performance.now();
  let level = 0, pour = 0, finishing = false;
  const draw = () => {
    count.textContent = String(Math.round(Math.min(1, level) * 100)).padStart(3, "0");
    coffee.setAttribute("y", 156 - level * (1 - pour) * (156 - 30));
    el.style.clipPath = `inset(${pour * 100}% 0 0 0)`;
  };
  const levelSpring = new Spring({ v: 0 }, (o) => ((level = o.v), draw()));
  const pourSpring = new Spring({ v: 0 }, (o) => ((pour = o.v), draw()));
  stopScroll();
  levelSpring.start({ v: STEP.mount }, { config: FILL });

  const fonts = document.fonts.ready.then(() => {
    if (!finishing) levelSpring.start({ v: STEP.fonts }, { config: FILL });
  });
  const loaded = new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  });
  const done = () => {
    if (!page.ready) {
      el.remove();
      page.set({ revealing: true, ready: true });
      startScroll();
      if (window.location.hash) {
        // "#shop/<id>" is a product route: land on the shop, the router opens the product.
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)).split("/")[0]);
        if (target) setTimeout(() => lenis.scrollTo(target, { immediate: true }), 60);
      }
    }
  };
  Promise.race([Promise.all([fonts, loaded]), new Promise((r) => setTimeout(r, MAX_WAIT))]).then(() => {
    finishing = true;
    levelSpring.start({ v: STEP.loaded }, { config: FILL }).then(() => {
      setTimeout(() => {
        page.set({ revealing: true });
        pourSpring.start({ v: 1 }, { config: POUR }).then(done);
      }, Math.max(0, MIN_VISIBLE - (performance.now() - t0)) + HOLD);
    });
  });
  setTimeout(done, MAX_WAIT + 2000);
})();

/* specks for the GPU warm-up */
$("#warm-specks").innerHTML = [50, 95]
  .flatMap((fill) => [
    `<span class="swirl-fill" style="display:block;width:8px;height:8px;--fill:${fill};-webkit-mask-image:${blobMask("ltr")};mask-image:${blobMask("ltr")}"></span>`,
    `<span class="swirl-fill" style="display:block;width:8px;height:8px;transform:scale(.95);--fill:${fill};-webkit-mask-image:${blobMask("ltr")};mask-image:${blobMask("ltr")}"></span>`,
  ])
  .concat(`<span style="display:block;width:8px;height:8px;background-image:var(--philosophy-scrim)"></span>`, `<span style="display:block;width:8px;height:8px;overflow:hidden;border-radius:9999px"><span style="display:block;width:100%;height:100%;transform:scale(.95);background:var(--background)"></span></span>`)
  .join("");

/* ═══════════ text reveals wait for the faces ═══════════ */
document.fonts.ready.then(() => $$("[data-te]").forEach(textEngine));

/* ═══════════ swirl fill ═══════════ */
function blobMask(direction) {
  const BLOBS = [
    { x: 0, y: 78, delay: 0 },
    { x: 30, y: 22, delay: 10 },
    { x: 58, y: 88, delay: 22 },
    { x: 92, y: 40, delay: 34 },
  ];
  const REACH = 115, FEATHER = 14;
  return BLOBS.map(({ x, y, delay }) => {
    const cx = direction === "ltr" ? x : 100 - x;
    const rate = REACH / (100 - delay);
    const radius = `calc((var(--fill) - ${delay}) * ${rate}%)`;
    return `radial-gradient(circle at ${cx}% ${y}%, #000 calc(${radius} - ${FEATHER}%), transparent ${radius})`;
  }).join(", ");
}

$$("[data-swirl]").forEach((frame) => {
  const section = frame.closest("section");
  const box = $(".swirl-box", frame);
  const fill = $(".swirl-fill", frame);
  const mask = blobMask(frame.dataset.swirl);
  fill.style.webkitMaskImage = mask;
  fill.style.maskImage = mask;
  const set = (v) => fill.style.setProperty("--fill", v);
  scrub(box.firstElementChild, box, "top bottom", "bottom top", { y: -100 }, { y: 100 }, 0.5);
  if (REDUCED) return set(100);
  const s = new Spring({ v: 0 }, (o) => set(o.v));
  onceVisible(section, () => s.start({ v: 100 }, { config: { duration: 3400, easing: easeInOutSine }, delay: 100 }), { threshold: 0.12 });
});

/* ═══════════ menu: still lag, receipt ═══════════ */
$$(".card").forEach((card) => scrub($(".card-par", card), $(".card-range", card), "top bottom", "center center", { y: 11 }, { y: 0 }));
hover($("#menu-receipt"), $("#menu-cta"), { x: 150, y: 150, opacity: 0 }, { x: 0, y: 0, opacity: 1 }, { config: C(120, 26), focus: true });

/* ═══════════ locations: dial and cup ═══════════ */
(() => {
  const range = $("#loc-range"), turn = $("#loc-turn"), section = $("#locations");
  const DIAL_PARALLAX = 26, CUP_PARALLAX = 80, CUP_MAX_ROTATION = 38, CUP_MAX_TILT = 14;
  scrub($("#dial-par"), range, "top bottom", "center center", { y: DIAL_PARALLAX }, { y: 0 });
  scrub($("#loc-par"), range, "top bottom", "center center", { y: CUP_PARALLAX }, { y: 0 });
  scrub($("#loc-spin"), turn, "center center", "bottom top", { rotate: "0deg" }, { rotate: `${CUP_MAX_ROTATION}deg` }, 0);
  lean($("#loc-lean"), section, CUP_MAX_TILT);
})();

/* ═══════════ hero card ═══════════ */
const HERO_CARDS = {
  bag: { eyebrow: "in the bag", name: "SLOW ROAST", price: "Rs 3,800", meta: ["250 G", "WHOLE BEAN", "COPENHAGEN"] },
  cup: { eyebrow: "in the cup", name: "HOUSE LATTE", price: "Rs 950", meta: ["250 ML", "BREWED DAILY", "TO GO"] },
};
const heroCard = $("#hero-card");
const setCard = (role) => {
  const c = HERO_CARDS[role];
  $('[data-card="eyebrow"]', heroCard).textContent = c.eyebrow;
  $('[data-card="name"]', heroCard).textContent = c.name;
  $('[data-card="price"]', heroCard).textContent = c.price;
  $('[data-card="meta"]', heroCard).innerHTML = c.meta.map((m, i) => `<li>${i ? "<i></i>" : ""}${m}</li>`).join("");
};
setCard("bag");
const heroHandle = $("#hero-handle");
hover(heroCard, heroHandle, { opacity: 0, y: 18 }, { opacity: 1, y: 0 }, { config: C(210, 26) });

/* ═══════════ order block: the thermal printer ═══════════ */
// Filled in by the printer below; the tear-off gesture asks it for a fresh slip.
const orderPrinter = { reprint: () => {} };
(() => {
  const SCENE = { width: 1440, height: 800 };
  const STEPS = 46, BARCODE_FED = 0.88;
  const START_VH = -0.85, END_VH = 0, EASE_POWER = 1.6;
  const PRINTER_ART = { width: 404, height: 72 };
  const PRINTER = { left: 519, top: 133, width: 400, get height() { return (this.width * PRINTER_ART.height) / PRINTER_ART.width; } };
  const BOARD_WIDTH = 1440, TIGHT_WIDTH = 1280, GROW = 0.085, HEADLINE_TOP = 126, NARROW_GROW = 1.096, NARROW_NUDGE_X = 20;
  const NARROW = {
    maxWidth: 1024, top: PRINTER.top, paperBottom: 748,
    get height() { return this.paperBottom - this.top; },
    bandTop: 0.217, bandBottom: 0.22, phoneWidth: 640, phoneBandTop: 0.223, phoneBandBottom: 0.277,
  };
  const RECEIPT = { width: 328, paddingX: 22, barcode: { height: 42, gap: 1, thin: 1, thick: 2.5, seed: 20250521 } };
  const SETTLE = { floor: 0.42, ceiling: 0.94, span: 0.55, seed: 90210 };
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const barcodeBars = () => {
    const span = RECEIPT.width - RECEIPT.paddingX * 2;
    let s = RECEIPT.barcode.seed >>> 0;
    const next = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const bars = [];
    let left = span, key = 0;
    while (left > 0) {
      const width = next() < 0.55 ? RECEIPT.barcode.thin : RECEIPT.barcode.thick;
      const on = next() > 0.22;
      if (left <= width + RECEIPT.barcode.gap) {
        bars.push({ key: key++, width: left, on: true });
        break;
      }
      bars.push({ key: key++, width, on });
      left -= width + RECEIPT.barcode.gap;
    }
    return bars;
  };
  const startHeights = (count) => {
    let s = SETTLE.seed >>> 0;
    return Array.from({ length: count }, () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const r = s / 4294967296;
      return SETTLE.floor + r * (SETTLE.ceiling - SETTLE.floor);
    });
  };
  const scaleAt = (v, i, count, from) => {
    const t0 = (i / count) * (1 - SETTLE.span);
    const local = clamp((v - t0) / SETTLE.span, 0, 1);
    const eased = 1 - Math.pow(1 - local, 3);
    return from + (1 - from) * eased;
  };

  const section = $("#order"), paper = $("#paper"), stage = $("#stage"), barcode = $("#barcode");

  let d = `M 0 0 L ${RECEIPT.width} 0`;
  for (let x = RECEIPT.width; x > 0; x -= 8) d += ` L ${Math.max(0, x - 4)} 9 L ${Math.max(0, x - 8)} 0`;
  $("#torn").setAttribute("d", d + " Z");

  const bars = barcodeBars();
  const heights = startHeights(bars.length);
  const barEls = bars.map((b) => {
    const el = document.createElement("span");
    el.style.width = `${b.width}px`;
    el.style.flex = "none";
    el.style.background = b.on ? "#111111" : "transparent";
    barcode.append(el);
    return el;
  });
  const sweep = new Spring({ v: 0 }, (o) => barEls.forEach((el, i) => (el.style.transform = `scaleY(${scaleAt(o.v, i, barEls.length, heights[i])})`)));

  /* The paper follows the scroll through a spring, so it glides out of the slot
     rather than jumping step to step. While it moves, the section is marked
     "printing" (amber light, glowing slot); fully out, "printed" (green light),
     with a one-off settle swing. */
  let progress = -1, fed = false, reprinting = false, idle = 0, out = false;
  const setOut = (now) => {
    if (now === out) return;
    out = now;
    section.classList.toggle("printed", out);
    if (!out || REDUCED) return;
    section.classList.add("settle");
    setTimeout(() => section.classList.remove("settle"), 1500);
  };
  const feed = new Spring({ v: 0 }, (o) => {
    paper.style.setProperty("--p", String(o.v));
    setOut(o.v > 0.995);
    if (REDUCED) return;
    section.classList.add("printing");
    clearTimeout(idle);
    idle = setTimeout(() => section.classList.remove("printing"), 160);
  });
  const barcodeTo = (now) => {
    if (now === fed) return;
    fed = now;
    sweep.start({ v: fed ? 1 : 0 }, { config: C(70, 34) });
  };
  const write = (p) => {
    if (p === progress || reprinting) return;
    progress = p;
    if (REDUCED) feed.set({ v: p });
    else feed.start({ v: p }, { config: C(90, 22) });
    if (p > 0.1 && p < 0.95 && Math.random() < 0.25) playPaperFeed();
    barcodeTo(p >= BARCODE_FED);
  };

  /* After a tear: the next order number, and a new slip fed all the way out. */
  orderPrinter.reprint = () => {
    const no = $("#rc-no");
    const n = parseInt(no.textContent.replace(/\D/g, ""), 10) || 0;
    no.textContent = `Order #${String(n + 1).padStart(5, "0")}`;
    if (REDUCED) return;
    reprinting = true;
    feed.stop();
    feed.set({ v: 0 });
    sweep.set({ v: 0 });
    fed = false;
    let ticks = 0;
    const whirr = setInterval(() => (++ticks > 7 ? clearInterval(whirr) : playPaperFeed()), 220);
    setTimeout(() => {
      barcodeTo(true);
      feed.start({ v: 1 }, { config: C(26, 18) }).then(() => {
        reprinting = false;
        progress = 1;
      });
    }, 350);
  };
  const measure = () => {
    const scrolled = -section.getBoundingClientRect().top;
    const from = START_VH * window.innerHeight;
    const to = END_VH * window.innerHeight;
    let p = clamp((scrolled - from) / (to - from), 0, 1);
    p = 1 - Math.pow(1 - p, EASE_POWER);
    write(Math.round(p * STEPS) / STEPS);
  };

  const place = (scale, shift, nudgeX) => {
    stage.style.transform = `translateX(-50%) translate(${nudgeX}px, ${shift}px) scale(${scale})`;
  };
  const fit = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw >= NARROW.maxWidth) {
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const base = rootSize / FONT_BASE;
      if (vw >= BOARD_WIDTH) return place(base, 0, 0);
      if (vw >= TIGHT_WIDTH) {
        const t = clamp((BOARD_WIDTH - vw) / (BOARD_WIDTH - TIGHT_WIDTH), 0, 1);
        const grown = base * (1 + GROW * t);
        return place(grown, PRINTER.top * (base - grown), 0);
      }
      const grown = base * NARROW_GROW;
      return place(grown, HEADLINE_TOP * base - PRINTER.top * grown, NARROW_NUDGE_X * base);
    }
    const phone = vw < NARROW.phoneWidth;
    const bandTop = phone ? NARROW.phoneBandTop : NARROW.bandTop;
    const bandBottom = phone ? NARROW.phoneBandBottom : NARROW.bandBottom;
    const band = vh * (1 - bandTop - bandBottom);
    const next = Math.min(band / NARROW.height, (vw * 0.94) / PRINTER.width);
    const machineTop = vh * bandTop + (band - NARROW.height * next) / 2;
    place(next, machineTop - NARROW.top * next, 0);
  };
  fit();
  window.addEventListener("resize", fit);

  scrub($("#order-bg"), section, "top bottom", "top top", { y: "-23.0769%" }, { y: "0%" });
  if (REDUCED) {
    section.style.height = "100lvh";
    write(1);
    sweep.set({ v: 1 });
  } else loop(measure);
})();

/* ═══════════ Opalesce ═══════════ */
const CONFIG = {
  bgColor: "#070707", colorA: "#110b07", colorB: "#2c1a11", colorC: "#6e3e22", colorD: "#c69b6e",
  scale: 0.5, speed: 0.12, flow: 0.16, warp: 1.45, warpScale: 0.75, roughness: 0.45, lacunarity: 2,
  thickness: 1.2, iridescence: 0.22, spread: 0.28, sheen: 0.05, contrast: 1.35, midpoint: 0.54,
  glow: 0.08, sink: 0.35, grain: 0.045, grainAnim: 1, dither: 1.55, vignette: 0.26, cursor: 1,
  pointerRadius: 0.3, pointerStrength: 1.2, parallax: 0.01, maxDpr: 1.5,
};

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;
uniform vec2  iMouseVel;
uniform vec2  iMouseWake;

uniform vec3  uBgColor, uColorA, uColorB, uColorC, uColorD;
uniform float uScale, uSpeed, uFlow, uWarp, uWarpScale;
uniform float uRoughness, uLacunarity, uThickness, uIridescence, uSpread;
uniform float uSheen, uContrast, uMidpoint, uGlow, uSink;
uniform float uGrain, uDither, uVignette, uPointerRadius, uPointerStrength;
uniform float uParallax;

#define TRAIL_TAPS 6

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float snoise(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}

vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * p; }

float trail(vec2 uv, float radius) {
  vec2 wob = vec2(snoise(uv * 1.7 + vec2(0.0, iTime * 0.05)),
                  snoise(uv * 1.7 + vec2(4.3, -iTime * 0.04)));
  uv += wob * radius * 0.22;
  float a = 0.0, wsum = 0.0;
  float r2 = max(1e-4, radius * radius);
  for (int i = 0; i < TRAIL_TAPS; i++) {
    float k = float(i) / float(TRAIL_TAPS - 1);
    vec2 c = mix(iMouseWake, iMouse, k);
    vec2 dd = uv - c;
    float w = mix(0.28, 1.0, k);
    a += w * exp(-dot(dd, dd) / r2);
    wsum += w;
  }
  return a / wsum;
}

vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.36, t));
  c = mix(c, uColorC, smoothstep(0.32, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.66, 1.00, t));
  return c;
}

float tone(float x) {
  return 0.5 + 0.5 * tanh((x - uMidpoint) * uContrast * 2.2);
}

float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}

#define OCT 3

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < OCT; i++) { v += amp * snoise(p); p = p * uLacunarity + vec2(6.1, 2.7); amp *= uRoughness; }
  return v;
}

uniform float uGrainAnim;
float houseGrain(vec2 fc) {
  uvec2 q = uvec2(fc) * uvec2(1597334677u, 3812015801u)
          + uint(floor(iTime * 24.0 * uGrainAnim)) * 2654435769u;
  uint n = q.x ^ q.y; n = n * 1664525u + 1013904223u; n ^= n >> 16u; n *= 2246822519u; n ^= n >> 13u;
  float a = float(n & 0xffffu) / 65535.0;
  n *= 3266489917u; n ^= n >> 16u;
  float b = float(n & 0xffffu) / 65535.0;
  return a + b - 1.0;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  float t = iTime * uSpeed;

  float tr = trail(uv, uPointerRadius);
  vec2 p = (uv - iMouse * uParallax) * uScale;

  vec2 q = vec2(fbm(p * uWarpScale + vec2(0.0, t * uFlow)),
                fbm(p * uWarpScale + vec2(5.2, 1.3) - t * uFlow * 0.7));
  float base = fbm(p + uWarp * q + vec2(t * 0.12, -t * 0.09)) * 0.5 + 0.5;

  float thick = base * uThickness + tr * uPointerStrength;

  vec3 film = 0.5 + 0.5 * cos(6.28318 * (thick * vec3(1.0, 1.0 - uSpread * 0.18, 1.0 - uSpread * 0.36)
                                         + vec3(0.0, 0.08, 0.16)));

  float f = tone(base);

  vec3 col = ramp4(f);
  col *= mix(vec3(1.0), film * 1.25, uIridescence);
  col += uColorD * (uGlow * pow(f, 4.0) + uSheen * pow(film.g, 6.0) * 0.25);
  col = mix(uBgColor, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);

  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const hexToVec3 = (h) => {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
};

const opalesce = (wrapper) => {
  const canvas = $("canvas", wrapper);
  const fade = $(".opal-canvas", wrapper);
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) return;

  let program = null, vertexShader = null, fragmentShader = null, vao = null;
  let locations = {};
  const loc = (n) => {
    if (!program) return null;
    if (!(n in locations)) locations[n] = gl.getUniformLocation(program, n);
    return locations[n];
  };
  const u1f = (n, v) => gl.uniform1f(loc(n), v);
  const u2f = (n, x, y) => gl.uniform2f(loc(n), x, y);
  const u3c = (n, hex) => {
    const c = hexToVec3(hex);
    gl.uniform3f(loc(n), c[0], c[1], c[2]);
  };
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    if (!sh) throw new Error("createShader failed");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
    return sh;
  };

  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    u2f("iResolution", w, h);
  };

  const applyConfig = () => {
    gl.useProgram(program);
    u3c("uBgColor", CONFIG.bgColor);
    u3c("uColorA", CONFIG.colorA);
    u3c("uColorB", CONFIG.colorB);
    u3c("uColorC", CONFIG.colorC);
    u3c("uColorD", CONFIG.colorD);
    u1f("uScale", CONFIG.scale);
    u1f("uSpeed", CONFIG.speed);
    u1f("uFlow", CONFIG.flow);
    u1f("uWarp", CONFIG.warp);
    u1f("uWarpScale", CONFIG.warpScale);
    u1f("uRoughness", CONFIG.roughness);
    u1f("uLacunarity", CONFIG.lacunarity);
    u1f("uThickness", CONFIG.thickness);
    u1f("uIridescence", CONFIG.iridescence);
    u1f("uSpread", CONFIG.spread);
    u1f("uSheen", CONFIG.sheen);
    u1f("uContrast", CONFIG.contrast);
    u1f("uMidpoint", CONFIG.midpoint);
    u1f("uGlow", CONFIG.glow);
    u1f("uSink", CONFIG.sink);
    u1f("uGrain", CONFIG.grain);
    u1f("uGrainAnim", CONFIG.grainAnim);
    u1f("uDither", CONFIG.dither);
    u1f("uVignette", CONFIG.vignette);
    u1f("uPointerRadius", CONFIG.pointerRadius);
    u1f("uPointerStrength", CONFIG.pointerStrength);
    u1f("uParallax", CONFIG.parallax);
    resize();
  };

  const build = () => {
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    if (vao) gl.deleteVertexArray(vao);
    locations = {};
    vertexShader = compile(gl.VERTEX_SHADER, VERT);
    fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
    program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    gl.useProgram(program);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
  };

  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  const mouse = { x: 0, y: 0, ax: 0, ay: 0, wx: 0, wy: 0, tx: 0, ty: 0 };
  const aim = (e) => {
    const rect = canvas.getBoundingClientRect();
    const a = rect.width / rect.height;
    mouse.tx = ((e.clientX - rect.left) / rect.width - 0.5) * a;
    mouse.ty = 0.5 - (e.clientY - rect.top) / rect.height;
  };

  let visible = true;
  const io = new IntersectionObserver((es) => (visible = es[0].isIntersecting), { threshold: 0 });
  io.observe(canvas);

  let prevT = performance.now();
  let clock = 0;
  const frame = (now) => {
    const raw = now - prevT;
    prevT = now;
    if (!visible || document.hidden) return;
    const ms = raw > 50 ? 50 : raw < 4.167 ? 4.167 : raw;
    const s = ms > 36.7 ? 2.2 : ms * 0.06;
    clock += ms * 0.001;
    const kLead = 0.105 * s, kBody = 0.043 * s, kWake = 0.017 * s;
    mouse.ax += (mouse.tx - mouse.ax) * kLead;
    mouse.ay += (mouse.ty - mouse.ay) * kLead;
    mouse.x += (mouse.ax - mouse.x) * kBody;
    mouse.y += (mouse.ay - mouse.y) * kBody;
    mouse.wx += (mouse.x - mouse.wx) * kWake;
    mouse.wy += (mouse.y - mouse.wy) * kWake;
    u1f("iTime", clock);
    if (mouse.rest === undefined) mouse.rest = { x: mouse.tx, y: mouse.ty };
    if (!CONFIG.cursor) {
      mouse.tx = mouse.rest.x;
      mouse.ty = mouse.rest.y;
    }
    u2f("iMouse", mouse.x, mouse.y);
    u2f("iMouseVel", mouse.ax - mouse.x, mouse.ay - mouse.y);
    u2f("iMouseWake", mouse.wx, mouse.wy);
    draw();
  };

  let resizeQueued = false;
  new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resize();
      if (REDUCED) draw();
    });
  }).observe(canvas);

  let stopFrame = null;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    stopFrame?.();
    stopFrame = null;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    build();
    applyConfig();
    draw();
    if (!REDUCED) stopFrame = loop(frame);
  });

  if (CONFIG.cursor) {
    window.addEventListener("pointermove", aim, { passive: true });
    window.addEventListener("pointerdown", aim, { passive: true });
  }

  try {
    build();
    applyConfig();
  } catch (error) {
    console.error("opalesce", error);
    return;
  }
  draw();
  whenReady(() => fade.classList.add("on"));
  if (!REDUCED) stopFrame = loop(frame);
};
$$("[data-opal]").forEach(opalesce);

/* ═══════════ three.js layers ═══════════ */
const threeReady = Promise.resolve({ ...THREE, GLTFLoader, DRACOLoader, RoomEnvironment });
threeReady
  .then((T) => {
    heroModel(T, $("#hero-mount"), heroHandle, (role) => role && setCard(role));
    philosophyScene(T, $("#phil-scene"));
  })
  .catch((error) => {
    console.error("three", error);
    banner(`three.js failed to load: ${error.message}`);
  });

/* ─────────── the hero product ─────────── */
function heroModel(T, mount, handle, onPiece) {
  const {
    WebGLRenderer, SRGBColorSpace, NeutralToneMapping, Scene, PerspectiveCamera, Color, Mesh, PlaneGeometry,
    MeshBasicMaterial, PMREMGenerator, DirectionalLight, Group, Box3, Vector3, Vector2, Raycaster, GLTFLoader, DRACOLoader,
  } = T;

  /* Pulled back from the board's bleed (x 0.125, z 1, ×1.155) so the bag and cup stand whole in frame. */
  const savedHeroLayout = { position: [0.02, -0.03, 0], rotation: [0, 0, 0], scale: 0.94 };
  const FRAME = { left: 0.2697, right: 0.8439, top: 0.0502, bottom: 0.7695 };
  const ASSET = { width: 1153, height: 976 };
  const COVER_FROM = 1024;
  const PLACEMENT = [
    { from: 1024, to: 1280, scale: 0.928, x: 0.01, y: 0 },
    { from: 768, to: 1024, scale: 1.02, x: 0.0454, y: 0.05 },
    { from: 0, to: 640, scale: 0.95, x: -0.045, y: 0.0163 },
  ];
  const PRODUCT = { left: 0, right: 1, top: 0, bottom: 1 };
  const PRODUCT_DEPTH = 0.5;
  const FIT_NUDGE_Y = 0;
  const FRAME_MARGIN = 10;
  const LIFT = {
    bag: { by: 0.05, turn: -0.14, roll: 0.05 },
    cup: { by: 0.1, turn: 0.24, roll: -0.08 },
    stiffness: 0.004,
    damping: 0.88,
    rest: 0.0005,
  };
  const SCROLL_DROP = 0.22;
  const SCROLL_EASE = 0.14;
  const BLEED = 0.22;
  const INTRO = { rise: 0.35, turn: 0.25, roll: -0.05, duration: 1400, delay: 0 };
  const LEAN = { bag: { by: 0.8, ease: 0.06 }, cup: { by: 1.35, ease: 0.15 } };
  const DEG = Math.PI / 180;
  const FIELD_OF_VIEW = 8;
  const POINTER = {
    lean: { yaw: 0.2, pitch: 0.11 },
    dragPerPixel: 0.009,
    yawLimit: 0.6,
    pitchLimit: 0.3,
    friction: 0.94,
    restSpin: 0.0004,
    ease: 0.16,
    restAngle: 0.0002,
  };
  const KEYS = [
    { position: [-4.2, 3, 1.4], intensity: 4 },
    { position: [3.9, 2.5, 1.3], intensity: 1 },
    { position: [0.6, 3, -3.2], intensity: 0.6 },
  ];
  const STUDIO = [
    { size: [7, 7], position: [-2.6, 2.4, 2.6], emit: 11 },
    { size: [5, 5], position: [3.4, 0.5, 2.2], emit: 2.4 },
    { size: [6, 3], position: [0.6, 3, -3], emit: 3.2 },
    { size: [6, 6], position: [0, -3, 1.6], emit: 0.5 },
  ];
  const LIGHT_COLOUR = 0xfcfff9;
  const ENVIRONMENT = 0.045;
  const MIN_PIXEL_RATIO = 1.5;
  const NORMAL_STRENGTH = 1;
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

  const hero = mount.closest("section");

  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = `${-BLEED * 100}%`;
  canvas.style.top = `${-BLEED * 100}%`;
  canvas.style.width = `${(1 + 2 * BLEED) * 100}%`;
  canvas.style.height = `${(1 + 2 * BLEED) * 100}%`;
  canvas.style.display = "block";
  mount.appendChild(canvas);

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  } catch {
    canvas.remove();
    return;
  }

  renderer.setClearAlpha(0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new Scene();
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 100);

  const studio = new Scene();
  studio.background = new Color(0x000000);
  for (const { size, position, emit } of STUDIO) {
    const panel = new Mesh(new PlaneGeometry(size[0], size[1]), new MeshBasicMaterial({ color: new Color(emit, emit, emit) }));
    panel.position.set(position[0], position[1], position[2]);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }

  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = ENVIRONMENT;

  studio.traverse((node) => {
    node.geometry?.dispose();
    node.material?.dispose();
  });

  for (const { position, intensity } of KEYS) {
    const light = new DirectionalLight(LIGHT_COLOUR, intensity);
    light.position.set(position[0], position[1], position[2]);
    scene.add(light);
  }

  const stage = new Group();
  const drift = new Group();
  scene.add(drift);
  drift.add(stage);
  const intro = new Group();
  stage.add(intro);
  const pivot = new Group();
  intro.add(pivot);

  let model = null;
  let pieces = [];
  let hovered = null;
  const layout = savedHeroLayout;
  let plane = null;
  let solid = null;

  const drag = { yaw: 0, pitch: 0 };
  const lean = { yaw: 0, pitch: 0 };
  const shown = { yaw: 0, pitch: 0 };
  let spin = 0;
  let productHeight = 0;
  let dirty = true;
  let onScreen = true;
  let reduced = REDUCED;

  let introStart = null;
  let introDone = reduced;
  const startIntro = () => {
    if (introStart !== null) return;
    introStart = performance.now() + INTRO.delay;
    dirty = true;
  };
  if (page.revealing) startIntro();
  page.subscribe((state) => {
    if (state.revealing) startIntro();
  });

  const project = (box, width, height) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const corner = new Vector3();
    pivot.updateMatrix();
    for (let i = 0; i < 8; i++) {
      corner
        .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .applyMatrix4(pivot.matrix)
        .project(camera);
      x0 = Math.min(x0, ((corner.x + 1) / 2) * width);
      x1 = Math.max(x1, ((corner.x + 1) / 2) * width);
      y0 = Math.min(y0, ((1 - corner.y) / 2) * height);
      y1 = Math.max(y1, ((1 - corner.y) / 2) * height);
    }
    return { x0, y0, x1, y1 };
  };

  let target = null;

  const reframe = () => {
    if (!target || !plane || !solid) return;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const shot = project(plane, target.width, target.height);
    const reach = project(solid, target.width, target.height);
    const edges = target;
    const hold = (want, low, high) => {
      const floor = high - edges.right;
      const ceiling = low - edges.left;
      return floor > ceiling ? (floor + ceiling) / 2 : Math.min(Math.max(want, floor), ceiling);
    };
    camera.setViewOffset(
      target.width,
      target.height,
      hold((shot.x0 + shot.x1) / 2 - target.x, reach.x0, reach.x1),
      (shot.y0 + shot.y1) / 2 - target.y,
      target.width,
      target.height,
    );
    camera.updateProjectionMatrix();
  };

  const fit = () => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    if (!width || !height || !model || !plane) return;
    const padX = width * BLEED;
    const padY = height * BLEED;
    const canvasWidth = width + 2 * padX;
    const canvasHeight = height + 2 * padY;

    const onPage = mount.getBoundingClientRect();
    const canvasLeft = onPage.left - padX;

    const cover = window.innerWidth >= COVER_FROM;
    const lay = cover ? Math.max(width / ASSET.width, height / ASSET.height) : Math.min(width / ASSET.width, height / ASSET.height);
    const laidW = ASSET.width * lay;
    const laidH = ASSET.height * lay;
    const offsetX = (width - laidW) / 2;
    const offsetY = cover ? (height - laidH) / 2 : height - laidH;
    const rect = {
      left: (offsetX + FRAME.left * laidW) / width,
      right: (offsetX + FRAME.right * laidW) / width,
      top: (offsetY + FRAME.top * laidH) / height,
      bottom: (offsetY + FRAME.bottom * laidH) / height,
    };

    const place = PLACEMENT.find((band) => window.innerWidth >= band.from && window.innerWidth < band.to);
    if (place) {
      const tall = rect.bottom - rect.top;
      const half = (rect.right - rect.left) / 2;
      const middle = (rect.left + rect.right) / 2 + place.x;
      rect.top = rect.bottom - tall * place.scale + place.y;
      rect.bottom += place.y;
      rect.left = middle - half;
      rect.right = middle + half;
    }

    camera.aspect = canvasWidth / canvasHeight;

    const targetTop = padY + height * rect.top;
    const targetHeight = height * (rect.bottom - rect.top);

    const turned = pivot.rotation.clone();
    pivot.rotation.set(0, 0, 0);

    let distance = plane.getSize(new Vector3()).y / (rect.bottom - rect.top) / 2 / Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
    for (let pass = 0; pass < 4; pass++) {
      camera.near = distance / 20;
      camera.far = distance * 4;
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const shot = project(plane, canvasWidth, canvasHeight);
      distance *= (shot.y1 - shot.y0) / targetHeight;
    }

    target = {
      x: padX + width * ((rect.left + rect.right) / 2),
      y: targetTop + targetHeight * (0.5 + FIT_NUDGE_Y),
      width: canvasWidth,
      height: canvasHeight,
      left: FRAME_MARGIN - canvasLeft,
      right: window.innerWidth - canvasLeft - FRAME_MARGIN,
    };

    pivot.rotation.copy(turned);
    reframe();

    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, MIN_PIXEL_RATIO), 2));
    renderer.setSize(canvasWidth, canvasHeight, false);
    dirty = true;
  };

  const frame = () => {
    if (!model || !onScreen || document.hidden) return;

    if (hero && !reduced && productHeight) {
      const box = hero.getBoundingClientRect();
      const away = Math.min(1, Math.max(0, -box.top / box.height));
      const gap = -away * SCROLL_DROP * productHeight - drift.position.y;
      if (Math.abs(gap) > productHeight * 1e-4) {
        drift.position.y += gap * SCROLL_EASE;
        dirty = true;
      }
    }

    if (!introDone && productHeight) {
      const t = introStart === null ? 0 : Math.min(1, Math.max(0, (performance.now() - introStart) / INTRO.duration));
      const left = Math.pow(1 - t, 3);
      intro.position.y = -left * INTRO.rise * productHeight;
      intro.rotation.set(0, left * INTRO.turn, left * INTRO.roll);
      introDone = t >= 1;
      dirty = true;
    }

    if (spin) {
      drag.yaw = clamp(drag.yaw + spin, POINTER.yawLimit);
      spin = Math.abs(spin) > POINTER.restSpin ? spin * POINTER.friction : 0;
      dirty = true;
    }

    for (const piece of pieces) {
      const liftGap = (hovered === piece ? 1 : 0) - piece.lift;
      const yawGap = lean.yaw * piece.leanBy - piece.lean.yaw;
      const pitchGap = lean.pitch * piece.leanBy - piece.lean.pitch;
      if (Math.abs(liftGap) < LIFT.rest && Math.abs(piece.speed) < LIFT.rest && Math.abs(yawGap) < POINTER.restAngle && Math.abs(pitchGap) < POINTER.restAngle) continue;
      piece.speed = (piece.speed + liftGap * LIFT.stiffness) * LIFT.damping;
      piece.lift += piece.speed;
      piece.lean.yaw += yawGap * piece.leanEase;
      piece.lean.pitch += pitchGap * piece.leanEase;
      piece.node.position.y = piece.base + piece.lift * piece.by * productHeight;
      piece.node.rotation.set(piece.lean.pitch, piece.lean.yaw + piece.lift * piece.turn, piece.lift * piece.roll);
      dirty = true;
    }

    const yaw = clamp(drag.yaw, POINTER.yawLimit);
    const pitch = clamp(drag.pitch, POINTER.pitchLimit);
    const dYaw = yaw - shown.yaw;
    const dPitch = pitch - shown.pitch;
    if (Math.abs(dYaw) > POINTER.restAngle || Math.abs(dPitch) > POINTER.restAngle) {
      shown.yaw += dYaw * POINTER.ease;
      shown.pitch += dPitch * POINTER.ease;
      dirty = true;
    }

    if (!dirty) return;
    pivot.rotation.set(shown.pitch, shown.yaw, 0);
    reframe();
    renderer.render(scene, camera);
    dirty = false;
  };
  loop(frame);

  const measure = () => {
    if (!model) return;
    model.removeFromParent();
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(model);
    const span = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());

    const sized = model.children.map((node) => ({ node, height: new Box3().setFromObject(node).getSize(new Vector3()).y }));
    const tallest = Math.max(...sized.map((piece) => piece.height));
    pieces = sized.map(({ node, height }) => {
      const role = height === tallest ? "bag" : "cup";
      return {
        node,
        role,
        base: node.position.y,
        ...LIFT[role],
        lift: 0,
        speed: 0,
        leanBy: LEAN[role].by,
        leanEase: LEAN[role].ease,
        lean: { yaw: 0, pitch: 0 },
      };
    });
    hovered = null;

    model.position.set(
      -(box.min.x + span.x * ((PRODUCT.left + PRODUCT.right) / 2)),
      -(box.max.y - span.y * ((PRODUCT.top + PRODUCT.bottom) / 2)),
      -centre.z,
    );
    pivot.add(model);
    pivot.updateWorldMatrix(true, true);

    const world = new Box3().setFromObject(pivot);
    const reach = world.getSize(new Vector3());
    const back = world.min.z;
    const front = world.min.z + reach.z * PRODUCT_DEPTH;
    const left = world.min.x + reach.x * PRODUCT.left;
    const right = world.min.x + reach.x * PRODUCT.right;
    const bottom = world.max.y - reach.y * PRODUCT.bottom;
    const top = world.max.y - reach.y * PRODUCT.top;

    plane = new Box3(new Vector3(left, bottom, front), new Vector3(right, top, front));
    productHeight = top - bottom;
    solid = new Box3(new Vector3(left, bottom, back), new Vector3(right, top, world.max.z));

    fit();
  };

  const applyStage = () => {
    const [x, y, z] = layout.position;
    const [rx, ry, rz] = layout.rotation;
    stage.position.set(x * productHeight, y * productHeight, z * productHeight);
    stage.rotation.set(rx * DEG, ry * DEG, rz * DEG);
    stage.scale.setScalar(layout.scale);
    dirty = true;
  };

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const pick = (event) => {
    if (!model) return;
    const box = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    let node = raycaster.intersectObject(model, true)[0]?.object ?? null;
    while (node && node.parent !== model) node = node.parent;
    const next = pieces.find((piece) => piece.node === node) ?? null;
    if (next !== hovered) {
      hovered = next;
      dirty = true;
      onPiece?.(next?.role ?? null); if (next) playCupClink(next.role === "bag" ? 0.9 : 1.2);
    }
  };

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  const loader = new GLTFLoader().setDRACOLoader(draco);

  loader.load(
    MODEL_URL,
    (gltf) => {
      const holdsMesh = (rootNode) => {
        let found = false;
        rootNode.traverse((node) => {
          if (node.isMesh) found = true;
        });
        return found;
      };
      model = gltf.scenes.find(holdsMesh) ?? gltf.scene;

      model.traverse((node) => {
        if (!node.isMesh) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          const { normalScale } = material;
          normalScale?.set(Math.sign(normalScale.x) * NORMAL_STRENGTH, Math.sign(normalScale.y) * NORMAL_STRENGTH);
        }
      });
      dressPackaging(THREE, model).ready.then(() => (dirty = true));

      const loaded = model;
      loaded.updateWorldMatrix(true, true);
      for (const node of [...loaded.children]) {
        const centre = new Box3().setFromObject(node).getCenter(new Vector3());
        const holder = new Group();
        holder.name = node.name;
        holder.position.copy(centre);
        loaded.add(holder);
        node.position.sub(centre);
        holder.add(node);
      }
      measure();
      applyStage();
    },
    undefined,
    (error) => {
      console.error("hero model", error);
      banner(`Hero model failed to load: ${MODEL_URL}`);
    },
  );

  new ResizeObserver(fit).observe(mount);
  new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting)).observe(mount);

  const onVisible = () => (dirty = true);
  document.addEventListener("visibilitychange", onVisible);
  canvas.addEventListener("webglcontextrestored", onVisible);

  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
    reduced = event.matches;
    if (reduced) {
      lean.yaw = 0;
      lean.pitch = 0;
      spin = 0;
    }
  });

  let dragging = false, lastX = 0, lastY = 0;
  const onDown = (event) => {
    dragging = true;
    spin = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    try {
      handle?.setPointerCapture(event.pointerId);
    } catch {}
  };
  const onDrag = (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    drag.yaw = clamp(drag.yaw + dx * POINTER.dragPerPixel, POINTER.yawLimit);
    drag.pitch = clamp(drag.pitch + dy * POINTER.dragPerPixel, POINTER.pitchLimit);
    spin = reduced ? 0 : dx * POINTER.dragPerPixel;
    dirty = true;
  };
  const onUp = (event) => {
    dragging = false;
    try {
      handle?.releasePointerCapture(event.pointerId);
    } catch {}
  };
  const onLeave = () => {
    hovered = null;
    dirty = true;
    onPiece?.(null);
  };
  handle?.addEventListener("mouseenter", pick);
  handle?.addEventListener("mouseleave", onLeave);
  handle?.addEventListener("pointerdown", onDown);
  handle?.addEventListener("pointermove", (event) => {
    onDrag(event);
    if (!dragging) pick(event);
  });
  handle?.addEventListener("pointerup", onUp);
  handle?.addEventListener("pointercancel", onUp);

  hero?.addEventListener("pointermove", (event) => {
    if (dragging || reduced) return;
    const box = hero.getBoundingClientRect();
    const nx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
    const ny = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);
    lean.yaw = clamp(nx, 1) * POINTER.lean.yaw;
    lean.pitch = -clamp(ny, 1) * POINTER.lean.pitch;
    dirty = true;
  });
  hero?.addEventListener("pointerleave", () => {
    lean.yaw = 0;
    lean.pitch = 0;
    dirty = true;
  });
}

/* ─────────── the philosophy scene ─────────── */
function philosophyScene(T, mount) {
  const {
    WebGLRenderer, SRGBColorSpace, NeutralToneMapping, Scene, Fog, PerspectiveCamera, PMREMGenerator, RoomEnvironment,
    DirectionalLight, Group, Vector3, Matrix4, Box3, InstancedMesh, Quaternion, GLTFLoader, DRACOLoader,
    Sprite, SpriteMaterial, CanvasTexture,
  } = T;

  const VIEW = { fov: 30, distance: 20 };
  const DEPTH = { near: -3, far: -12 };
  const BEANS = { desktop: 34, mobile: 16, length: 0.07, scale: { min: 0.55, max: 1.7 } };
  const CUP = {
    yaw: Math.PI + 1.2, tilt: 0.21, scale: 0.92, drop: 0.02, capsule: 0.36,
    lean: { yaw: 0.26, pitch: 0.1 }, follow: 4, spin: Math.PI * 0.4, spinFollow: 6, rise: 1.1, riseRate: 2.4,
    // The cup sits left of the lens, so its printed face is turned a little further round to meet it.
    face: 0.5,
  };
  const LIGHT = {
    exposure: 1.15,
    environment: 0.55,
    key: { colour: 0xfff1e0, intensity: 2.4, position: [-5, 6, 7] },
    rim: { colour: 0xffd9b0, intensity: 1.6, position: [5, 3, -6] },
    // Gold edge light from behind, so the black cup separates from the dark ground.
    gold: { colour: 0xffb466, intensity: 3.2, position: [-7, 4, -5] },
  };
  /* Steam off the lid: soft puffs that rise, widen and fade, in cup heights. */
  const STEAM = { count: 9, life: 4.2, rise: 0.85, drift: 0.07, size: { from: 0.28, to: 0.8 }, opacity: 0.3 };
  const FOG = { colour: 0x070707, start: 4, end: 24 };
  const VORTEX = { strength: 2.4, fullSpeed: 1600, follow: 3 };
  const POINTER_SETTLE = 8;
  const POINTER_MAX_SPEED = 24;
  const MOBILE_FRAME = 1000 / 30;
  const CUP_MATERIAL = "CupCoffee";
  const BEAN_MATERIAL = "COFFEE_MAT";

  /* ── bean-field ── */
  const FIELD = {
    step: 1 / 120, maxSteps: 8, wander: 0.16, wanderRate: { min: 0.12, max: 0.34 }, drag: 0.42, spinDrag: 0.3,
    spinWander: 0.22, wall: 4.5, bleed: 0.6, restitution: 0.62, friction: 0.35, pointerReach: 0.16, pointerPush: 26,
    pointerWake: 1.8, pointerSpin: 3.2, maxSpeed: 7, maxSpin: 6, radius: 0.36, vortexCore: 3, vortexInward: 0.22, vortexSpin: 0.35,
  };
  const _d = new Vector3(), _n = new Vector3(), _t = new Vector3(), _p = new Vector3(), _w = new Vector3(), _a = new Vector3();
  const _ri = new Vector3(), _rj = new Vector3(), _rel = new Vector3(), _seg = new Vector3(), _q = new Quaternion();
  const halfHeight = (view, z) => (view.distance - z) * view.tanHalf;
  const randomUnit = (target, random) => {
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    return target.set(r * Math.cos(angle), r * Math.sin(angle), z);
  };
  const randomRotation = (target, random) => {
    const u1 = random(), u2 = random() * Math.PI * 2, u3 = random() * Math.PI * 2;
    const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    return target.set(a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3));
  };
  const closestOnSegment = (obstacle, p, target) => {
    _seg.subVectors(obstacle.b, obstacle.a);
    const length = _seg.lengthSq();
    const s = length > 0 ? Math.min(1, Math.max(0, _t.subVectors(p, obstacle.a).dot(_seg) / length)) : 0;
    return target.copy(obstacle.a).addScaledVector(_seg, s);
  };
  const createField = (count, sizes, world, random = Math.random) => {
    const beans = [];
    const { view, obstacle } = world;
    for (let i = 0; i < count; i++) {
      const scale = sizes.min * Math.pow(sizes.max / sizes.min, random());
      const size = sizes.base * scale;
      const radius = size * FIELD.radius;
      const mass = scale * scale * scale;
      const position = new Vector3();
      for (let attempt = 0; attempt < 40; attempt++) {
        const z = lerp(view.far, view.near, random());
        const half = halfHeight(view, z) * 0.9;
        position.set((random() * 2 - 1) * half * view.aspect, (random() * 2 - 1) * half, z);
        const clearOfBeans = beans.every((other) => other.position.distanceTo(position) > other.radius + radius);
        const clearOfCup = !obstacle || closestOnSegment(obstacle, position, _p).distanceTo(position) > obstacle.radius + radius;
        if (clearOfBeans && clearOfCup) break;
      }
      beans.push({
        position,
        velocity: randomUnit(new Vector3(), random).multiplyScalar(lerp(0.08, 0.25, random())),
        rotation: randomRotation(new Quaternion(), random),
        spin: randomUnit(new Vector3(), random).multiplyScalar(lerp(0.15, 0.5, random())),
        size,
        radius,
        mass,
        inertia: 0.4 * mass * radius * radius,
        phase: [random() * 7, random() * 7, random() * 7],
        rate: [
          lerp(FIELD.wanderRate.min, FIELD.wanderRate.max, random()),
          lerp(FIELD.wanderRate.min, FIELD.wanderRate.max, random()),
          lerp(FIELD.wanderRate.min, FIELD.wanderRate.max, random()),
        ],
      });
    }
    return { beans, debt: 0, time: 0 };
  };
  const moveBean = (bean, h, time, world) => {
    const { position: p, velocity: v, spin: w, phase, rate } = bean;
    const { view, pointer } = world;
    const inverseMass = 1 / bean.mass;
    _a.set(Math.sin(time * rate[0] + phase[0]), Math.sin(time * rate[1] + phase[1]), 0.6 * Math.sin(time * rate[2] + phase[2])).multiplyScalar(FIELD.wander);
    const halfH = halfHeight(view, p.z);
    const inset = bean.radius * (1 - FIELD.bleed);
    const limitX = halfH * view.aspect - inset;
    const limitY = halfH - inset;
    if (Math.abs(p.x) > limitX) _a.x -= Math.sign(p.x) * (Math.abs(p.x) - limitX) * FIELD.wall;
    if (Math.abs(p.y) > limitY) _a.y -= Math.sign(p.y) * (Math.abs(p.y) - limitY) * FIELD.wall;
    if (p.z > view.near) _a.z -= (p.z - view.near) * FIELD.wall;
    if (p.z < view.far) _a.z += (view.far - p.z) * FIELD.wall;
    if (pointer.active) {
      const reach = FIELD.pointerReach * 2 * view.distance * view.tanHalf;
      _d.subVectors(p, pointer.origin);
      const along = _d.dot(pointer.direction);
      _d.addScaledVector(pointer.direction, -along);
      const distance = _d.length();
      if (along > 0 && distance < reach) {
        const falloff = 1 - distance / reach;
        if (distance > 1e-5) {
          _n.copy(_d).divideScalar(distance);
          _a.addScaledVector(_n, FIELD.pointerPush * falloff * falloff * inverseMass);
          _w.crossVectors(_n, pointer.velocity).multiplyScalar(-FIELD.pointerSpin * falloff * inverseMass * h);
          w.add(_w);
        }
        _a.addScaledVector(pointer.velocity, FIELD.pointerWake * falloff * inverseMass);
      }
    }
    const { vortex } = world;
    if (vortex.strength) {
      const dx = p.x - vortex.centre.x;
      const dy = p.y - vortex.centre.y;
      const r = Math.hypot(dx, dy);
      if (r > 1e-4) {
        const swirl = vortex.strength * Math.min(1, r / FIELD.vortexCore);
        _a.x += (-dy / r) * swirl - (dx / r) * Math.abs(swirl) * FIELD.vortexInward;
        _a.y += (dx / r) * swirl - (dy / r) * Math.abs(swirl) * FIELD.vortexInward;
        w.z += swirl * FIELD.vortexSpin * h;
      }
    }
    v.addScaledVector(_a, h).multiplyScalar(Math.exp(-FIELD.drag * h));
    if (v.lengthSq() > FIELD.maxSpeed * FIELD.maxSpeed) v.setLength(FIELD.maxSpeed);
    p.addScaledVector(v, h);
    w.x += Math.sin(time * rate[1] * 0.7 + phase[2]) * FIELD.spinWander * h;
    w.y += Math.sin(time * rate[2] * 0.7 + phase[0]) * FIELD.spinWander * h;
    w.z += Math.sin(time * rate[0] * 0.7 + phase[1]) * FIELD.spinWander * h;
    w.multiplyScalar(Math.exp(-FIELD.spinDrag * h));
    if (w.lengthSq() > FIELD.maxSpin * FIELD.maxSpin) w.setLength(FIELD.maxSpin);
    const angle = w.length() * h;
    if (angle > 1e-9) {
      _q.setFromAxisAngle(_w.copy(w).normalize(), angle);
      bean.rotation.premultiply(_q).normalize();
    }
  };
  const collide = (i, j) => {
    _d.subVectors(j.position, i.position);
    const reach = i.radius + j.radius;
    const distanceSq = _d.lengthSq();
    if (distanceSq >= reach * reach || distanceSq < 1e-12) return;
    const distance = Math.sqrt(distanceSq);
    _n.copy(_d).divideScalar(distance);
    const im = 1 / i.mass;
    const jm = 1 / j.mass;
    const correction = (reach - distance) / (im + jm);
    i.position.addScaledVector(_n, -correction * im);
    j.position.addScaledVector(_n, correction * jm);
    _ri.copy(_n).multiplyScalar(i.radius);
    _rj.copy(_n).multiplyScalar(-j.radius);
    _rel.copy(j.velocity).add(_t.crossVectors(j.spin, _rj)).sub(i.velocity).sub(_p.crossVectors(i.spin, _ri));
    const closing = _rel.dot(_n);
    if (closing >= 0) return;
    const normal = (-(1 + FIELD.restitution) * closing) / (im + jm);
    _t.copy(_rel).addScaledVector(_n, -closing);
    const sliding = _t.length();
    let tangent = 0;
    if (sliding > 1e-6) {
      _t.divideScalar(sliding);
      tangent = Math.min(FIELD.friction * normal, sliding / (im + jm + (i.radius * i.radius) / i.inertia + (j.radius * j.radius) / j.inertia));
    }
    _p.copy(_n).multiplyScalar(normal).addScaledVector(_t, -tangent);
    i.velocity.addScaledVector(_p, -im);
    j.velocity.addScaledVector(_p, jm);
    i.spin.add(_w.crossVectors(_ri, _p).multiplyScalar(-1 / i.inertia));
    j.spin.add(_w.crossVectors(_rj, _p).multiplyScalar(1 / j.inertia));
  };
  const bounceOff = (bean, obstacle) => {
    closestOnSegment(obstacle, bean.position, _p);
    _d.subVectors(bean.position, _p);
    const reach = bean.radius + obstacle.radius;
    const distanceSq = _d.lengthSq();
    if (distanceSq >= reach * reach || distanceSq < 1e-12) return;
    const distance = Math.sqrt(distanceSq);
    _n.copy(_d).divideScalar(distance);
    bean.position.copy(_p).addScaledVector(_n, reach);
    const closing = bean.velocity.dot(_n);
    if (closing >= 0) return;
    _t.copy(bean.velocity).addScaledVector(_n, -closing);
    bean.spin.addScaledVector(_w.crossVectors(_n, _t), FIELD.friction / bean.radius);
    _t.multiplyScalar(-FIELD.friction);
    bean.velocity.addScaledVector(_n, -(1 + FIELD.restitution) * closing).add(_t);
  };
  const stepField = (field, dt, world) => {
    field.debt = Math.min(field.debt + dt, FIELD.step * FIELD.maxSteps);
    const { beans } = field;
    while (field.debt >= FIELD.step) {
      for (const bean of beans) moveBean(bean, FIELD.step, field.time, world);
      for (let i = 0; i < beans.length; i++) for (let j = i + 1; j < beans.length; j++) collide(beans[i], beans[j]);
      if (world.obstacle) for (const bean of beans) bounceOff(bean, world.obstacle);
      field.debt -= FIELD.step;
      field.time += FIELD.step;
    }
  };

  /* ── the scene ── */
  const materialsOf = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
  const meshesOf = (rootNode) => {
    const found = [];
    rootNode.traverse((node) => node.isMesh && found.push(node));
    return found;
  };
  const isCupOnly = (rootNode) => {
    const meshes = meshesOf(rootNode);
    return meshes.length > 0 && meshes.every((mesh) => materialsOf(mesh).every((material) => material.name.startsWith(CUP_MATERIAL)));
  };

  const section = mount.closest("section");
  const mark = section.querySelector("[data-philosophy-cup]");
  const mobile = window.innerWidth < 768 || window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const reduced = REDUCED;

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  mount.appendChild(canvas);

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: !mobile, stencil: false, powerPreference: mobile ? "default" : "high-performance" });
  } catch {
    canvas.remove();
    return;
  }
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = LIGHT.exposure;

  const scene = new Scene();
  scene.fog = new Fog(FOG.colour, VIEW.distance + FOG.start, VIEW.distance + FOG.end);
  const camera = new PerspectiveCamera(VIEW.fov, 1, 1, 60);
  camera.position.set(0, 0, VIEW.distance);
  camera.lookAt(0, 0, 0);

  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = LIGHT.environment;

  for (const { colour, intensity, position } of [LIGHT.key, LIGHT.rim, LIGHT.gold]) {
    const light = new DirectionalLight(colour, intensity);
    light.position.set(position[0], position[1], position[2]);
    scene.add(light);
  }

  const cup = new Group();
  cup.visible = false;
  scene.add(cup);
  const spin = new Group();
  cup.add(spin);
  let turned = 0;

  const steam = new Group();
  steam.visible = false;
  scene.add(steam);
  const puffs = [];
  if (!reduced) {
    const puffCanvas = document.createElement("canvas");
    puffCanvas.width = puffCanvas.height = 128;
    const pctx = puffCanvas.getContext("2d");
    const fade = pctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    fade.addColorStop(0, "rgba(255,255,255,1)");
    fade.addColorStop(0.45, "rgba(255,255,255,0.35)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    pctx.fillStyle = fade;
    pctx.fillRect(0, 0, 128, 128);
    const puffMap = new CanvasTexture(puffCanvas);
    puffMap.colorSpace = SRGBColorSpace;
    for (let i = 0; i < STEAM.count; i++) {
      const puff = new Sprite(new SpriteMaterial({ map: puffMap, color: 0xfff1e2, transparent: true, depthWrite: false, opacity: 0 }));
      puff.userData = { age: (i / STEAM.count) * STEAM.life, sway: Math.random() * Math.PI * 2 };
      steam.add(puff);
      puffs.push(puff);
    }
  }
  const lid = new Vector3();
  const moveSteam = (dt) => {
    steam.visible = cup.visible && puffs.length > 0;
    if (!steam.visible) return;
    lid.set(0, 0.5, 0).applyMatrix4(cup.matrixWorld);
    const h = place.height;
    for (const puff of puffs) {
      const d = puff.userData;
      d.age = (d.age + dt) % STEAM.life;
      const t = d.age / STEAM.life;
      puff.position.set(lid.x + Math.sin(d.sway + t * 3) * STEAM.drift * h * (0.3 + t), lid.y + t * STEAM.rise * h, lid.z);
      puff.scale.setScalar(lerp(STEAM.size.from, STEAM.size.to, t) * h);
      puff.material.opacity = Math.sin(Math.PI * t) * STEAM.opacity * (1 - rise);
    }
  };

  const tanHalf = Math.tan((VIEW.fov * Math.PI) / 360);
  const view = { distance: VIEW.distance, tanHalf, aspect: 1, near: DEPTH.near, far: DEPTH.far };
  const world = {
    view,
    pointer: { active: false, origin: new Vector3(), direction: new Vector3(), velocity: new Vector3() },
    obstacle: null,
    vortex: { centre: new Vector3(0, 0, (DEPTH.near + DEPTH.far) / 2), strength: 0 },
  };
  const capsule = { a: new Vector3(), b: new Vector3(), radius: 0 };
  let lastScroll = null;

  const place = { x: 0, bottom: 0, height: 0, shown: false };
  const aim = { x: 0, y: 0 };
  const lean = { yaw: 0, pitch: 0 };
  let rise = reduced ? 0 : 1;

  let field = null, beans = null, cupReady = false, ready = false, dirty = true, onScreen = false, last = 0, lastDraw = 0;

  const poseCup = () => {
    cup.visible = cupReady && place.shown;
    cup.scale.setScalar(place.height || 1);
    cup.position.set(place.x, place.bottom + place.height / 2 - rise * place.height * CUP.rise, 0);
    cup.rotation.set(lean.pitch, lean.yaw, -CUP.tilt);
    cup.updateMatrixWorld();
    if (!cup.visible) {
      world.obstacle = null;
      return;
    }
    capsule.radius = place.height * CUP.capsule;
    capsule.a.set(0, -0.5 + CUP.capsule, 0).applyMatrix4(cup.matrixWorld);
    capsule.b.set(0, 0.5 - CUP.capsule, 0).applyMatrix4(cup.matrixWorld);
    world.obstacle = capsule;
  };

  let fittedWidth = 0;
  const fit = () => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    if (!width || !height) return;
    if (mobile && fittedWidth === width && ready) return;
    fittedWidth = width;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    view.aspect = camera.aspect;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.5));
    renderer.setSize(width, height, false);
    if (mark) {
      const box = mount.getBoundingClientRect();
      const cell = mark.getBoundingClientRect();
      place.shown = cell.height > 0;
      if (place.shown) {
        const u = (2 * VIEW.distance * tanHalf) / height;
        place.height = cell.height * u * CUP.scale;
        place.x = (cell.left + cell.width / 2 - box.left - width / 2) * u;
        place.bottom = (box.top + height / 2 - cell.bottom) * u - place.height * CUP.drop;
        // Where the cup stands, for the glow behind it.
        section.style.setProperty("--phil-cup-x", `${cell.left + cell.width / 2 - box.left}px`);
        section.style.setProperty("--phil-cup-y", `${cell.top + cell.height * 0.45 - box.top}px`);
        section.style.setProperty("--phil-cup-size", `${cell.height * 1.5}px`);
        section.style.setProperty("--phil-cup-base", `${cell.bottom - box.top}px`);
        section.style.setProperty("--phil-cup-w", `${cell.width}px`);
      }
    }
    poseCup();
    dirty = true;
  };

  const matrix = new Matrix4();
  const scale = new Vector3();
  const writeBeans = () => {
    if (!field || !beans) return;
    field.beans.forEach((bean, i) => {
      matrix.compose(bean.position, bean.rotation, scale.setScalar(bean.size));
      beans.setMatrixAt(i, matrix);
    });
    beans.instanceMatrix.needsUpdate = true;
  };

  const ray = new Vector3();
  loop((time) => {
    if (!ready || !onScreen || document.hidden) {
      last = 0;
      lastScroll = null;
      return;
    }
    if (mobile && time - lastDraw < MOBILE_FRAME) return;
    const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    lastDraw = time;

    if (!reduced && dt > 0) {
      const { pointer } = world;
      if (pointer.active) {
        ray.set(aim.x, aim.y, 0.5).unproject(camera).sub(camera.position).normalize();
        pointer.origin.copy(camera.position);
        pointer.direction.copy(ray);
      }
      pointer.velocity.multiplyScalar(Math.exp(-POINTER_SETTLE * dt));

      const follow = 1 - Math.exp(-CUP.follow * dt);
      const aimed = pointer.active ? 1 : 0;
      lean.yaw += (aim.x * aimed * CUP.lean.yaw - lean.yaw) * follow;
      lean.pitch += (-aim.y * aimed * CUP.lean.pitch - lean.pitch) * follow;
      rise *= Math.exp(-CUP.riseRate * dt);

      const box = section.getBoundingClientRect();
      const travel = Math.min(1, Math.max(0, (window.innerHeight - box.top) / (window.innerHeight + box.height)));
      turned += ((travel - 0.5) * CUP.spin - turned) * (1 - Math.exp(-CUP.spinFollow * dt));
      spin.rotation.y = turned;
      poseCup();
      moveSteam(dt);

      const scrollNow = window.scrollY;
      const scrollSpeed = lastScroll === null ? 0 : (scrollNow - lastScroll) / dt;
      lastScroll = scrollNow;
      const swirl = Math.max(-1, Math.min(1, scrollSpeed / VORTEX.fullSpeed)) * VORTEX.strength;
      world.vortex.strength += (swirl - world.vortex.strength) * (1 - Math.exp(-VORTEX.follow * dt));

      if (field) stepField(field, dt, world);
      dirty = true;
    }

    if (!dirty) return;
    writeBeans();
    renderer.render(scene, camera);
    dirty = false;
  });

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  loader.load(
    MODEL_URL,
    (gltf) => {
      const cupScene = gltf.scenes.find(isCupOnly);
      if (cupScene) {
        dressPackaging(THREE, cupScene).ready.then(() => (dirty = true));
        cupScene.rotation.set(0, CUP.yaw + CUP.face, 0);
        cupScene.updateWorldMatrix(true, true);
        const box = new Box3().setFromObject(cupScene);
        const size = box.getSize(new Vector3());
        cupScene.position.sub(box.getCenter(new Vector3()));
        const unitGroup = new Group();
        unitGroup.scale.setScalar(1 / (size.y || 1));
        unitGroup.add(cupScene);
        spin.add(unitGroup);
        cupReady = true;
      }

      const bean = gltf.scenes.flatMap(meshesOf).find((mesh) => materialsOf(mesh).some((material) => material.name === BEAN_MATERIAL));
      if (bean) {
        bean.updateWorldMatrix(true, false);
        const geometry = bean.geometry.clone().applyMatrix4(bean.matrixWorld);
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox ?? new Box3();
        const centre = bounds.getCenter(new Vector3());
        const longest = Math.max(...bounds.getSize(new Vector3()).toArray()) || 1;
        geometry.translate(-centre.x, -centre.y, -centre.z);
        geometry.scale(1 / longest, 1 / longest, 1 / longest);
        beans = new InstancedMesh(geometry, bean.material, mobile ? BEANS.mobile : BEANS.desktop);
        beans.frustumCulled = false;
        scene.add(beans);
      }

      fit();
      if (beans) {
        field = createField(beans.count, { base: BEANS.length * 2 * VIEW.distance * tanHalf, ...BEANS.scale }, world);
        writeBeans();
      }

      for (const mesh of meshesOf(scene)) {
        for (const material of materialsOf(mesh)) {
          for (const value of Object.values(material)) if (value?.isTexture) renderer.initTexture(value);
        }
      }
      renderer.compileAsync(scene, camera).then(() => {
        const entering = rise;
        rise = 0;
        poseCup();
        renderer.render(scene, camera);
        rise = entering;
        poseCup();
        ready = true;
        dirty = true;
      });
    },
    undefined,
    (error) => {
      console.error("philosophy scene", error);
      banner(`Philosophy model failed to load: ${MODEL_URL}`);
    },
  );

  let queued = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(queued);
    queued = requestAnimationFrame(fit);
  }).observe(mount);
  new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      dirty = true;
    },
    { rootMargin: "10% 0px" },
  ).observe(mount);

  const onVisible = () => (dirty = true);
  document.addEventListener("visibilitychange", onVisible);
  canvas.addEventListener("webglcontextrestored", onVisible);

  let lastMove = { x: 0, y: 0, t: 0 };
  const scratch = new Vector3();
  const onMove = (event) => {
    const box = mount.getBoundingClientRect();
    aim.x = ((event.clientX - box.left) / box.width) * 2 - 1;
    aim.y = -(((event.clientY - box.top) / box.height) * 2 - 1);
    const elapsed = (event.timeStamp - lastMove.t) / 1000;
    if (world.pointer.active && elapsed > 0 && elapsed < 0.1) {
      const u = (2 * VIEW.distance * tanHalf) / box.height;
      scratch.set(((event.clientX - lastMove.x) / elapsed) * u, -((event.clientY - lastMove.y) / elapsed) * u, 0);
      world.pointer.velocity.lerp(scratch, 0.5).clampLength(0, POINTER_MAX_SPEED);
    }
    lastMove = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    world.pointer.active = true; if (Math.random() < 0.15) playBeanClatter();
  };
  const onLeave = () => {
    world.pointer.active = false;
    aim.x = 0;
    aim.y = 0;
  };
  section.addEventListener("pointermove", onMove, { passive: true });
  section.addEventListener("pointerdown", onMove, { passive: true });
  section.addEventListener("pointerleave", onLeave, { passive: true });
  section.addEventListener("pointercancel", onLeave, { passive: true });
}

/* ══════════════════════════════════ SHOP ══════════════════════════════════ */
/* Prices are whole Pakistani rupees, written the way Lahore menus write them: "Rs 1,150". */
const money = (n) => `Rs ${Math.round(n).toLocaleString("en-US")}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ARROW_SVG = `<svg viewBox="0 0 12.2137 13.2551" fill="none" aria-hidden="true"><path d="M11.9501 7.26396C12.3016 6.91249 12.3016 6.34264 11.9501 5.99117L6.22254 0.263604C5.87107 -0.0878682 5.30122 -0.0878682 4.94975 0.263604C4.59828 0.615076 4.59828 1.18492 4.94975 1.5364L10.0409 6.62756L4.94975 11.7187C4.59828 12.0702 4.59828 12.6401 4.94975 12.9915C5.30122 13.343 5.87107 13.343 6.22254 12.9915L11.9501 7.26396ZM0 6.62756V7.52756H11.3137V6.62756V5.72756H0V6.62756Z" fill="currentColor"/></svg>`;

const CAT_LABEL = { all: "ALL", beans: "BEANS", drinks: "DRINKS", kitchen: "KITCHEN", coolers: "COOLERS", bakery: "BAKERY", merch: "MERCH", gifts: "GIFTS" };
const PICKUP_COPY = "Ready in about 12 minutes on MM Alam Road, in DHA Phase 5 or on Main Boulevard, Johar Town. Open daily 07:00–21:00. Show your order number at the pickup counter.";

/* Option choices are [label, price delta, note]. `def` is the preselected index. */
const MILK = { key: "milk", label: "MILK", choices: [["WHOLE", 0], ["OAT", 150], ["ALMOND", 150]] };
const PRODUCTS = [
  {
    id: "slow-roast", name: "SLOW ROAST", cat: "beans", tag: "BESTSELLER", price: 3800, model: "bag", feature: true,
    meta: "250 G · WHOLE BEAN · COPENHAGEN", notes: ["CARAMEL", "BROWN SUGAR", "ROASTED ALMOND"],
    desc: "Our house roast, taken slow and a shade past medium so the sugars caramelise without tipping into bitter. Sweet in milk, round and clean on its own.",
    options: [
      { key: "size", label: "SIZE", choices: [["250 G", 0], ["500 G", 3000], ["1 KG", 8700]] },
      { key: "grind", label: "GRIND", wrap: true, choices: [["WHOLE BEAN", 0], ["ESPRESSO", 0], ["FILTER", 0], ["FRENCH PRESS", 0]] },
      { key: "plan", label: "PURCHASE", choices: [["ONE-TIME", 0], ["EVERY 2 WK", 0, "SAVE 10%"], ["EVERY 4 WK", 0, "SAVE 10%"]] },
    ],
    details: [["ORIGIN", "COLOMBIA · ETHIOPIA"], ["PROCESS", "WASHED"], ["ROAST", "MEDIUM"], ["ROASTED IN", "COPENHAGEN"]],
    care: "Roasted weekly in small batches and packed in a valved bag. Best within four weeks of the roast date printed on the back. Keep sealed, away from light and heat.",
  },
  {
    id: "single-origin", name: "ETHIOPIA YIRGACHEFFE", cat: "beans", tag: "SINGLE ORIGIN", price: 4800, model: "bag",
    meta: "250 G · WASHED HEIRLOOM · 2100M", notes: ["JASMINE", "BERGAMOT", "WHITE PEACH"],
    desc: "Washed heirloom varieties from high-altitude smallholders in Yirgacheffe. A delicate, tea-like body with sparkling citrus acidity, jasmine florals and a sweet peach finish.",
    options: [
      { key: "size", label: "SIZE", choices: [["250 G", 0], ["500 G", 3600], ["1 KG", 10400]] },
      { key: "grind", label: "GRIND", wrap: true, choices: [["WHOLE BEAN", 0], ["FILTER", 0], ["ESPRESSO", 0], ["FRENCH PRESS", 0]] },
      { key: "plan", label: "PURCHASE", choices: [["ONE-TIME", 0], ["EVERY 2 WK", 0, "SAVE 10%"], ["EVERY 4 WK", 0, "SAVE 10%"]] },
    ],
    details: [["ORIGIN", "YIRGACHEFFE · ETHIOPIA"], ["PROCESS", "FULLY WASHED"], ["ELEVATION", "2,100 M"], ["ROAST", "LIGHT-MEDIUM"]],
    care: "Roasted weekly in small batches. Best within five weeks of roast date. Brew with 93°C water for optimal clarity.",
  },
  {
    id: "latte", name: "LATTE", cat: "drinks", price: 950, model: "cup", alt: "A brewns latte in the black-lidded brewns paper cup",
    meta: "12 OZ · BREWED DAILY · TO GO", notes: ["SMOOTH", "BALANCED"],
    desc: "A double shot of Slow Roast under steamed milk, with a heart poured on top before the lid goes on. The one most of the city starts its morning with.",
    options: [
      { key: "size", label: "SIZE", def: 1, choices: [["8 OZ", -150], ["12 OZ", 0], ["16 OZ", 200]] },
      MILK,
      { key: "temp", label: "TEMPERATURE", choices: [["HOT", 0], ["ICED", 100]] },
    ],
    details: [["ESPRESSO", "DOUBLE · SLOW ROAST"], ["MILK", "STEAMED"], ["CUP", "COMPOSTABLE"]],
    care: "Poured to order when you arrive, so it is never sitting on the counter. Lids are plant-based and the sleeve is recycled paper.",
  },
  {
    id: "espresso", name: "ESPRESSO", cat: "drinks", price: 650, model: "cup", alt: "A brewns espresso in the short black-lidded brewns paper cup",
    meta: "SINGLE SHOT · SHORT · STRONG", notes: ["DARK CHOCOLATE", "CARAMEL"],
    desc: "Short, strong and on demand. Eighteen grams in, a little under forty out, in about twenty-eight seconds.",
    options: [
      { key: "shots", label: "SHOTS", choices: [["SINGLE", 0], ["DOUBLE", 200]] },
      { key: "style", label: "STYLE", choices: [["STRAIGHT", 0], ["MACCHIATO", 100], ["CORTADO", 250]] },
    ],
    details: [["DOSE", "18 G"], ["YIELD", "38 G"], ["TIME", "28 SEC"]],
    care: "Pulled on a dialled-in grinder every morning, so the first shot of the day tastes like the last.",
  },
  {
    id: "cortado", name: "CORTADO", cat: "drinks", tag: "BARISTA PICK", price: 850, photo: "menu/menu-cortado.webp", model: "glass", alt: "A brewns cortado in a faceted glass with steamed microfoam",
    meta: "4.5 OZ · EQUAL PARTS ESPRESSO & MILK", notes: ["VELVETY", "HAZELNUT"],
    desc: "Equal parts Slow Roast espresso and warm textured milk in a heavy Gibraltar glass. Cuts the intensity while preserving the deep caramel sweetness of the beans.",
    options: [
      { key: "shots", label: "SHOTS", choices: [["DOUBLE", 0], ["TRIPLE", 200]] },
      MILK,
      { key: "temp", label: "TEMPERATURE", choices: [["WARM (57°C)", 0], ["HOT", 0]] },
    ],
    details: [["RATIO", "1:1 ESPRESSO TO MILK"], ["GLASS", "4.5 OZ GIBRALTAR"], ["ORIGIN", "SLOW ROAST BLEND"]],
    care: "Poured immediately upon arrival so the microfoam remains dense and velvety.",
  },
  {
    id: "nitro-cold-brew", name: "NITRO COLD BREW", cat: "drinks", tag: "ON TAP", price: 1100, photo: "menu/menu-cold-brew.webp", model: "glass", alt: "A nitro cold brew coffee in a chilled glass with creamy cascading head",
    meta: "STEEPED 20 HRS · NITROGEN INFUSED", notes: ["STOUT-LIKE", "CREAMY CACAO"],
    desc: "Slow steeped for twenty hours and charged with pure food-grade nitrogen on draft. Pours with a thick cascading head like a fine dry stout, naturally sweet with zero added sugar.",
    options: [
      { key: "size", label: "SIZE", choices: [["12 OZ", 0], ["16 OZ", 200]] },
      { key: "style", label: "POUR", choices: [["STRAIGHT NITRO", 0], ["VANILLA SWEET CREAM", 150]] },
    ],
    details: [["STEEP TIME", "20 HOURS COLD"], ["INFUSION", "PURE NITROGEN"], ["CALORIES", "5 KCAL (BLACK)"]],
    care: "Served cold on draft without ice to maintain the smooth cascading nitrogen head.",
  },
  {
    id: "iced-matcha", name: "ICED MATCHA", cat: "drinks", tag: "NEW", price: 1150, photo: "menu/menu-iced-coffee.webp", model: "glass", alt: "A brewns iced matcha in a clear cup with a straw",
    meta: "CEREMONIAL GRADE · OVER ICE", notes: ["GRASSY", "CREAMY"],
    desc: "Ceremonial-grade matcha whisked to order and poured over cold milk and ice, marbled on the way down.",
    options: [
      { key: "size", label: "SIZE", choices: [["12 OZ", 0], ["16 OZ", 200]] },
      MILK,
      { key: "sweet", label: "SWEETNESS", choices: [["NONE", 0], ["LIGHT", 0], ["REGULAR", 0]], def: 1 },
    ],
    details: [["MATCHA", "UJI · CEREMONIAL"], ["SERVED", "OVER ICE"], ["CAFFEINE", "≈ 70 MG"]],
    care: "Whisked by hand, never from a powder mix. Give it a stir with the straw before the first sip.",
  },
  {
    id: "iced-latte", name: "ICED LATTE", cat: "drinks", price: 1050, photo: "menu/menu-iced-latte.webp", model: "glass", alt: "A brewns iced latte in a clear cup",
    meta: "DOUBLE SHOT · COLD MILK", notes: ["BOLD", "SMOOTH"],
    desc: "Two shots over ice, topped with cold milk and left to swirl. Smooth, bold and made for the walk between blocks.",
    options: [{ key: "size", label: "SIZE", choices: [["12 OZ", 0], ["16 OZ", 200]] }, MILK, { key: "shots", label: "SHOTS", choices: [["DOUBLE", 0], ["TRIPLE", 200]] }],
    details: [["ESPRESSO", "DOUBLE · SLOW ROAST"], ["SERVED", "OVER ICE"], ["CUP", "RECYCLABLE PET"]],
    care: "Shots are pulled when you arrive and chilled over ice straight away, so it never waters down on the counter.",
  },
  {
    id: "cardamom-bun", name: "CARDAMOM BUN", cat: "bakery", tag: "NORDIC RITUAL", price: 750, photo: "menu/menu-cardamom.webp", model: "bakery", alt: "A freshly baked Swedish cardamom bun with pearl sugar",
    meta: "STONEGROUND CARDAMOM · BROWN SUGAR", notes: ["AROMATIC", "BUTTERY"],
    desc: "Traditional twisted bun enriched with fresh stoneground green cardamom, brown sugar syrup and crunchy Swedish pearl sugar. Baked fresh every morning.",
    options: [
      { key: "serve", label: "SERVE", choices: [["AS IT IS", 0], ["WARMED", 0]] },
    ],
    details: [["BAKED", "DAILY AT 06:30"], ["SPICE", "GUATEMALAN CARDAMOM"], ["WEIGHT", "135 G"]],
    care: "Baked fresh daily. Delicious straight or lightly warmed at the counter.",
  },
  {
    id: "cinnamon-roll", name: "CINNAMON ROLL", cat: "bakery", price: 700, photo: "menu/menu-cinnamon.webp", model: "bakery", alt: "A glazed cinnamon roll on a ceramic plate",
    meta: "BAKED EVERY MORNING", notes: ["BROWN BUTTER", "CARDAMOM"],
    desc: "Laminated dough rolled with brown butter, cinnamon and a little cardamom, finished with a vanilla glaze while it is still warm.",
    options: [
      { key: "warm", label: "SERVE", choices: [["AS IT IS", 0], ["WARMED", 0]] },
      { key: "glaze", label: "GLAZE", choices: [["REGULAR", 0], ["EXTRA", 100]] },
    ],
    details: [["BAKED", "DAILY FROM 06:00"], ["CONTAINS", "WHEAT · MILK · EGG"], ["WEIGHT", "140 G"]],
    care: "Baked in the morning and gone by the afternoon. Order ahead to hold one.",
  },
  {
    id: "matcha-financier", name: "MATCHA FINANCIER", cat: "bakery", tag: "GLUTEN-FREE", price: 650, photo: "menu/menu-financier.webp", model: "bakery", alt: "A golden-green matcha financier cake with dusted icing sugar",
    meta: "ALMOND FLOUR · UJI MATCHA", notes: ["NUTTY", "EARTHY SWEET"],
    desc: "Dense French almond cake infused with ceremonial Uji matcha and browned noisette butter. Crispy edges and a soft, melt-in-the-mouth center.",
    options: [
      { key: "serve", label: "SERVE", choices: [["ROOM TEMP", 0], ["WARMED", 0]] },
    ],
    details: [["ALMOND", "100% VALENCIA"], ["MATCHA", "UJI FIRST HARVEST"], ["WEIGHT", "90 G"]],
    care: "Naturally gluten-free with California almond meal.",
  },
  {
    id: "ceramic-tumbler", name: "CERAMIC TRAVEL TUMBLER", cat: "merch", tag: "ESSENTIAL", price: 6500, photo: "menu/menu-tumbler.webp", model: "cup", alt: "A matte ceramic travel tumbler with spill-resistant lid",
    meta: "12 OZ · CERAMIC LINED · DOUBLE WALL", notes: ["TRUE TASTE", "6 HR HEAT RETENTION"],
    desc: "Double-wall vacuum-insulated stainless steel tumbler with an internal ceramic coating so your coffee tastes true to the cup. Fits standard car cup holders and keeps drinks hot for 6 hours.",
    options: [
      { key: "color", label: "COLORWAY", choices: [["MATTE CHARCOAL", 0], ["RAW OAT", 0], ["AMBER CREMA", 0]] },
      { key: "lid", label: "LID TYPE", choices: [["SLIDE LOCK", 0], ["360° SIP LID", 800]] },
    ],
    details: [["CAPACITY", "12 OZ (355 ML)"], ["LINING", "PURE CERAMIC COATING"], ["INSULATION", "DOUBLE-WALL VACUUM"]],
    care: "Hand wash recommended for finish longevity. Dishwasher safe lid.",
  },
  {
    id: "gift-card", name: "GIFT CARD", cat: "gifts", price: 2500, gift: true,
    meta: "DIGITAL · NEVER EXPIRES", notes: ["ALL LOCATIONS", "SENT BY EMAIL"],
    desc: "Good coffee for someone else's day. Redeemable for anything at all three counters, with a note from you on the front.",
    options: [{ key: "amount", label: "AMOUNT", plain: true, choices: [["Rs 2,500", 0], ["Rs 5,000", 2500], ["Rs 10,000", 7500]] }],
    details: [["DELIVERY", "EMAIL · INSTANT"], ["VALID", "ALL LOCATIONS"], ["EXPIRES", "NEVER"]],
    care: "Balances carry over between visits and never expire. Lost the email? Any barista can look it up by name.",
  },
  ...KITCHEN,
];
const productById = (id) => PRODUCTS.find((p) => p.id === id);
const defaultSel = (p) => Object.fromEntries(p.options.map((o) => [o.key, o.def ?? 0]));
const isSub = (p, sel) => p.options.some((o) => o.key === "plan") && sel.plan > 0;
const basePrice = (p, sel) => p.options.reduce((sum, o) => sum + (o.choices[sel[o.key]]?.[1] || 0), p.price);
const unitPrice = (p, sel) => basePrice(p, sel) * (isSub(p, sel) ? 0.9 : 1);
const selLabel = (p, sel) => p.options.map((o) => o.choices[sel[o.key]]?.[0]).filter(Boolean).join(" · ");

/* ═══════════ the bag, kept in localStorage ═══════════ */
const cart = (() => {
  const KEY = "brewns-bag";
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem(KEY) || "[]").filter((i) => productById(i.id) && i.qty > 0);
  } catch {}
  const listeners = new Set();
  const commit = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
    listeners.forEach((f) => f());
  };
  return {
    get items() {
      return items;
    },
    subscribe: (f) => listeners.add(f),
    add(id, sel, qty = 1, message = "") {
      const key = `${id}|${JSON.stringify(sel)}|${message}`;
      const hit = items.find((i) => i.key === key);
      if (hit) hit.qty = Math.min(20, hit.qty + qty);
      else items.push({ key, id, sel, qty, message });
      commit();
    },
    setQty(key, qty) {
      const hit = items.find((i) => i.key === key);
      if (!hit) return;
      if (qty <= 0) items = items.filter((i) => i !== hit);
      else hit.qty = Math.min(20, qty);
      commit();
    },
    remove(key) {
      items = items.filter((i) => i.key !== key);
      commit();
    },
    clear() {
      items = [];
      commit();
    },
    count: () => items.reduce((n, i) => n + i.qty, 0),
    subtotal: () => items.reduce((s, i) => s + unitPrice(productById(i.id), i.sel) * i.qty, 0),
  };
})();

/* header count */
const bagCountEl = $("#bag-count");
const bagOpenBtn = $("#bag-open");
const countBump = new Spring({ scale: 1 }, styler(bagCountEl));
let lastBagCount = cart.count();
const syncBagCount = () => {
  const n = cart.count();
  bagCountEl.textContent = n;
  bagCountEl.classList.toggle("has", n > 0);
  bagOpenBtn.setAttribute("aria-label", `Open bag, ${n} item${n === 1 ? "" : "s"}`);
  if (n > lastBagCount && !REDUCED) {
    countBump.set({ scale: 1.5 });
    countBump.start({ scale: 1 }, { config: C(300, 14) });
  }
  lastBagCount = n;
};
syncBagCount();
cart.subscribe(syncBagCount);
bagOpenBtn.addEventListener("click", () => openBag());

/* ═══════════ overlay stack: scroll lock, Escape, focus ═══════════ */
const layers = [];
const hasLayer = (name) => layers.some((l) => l.name === name);
const pushLayer = (name, close, el) => {
  if (!layers.length) stopScroll();
  layers.push({ name, close, el, focus: document.activeElement });
};
const popLayer = (name) => {
  const i = layers.findIndex((l) => l.name === name);
  if (i < 0) return;
  const wasTop = i === layers.length - 1;
  const [layer] = layers.splice(i, 1);
  if (!layers.length) startScroll();
  if (wasTop && layer.focus?.isConnected) layer.focus.focus({ preventScroll: true });
};
window.addEventListener("keydown", (e) => {
  if (!layers.length) return;
  const top = layers[layers.length - 1];
  if (e.key === "Escape") {
    e.preventDefault();
    top.close();
    return;
  }
  if (e.key !== "Tab") return;
  const focusable = $$('button:not([disabled]), a[href], input, textarea, select, [tabindex="0"]', top.el).filter((x) => x.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !top.el.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
  }
});

/* ═══════════ toast ═══════════ */
const toastEl = $("#toast");
const toastSpring = new Spring({ opacity: 0, y: 24 }, (o) => {
  toastEl.style.opacity = o.opacity;
  toastEl.style.transform = `translate(-50%, ${o.y}px)`;
});
let toastTimer = 0;
const hideToast = () => {
  toastEl.classList.remove("on");
  toastSpring.start({ opacity: 0, y: 24 }, { config: C(260, 30), immediate: REDUCED });
};
const toast = (message, action, onAction) => {
  toastEl.innerHTML = `<span></span>${action ? '<button type="button"></button>' : ""}`;
  toastEl.firstChild.textContent = message;
  if (action) {
    const b = $("button", toastEl);
    b.textContent = action;
    b.onclick = () => {
      hideToast();
      onAction();
    };
  }
  toastEl.classList.add("on");
  toastSpring.start({ opacity: 1, y: 0 }, { config: C(260, 26), immediate: REDUCED });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 3400);
};

/* ═══════════ product imagery ═══════════ */
const giftcardHTML = (amount, big = false) =>
  `<span class="giftcard${big ? " big" : ""}" aria-hidden="true"><span class="gc-swirl swirl-mask mask"></span><span class="gc-mark wordmark mask"></span><span class="gc-label mono-fine">GIFT CARD</span><span class="gc-amount">${amount}</span></span>`;
const thumbHTML = (p) =>
  p.gift
    ? `<span class="thumb dark">${giftcardHTML("")}</span>`
    : p.photo
      ? `<span class="thumb${p.art ? " shot" : ""}"><img src="${photoSrc(p.photo)}" alt="" loading="lazy"></span>`
      : `<span class="thumb dark"><img data-snap="${p.model}" data-snap-product="${p.id}" alt=""></span>`;
/* Model-only products have no photograph: their pictures are rendered from the
   same .glb once three.js is up (asynchronously, so every part of the module exists). */
const fillSnaps = (rootEl) =>
  $$("img[data-snap]", rootEl).forEach((img) => {
    const { snap: kind, snapProduct } = img.dataset;
    img.removeAttribute("data-snap");
    threeReady
      .then(() => getSnapshot(kind, snapProduct))
      .then((url) => {
        img.src = url;
        img.parentElement.querySelector(".pcard-loading")?.remove();
      })
      .catch((error) => console.error("snapshot", error));
  });

/* ═══════════ the grid ═══════════ */
const shopGrid = $("#shop-grid");
const shopTabs = $("#shop-tabs");
const tabInd = $("#shop-tab-ind");
const shopCountEl = $("#shop-count");
let shopFilter = "all";

shopGrid.innerHTML = PRODUCTS.map((p, i) => {
  const media = p.gift
    ? giftcardHTML(money(p.price))
    : p.photo
      ? `<span class="pcard-photo" aria-hidden="true"></span><img${p.art ? ' class="shot"' : ""} src="${photoSrc(p.photo)}" alt="${esc(p.alt)}" loading="lazy">`
      : `<img data-snap="${p.model}" data-snap-product="${p.id}" alt="${esc(p.alt || `A bag of brewns ${p.name.toLowerCase()} coffee beans`)}"><span class="pcard-loading" aria-hidden="true"></span>`;
  return `<li class="${p.feature ? "feature" : p.id === "cinnamon-roll" || p.id === "ceramic-tumbler" || p.gift ? "wide" : ""}" data-cat="${p.cat}"><div class="lean"><div>
    <article class="pcard" tabindex="0" role="link" aria-label="${esc(p.name)}, ${money(p.price)}" data-product="${p.id}">
      <div class="pcard-top mono-fine"><span>${String(i + 1).padStart(2, "0")}</span>${p.tag ? `<span class="pcard-tag chip"><span class="dot"></span>${p.tag}</span>` : `<span>${CAT_LABEL[p.cat]}</span>`}</div>
      <div class="pcard-media">${media}<span class="pcard-view mono-fine${p.photo ? "" : " on-dark"}" aria-hidden="true">VIEW PRODUCT <span style="display:inline-block;width:.6rem;transform:rotate(-45deg)">${ARROW_SVG}</span></span></div>
      <div class="pcard-foot">
        <div><p class="pcard-name">${p.name}</p><p class="pcard-meta mono-fine">${p.meta}</p></div>
        <div class="pcard-buy"><p class="pcard-price">${p.options.some((o) => o.choices.some((c) => c[1] > 0)) ? '<span class="mono-fine" style="opacity:.5">FROM </span>' : ""}${money(p.price)}</p><button type="button" class="pcard-add" data-add="${p.id}" aria-label="Add ${esc(p.name)} to bag">+ ADD</button></div>
      </div>
    </article></div></div></li>`;
}).join("");
shopCountEl.textContent = String(PRODUCTS.length).padStart(2, "0");
fillSnaps(shopGrid);
fillSnaps($("#cards")); // the menu cards were built before fillSnaps existed
$$(".lean", shopGrid).forEach((outer) => lean(outer.firstElementChild, outer, 6));
$$(".pcard", shopGrid).forEach((card, i) => inview(card, { opacity: 0, y: 28 }, { opacity: 1, y: 0 }, { config: C(80, 26), delay: (i % 4) * 90 }));

shopTabs.insertAdjacentHTML(
  "afterbegin",
  Object.entries(CAT_LABEL)
    .map(([key, label]) => {
      const n = key === "all" ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === key).length;
      return `<button type="button" class="shop-tab" role="tab" aria-selected="${key === "all"}" data-cat="${key}">${label}<sup>${String(n).padStart(2, "0")}</sup></button>`;
    })
    .join(""),
);
const tabSpring = new Spring({ x: 0, w: 0 }, (o) => (tabInd.style.transform = `translateX(${o.x}px) scaleX(${o.w})`));
const placeTabInd = (immediate) => {
  const b = $(`.shop-tab[data-cat="${shopFilter}"]`, shopTabs);
  const to = { x: b.offsetLeft, w: b.offsetWidth };
  immediate || REDUCED ? tabSpring.set(to) : tabSpring.start(to, { config: C(260, 30) });
};
document.fonts.ready.then(() => placeTabInd(true));
window.addEventListener("resize", () => placeTabInd(true));

const itemSprings = new WeakMap();
const setFilter = (cat) => { playSoftClick();
  shopFilter = cat;
  $$(".shop-tab", shopTabs).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cat === cat)));
  placeTabInd(false);
  let shown = 0;
  $$("#shop-grid > li").forEach((li) => {
    const match = cat === "all" || li.dataset.cat === cat;
    li.hidden = !match;
    if (!match || REDUCED) return;
    let s = itemSprings.get(li);
    if (!s) itemSprings.set(li, (s = new Spring({ opacity: 1, y: 0 }, styler(li))));
    s.set({ opacity: 0, y: 22 });
    s.start({ opacity: 1, y: 0 }, { config: C(140, 24), delay: shown * 55 });
    shown++;
  });
  shopCountEl.textContent = String($$("#shop-grid > li:not([hidden])").length).padStart(2, "0");
};
shopTabs.addEventListener("click", (e) => {
  const b = e.target.closest(".shop-tab");
  if (b) setFilter(b.dataset.cat);
});

const quickAdd = (id, btn) => { if (btn) flyLiquidDrop(btn); else playPourDrop();
  const p = productById(id);
  cart.add(id, defaultSel(p));
  toast(`ADDED — ${p.name}`, "VIEW BAG", () => openBag());
  if (!btn) return;
  btn.classList.add("done");
  btn.textContent = "✓ ADDED";
  clearTimeout(btn._reset);
  btn._reset = setTimeout(() => {
    btn.classList.remove("done");
    btn.textContent = "+ ADD";
  }, 1400);
};
shopGrid.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) return quickAdd(add.dataset.add, add);
  const card = e.target.closest(".pcard");
  if (card) openProduct(card.dataset.product);
});
shopGrid.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("pcard")) {
    e.preventDefault();
    openProduct(e.target.dataset.product);
  }
});

/* ═══════════ Menu Section Category & Carousel Controls ═══════════ */
let menuCat = "all";
let menuPage = 0;
const menuCardsTrack = $("#cards");
const menuTabsEl = $("#menu-tabs");
const menuPrevBtn = $("#menu-prev");
const menuNextBtn = $("#menu-next");
const menuPageEl = $("#menu-page");

const wireMenuCardEvents = () => {
  $$("#cards .card").forEach((card) => {
    card.style.cursor = "pointer";
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    const id = card.dataset.menuId;
    const p = id ? productById(id) : null;
    if (p) card.setAttribute("aria-label", `View ${p.name}`);
    card.onclick = (e) => {
      if ((e.target as HTMLElement).closest(".card-quick-add")) return;
      if (id) openProduct(id);
    };
    card.onkeydown = (e) => {
      if (e.key === "Enter" && !(e.target as HTMLElement).closest(".card-quick-add")) {
        e.preventDefault();
        if (id) openProduct(id);
      }
    };
  });
  $$("#cards .card-quick-add").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.cardAdd;
      if (id) quickAdd(id, btn);
    };
  });
  $$(".lean", menuCardsTrack).forEach((outer) => lean(outer.firstElementChild, outer));
};

const updateMenuDisplay = (immediate = false) => {
  const filtered = menuCat === "all" ? ALL_MENU_CARDS : ALL_MENU_CARDS.filter((c) => c.cat === menuCat);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 4));
  if (menuPage >= totalPages) menuPage = totalPages - 1;
  if (menuPage < 0) menuPage = 0;

  const slice = filtered.slice(menuPage * 4, menuPage * 4 + 4);
  menuCardsTrack.innerHTML = slice.map((c, idx) => cardHTML(c, idx)).join("");
  fillSnaps(menuCardsTrack);
  wireMenuCardEvents();
  // Freshly drawn cards never pass through the page's in-view reveal, so their
  // names would stay clipped; reveal them here.
  $$("[data-iv]", menuCardsTrack).forEach((el, i) => {
    const [from, to] = PRESET[el.dataset.iv](el);
    const reveal = new Spring(from, styler(el));
    if (immediate || REDUCED) reveal.set(to);
    else reveal.start(to, { config: { duration: 700, easing: easeOutCubic }, delay: 120 + i * 45 });
  });

  if (menuPageEl) menuPageEl.textContent = `${String(menuPage + 1).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`;
  if (menuPrevBtn) (menuPrevBtn as HTMLButtonElement).disabled = menuPage === 0;
  if (menuNextBtn) (menuNextBtn as HTMLButtonElement).disabled = menuPage >= totalPages - 1;

  if (!immediate && !REDUCED) {
    $$("#cards .card").forEach((card, i) => {
      const s = new Spring({ opacity: 0, y: 18 }, styler(card));
      s.start({ opacity: 1, y: 0 }, { config: C(120, 24), delay: i * 45 });
    });
  }
};

wireMenuCardEvents();

if (menuTabsEl) {
  menuTabsEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".menu-tab") as HTMLButtonElement;
    if (!btn) return;
    playSoftClick();
    menuCat = btn.dataset.cat || "all";
    menuPage = 0;
    $$(".menu-tab", menuTabsEl).forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    updateMenuDisplay();
  });
}

if (menuPrevBtn) {
  menuPrevBtn.addEventListener("click", () => {
    if (menuPage > 0) {
      playSoftClick();
      menuPage--;
      updateMenuDisplay();
    }
  });
}

if (menuNextBtn) {
  menuNextBtn.addEventListener("click", () => {
    const filtered = menuCat === "all" ? ALL_MENU_CARDS : ALL_MENU_CARDS.filter((c) => c.cat === menuCat);
    const totalPages = Math.ceil(filtered.length / 4);
    if (menuPage < totalPages - 1) {
      playSoftClick();
      menuPage++;
      updateMenuDisplay();
    }
  });
}

$("#menu-cta").addEventListener("click", (e) => {
  e.preventDefault();
  setFilter("all");
  openFullMenu();
});

/* hero quick-add button adds slow roast to bag with liquid droplet */
const heroQuickAddBtn = $("#hero-quick-add");
if (heroQuickAddBtn) {
  heroQuickAddBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    quickAdd("slow-roast", heroQuickAddBtn);
  });
}

/* smooth anchor scroll with lenis for header and site navigation */
$$('a[href^="#"]').forEach((a) => {
  if (a.hasAttribute("data-order-now") || a.id === "menu-cta" || a.classList.contains("w-order-cta")) return;
  a.addEventListener("click", (e) => {
    const hash = a.getAttribute("href");
    if (!hash || hash === "#") return;
    if (hash === "#shop") setFilter("all");
    const target = $(hash);
    if (!target) return;
    e.preventDefault();
    history.pushState(null, "", hash);
    lenis.scrollTo(target, { immediate: false, duration: 1.2 });
  });
});

/* every "order" affordance on the page opens the order flow */
const openOrder = () => (cart.count() ? openCheckout() : openBag());
const orderTargets = [...$$("[data-order-now]"), ...$$('a[data-cta="order right now"]')];
const receiptOrder = $$("#stage .receipt-body span").find((s) => s.textContent.trim().startsWith("ORDER NOW"));
if (receiptOrder) {
  receiptOrder.setAttribute("role", "button");
  receiptOrder.tabIndex = 0;
  receiptOrder.style.cursor = "pointer";
  receiptOrder.addEventListener("keydown", (e) => e.key === "Enter" && openOrder());
  orderTargets.push(receiptOrder);
}
orderTargets.forEach((el) =>
  el.addEventListener("click", (e) => {
    e.preventDefault();
    openOrder();
  }),
);

/* #shop/<id> deep links and the back button */
const routeFromHash = () => {
  const m = location.hash.match(/^#shop\/([\w-]+)$/);
  if (m && productById(m[1])) {
    if (currentProductId() !== m[1]) openProduct(m[1], { push: false });
  } else if (currentProductId()) closeProduct({ fromPop: true });
};
window.addEventListener("popstate", routeFromHash);
// A product link opened fresh: route once the rest of the engine is set up.
queueMicrotask(routeFromHash);

/* ═══════════ Taste Calibrator & Receipt Tear Gesture ═══════════ */
const calibrator = new TasteCalibrator(
  (productId) => {
    quickAdd(productId);
  },
  (productId) => {
    openProduct(productId);
  }
);
$("#open-calibrator")?.addEventListener("click", () => calibrator.open());

const initReceiptTear = () => {
  // The whole slip is the handle: tap it, or pull it down. The slot window clips
  // the old strip at its foot, so the hint sits above the printer instead.
  const paperEl = $("#paper");
  const handle = paperEl;
  const hint = $("#tear-hint");
  if (!paperEl) return;

  let startY = 0;
  let isDragging = false;
  let isTorn = false;

  handle.addEventListener("pointerdown", (e) => {
    if (isTorn || e.target.closest('[role="button"]')) return;
    isDragging = true;
    startY = e.clientY;
    try { handle.setPointerCapture(e.pointerId); } catch {}
  });

  const tear = () => {
    isTorn = true;
    isDragging = false;
    playPaperTear();
    paperEl.style.transform = "";
    paperEl.classList.add("torn-state");
    if (hint) hint.textContent = "✓ COLLECTED. PRINTING THE NEXT ONE";
    // Once it has fallen away, the printer runs off a fresh slip.
    setTimeout(() => {
      orderPrinter.reprint();
      paperEl.classList.remove("torn-state");
      setTimeout(() => {
        isTorn = false;
        if (hint) hint.textContent = "TAP OR PULL THE RECEIPT TO TEAR IT OFF";
      }, 1800);
    }, 900);
  };

  handle.addEventListener("pointermove", (e) => {
    if (!isDragging || isTorn) return;
    const dy = Math.max(0, e.clientY - startY);
    paperEl.style.transform = `translate3d(0, ${dy * 0.5}px, 0)`;
    if (dy > 65) tear();
  });

  const onEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch {}
    // A tap without a drag tears too.
    if (!isTorn && Math.abs(e.clientY - startY) < 6 && e.type === "pointerup") return tear();
    if (!isTorn) paperEl.style.transform = "";
  };
  handle.addEventListener("pointerup", onEnd);
  handle.addEventListener("pointercancel", onEnd);
};
setTimeout(initReceiptTear, 1000);

whenReady(() => setTimeout(routeFromHash, 300));

/* ═══════════ product page ═══════════ */
const pdpEl = $("#pdp");
let pdpState = null;
const currentProductId = () => pdpState?.p.id ?? null;
const pdpClip = new Spring({ clipPath: "inset(100% 0% 0% 0%)" }, styler(pdpEl));
const pdpPrice = new Spring({ v: 0 }, (o) => {
  const el = $("#pdp-price", pdpEl);
  if (el) el.textContent = money(o.v);
});

function openProduct(id, { push = true, replace = false } = {}) {
  const p = productById(id);
  if (!p) return;
  const already = !!pdpState;
  if (already) teardownMedia();
  if (hasLayer("bag")) closeBag();
  pdpState = { p, sel: defaultSel(p), qty: 1, message: "", view: p.gift ? "card" : p.photo ? "photo" : "3d", viewer: null, cleanups: [] };
  renderProduct();
  if (replace) history.replaceState({ pdp: id }, "", `#shop/${id}`);
  else if (push) history.pushState({ pdp: id }, "", `#shop/${id}`);
  if (!already) {
    pdpEl.hidden = false;
    pushLayer("pdp", () => closeProduct(), pdpEl);
    if (REDUCED) pdpClip.set({ clipPath: "inset(0% 0% 0% 0%)" });
    else {
      pdpClip.set({ clipPath: "inset(100% 0% 0% 0%)" });
      pdpClip.start({ clipPath: "inset(0% 0% 0% 0%)" }, { config: { duration: 760, easing: easeOutQuart } });
    }
  }
  pdpEl.scrollTop = 0;
  $(".pdp-info", pdpEl).scrollTop = 0;
  staggerIn($$(".pdp-info > *", pdpEl), already ? 40 : 300);
  $(".pdp-close", pdpEl).focus({ preventScroll: true });
}

function closeProduct({ fromPop = false } = {}) {
  if (!pdpState) return;
  if (!fromPop && history.state?.pdp) return history.back(); // popstate comes back here
  if (!fromPop && location.hash.startsWith("#shop/")) history.replaceState(null, "", "#shop");
  teardownMedia();
  pdpState = null;
  popLayer("pdp");
  const finish = () => {
    if (pdpState) return;
    pdpEl.hidden = true;
    pdpEl.innerHTML = "";
  };
  if (REDUCED) finish();
  else pdpClip.start({ clipPath: "inset(0% 0% 100% 0%)" }, { config: { duration: 620, easing: easeOutQuart } }).then(finish);
}

function teardownMedia() {
  if (!pdpState) return;
  pdpState.viewer?.destroy();
  pdpState.viewer = null;
  pdpState.cleanups.forEach((f) => f());
  pdpState.cleanups = [];
}

const staggerIn = (els, delay) =>
  els.forEach((el, i) => {
    const s = new Spring({ opacity: 0, y: 24 }, styler(el));
    if (REDUCED) s.set({ opacity: 1, y: 0 });
    else s.start({ opacity: 1, y: 0 }, { config: C(120, 24), delay: delay + i * 55 });
  });

const giftAmount = () => (pdpState.p.gift ? pdpState.p.options[0].choices[pdpState.sel.amount][0] : "");

function renderProduct() {
  const { p, view } = pdpState;
  const index = PRODUCTS.indexOf(p) + 1;
  const views = [p.photo && ["photo", "PHOTO"], p.model && ["3d", "3D VIEW"], p.gift && ["card", "CARD"]].filter(Boolean);
  const related = [...PRODUCTS.filter((q) => q !== p && q.cat === p.cat), ...PRODUCTS.filter((q) => q !== p && q.cat !== p.cat)].slice(0, 3);
  const options = p.options
    .map(
      (o) => `<div class="opt" data-opt="${o.key}">
        <div class="opt-head mono-fine"><span>${o.label}</span><b data-opt-val></b></div>
        <div class="seg${o.wrap ? " wrap" : ""}" role="radiogroup" aria-label="${o.label}">${o.choices
          .map(([label, delta, note], i) => {
            const small = o.plain ? "" : note || (delta > 0 ? `+${money(delta)}` : delta < 0 ? `−${money(-delta)}` : "");
            return `<button type="button" role="radio" aria-checked="false" data-choice="${i}">${label}${small ? `<small>${small}</small>` : ""}</button>`;
          })
          .join("")}</div>
      </div>`,
    )
    .join("");

  pdpEl.innerHTML = `
    <button type="button" class="x-btn pdp-close" aria-label="Close product"></button>
    <div class="pdp-media${view === "photo" ? " light" : ""}">
      <span class="pdp-swirl swirl-mask mask" aria-hidden="true"></span>
      <nav class="pdp-crumb mono-fine" aria-label="Breadcrumb"><button type="button" data-crumb="all">SHOP</button><span aria-hidden="true">/</span><button type="button" data-crumb="${p.cat}">${CAT_LABEL[p.cat]}</button></nav>
      <div class="pdp-stage" id="pdp-stage"></div>
      ${views.length > 1 ? `<div class="pdp-views mono-fine">${views.map(([key, label]) => `<button type="button" class="pdp-view" data-view="${key}" aria-pressed="${key === view}"><span>${label}</span></button>`).join("")}</div>` : ""}
      <p class="pdp-hint mono-fine" id="pdp-hint" aria-hidden="true"></p>
    </div>
    <div class="pdp-info">
      <div>
        <div class="pdp-kicker mono-fine"><span>${String(index).padStart(2, "0")} / ${String(PRODUCTS.length).padStart(2, "0")} · ${CAT_LABEL[p.cat]}</span>${p.tag ? `<span class="chip"><span class="dot"></span>${p.tag}</span>` : ""}</div>
        <h2 class="pdp-name" id="pdp-name">${p.name}</h2>
        <div class="pdp-priceline"><span class="pdp-price" id="pdp-price" aria-live="polite"></span><span class="pdp-was" id="pdp-was"></span><span class="mono-fine" style="color:rgb(255 255 255/.5)">${p.meta}</span></div>
      </div>
      <p class="pdp-desc">${p.desc}</p>
      <div class="pdp-notes">${p.notes.map((n) => `<span class="chip">${n}</span>`).join("")}</div>
      ${options}
      ${p.gift ? `<label class="opt"><span class="opt-head mono-fine"><span>MESSAGE ON THE CARD · OPTIONAL</span></span><textarea class="pdp-msg" maxlength="120" placeholder="Happy Monday. The first one is on me." data-msg></textarea></label>` : ""}
      <div class="pdp-actions">
        <div class="pdp-total mono-fine"><span>TOTAL</span><b id="pdp-total"></b></div>
        <div class="qty" role="group" aria-label="Quantity"><button type="button" data-q="-1" aria-label="Decrease quantity">−</button><output id="pdp-qty" aria-live="polite">1</output><button type="button" data-q="1" aria-label="Increase quantity">+</button></div>
        <button type="button" class="btn btn-line" id="pdp-add"><span>ADD TO BAG</span><span aria-hidden="true">+</span></button>
        <button type="button" class="btn btn-solid" id="pdp-now">ORDER NOW ${ARROW_SVG}</button>
      </div>
      <div>
        <details class="acc" open><summary>DETAILS<i aria-hidden="true">+</i></summary><ul>${p.details.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join("")}</ul></details>
        <details class="acc"><summary>${p.cat === "beans" ? "FRESHNESS &amp; STORAGE" : "HOW WE MAKE IT"}<i aria-hidden="true">+</i></summary><p>${p.care}</p></details>
        <details class="acc"><summary>PICKUP<i aria-hidden="true">+</i></summary><p>${PICKUP_COPY}</p></details>
      </div>
      <div class="pdp-related"><h3 class="mono-fine">YOU MAY ALSO LIKE</h3><ul>${related
        .map((q) => `<li><button type="button" data-related="${q.id}">${thumbHTML(q)}<span class="rel-name">${q.name}</span><span class="mono-fine" style="color:rgb(255 255 255/.5)">${money(q.price)}</span></button></li>`)
        .join("")}</ul></div>
      <div class="pdp-foot-pad"></div>
    </div>`;
  fillSnaps(pdpEl);
  syncOptions();
  updatePrice(true);
  mountMedia();
}

function syncOptions() {
  const { p, sel } = pdpState;
  p.options.forEach((o) => {
    const group = $(`[data-opt="${o.key}"]`, pdpEl);
    $$("[data-choice]", group).forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.choice === sel[o.key])));
    $("[data-opt-val]", group).textContent = o.choices[sel[o.key]][0];
  });
  const amount = $(".pdp-stage .gc-amount", pdpEl);
  if (amount) amount.textContent = giftAmount();
}

function updatePrice(immediate = false) {
  const { p, sel, qty } = pdpState;
  const unitNow = unitPrice(p, sel);
  if (immediate || REDUCED) pdpPrice.set({ v: unitNow });
  else pdpPrice.start({ v: unitNow }, { config: { duration: 420, easing: easeOutCubic } });
  $("#pdp-was", pdpEl).textContent = isSub(p, sel) ? money(basePrice(p, sel)) : "";
  $("#pdp-total", pdpEl).textContent = `${qty} × ${money(unitNow)} = ${money(unitNow * qty)}`;
  $("#pdp-qty", pdpEl).textContent = qty;
}

function mountMedia() {
  const { p, view } = pdpState;
  const stage = $("#pdp-stage", pdpEl);
  const media = stage.parentElement;
  const hint = $("#pdp-hint", pdpEl);
  stage.innerHTML = "";
  const isLightProduct = p.cat === "drinks" || p.cat === "bakery" || p.cat === "merch";
  media.classList.toggle("light", isLightProduct || view === "photo");
  $$("[data-view]", pdpEl).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));

  if (view === "3d") {
    hint.textContent = noHover() ? "DRAG TO ROTATE · PINCH TO ZOOM" : "DRAG TO ROTATE · SCROLL TO ZOOM";
    pdpState.viewer = mountViewer(stage, p.model, pdpState.sel, p);
    return;
  }


  hint.textContent = view === "card" ? "MOVE TO TILT" : noHover() ? "TAP TO ZOOM" : "CLICK TO ZOOM";
  const wrap = document.createElement("div");
  wrap.className = `pdp-photo-wrap${pdpState.sel.warm === 1 ? " warmed-state" : ""}${pdpState.sel.glaze === 1 ? " extra-glaze-state" : ""}`;
  wrap.innerHTML = view === "card" ? giftcardHTML(giftAmount(), true) : `<img class="pdp-photo${p.art ? " shot" : ""}" src="${photoSrc(p.photo)}" alt="${esc(p.alt)}">`;
  stage.append(wrap);
  const subject = wrap.firstElementChild;

  const enter = new Spring({ o: 0, y: 40 }, (o) => {
    subject.style.opacity = o.o;
    subject.style.translate = `0 ${o.y}px`;
  });
  REDUCED ? enter.set({ o: 1, y: 0 }) : enter.start({ o: 1, y: 0 }, { config: C(90, 20), delay: 180 });

  const tilt = new Spring({ rx: 0, ry: 0 }, (o) => (wrap.style.transform = `rotateX(${o.rx}deg) rotateY(${o.ry}deg)`));
  const origin = (e) => {
    const b = media.getBoundingClientRect();
    subject.style.setProperty("--zx", `${((e.clientX - b.left) / b.width) * 100}%`);
    subject.style.setProperty("--zy", `${((e.clientY - b.top) / b.height) * 100}%`);
  };
  const move = (e) => {
    if (subject.classList.contains("zoomed")) return origin(e);
    if (REDUCED || e.pointerType === "touch") return;
    const b = media.getBoundingClientRect();
    const dx = clampUnit(((e.clientX - b.left) / b.width) * 2 - 1);
    const dy = clampUnit(((e.clientY - b.top) / b.height) * 2 - 1);
    const strength = view === "card" ? 16 : 9;
    tilt.start({ rx: -dy * strength, ry: dx * strength }, { config: C(90, 22) });
  };
  const leave = () => {
    tilt.start({ rx: 0, ry: 0 }, { config: C(90, 22) });
    subject.classList.remove("zoomed");
  };
  const zoom = (e) => {
    if (view !== "photo") return;
    origin(e);
    tilt.start({ rx: 0, ry: 0 }, { config: C(160, 26) });
    subject.classList.toggle("zoomed");
  };
  media.addEventListener("pointermove", move);
  media.addEventListener("pointerleave", leave);
  subject.addEventListener("click", zoom);
  pdpState.cleanups.push(() => {
    media.removeEventListener("pointermove", move);
    media.removeEventListener("pointerleave", leave);
    tilt.stop();
    enter.stop();
  });
}

const flashButton = (btn, text) => {
  const label = btn.firstElementChild;
  const original = label.textContent;
  label.textContent = text;
  clearTimeout(btn._reset);
  btn._reset = setTimeout(() => (label.textContent = original), 1400);
};

pdpEl.addEventListener("click", (e) => {
  if (!pdpState) return;
  const t = e.target;
  if (t.closest(".pdp-close")) return closeProduct();

  const choice = t.closest("[data-choice]");
  if (choice) {
    pdpState.sel[choice.closest("[data-opt]").dataset.opt] = +choice.dataset.choice;
    syncOptions();
    pdpState.viewer?.updateVariant(pdpState.sel);
    playSoftClick();

    // If on photo view, update photo wrap classes for visual feedback
    const photoWrap = $(".pdp-photo-wrap", pdpEl);
    if (photoWrap) {
      photoWrap.classList.toggle("warmed-state", pdpState.sel.warm === 1);
      photoWrap.classList.toggle("extra-glaze-state", pdpState.sel.glaze === 1);
    }
    return updatePrice();
  }

  const q = t.closest("[data-q]");
  if (q) {
    pdpState.qty = Math.max(1, Math.min(20, pdpState.qty + +q.dataset.q));
    return updatePrice(true);
  }
  const view = t.closest("[data-view]");
  if (view && view.dataset.view !== pdpState.view) {
    teardownMedia();
    pdpState.view = view.dataset.view;
    return mountMedia();
  }
  const { p, sel, qty, message } = pdpState;
  if (t.closest("#pdp-add")) {
    cart.add(p.id, { ...sel }, qty, p.gift ? message.trim() : "");
    flashButton(t.closest("#pdp-add"), "ADDED ✓");
    return toast(`ADDED — ${p.name} ×${qty}`, "VIEW BAG", () => {
      closeProduct();
      openBag();
    });
  }
  if (t.closest("#pdp-now")) {
    cart.add(p.id, { ...sel }, qty, p.gift ? message.trim() : "");
    closeProduct();
    return openCheckout();
  }
  const crumb = t.closest("[data-crumb]");
  if (crumb) {
    closeProduct();
    setFilter(crumb.dataset.crumb);
    return setTimeout(() => lenis.scrollTo("#shop", { force: true, immediate: true }), 60);
  }
  const rel = t.closest("[data-related]");
  if (rel) openProduct(rel.dataset.related, { replace: true });
});
pdpEl.addEventListener("input", (e) => {
  if (pdpState && e.target.matches("[data-msg]")) pdpState.message = e.target.value;
});

/* ═══════════ product viewer: one shared model, snapshots and a turntable ═══════════ */
// Cached by URL, so the two iced drinks share one fetch of the cup.
const shopModels = {};
const loadShopModel = (productId) => {
  const url = SHOP_MODEL_URL[productId];
  if (!url) return null;
  return (shopModels[url] ||= threeReady.then(
    (T) =>
      new Promise((resolve, reject) => {
        const draco = new T.DRACOLoader().setDecoderPath(DRACO_PATH);
        new T.GLTFLoader().setDRACOLoader(draco).load(url, resolve, undefined, (error) => {
          banner(`Model failed to load: ${url}`);
          reject(error);
        });
      }),
  ));
};

let productAssets = null;
const loadProductAssets = () =>
  (productAssets ||= threeReady.then(
    (T) =>
      new Promise((resolve, reject) => {
        const draco = new T.DRACOLoader().setDecoderPath(DRACO_PATH);
        new T.GLTFLoader().setDRACOLoader(draco).load(MODEL_URL, (gltf) => resolve({ T, gltf }), undefined, (error) => {
          banner(`Product model failed to load: ${MODEL_URL}`);
          reject(error);
        });
      }),
  ));

const makeStudio = (T, renderer) => {
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new T.RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = 0.6;
  const amb = new T.AmbientLight(0xffffff, 0.85);
  scene.add(amb);
  for (const [position, intensity] of [[[-4.2, 3, 3.4], 3.2], [[3.9, 2.5, 2.3], 1.4], [[0.6, 3, -3.2], 1.1]]) {
    const light = new T.DirectionalLight(0xfcfff9, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  return { scene, env };
};

const setupRenderer = (T, renderer) => {
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.16;
};


/* Distance at which a unit-tall piece fills `fill` of the frame's shorter side. */
const fitDistance = (camera, fill) => {
  const vertical = (camera.fov * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const span = Math.min(vertical, horizontal);
  return 0.5 / fill / Math.tan(span / 2);
};

const snapCache = {};
function getSnapshot(kind, productId) {
  return (snapCache[`${kind}:${productId}`] ||= loadProductAssets().then(async ({ T, gltf }) => {
    const canvas = document.createElement("canvas");
    const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    setupRenderer(T, renderer);
    renderer.setSize(720, 720, false);
    const { scene, env } = makeStudio(T, renderer);
    const piece = extractPackagingPiece(T, gltf, kind);
    piece.rotation.y = PACKAGING_POSE[kind];
    const dress = dressPackaging(T, piece, productId);
    await dress.ready;
    scene.add(piece);
    const camera = new T.PerspectiveCamera(18, 1, 0.1, 100);
    const distance = fitDistance(camera, 0.86);
    camera.position.set(0, distance * 0.12, distance);
    camera.lookAt(0, 0, 0);
    camera.near = distance / 20;
    camera.far = distance * 4;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const url = canvas.toDataURL("image/png");
    dress.dispose();
    env.texture.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return url;
  }));
}

function mountViewer(container, kind, initialSel = {}, product = null) {
  const spinner = document.createElement("span");
  spinner.className = "pcard-loading";
  container.append(spinner);
  let destroyed = false;
  let viewerInstance = null;
  Promise.all([loadProductAssets(), loadShopModel(product?.id)])
    .then(([{ T, gltf }, shopModel]) => {
      if (destroyed) return;
      spinner.remove();
      viewerInstance = runViewer(T, gltf, container, kind, initialSel, product, shopModel);
    })
    .catch((error) => {
      console.error("viewer", error);
      spinner.remove();
      container.insertAdjacentHTML("beforeend", '<p class="mono-fine">3D VIEW UNAVAILABLE</p>');
    });
  return {
    destroy() {
      destroyed = true;
      viewerInstance?.destroy();
      container.innerHTML = "";
    },
    updateVariant(sel) {
      viewerInstance?.updateVariant(sel);
    },
  };
}

function runViewer(T, gltf, container, kind, initialSel = {}, product = null, shopModel = null) {
  const canvas = document.createElement("canvas");
  canvas.className = "pdp-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Interactive 3D view of the ${product?.name || kind}. Use the arrow keys to turn it and plus or minus to zoom.`);
  container.append(canvas);
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    canvas.remove();
    return { destroy: () => {}, updateVariant: () => {} };
  }
  setupRenderer(T, renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const { scene, env } = makeStudio(T, renderer);

  const turn = new T.Group();
  let variantEngine = null;
  let piece = null;
  variantEngine = createProduct3DModel(T, gltf, product, initialSel, kind, shopModel);
  piece = variantEngine.group;

  turn.add(piece);
  scene.add(turn);
  const camera = new T.PerspectiveCamera(22, 1, 0.1, 100);

  const isBakery = product?.cat === 'bakery' || kind === 'bakery';
  const isCupWithArt = product?.id === 'cortado';
  const initPitch = isBakery ? 0.45 : isCupWithArt ? 0.28 : 0.06;
  const view = { yaw: 0, pitch: initPitch, targetPitch: initPitch, spin: 0, idle: 0, zoom: 1, targetZoom: 1, intro: REDUCED ? 1 : 0, dragging: false, lastX: 0, lastY: 0 };
  let distance = 4;
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    distance = fitDistance(camera, 0.7);
    camera.near = distance / 30;
    camera.far = distance * 6;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const clampZoom = (z) => Math.max(0.5, Math.min(1.7, z));
  const pointers = new Map();
  let pinch = 0;
  const pinchDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
  };
  const down = (e) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    pointers.set(e.pointerId, e);
    view.dragging = true;
    view.lastX = e.clientX;
    view.lastY = e.clientY;
    view.spin = 0;
    view.idle = 0;
    if (pointers.size === 2) pinch = pinchDistance();
  };
  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      const d = pinchDistance();
      view.targetZoom = clampZoom(view.targetZoom * (pinch / d));
      pinch = d;
      return;
    }
    const dx = e.clientX - view.lastX, dy = e.clientY - view.lastY;
    view.lastX = e.clientX;
    view.lastY = e.clientY;
    view.yaw += dx * 0.01;
    view.spin = dx * 0.01;
    view.targetPitch = Math.max(-0.45, Math.min(0.6, view.targetPitch + dy * 0.006));
    view.idle = 0;
  };
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (!pointers.size) view.dragging = false;
  };
  const wheel = (e) => {
    e.preventDefault();
    view.targetZoom = clampZoom(view.targetZoom * (1 + e.deltaY * 0.0012));
    view.idle = 0;
  };
  const reset = () => {
    view.targetZoom = 1;
    view.targetPitch = initPitch;
    view.spin = 0.15;
  };
  const key = (e) => {
    const map = { ArrowLeft: () => (view.spin = -0.08), ArrowRight: () => (view.spin = 0.08), ArrowUp: () => (view.targetPitch = Math.max(-0.45, view.targetPitch - 0.15)), ArrowDown: () => (view.targetPitch = Math.min(0.6, view.targetPitch + 0.15)), "+": () => (view.targetZoom = clampZoom(view.targetZoom * 0.85)), "=": () => (view.targetZoom = clampZoom(view.targetZoom * 0.85)), "-": () => (view.targetZoom = clampZoom(view.targetZoom * 1.15)), "0": reset };
    if (!map[e.key]) return;
    e.preventDefault();
    view.idle = 0;
    map[e.key]();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("dblclick", reset);
  canvas.addEventListener("keydown", key);

  let last = performance.now();
  const stop = loop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (variantEngine?.tick) {
      variantEngine.tick(dt, now / 1000);
    }
    if (!view.dragging) {
      view.yaw += view.spin;
      view.spin *= Math.pow(0.93, dt * 60);
      view.idle += dt;
      if (view.idle > 2.5 && !REDUCED) view.yaw += dt * 0.32 * Math.min(1, view.idle - 2.5);
    }
    view.pitch += (view.targetPitch - view.pitch) * (1 - Math.exp(-10 * dt));
    view.zoom += (view.targetZoom - view.zoom) * (1 - Math.exp(-10 * dt));
    if (view.intro < 1) view.intro = Math.min(1, view.intro + dt / 1.25);
    const arrived = 1 - Math.pow(1 - view.intro, 3);
    turn.rotation.set(view.pitch, view.yaw - (1 - arrived) * 1.6, 0);
    turn.position.y = -(1 - arrived) * 0.4;
    camera.position.set(0, 0, distance * view.zoom);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  });

  return {
    destroy() {
      stop();
      observer.disconnect();
      variantEngine?.dispose();
      env.texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
    updateVariant(sel) {
      if (variantEngine?.updateVariant) {
        variantEngine.updateVariant(sel);
      }
      if (kind === "bag" && sel?.size !== undefined) {
        const scales = [1.0, 1.15, 1.3];
        const s = scales[sel.size] || 1.0;
        piece.scale.setScalar(s);
      }
      if (kind === "bakery") {
        if (sel.glaze === 1) view.targetPitch = 0.22;
        else if (sel.warm === 1 || sel.serve === 1) {
          view.targetPitch = 0.15;
          view.targetZoom = 1.05;
        }
      }
    },
  };
}


/* ═══════════ bag drawer ═══════════ */
const bagEl = $("#bag");
const veilEl = $("#veil");
const bagSpring = new Spring({ x: 100 }, (o) => (bagEl.style.transform = `translateX(${o.x}%)`));
const veilSpring = new Spring({ opacity: 0 }, (o) => (veilEl.style.opacity = o.opacity));
veilEl.addEventListener("click", () => {
  if (hasLayer("bag")) closeBag();
  if (hasLayer("full-menu")) closeFullMenu();
});

function openBag() {
  if (hasLayer("bag")) return;
  if (hasLayer("full-menu")) closeFullMenu();
  hideToast();
  renderBag();
  bagEl.hidden = false;
  veilEl.hidden = false;
  pushLayer("bag", closeBag, bagEl);
  veilSpring.start({ opacity: 1 }, { config: C(170, 26), immediate: REDUCED });
  bagSpring.start({ x: 0 }, { config: C(210, 28), immediate: REDUCED });
  $(".x-btn", bagEl).focus({ preventScroll: true });
}

function closeBag() {
  if (!hasLayer("bag")) return;
  popLayer("bag");
  veilSpring.start({ opacity: 0 }, { config: C(220, 30), immediate: REDUCED }).then(() => !hasLayer("bag") && (veilEl.hidden = true));
  bagSpring.start({ x: 100 }, { config: C(240, 30), immediate: REDUCED }).then(() => !hasLayer("bag") && (bagEl.hidden = true));
}

/* ═══════════ full café menu board modal ═══════════ */
const fullMenuEl = $("#full-menu-modal");

const FULL_MENU_SECTIONS = [
  {
    title: "☕ ESPRESSO & CRAFT COFFEE",
    cat: "coffee",
    items: PRODUCTS.filter((p) => p.cat === "drinks" && !p.id.includes("matcha") && !p.id.includes("cold-brew")),
  },
  {
    title: "🧊 COLD BAR & SPECIALTY",
    cat: "specialty",
    items: PRODUCTS.filter((p) => p.id === "nitro-cold-brew" || p.id === "iced-matcha"),
  },
  {
    title: "🥐 ARTISAN BAKERY (FRESH FROM 06:00)",
    cat: "bakery",
    items: PRODUCTS.filter((p) => p.cat === "bakery"),
  },
  { title: "🍔 BURGERS", cat: "burgers", items: KITCHEN.filter((k) => k.menuCat === "burgers") },
  { title: "🍕 WOOD-FIRED PIZZA", cat: "pizza", items: KITCHEN.filter((k) => k.menuCat === "pizza") },
  { title: "🍝 PASTA", cat: "pasta", items: KITCHEN.filter((k) => k.menuCat === "pasta") },
  { title: "🌯 ROLLS & WRAPS", cat: "rolls", items: KITCHEN.filter((k) => k.menuCat === "rolls") },
  { title: "🍹 COOLERS & SHAKES", cat: "drinks", items: KITCHEN.filter((k) => k.menuCat === "drinks") },
  {
    title: "🫘 FRESH ROASTS & WHOLE BEAN",
    cat: "beans",
    items: PRODUCTS.filter((p) => p.cat === "beans"),
  },
  {
    title: "🏺 EQUIPMENT & PROVISIONS",
    cat: "merch",
    items: PRODUCTS.filter((p) => p.cat === "merch" || p.cat === "gifts"),
  },
];

const FULL_MENU_PILLS = { coffee: "COFFEE", specialty: "COLD BAR", bakery: "BAKERY", burgers: "BURGERS", pizza: "PIZZA", pasta: "PASTA", rolls: "ROLLS", drinks: "COOLERS", beans: "ROASTS", merch: "GEAR &amp; GIFTS" };

function renderFullMenu() {
  if (!fullMenuEl) return;
  const totalCount = PRODUCTS.length;
  fullMenuEl.innerHTML = `
    <div class="full-menu-card" role="document">
      <div class="full-menu-head">
        <div>
          <p class="full-menu-sub mono-fine">// BREWNS COFFEE HOUSE · LAHORE</p>
          <h2 class="full-menu-title">FULL CAFÉ MENU BOARD</h2>
        </div>
        <div class="full-menu-head-right">
          <span class="full-menu-count-badge mono-fine">${totalCount} OFFERINGS</span>
          <button type="button" class="full-menu-close-btn" id="full-menu-close" aria-label="Close full menu">✕</button>
        </div>
      </div>
      <div class="full-menu-pills" role="tablist" aria-label="Menu sections">
        <button type="button" class="full-menu-pill active" data-fsec="all">ALL (${totalCount})</button>
        ${FULL_MENU_SECTIONS.map((sec) => `<button type="button" class="full-menu-pill" data-fsec="${sec.cat}">${FULL_MENU_PILLS[sec.cat]} (${sec.items.length})</button>`).join("")}
      </div>
      <div class="full-menu-body" id="full-menu-body">
        ${FULL_MENU_SECTIONS.map((sec) => `
          <section class="full-menu-sec" data-sec-cat="${sec.cat}">
            <div class="full-menu-sec-title">
              <span>${sec.title}</span>
              <span class="full-menu-sec-count mono-fine">${sec.items.length} ITEMS</span>
            </div>
            <div class="full-menu-grid">
              ${sec.items.map((p) => `
                <article class="full-menu-item" data-fproduct="${p.id}" tabindex="0" role="button" aria-label="${p.name}, ${money(p.price)}">
                  <div class="full-menu-img-wrap">
                    ${p.gift ? giftcardHTML(money(p.price)) : p.photo ? `<img${p.art ? ' class="shot"' : ""} src="${photoSrc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : `<img data-snap="${p.model}" data-snap-product="${p.id}" alt="${esc(p.name)}">`}
                  </div>
                  <div class="full-menu-item-info">
                    <div class="full-menu-item-top">
                      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem">
                        <h3 class="full-menu-item-name">${p.name}</h3>
                        ${p.tag ? `<span class="full-menu-item-tag">${p.tag}</span>` : ""}
                      </div>
                      <p class="full-menu-item-notes mono-fine">${p.notes ? p.notes.join(" · ") : p.meta}</p>
                    </div>
                    <div class="full-menu-item-bottom">
                      <span class="full-menu-item-price">${money(p.price)}</span>
                      <div class="full-menu-item-actions">
                        <button type="button" class="full-menu-view-btn mono-fine" data-fview="${p.id}">CUSTOMIZE</button>
                        <button type="button" class="full-menu-add-btn" data-fadd="${p.id}" aria-label="Add ${esc(p.name)} to bag">+ ADD</button>
                      </div>
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>
      <div class="full-menu-foot">
        <p class="full-menu-foot-hint mono-fine">Order ahead to have your pour &amp; pastries boxed and waiting at any counter.</p>
        <button type="button" class="full-menu-shop-btn" id="full-menu-to-shop">
          <span>ORDER AHEAD IN SHOP (${totalCount} ITEMS)</span>
          <span aria-hidden="true">↓</span>
        </button>
      </div>
    </div>
  `;

  fillSnaps(fullMenuEl);
  $("#full-menu-close", fullMenuEl)?.addEventListener("click", () => closeFullMenu());
  $("#full-menu-to-shop", fullMenuEl)?.addEventListener("click", () => {
    closeFullMenu();
    setFilter("all");
    lenis.scrollTo("#shop", { duration: 1.2 });
  });

  $$(".full-menu-pill", fullMenuEl).forEach((pill) => {
    pill.addEventListener("click", () => {
      playSoftClick();
      const cat = pill.dataset.fsec;
      $$(".full-menu-pill", fullMenuEl).forEach((b) => b.classList.toggle("active", b === pill));
      $$(".full-menu-sec", fullMenuEl).forEach((sec) => {
        sec.hidden = cat !== "all" && sec.dataset.secCat !== cat;
      });
    });
  });

  $$("[data-fadd]", fullMenuEl).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.fadd;
      if (id) quickAdd(id, btn as HTMLButtonElement);
    });
  });

  $$("[data-fview]", fullMenuEl).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.fview;
      if (id) {
        closeFullMenu();
        openProduct(id);
      }
    });
  });

  $$(".full-menu-item", fullMenuEl).forEach((item) => {
    item.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-fadd]") || (e.target as HTMLElement).closest("[data-fview]")) return;
      const id = item.dataset.fproduct;
      if (id) {
        closeFullMenu();
        openProduct(id);
      }
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !(e.target as HTMLElement).closest("[data-fadd]")) {
        e.preventDefault();
        const id = item.dataset.fproduct;
        if (id) {
          closeFullMenu();
          openProduct(id);
        }
      }
    });
  });
}

function openFullMenu() {
  if (!fullMenuEl || hasLayer("full-menu")) return;
  hideToast();
  renderFullMenu();
  fullMenuEl.hidden = false;
  veilEl.hidden = false;
  pushLayer("full-menu", closeFullMenu, fullMenuEl);
  veilSpring.start({ opacity: 1 }, { config: C(170, 26), immediate: REDUCED });
  requestAnimationFrame(() => fullMenuEl.classList.add("open"));
  $(".full-menu-close-btn", fullMenuEl)?.focus({ preventScroll: true });
}

function closeFullMenu() {
  if (!fullMenuEl || !hasLayer("full-menu")) return;
  popLayer("full-menu");
  fullMenuEl.classList.remove("open");
  veilSpring.start({ opacity: 0 }, { config: C(220, 30), immediate: REDUCED }).then(() => !hasLayer("full-menu") && (veilEl.hidden = true));
  setTimeout(() => {
    if (!hasLayer("full-menu")) fullMenuEl.hidden = true;
  }, 300);
}

function renderBag() {
  const items = cart.items;
  const n = cart.count();
  const list = items.length
    ? items
        .map((it) => {
          const p = productById(it.id);
          return `<div class="bag-item" data-key="${esc(it.key)}">
            ${thumbHTML(p)}
            <div>
              <button type="button" class="bag-item-name" data-open="${p.id}">${p.name}</button>
              <p class="bag-item-opts mono-fine">${esc(selLabel(p, it.sel))}${it.message ? ` · “${esc(it.message)}”` : ""}</p>
              <div class="bag-item-row">
                <div class="qty" role="group" aria-label="Quantity of ${esc(p.name)}"><button type="button" data-bq="-1" aria-label="Decrease">−</button><output>${it.qty}</output><button type="button" data-bq="1" aria-label="Increase">+</button></div>
                <button type="button" class="bag-remove mono-fine" data-remove>REMOVE</button>
              </div>
            </div>
            <p class="bag-item-price">${money(unitPrice(p, it.sel) * it.qty)}</p>
          </div>`;
        })
        .join("")
    : `<div class="bag-empty">
        <p class="mono-fine" style="color:rgb(255 255 255/.5)"><span class="sl">//</span><span class="sls"> </span>NOTHING HERE YET</p>
        <p class="bag-empty-title">YOUR BAG IS EMPTY.</p>
        <div class="bag-picks">${["latte", "espresso", "cinnamon-roll"]
          .map((id) => {
            const p = productById(id);
            return `<div class="bag-pick">${thumbHTML(p)}<div><p class="bag-item-name">${p.name}</p><p class="bag-item-opts mono-fine">${money(p.price)}</p></div><button type="button" class="pcard-add" data-pick="${id}">+ ADD</button></div>`;
          })
          .join("")}</div>
        <button type="button" class="btn btn-line" data-shop>BROWSE THE SHOP ${ARROW_SVG}</button>
      </div>`;
  const scroll = $(".bag-list", bagEl)?.scrollTop || 0;
  const focusedKey = document.activeElement?.closest?.("[data-key]")?.dataset.key;
  const focusedAction = document.activeElement?.dataset?.bq;
  bagEl.innerHTML = `
    <div class="bag-head"><p class="bag-title">YOUR BAG<sup>${String(n).padStart(2, "0")}</sup></p><button type="button" class="x-btn" aria-label="Close bag"></button></div>
    <div class="bag-list">${list}</div>
    ${
      items.length
        ? `<div class="bag-foot">
            <div class="sum-row mono-fine"><span>SUBTOTAL</span><span>${money(cart.subtotal())}</span></div>
            <p class="bag-eta mono-fine"><span class="dot"></span>READY FOR PICKUP IN ~12 MIN</p>
            <button type="button" class="btn btn-solid btn-block" data-checkout>ORDER NOW · ${money(cart.subtotal())} ${ARROW_SVG}</button>
            <p class="mono-fine" style="color:rgb(255 255 255/.4)">TAX AND PICKUP TIME AT CHECKOUT</p>
          </div>`
        : ""
    }`;
  $(".bag-list", bagEl).scrollTop = scroll;
  if (focusedKey && focusedAction) $$("[data-key]", bagEl).find((row) => row.dataset.key === focusedKey)?.querySelector(`[data-bq="${focusedAction}"]`)?.focus();
  fillSnaps(bagEl);
}

bagEl.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest(".x-btn")) return closeBag();
  const key = t.closest("[data-key]")?.dataset.key;
  const step = t.closest("[data-bq]");
  if (step && key) {
    const it = cart.items.find((i) => i.key === key);
    return cart.setQty(key, it.qty + +step.dataset.bq);
  }
  if (t.closest("[data-remove]") && key) return cart.remove(key);
  const open = t.closest("[data-open]");
  if (open) {
    closeBag();
    return openProduct(open.dataset.open);
  }
  const pick = t.closest("[data-pick]");
  if (pick) return cart.add(pick.dataset.pick, defaultSel(productById(pick.dataset.pick)));
  if (t.closest("[data-shop]")) {
    closeBag();
    return setTimeout(() => lenis.scrollTo("#shop", { force: true }), 40);
  }
  if (t.closest("[data-checkout]")) {
    closeBag();
    openCheckout();
  }
});
cart.subscribe(() => hasLayer("bag") && renderBag());

/* ═══════════ checkout ═══════════ */
const coEl = $("#checkout");
const coClip = new Spring({ clipPath: "inset(0% 0% 100% 0%)" }, styler(coEl));
const LOCS = [["MM ALAM ROAD", "GULBERG III, LAHORE"], ["CCA, DHA PHASE 5", "DHA, LAHORE"], ["MAIN BOULEVARD", "JOHAR TOWN, LAHORE"]];
// The same shops as they read in a sentence.
const LOC_TITLES = ["MM Alam Road", "CCA, DHA Phase 5", "Main Boulevard, Johar Town"];
const TAX = 0.16, PREP_MIN = 12, OPEN_MIN = 7 * 60, CLOSE_MIN = 21 * 60;
/* Punjab taxes restaurant bills at 16%, and at 5% when they are paid by card or
   a mobile wallet; the checkout shows whichever applies to the method chosen. */
const TAX_CARD = 0.05;
/* Delivery areas: which shop sends the rider, the fee, and the time it takes. */
const DELIVERY = { min: 1000, freeOver: 3000, areas: [
  ["GULBERG", 0, 150, 30], ["MODEL TOWN", 0, 250, 40], ["GARDEN TOWN", 0, 200, 35],
  ["DHA PHASE 1–6", 1, 200, 35], ["DHA PHASE 7–8", 1, 300, 45],
  ["JOHAR TOWN", 2, 150, 30], ["WAPDA TOWN", 2, 250, 40],
] };
const PAY = [
  ["CASH", "AT THE COUNTER", "TO THE RIDER"],
  ["CARD", "TAP OR CHIP · 5% TAX", "ON THE RIDER'S MACHINE · 5% TAX"],
  ["JAZZCASH / EASYPAISA", "SCAN OUR RAAST QR · 5% TAX", "SCAN THE RIDER'S QR · 5% TAX"],
];
// Pakistani mobile numbers: 03XX XXXXXXX, with or without +92 / 0092.
const pkMobile = (v) => {
  const d = v.replace(/[\s\-()]/g, "").replace(/^(\+92|0092)/, "0");
  return /^03\d{9}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4)}` : "";
};
const SHOP_MAPS = (i) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${LOCS[i][0]}, ${LOCS[i][1]}`)}`;
const readStore = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeStore = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
let co = null;
let coTimer = 0;
let coCleanups = [];

const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const isOpenNow = () => nowMin() >= OPEN_MIN && nowMin() + PREP_MIN <= CLOSE_MIN;
const slotList = () => {
  const m = nowMin();
  let start = Math.max(OPEN_MIN + 15, Math.ceil((m + PREP_MIN + 5) / 15) * 15);
  let tomorrow = false;
  if (start > CLOSE_MIN - 15) {
    start = OPEN_MIN + 15;
    tomorrow = true;
  }
  const out = [];
  for (let t = start; t <= CLOSE_MIN - 15 && out.length < 20; t += 15) out.push({ t, tomorrow });
  return out;
};
const isDelivery = () => co.mode === "delivery";
const leadMin = () => (isDelivery() ? DELIVERY.areas[co.area][3] : PREP_MIN);
const pickupLabel = () =>
  co.when === "asap" ? `ASAP · ABOUT ${hhmm(nowMin() + leadMin())}` : co.slot ? `${co.slot.tomorrow ? "TOMORROW" : "TODAY"} ${hhmm(co.slot.t)}` : "CHOOSE A TIME";
const orderTotals = () => {
  const sub = cart.subtotal();
  const discount = Math.round(sub * co.discount);
  const fee = isDelivery() && sub - discount < DELIVERY.freeOver ? DELIVERY.areas[co.area][2] : 0;
  const rate = co.pay ? TAX_CARD : TAX;
  const tax = Math.round((sub - discount) * rate);
  return { sub, discount, fee, rate, tax, total: sub - discount + fee + tax };
};
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const tornPath = (w) => {
  let d = `M 0 0 L ${w} 0`;
  for (let x = w; x > 0; x -= 8) d += ` L ${Math.max(0, x - 4)} 9 L ${Math.max(0, x - 8)} 0`;
  return `${d} Z`;
};
const orderBars = (seed) => {
  let s = Math.imul(seed, 2654435761) >>> 0;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  let left = 284, html = "";
  while (left > 3) {
    const w = next() < 0.55 ? 1 : 2.5;
    html += `<span style="flex:none;width:${w}px;background:${next() > 0.22 ? "#111" : "transparent"}"></span>`;
    left -= w + 1;
  }
  return html;
};

function openCheckout() {
  if (!cart.count()) return openBag();
  if (hasLayer("bag")) closeBag();
  const saved = readStore("brewns-details", {});
  co = { step: 1, mode: saved.mode || "pickup", area: saved.area ?? 0, address: saved.address || "", loc: saved.loc ?? 0, when: isOpenNow() ? "asap" : "later", slot: null, name: saved.name || "", phone: saved.phone || "", email: saved.email || "", note: "", pay: 0, promo: "", discount: 0, errors: {}, done: null };
  if (co.when === "later") co.slot = slotList()[0];
  renderCheckout();
  if (hasLayer("checkout")) return;
  coEl.hidden = false;
  coEl.scrollTop = 0;
  pushLayer("checkout", closeCheckout, coEl);
  if (REDUCED) coClip.set({ clipPath: "inset(0% 0% 0% 0%)" });
  else {
    coClip.set({ clipPath: "inset(0% 0% 100% 0%)" });
    coClip.start({ clipPath: "inset(0% 0% 0% 0%)" }, { config: { duration: 760, easing: easeOutQuart } });
  }
  setTimeout(() => $("[data-co='next'], [data-co='close']", coEl)?.focus({ preventScroll: true }), 50);
}

function closeCheckout() {
  if (!hasLayer("checkout")) return;
  popLayer("checkout");
  clearInterval(coTimer);
  coCleanups.forEach((f) => f());
  coCleanups = [];
  const finish = () => {
    if (hasLayer("checkout")) return;
    coEl.hidden = true;
    coEl.innerHTML = "";
    co = null;
  };
  if (REDUCED) finish();
  else coClip.start({ clipPath: "inset(100% 0% 0% 0%)" }, { config: { duration: 620, easing: easeOutQuart } }).then(finish);
}

const coTop = (label, dark = false) =>
  `<div class="co-top${dark ? " dark" : ""}"><button type="button" class="co-back mono-fine" data-co="${dark ? "close" : "back"}">${ARROW_SVG}<span>${label}</span></button><span class="co-mark wordmark mask" role="img" aria-label="brewns"></span><button type="button" class="x-btn" data-co="close" aria-label="Close checkout"></button></div>`;

const field = (key, label, type, attrs, placeholder) =>
  `<label class="field${co.errors[key] ? " bad" : ""}"><span class="mono-fine">${label}</span><input type="${type}" data-field="${key}" value="${esc(co[key])}" placeholder="${placeholder}" ${attrs}><span class="err mono-fine">${co.errors[key] || ""}</span></label>`;

function renderCheckout({ animate = true } = {}) {
  if (co.done) return renderDone();
  const totals = orderTotals();
  const n = cart.count();
  const slotsScroll = $(".slots", coEl)?.scrollLeft || 0;
  const steps = ["ORDER", "DETAILS", "CONFIRMED"].map((s, i) => `<li class="${co.step >= i + 1 ? "on" : ""}">0${i + 1} ${s}</li>`).join("");
  const open = isOpenNow();
  const delivery = isDelivery();
  const short = delivery && totals.sub - totals.discount < DELIVERY.min;
  const radio = (name, i, checked, title, meta) =>
    `<label class="pick"><input type="radio" name="${name}" value="${i}" ${checked ? "checked" : ""}><span class="pick-check" aria-hidden="true"></span><span class="pick-name">${title}</span><span class="pick-meta mono-fine">${meta}</span></label>`;

  const main =
    co.step === 1
      ? `<h2 class="co-h">${delivery ? "WHERE TO?" : "WHERE &amp; WHEN."}</h2>
        <div class="co-block">
          <p class="co-label mono-fine"><span>HOW DO YOU WANT IT</span><span>OPEN DAILY 07:00 – 21:00</span></p>
          <div class="seg" role="radiogroup" aria-label="Order type">
            <button type="button" role="radio" data-mode="pickup" aria-checked="${!delivery}">PICKUP<small>READY IN ~${PREP_MIN} MIN · FREE</small></button>
            <button type="button" role="radio" data-mode="delivery" aria-checked="${delivery}">DELIVERY<small>~30–45 MIN · FROM ${money(150)}</small></button>
          </div>
        </div>
        ${
          delivery
            ? `<div class="co-block">
          <p class="co-label mono-fine"><span>YOUR AREA</span><span>FREE DELIVERY OVER ${money(DELIVERY.freeOver)}</span></p>
          <div class="loc-cards area-cards" role="radiogroup" aria-label="Delivery area">${DELIVERY.areas
            .map(([name, shop, fee, eta], i) => radio("co-area", i, co.area === i, name, `${money(fee)} · ~${eta} MIN · FROM ${LOCS[shop][0]}`))
            .join("")}</div>
          ${short ? `<p class="co-note mono-fine">DELIVERY STARTS AT ${money(DELIVERY.min)}. ADD ${money(DELIVERY.min - (totals.sub - totals.discount))} MORE, OR PICK IT UP.</p>` : ""}
        </div>`
            : `<div class="co-block">
          <p class="co-label mono-fine"><span>PICKUP LOCATION</span><span>SHOW YOUR ORDER NUMBER AT THE COUNTER</span></p>
          <div class="loc-cards" role="radiogroup" aria-label="Pickup location">${LOCS.map(([a, b], i) =>
            radio("co-loc", i, co.loc === i, `${a}<br>${b}`, `<span class="dot"></span>${open ? "OPEN NOW" : "OPENS 07:00"} · ~${PREP_MIN} MIN`),
          ).join("")}</div>
        </div>`
        }
        <div class="co-block">
          <p class="co-label mono-fine"><span>${delivery ? "DELIVERY TIME" : "PICKUP TIME"}</span><span>${pickupLabel()}</span></p>
          <div class="seg" role="radiogroup" aria-label="${delivery ? "Delivery" : "Pickup"} time">
            <button type="button" role="radio" data-when="asap" aria-checked="${co.when === "asap"}" ${open ? "" : "disabled"}>AS SOON AS POSSIBLE<small>${open ? `~${leadMin()} MIN` : "WE'RE CLOSED"}</small></button>
            <button type="button" role="radio" data-when="later" aria-checked="${co.when === "later"}">SCHEDULE<small>PICK A TIME</small></button>
          </div>
          ${
            co.when === "later"
              ? `<div class="slots" role="radiogroup" aria-label="Time slot">${slotList()
                  .map((s) => `<button type="button" role="radio" data-slot="${s.t}|${s.tomorrow ? 1 : 0}" aria-checked="${co.slot?.t === s.t}">${s.tomorrow ? "TMRW " : ""}${hhmm(s.t)}</button>`)
                  .join("")}</div>`
              : ""
          }
        </div>
        <div class="co-actions"><button type="button" class="btn btn-dark" data-co="next" ${short ? "disabled" : ""}>CONTINUE TO DETAILS ${ARROW_SVG}</button></div>`
      : `<h2 class="co-h">${delivery ? "WHERE'S IT GOING?" : "WHO'S COLLECTING?"}</h2>
        <div class="co-block"><div class="fields">
          ${field("name", "NAME", "text", 'autocomplete="name" maxlength="40"', delivery ? "Who the rider asks for" : "Who we call out")}
          ${field("phone", "MOBILE", "tel", 'autocomplete="tel" inputmode="tel" maxlength="16"', "0300 1234567")}
          ${delivery ? `<label class="field wide${co.errors.address ? " bad" : ""}"><span class="mono-fine">ADDRESS · ${DELIVERY.areas[co.area][0]}</span><textarea data-field="address" rows="2" maxlength="160" autocomplete="street-address" placeholder="House / flat, street, block, nearest landmark">${esc(co.address)}</textarea><span class="err mono-fine">${co.errors.address || ""}</span></label>` : ""}
          ${field("email", "EMAIL · OPTIONAL", "email", 'autocomplete="email" maxlength="80"', "For the receipt")}
          <label class="field wide"><span class="mono-fine">NOTE FOR THE ${delivery ? "RIDER" : "BARISTA"} · OPTIONAL</span><textarea data-field="note" rows="2" maxlength="140" placeholder="${delivery ? "Gate code, call on arrival…" : "Extra hot, less ice…"}">${esc(co.note)}</textarea></label>
        </div></div>
        <div class="co-block">
          <p class="co-label mono-fine"><span>PAYMENT</span><span>PAID ${delivery ? "ON DELIVERY" : "AT PICKUP"} · NOTHING IS CHARGED ONLINE</span></p>
          <div class="loc-cards" role="radiogroup" aria-label="Payment">${PAY.map(([label, atShop, atDoor], i) => radio("co-pay", i, co.pay === i, label, delivery ? atDoor : atShop)).join("")}</div>
          ${co.pay ? "" : `<p class="co-note mono-fine">PAY BY CARD OR WALLET AND PUNJAB SALES TAX DROPS FROM 16% TO 5%.</p>`}
        </div>
        <div class="co-actions"><button type="button" class="btn btn-ghost" data-co="back">BACK</button><button type="button" class="btn btn-dark" data-co="place">PLACE ORDER · ${money(totals.total)} ${ARROW_SVG}</button></div>`;

  const lines = cart.items
    .map((it) => {
      const p = productById(it.id);
      return `<div class="co-line">${thumbHTML(p).replace(/<\/span>$/, `<b>${it.qty}</b></span>`)}<div><p class="bag-item-name">${p.name}</p><p class="bag-item-opts mono-fine">${esc(selLabel(p, it.sel))}</p></div><p class="bag-item-price">${money(unitPrice(p, it.sel) * it.qty)}</p></div>`;
    })
    .join("");

  coEl.innerHTML = `${coTop(co.step === 2 ? "BACK" : "BAG")}
    <div class="co-grid">
      <div class="co-main"><ol class="co-steps mono-fine">${steps}</ol>${main}</div>
      <aside class="co-side" aria-label="Order summary"><div class="co-side-in">
        <p class="co-side-title"><span>YOUR ORDER</span><span class="mono-fine">${n} ITEM${n === 1 ? "" : "S"}</span></p>
        <div class="co-lines">${lines}</div>
        <form class="co-promo" data-promo><input name="promo" placeholder="PROMO CODE" value="${esc(co.promo)}" aria-label="Promo code" autocomplete="off"><button type="submit" class="mono-fine">APPLY</button></form>
        <p class="co-promo-msg mono-fine" id="co-promo-msg">${co.discount ? "BREWNS10 — 10% OFF APPLIED" : co.promo ? "THAT CODE ISN'T VALID" : "TRY BREWNS10"}</p>
        <div class="co-sums mono-fine">
          <div class="sum-row"><span>SUBTOTAL</span><span>${money(totals.sub)}</span></div>
          ${totals.discount ? `<div class="sum-row"><span>PROMO</span><span>−${money(totals.discount)}</span></div>` : ""}
          ${delivery ? `<div class="sum-row"><span>DELIVERY · ${DELIVERY.areas[co.area][0]}</span><span>${totals.fee ? money(totals.fee) : "FREE"}</span></div>` : ""}
          <div class="sum-row"><span>PUNJAB SALES TAX ${Math.round(totals.rate * 100)}%</span><span>${money(totals.tax)}</span></div>
          <div class="sum-row total"><span>TOTAL</span><span>${money(totals.total)}</span></div>
        </div>
        ${
          delivery
            ? `<div class="co-pickup mono-fine"><span>DELIVERY</span><b>${DELIVERY.areas[co.area][0]}, LAHORE</b><b>${pickupLabel()}</b></div>`
            : `<div class="co-pickup mono-fine"><span>PICKUP</span><b>${LOCS[co.loc][0]}</b><b>${pickupLabel()}</b></div>`
        }
      </div></aside>
    </div>`;
  fillSnaps(coEl);
  const slots = $(".slots", coEl);
  if (slots) slots.scrollLeft = slotsScroll;
  if (animate) staggerIn($$(".co-main > *", coEl), 140);
}

let activeOrder = readStore("brewns-active-order", null);

const STATUS_TEXT: Record<string, string> = {
  placed: "ORDER RECEIVED",
  accepted: "ACCEPTED",
  preparing: "BARISTA ON IT",
  ready: "READY FOR PICKUP",
  dispatched: "OUT FOR DELIVERY",
  delivered: "DELIVERED",
  served: "SERVED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

function updateActiveOrderBadge(order: any) {
  const badge = $("#live-order-badge");
  if (!badge) return;
  if (!order || !order.backendId || order.status === "cancelled") {
    badge.hidden = true;
    return;
  }
  badge.hidden = false;
  const numEl = $("#lob-num", badge);
  const statusEl = $("#lob-status", badge);
  const descEl = $("#lob-desc", badge);
  const dotEl = $("#lob-dot", badge);

  if (numEl) numEl.textContent = `ORDER #${String(order.number).padStart(5, "0")}`;
  
  const statusKey = order.status || "placed";
  if (statusEl) {
    const textMap: Record<string, string> = {
      placed: "RECEIVED",
      accepted: "ACCEPTED",
      preparing: "BARISTA ON IT",
      ready: order.mode === "delivery" ? "READY FOR RIDER" : "READY AT COUNTER",
      dispatched: "OUT FOR DELIVERY",
      delivered: "DELIVERED",
      served: "SERVED",
      completed: "COMPLETED",
    };
    statusEl.textContent = textMap[statusKey] || statusKey.toUpperCase();
  }

  if (descEl) {
    if (statusKey === "ready") {
      descEl.textContent = order.mode === "delivery" ? "PACKED & WAITING FOR DISPATCH" : "WAITING FOR YOU AT PICKUP COUNTER!";
    } else if (statusKey === "dispatched") {
      descEl.textContent = `${order.rider?.name || "Rider"} is on the way · Tap to track`;
    } else if (statusKey === "delivered" || statusKey === "completed") {
      descEl.textContent = "Enjoy your fresh cup · Tap to view receipt";
    } else {
      descEl.textContent = "Crafted fresh to order · Tap to track live";
    }
  }

  if (dotEl) {
    dotEl.classList.toggle("amber", statusKey === "placed" || statusKey === "preparing");
  }
}

function updateChatMsgsUI(messages: any[]) {
  const container = $("#done-chat-msgs", coEl);
  const countEl = $("#done-chat-count", coEl);
  if (countEl) countEl.textContent = `${(messages || []).length} MSG`;
  if (!container) return;
  if (!messages || messages.length === 0) {
    container.innerHTML = `<p class="done-chat-empty mono-fine">Need special instructions or gate directions? Send a note to the barista or rider.</p>`;
    return;
  }
  container.innerHTML = messages.map((m: any) => `
    <div class="done-chat-msg ${m.sender === 'customer' ? 'msg-out' : 'msg-in'}">
      <div class="mono-fine msg-sender">${esc(m.name)}</div>
      <div class="msg-text">${esc(m.text)}</div>
    </div>
  `).join("");
  container.scrollTop = container.scrollHeight;
}

function updateDoneLiveElements(order: any) {
  if (!co || !co.done || co.done.backendId !== order.backendId) return;
  const pill = $("#done-status-pill", coEl);
  if (pill) {
    const text = STATUS_TEXT[order.status] || order.status.toUpperCase();
    pill.textContent = `● ${text}`;
    pill.className = `done-status-badge mono-fine ${order.status === 'ready' || order.status === 'dispatched' ? 'ready' : ''}`;
  }
  const stage = typeof order.stage === "number" ? order.stage : 0;
  $$(".done-step", coEl).forEach((s: HTMLElement) => {
    const st = Number(s.dataset.stage);
    s.classList.toggle("on", st <= stage);
  });

  // Update rider card if newly assigned
  const riderCard = $("#done-rider-card", coEl);
  if (order.rider && !riderCard) {
    const etaBlock = $(".done-eta", coEl);
    if (etaBlock) {
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="done-rider-card" id="done-rider-card">
          <div class="done-rider-icon">🛵</div>
          <div class="done-rider-info">
            <p class="mono-fine" style="color:var(--accent);margin:0 0 2px">ASSIGNED DISPATCH RIDER</p>
            <p style="margin:0;font-weight:700;font-size:14px;color:#fff">${esc(order.rider.name)} · <span class="mono-fine" style="color:rgba(255,255,255,0.6)">${esc(order.rider.plate || 'BIKE')}</span></p>
          </div>
          ${order.rider.phone ? `<a class="btn btn-line" href="tel:${esc(order.rider.phone)}" style="padding:0.45rem 0.85rem;font-size:11px">CALL RIDER</a>` : ''}
        </div>`;
      etaBlock.insertAdjacentElement("afterend", wrap.firstElementChild as Element);
    }
  }
  updateChatMsgsUI(order.messages || []);
}

async function syncActiveOrder() {
  if (!activeOrder || !activeOrder.backendId) {
    updateActiveOrderBadge(null);
    return;
  }
  try {
    const res = await fetch(`/api/orders/${activeOrder.backendId}/track`);
    if (!res.ok) {
      if (res.status === 404) {
        writeStore("brewns-active-order", null);
        activeOrder = null;
        updateActiveOrderBadge(null);
      }
      return;
    }
    const data = await res.json();
    const live = data.order;
    if (!live) return;

    const oldStatus = activeOrder.status;
    activeOrder.status = live.status;
    activeOrder.stage = live.stage;
    activeOrder.rider = live.rider;
    activeOrder.messages = live.messages || [];
    writeStore("brewns-active-order", activeOrder);

    updateActiveOrderBadge(activeOrder);

    if (co && co.done && co.done.backendId === activeOrder.backendId) {
      co.done.status = live.status;
      co.done.stage = live.stage;
      co.done.rider = live.rider;
      co.done.messages = live.messages || [];
      updateDoneLiveElements(co.done);

      if (oldStatus !== live.status) {
        if (live.status === 'ready') {
          toast(live.type === 'delivery' ? 'RIDER IS READY WITH YOUR ORDER' : 'YOUR ORDER IS READY AT THE COUNTER!', 'TRACK', () => openActiveOrderTracker(activeOrder));
        } else if (live.status === 'dispatched') {
          toast(`RIDER ${live.rider?.name || ''} IS ON THE WAY!`, 'TRACK', () => openActiveOrderTracker(activeOrder));
        } else if (live.status === 'completed' || live.status === 'delivered') {
          toast('ORDER COMPLETED · ENJOY YOUR BREWNS COFFEE!');
        }
      }
    }

    if (live.status === 'completed' || live.status === 'delivered' || live.status === 'cancelled') {
      if (Date.now() - activeOrder.placed > 30 * 60 * 1000) {
        writeStore("brewns-active-order", null);
        activeOrder = null;
        updateActiveOrderBadge(null);
      }
    }
  } catch {
    // Ignore network glitch
  }
}

function openActiveOrderTracker(order: any) {
  if (hasLayer("bag")) closeBag();
  co = {
    step: 3,
    mode: order.mode || "pickup",
    area: order.area ?? 0,
    address: order.address || "",
    loc: order.loc ?? 0,
    when: "asap",
    slot: null,
    name: order.name || "",
    phone: order.phone || "",
    email: order.email || "",
    note: order.note || "",
    pay: order.pay || 0,
    promo: "",
    discount: 0,
    errors: {},
    done: order,
  };
  renderCheckout();
  if (hasLayer("checkout")) return;
  coEl.hidden = false;
  coEl.scrollTop = 0;
  pushLayer("checkout", closeCheckout, coEl);
  if (REDUCED) coClip.set({ clipPath: "inset(0% 0% 0% 0%)" });
  else {
    coClip.set({ clipPath: "inset(0% 0% 100% 0%)" });
    coClip.start({ clipPath: "inset(0% 0% 0% 0%)" }, { config: { duration: 760, easing: easeOutQuart } });
  }
  setTimeout(() => $("[data-co='close']", coEl)?.focus({ preventScroll: true }), 50);
}

function renderDone() {
  const o = co.done;
  const loc = LOCS[o.loc];
  const delivered = o.mode === "delivery";
  const when = `${o.pickupAt.tomorrow ? "TOMORROW " : ""}${hhmm(o.pickupAt.t)}`;
  const d = new Date(o.placed);
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const num = `#${String(o.number).padStart(5, "0")}`;
  const lines = o.items
    .map((it: any) => {
      const p = productById(it.id);
      return `<div><span>${it.qty} × ${p ? p.name : it.name || it.id}</span><span>${money((p ? unitPrice(p, it.sel) : (it.unitPrice || 500)) * it.qty)}</span></div><div style="color:#5b5b58;margin-top:-3px"><span>${p ? esc(selLabel(p, it.sel)) : ""}</span></div>`;
    })
    .join("");

  const statusKey = o.status || "placed";
  const statusLabel = STATUS_TEXT[statusKey] || statusKey.toUpperCase();
  const isReadyOrDispatched = statusKey === "ready" || statusKey === "dispatched";

  coEl.innerHTML = `${coTop("CLOSE", true)}
    <div class="done">
      <div class="done-print" aria-hidden="true"><div class="done-machine">
        <img src="${ASSET_BASE_URL}order/printer.webp" alt="" width="404" height="72">
        <div class="done-window"><div class="paper" id="done-paper"><div class="receipt">
          <div class="receipt-body">
            <p style="font-size:11px;font-weight:700;letter-spacing:.16em;text-align:center">BREWNS COFFEE HOUSE</p>
            <div class="rc-rule"></div>
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:8px;letter-spacing:.07em;line-height:1.85"><div><p>ORDER ${num}</p><p>FOR ${esc(o.name.toUpperCase())}</p></div><div style="text-align:right"><p>${date}</p><p>${delivered ? "DELIVERY" : "PICKUP"} ${when}</p></div></div>
            <div style="font-size:8px;letter-spacing:.07em;line-height:1.85">${delivered ? `<p>TO ${esc(o.address.toUpperCase())}</p><p>${DELIVERY.areas[o.area][0]}, LAHORE · ${esc(o.phone)}</p>` : `<p>${loc[0]}</p><p>${loc[1]}</p>`}</div>
            <div class="rc-rule"></div>
            <div class="rc-lines">${lines}</div>
            <div class="rc-rule"></div>
            <div class="rc-lines"><div><span>SUBTOTAL</span><span>${money(o.totals.sub)}</span></div>${o.totals.discount ? `<div><span>PROMO</span><span>−${money(o.totals.discount)}</span></div>` : ""}${delivered ? `<div><span>DELIVERY</span><span>${o.totals.fee ? money(o.totals.fee) : "FREE"}</span></div>` : ""}<div><span>SALES TAX ${Math.round(o.totals.rate * 100)}%</span><span>${money(o.totals.tax)}</span></div></div>
            <div class="rc-total"><span>TOTAL</span><span>${money(o.totals.total)}</span></div>
            <p style="font-size:8px;letter-spacing:.07em;line-height:1.85">PAY ${PAY[o.pay][0]} ${delivered ? "ON DELIVERY" : "AT PICKUP"}${o.note ? ` · NOTE: ${esc(o.note.toUpperCase())}` : ""}</p>
            <div class="rc-rule"></div>
            <p style="font-size:16px;font-weight:700;line-height:1.25"><span style="display:block">SKIP THE LINE.</span><span style="display:block">SEE YOU SOON.</span></p>
            <div class="barcode">${orderBars(o.number)}</div>
            <p style="font-size:7px;letter-spacing:.16em;text-align:center">BREWNS.COFFEE</p>
          </div>
          <svg width="328" height="9" viewBox="0 0 328 9" preserveAspectRatio="none" style="display:block"><path d="${tornPath(328)}" fill="#F2F0EA"/></svg>
        </div></div></div>
      </div></div>
      <div class="done-body">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <p class="mono-fine" style="color:rgb(255 255 255/.55);margin:0"><span class="sl">//</span><span class="sls"> </span>ORDER ${num} · LIVE</p>
          <span class="done-status-badge mono-fine ${isReadyOrDispatched ? 'ready' : ''}" id="done-status-pill">● ${statusLabel}</span>
        </div>
        <h2 class="done-h">${delivered ? (o.status === "dispatched" ? "ON THE WAY TO YOU." : `AT YOUR DOOR BY ${when}.`) : (o.status === "ready" ? "READY AT THE COUNTER." : `SEE YOU AT ${when}.`)}</h2>
        <p class="pdp-desc" id="done-desc">${
          delivered
            ? `We’ve got it, ${esc(titleCase(o.name.split(" ")[0]))}. ${LOC_TITLES[o.loc]} is preparing your order, and a rider will bring it to ${esc(o.address)}. They’ll call ${esc(o.phone)} when they’re outside. Pay ${PAY[o.pay][0].toLowerCase().replace("jazzcash / easypaisa", "by JazzCash or Easypaisa")} on arrival: ${money(o.totals.total)}.`
            : `We’ve got it, ${esc(titleCase(o.name.split(" ")[0]))}. Head to ${LOC_TITLES[o.loc]} — your order will be waiting at the pickup counter under ${num}. Pay ${money(o.totals.total)} ${o.pay === 0 ? "in cash" : o.pay === 1 ? "by card" : "by JazzCash or Easypaisa"} when you collect.`
        }</p>
        <div class="done-eta">
          <div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="46"/><circle class="bar" id="ring-bar" cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><div class="ring-num" aria-live="polite"><span><span id="ring-num">--</span><small id="ring-unit">MIN</small></span></div></div>
          <div class="done-steps" style="flex:1" id="done-steps-wrap">${["ORDER RECEIVED", "BARISTA ON IT", delivered ? "OUT FOR DELIVERY" : "READY FOR PICKUP", delivered ? "DELIVERED" : "COLLECTED"].map((s, i) => `<div class="done-step mono-fine ${o.stage >= i ? 'on' : ''}" data-stage="${i}"><i></i>${s}</div>`).join("")}</div>
        </div>
        ${delivered && o.rider ? `
          <div class="done-rider-card" id="done-rider-card">
            <div class="done-rider-icon">🛵</div>
            <div class="done-rider-info">
              <p class="mono-fine" style="color:var(--accent);margin:0 0 2px">ASSIGNED DISPATCH RIDER</p>
              <p style="margin:0;font-weight:700;font-size:14px;color:#fff">${esc(o.rider.name)} · <span class="mono-fine" style="color:rgba(255,255,255,0.6)">${esc(o.rider.plate || 'BIKE')}</span></p>
            </div>
            ${o.rider.phone ? `<a class="btn btn-line" href="tel:${esc(o.rider.phone)}" style="padding:0.45rem 0.85rem;font-size:11px">CALL RIDER</a>` : ''}
          </div>
        ` : ''}
        <div class="done-chat-section" id="done-chat-section">
          <div class="done-chat-head">
            <span class="mono-fine"><span class="sl">//</span> STORE &amp; RIDER CHAT</span>
            <span class="done-chat-count mono-fine" id="done-chat-count">${(o.messages || []).length} MSG</span>
          </div>
          <div class="done-chat-msgs" id="done-chat-msgs">
            ${(o.messages && o.messages.length > 0)
              ? o.messages.map((m: any) => `
                <div class="done-chat-msg ${m.sender === 'customer' ? 'msg-out' : 'msg-in'}">
                  <div class="mono-fine msg-sender">${esc(m.name)}</div>
                  <div class="msg-text">${esc(m.text)}</div>
                </div>
              `).join('')
              : `<p class="done-chat-empty mono-fine">Need special instructions or gate directions? Send a note to the barista or rider.</p>`
            }
          </div>
          <form class="done-chat-form" id="done-chat-form">
            <input type="text" class="done-chat-input" id="done-chat-input" placeholder="Message shop or rider..." maxlength="200" autocomplete="off">
            <button type="submit" class="btn btn-solid done-chat-send" id="done-chat-send">SEND</button>
          </form>
        </div>
        <div class="done-actions"><button type="button" class="btn btn-solid" data-co="close">BACK TO BREWNS ${ARROW_SVG}</button>${
          delivered ? "" : `<a class="btn btn-line" href="${SHOP_MAPS(o.loc)}" target="_blank" rel="noopener">DIRECTIONS ${ARROW_SVG}</a>`
        }<a class="btn btn-line" href="tel:+924212345678">CALL THE SHOP</a></div>
      </div>
    </div>`;

  const print = $(".done-print", coEl), machine = $(".done-machine", coEl), paper = $("#done-paper", coEl), windowEl = $(".done-window", coEl);
  const fitPrint = () => {
    const s = Math.min(1.2, (print.clientWidth - 40) / 400);
    machine.style.setProperty("--s", s);
    windowEl.style.height = `${paper.offsetHeight + 40}px`;
    print.style.minHeight = `${(43 + paper.offsetHeight + 60) * s + 72}px`;
  };
  window.addEventListener("resize", fitPrint);
  coCleanups.push(() => window.removeEventListener("resize", fitPrint));
  const feed = new Spring({ v: 0 }, (x: any) => paper.style.setProperty("--p", String(Math.round(x.v * 46) / 46)));
  requestAnimationFrame(() => {
    fitPrint();
    REDUCED ? feed.set({ v: 1 }) : feed.start({ v: 1 }, { config: { duration: 2600, easing: easeOutCubic }, delay: 450 });
  });
  staggerIn($$(".done-body > *", coEl), 350);

  const tickRing = () => {
    const now = Date.now();
    const left = Math.max(0, o.target - now);
    const frac = 1 - left / Math.max(1, o.target - o.placed);
    $("#ring-bar", coEl)?.setAttribute("stroke-dashoffset", String(100 - frac * 100));
    const mins = Math.ceil(left / 60000);
    const numEl = $("#ring-num", coEl), unitEl = $("#ring-unit", coEl);
    if (!numEl) return;
    if (o.status === "ready") {
      [numEl.textContent, unitEl.textContent] = ["NOW", "READY"];
    } else if (o.status === "dispatched") {
      [numEl.textContent, unitEl.textContent] = ["EN", "ROUTE"];
    } else if (o.status === "delivered" || o.status === "completed") {
      [numEl.textContent, unitEl.textContent] = ["DONE", "ENJOY"];
    } else if (!left) {
      [numEl.textContent, unitEl.textContent] = ["SOON", "FINALIZING"];
    } else if (mins >= 60) {
      [numEl.textContent, unitEl.textContent] = [`${Math.floor(mins / 60)}H`, `${mins % 60} MIN`];
    } else {
      [numEl.textContent, unitEl.textContent] = [String(mins), "MIN"];
    }
    const stage = typeof o.stage === "number" ? o.stage : (left === 0 ? 2 : now - o.placed > 4000 ? 1 : 0);
    $$(".done-step", coEl).forEach((s: HTMLElement) => {
      const st = Number(s.dataset.stage);
      s.classList.toggle("on", st <= stage);
    });
  };
  tickRing();
  clearInterval(coTimer);
  coTimer = setInterval(tickRing, 1000);

  // Wire chat form
  const chatForm = $("#done-chat-form", coEl);
  if (chatForm) {
    chatForm.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const input = $("#done-chat-input", coEl) as HTMLInputElement;
      const text = input ? input.value.trim() : "";
      if (!text || !o.backendId) return;
      input.value = "";
      try {
        const res = await fetch(`/api/orders/${o.backendId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, senderName: o.name || "Customer" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!o.messages) o.messages = [];
          o.messages.push(data.message);
          writeStore("brewns-active-order", o);
          updateChatMsgsUI(o.messages);
        }
      } catch {
        toast("Message could not be sent.");
      }
    });
  }
}

async function placeOrder() {
  const errors: Record<string, string> = {};
  if (co.name.trim().length < 2) errors.name = "TELL US WHO TO CALL OUT";
  if (!pkMobile(co.phone)) errors.phone = "A PAKISTANI MOBILE, LIKE 0300 1234567";
  if (isDelivery() && co.address.trim().length < 10) errors.address = "HOUSE, STREET AND BLOCK, SO THE RIDER FINDS YOU";
  if (co.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(co.email.trim())) errors.email = "THAT EMAIL LOOKS OFF";
  co.errors = errors;
  if (Object.keys(errors).length) {
    renderCheckout({ animate: false });
    $(".field.bad input", coEl)?.focus();
    return;
  }
  co.phone = pkMobile(co.phone);
  writeStore("brewns-details", { name: co.name.trim(), phone: co.phone, email: co.email.trim(), loc: co.loc, mode: co.mode, area: co.area, address: co.address.trim() });

  const placeBtn = $("[data-co='place']", coEl);
  if (placeBtn) {
    placeBtn.setAttribute("disabled", "true");
    placeBtn.innerHTML = `<span>TRANSMITTING TICKET...</span><span class="dot" data-pulse></span>`;
  }

  const placed = Date.now();
  const pickupAt = co.when === "asap" ? { t: nowMin() + leadMin(), tomorrow: false } : co.slot;
  const midnight = new Date(placed);
  midnight.setHours(0, 0, 0, 0);
  const target = co.when === "asap" ? placed + leadMin() * 60000 : midnight.getTime() + (pickupAt.tomorrow ? 86400000 : 0) + pickupAt.t * 60000;
  const delivery = isDelivery();

  let backendOrder: any = null;
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: delivery ? "delivery" : co.mode === "dinein" ? "dinein" : "pickup",
        loc: delivery ? DELIVERY.areas[co.area][1] : co.loc,
        area: delivery ? co.area : undefined,
        address: delivery ? co.address.trim() : undefined,
        name: co.name.trim(),
        phone: co.phone,
        email: co.email ? co.email.trim() : undefined,
        note: co.note ? co.note.trim() : undefined,
        pay: co.pay,
        promo: co.discount ? (co.promo || "BREWNS10") : undefined,
        scheduledSlot: co.when === "later" ? co.slot : (!isOpenNow() ? pickupAt : null),
        items: cart.items.map((it: any) => {
          const p = productById(it.id);
          const isKitchen = p && (p.cat === "food" || p.cat === "bakery" || p.cat === "kitchen");
          return {
            id: it.id,
            sel: it.sel || {},
            name: p ? p.name : it.id,
            qty: it.qty,
            unitPrice: p ? unitPrice(p, it.sel) : 500,
            station: isKitchen ? "kitchen" : "bar",
          };
        }),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      backendOrder = data.order;
    }
  } catch {
    // Offline fallback
  }

  const number = backendOrder ? backendOrder.seq : readStore("brewns-order-seq", 25) + 1;
  writeStore("brewns-order-seq", number);

  const order = {
    id: backendOrder?.id || `ord_local_${Date.now()}`,
    backendId: backendOrder?.id || null,
    number,
    status: backendOrder?.status || 'placed',
    stage: backendOrder ? (backendOrder.stage ?? 0) : 0,
    placed,
    target,
    items: cart.items.map((it: any) => ({ ...it })),
    totals: orderTotals(),
    pickupAt,
    name: co.name.trim(),
    phone: co.phone,
    email: co.email ? co.email.trim() : "",
    note: co.note.trim(),
    pay: co.pay,
    mode: co.mode,
    area: delivery ? co.area : null,
    address: delivery ? co.address.trim() : "",
    loc: delivery ? DELIVERY.areas[co.area][1] : co.loc,
    rider: backendOrder?.rider || null,
    messages: backendOrder?.messages || [],
  };

  writeStore("brewns-orders", [order, ...readStore("brewns-orders", [])].slice(0, 20));
  activeOrder = order;
  writeStore("brewns-active-order", order);
  updateActiveOrderBadge(activeOrder);

  co.done = order;
  co.step = 3;
  cart.clear();
  renderCheckout();
  coEl.scrollTop = 0;
  $("[data-co='close']", coEl)?.focus({ preventScroll: true });
}


coEl.addEventListener("click", (e) => {
  if (!co) return;
  const t = e.target;
  const act = t.closest("[data-co]")?.dataset.co;
  if (act === "close") return closeCheckout();
  if (act === "back") {
    if (co.step === 2) {
      co.step = 1;
      renderCheckout();
      return (coEl.scrollTop = 0);
    }
    closeCheckout();
    return openBag();
  }
  if (act === "next") {
    co.step = 2;
    renderCheckout();
    coEl.scrollTop = 0;
    return $("[data-field='name']", coEl)?.focus({ preventScroll: true });
  }
  if (act === "place") return placeOrder();
  if (act === "shop") {
    closeCheckout();
    return setTimeout(() => lenis.scrollTo("#shop", { force: true }), 60);
  }
  const mode = t.closest("[data-mode]");
  if (mode) {
    co.mode = mode.dataset.mode;
    renderCheckout({ animate: false });
    return $(`[data-mode="${co.mode}"]`, coEl)?.focus();
  }
  const when = t.closest("[data-when]");
  if (when) {
    co.when = when.dataset.when;
    if (co.when === "later" && !co.slot) co.slot = slotList()[0];
    renderCheckout({ animate: false });
    return $(`[data-when="${co.when}"]`, coEl)?.focus();
  }
  const slot = t.closest("[data-slot]");
  if (slot) {
    const [time, tomorrow] = slot.dataset.slot.split("|").map(Number);
    co.slot = { t: time, tomorrow: !!tomorrow };
    renderCheckout({ animate: false });
    $(`[data-slot="${slot.dataset.slot}"]`, coEl)?.focus();
  }
});
coEl.addEventListener("change", (e) => {
  if (!co) return;
  if (e.target.name === "co-loc") {
    co.loc = +e.target.value;
    renderCheckout({ animate: false });
    $("input[name='co-loc']:checked", coEl)?.focus();
  }
  if (e.target.name === "co-area") {
    co.area = +e.target.value;
    renderCheckout({ animate: false });
    $("input[name='co-area']:checked", coEl)?.focus();
  }
  if (e.target.name === "co-pay") {
    co.pay = +e.target.value;
    renderCheckout({ animate: false });
    $("input[name='co-pay']:checked", coEl)?.focus();
  }
});
coEl.addEventListener("input", (e) => {
  const k = e.target.dataset.field;
  if (!co || !k) return;
  co[k] = e.target.value;
  const wrap = e.target.closest(".field");
  if (co.errors[k]) {
    co.errors[k] = "";
    wrap.classList.remove("bad");
    $(".err", wrap).textContent = "";
  }
});
coEl.addEventListener("submit", (e) => {
  if (!co || !e.target.matches("[data-promo]")) return;
  e.preventDefault();
  co.promo = e.target.promo.value.trim().toUpperCase();
  co.discount = co.promo === "BREWNS10" ? 0.1 : 0;
  renderCheckout({ animate: false });
});

  /* ═══════════════════════ the printed receipt ═══════════════════════
     The receipt feeds out of the printer as you scroll to it, so it carries the
     moment it printed and an actual order. It had neither: no items, no total, and
     a date frozen at 21/05/2025 under a headline reading "coffee for right now".

     This sits at the end of initBrewns on purpose. It reuses the checkout's own
     money(), TAX and PREP_MIN rather than restating them, and those are declared
     further up — run it any earlier and they are still in the temporal dead zone.
     The order number comes from the same counter placeOrder() increments, so the
     printed ticket and the one the bag issues belong to the same roll. */
  const RECEIPT_ITEMS = [
    [2, "Iced Matcha", 1150],
    [1, "Cinnamon Roll", 700],
  ];
  const rcSubtotal = RECEIPT_ITEMS.reduce((sum, [qty, , price]) => sum + qty * price, 0);
  const rcTaxDue = rcSubtotal * TAX;
  const rcPad2 = (n) => String(n).padStart(2, "0");
  const rcClock = (d) => `${rcPad2(d.getHours())}:${rcPad2(d.getMinutes())}`;
  const rcPrintedAt = new Date();
  const rcReadyAt = new Date(rcPrintedAt.getTime() + PREP_MIN * 60000);

  $("#rc-items").innerHTML = RECEIPT_ITEMS.map(
    ([qty, name, price]) => `<span>${qty}&times;</span><span>${esc(name)}</span><span>${money(qty * price)}</span>`,
  ).join("");
  $("#rc-sum").innerHTML = [
    ["Subtotal", money(rcSubtotal), ""],
    [`Punjab sales tax ${Math.round(TAX * 100)}%`, money(rcTaxDue), ""],
    ["Total", money(rcSubtotal + rcTaxDue), "rc-strong"],
  ]
    .map(([label, value, strong]) => `<span class="${strong}">${label}</span><span class="${strong}">${value}</span>`)
    .join("");

  $("#rc-no").textContent = `Order #${String(readStore("brewns-order-seq", 25) + 1).padStart(5, "0")}`;
  $("#rc-date").textContent = `${rcPad2(rcPrintedAt.getDate())}/${rcPad2(rcPrintedAt.getMonth() + 1)}/${rcPrintedAt.getFullYear()}`;
  $("#rc-time").textContent = rcClock(rcPrintedAt);
  $("#rc-ready").textContent = `Ready ${rcClock(rcReadyAt)} · MM Alam Rd`;


  /* ═══════════════════════ the footer's clock ═══════════════════════
     The footer stated hours and left the arithmetic to the reader. It now answers
     the question the locations badges answer — is it open right now — off the same
     OPEN_MIN/CLOSE_MIN the checkout books pickup slots against, so the two can
     never disagree. Declared up there, which is why this runs down here.

     The two spans lost their digit-roll: the roll rewrites textContent into its own
     cells, and anything written afterwards would tear that apart. Live beats rolled. */
  const ftrOpen = $("#ftr-open");
  const ftrOpenText = $("#ftr-open-t");
  const ftrHours = $("#ftr-hours");
  const paintFooterHours = () => {
    const open = isOpenNow();
    ftrOpen.classList.toggle("shut", !open);
    ftrOpenText.textContent = open ? "Open now" : "Closed";
    ftrHours.textContent = open ? `Until ${hhmm(CLOSE_MIN)}` : `Opens ${hhmm(OPEN_MIN)}`;
  };
  $("#ftr-year").textContent = String(new Date().getFullYear());

  // Hook live order badge click
  const lobBadge = $("#live-order-badge");
  if (lobBadge) {
    lobBadge.addEventListener("click", () => {
      if (activeOrder) {
        openActiveOrderTracker(activeOrder);
        syncActiveOrder();
      }
    });
  }

  // Check active order on startup & begin real-time sync
  if (activeOrder && activeOrder.backendId) {
    if (Date.now() - (activeOrder.placed || 0) < 24 * 3600000) {
      updateActiveOrderBadge(activeOrder);
      syncActiveOrder();
    } else {
      writeStore("brewns-active-order", null);
      activeOrder = null;
    }
  }
  const activeOrderSyncInterval = setInterval(syncActiveOrder, 3500);

  return () => {
    try {
      lenis?.destroy();
      clearInterval(footerClock);
      clearInterval(liveLocationsTimer);
      clearInterval(activeOrderSyncInterval);
      cancelAnimationFrame(tickRaf);
    } catch {}
  };
}
