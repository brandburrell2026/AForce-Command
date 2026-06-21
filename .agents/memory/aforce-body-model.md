---
name: AForce shared body-model input
description: Single-source-of-truth height/weight input convention for the Expo app
---

- The ONLY height/weight entry controls are the shared `components/bodyModel/{HeightField,WeightField}`. Onboarding, Edit Profile, Sweat Calculator, and the profile surface all use them — never re-introduce a per-screen TextInput/stepper for body measurements.
- Canonical model: `ProfileIdentity.bodyWeightLbs` (integer **pounds**) + `ProfileIdentity.heightCm` (integer **cm**). Components emit canonical units only; kg/ft are display conversions. Writes go through `setProfileIdentity` patches (NO server POST in this phase).
- Both fields use `onChange: (value: number | null) => void`. `WeightField` clears to null on empty/invalid input; `HeightField` is a stepper so clearing needs an explicit affordance — pass `allowClear` only on surfaces where the field is OPTIONAL (Edit Profile). Onboarding/Sweat omit `allowClear` so a value is always present.

**Why:** An earlier pass had divergent per-screen inputs and a HeightField that couldn't clear an optional height back to null — a regression vs the old cm TextInput. Parity between the two fields (both emit `number | null`) is the contract.

**How to apply:** Any body-measurement entry → reuse these two components; if the value is skippable on that surface, pass `allowClear`. Body edits feed hydration targets + sweat math ONLY — they must never award/mutate/fabricate score (Score-Protection).
