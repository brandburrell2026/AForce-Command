# AFORCE OS — TRAINER COMMAND DASHBOARD
## Claude Code build brief · v1.0

You are building the athletic trainer surface of AForce OS. This document is your
contract. Read it fully before writing a line. When this brief and a request in
chat conflict, ask — do not guess.

---

## 0. WHO THIS IS FOR

The primary user is a **certified athletic trainer (ATC)** or performance staffer
standing on a field, court, or pool deck. Not a coach. Not an analyst. Not an
executive. Every design decision resolves in that person's favor.

What their day actually looks like:

- 06:30 — wellness questionnaires land overnight; they need the exceptions, not the data
- 07:45 — pre-practice screening, 18 athletes through a training room in 40 minutes
- 14:00 — practice. Phone in a pocket, sun glare, gloves or tape on hands, one hand free
- 14:20 — an athlete goes down. They need that athlete's record in under 5 seconds
- 17:00 — documentation. The part everyone hates and the part that holds up in a lawsuit
- 21:00 — tomorrow's availability report to the head coach

**The three numbers that define the product:**

| Constraint | Target | Why |
|---|---|---|
| Time to a go/no-go answer on one athlete | < 5 seconds from cold app open | Sideline reality |
| Time to log a status change | ≤ 2 taps | Anything more and it gets written on a hand |
| Glance comprehension of the board | < 12 seconds for a 100-athlete roster | Pre-practice window |

If a feature does not serve one of those three, it goes behind a flag or does not ship.

---

## 1. THE BAR

"Best in the world" is not a vibe. It is measured against what trainers use today:

- **Athletic Trainer System (ATS)** and **Rank One** — dominant in high school / college
  documentation. Comprehensive, and universally described as dated and slow.
- **Healthy Roster** — better mobile experience, communication-first.
- **Teamworks / Smartabase (Fusion Sport)** — pro-level AMS. Powerful, expensive,
  requires a dedicated admin to configure.
- **Kitman Labs** — injury risk modeling, enterprise sales motion.
- **Catapult, Firstbeat, Polar Team Pro** — load monitoring hardware ecosystems.

Where they lose: they are databases with a UI bolted on. A trainer opens them to
*record* something, never to *decide* something.

**Our wedge:** AForce OS arrives already knowing hydration and readiness state from
the consumer app and devices. The dashboard opens with a decision already formed and
the evidence behind it one tap away. We are a decision surface that happens to keep
records — not a record system that happens to have a dashboard.

Do not try to out-feature Smartabase. Out-decide it.

---

## 2. NON-NEGOTIABLE GUARDRAILS

Violating any of these fails the build regardless of quality.

### 2.1 Protected files
`scoringEngine.ts` and `statusColor.ts` are **permanently off-limits to all agents
under all circumstances.** Do not read-and-rewrite, do not refactor, do not "improve
types," do not move them. Consume their exports. If you believe one needs a change,
stop and write the case in the PR description instead.

### 2.2 No medical claims
AForce OS is not a medical device and makes no diagnostic claim. Enforce in code and copy:

- **Banned output strings** (add a lint rule): `diagnose`, `diagnosis`, `dehydrated` as a
  clinical state, `heat stroke` as a determination, `injury risk: X%` presented as fact,
  `cleared to play` issued by the system.
- **Permitted framing:** the system reports *state* and *recommends* an action a
  licensed human then takes. `PULL FROM ROTATION. MEDICAL EVAL.` is a recommendation to
  a trainer, not a clearance decision. Every command surface carries the attribution
  "Recommendation — clinical decision remains with licensed staff."
- Clearance and return-to-play status is always **entered by a credentialed human**,
  timestamped, and attributed. The system never sets it.
- Anything touching FDA, HIPAA, FERPA, state licensure, or NCAA/NFHS rules: flag it in
  the PR, do not resolve it in code.

### 2.3 Role-based medical redaction
This is the most defensible thing in the product. Build it first, not last.

| Role | Readiness / hydration | Load & training data | Availability status | Injury nature, notes, SOAP, medical history |
|---|---|---|---|---|
| Athletic trainer / team physician | full | full | write | full |
| Strength & performance | full | full | read | **never** |
| Coach / staff | tier only, no raw biometrics | summary | read | **never** — availability only |
| Athlete | own data, full | own | read own | own |
| Admin / compliance | none | none | read | audit metadata only, never content |

Redaction happens **server-side**. A coach's API response must never contain a medical
note field, not even nulled out or empty-stringed. Write the test that asserts this
before writing the endpoint.

