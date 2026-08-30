# Wiring Campus to Hermes agents on the Mac mini

This file is intentionally explicit about the security boundary and current capabilities.

## Current v1 truth

Hermes Agent Campus is a static, RoomSpec-driven visual client. It does not currently connect to the Hermes gateway database, session store, profile credentials, or cron scheduler.

- Agent presence, usage, and current/last work are RoomSpec values.
- JOB WALL jobs are RoomSpec values scoped by `jobs_wall.job_scope`.
- The work/downtime button is a visual demo and does not command a real agent.
- The browser never receives Hermes tokens, prompts, sessions, memory, `.env`, or `auth.json`.

Do not represent v1 as live command-and-control until a reviewed local adapter is implemented.

## Safe manual wiring available now

A bot installing Campus on the Mac mini may synchronize sanitized public-operational metadata into `rooms/*.json`.

### 1. Verify Hermes locally

Run on the Mac mini:

```bash
hermes doctor
hermes status --all
hermes profile list
hermes cron list --all
```

Do not print or copy `~/.hermes/.env`, profile `.env` files, `auth.json`, provider credentials, session transcripts, memories, prompts, or tool output into Campus.

### 2. Map profiles to rooms

Edit only the matching `rooms/<room>.json`:

- `agents[].handle` — profile/agent handle approved for that room
- `agents[].role` — sanitized durable role
- `agents[].team_member` — whether the handle actually belongs to that project team
- `agents[].state` — `working`, `idle`, or `away`
- `agents[].current_work` and `last_work` — generic operational summaries only
- `jobs_wall.job_scope` — explicit allowed owner handles
- `jobs_wall.jobs[]` — sanitized job name, owner, schedule, last/next summary, enabled state

TSH rules:

- No client names, conditions tied to identifiable people, health notes, appointment details, phone numbers, email addresses, or other PHI.
- Generic souls such as `general-assistant` may appear but must keep `team_member: false`.

Midas rules:

- No wallet addresses, keys, seed/recovery material, broker credentials, account values, order payloads, or execution claims.
- Keep paper-only language unless a separately reviewed broker adapter exists.

### 3. Validate before serving

```bash
npm run validate
npm test
npm run build
npm run test:e2e
```

A failed privacy or schema test is a hard stop. Do not weaken the test to admit private data.

## Contract for a future live read-only adapter

Implement the adapter on the Mac mini, not in the public browser bundle.

The adapter may expose only a sanitized response such as:

```json
{
  "schema_version": "1.0.0",
  "room_id": "home",
  "generated_at": "ISO-8601 timestamp",
  "agents": [
    {
      "handle": "general-assistant",
      "state": "working",
      "current_work": "Sanitized short summary",
      "last_work": "Sanitized short summary",
      "usage": "low | moderate | high"
    }
  ],
  "jobs": [
    {
      "name": "sanitized-job-name",
      "owner": "general-assistant",
      "schedule": "sanitized schedule",
      "enabled": true,
      "last_run": "success | failed | never",
      "next_run": "sanitized relative time"
    }
  ]
}
```

Required controls:

1. Bind the data collector to `127.0.0.1` by default.
2. Use an allowlist derived from the active RoomSpec's agent handles and `jobs_wall.job_scope`.
3. Drop unknown global profiles and jobs rather than merging them.
4. Convert token usage to coarse bands; do not expose raw prompts or tool arguments.
5. Strip absolute paths, credentials, secrets, PHI, wallet material, identifiers, and unrelated memory.
6. Keep browser access read-only.
7. If the browser is remote, put the static UI and adapter behind the same authenticated Tailscale-only reverse proxy. Never expose an unauthenticated adapter on `0.0.0.0`.
8. Log only room id, counts, status, and timestamps—never payload contents.
9. Add adapter unit tests, cross-room leakage tests, browser tests, and a fail-closed error state before calling the wiring live.

## Write/control adapter is out of scope for v1

A future control adapter that starts jobs, sends prompts, or changes agent state requires a separate design and approval gate. At minimum it needs:

- authenticated requests;
- CSRF protection;
- per-action authorization;
- explicit confirmation for consequential actions;
- rate limiting and replay protection;
- audit logging;
- no browser access to Hermes credentials;
- Tailscale/private-network restriction;
- a read-back verification after every state change.

Until that exists, Campus controls are visual only.

## Recommended deployment topology

```text
MacBook Air browser
        │
        │ trusted LAN or Tailscale
        ▼
Mac mini :4173 — static Campus UI
        │
        ├── rooms/*.json (sanitized v1 data)
        │
        └── future localhost-only read adapter
                 │
                 └── allowlisted Hermes profile/cron metadata
```

This keeps Hermes credentials and private state on the Mac mini while allowing the MacBook Air to view and navigate Campus reliably.
