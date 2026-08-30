# Agent Staff

Project room on the campus map. Home hub is separate and stays un-customized for now.

Campus map title: **Campus**. This room’s pin: **Agent Staff**. DPF’s pin (elsewhere): **Folio Work Kits (DPF)**.

## What it is

HQ for Hector’s **Grok bot staff** — Chief of Staff plus the other Grok bots — not a specialist coding floor.

Later connection: Hermes campus reads presence from those bots (Telegram/gateway/profile handles) without this repo needing bot tokens in git.

## Look

- Briefing loft / radio room, not a trading pit and not a clinic
- Long situation table, wall of named slots (one chair/station per bot)
- A “dispatch rail” (ticket/hologram strip) instead of candlesticks
- Window looking *out* at the other campus buildings (Staff watches the org)
- Palette: graphite, warm paper, a single gold accent — quieter than Midas, more civic than WanderPick
- **Role stations:** CoS orchestrator blackboard; dispatch/builder rail; a review/sign-off desk — not one shared table for every role
- **Downtime zone:** window bench + coffee cart, off the situation table (idle staff sit here, not at dispatch)
- **Name tags:** every bot is a distinct alien with a floating handle label

## Presence states (same contract as other rooms)

| State | Read as | Where they stand |
|-------|---------|------------------|
| working | bot session live / job running | station at the table |
| idle | online, nothing in flight | downtime bench |
| away | no recent heartbeat | empty station, tag still on the slot |

Do not invent live wiring in v0. Stub two Staff figures: one at the table (working, named), one at the window bench (idle, named).

## Do not

- Put TSH client data or Midas keys in this room
- Clone X/Grok branding
- Require the Grok connection before the room exists as a themed scene