### 2.4 Brand locks (v2.1.0 AFORCE_CANONICAL_LOCKS)
- Cinematic Black `#0D0D0D` · Signal Red `#C1281B` · Bone `#F5F0E8`
- Archivo Black (display) · IBM Plex Mono (data, labels, all numerics) · Inter (body)
- N–И monogram: standard N + `scaleX(-1)` mirrored N. Never Cyrillic characters.
- Clutch accent teal, Guardian accent violet. Tier colors are fixed:
  OPTIMAL `#1FA35A` · WATCH `#E8A12B` · MODERATE `#E2701F` · CRITICAL `#C1281B`
- Do not introduce a new color, typeface, or radius scale. If the design needs one,
  say so in the PR.

### 2.5 Tier bands are locked
- **Clutch** (high school, prep, club, JUCO, NAIA, NCAA D1–D3): readiness 0–100, higher
  is better. PLATINUM 90+ · PRIMED 75–89 · STEADY 60–74 · WATCH 40–59 · DEPLETED 0–39.
- **Guardian** (professional, international club, national team): risk 0–100, lower is
  better. OPTIMAL 0–24 · WATCH 25–49 · MODERATE 50–74 · CRITICAL 75–100.
- Same underlying score, inverted presentation. Never let the two drift apart.

### 2.6 Environment traps — read before touching data
- Production Neon is the **Replit-managed instance** (`ep-still-bird-atrkomie`). The
  database shown in the Replit UI is a different one. Confirm the connection string
  against the Railway/Vercel env var, never against the Replit panel.
- New gated serverless functions follow the established **three-gate harness pattern**.
- Every new surface ships behind a feature flag, default off, named
  `trainer_<surface>_enabled`.
- Branch → plan → review → merge. No direct commits to main. One PR per phase below.

---

## 3. ARCHITECTURE

Work inside the existing monorepo. Recon before you build (Phase 0).

```
Data in     →  AForce OS app + wearables (Apple Health, Samsung Health,
                Health Connect, WHOOP, Strava, Garmin)
            →  Wellness questionnaire (athlete-submitted, morning)
            →  Trainer-entered observations (screening, status, notes)
            →  Environment (WBGT / heat index for the venue)

Engine      →  scoringEngine.ts  [PROTECTED — consume only]
               readiness, risk, tier, command

Surfaces    →  Trainer Board (this build)
               Clutch grid / Guardian monitor (exists)
               Athlete app (exists)

Out         →  Availability report (coach-safe, redacted)
               Documentation export (trainer-only, audit-logged)
```

**Stack rules:** match whatever the repo already uses. Do not introduce a state
library, a component library, or an ORM that is not already there. If the web surface
is React, use it. No new runtime dependency without justification in the PR.

---

## 4. BUILD PHASES

One PR each. Do not start a phase until the previous one's acceptance criteria pass.

### Phase 0 — Recon and plan *(no feature code)*
Read the repo. Produce `docs/trainer-dashboard-plan.md` containing: existing auth and
role model, what `scoringEngine.ts` exports, current data schema for athletes and
teams, existing roster import path, the flag mechanism, test setup, and where this
surface mounts. List every assumption you had to make.

**Done when:** a human can read the plan and know exactly what will change.

### Phase 1 — Roles, redaction, audit
Role enum, server-side field redaction per the §2.3 matrix, and an append-only audit
log for every read of a medical field and every status write (who, what, when, from
where). No UI yet.

**Done when:** integration tests prove a coach token cannot retrieve a medical note
field by any route, including direct ID access and any list endpoint; and every
medical read appears in the audit log.

### Phase 2 — The Morning Board
The one screen. Opens to today. Roster sorted by *who needs me*, never alphabetically.

- Exception-first: flagged athletes surface above the fold; everyone fine collapses
  into a single "N clear" row that expands.
- Each row: name, position, availability status, tier, the one command, and *why* —
  the single strongest contributing signal in plain language ("slept 4h 50m, third
  short night").
- Filters: position group, availability, flagged-only, unsubmitted questionnaire.
- Roster-wide state at top: available / limited / out counts, and today's
  environmental condition for the venue.

**Done when:** a 120-athlete roster renders in < 400ms on a mid-tier Android, the board
is legible at arm's length in sunlight (test contrast at 4.5:1 minimum on every tier
color against `#0D0D0D`), and a trainer with one thumb can change any athlete's
availability in two taps from cold start.

### Phase 3 — Athlete record
Full drill-down. Signal breakdown (HydroState, sleep readiness, recovery window,
environmental pressure, load forecast), 14-day trend, status history with attribution,
notes, documents.

