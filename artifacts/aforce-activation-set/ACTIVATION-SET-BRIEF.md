# AFORCE Touring Activation Set — Concept v01

Design model for discussion and quoting. Not construction-ready documentation.
Prepared 2026-10-22 for Super Bowl weekend Los Angeles (Feb 2027) and NBA All-Star
weekend Phoenix (the following weekend). One physical set, two venues, two footprints.

Files in this folder:

| File | What it is |
|---|---|
| `aforce_activation_set.rb` | SketchUp Desktop Ruby script that generates the whole model (geometry, materials, components, tags, dimensions, 13 scenes). Ran without errors in SketchUp on 2026-10-22; see status below. |
| `ACTIVATION-SET-BRIEF.md` | This document: sources, ritual mapping, component schedule, Veras prompts, assumptions. |

## Status — read first

The script was written without SketchUp available (syntax-checked and dry-run against an
API stub), then run by the founder in SketchUp on 2026-10-22: it built without errors.
The 13 scenes have **not yet been visually reviewed** against this brief — check each scene
tab for placement, text legibility and lighting-channel reads before sharing the model.
If a rerun ever fails, the whole build rolls back (single undoable operation) and the Ruby
Console prints the error line.

### Running it

1. Open SketchUp (2021 or newer) with any model.
2. Window > Ruby Console.
3. Paste and press Enter:

```ruby
load "/Users/brandonburrell/AForce-Command/artifacts/aforce-activation-set/aforce_activation_set.rb"
```

4. Save As an `.skp`. Scenes appear as tabs; tags are under the Tags tray prefixed `AFORCE -`.

Safe to rerun: each run creates a new parent group `AFORCE_ActivationSet_v01_<timestamp>`
and never deletes anything. Delete an old parent group by hand if you rerun.

## 1. Sources reviewed

Opened and inspected (not just file names):

- **joinaforce.com** home page — hero, "The System" products, "The Ritual" section with the
  four numbered steps and their one-line meanings, "The Signal" (Depleted → Balanced →
  Locked In), "Performance is Universal" community section, waitlist and Founding 250.
- **Figma — AFORCE Brand Asset System / Founder Library** (`eAtYvEs2RsPXK857QGYYUK`),
  frames: *01 Brand foundations* (type + palette), *02 Master asset controls* (wordmark,
  N–N signal, "Protect the signal" rules), *Ritual / four-step system*, *System hero /
  product + ritual + OS*, *Activation poster / concept*.
- **Figma — AFORCE Brand Identity Master Direction deck** (`Qy0ofIIL1Xeusc1SBWoay5`):
  cover slide only. The deck is a Figma Slides file and its other slides could not be
  listed through the connector; the Founder Library states its artwork is sourced from this
  deck, so it was used as the working reference.
- **Repo governance and brand files**: `CLAUDE.md` brand system v2.2.0,
  `aforce-content-team/brand/AFORCE_BRAND_BRAIN.md`, `MESSAGING.md`, the site's
  ManifestoSection, and the Spatial Studio design-language prompt.

Not reviewed: product artwork files, any activation concept decks beyond the one poster
frame, and city-specific graphics (none exist yet).

### Design principles extracted

- **Ritual is the spine.** Pause. Hydrate. Lock-In. Perform. Use all four steps or exactly
  one clearly identified step. Preserve the hyphen in LOCK-IN. Lock-In is the only word in
  Signal Red; Pause, Hydrate and Perform stay black or Paper.
- **One accent at a time.** Structure comes from hairlines and light, not filled colour.
  No gradients, no glows, no decorative effects.
- **Palette.** AFORCE Black `#0D0D0D` (Cinematic Black per CLAUDE.md; Founder Library lists
  `#090A0A`), Paper warm white `#E9E7E1`, Signal Red `#C1281B` canonical (Founder Library
  lists `#E51E2A`), Proof Blue `#1E5BFF` / `#2765FF` as evidence accent, flavour hues
  Watermelon `#E8455A`, Soursop `#1FA35A`, Berry `#1E5BFF`.
- **Type.** Inter only: ExtraBold display, SemiBold emphasis, Regular operating, Light
  signal. IBM Plex Mono uppercase tracked for labels (repo brand system). The script uses
  Arial Bold as a stand-in because SketchUp 3D text needs an installed font; swap `FONT`.
