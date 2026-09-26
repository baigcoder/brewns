/* Where the café's data lives: accounts, orders, settings, the activity log.

   Two backends behind one small Redis-shaped interface:
   - Upstash Redis over its REST API, when KV_REST_API_URL / KV_REST_API_TOKEN
     (Vercel's Upstash integration) or UPSTASH_REDIS_REST_URL / _TOKEN are set.
     This is the one to use in production.
   - A JSON file otherwise: .data/brewns.json on your own computer. On Vercel
     without Redis the file goes in /tmp, which is wiped whenever the server
     sleeps, so the console warns about it (`storeInfo().ephemeral`).
   No SDK: the REST API is plain fetch, and the file needs nothing at all. */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

type Cmd = (string | number)[];

interface Backend {
  run(cmd: Cmd): Promise<unknown>;
  pipeline(cmds: Cmd[]): Promise<unknown[]>;
}

/* ── Upstash REST ── */

function upstash(url: string, token: string): Backend {
  const call = async (pathname: string, body: unknown) => {
    const res = await fetch(`${url.replace(/\/$/, '')}${pathname}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Redis ${res.status}: ${(data as { error?: string })?.error || res.statusText}`);
    return data;
  };
  return {
    async run(cmd) {
      const data = (await call('', cmd.map(String))) as { result?: unknown; error?: string };
      if (data.error) throw new Error(`Redis: ${data.error}`);
      return data.result;
    },
    async pipeline(cmds) {
      if (!cmds.length) return [];
      const data = (await call('/pipeline', cmds.map((c) => c.map(String)))) as { result?: unknown; error?: string }[];
      return data.map((d) => {
        if (d.error) throw new Error(`Redis: ${d.error}`);
        return d.result;
      });
    },
  };
}

/* ── the JSON file ── */

type FileData = { s: Record<string, string>; h: Record<string, Record<string, string>>; l: Record<string, string[]>; x: Record<string, number> };

function fileBackend(file: string): Backend {
  let data: FileData;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    data = { s: {}, h: {}, l: {}, x: {} };
  }
  data.s ||= {};
  data.h ||= {};
  data.l ||= {};
  data.x ||= {};
  const save = () => {
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  };
  const alive = (k: string) => {
    const at = data.x[k];
    if (at && at <= Date.now()) {
      delete data.s[k];
      delete data.h[k];
      delete data.l[k];
      delete data.x[k];
      return false;
    }
    return true;
  };
  const exists = (k: string) => alive(k) && (k in data.s || k in data.h || k in data.l);
  const range = (list: string[], a: number, b: number) => list.slice(a < 0 ? Math.max(0, list.length + a) : a, b < 0 ? list.length + b + 1 : b + 1);
  const run = (cmd: Cmd): unknown => {
    const [name, ...a] = cmd.map(String);
    const k = a[0];
    switch (name.toUpperCase()) {
      case 'GET':
        return alive(k) ? (data.s[k] ?? null) : null;
      case 'SET': {
        const flags = a.slice(2).map((x) => x.toUpperCase());
        if (flags.includes('NX') && exists(k)) return null;
        data.s[k] = a[1];
        delete data.x[k];
        const px = flags.indexOf('PX');
        const ex = flags.indexOf('EX');
        if (px >= 0) data.x[k] = Date.now() + Number(a[2 + px + 1]);
        if (ex >= 0) data.x[k] = Date.now() + Number(a[2 + ex + 1]) * 1000;
        save();
        return 'OK';
      }
      case 'DEL': {
        let n = 0;
        for (const key of a) {
          if (exists(key)) n++;
          delete data.s[key];
          delete data.h[key];
          delete data.l[key];
          delete data.x[key];
        }
        save();
        return n;
      }
      case 'INCR':
      case 'INCRBY': {
        const v = (alive(k) ? Number(data.s[k] || 0) : 0) + (name.toUpperCase() === 'INCRBY' ? Number(a[1]) : 1);
        data.s[k] = String(v);
        save();
        return v;
      }
      case 'EXPIRE':
        if (!exists(k)) return 0;
        data.x[k] = Date.now() + Number(a[1]) * 1000;
        save();
        return 1;
      case 'HGET':
        return alive(k) ? (data.h[k]?.[a[1]] ?? null) : null;
      case 'HMGET':
        return a.slice(1).map((f) => (alive(k) ? (data.h[k]?.[f] ?? null) : null));
      case 'HSET':
        alive(k);
        data.h[k] ||= {};
        for (let i = 1; i < a.length; i += 2) data.h[k][a[i]] = a[i + 1];
        save();
        return 1;
      case 'HDEL': {
        let n = 0;
        for (const f of a.slice(1)) if (data.h[k] && f in data.h[k]) (delete data.h[k][f], n++);
        if (data.h[k] && !Object.keys(data.h[k]).length) delete data.h[k];
        save();
        return n;
      }
      case 'HGETALL':
        return alive(k) ? Object.entries(data.h[k] || {}).flat() : [];
      case 'HLEN':
        return alive(k) ? Object.keys(data.h[k] || {}).length : 0;
      case 'LPUSH':
        alive(k);
        data.l[k] = [...a.slice(1).reverse(), ...(data.l[k] || [])];
        save();
        return data.l[k].length;
      case 'LTRIM':
        if (data.l[k]) data.l[k] = range(data.l[k], Number(a[1]), Number(a[2]));
        save();
        return 'OK';
      case 'LRANGE':
        return alive(k) ? range(data.l[k] || [], Number(a[1]), Number(a[2])) : [];
      default:
        throw new Error(`File store: ${name} is not supported`);
    }
  };
  return {
    async run(cmd) {
      return run(cmd);
    },
    async pipeline(cmds) {
      return cmds.map(run);
    },
  };
}

