// Tool execution sandbox.
//
// Two modes (selected via MYTHONOS_SANDBOX env):
//
//   inline  → run commands directly inside the engine container with a
//             fixed working directory and a hard timeout. Simplest setup;
//             relies on the container itself being the security boundary.
//
//   docker  → spawn a one-shot disposable docker container per command.
//             Requires the engine container to mount /var/run/docker.sock.
//             Slower, but isolates target binaries from the engine.
//
// Both modes refuse absolute paths and `..` escapes — every path the
// agent provides is resolved inside the scan's workdir.

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const TARGETS_DIR = process.env.MYTHONOS_TARGETS_DIR || path.resolve('./targets');
const MODE = (process.env.MYTHONOS_SANDBOX || 'inline').toLowerCase();
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 64 * 1024; // truncate huge tool outputs

export function workdirFor(scanId) {
  return path.join(TARGETS_DIR, scanId);
}

export async function ensureWorkdir(scanId) {
  const dir = workdirFor(scanId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function safeJoin(scanId, relPath) {
  if (!relPath) return workdirFor(scanId);
  if (path.isAbsolute(relPath)) {
    throw new Error(`Absolute paths are not allowed: ${relPath}`);
  }
  const root = workdirFor(scanId);
  const resolved = path.resolve(root, relPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path escapes the scan workdir: ${relPath}`);
  }
  return resolved;
}

function truncate(buf) {
  if (buf.length <= MAX_OUTPUT_BYTES) return buf.toString('utf8');
  return (
    buf.slice(0, MAX_OUTPUT_BYTES).toString('utf8') +
    `\n\n[... truncated ${buf.length - MAX_OUTPUT_BYTES} bytes ...]`
  );
}

function runProcess(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, PATH: process.env.PATH },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const out = [];
    const err = [];
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch {}
    }, opts.timeout || DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        timedOut: killed,
        stdout: truncate(Buffer.concat(out)),
        stderr: truncate(Buffer.concat(err)),
      });
    });

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        timedOut: false,
        stdout: '',
        stderr: `spawn error: ${e.message}`,
      });
    });
  });
}

export async function execShell(scanId, command, { timeoutMs } = {}) {
  await ensureWorkdir(scanId);
  const cwd = workdirFor(scanId);

  // We always invoke through `bash -lc` so the agent can use pipes,
  // redirects, and shell builtins — but only inside the scan workdir.
  if (MODE === 'docker') {
    return runProcess(
      'docker',
      [
        'run', '--rm',
        '--network', 'none',
        '--memory', '512m', '--cpus', '1',
        '-v', `${cwd}:/work`,
        '-w', '/work',
        'mythonos-sandbox:latest',
        'bash', '-lc', command,
      ],
      { cwd, timeout: timeoutMs }
    );
  }

  return runProcess('bash', ['-lc', command], { cwd, timeout: timeoutMs });
}