- **Marks.** Wordmark AFORCE™ and the N–N signal (left N forward, right N mirrored, Signal
  Red divider). "Use the supplied vectors. No retyping, stretching, outlines, shadows." The
  monogram in the model is a geometric placeholder to be replaced by the supplied vector.
- **Tone.** Quiet authority. "The world is loud. Readiness is quiet." Restrained,
  architectural, premium; precise numbers as premium cues; no claims, no affiliation.
- **Approved lines used.** "PERFORMANCE IS UNIVERSAL." (Founder Library + site community
  section) as the placeholder brand line. "Performance Is Non-Negotiable." is the core
  promise and can be swapped in via `BRAND_LINE`.

## 2. Verified ritual sequence

From the Founder Library *Ritual / four-step system* frame and the site's Ritual section:

| # | Step | Approved meaning (Figma) | Site line |
|---|---|---|---|
| 01 | PAUSE. | Create a moment of attention. | The moment before execution. |
| 02 | HYDRATE. | Make hydration part of your preparation. | Replenish what performance demands. |
| 03 | LOCK-IN. | Choose the next thing that matters. | Turn readiness into intention. |
| 04 | PERFORM. | Enter your moment prepared. | Carry composure into the moment that matters. |

Brand brain: "Hydration is the first completed action of preparation. The can begins the
ritual. The OS builds the habit." Founder note on Pause: stillness first; the pause is a
single unhurried breath, where you choose what the next hour is for.

No physical choreography for the ritual is documented anywhere in the sources (no
"breathe for N seconds", no prescribed gesture). The physical actions below are the
design's translation and need founder confirmation (see §6).

## 3. How the layout supports each step

Guest path is a U: enter front-left, along the left side to the counter, across the
counter front, into the right-hand Lock-In bay, down the right side to the exit. Staff zone
is the 3 ft 6 in strip behind the counter plus the back-left utility corner.

| Step | Guest action | Staff | Location + equipment | Product / prep | Signage (approved language) | Flow / access |
|---|---|---|---|---|---|---|
| 01 PAUSE | Stops at the threshold; one unhurried breath; optional waitlist / Founding 250 tap | Host greets, sets the pace, does not pitch | Front-left entry (6 ft clear). ST-01 welcome station, 34 in high, tablet placeholder. Floor marker "01 PAUSE". DP-01 plinth 1 beside the path | None at this step; plinth shows can + stick placeholders | "PAUSE." on the station front; sub-line "Create a moment of attention." on the tablet | Single guest or a group of 4 can stand here without blocking the counter line; 34 in station is wheelchair-usable |
| 02 HYDRATE | Receives a sample at the counter | Two servers behind the counter pour from concealed storage | CTR-01 ×2 (10 ft × 2 ft × 42 in) at y 14–16 ft. Four backlit niches: Watermelon, Soursop, Berry, Sticks. CTR-02 34 in accessible ledge at the right end | Product cases, cups, supplies on the staff side; waste bin inside module A; water + cooling allowances in the back-left corner | "HYDRATE." on the fascia centre | 10 ft front serves 4 guests side by side; 5 ft clear circulation in front; staff never crosses the guest zone |
| 03 LOCK-IN | Sets an intention on the OS demo totem; photo at the monogram wall | One floater supports the tablet and photos; restocks via the right bay | Right bay (x 15.5–20 ft). ST-02 totem 2 × 2 × 7 ft with portrait tablet placeholder and the single Signal Red channel. SG-03 monogram with halo on panel 5; photo spot marker | Guest keeps the can for the photo | "LOCK-IN." in Signal Red on the totem; "Choose the next thing that matters." on screen | Bay is separate from the counter line, so a photo never blocks sampling; tablet centred at 44–51 in reach |
| 04 PERFORM | Carries the can out; optional dwell in the lounge | None required | Front-right exit (4 ft clear). ST-03 exit blade, FN-01 bench + FN-02 stools, DP-01 plinth 2 as a last product touch | Stick box placeholder on plinth 2 (take-away cue) | "PERFORM." on the exit blade | Clear completion point; lounge sits off the path so dwellers never block the exit |

