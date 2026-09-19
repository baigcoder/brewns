'use client';

import React, { useEffect, useRef } from 'react';

const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec2 iMouseWake;

// Coffee Palette
const vec3 uBgColor = vec3(0.027, 0.027, 0.027); // #070707
const vec3 uColorA  = vec3(0.066, 0.043, 0.027); // #110B07
const vec3 uColorB  = vec3(0.165, 0.102, 0.067); // #2A1A0F
const vec3 uColorC  = vec3(0.431, 0.243, 0.133); // #6E3E22
const vec3 uColorD  = vec3(0.690, 0.478, 0.271); // #B07A45 (Crema)

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float snoise(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
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

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    v += amp * snoise(p);
    p = p * 2.0 + vec2(6.1, 2.7);
    amp *= 0.45;
  }
  return v;
}

vec3 ramp(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.0, 0.35, t));
  c = mix(c, uColorC, smoothstep(0.30, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.65, 1.0, t));
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  float t = iTime * 0.12;

  // Pointer wake distortion
  vec2 dMouse = uv - iMouse;
  float mouseDist = length(dMouse);
  float mouseInfluence = exp(-mouseDist * 4.0) * 0.25;

  vec2 p = uv * 0.6 + mouseInfluence * normalize(dMouse + vec2(0.001));

  vec2 q = vec2(
    fbm(p * 0.75 + vec2(0.0, t * 0.16)),
    fbm(p * 0.75 + vec2(5.2, 1.3) - t * 0.12)
  );

  float base = fbm(p + 1.45 * q + vec2(t * 0.1, -t * 0.08)) * 0.5 + 0.5;
  float tone = 0.5 + 0.5 * tanh((base - 0.52) * 2.6);

  vec3 col = ramp(tone);

  // Soft vignette
  col *= 1.0 - 0.35 * dot(uv, uv);

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function OpalesceShader({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
    });

    if (!gl) return;

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Shader compile failed', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Program link error', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const uRes = gl.getUniformLocation(program, 'iResolution');
    const uTime = gl.getUniformLocation(program, 'iTime');
    const uMouse = gl.getUniformLocation(program, 'iMouse');

    let animId: number;
    let width = 0;
    let height = 0;
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (width !== w || height !== h) {
        width = w;
        height = h;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.useProgram(program);
        gl.uniform2f(uRes, w, h);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const a = rect.width / rect.height;
      mouse.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * a;
      mouse.targetY = 0.5 - (e.clientY - rect.top) / rect.height;
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    resize();

    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    const startTime = performance.now();
    const render = (now: number) => {
      if (isVisible && !document.hidden) {
        const time = (now - startTime) * 0.001;
        mouse.x += (mouse.targetX - mouse.x) * 0.06;
        mouse.y += (mouse.targetY - mouse.y) * 0.06;

        gl.useProgram(program);
        gl.uniform1f(uTime, time);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
      className={className}
    >
      {/* CSS fallback gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, #070707 0%, #110B07 40%, #2A1A0F 70%, #442211 100%)',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.9,
          display: 'block',
        }}
      />
      {/* Editorial Scrim to preserve copy contrast */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to right, rgba(7,7,7,0.85) 0%, rgba(7,7,7,0.45) 45%, rgba(7,7,7,0.15) 75%)',
        }}
      />
    </div>
  );
}
