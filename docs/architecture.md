# Architecture

Hermes Agent Campus separates private source selection, renderable scene data, and runtime behavior.

## Data flow

```text
explicit selection
  → ProjectContext 1.0.0
  → JSON Schema validation
  → fail-closed privacy scan
  → deterministic generator or human author
  → RoomSpec 1.0.0 validation
  → browser validation
  → shared Three.js runtime
```

Nothing recursively scans a home directory. The built-in generator operates on one explicitly named ProjectContext file. ProjectContext `allowed_sources` are relative declarations for selected project-local sources; they are provenance, not instructions to crawl.

## Contracts

### ProjectContext

`schemas/project-context.schema.json` limits input to sanitized project identity, visual vocabulary, explicit relative source names, visible exclusions, agent roles, and a project-scoped job manifest. `scripts/lib.mjs` adds fail-closed checks for absolute personal paths, upward traversal, secrets, recovery material, PHI/client identifiers, and unrelated memory.

### RoomSpec

`schemas/room-spec.schema.json` is the versioned intermediate representation. It owns:

- identity and deterministic seed;
- palette, architecture, floor, openings, lighting, and composition;
- one room species with per-agent variants;
- role stations, agent state, and downtime;
- pet state and room digest;
- the architectural JOB WALL and room-scoped job manifest;
- prop clusters and Campus door destinations;
- privacy declarations and build metadata.

A RoomSpec is ordinary JSON, is human-editable, and can be rendered without an LLM.

## Determinism and provenance

The built-in generator derives stable seed values and placements from normalized ProjectContext content. Build metadata records generator version, selected-source hashes, provider/model when applicable, and whether an LLM was used. Validation fails before rendering when data violates the schema.

## Shared runtime

`src/runtime.js` is the only production scene mount path. It provides:

- elevated 3/4 camera and common controls;
- intentionally inverted A/D and left/right pan;
- wall thickness, caps, trim, thresholds, framed recesses, floor recipes, lighting, shadows, and material helpers;
- one label/inspector system for all agents;
- distinct working/idle poses;
- path-based walking with obstacle detours and no state teleport;
- CSS labels plus physical-mesh raycasting;
- room pet motion and digest;
- architectural JOB WALL and scoped job panel;
- Campus door, holographic map, light-tunnel transition, and URL warp;
- first-paint error boundary and a small diagnostic registry used by tests.

Room-specific visual identity stays in validated data and named reusable geometry recipes. Archived `mockups/` are not imported by the runtime.

## Runtime adapter boundaries

Production RoomSpecs fail closed with `away` agents and empty job arrays. The Vite server invokes `scripts/live_state.py` to overlay current read-only Hermes metadata within these boundaries:

1. Resolve the active RoomSpec first.
2. Request only handles in `agents` and owners in `jobs_wall.job_scope`.
3. Drop unknown global agents or jobs instead of merging them.
4. Reduce activity to a fixed coarse vocabulary and replace raw cron names with opaque per-job references before anything reaches geometry, labels, panels, logs, or screenshots.
5. Serve the live endpoint only to loopback requests; remote UI requests receive fail-closed static state.
6. Treat fresh turn leases or bounded recent activity as working; a running gateway alone never means an agent is working.
7. Clear working state, jobs, and token counters immediately when polling fails.
8. Never place tokens, API keys, PHI, client identifiers, wallets, broker credentials, or unrelated memory in a RoomSpec.

If the adapter is unavailable, every mounted room immediately transitions to the fail-closed baseline instead of preserving stale presence or jobs.

## How context becomes visual style

Project context is not copied into geometry verbatim. A small sanitized vocabulary is mapped to structured visual fields:

| Context signal | RoomSpec result |
|---|---|
| project purpose | architecture composition and hero feature |
| material/color hints | palette, wall/floor material names, trim |
| work roles | separated orchestrator, builder, reviewer, and specialist stations |
| workflows | functional prop clusters and JOB WALL surface |
| energy/time language | lighting recipe and exposure |
| culture/metaphor | one coherent room species and one pet |
| rest pattern | dedicated downtime-zone recipe |
| selected jobs | room-scoped JOB WALL tickets |

The renderer then applies a common quality grammar: layered construction, small bevels, matte materials, broad lighting, soft shadows, readable silhouettes, asymmetrical balance, and controlled detail hierarchy.

## Interaction flow

- A floating agent tag or the physical agent mesh opens the agent inspector.
- Live state changes build collision-aware paths and walk figures between stations and collision-safe downtime anchors.
- The physical pet or its label opens the room digest.
- The physical JOB WALL or its label opens only the active room's jobs.
- The physical Campus door or its label opens a map titled exactly **Campus**.
- Selecting another destination updates the URL and loads that room's validated RoomSpec through the same mount path.

## Test architecture

`npm run check` executes:

1. Schema validation for all example and production inputs.
2. Unit tests for deterministic generation, privacy exclusions, required components, identity uniqueness, room truths, scoped jobs, source integrity, and runtime declarations.
3. Production Vite build.
4. Playwright tests over a real HTTP server for every room's HTTP 200, first paint, tags, walking, pet, JOB WALL, Campus door, controls, physical raycasts, every warp destination, and invalid-room error boundary.

Tracked screenshots under `docs/screenshots/` are the visual release artifacts for all six rooms.
