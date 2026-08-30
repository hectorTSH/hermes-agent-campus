# Engine choice (GPT-5.6 Sol designs and implements)

Builder/designer is locked to `gpt-5.6-sol-900k` via `openai-codex`. Room identity is expressed as validated RoomSpec data consumed by the shared renderer.

## Now (default)

**Three.js in a small local window** — fits a pop-up, requires no editor install, and is OSS-friendly. New work should move from cloned mockup HTML toward the shared context → RoomSpec → renderer architecture.

## World Labs Marble (world model API)

Real “prompt → explorable 3D world.” Best later art pipeline if we get a key.

- Docs: https://docs.worldlabs.ai/api
- **Not free / no key on this machine.** Do not block campus v0 on it.
- Overlay name tags + working/idle ourselves; Marble will not know Hermes presence.

## Unreal Engine MCP (optional Hermes skill)

There **is** an official-ish path: Unreal Editor 5.8+ with the **Unreal MCP** plugin, Hermes catalog `unreal-engine`, skill install `hermes skills install official/creative/unreal-mcp`.

| Question | Answer |
|----------|--------|
| Skill installed here? | **No** (optional; not in this profile) |
| Editor installed? | Not assumed |
| License | Unreal Editor is **free to download**. Epic’s EULA still applies (royalties if you ship a commercial game past their threshold). A local OSS campus viewer is not that product, but read the current EULA before publishing a UE binary. |
| Cost to *run* | Heavy: Editor (or a cooked Pixel Stream) must be up. Bad fit for a tiny always-on pop-up. |
| What MCP actually does | Spawn/dress actors in a **live editor**, not “generate a world from project context.” GPT-5.6 Sol would still own RoomSpec and integration; a human/agent drives UE tools. |

**Verdict:** do not install Unreal for v0. Revisit only if we want cinematic stills or a cooked flythrough, not for the desktop campus window.

## Order of operations

1. GPT-5.6 Sol + RoomSpec + shared Three.js renderer (current)
2. If a Marble key appears → generate plates/meshes, keep our runtime overlay
3. Unreal MCP only if Hector explicitly wants the editor path
