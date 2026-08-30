# Design lock (Hector, 2026-08-29)

Decisions below override the bake-off brief. Do not re-open them without asking.

## Builder / designer

**Locked (Hector, 2026-08-30):** `gpt-5.6-sol-900k` via `openai-codex` for the **entire project**—RoomSpec design, visual direction, engine implementation, room construction, interaction wiring, and verification.

This supersedes the 2026-08-29 Kimi bake-off decision. Kimi remains historical provenance for the archived Midas prototypes only; do not call Kimi for new Campus work.

- Keep work on the `general-assistant` profile. Do not delegate room work to other profiles or subagents.
- The same GPT-5.6 Sol worker converts approved project context into RoomSpec and implements it in the shared renderer.
- Config: [../config.yaml](../config.yaml)

## Open-source architecture

The final product is a reusable **context → RoomSpec → shared renderer** engine, not a collection of manually cloned HTML files. Canonical architecture and schema requirements: [open-source-room-engine.md](open-source-room-engine.md).

- Users explicitly select project context sources; no recursive home-directory ingestion.
- Sanitize before style generation: no secrets, wallet material, PHI, or unrelated memory.
- `gpt-5.6-sol-900k` via `openai-codex` fills visual RoomSpec fields and implements them in the shared renderer; do not call Kimi or split design from implementation.
- RoomSpec is schema-valid, human-overridable, seeded/deterministic, and renderable without an LLM.
- One shared Three.js runtime owns controls, clicks, movement, jobs, pet, and Campus navigation.
- Current one-file room pages are prototypes only.

## Rendering quality bar

Target **polished stylized 3D architecture with isometric-inspired clarity**: layered façades and interiors, wall thickness, trim/recesses, restrained bevels, matte coherent materials, soft directional + environment lighting, contact shadows/AO, controlled detail hierarchy, functional storytelling, and clean silhouettes. The references happen to be miniature/diorama renders; **their scale is not a requirement**. Rooms may feel full-scale and inhabitable. Raw boxes with flat openings are not the target. See [open-source-room-engine.md](open-source-room-engine.md) for the full reference-derived specification.

## Camera

Elevated 3/4, **3D rendered**, not pixel art.

- Look-down **~36°** from horizontal (v1 ~52°, v2 ~42°, still a hair high if needed)
- FOV 35–42 perspective, or orthographic
- WASD pan, Q/E yaw, **no pointer lock / no FPS**
- **A/D and left/right pan are inverted** (v3 lock)
- Scroll wheel (or `+` / `-`) **zoom**
- `R` / `F` (or PageUp / PageDown) **pitch**: overhead ↔ lower lateral
- Default still ~36° 3/4

## Work vs idle

Working agents must *look* busy at their station (writing the board, building at the bench, researching at screens). Idle agents only breathe / slump in the downtime zone.

## Billboard inspector

Click a name tag → panel with model, token burn, thinking/tool, prompt. Idle agents show **last run**. Second click to expand history = later.

## Jobs wall (required in every room)

Every room has a **clickable architectural JOB WALL sign** integrated into its orchestrator zone. Campus-wide construction is locked from the visual reference:

- long shallow horizontal sign cabinet with visible depth
- room-accent outer frame/body
- inset warm cream/off-white face
- raised, all-caps **JOB WALL** lettering in the room accent
- restrained bevels and contact shadows
- mounted into fascia/millwork or on concealed short supports

It must read as permanent room architecture—not a generic blackboard, loose poster, or floating UI panel. The surrounding task surface can still be cork, dry-erase, dispatch rail, etc. Clicking the physical sign or associated surface opens the jobs panel. Full construction spec: [open-source-room-engine.md](open-source-room-engine.md).

Click → list of **cron jobs for agents who belong in this room** (team + any generic souls who appear there): name, owner handle, schedule, last run, next, enabled/paused. Not a dump of every Hermes cron on the machine.

Crons are tickets on the board, not extra desks (see “many agents / many jobs”).

**TSH jobs wall shows:** `tsh-supabase-backup`, `tsh-google-voice-inbox-watch`, `tsh-session-invoice-watch` (tsh profile) + `tsh-morning-briefing` (general-assistant). No client PHI in job titles.

## Door warp

Click the Campus door → **hologram menu titled Campus** (pins, live/idle counts) → pick a location → light-tunnel warp.

Until rooms are wired, warp may loop back to the current room. Menu mock: `mockups/campus-door-menu.html`.

## Walking (no snapping)

Agents **never teleport**. Walk around solids (desks, statue, vault). No clipping.

## Idle overflow (couch isn’t infinite)

Couch has **two seats**. Extra idle agents, in order:

1. stretch / workout (plant)
2. lean on the vault
3. sit on the rug facing the Midas statue
4. linger at the sideboard

If every overflow spot is full: **glitch pile** on the couch (intentional). Demo: `I` = all idle, `P` = force pile.

## Pets

Each room has **one pet**. Pet = **the room**; tags = **one agent**.

**Movement**

