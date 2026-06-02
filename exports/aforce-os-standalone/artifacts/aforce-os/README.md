# AForce OS — Phase 1 (Mobile Demo)

> **Mission.** AForce OS is a real-time human performance OS. It tells the user what to do next, not what they did yesterday. Hydration intelligence is the wedge; the platform extends across Performance Pulse, Clutch Access, Guardian Intelligence, and Field Hardware.

---

## What this build delivers

This is the **production-ready Phase 1 demo** — investor-grade, design-first, and fully wired to a mocked decisioning service layer that mirrors the real `/v1` REST contract.

**4 tabs:**
1. **Home — Hydration Control Center** — Status Pulse, score, AI Command, Quick Intake of all 4 product types.
2. **Check — Performance Signals** — Symptom toggles, Hydration Signal Check (urine scale), Energy State, Confirm Status.
3. **Protocol — AForce Protocol** — Active stage, recheck windows, weekly compliance, command history.
4. **Profile — Settings & Demo Access** — Goals, hardware pairing (PHANTOM Band, CLUTCH Clip), feature flag panel that unlocks Phase 2 + Phase 3 demos.

**Two unlockable demo experiences (gated behind feature flags):**
- `/clutch` — **Phase 2 Clutch Access** (Command the Team): live command grid, weight-based hydration plan, heat mode, ops console.
- `/guardian` — **Phase 3 Guardian Intelligence** (Protect the Roster): personal Guardian risk, body risk map, roster monitoring, critical alerts.

---

## Architecture

```
artifacts/aforce-os/
├── app/                          # expo-router screens
│   ├── _layout.tsx               # Root: providers + Stack
│   ├── (tabs)/
│   │   ├── _layout.tsx           # 4-tab native/classic layout
│   │   ├── index.tsx             # Home — Hydration Control Center
│   │   ├── check.tsx             # Check — Performance Signals
│   │   ├── protocol.tsx          # Protocol — AForce Protocol
│   │   └── profile.tsx           # Profile + Demo Access toggles
│   ├── clutch.tsx                # Phase 2 demo (gated)
│   └── guardian.tsx              # Phase 3 demo (gated)
│
├── components/
│   ├── StatusPulseOrb.tsx        # Pulse — driven 100% by PulseConfig from API
│   ├── AnimatedScore.tsx         # Score never just appears — count up
│   ├── AICommandCard.tsx         # WHAT + WHEN + OUTCOME
│   ├── QuickIntakeBar.tsx        # Tap-to-log all 4 product formats
│   ├── FeatureGate.tsx           # Locked Phase 2/3 wrapper
│   ├── LiveStatusStrip.tsx       # Top live signal pill
│   ├── WhyThisScore.tsx          # 2–4 reasons
│   ├── RiskTimerDisplay.tsx      # Recheck window countdown
│   ├── WaterCycleBar.tsx         # 8-cell cycle visualization
│   ├── PhantomSignal.tsx         # Mock biometric strip
│   ├── CycleSuccessOverlay.tsx   # Identity-affirming confirmation
│   └── GradientBackground.tsx    # Brand gradient wrapper
│
├── services/
│   └── mockApi.ts                # Mocked /v1 endpoints (300ms p95)
│
├── store/
│   └── useAppStore.tsx           # Context + reducer, feature flags
│
├── utils/
│   └── scoringEngine.ts          # Score formula + AI command + Pulse + Phase 2/3 mocks
│
├── data/
│   ├── mockData.ts               # Symptoms, scales, history, roster
│   └── products.ts               # 4 product types + assets
│
├── featureFlags/
│   └── flags.ts                  # DEFAULT + DEMO_ALL_ON
│
├── theme/
│   ├── colors.ts                 # Brand palette
│   ├── typography.ts             # Inter scale
│   └── spacing.ts                # Spacing + radii
│
└── types/
    └── index.ts                  # PulseConfig, ProductType, FeatureFlags, GuardianRiskState…
```

---

## Service layer (mocked → ready for real `/v1`)

All hydration logic lives in the **service layer**. Frontend never invents scoring or commands.

