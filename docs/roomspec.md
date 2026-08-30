# ProjectContext and RoomSpec

Hermes Agent Campus separates approved source context from renderable scene data:

```text
explicitly selected files → ProjectContext → sanitizer → RoomSpec v1 → shared runtime
```

## ProjectContext v1

`schemas/project-context.schema.json` is the public input contract. It contains only:

- project identity and a short summary;
- relative, explicitly selected `allowed_sources`;
- visible privacy exclusions;
- a small visual-identity vocabulary;
- sanitized agent roles; and
- a project-scoped job manifest.

Absolute paths and `..` traversal are rejected. The CLI also rejects secret-like values, wallet/recovery language, PHI/client identifiers, and personal filesystem paths. It never recursively searches a home directory.

## RoomSpec v1

`schemas/room-spec.schema.json` is the versioned intermediate representation. A RoomSpec defines identity, deterministic seed, palette, architecture, openings, lighting, species, agents, role stations, downtime, pet behavior, the physical JOB WALL, prop clusters, Campus destinations, privacy declarations, and build metadata.

RoomSpec files are ordinary JSON. ProjectContext may be JSON or YAML. Both are human-editable and can be validated without a model.

## Generate without an LLM

```bash
npm run generate -- \
  --context examples/contexts/sample-studio.json \
  --out examples/rooms/my-studio.json

node scripts/campus.mjs validate --room examples/rooms/my-studio.json
```

Generation is deterministic: the same valid ProjectContext produces the same RoomSpec, placement seed, and source hash. `build_metadata.llm_used` is explicitly `false` for the built-in generator.

## Hand-author a RoomSpec

Copy a sanitized file from `examples/rooms/`, change its data, and run validation. No model adapter is required. Invalid values fail with JSON-pointer paths, for example:

```text
RoomSpec validation failed:
/jobs_wall/label must be equal to constant
```

The browser repeats schema validation before creating WebGL. A failure renders an actionable error boundary rather than a black canvas.

## Optional model adapters

A future adapter may propose visual fields from a sanitized ProjectContext. It must return a schema-valid RoomSpec and record provider, model, selected-source hashes, and whether an LLM was used. The renderer never accepts raw model prose or provider payloads.

## Runtime adapters

Jobs, presence, and usage are represented by the RoomSpec today and may be replaced at runtime by scoped adapters. The adapter contract is room-local: a room can request only handles and job scopes listed in its RoomSpec. Unknown jobs are not merged into the room.
