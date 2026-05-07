# Phantom Band — Request for Proposal

**Issued by:** AForce, Inc.
**Document version:** 1.0
**Date issued:** May 2026
**Response deadline:** _to be set per vendor conversation_
**Primary contact:** _founders@aforce.com_

---

## 1. Executive Summary

AForce is the real-time human performance operating system. Our flagship mobile app — **AForce OS** — already ships a complete hydration and recovery engine: a 0–100 score updated continuously from biometrics, environment, and intake; an AI Coach that issues live commands; and a closed loop of products (sticks, RTDs, canisters) that move the score in real time.

The next product in the AForce loop is the **Phantom Band** — a screenless wrist wearable whose only job is to communicate the user's hydration and performance state through a single LED edge light, color-coded to match the in-app status engine.

We are seeking a hardware design and manufacturing partner to take the Phantom Band from industrial design through DVT, PVT, and into mass production for two SKUs:

- **Phantom One** — premium hero band, soft-touch strap, LED edge, BLE 5.3, 7-day battery, haptic engine. Target launch: **2026**.
- **Phantom Meridian** — luxury ceramic edition, refined link bracelet, sapphire LED guide, limited series. Target launch: **2027**.

This document defines the functional, technical, and commercial requirements your proposal should address.

---

## 2. About AForce OS

AForce OS is a React Native / Expo mobile application backed by a Node.js / PostgreSQL API server. The app is live in development with a complete feature set:

- **Hydration scoring engine** — pure, dependency-free 0–100 score model grounded in ACSM, IOM, ISO 7933, and NIOSH physiological standards.
- **AI Coach** — verdict-aware voice engine (ElevenLabs) that issues commands based on score, environment, and recent activity.
- **Multi-provider biometrics** — already aggregates snapshots from Apple Health, Oura, WHOOP, Garmin, Strava, Samsung Health, and Google Health Connect using a "freshest-wins" reduction strategy. **The Phantom Band slots into this same pipeline as one more provider.**
- **Subscription tiers** — five consumer tiers with feature gating, billed via Stripe.
- **Target scale** — engineered for 50M+ users.

The Phantom Band is the hardware extension of this loop. The OS already exists. The band is the mirror.

---

## 3. Product Brief

### 3.1 Phantom One — Hydration & Performance Band

| Attribute | Specification |
|---|---|
| Tier | Hero / Premium |
| Launch target | 2026 |
| Strap material | Soft-touch fluoroelastomer or equivalent |
| Body material | Anodized aluminum or premium polymer |
| Display | **None.** Single LED edge light only. |
| LED | RGB edge light, multi-color, pulse-capable |
| Connectivity | BLE 5.3, optional NFC for pairing |
| Battery life target | **7 days** typical use |
| Charging | Wireless / magnetic puck preferred |
| Water resistance | **5 ATM / IP68** minimum |
| Weight ceiling | 35 g (band + module) |
| Wrist size range | 130–210 mm circumference |
| Target retail | _to be confirmed by commercial conversation_ |

### 3.2 Phantom Meridian — Ceramic Luxury Edition

| Attribute | Specification |
|---|---|
| Tier | Luxury / Limited |
| Launch target | 2027 |
| Body material | High-grade ceramic (zirconia or equivalent) |
| Bracelet | Refined link bracelet, jewelry-grade finish |
| LED guide | **Sapphire crystal** light pipe |
| Internals | Identical sensor and firmware platform to Phantom One |
| Production | Limited series |

The two SKUs share **one electrical and firmware platform**. Mechanical and material differentiation only. Your proposal should price both SKUs against this shared platform.

### 3.3 Volume Targets

Please quote at three volume tiers:

- **5,000 units** (EVT + early sell-through)
- **25,000 units** (Year 1 production)
- **100,000 units** (Year 2 production)

---

## 4. Industrial Design Direction

Reference renders are attached separately as `phantom-overview.png` (4-quadrant brand sheet showing both SKUs in hero, LED state, and exploded-component views).

**Design language:** WHOOP-cinematic dark aesthetic. Premium, futuristic, screenless. The product communicates one thing visually: a single edge of color on the wrist that tells the wearer what state their body is in.

**Critical design constraints:**
- No screen, no notifications, no UI surface beyond the LED edge.
- LED must be visible in direct sunlight and dim enough at night to not disturb sleep.
- Strap must be quick-release for both SKUs.
- Module must be common across both SKUs to share tooling and firmware.

---

## 5. Functional & Technical Requirements

### 5.1 Required Sensors

