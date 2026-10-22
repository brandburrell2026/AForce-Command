# AForce Spatial Studio

AI-powered 3D event activation design platform. Design, visualize, edit and
export dimensionally accurate activation environments in AForce's visual
language: matte black architecture, Signal Red LED, white typography,
metallic accents.

Brand positioning: **Performance Is Universal.**
Ritual: Pause. Hydrate. **Lock-In.** Perform.

## Stack

- Vite + React 19 + TypeScript + Tailwind 4 (matches the sibling `artifacts/*` apps)
- three.js via `@react-three/fiber`, helpers from `@react-three/drei`
- Scene units are **feet** (world unit = 1 ft). GLB export (section 6)
  converts to meters with `METERS_PER_FOOT` from `src/scene/units.ts`.
- The scene is described by a plain JSON document (`src/scene/model.ts`).
  The 3D view, floor plan, exports and AI edits all read and write that one
  document.

## Run

```bash
PORT=26120 BASE_PATH=/ pnpm --filter @workspace/aforce-spatial-studio run dev
```

`PORT` and `BASE_PATH` are required, the same contract as the other Vite
artifacts. On Replit both come from `.replit-artifact/artifact.toml`.

## Build log (one numbered section at a time, per the build rules)

| # | Section | Status |
|---|---------|--------|
| 1 | Scaffold + static 20 × 20 ft activation scene (six zones, real dimensions, orbit camera, dimension callouts) | Built |
| 2 | Editor: select, drag, rotate, scale, properties panel, floor plan with measurements | Next |
| 3 | Cameras: 360° orbit presets, first-person walkthrough with collision | Planned |
| 4 | Materials, lighting and color controls; logo, texture and product image uploads | Planned |
| 5 | Save and reopen projects (IndexedDB first, Postgres behind Clerk later) | Planned |
| 6 | GLB export and presentation-quality renders | Planned |
| 7 | Natural-language design edits via api-server route | Planned |

## Section 1 layout (plan view, feet, origin at floor center, +z toward the open front)

| Zone | Footprint (w × d × h) | Center |
|------|------------------------|--------|
| Illuminated inverted-N centerpiece | 6 × 6 × 7.5 | (0, 0.5) |
| AForce Hydration Bar (Watermelon · Soursop · Berry) | 12 × 6 × 9 | (−1.5, −7) |
| Lock-In Tunnel (red LED) | 5 × 13 × 8.5 | (−7.5, 2.5) |
| AForce OS demo station | 5 × 3 × 7 | (6.5, 6) |
| Wear the Standard apparel gallery | 2.5 × 9 × 9 | (8.75, −0.5) |
| Content studio | 5 × 5 × 9 | (7.5, −7.5) |
