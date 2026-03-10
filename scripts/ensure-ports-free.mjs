import { execSync } from 'node:child_process';
import os from 'node:os';

const TARGET_PORTS = [3000, 3001];

const run = (command) => {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

const parseNumericIds = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number(line))
    .filter((value) => Number.isInteger(value) && value > 0);

const getListeningPids = (port) => {
  if (os.platform() === 'win32') {
    const raw = run(`netstat -ano | findstr :${port}`);
    if (!raw) return [];
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const pids = lines
      .filter((line) => line.toUpperCase().includes('LISTENING'))
      .map((line) => line.split(/\s+/).at(-1))
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    return [...new Set(pids)];
  }

  return [...new Set(parseNumericIds(run(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`)))];
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const terminatePid = async (pid) => {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return false;
  }

  for (let i = 0; i < 8; i += 1) {
    try {
      process.kill(pid, 0);
      await wait(75);
    } catch {
      return true;
    }
  }

  try {
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  const pids = new Set();
  for (const port of TARGET_PORTS) {
    for (const pid of getListeningPids(port)) {
      if (pid !== process.pid) {
        pids.add(pid);
      }
    }
  }

  if (pids.size === 0) {
    console.log('[predev] ports 3000/3001 are already free');
    return;
  }

  for (const pid of pids) {
    const ok = await terminatePid(pid);
    console.log(`[predev] ${ok ? 'stopped' : 'failed to stop'} pid ${pid}`);
  }
};

await main();
