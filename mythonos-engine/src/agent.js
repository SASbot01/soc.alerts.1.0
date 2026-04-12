// Mythonos agent loop.
//
// Implements the Anthropic tool-use loop:
//   1. Send messages + tool schemas
//   2. If response is tool_use → execute tool(s), append tool_result, loop
//   3. If response is end_turn → loop ends
//   4. Hard cap iterations to MYTHONOS_MAX_ITERATIONS
//
// The model id is read from getActiveModel() so swapping to Mythos when it
// ships is purely a config change.

import Anthropic from '@anthropic-ai/sdk';
import { getActiveModel } from './models.js';
import { toolSchemas, findTool } from './tools.js';
import { updateScan, appendEvent } from './storage.js';

const SYSTEM_PROMPT = `You are Mythonos, an autonomous AI pentester operating inside the BlackWolf SOC. You work side-by-side with the human pentest team on AUTHORIZED engagements only.

Your job: given a target (web app, API, or network host) and a written scope, run a real pentest workflow and produce validated findings the human team can verify and weaponize.

## Authorization & scope

Every engagement carries explicit authorization from the asset owner. You will see the scope, out-of-scope items, and credentials in the user message. **Never test anything outside the declared scope.** If a tool result reveals an in-scope finding pivots to an out-of-scope asset, stop and note it instead of probing further.

## Workflow (OWASP-style)

1. **Recon & fingerprint** — DNS, whois, whatweb, headers, robots.txt, sitemap, technologies, frameworks, versions. Map endpoints and parameters.
2. **Active enumeration** — nmap (services/versions), gobuster/ffuf (directory & vhost discovery), nuclei templates against the scope.
3. **Vulnerability identification** — for each surface, look at OWASP Top 10:
   - A01 Broken Access Control (IDOR, missing authz, path traversal)
   - A02 Cryptographic Failures (TLS misconfig, weak ciphers, plaintext secrets)
   - A03 Injection (SQLi, NoSQLi, command injection, SSTI, XSS)
   - A04 Insecure Design
   - A05 Security Misconfiguration (default creds, exposed admin, verbose errors)
   - A06 Vulnerable Components (CVE matching against fingerprinted versions)
   - A07 Identification & Authentication Failures (weak password policy, JWT issues, session fixation)
   - A08 Software & Data Integrity (unsigned updates, deserialization)
   - A09 Logging & Monitoring
   - A10 SSRF
   Plus business logic flaws, race conditions, and CSRF.
4. **Validate** — never report from a scanner pattern alone. Reproduce manually with curl/python. Show the exact request and the exact response that proves the bug.
5. **Report** — call report_finding with title, severity, CWE, OWASP category in description, exact location (URL + parameter or host:port), step-by-step repro, and a working PoC payload/curl command.
6. **Iterate** — exhaust productive surfaces, then call finish_scan with a summary the human team can act on.

## Tool use

You operate inside a sandboxed Linux container with these binaries installed:

| Category | Tools |
|---|---|
| HTTP probe | curl, wget, openssl s_client |
| DNS / network | dig, host, nslookup, ping, nmap |
| Fingerprint | whatweb, nmap -sV |
| Web scan | nikto, nuclei (with templates) |
| Fuzzing | ffuf, gobuster, wfuzz, dirb |
| Injection | sqlmap (use --batch and conservative flags) |
| Brute force | hydra (use only with explicit auth in scope) |
| Scripting | python3, jq, ripgrep |

Call these via run_shell. Prefer surgical commands over kitchen-sink scans. Set sensible timeouts. Save large outputs to files in the workdir for later reading.

## Intensity levels

Each engagement specifies an intensity. Respect it strictly:

- **passive**: only OSINT, header inspection, whatweb, DNS lookups, TLS inspection. NO active scanning, NO fuzzing, NO exploitation. The target should not see traffic that looks like an attack.
- **active**: standard pentest. nmap service scan, nikto, gobuster, nuclei, manual probing. Default unless told otherwise.
- **aggressive**: includes sqlmap exploitation, brute force (hydra) against in-scope auth, full enumeration. Only when the engagement says aggressive.

## Reporting rules

- Severity: info < low < medium < high < critical. "critical" = remote unauthenticated RCE, full DB exfil, full auth bypass, or similar.
- Confidence: "high" = working PoC reproduced. "medium" = strong evidence (e.g. version match against known CVE plus reachable endpoint). "low" = scanner finding not yet validated — try to validate before reporting low.
- Always include the exact request (curl command) and the diagnostic response in the PoC field.
- Description must explain the impact in business terms, not just technical.

## Hard rules

- Stay inside the declared scope. Re-read the user message if uncertain.
- Respect the intensity setting.
- Never run destructive payloads (DROP TABLE, rm -rf, fork bombs). Use read-only proofs.
- If a tool errors, read the error and adapt — don't repeat the same failing call.
- Be concise in reasoning text. Spend tokens on tool calls that move the engagement forward.
- When iteration budget runs low, wrap up and call finish_scan.`;

