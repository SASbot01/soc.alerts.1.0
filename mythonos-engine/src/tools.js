// Tool definitions exposed to the model.
//
// Each tool has:
//   - schema: JSONSchema sent to Anthropic with input_schema
//   - run(scanId, input): executes the tool, returns a string the model sees
//
// Adding a tool: register it in TOOLS, the loop will pick it up automatically.

import fs from 'fs/promises';
import path from 'path';
import { execShell, safeJoin, ensureWorkdir, workdirFor } from './sandbox.js';
import { addFinding } from './storage.js';

const MAX_FILE_BYTES = 256 * 1024;

async function listDir(scanId, relPath = '.') {
  const dir = safeJoin(scanId, relPath);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .map((e) => `${e.isDirectory() ? 'd' : '-'} ${e.name}`)
    .join('\n') || '(empty)';
}

async function readFile(scanId, relPath) {
  const file = safeJoin(scanId, relPath);
  const stat = await fs.stat(file);
  if (stat.size > MAX_FILE_BYTES) {
    const fd = await fs.open(file, 'r');
    const buf = Buffer.alloc(MAX_FILE_BYTES);
    await fd.read(buf, 0, MAX_FILE_BYTES, 0);
    await fd.close();
    return buf.toString('utf8') + `\n\n[... truncated, file is ${stat.size} bytes ...]`;
  }
  return fs.readFile(file, 'utf8');
}

async function writeFile(scanId, relPath, content) {
  const file = safeJoin(scanId, relPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
  return `wrote ${content.length} bytes to ${relPath}`;
}

export const TOOLS = [
  {
    name: 'list_dir',
    description:
      'List the contents of a directory inside the scan workdir. Use a relative path; "." means the workdir root.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the scan workdir' },
      },
      required: ['path'],
    },
    async run(scanId, input) {
      return listDir(scanId, input.path || '.');
    },
  },

  {
    name: 'read_file',
    description:
      'Read a UTF-8 text file from the scan workdir. Files larger than 256KB are truncated. Use list_dir first to discover paths.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the scan workdir' },
      },
      required: ['path'],
    },
    async run(scanId, input) {
      return readFile(scanId, input.path);
    },
  },

  {
    name: 'write_file',
    description:
      'Write a file inside the scan workdir. Use this to drop PoC scripts, fuzz harnesses, or notes the next iteration will need.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside the scan workdir' },
        content: { type: 'string', description: 'File contents (UTF-8)' },
      },
      required: ['path', 'content'],
    },
    async run(scanId, input) {
      return writeFile(scanId, input.path, input.content);
    },
  },

  {
    name: 'run_shell',
    description:
      'Execute a bash command inside the sandboxed scan workdir. Useful for grep, find, semgrep, gdb, valgrind, AFL++, file, strings, objdump, python, node, etc. Stdout+stderr are returned (truncated to 64KB). Default timeout is 60s.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run (passed to `bash -lc`)' },
        timeout_ms: {
          type: 'number',
          description: 'Optional timeout in milliseconds, max 300000',
        },
      },
      required: ['command'],
    },
    async run(scanId, input) {
      const timeoutMs = Math.min(input.timeout_ms || 60_000, 300_000);
      const r = await execShell(scanId, input.command, { timeoutMs });
      return [
        `exit=${r.exitCode}${r.timedOut ? ' (TIMED OUT)' : ''}`,
        '── stdout ──',
        r.stdout || '(empty)',
        '── stderr ──',
        r.stderr || '(empty)',
      ].join('\n');
    },
  },

  {
    name: 'report_finding',
    description:
      'Record a vulnerability you have validated. Only call this once you have CONFIRMED the issue (ideally with a working PoC). Severity must be one of info|low|medium|high|critical. Confidence must be one of low|medium|high.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        cwe: { type: 'string', description: 'Optional CWE id, e.g. CWE-787' },
        location: {
          type: 'string',
          description: 'file:line or function name where the bug lives',
        },
        description: { type: 'string', description: 'Root cause and impact' },
        reproduction: {
          type: 'string',
          description: 'Step-by-step repro instructions',
        },
        poc: {
          type: 'string',
          description: 'Minimal proof-of-concept (script, payload, or command sequence)',
        },
      },
      required: ['title', 'severity', 'description'],
    },
    async run(scanId, input) {
      const finding = await addFinding(scanId, input);
      return `Finding recorded: ${finding.id} (${finding.severity}) — ${finding.title}`;
    },
  },

  {
    name: 'finish_scan',
    description:
      'Call this when the investigation is complete — either you have exhausted productive avenues or you have reported every vulnerability you found. Provide a short summary the human will read.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Final summary of what you found and what you tried' },
      },
      required: ['summary'],
    },
    async run() {
      // Handled by the loop — this just returns a sentinel.
      return '__FINISH__';
    },
  },
];

export function toolSchemas() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

export function findTool(name) {
  return TOOLS.find((t) => t.name === name);
}

// Re-exported so the API layer can prep the workdir before launching a scan.
export { ensureWorkdir, workdirFor };
