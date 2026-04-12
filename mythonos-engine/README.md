# Mythonos Engine

Autonomous AI pentester for the BlackWolf SOC.

Mythonos runs the workflow of a human pentester — recon, enumeration, vulnerability identification, validation and reporting — against authorized web, API and network targets. It uses publicly available frontier models (Claude Opus 4.6 today). The model id is centralized in `src/models.js` and selected via the `MYTHONOS_MODEL` env var — when Anthropic ships Mythos publicly, flip the env var and the engine starts using it. **No code changes anywhere else.**

## Workflow the agent runs

1. **Recon & fingerprint** — DNS, headers, robots.txt, whatweb, technology/version detection
2. **Active enumeration** — nmap services, gobuster/ffuf directory & vhost discovery, nuclei templates
3. **Vulnerability identification** — OWASP Top 10 plus business logic, race conditions, CSRF
4. **Validate** — reproduces every finding manually with curl/python before reporting
5. **Report** findings via `report_finding` (severity, CWE, location, repro, working PoC)
6. **Iterate** until productive surfaces are exhausted, then `finish_scan`

The agent strictly respects the engagement intensity (`passive` / `active` / `aggressive`) and the in/out-of-scope lists declared by the operator. Without explicit `engagement.authorized = true` it refuses to run.

## Tools exposed to the model

| Tool | Purpose |
|---|---|
| `list_dir` | List the scan workdir |
| `read_file` | Read scan artifacts (saved tool output, notes, PoCs) |
| `write_file` | Drop PoC scripts, fuzz harnesses, notes for later iterations |
| `run_shell` | Execute pentest binaries inside the sandbox (curl, nmap, nikto, nuclei, sqlmap, ffuf, gobuster, hydra, dig, openssl, python3, jq, …) |
| `report_finding` | Persist a validated vulnerability |
| `finish_scan` | End the engagement with a summary |

The container ships with the toolchain pre-installed (see `Dockerfile`).

## API

All routes are mounted at the root of the engine (`PORT=3900`). The SOC nginx proxies them under `/mythonos-api/`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | unauth |
| GET | `/models` | active model + registry |
| GET | `/scans` | list all scans |
| POST | `/scans` | create a new engagement (see body below) |
| GET | `/scans/:id` | one scan |
| GET | `/scans/:id/events?limit=` | agent transcript (jsonl tail) |
| GET | `/scans/:id/findings` | findings for a scan |
| POST | `/scans/:id/stop` | cooperative stop |
| GET | `/findings` | all findings across scans |

`POST /scans` body:

```json
{
  "name": "Análisis de acme.com",
  "target": {
    "type": "web",                  // web | api | network
    "url": "https://www.acme.com",
    "hosts": ["api.acme.com", "10.0.0.5"]
  },
  "engagement": {
    "authorized": true,             // REQUIRED — written authorization confirmation
    "client": "ACME Corp",
    "intensity": "active",          // passive | active | aggressive
    "inScope": "*.acme.com",
    "outOfScope": "admin.acme.com",
    "auth": {
      "loginUrl": "https://www.acme.com/login",
      "username": "test",
      "password": "test",
      "cookie": "session=…",
      "token": "Bearer …"
    },
    "technologies": "React, Spring Boot, PostgreSQL",
    "notes": "Focus on the new payments endpoint"
  },
  "objective": "Pentest completo siguiendo OWASP Top 10. Validar cada hallazgo con prueba real.",
  "model": "claude-opus-4-6"
}
```

All routes (except `/health`) require `Authorization: Bearer $MYTHONOS_AUTH_TOKEN`.

## Run locally

```bash
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY
npm install
npm start
```

## Run via docker-compose

The service is already wired into `deploy/docker-compose.yml` as `mythonos-engine`. The SOC nginx proxies `/mythonos-api/` to it.

```bash
cd ../deploy
docker compose up -d --build mythonos-engine frontend
```

Required env in the compose environment:

- `ANTHROPIC_API_KEY=sk-ant-…`
- `MYTHONOS_AUTH_TOKEN=…` (shared with the SOC frontend/proxy)

## Switching to Mythos when Anthropic publishes it

1. Edit `.env` (or the compose env): `MYTHONOS_MODEL=mythos-preview`
2. Update the placeholder id in `src/models.js` if Anthropic uses a different one
3. Restart the engine

That's it. Tools, API, storage, and frontend stay the same.

## Sandbox modes

- `MYTHONOS_SANDBOX=inline` (default): the engine container itself is the boundary. Simple, fast, the right default when the engine is the only thing running.
- `MYTHONOS_SANDBOX=docker`: each `run_shell` call spawns a one-shot disposable container with `--network none`. Use this when you need stronger isolation between target traffic and the engine. Requires mounting `/var/run/docker.sock` into the engine container.
