# Contributing

Thanks for improving Hermes Agent Campus. v1 is deliberately data-driven: change RoomSpecs and shared recipes rather than cloning a complete page.

## Setup

```bash
npm install
npx playwright install chromium
npm run check
npm run dev
```

Node.js 20+ is required.

## Room workflow

1. Start from a sanitized ProjectContext in `examples/contexts/` or a hand-authored RoomSpec.
2. Use only explicitly selected, project-local context.
3. Keep private data out before generation: no secrets, personal paths, PHI, client identifiers, wallet/recovery material, credentials, or unrelated memory.
4. Validate the data.
5. Express identity through RoomSpec fields and reusable runtime recipes—not a cloned HTML file.
6. Verify the room in a real browser at 1440×1000 and at a smaller viewport.
7. Exercise an agent tag, walking toggle, pet, JOB WALL, physical-mesh raycast, Campus door, controls, and warp.
8. Check the browser console and update the room screenshot only after the scene passes.
9. Run `npm run check` before committing.

## Visual quality bar

Every room needs:

- layered walls, caps, trims, thresholds, and framed/recessed openings;
- matte coherent materials and restrained bevels;
- broad key and hemisphere fill, soft shadows, and grounded contact treatment;
- a different wall, floor, lighting, opening, composition, hero, prop, species, pet, downtime, and JOB WALL identity;
- separate orchestrator, builder, and reviewer stations;
- functional prop storytelling and readable silhouettes;
- an architectural JOB WALL sign cabinet, not a poster or floating panel;
- no placeholder geometry presented as a finished room.

Do not add a full ceiling slab; it blocks the elevated camera. Use small fixture canopies.

## Schema changes

- Preserve versioning and actionable JSON-pointer errors.
- Update schemas, generator, fixtures, docs, and tests together.
- Maintain the hand-authored/no-LLM path.
- Do not weaken privacy checks to make a fixture pass.

## Runtime changes

Shared camera, controls, raycasts, walking, collision behavior, labels, pets, jobs, and door navigation belong in `src/runtime.js`. Keep one production `mountCampus` path and one renderer. Room identity belongs primarily in `rooms/*.json`.

## Tests

```bash
npm run validate
npm test
npm run build
npm run test:e2e
npm run check
```

A successful HTTP response alone is not enough. Browser tests must prove a rendered scene and working interactions with no uncaught errors.

## Pull requests

Describe:

- what changed and why;
- RoomSpec/schema/runtime impact;
- privacy review;
- commands run and results;
- rooms visually inspected;
- updated screenshots when visuals changed.

Do not publish packages, deploy, create releases, or add paid external-service usage as part of a contribution without maintainer approval.
