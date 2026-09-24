/**
 * Start the site fresh: stop any dev server still holding ports 3000–3002
 * (on Windows, Ctrl+C can leave the old one running, and the browser keeps
 * showing old code), clear the build cache, say which commit is running, then
 * start `next dev`.
 *
 *   bun run fresh
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const PORTS = [3000, 3001, 3002];
const win = process.platform === 'win32';
const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

// 1. stop the old server: the one Next recorded in its lock file, any `next
//    dev` started from this folder, and anything else on the dev ports
const pids = new Set();
const lock = path.join(process.cwd(), '.next/dev/lock');
if (existsSync(lock)) {
  try {
    const { pid } = JSON.parse(readFileSync(lock, 'utf8'));
    if (pid) pids.add(String(pid));
  } catch {}
}
const here = process.cwd();
if (win) {
  const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*next*' -and $_.CommandLine -like '*${here.replace(/'/g, "''")}*' -and $_.CommandLine -notlike '*fresh.mjs*' } | ForEach-Object { $_.ProcessId }`;
  for (const pid of sh(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`).split(/\s+/)) if (pid) pids.add(pid);
  for (const line of sh('netstat -ano -p tcp').split(/\r?\n/)) {
    const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
    if (m && PORTS.includes(+m[1]) && +m[2] > 0) pids.add(m[2]);
  }
} else {
  for (const pid of sh(`pgrep -f "${here}/node_modules/.*next"`).split(/\s+/)) if (pid) pids.add(pid);
  for (const port of PORTS) for (const pid of sh(`lsof -ti tcp:${port} -sTCP:LISTEN`).split(/\s+/)) if (pid) pids.add(pid);
}
pids.delete(String(process.pid));
pids.delete(String(process.ppid));
for (const pid of pids) {
  sh(win ? `taskkill /PID ${pid} /T /F` : `kill -9 ${pid}`);
  console.log(`stopped old server (process ${pid})`);
}
if (!pids.size) console.log('no old server running');
else await new Promise((r) => setTimeout(r, 1000)); // let the ports and files go

// 2. clear the build cache
const next = path.join(process.cwd(), '.next');
if (existsSync(next)) {
  rmSync(next, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  console.log('cleared .next');
}

// 3. which code is this
const commit = sh('git log --oneline -1').trim();
console.log(`running: ${commit || 'unknown commit'}\n`);

// 4. start the dev server
const nextBin = path.join(process.cwd(), 'node_modules/next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'dev'], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