Compact 10 × 20 keeps all four steps as a left-to-right line: Pause (left end) → Hydrate
(centre counter) → Lock-In (right bay with monogram) → Perform (exit right). Staff zone
drops to 2 ft and restock moves to the right bay.

## 4. Component schedule (one touring set)

Dimensions are design intent in feet and inches. Quantities cover the full 20 × 20
configuration; the compact configuration uses a subset (shown in brackets).

| ID | Component | Size | Qty full [compact] | Notes |
|---|---|---|---|---|
| FP-01 | Footprint floor graphic | 20 × 20 ft (10 × 20) | 1 [1] | No raised deck; graphic or vinyl on venue floor |
| FP-02 | Ritual floor markers + path hairline | 4–10 ft × 6 in | 5 [5] | Printed vinyl, replaceable |
| FP-03 | Photo spot marker | 18 × 18 in | 1 [1] | Signal Red |
| BW-01 | Back wall panel, freestanding | 4 × 10 ft × 6 in, ½ in lit reveal | 5 [5] | Transportable; cam-lock joints; **structural review** (10 ft freestanding) |
| BW-02 | Replaceable city graphic (LA / PHX) | 3 × 6 ft | 1 [1] | Placeholder; print per city |
| SG-01 | AFORCE sign letters | 18 in cap height, 2 in deep | 1 [1] | Placeholder text; **specialist fabrication** (dimensional letters) |
| SG-02 | Brand line "PERFORMANCE IS UNIVERSAL." | 5 in cap height | 1 [1] | Editable placeholder |
| SG-03 | N–N monogram | 36 in high, 70 in wide | 1 [1] | Replace with supplied vector; **specialist fabrication** (backlit) |
| SG-04–07 | Ritual words PAUSE. / HYDRATE. / LOCK-IN. / PERFORM. | 5 in cap height | 4 [4] | Lock-In in Signal Red only |
| LT-01 | Top lighting channel | 20 ft × 2 × 1 in | 1 [1] | Warm white; lighting vendor to spec |
| LT-02 | Vertical reveal channels | 9 ft each | 5 [5] | One per panel, in the reveal |
| LT-03 | Signal Red channel on totem | 6 ft | 1 [1] | The single red light in the set |
| LT-04 | Monogram halo channels | 7 ft × 2 | 1 [1] | |
| CTR-01 | Hydration counter module | 5 × 2 ft × 42 in | 2 [2] | Solid-surface top, charcoal fascia, metal rail, back-bar riser with 2 backlit niches, concealed storage + waste; **specialist fabrication** |
| CTR-02 | Accessible service ledge | 36 × 12 in at 34 in | 1 [1] | Clip-on, right end |
| ST-01 | Welcome / demo station | 30 × 20 × 34 in | 1 [1] | Tablet placeholder 11 × 8 in |
| ST-02 | Lock-In totem | 24 × 24 × 84 in | 1 [1] | Portrait tablet placeholder; screen placeholder above; **structural review** (tip-over) |
| ST-03 | Perform exit blade | 12 × 4 × 60 in | 1 [1] | Lit hairline |
| DP-01 | Product display plinth | 16 × 16 × 40 in | 2 [1] | Can + stick-box placeholders |
| FN-01 | Lounge bench | 72 × 18 × 18 in | 1 [1] | |
| FN-02 | Stool | 16 in dia × 18 in | 3 [2] | Movable |
| UT-01 | Water supply allowance | 24 × 24 × 36 in | 1 [1] | Self-contained; venue water not assumed |
| UT-02 | Cooling / ice allowance | 36 × 24 × 34 in | 1 [1] | |
| UT-03 | Power distribution allowance | 12 × 12 × 18 in | 1 [1] | Venue feed or battery TBD |
| UT-04 | Cable route + ramp allowance | 2 in wide run | 1 [1] | Ramp where it crosses the Lock-In bay |
| RF-01 | Reference figure 5 ft 10 in | — | 3 [2] | Scale only; hidden in plan scenes |

Tags in the model: Footprint, Counter, Back Wall, Signage, Lighting, Displays, Furniture,
Stations, Utilities, Dimensions, Reference Figures, Ritual Map, plus three Config tags
(A Full, B Compact, C Packing) that the scenes toggle.

