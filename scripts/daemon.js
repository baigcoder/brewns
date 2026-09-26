const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const outLog = fs.openSync(path.join(root, 'daemon.log'), 'a');

const child = spawn('cmd.exe', ['/c', 'npx', 'next', 'start', '-p', '3001'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', outLog, outLog],
  windowsHide: true
});

child.unref();
console.log('Daemon spawned with PID:', child.pid);
