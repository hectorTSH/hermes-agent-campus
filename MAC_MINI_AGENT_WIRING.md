# Wiring Campus to Hermes agents on the Mac mini

This document defines the implemented read-only integration and its security boundary.

## Current truth

Hermes Agent Campus includes a **live, local, read-only adapter**:

```text
browser /api/campus-state?room=<id>
  → Vite middleware (vite.config.mjs)
  → scripts/live_state.py
  → allowlisted profile state.db + cron/jobs.json
  → sanitized room-scoped JSON
```

- Agent presence comes from active turn leases or fresh bounded activity heartbeats—not from whether a profile gateway process is running.
- JOB WALL entries come from every `cron/jobs.json` owned by handles in the active RoomSpec's `jobs_wall.job_scope`.
- The browser can inspect state, but it cannot send prompts, start agents, run jobs, pause jobs, or mutate Hermes.
- Production RoomSpecs fail closed with `away` agents and empty job arrays. If collection fails, Campus does not invent green statuses or fake jobs.
- The browser never receives prompts, messages, tool arguments, absolute paths, tokens, memory, `.env`, `auth.json`, provider credentials, PHI, or wallet material.

## Safe fields exposed

### Agent

- allowlisted handle and optional display name
- room role and station
- `working`, `idle`, `away`, or recent `error`
- configured model name
- coarse activity such as `Live now` or `Connected · idle`
- coarse allowlisted activity such as `Tool running: browser` or `Receiving model response`
- relative last-active summary

### Cron

- opaque per-job reference label (raw cron names are not exposed)
- owner profile
- coarse schedule (`cron` expression, interval, or one-time)
- active, paused, or completed state
- last status/time
- next run time

Error bodies, prompts, scripts, delivery targets, work directories, and job payloads are deliberately omitted.

## Room allowlists

Edit the matching `rooms/<room>.json` only:

- `agents[].handle` lists the real profiles allowed to appear in that room.
- `jobs_wall.job_scope` lists the profile owners whose cron records may appear.
- Unknown global profiles and jobs are dropped rather than merged.
- Agent Staff also reads gitignored `tmp/grok-staff-presence.json` for Grok Bot staff handles that have no Hermes profile. Only RoomSpec handles are kept. Same sanitized fields; no UUIDs, paths, or transcripts.
- `default` is displayed as **Sancho**.
- `default` and `general-assistant` are shared helpers. When live work can be mapped to another project room, the helper appears there and is removed from Home for that state refresh.

TSH rules:

- Never expose client names, conditions tied to people, appointments, phone numbers, email addresses, or other PHI.
- Shared helpers keep `team_member: false` outside Home.

Midas rules:

- Never expose wallet addresses, keys, recovery material, broker credentials, account values, order payloads, or execution claims.
- Campus remains paper-only unless a separately reviewed broker integration exists.

## Running locally

```bash
npm install
npx playwright install chromium
npm run check
npm run dev
```

Open the Local URL printed by Vite. The adapter is enabled by default. Disable it for a fail-closed static run:

```bash
CAMPUS_LIVE_ADAPTER=0 npm run dev
```

Verify the adapter without printing private state:

```bash
curl -fsS 'http://127.0.0.1:5173/api/campus-state?room=home'
```

The response must contain only the safe fields described above.

## Network access

The network preview command binds the static Campus UI to `0.0.0.0`:

```bash
npm run start:network
```

The live `/api/campus-state` adapter is **loopback-only**. A browser on the same Mac receives sanitized live state; any request arriving from a LAN or Tailscale address receives `403` and the UI immediately falls back to `away` agents, an empty JOB WALL, and zero token counters. This is an enforced boundary, not a documentation-only warning.

Recommended topology:

```text
Browser on Campus host → 127.0.0.1:4173 → UI + sanitized live state
Remote trusted browser → host:4173      → UI + fail-closed static state
```

Do not expose port `4173` to the public internet. Remote live state would require a separately reviewed authenticated reverse proxy or equivalent access-control layer; Campus does not ship one.

## Verification gate

Before serving a change:

```bash
npm run validate
npm test
npm run build
npm run test:e2e
```

The automated checks cover adapter sanitization, shared-helper room movement, stale-session false positives, unknown-profile exclusion, scoped jobs, first paint, motion, collision clearance, controls, physical interactions, and navigation.

A privacy, schema, syntax, or browser-test failure is a hard stop. Do not weaken the checks to admit private data.

## Write/control integration remains out of scope

A future adapter that starts jobs, sends prompts, or changes agents would require a separate approval-gated design with authentication, CSRF protection, authorization, rate limiting, replay protection, audit logging, private-network restriction, and read-back verification. None of those write paths exist in the current Campus runtime.
