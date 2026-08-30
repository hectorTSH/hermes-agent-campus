# Hermes Agent Campus

A privacy-first **ProjectContext → RoomSpec → shared Three.js runtime** for turning agent projects into inhabitable, interactive 3D rooms.

Campus is a visual operations surface: agents work or rest at role stations, project jobs live on an architectural JOB WALL, a room pet summarizes activity, and one Campus door connects every location. Room identity is validated data—not copied HTML.

> **Release status:** local v1 release-candidate development. Nothing in this repository deploys, publishes, contacts profiles, or executes project work.

## What it is

- A versioned, human-editable RoomSpec format.
- A deterministic generator for explicitly selected, sanitized project context.
- One shared renderer for camera, controls, agents, walking, interactions, pets, jobs, and navigation.
- A local demo and reference implementation for six distinct rooms.

## What it is not

- Not an agent executor, broker, health record system, crawler, or secrets manager.
- Not a recursive indexer of a user home directory.
- Not a claim that mock presence, usage, or job timestamps are live.
- Not a set of cloned single-file room mockups.

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>. During foundation development, `?room=sample-studio` loads the sanitized example.

```bash
npm run check       # schema validation, unit tests, production build
npm run test:e2e    # browser interaction suite (after Playwright browser install)
```

If Playwright has no local browser yet:

```bash
npx playwright install chromium
```

## Architecture

```text
selected project-local sources
  → ProjectContext v1
  → fail-closed privacy scan + schema validation
  → deterministic RoomSpec v1 (or a hand-authored RoomSpec)
  → shared Three.js renderer/runtime
  → optional room-scoped presence and cron adapters
```

The browser validates the RoomSpec before creating WebGL. Invalid input produces an explanatory first-paint error instead of a silent black canvas.

Core paths:

- `schemas/project-context.schema.json` — explicit sanitized input contract
- `schemas/room-spec.schema.json` — versioned scene contract
- `scripts/campus.mjs` — generate and validate CLI
- `src/runtime.js` — shared Three.js scene and interaction runtime
- `examples/contexts/` — sanitized JSON/YAML inputs
- `examples/rooms/` — deterministic generated RoomSpecs
- `rooms/` — v1 hand-authored RoomSpecs
- `docs/roomspec.md` — schema and privacy guide

## Privacy boundary

Campus reads only sources a user explicitly names. ProjectContext source paths must be relative and cannot traverse upward. The sanitizer rejects personal filesystem paths, secret-like values, wallet/recovery material, PHI/client identifiers, and unrelated memory classes. Examples contain no personal paths or credentials.

The browser consumes RoomSpec data; it never sees raw model payloads. Jobs are filtered by each room's `job_scope`, and a runtime adapter may not merge unrelated global jobs.

See [ProjectContext and RoomSpec](docs/roomspec.md).

## Visual system

The renderer uses an elevated 3/4 camera, layered cutaway architecture, wall thickness and caps, framed openings, beveled matte geometry, broad key plus hemisphere fill, soft shadows, and a controlled palette. Each room supplies a different architecture, material, lighting, opening, species, pet, downtime, prop, and JOB WALL recipe.

Controls: **W/S** pan, **A/D and left/right inverted** pan, **Q/E** orbit, scroll zoom, and **R/F** pitch.

## Deterministic no-LLM generation

```bash
npm run generate -- \
  --context examples/contexts/sample-studio.json \
  --out examples/rooms/my-studio.json
```

The built-in generator records source hashes and `llm_used: false`. A future model adapter is optional and must output the same validated schema.

## Historical prototypes

Files under `mockups/` are archived visual/interaction experiments. They are not the v1 runtime and are not loaded by the app.

## License

MIT. See [LICENSE](LICENSE).