Scenes: 01 Hero front-left · 02 Hero front-right · 03 Front elevation · 04 Dimensioned
plan · 05 Staff-side counter (ritual support) · 06 Evening lighting · 07 Compact 10 × 20 ·
08 Exploded packing layout · 09 Ritual map overhead (annotated) · 10–13 Guest-eye views
of Pause, Hydrate, Lock-In, Perform.

## 5. Veras prompts

Use the matching scene, lock geometry and layout, and let Veras change materials, light
and atmosphere only.

**Daylight hero (scene 01)**
> Preserve the modeled geometry and layout exactly: do not move, add or remove objects.
> Premium performance lounge for a hydration brand at a daytime sports-weekend activation.
> Matte charcoal architecture, warm white Paper solid-surface counter top, brushed metal
> rail, freestanding back wall with thin warm-white lit reveals between panels, dimensional
> white "AFORCE" letters, single red monogram on the right panel. Soft overcast daylight,
> neutral white balance, no lens flare, no extra signage, no people. Restrained, editorial,
> architectural photography, 35 mm, eye level.

**Evening (scene 06)**
> Preserve the modeled geometry and layout exactly: do not move, add or remove objects.
> Same set at dusk inside a dark event hall. Lighting comes only from the modeled channels:
> warm-white top channel and panel reveals, backlit product niches on the counter riser, a
> warm halo behind the red monogram, and one vertical Signal Red light channel on the
> Lock-In totem. Everything else matte charcoal and near-black. Low ambient light, slight
> haze, no coloured washes, no gradients, no neon. Cinematic, quiet, premium.

**Hydration counter close-up (scene 11)**
> Preserve the modeled geometry and layout exactly: do not move, add or remove objects.
> Close-up of the 10 ft hydration counter from guest height. Matte black fascia with the
> word "HYDRATE." in white, warm white solid-surface top, brushed metal edge, back-bar
> riser with four softly backlit niches holding unbranded silver cans and a small box.
> Materials read as real: honed stone-look top, powder-coat charcoal, satin metal. Soft
> directional light from above, shallow depth of field, no people, no added labels or logos.

## 6. Assumptions and items for the fabricator and founders to validate

Design assumptions made here:

1. 20 × 20 ft footprint, 10 ft maximum height, and the 10 × 20 compact are provisional, not
   venue requirements.
2. No venue utilities: water, cooling and power are shown as space allowances only.
3. Ritual physical actions (one breath at Pause, intention entry at Lock-In) are the
   design's translation; the sources define the words and meanings, not the choreography.
4. Signal Red is modelled as `#C1281B` (repo canonical); the Figma Founder Library lists
   `#E51E2A`. One constant in the script switches it.
5. "PERFORMANCE IS UNIVERSAL." is placeholder text; "Performance Is Non-Negotiable." is the
   core promise and may be the preferred line for the wall.
6. The N–N monogram in the model is a geometric stand-in, not the supplied vector.
7. Arial Bold stands in for Inter in SketchUp 3D text.

Must be validated before quoting or build:

- Freestanding 10 ft wall panels: base, ballast, wind/crowd load, and panel-to-panel
  connection (structural review).
- Lock-In totem tip-over stability at 7 ft with a tablet at the top third.
- Counter module weights, case sizes and the two-person lift; whether the back-bar riser
  ships attached or separate.
- Dimensional letters and backlit monogram: fabrication method, power, and mounting to the
  panels.
- Lighting: fixture spec, driver locations, cable path, and whether the set can run on
  battery packs where venue power is unavailable.
- Water handling and waste: grey-water capture, ice logistics, health-department rules for
  sampling in LA and Phoenix.
- ADA: 34 in ledge, tablet reach ranges, 36 in minimum clear routes, floor-graphic slip
  rating, cable ramps.
- Fire rating of fabrics, vinyl and panel finishes for both venues.
- Truck, crate counts and load plan — the packing scene is a drawing aid, not a verified
  load plan. No weights, certifications or transport capacities are claimed.

Unresolved information that materially affects the experience:

- Exact venue footprints, ceiling heights and whether sampling is permitted at each site.
- What the Lock-In moment should ask the guest to do (intention prompt copy, OS demo flow).
- Whether the Founding 250 / waitlist capture belongs at Pause or at Perform.
- City-specific graphics content for LA and Phoenix.
