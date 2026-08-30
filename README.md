# Hermes Agent Campus — mockups

Local 3D campus viewer experiments for Hermes agent projects.

**Locked decisions:** [notes/design-lock.md](notes/design-lock.md) · **OSS room engine:** [notes/open-source-room-engine.md](notes/open-source-room-engine.md) · **Engine:** [notes/engine.md](notes/engine.md) · **Project identities:** [notes/projects.md](notes/projects.md)

Builder/designer is **`gpt-5.6-sol-900k` via `openai-codex`** for the entire project. Kimi output below is historical prototype provenance only.

## Open these

| File | What |
|------|------|
| [mockups/kimi-k3/tsh-v2.html](mockups/kimi-k3/tsh-v2.html) | **Current TSH** — cream clinic, windows, maple, rehab stairs, jobs wall |
| [mockups/kimi-k3/tsh-v1.html](mockups/kimi-k3/tsh-v1.html) | TSH v1 (dark-box first pass) |
| [mockups/kimi-k3/midas-v8.html](mockups/kimi-k3/midas-v8.html) | Midas v8 (jobs board) |
| [mockups/kimi-k3/midas-v7.html](mockups/kimi-k3/midas-v7.html) | v7 (solids, idle overflow) |
| [mockups/kimi-k3/midas-v6.html](mockups/kimi-k3/midas-v6.html) | v6 (pet, digest, door menu, walk) |
| [mockups/kimi-k3/midas-v5.html](mockups/kimi-k3/midas-v5.html) | v5 (Aureans + statue) |
| [mockups/kimi-k3/midas-v4.html](mockups/kimi-k3/midas-v4.html) | v4 (charts + vault) |
| [mockups/kimi-k3/midas-v3.html](mockups/kimi-k3/midas-v3.html) | v3 (tags, warp, work/idle) |
| [mockups/kimi-k3/midas-v2.html](mockups/kimi-k3/midas-v2.html) | v2 (aliens + tags) |
| [mockups/kimi-k3/midas.html](mockups/kimi-k3/midas.html) | v1 bake winner (archive) |
| [mockups/compare.html](mockups/compare.html) | Three-model bake-off (archive) |
| [mockups/claude-sonnet-5/midas.html](mockups/claude-sonnet-5/midas.html) | Archive |
| [mockups/gpt-5.6-sol/midas.html](mockups/gpt-5.6-sol/midas.html) | Archive |

Controls: WASD pan (**A/D inverted**), Q/E yaw, **scroll zoom**, **R/F pitch**, click a name tag, click the door to warp.

## Camera

Elevated 3/4 **3D** (Pokémon / Animal Crossing camera, not Game Boy pixels). Not FPS.

## Campus map

Hologram / chrome title: **Campus**. Not a project name.

Locations *on* that map: Home · TSH · **Folio Work Kits (DPF)** (DPF pin only) · Midas · WanderPick · Agent Staff.

Every project room: distinct **alien** agents with **name tags**, **role stations** (orchestrator board / builder bench / reviewer desk), plus a **downtime zone**.

## Current model routing

New Campus work stays on `general-assistant` and uses `gpt-5.6-sol-900k` via `openai-codex` for RoomSpec, visual design, implementation, and verification. Do not call Kimi or delegate room context. The files under `mockups/kimi-k3/` are historical prototypes and may be used as visual/interaction references only.