function buildUserMessage(scan) {
  const e = scan.engagement || {};
  const t = scan.target || {};

  // Pretty-print whatever the operator filled in. Missing fields are
  // skipped so the model isn't told to test things the human didn't authorize.
  const lines = [];
  lines.push(`# Engagement ${scan.id}`);
  lines.push('');
  lines.push(`**Name:** ${scan.name}`);
  if (e.client) lines.push(`**Client:** ${e.client}`);
  lines.push(`**Type:** ${t.type || 'web'}`);
  lines.push(`**Intensity:** ${e.intensity || 'active'}`);
  lines.push('');

  lines.push('## Authorization');
  lines.push(
    e.authorized
      ? '✅ The operator confirmed written authorization from the asset owner. You are cleared to proceed within scope.'
      : '⚠️ Authorization NOT confirmed. Refuse to run any active or aggressive tooling. Limit yourself to passive OSINT and immediately call finish_scan with a note that authorization was missing.'
  );
  lines.push('');

  lines.push('## Target');
  if (t.url) lines.push(`- Primary URL: ${t.url}`);
  if (t.hosts && t.hosts.length) {
    lines.push(`- Additional hosts/IPs:`);
    for (const h of t.hosts) lines.push(`  - ${h}`);
  }
  lines.push('');

  lines.push('## Scope');
  lines.push('**In scope:**');
  lines.push(e.inScope || '(not specified — treat the primary URL/host as the only in-scope target)');
  lines.push('');
  lines.push('**Out of scope:**');
  lines.push(e.outOfScope || '(none specified — assume anything not explicitly listed in scope is OUT)');
  lines.push('');

  if (e.auth && (e.auth.username || e.auth.cookie || e.auth.token || e.auth.loginUrl)) {
    lines.push('## Authentication');
    if (e.auth.loginUrl) lines.push(`- Login URL: ${e.auth.loginUrl}`);
    if (e.auth.username) lines.push(`- Username: ${e.auth.username}`);
    if (e.auth.password) lines.push(`- Password: ${e.auth.password}`);
    if (e.auth.cookie)   lines.push(`- Session cookie: ${e.auth.cookie}`);
    if (e.auth.token)    lines.push(`- Bearer token: ${e.auth.token}`);
    lines.push('');
  }

  if (e.technologies) {
    lines.push('## Known technologies');
    lines.push(e.technologies);
    lines.push('');
  }

  if (e.notes) {
    lines.push('## Operator notes');
    lines.push(e.notes);
    lines.push('');
  }

  lines.push('## Objective');
  lines.push(scan.objective || 'Find exploitable vulnerabilities and produce validated PoCs.');
  lines.push('');

  lines.push('Begin the engagement. Start with passive recon, then progress through the workflow according to the intensity level.');

  return lines.join('\n');
}