| Sensor | Purpose | Notes |
|---|---|---|
| PPG (green + red LED) | Heart rate, HRV | Required for recovery aggregation |
| 3-axis accelerometer | Steps, motion, gesture detection | Required for sip-detection classifier |
| Gyroscope | Wrist rotation, gesture confidence | Pairs with accelerometer |
| Skin temperature | Heat-stress contribution | Single-point thermistor acceptable |
| Ambient temperature | Environmental input to score | Required |
| Ambient humidity | Environmental input to score | Required |
| **Electrodermal / sweat conductance** | **Direct hydration signal** | **Highest-value sensor — the single feature that no other tracker provides** |
| Ambient light | Auto-dim LED for sleep | Required |

### 5.2 Required Outputs

| Output | Specification |
|---|---|
| LED edge light | RGB, ≥256 colors, PWM-controllable pulse patterns |
| Haptic motor | LRA, ≥3 distinct patterns (sip-confirm, alert, low-battery) |

### 5.3 Microcontroller & Compute

The MCU must be capable of running a **lightweight on-device gesture classifier** for wrist-to-mouth sip detection. This is a hard requirement — uploading raw accelerometer streams to the phone for classification is unacceptable from a battery perspective.

### 5.4 Storage & Sync

- **24+ hours** of cached snapshots when disconnected from the phone
- Snapshots flushed to phone over BLE on reconnect
- Time sync via BLE Current Time Service

### 5.5 OTA

Over-the-air firmware updates required, with cryptographic signature verification.

---

## 6. Firmware Data Contract

This is the most critical section of this RFP. Most wearable proposals treat firmware as an afterthought; the result is a band that ships dirty data and breaks the consuming app's algorithms. The Phantom Band's value is entirely in the data it publishes. **Your firmware team must build to this contract from day one.**

### 6.1 Snapshot Cadence

- One snapshot per minute, published via BLE notification.
- If disconnected, batch into the onboard buffer and flush in chronological order on reconnect.
- All timestamps in Unix milliseconds (ms since epoch). Time sync via BLE Current Time Service on reconnect.

### 6.2 Snapshot Schema

```ts
interface PhantomBandSnapshot {
  // Required on every snapshot
  fetchedAt: number;            // Unix ms — used for "freshest-wins" reduction

  // Standard biometric fields — auto-aggregated by AForce OS
  // (these slot into the existing multi-provider pipeline)
  heartRateBpm?: number;        // beats/min
  hrvMs?: number;               // RMSSD in ms
  steps?: number;               // cumulative steps for the day
  workoutMinutes?: number;      // active minutes today
  strain?: number;              // 0..21 (WHOOP-compatible scale)
  sleepMinutes?: number;        // last sleep session duration
  recoveryPct?: number;         // 0..100 readiness

  // Band-only fields — feed novel AForce algorithms
  skinTempC?: number;           // skin contact temperature
  ambientTempC?: number;        // ambient sensor reading
  ambientHumidityPct?: number;  // ambient sensor reading
  sweatConductanceUS?: number;  // microsiemens, raw electrodermal
  sipDetected?: boolean;        // gesture classifier output, this minute

  // Diagnostics (optional but recommended)
  batteryPct?: number;          // 0..100
  signalQuality?: number;       // 0..1, sensor contact quality
  firmwareVersion?: string;
}
```

### 6.3 BLE Characteristics

We propose the following GATT structure (open to vendor refinement):

- **AForce Service** UUID: `<reserved>`
  - **Snapshot Notification** characteristic — publishes `PhantomBandSnapshot` as MessagePack or CBOR-encoded payload
  - **Command** characteristic — phone → band (LED color override, haptic pattern trigger, time sync)
  - **Buffer Sync** characteristic — bulk flush of cached snapshots on reconnect
  - **OTA Update** characteristic — firmware payload chunks

### 6.4 Reference Adapter

We will provide a TypeScript adapter (`bandToProviderSnapshot`) that maps your `PhantomBandSnapshot` directly into the existing AForce biometrics aggregator. **The standard biometric fields require zero new code on our side** — they work the day your firmware ships them.

---

## 7. LED State Mapping

The LED edge is the only visual surface. It must mirror the AForce hydration status colors so the wearable and the app are visually consistent at all times.

| App status | LED color | Pulse pattern |
|---|---|---|
| Optimal (score 85–100) | Green | Slow, breathing |
| Stable (70–84) | AForce lime `#B6FF00` | Steady |
| Declining (50–69) | Amber | Slow pulse |
| Risk (30–49) | Orange | Medium pulse |
| Critical (0–29) | Red | Fast pulse |

**System patterns** (independent of score):
- Sip confirmation — single brief lime flash + haptic tap
- Low battery — three slow red dimming pulses
- BLE disconnected — LED off
- Pairing mode — alternating blue and lime

The phone is the source of truth for color state. The band defaults to a self-derived fallback state (based on its onboard sweat / HR data) when disconnected for >30 minutes.

---

## 8. Compliance & Certification

