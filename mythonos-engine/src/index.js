// Mythonos Engine HTTP API.
//
// Routes (all under /mythonos-api):
//   GET  /health
//   GET  /models
//   GET  /scans
//   POST /scans                 — { name, target, objective, model? }
//   GET  /scans/:id
//   GET  /scans/:id/events?limit=
//   GET  /scans/:id/findings
//   POST /scans/:id/stop
//   GET  /findings
//
// Auth: bearer token in Authorization header, must equal MYTHONOS_AUTH_TOKEN.
// The SOC backend or nginx proxy is responsible for upstream auth.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { listModels, getActiveModel, getActiveModelId } from './models.js';
import {
  listScans, getScan, createScan, updateScan,
  listFindings, readEvents,
} from './storage.js';
import { runAgent } from './agent.js';
import { ensureWorkdir } from './tools.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Auth middleware ──
const AUTH_TOKEN = process.env.MYTHONOS_AUTH_TOKEN || '';
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (!AUTH_TOKEN) return next();           // dev mode: no token configured
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : h;
  if (tok !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// ── In-memory job tracker so /stop can signal ──
const ACTIVE = new Map(); // scanId → { abort: () => void }

// ── Routes ──
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mythonos-engine',
    version: '0.1.0',
    activeModel: getActiveModelId(),
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
  });
});

app.get('/models', (_req, res) => {
  res.json({
    active: getActiveModelId(),
    models: listModels(),
  });
});

app.get('/scans', async (_req, res) => {
  res.json(await listScans());
});

app.get('/scans/:id', async (req, res) => {
  const scan = await getScan(req.params.id);
  if (!scan) return res.status(404).json({ error: 'not found' });
  res.json(scan);
});

app.get('/scans/:id/events', async (req, res) => {
  const limit = parseInt(req.query.limit || '500', 10);
  res.json(await readEvents(req.params.id, { limit }));
});

app.get('/scans/:id/findings', async (req, res) => {
  res.json(await listFindings(req.params.id));
});

app.get('/findings', async (_req, res) => {
  res.json(await listFindings());
});

app.post('/scans', async (req, res) => {
  const { name, target, engagement, objective, model } = req.body || {};
  if (!target || !target.type) {
    return res.status(400).json({ error: 'target.type is required (web|api|network)' });
  }
  if (!target.url && !(target.hosts && target.hosts.length)) {
    return res.status(400).json({ error: 'target.url or target.hosts[] is required' });
  }
  if (!engagement?.authorized) {
    return res.status(400).json({
      error: 'engagement.authorized must be true — written authorization from the asset owner is mandatory',
    });
  }
  const validIntensity = ['passive', 'active', 'aggressive'];
  if (engagement.intensity && !validIntensity.includes(engagement.intensity)) {
    return res.status(400).json({ error: `engagement.intensity must be one of ${validIntensity.join('|')}` });
  }

  const activeModel = model ? { id: model } : getActiveModel();
  const scan = await createScan({ name, target, engagement, objective, model: activeModel.id });
  await ensureWorkdir(scan.id);

  // Fire and forget — runAgent updates storage as it progresses.
  ACTIVE.set(scan.id, {});
  runAgent(scan)
    .catch((e) => console.error(`[scan ${scan.id}] agent error:`, e))
    .finally(() => ACTIVE.delete(scan.id));

  res.status(202).json(scan);
});

app.post('/scans/:id/stop', async (req, res) => {
  // Cooperative stop: we mark the scan stopped; the next loop iteration
  // checking storage status would honor it. (For v0.1 we just mark it.)
  const scan = await getScan(req.params.id);
  if (!scan) return res.status(404).json({ error: 'not found' });
  if (scan.status === 'running' || scan.status === 'queued') {
    await updateScan(req.params.id, { status: 'stopped' });
  }
  ACTIVE.delete(req.params.id);
  res.json({ ok: true });
});

// ── Boot ──
const PORT = parseInt(process.env.PORT || '3900', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  const m = getActiveModel();
  console.log(`[mythonos-engine] listening on http://${HOST}:${PORT}`);
  console.log(`[mythonos-engine] active model: ${m.label} (${m.id})`);
  if (m._warning) console.log(`[mythonos-engine] WARNING: ${m._warning}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[mythonos-engine] WARNING: ANTHROPIC_API_KEY not set — scans will fail');
  }
});
