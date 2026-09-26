import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

let shuttingDown = false;

function startServer() {
  if (shuttingDown) return;

  console.log('[Supervisor] Spawning Next.js on port 3001...');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', '3001'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => process.stdout.write(d));
  child.stderr.on('data', (d) => process.stderr.write(`[Next.js STDERR] ${d}`));

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`[Supervisor] Next.js exited (code: ${code}, signal: ${signal}). Auto-restarting in 1s...`);
    setTimeout(startServer, 1000);
  });

  child.on('error', (err) => {
    console.error('[Supervisor] Spawn error:', err);
    if (!shuttingDown) setTimeout(startServer, 2000);
  });
}

process.on('SIGINT', () => {
  shuttingDown = true;
  process.exit(0);
});

process.on('SIGTERM', () => {
  shuttingDown = true;
  process.exit(0);
});

startServer();
