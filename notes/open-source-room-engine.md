# Open-source room engine — context → RoomSpec → Campus scene

Locked with Hector on 2026-08-30.

## Product requirement

Hermes Agent Campus is intended to become an **open-source project**, not a set of hand-authored rooms for one machine. The project needs a reusable engine that accepts a user's project context and converts it into a validated style/scene specification that the shared Campus renderer can build.

Current single-file HTML rooms are prototypes and visual experiments. They are not the final architecture.

## Pipeline

```text
project context sources
  → sanitize + classify
  → ProjectContext
  → GPT-5.6 Sol style/spec pass (current project lock; optional adapter in OSS)
  → validated RoomSpec
  → deterministic shared Three.js room engine
  → runtime adapters for agents / crons / presence
```

### 1. ProjectContext input

Accept selected, explicit sources rather than recursively ingesting a home directory:

- Project identity and description
- Project-local notes / README / approved context files
- Agent roster and role names
- Project-scoped cron manifest
- Optional visual identity: colors, materials, keywords, references
- Explicit privacy exclusions

Never ingest or emit secrets, API keys, wallet material, private health/client data, or unrelated profile memory. The OSS interface must make allowed sources and exclusions visible.

### 2. RoomSpec intermediate representation

Create a versioned JSON Schema and a human-editable JSON/YAML format. Minimum fields:

- `id`, `display_name`, `seed`, `schema_version`
- `identity_summary`, `visual_keywords`
- `palette`: neutrals, supporting colors, accent colors
- `architecture`: footprint, walls, floor, trim, windows/openings, ceiling/cutaway treatment
- `lighting`: environment, key, fill, exposure, shadow recipe
- `species`: shared room species, role variants, materials, silhouette cues
- `agents`: handle, role, station, state/presence binding
- `stations`: orchestrator, builder, reviewer, durable project-specific stations
- `downtime_zone`
- `pet`: species, movement/state semantics
- `jobs_wall`: architectural style, sign colors, mounting, runtime job scope
- `props`: identity feature, major clusters, secondary props, small accents
- `door`: Campus navigation contract
- `privacy`: excluded sources / prohibited output classes

RoomSpec must be schema-valid before rendering. Seeded generation should be stable across runs.

### 3. Model adapter

Current Campus development is locked to `gpt-5.6-sol-900k` via `openai-codex` for both visual design and implementation. The `general-assistant` worker should propose/fill **RoomSpec visual fields**—palette, composition, species, props, and architectural identity—and then implement and verify them in the shared engine. Do not call Kimi for new work.

The OSS engine should keep model/provider adapters modular. A user may supply a completed RoomSpec without any LLM call, or configure another supported model. Record the selected model/provider and source hashes in build metadata. Credentials come from environment/config and are never written into the repo.

### 4. Shared renderer/runtime

The renderer consumes RoomSpec and reuses one tested interaction engine:

- Camera and controls
- Name-tag raycasts and inspector
- Pet digest and movement semantics
- Walk paths / collision avoidance
- Campus door and warp navigation
- Jobs-wall raycast and jobs panel
- Presence and cron adapters
- First-paint/error boundary and diagnostics

Room-specific code should be data-driven. Avoid cloning a 50 KB HTML file and patching strings for every location.

## Visual quality target

The two user-provided references (`upload_20260830_031651_2.png` and `upload_20260830_031652_3.png`) establish the target. They are design references only and must not be redistributed with the OSS repo unless their license is known.

Target language: **designed miniature architecture / polished isometric diorama**, not raw low-poly primitives and not photorealism.

Required qualities:

- Elevated orthographic or weak-perspective 3/4 composition
- Layered architecture: wall thickness, trim, caps, recesses, thresholds, frames
- Small bevels/chamfers on exposed hero geometry
- Matte, coherent PBR materials with restrained specular response
- Soft hemisphere/environment fill plus one broad directional key
- Soft cast shadows and contact/AO grounding
- Recessed windows/doors rather than flat rectangles
- Deliberate detail hierarchy: one identity feature, 2–4 major clusters, 5–10 secondary props, controlled small accents
- Functional storytelling: each cluster visibly communicates the project's work
- Consistent stylization across architecture, props, pets, and agents
- Asymmetric but balanced composition; no uniform wall-hugging clutter
- Clean diorama presentation and readable silhouette at thumbnail size

Polish comes from layering, proportion, bevels, contact shadows, color discipline, and purposeful detail—not from noisy textures or polygon count alone.

## Jobs-wall visual standard

The first reference establishes the sign language. Every room's jobs board must be an **architecturally integrated sign/cabinet**, not a generic blackboard or a floating UI panel.

Visual construction:

1. Long, shallow horizontal sign box
2. Room-accent outer body/frame with visible side depth
3. Slightly inset warm cream/off-white face panel
4. Raised/extruded all-caps lettering: **JOB WALL**
5. Restrained bevels and contact shadows
6. Mounted directly to a fascia, station header, or concealed short supports
7. Integrated into the orchestrator zone's millwork/architecture

The frame/accent changes by room, but construction and wording remain recognizable Campus-wide. Clicking the physical sign or its associated wall opens the project-scoped cron panel.

Use actual text geometry or high-quality SDF/MSDF text in the final engine. Canvas sprites are acceptable only for early mockups.

## OSS acceptance criteria

- A sample context fixture can generate a schema-valid RoomSpec without private local paths.
- A user can hand-author/override RoomSpec without an LLM.
- The same renderer builds at least two visibly distinct rooms from two specs.
- Deterministic seed produces stable placement.
- Privacy exclusions are tested.
- Unknown/malformed inputs fail with actionable errors instead of rendering a black canvas.
- Generated room passes syntax, first-paint, jobs wall, pet, name tag, and Campus door tests.
