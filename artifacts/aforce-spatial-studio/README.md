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
| 2 | Editor: select, move, rotate, scale, properties panel, live floor plan, add / duplicate / delete, undo | Built |
| 3 | Cameras: animated view presets, 360° turntable, frame selection, first-person walkthrough with collision | Built |
| 4 | Scene and per-fixture colors, finishes and lighting; logo, texture and product image uploads with per-fixture slots | Built |
| 5 | Save and reopen projects (IndexedDB first, Postgres behind Clerk later) | Next |
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

## Section 2: the editor

State lives in `src/editor/store.ts`, a dependency-free external store
(`useSyncExternalStore`) holding the scene document, selection, gizmo mode,
snap and undo history. Every write passes through `sanitize`, which enforces
a 6 in minimum dimension, wraps rotation, and clamps the rotated footprint
inside the floor.

| Action | How |
|--------|-----|
| Select | Click a fixture in 3D, in the floor plan, or in the list. Click empty space or press Esc to clear. |
| Move | W, then drag the gizmo on the floor plane, or drag the fixture in the floor plan. Arrows nudge 6 in, Shift+arrows 1 ft. |
| Rotate | E, then drag the ring. `[` and `]` step 15°. |
| Scale | R, then drag the handles. Scaling rewrites the footprint (W × D × H) and the fixture rebuilds from it. |
| Snap | S toggles 6 in / 15° / 0.25× snapping. |
| Edit values | Properties panel: label, X / Z, rotation in degrees, W / D / H, notes. Enter or blur commits one undo step. |
| Add / duplicate / delete | Toolbar "Add fixture", ⌘D, ⌫. |
| Undo / redo | ⌘Z / ⇧⌘Z, 100 steps. Gizmo and plan drags are one step each. |

Fixture components render in local space; `FixtureNode` owns the world
transform, the selection frame and the gizmo.

## Section 3: cameras

`src/components/CameraRig.tsx` swaps between two rigs on `cameraMode`.

**Orbit.** Full 360° azimuth, polar clamped just above the floor. Seven
named views in `src/editor/camera.ts` (keys 1–7 or the View menu) fly the
camera and its target over 0.9 s with an ease-in-out; any drag cancels the
flight. F frames the selected fixture from the current approach angle, or
returns to the hero view with nothing selected. O turns on a slow
turntable. The orbit pose is remembered across walkthroughs.

**Walk.** V (or the Walk button) enters first person at eye height
5' 7" from the open front; click the card to engage pointer lock. W A S D
or arrows move at 6 ft/s, Shift runs at 11 ft/s, mouse looks. Esc releases
the mouse, Esc again exits. Movement is resolved in `src/editor/collision.ts`
as a 1 ft body circle against rotated rectangles: the three perimeter walls
and each fixture's collision shape, sliding along whatever it hits. Fixtures
block their footprint unless they declare walkable interiors; the Lock-In
tunnel is two side walls, the studio and the gallery block only their panels
and equipment. The walk pose is remembered for re-entry.

## Section 4: materials, lighting and uploads

**Style lives in the document.** `doc.style` (`src/scene/style.ts`) holds
the accent (LED) color, surface, panel, metal and floor colors, surface and
floor finishes, four lighting multipliers (LED glow, key, fill, reflections),
key color temperature, the scene brand logo, and floor and wall textures. A
fixture can override accent, surface, metal, finish and LED glow in
`fixture.style`; anything unset inherits.

**Materials are derived, not shared.** `createMaterialSet` in
`src/scene/materials.ts` builds every material a fixture needs from one
resolved style. `FixtureNode` builds a set per fixture and provides it
through context; fixture components call `useMaterials()`. The room uses a
scene-level set. Sets are rebuilt and the old ones disposed when the style
changes. A surface texture turns the surface and panel colors white so the
image carries the color.

**Images.** The Assets tab imports PNG, JPG, WebP, GIF or SVG (up to 8 MB,
downscaled to 2048 px, stored as data URLs in `doc.assets`) as logos,
textures or product shots; drag-and-drop infers the kind from the file
type. Each fixture kind declares image slots in `FIXTURE_SLOTS`; the "logo"
slot inherits the scene brand logo so one upload brands the plinth, the
bar fascia, the tunnel's outer wall, the OS counter, the apparel panel and
the studio backdrop at once. The bar's three niches and the OS totem screen
take product images. `ImagePanel` fits an image inside a slot (or covers it
for screens) with a little emission so graphics read as backlit.

Live controls (color pickers, sliders) stream through `useLiveEdit`, which
opens one undo step on the first change and closes it after the stream
goes quiet.