function accumulateUsage(prev, usage) {
  if (!usage) return prev;
  return {
    inputTokens: (prev.inputTokens || 0) + (usage.input_tokens || 0),
    outputTokens: (prev.outputTokens || 0) + (usage.output_tokens || 0),
    cacheReadTokens: (prev.cacheReadTokens || 0) + (usage.cache_read_input_tokens || 0),
    cacheCreationTokens:
      (prev.cacheCreationTokens || 0) + (usage.cache_creation_input_tokens || 0),
  };
}

export async function runAgent(scan) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey });
  const model = getActiveModel();
  const maxIter = parseInt(process.env.MYTHONOS_MAX_ITERATIONS || '40', 10);
  const useCache = (process.env.MYTHONOS_PROMPT_CACHE || 'true') === 'true';

  await updateScan(scan.id, { status: 'running', model: model.id });
  await appendEvent(scan.id, { type: 'agent_start', model: model.id, label: model.label });

  const tools = toolSchemas();
  const messages = [{ role: 'user', content: buildUserMessage(scan) }];

  let iterations = 0;
  let usage = scan.usage || {};
  let summary = null;

  try {
    while (iterations < maxIter) {
      iterations++;

      const systemBlocks = useCache
        ? [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]
        : SYSTEM_PROMPT;

      const response = await client.messages.create({
        model: model.id,
        max_tokens: Math.min(model.maxOutputTokens || 8192, 8192),
        system: systemBlocks,
        tools,
        messages,
      });

      usage = accumulateUsage(usage, response.usage);
      await updateScan(scan.id, { iterations, usage });

      // Capture any plain text the model produced this turn for the UI transcript.
      const textBlocks = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      if (textBlocks.trim()) {
        await appendEvent(scan.id, { type: 'agent_text', iteration: iterations, text: textBlocks });
      }

      const toolUses = response.content.filter((b) => b.type === 'tool_use');

      if (response.stop_reason === 'end_turn' && toolUses.length === 0) {
        await appendEvent(scan.id, { type: 'end_turn', iteration: iterations });
        break;
      }

      if (toolUses.length === 0) {
        await appendEvent(scan.id, {
          type: 'no_tool_calls',
          iteration: iterations,
          stop_reason: response.stop_reason,
        });
        break;
      }

      // Always append the assistant response (with tool_use blocks) before tool_result.
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const tu of toolUses) {
        await appendEvent(scan.id, {
          type: 'tool_use',
          iteration: iterations,
          name: tu.name,
          input: tu.input,
        });

        const tool = findTool(tu.name);
        let resultText;
        let isError = false;
        if (!tool) {
          resultText = `Unknown tool: ${tu.name}`;
          isError = true;
        } else {
          try {
            resultText = await tool.run(scan.id, tu.input || {});
          } catch (e) {
            resultText = `Error: ${e.message}`;
            isError = true;
          }
        }

        await appendEvent(scan.id, {
          type: 'tool_result',
          iteration: iterations,
          name: tu.name,
          isError,
          preview: String(resultText).slice(0, 1000),
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: String(resultText),
          is_error: isError,
        });

        if (tu.name === 'finish_scan') {
          summary = tu.input?.summary || '(no summary provided)';
        }
      }

      messages.push({ role: 'user', content: toolResults });

      if (summary) break;
    }

    const finalStatus = iterations >= maxIter && !summary ? 'completed' : 'completed';
    await updateScan(scan.id, {
      status: finalStatus,
      iterations,
      usage,
      summary: summary || `Stopped after ${iterations} iterations.`,
    });
    await appendEvent(scan.id, { type: 'agent_done', iterations, summary });
    return { iterations, usage, summary };
  } catch (e) {
    await updateScan(scan.id, {
      status: 'failed',
      error: e.message,
      iterations,
      usage,
    });
    await appendEvent(scan.id, { type: 'agent_error', error: e.message, stack: e.stack });
    throw e;
  }
}
