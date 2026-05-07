# Phantom Band — Vendor Tear Sheet

**AForce, Inc. · May 2026**

---

## What we're building

The **Phantom Band** is the hardware extension of AForce OS — our real-time human performance operating system. A screenless wrist wearable whose only output is a single LED edge light, color-coded to match the user's live hydration and recovery state.

Two SKUs, one electrical and firmware platform:

- **Phantom One** — premium hero band, soft-touch strap, LED edge, BLE 5.3, 7-day battery. Launch **2026**.
- **Phantom Meridian** — ceramic luxury edition, refined link bracelet, sapphire LED guide. Launch **2027**.

## What we need from you

A hardware design and manufacturing partner to take Phantom from industrial design → EVT → DVT → PVT → mass production for both SKUs.

## Volume

Quote at three tiers: **5k, 25k, 100k units**.

## Required sensors

PPG (HR + HRV), 3-axis accelerometer, gyroscope, skin temperature, ambient temperature, ambient humidity, **electrodermal / sweat conductance**, ambient light.

The sweat conductance sensor is the single most important component — it is the only sensor that gives us *direct* hydration signal instead of inference. No other consumer wearable on the market includes it.

## Required outputs

- RGB LED edge light (≥256 colors, PWM pulse-capable)
- LRA haptic motor (≥3 distinct patterns)

## Connectivity & power

- BLE 5.3 (NFC pairing optional)
- 7-day battery target
- 5 ATM / IP68 water resistance
- Wireless / magnetic puck charging

## Firmware contract

The MCU must run an **on-device wrist-to-mouth gesture classifier** (sip detection). The band publishes one snapshot per minute over BLE in the AForce snapshot schema (full schema in the RFP brief). Standard biometric fields slot into our existing multi-provider aggregator with zero new code; band-only fields (sweat, skin temp, sip detection) feed novel AForce algorithms.

## Compliance

FCC, CE, IC, RoHS, REACH required. Apple MFi strongly recommended for native iOS BLE. **Wellness-class only — no FDA / IEC 60601 work in scope.**

## Timeline

- Phantom One mass production: **Q4 2026**
- Phantom Meridian mass production: **Q2 2027**

## What we need in your proposal

1. NRE breakdown (ID, ME, EE, firmware, tooling, certifications)
2. Per-unit BOM at 5k / 25k / 100k volume tiers, **separately for each SKU**
3. MOQ, lead time, payment terms, warranty
4. Project schedule with EVT / DVT / PVT / MP dates
5. Two wearables-specific reference customers
6. Statement on IP ownership (AForce retains firmware source, ID files, tooling)

## Out of scope

FDA / medical device certification. AForce ships as wellness-class.

---

**Contact:** _founders@aforce.com_

_The full RFP brief (~8 pages, including the firmware data contract and LED state mapping) is available on request._