| Endpoint                         | Mocked function          | Returns                                    |
|----------------------------------|--------------------------|---------------------------------------------|
| `GET  /v1/home`                  | `fetchHome`              | `engineOutput`, `userState`                |
| `POST /v1/intake/log`            | `postIntakeLog`          | new `userState`, new score, `IntakeLog`    |
| `POST /v1/signals/update`        | `postSignalsUpdate`      | recalculated state (symptoms)              |
| `POST /v1/urine-signal/update`   | `postUrineSignalUpdate`  | recalculated state                         |
| `POST /v1/energy-state/update`   | `postEnergyStateUpdate`  | recalculated state                         |
| `POST /v1/checkin`               | `postCheckin`            | confirmed, recalculated                    |
| `GET  /v1/protocol/current`      | `fetchProtocol`          | stage, steps, recheck window, compliance % |
| `GET  /v1/pulse/current`         | `fetchPulseConfig`       | speed / glow / wave / color mode           |

Latency simulated at 60–220 ms to honor the < 300 ms perf budget.

---

## Score formula

```
hydration_score =
    base_intake_score        ( 0..40, oz vs target )
  + recency_score            ( 0..20, minutes since last intake )
  + consistency_score        ( 0..15, compliance streak )
  + context_modifier         ( -15..+5, heat / sweat / activity )
  + recovery_momentum        ( 0..15, fast restoration after deficit )
  − symptom_penalty          ( 0..30, mild / moderate / severe + active count )
  − urine_signal_penalty     ( 0..20, scale 1–8 )
  − output_stress_penalty    ( 0..10, sweat × activity )
  − sleep_carryover_penalty  ( 0..10, overnight oz loss )
score = clamp(0, 100, round(...))
```

**State classification:** PEAK 90–100 / BALANCED 75–89 / RECOVERING 60–74 / DEPLETED 0–59.

---

## AI Command rules

Format: **WHAT to do + WHEN/HOW MUCH + OUTCOME**, 1–2 sentences, command authority.

✅ "Drink 16 oz now. Recheck in 20 minutes. You are at 68."
❌ "Try to consider drinking some water if you can — great job staying hydrated!"

Forbidden phrases: "consider", "try", "suggest", "great job", "stay hydrated".

---

## Pulse animation contract

Pulse is **dumb presentation**. All behavior comes from `PulseConfig`:

| State      | Color | Speed (cycle) | Wave behavior     | Glow |
|------------|-------|---------------|-------------------|------|
| PEAK       | Lime  | Fast (1.0 s)  | sharp_outward     | High |
| BALANCED   | Teal  | Slow (3.4 s)  | steady_outward    | Med  |
| RECOVERING | Amber | Medium uneven | uneven_outward    | Low  |
| DEPLETED   | Red   | Slow tense    | collapsing        | Min  |

Animations honored: `burstOnIntake`, `flareOnPeak`, `collapseOnDepletion`.

---

## Brand language enforced everywhere

| Old                   | AForce vocabulary                |
|-----------------------|----------------------------------|
| Body Symptoms         | **Performance Signals**          |
| Urine Color           | **Hydration Signal Check**       |
| Select Energy Level   | **Energy State**                 |
| Save Update           | **Confirm Status**               |
| Hydration tracker     | **Hydration Control Center**     |
| Notifications         | **Performance Commands**         |
| Settings              | **Profile**                      |
| Subscription tiers    | Core, Core Team, Clutch, Guardian, All-Access |

---

## Mocked vs. Real

**Mocked (V1):**
- All sensor readings (HR, temp, sweat, core temp).
- Hardware pairing (PHANTOM Band, CLUTCH Clip).
- Roster data.
- All `/v1` endpoints (latency simulated).

**Real (V1):**
- All UI behavior, animations, score math, AI command generation, Pulse driver, feature flag gating, recheck timers, history persistence within session, demo unlock toggles.

---

## Phase 1 → Phase 2 → Phase 3 progression

- **Phase 1 — Core (this build).** Athlete OS. Hydration intelligence + AI commands.
- **Phase 2 — Clutch.** Coach + team product. Live game commands, heat mode, weight-based plans, CLUTCH Clip hardware.
- **Phase 3 — Guardian.** Roster protection. Per-athlete risk score, body risk map, critical alerts, medical / coach escalation.

Phase 2 + 3 are **demo-ready** behind feature flags (Profile → DEMO ACCESS → Unlock all).

---

## 7 WOW Moments delivered

1. Score animates from previous to current — never appears.
2. Pulse mood-shifts the entire screen.
3. AI Command is a decisive instruction, not advice.
4. Quick intake recognizes 4 distinct AForce product formats (image-based).
5. Confirm Status recalculates the entire engine in one tap.
6. Phase 2 / Phase 3 unlock instantly via Demo Access toggle — no fake screens.
7. Pulse bursts outward on every intake (`burstOnIntake`).

---

## Run it

```bash
pnpm --filter @workspace/aforce-os run dev
```

Open the workspace preview pane → AForce OS.
