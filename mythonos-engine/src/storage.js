// File-backed storage for scans, findings, and event logs.
//
// JSON-on-disk is intentionally simple — Mythonos is a research engine,
// not a transactional system. If volume grows, swap the read/write
// helpers for postgres/redis without touching agent or API code.

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

const DATA_DIR = process.env.MYTHONOS_DATA_DIR || path.resolve('./data');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');
const FINDINGS_FILE = path.join(DATA_DIR, 'findings.json');
const EVENTS_DIR = path.join(DATA_DIR, 'events');

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(EVENTS_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function writeJson(file, data) {
  await ensureDirs();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

// ── Scans ──
export async function listScans() {
  return readJson(SCANS_FILE, []);
}

export async function getScan(id) {
  const scans = await listScans();
  return scans.find((s) => s.id === id) || null;
}

export async function createScan(input) {
  const scans = await listScans();
  const scan = {
    id: uuid(),
    name: input.name || 'Untitled engagement',
    // target: { type: 'web'|'api'|'network', url?, hosts?[] }
    target: input.target,
    // engagement: scope, auth, intensity, authorization confirmation, etc.
    // (everything the operator filled in via the New Scan form)
    engagement: input.engagement || {
      authorized: false,
      intensity: 'active',
      inScope: '',
      outOfScope: '',
      auth: null,
      technologies: '',
      notes: '',
      client: '',
    },
    objective: input.objective || 'Find exploitable vulnerabilities and produce validated PoCs.',
    model: input.model,
    status: 'queued',                      // queued | running | completed | failed | stopped
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    iterations: 0,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    findingsCount: 0,
    error: null,
  };
  scans.unshift(scan);
  await writeJson(SCANS_FILE, scans);
  return scan;
}

export async function updateScan(id, patch) {
  const scans = await listScans();
  const idx = scans.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  scans[idx] = { ...scans[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeJson(SCANS_FILE, scans);
  return scans[idx];
}

// ── Findings ──
export async function listFindings(scanId = null) {
  const all = await readJson(FINDINGS_FILE, []);
  return scanId ? all.filter((f) => f.scanId === scanId) : all;
}

export async function addFinding(scanId, finding) {
  const all = await readJson(FINDINGS_FILE, []);
  const record = {
    id: uuid(),
    scanId,
    title: finding.title || 'Untitled finding',
    severity: finding.severity || 'medium',  // info | low | medium | high | critical
    cwe: finding.cwe || null,
    location: finding.location || null,
    description: finding.description || '',
    reproduction: finding.reproduction || '',
    poc: finding.poc || '',
    confidence: finding.confidence || 'medium',
    createdAt: new Date().toISOString(),
  };
  all.unshift(record);
  await writeJson(FINDINGS_FILE, all);

  const scan = await getScan(scanId);
  if (scan) await updateScan(scanId, { findingsCount: (scan.findingsCount || 0) + 1 });

  return record;
}

// ── Events (per-scan agent transcript) ──
function eventsFile(scanId) {
  return path.join(EVENTS_DIR, `${scanId}.jsonl`);
}

export async function appendEvent(scanId, event) {
  await ensureDirs();
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
  await fs.appendFile(eventsFile(scanId), line);
}

export async function readEvents(scanId, { limit = 500 } = {}) {
  try {
    const raw = await fs.readFile(eventsFile(scanId), 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const slice = lines.slice(-limit);
    return slice.map((l) => {
      try { return JSON.parse(l); } catch { return { ts: null, type: 'parse_error', raw: l }; }
    });
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}