### Required for both SKUs
- **FCC Part 15** (US)
- **CE / RED** (EU)
- **IC** (Canada)
- **RoHS** (restricted substances)
- **REACH** (EU chemical compliance)

### Recommended
- **Apple MFi** — required for native iOS background BLE behavior (high priority)
- **Bluetooth SIG** qualification

### Explicitly out of scope (v1)
- **IEC 60601 / FDA medical device path** — the Phantom Band ships as a **wellness-class** consumer product. No medical claims will be made. Please do **not** scope or quote FDA work.

---

## 9. Project Milestones

We expect a standard EVT → DVT → PVT → MP cadence. Please propose dates relative to PO signing.

| Milestone | Definition | Vendor deliverable |
|---|---|---|
| **Kickoff** | PO signed, NRE initiated | Project plan, BOM v1, reference architecture |
| **EVT** (Engineering Validation Test) | First working units, all sensors functional | 50 units, sensor accuracy test reports |
| **DVT** (Design Validation Test) | Production-intent industrial design | 200 units, reliability + drop test reports |
| **PVT** (Production Validation Test) | Full production line trial run | 1,000 units, FAI report, certifications complete |
| **MP** (Mass Production) | Volume manufacturing | Per Section 3.3 volume tiers |

Phantom One mass production ship target: **Q4 2026.**
Phantom Meridian mass production ship target: **Q2 2027.**

---

## 10. Commercial Terms — Quote Required

Please structure your proposal with the following line items:

### 10.1 NRE (Non-Recurring Engineering)
- Industrial design
- Mechanical engineering
- Electrical engineering
- Firmware development
- Tooling (injection molds for Phantom One; ceramic tooling for Meridian)
- Certifications (FCC, CE, IC, etc.)

### 10.2 Per-unit BOM at three volume tiers
- 5,000 units
- 25,000 units
- 100,000 units

Quoted separately for **Phantom One** and **Phantom Meridian**.

### 10.3 Operational terms
- MOQ (minimum order quantity) per SKU
- Lead time from PO to first MP units
- Payment terms
- Warranty period and DOA replacement policy

### 10.4 IP & Ownership
- **AForce retains ownership** of all firmware source code, industrial design files, and tooling. State whether this is acceptable; if not, propose alternative terms.
- Vendor may retain IP for any underlying reference platform components, provided they are clearly disclosed at proposal time.

---

## 11. Vendor Deliverables Expected

Beyond the manufactured units themselves, your engagement must deliver:

- **Bill of Materials** (BOM) with target component vendors and second-source options
- **Mechanical CAD** (STEP + native files) at each milestone
- **Firmware reference architecture** + complete source code
- **Sensor accuracy test reports** for HR, HRV, sweat conductance, skin temp (validated against gold-standard reference instruments)
- **Reliability test reports** (drop, water immersion, sweat exposure, salt-spray, UV)
- **Certifications** (FCC, CE, IC, RoHS, REACH, MFi if scoped)
- **Production line first-article inspection** (FAI) report

---

## 12. Required Vendor Background

Please include with your proposal:

- Two reference customers in **wearables specifically** (consumer electronics references alone are insufficient — wrist-worn or body-worn experience is required)
- Sensor accuracy track record — published or shareable
- Manufacturing facility location(s) and certifications (ISO 9001, ISO 13485 if applicable)
- Capacity at each of the three volume tiers in Section 3.3
- Statement on conflict-mineral compliance and labor practices

---

## 13. Submission Instructions

Please submit your proposal as a single PDF including:

1. Executive summary (1 page)
2. Industrial design direction (renders, materials)
3. Reference architecture (block diagram, MCU + sensor selection)
4. Firmware approach (how you will deliver the data contract in Section 6)
5. Compliance plan (Section 8)
6. Project schedule (Section 9)
7. Commercial terms (Section 10)
8. Vendor background (Section 12)

**Submission contact:** _founders@aforce.com_
**Questions:** Submit in writing before the proposal deadline. Responses will be shared with all vendors in process.

---

## Appendix A — AForce Hydration Status Engine

The Phantom Band's LED color is driven by the AForce hydration status engine, a pure 0–100 score model. Status thresholds:

| Score range | Status | LED color |
|---|---|---|
| 85–100 | OPTIMAL | Green |
| 70–84 | STABLE | AForce lime |
| 50–69 | DECLINING | Amber |
| 30–49 | RISK | Orange |
| 0–29 | CRITICAL | Red |

The score is recomputed every minute on the phone. The band receives updated color state via the **Command** BLE characteristic.

## Appendix B — Reference Documents (provided separately)

- `phantom-overview.png` — 4-quadrant brand sheet
- AForce design tokens (Tokens Studio format) — color palette, typography
- AForce investor pitch deck — context on the broader product loop

---

_End of document. AForce, Inc. © 2026._