| Pet is… | Means |
|---------|--------|
| Asleep on downtime furniture | Nobody working |
| Slow wander | Light / healthy |
| Fast loop | Room hot (room-wide token burn / many LIVE) |
| Sitting in the **doorway** | Something needs **you** |
| Parked next to **one** agent | That agent stuck / errored / LIVE too long |
| Walking board → bench → review | Pipeline flowing |
| Frozen | Last run failed |

Speed **is** room-wide burn. Location **is** attention.

**Click** → room digest (counts, room burn, last success/fail, **one human action**). Not another agent inspector. Doorway sit = that action is waiting.

Midas pet: **coin scarab**. Mock digest until live Hermes feed exists.

## Campus map vs location names

The **map itself** (hologram in the home doorway, window title, HUD chrome) is **Campus** — never named after one project.

**Location labels on that map** (pins / list rows):

| Location on the map | Project |
|---------------------|---------|
| Home | hub (customize later) |
| TSH | Time Strong Health |
| **Folio Work Kits (DPF)** | DPF only — this string is a *pin name*, not the map title |
| Midas | Midas |
| WanderPick | WanderPick |
| Agent Staff | Grok bot staff HQ |

Do not title the hologram, repo, or campus shell “Folio Work Kits (DPF)”.

What each pin *is*, and how to dress it: [projects.md](projects.md).

## Room identity (must not share one dark box)

Copying Midas’s floorplan and recoloring a little is **not** a new room. Every project location must differ on **all four**:

1. **Wall color / material**
2. **Floor color / material**
3. **Lighting recipe**
4. **Windows / openings** (or an explicit *none* — Midas is a closed war room)

| Pin | Walls | Floor | Light | Openings |
|-----|-------|-------|-------|----------|
| **Midas** | dark hunter plaster | walnut parquet | warm brass practicals, no sky | **none** — closed war room |
| **TSH** | cream plaster + sage trim | pale maple | hemisphere daylight + sun through glass | **3 clinic windows** on the right wall |
| **Home** | warm living-room plaster | oak boards + rug | lamps, late-afternoon | 2 house windows (customize later) |
| **Folio Work Kits (DPF)** | paper-white + kraft | light birch | print-shop overhead | shop-front windows |
| **WanderPick** | sky / postcard plaster | painted wood | afternoon sun | big map-window (daybed) |
| **Agent Staff** | graphite plaster | charcoal carpet | civic cool overhead | window looking *out* at campus |

Do not reuse Midas’s dark green box + gold practicals for another pin. Windows are the cheapest way to change presence of daylight.

## Agents (look)

- **Each room is one alien species**, high detail, reused for every agent in that room. Distinguish agents with scale, sash/clothes, pose, and name tags — not a new creature per person.
- Midas species: **Aureans** (gilded, crown ridge). Other rooms pick their own species later.
- Stick figures: no. Mixed zoo per room: no (detail gets spent on novelty, not quality).
- **Every agent has a floating name tag** (canvas sprite billboard, always faces camera, above the head). No unlabeled bodies.
- Working agents stand at their **role station**. Idle agents go to the **downtime zone**.

## Role stations (required in every project room)

Every environment is zoned by **role**, not one shared desk.

Minimum stations (add project-specific ones as needed):

| Role | Typical furniture |
|------|-------------------|
| Orchestrator | blackboard / dry-erase wall, layout of tasks |
| Builder | workbench / machine / keyboard pit |
| Reviewer | review desk, stacked pages or dual-inspect screens |

Do not seat the orchestrator, builder, and reviewer at the same island. Stations must be readable from the 3/4 camera.

## Many agents / many jobs (stations do **not** scale 1:1)

**Stations = standing roles**, not every named agent and **not crons**.

- A room may add a station for a durable specialist you always want to *see* (Midas: options pit, risk corner). Soft cap **~6 work stations** plus downtime, or the 3/4 camera dies.
- Extra LIVE bodies **share** an existing station (second stool, standing at the board) or wait in a short queue, then walk in. They do not spawn desks.
- **Crons are not people.** They show as board tickets, ticker pulses, or pet heat. A cron may *wake* a role that then walks to its station.
- Idle overflow (couch → stretch → vault → rug → pile) still applies when LIVE count drops.

Midas roster today: `midas` (board), `midas-cio` (bench), research (review). `options` / `risk` get stations only if we promote them to standing roles. Until then they share review/bench or stand at the board.

TSH roster: `tsh` (orchestrator/jobs wall), `general-assistant` (assessment bench) as generic soul, `digital-director` (outcome review) as generic soul. Other generic souls idle: `customer-researcher`, `risk-reviewer`, `video-producer`, `systems-engineer`. Tags show real handles. No fake `tsh-*` names for generic souls.

## Downtime place (required)

Dedicated **relaxation zone**, not a chair at a work station.

| Location on the map | Downtime idea |
|---------------------|----------------|
| Home | couch / living-room sit |
| TSH | recovery couch / stretch mat |
| Folio Work Kits (DPF) | snack nook / kettle + sofa |
| Midas | leather couch / sideboard drink nook (no random lagoon) |
| WanderPick | daybed / window seat |
| Agent Staff | window bench / coffee cart off the situation table |

A body of water is allowed only when the room’s story supports it.