**Done when:** reachable in ≤ 2 taps from the board, and the whole record renders from
cache with no network.

### Phase 4 — Screening and documentation
Morning wellness questionnaire (soreness, sleep, stress, energy, hydration self-report
— configurable per program), pre-practice screening checklist, and a structured note
entry (SOAP format: subjective, objective, assessment, plan) with templates.

Documentation rules: notes are **append-only**. An edit creates a new version with the
prior version retained and both timestamped. Nothing is ever silently overwritten —
this is the property that makes the record defensible.

**Done when:** a note takes under 60 seconds to file from a phone, versions are
immutable, and a full athlete chart exports to PDF with an audit trail attached.

### Phase 5 — Load and environment
Acute:chronic workload ratio (7:28 rolling, exponentially weighted), session RPE ×
duration, and venue WBGT / heat index with the recognized activity-modification
guidance surfaced as *reference*, attributed to its source, never as an instruction
the system issues on its own.

Show uncertainty honestly: an ACWR computed on 9 days of data is labeled as such and
rendered in a muted state. **Never render a confident number on thin data.**

**Done when:** every derived metric displays its input window and data completeness,
and the heat module cites its source inline.

### Phase 6 — Return-to-play
A configurable stepwise progression (program-defined, not hardcoded), with each stage
requiring an explicit credentialed sign-off, timestamped and attributed. The system
tracks the protocol; a human advances it. Coach view shows stage and availability
only — never the underlying reason.

**Done when:** no code path can auto-advance a stage, and the coach payload is proven
free of medical context by test.

### Phase 7 — Offline, speed, hardware reality
Fields and arenas have no signal. Offline-first is a requirement, not a nice-to-have.

- Local-first writes, queued sync, last-writer-wins with a visible conflict surface for
  status changes — never silently drop a trainer's entry.
- The entire board and every athlete record must work in airplane mode after first load.
- Sync state is always visible and never lies. "Saved locally · 3 pending" beats a
  green check that means nothing.
- Touch targets ≥ 48px. Works with tape or gloves. Landscape and portrait. One-handed
  reach on a 6.7" phone.

**Done when:** the full flow passes with the network disabled, and the sync indicator
is accurate under forced failure.

### Phase 8 — Coach handoff and export
The redacted availability report: who's in, who's limited, who's out, nothing more.
Push to the coach surface, export to PDF, schedulable. This is what makes the trainer
look indispensable at 21:00.

**Done when:** a compliance reviewer reading the coach export cannot infer a medical
condition from it.

---

## 5. ANTI-GOALS

Do not build these. If they seem necessary, that is a signal something upstream is wrong.

- A configuration engine. Programs get sensible defaults and a small number of choices.
- A messaging platform. Link out to what the program already uses.
- Scheduling, billing, insurance, or inventory. Different product, different buyer.
- Charts that exist to look like analytics. Every visualization answers a question a
  trainer actually asks out loud.
- Gamification of any kind on a medical surface.
- An AI that "predicts injury." We surface state and history. A human decides.
  Any predictive language in the UI is an automatic revert.

---

## 6. PROVE IT

The build is not done until these pass:

1. **Golden roster fixture** — 120 athletes across 6 sports, spanning every tier,
   including edge cases: no device data, partial data, stale data (> 72h), a
   mid-season transfer, duplicate names, a single-name athlete, a 3-character name,
   a 40-character name.
2. **Redaction suite** — for each role, assert the exact shape of every API response.
   Fail on any unexpected field.
3. **Cold-start timing test** — board interactive in < 2s on throttled 3G, < 400ms warm.
4. **Offline suite** — every Phase 2–4 flow with the network killed mid-write.
5. **Contrast audit** — every tier color and text pair against `#0D0D0D`, 4.5:1 minimum.
6. **Copy lint** — the banned-string rule from §2.2 runs in CI.
7. **No mock data reachable from a production code path.** Ever. Seeded demo values
   live behind `trainer_demo_seed_enabled`, default off, and are visually marked as
   simulated wherever they render.

---

## 7. HOW TO WORK

- Plan before code, in writing, every phase.
- Small PRs. One phase, one PR, reviewable in under 20 minutes.
- When you hit an ambiguity about clinical practice, privacy law, or scope: **stop and
  ask.** A wrong guess in this domain is not a bug, it is liability.
- When you finish a phase, state plainly what you did *not* do and what you assumed.
- Do not report a phase complete because the code compiles. Report it complete when
  its acceptance criteria demonstrably pass, and say how you verified each one.

**Performance Is Non-Negotiable.**
