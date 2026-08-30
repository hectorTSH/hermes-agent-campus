# World model APIs

Builder/designer is **GPT-5.6 Sol**, not the world-model vendor. See [engine.md](engine.md) for the full stack decision.

There **is** a real world-model API. We do not have credentials, so rooms are LLM-authored Three.js.

## Best fit later: World Labs Marble — World API

- Product: [worldlabs.ai](https://www.worldlabs.ai/) / [marble.worldlabs.ai](https://marble.worldlabs.ai)
- Docs: [docs.worldlabs.ai/api](https://docs.worldlabs.ai/api)
- Announced Jan 2026: text / image / video / panorama → explorable 3D world
- Worlds get an id; `GET /marble/v1/worlds/{world_id}`
- Export: Gaussian splats, meshes, video
- Community wrappers: `sandraschi/worldlabs-mcp`, `willemhelmet/marble-api-quickstart`
- **Not configured here. Not treated as free.** Do not block v0 on a key.

Name tags, downtime zones, and working/idle overlays stay ours even if Marble generates the shell.

## Nearby, not the same

| API | What it actually gives you |
|-----|----------------------------|
| Google Genie 3 | Closed / limited; interactive world *video*, not a mesh you own |
| Meshy / Tripo / Rodin | Single 3D **assets**, not walkable rooms |
| Luma / Runway / Kling | Video, not a persistent space |
| Spline / Polycam | Editors, not generation-from-SOUL |
| ComfyUI 3D | Possible later on Spark; still asset-level |
| Unreal MCP | Live **editor** automation; optional Hermes skill, not installed. Editor is free to download; a cooked/streamed UE app is too heavy for the pop-up. See [engine.md](engine.md). |

## How Marble would plug in (after a key)

1. Theme YAML from each profile SOUL (no raw chat, no client notes, no wallets)
2. Text prompt → Marble world per room
3. Campus hub stays a small Three.js shell (door + hologram + warp)
4. Warp loads Marble (iframe or splat/mesh export)
5. Agent presence + **name tags** + **downtime spots** are our overlay