/* ── which one ── */

type StoreState = { backend: Backend; kind: 'redis' | 'file'; ephemeral: boolean; where: string };
const g = globalThis as unknown as { __brewnsStore?: StoreState; __brewnsLocks?: Map<string, Promise<unknown>> };

function state(): StoreState {
  if (g.__brewnsStore) return g.__brewnsStore;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) g.__brewnsStore = { backend: upstash(url, token), kind: 'redis', ephemeral: false, where: new URL(url).host };
  else {
    const hosted = !!process.env.VERCEL;
    const file = process.env.BREWNS_DATA_FILE || (hosted ? '/tmp/brewns-data.json' : path.join(process.cwd(), '.data', 'brewns.json'));
    g.__brewnsStore = { backend: fileBackend(file), kind: 'file', ephemeral: hosted, where: file };
  }
  return g.__brewnsStore;
}

export const storeInfo = () => {
  const { kind, ephemeral, where } = state();
  return { kind, ephemeral, where };
};

const P = 'brewns:';
const k = (key: string) => P + key;
const run = (...cmd: Cmd) => state().backend.run(cmd);
const pairs = (flat: unknown) => {
  const out: Record<string, string> = {};
  const a = (flat as string[]) || [];
  for (let i = 0; i < a.length; i += 2) out[a[i]] = a[i + 1];
  return out;
};
const parse = <T>(v: unknown): T | null => {
  if (v === null || v === undefined) return null;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return null;
  }
};

export const kv = {
  get: async <T>(key: string) => parse<T>(await run('GET', k(key))),
  set: async (key: string, value: unknown, opts: { ttlSec?: number; nx?: boolean } = {}) => {
    const cmd: Cmd = ['SET', k(key), JSON.stringify(value)];
    if (opts.nx) cmd.push('NX');
    if (opts.ttlSec) cmd.push('EX', opts.ttlSec);
    return (await run(...cmd)) === 'OK';
  },
  del: (...keys: string[]) => run('DEL', ...keys.map(k)),
  incr: async (key: string, ttlSec?: number) => {
    const n = Number(await run('INCR', k(key)));
    if (ttlSec && n === 1) await run('EXPIRE', k(key), ttlSec);
    return n;
  },
  num: async (key: string) => Number(await run('GET', k(key))) || 0,
  hget: async <T>(key: string, field: string | number) => parse<T>(await run('HGET', k(key), field)),
  hset: (key: string, field: string | number, value: unknown) => run('HSET', k(key), field, JSON.stringify(value)),
  hdel: (key: string, ...fields: (string | number)[]) => (fields.length ? run('HDEL', k(key), ...fields) : Promise.resolve(0)),
  /** Many fields in one command (chunked so no request gets huge). */
  hsetMany: async (key: string, entries: [string | number, unknown][]) => {
    for (let i = 0; i < entries.length; i += 200) {
      const chunk = entries.slice(i, i + 200);
      if (chunk.length) await run('HSET', k(key), ...chunk.flatMap(([f, v]) => [f, JSON.stringify(v)]));
    }
  },
  hall: async <T>(key: string) => {
    const raw = pairs(await run('HGETALL', k(key)));
    const out: Record<string, T> = {};
    for (const [f, v] of Object.entries(raw)) {
      const val = parse<T>(v);
      if (val !== null) out[f] = val;
    }
    return out;
  },
  /** HGETALL across several hashes in one round trip. */
  hallMany: async <T>(keys: string[]) => {
    const res = await state().backend.pipeline(keys.map((key) => ['HGETALL', k(key)]));
    return res.map((flat) => Object.values(pairs(flat)).map((v) => parse<T>(v)).filter((v): v is T => v !== null));
  },
  push: async (key: string, value: unknown, keep: number) => {
    await state().backend.pipeline([
      ['LPUSH', k(key), JSON.stringify(value)],
      ['LTRIM', k(key), 0, keep - 1],
    ]);
  },
  list: async <T>(key: string, start = 0, stop = -1) => ((await run('LRANGE', k(key), start, stop)) as string[]).map((v) => parse<T>(v)).filter((v): v is T => v !== null),
};

/**
 * Runs `fn` while holding a short lock on `name`, so two people changing the
 * same order at once (the barista and the chef bumping their tickets) can't
 * overwrite each other. Redis: SET NX with a 5 s expiry. File: one process, so
 * a queue per name is enough.
 */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const s = state();
  if (s.kind === 'file') {
    g.__brewnsLocks ||= new Map();
    const prev = g.__brewnsLocks.get(name) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    g.__brewnsLocks.set(name, next);
    try {
      return await next;
    } finally {
      if (g.__brewnsLocks.get(name) === next) g.__brewnsLocks.delete(name);
    }
  }
  const token = randomBytes(8).toString('hex');
  const key = k(`lock:${name}`);
  for (let i = 0; ; i++) {
    if ((await s.backend.run(['SET', key, token, 'NX', 'PX', 5000])) === 'OK') break;
    if (i > 60) throw new Error('Busy, try again');
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
  }
  try {
    return await fn();
  } finally {
    if ((await s.backend.run(['GET', key])) === token) await s.backend.run(['DEL', key]);
  }
}
