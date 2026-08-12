# Wave-2 PR3 — Legacy vs Canonical Health-Signal Shadow Diff

Generated 2026-08-03 by `services/health/__tests__/canonicalShadowDiff.test.ts`
(`SHADOW_REPORT=1 vitest run …canonicalShadowDiff.test.ts`). Frozen clock; deterministic.

**Scope:** pre-wiring characterization of the NOT-WIRED score-shaped adapter
(`toReadinessBiometrics`) vs today's legacy `state.biometrics` path, plus a
FIREWALLED arm (provider-owned composites stripped). The production flag
`health_canonical_consumers` is untouched and gates different surfaces.

## Summary

```
cases compared: 56 (28 fixtures × 2 clocks × 3 arms)
legacy≠canonical score: 23/56
band changes: 0
command changes: 0
canonical≠firewalled score (proprietary influence): 10/56
```

## Per-fixture rows

| Fixture | Clock | Legacy score/band/Δhealth | Canonical score/band/Δhealth | Firewalled score/band/Δhealth | Command changed |
|---|---|---|---|---|---|
| APPLE_ONLY | intake@now | 46/RISK/5 | 48/RISK/7 | 48/RISK/7 | no |
| APPLE_ONLY | intake@-30m | 14/CRITICAL/5 | 16/CRITICAL/7 | 16/CRITICAL/7 | no |
| HC_ONLY | intake@now | 43/RISK/2 | 43/RISK/2 | 43/RISK/2 | no |
| HC_ONLY | intake@-30m | 14/CRITICAL/2 | 14/CRITICAL/2 | 14/CRITICAL/2 | no |
| SAMSUNG_VIA_HEALTH_CONNECT | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| SAMSUNG_VIA_HEALTH_CONNECT | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| OURA_DIRECT | intake@now | 41/RISK/0 | 46/RISK/5 | 46/RISK/5 | no |
| OURA_DIRECT | intake@-30m | 12/CRITICAL/0 | 17/CRITICAL/5 | 17/CRITICAL/5 | no |
| WHOOP_DIRECT | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| WHOOP_DIRECT | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| OURA_DIRECT_PLUS_VIA_APPLE | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| OURA_DIRECT_PLUS_VIA_APPLE | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| RESTING_HR_EXPIRED | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| RESTING_HR_EXPIRED | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| RESTING_HR_NEVER_SYNCED | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| RESTING_HR_NEVER_SYNCED | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| HRV_METHOD_CONFLICT | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| HRV_METHOD_CONFLICT | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| SLEEP_OVERLAP_AND_CROSS_ORIGIN | intake@now | 41/RISK/0 | 43/RISK/2 | 43/RISK/2 | no |
| SLEEP_OVERLAP_AND_CROSS_ORIGIN | intake@-30m | 12/CRITICAL/0 | 14/CRITICAL/2 | 14/CRITICAL/2 | no |
| PARTIAL_PERMISSIONS | intake@now | 46/RISK/5 | 46/RISK/5 | 46/RISK/5 | no |
| PARTIAL_PERMISSIONS | intake@-30m | 17/CRITICAL/5 | 17/CRITICAL/5 | 17/CRITICAL/5 | no |
| NO_DATA | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| NO_DATA | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| PROVIDER_SCORE_DIRECT | intake@now | 41/RISK/0 | 42/RISK/1 | 41/RISK/0 | no |
| PROVIDER_SCORE_DIRECT | intake@-30m | 12/CRITICAL/0 | 13/CRITICAL/1 | 12/CRITICAL/0 | no |
| PROVIDER_SCORE_AGGREGATOR_PLUS_DIRECT | intake@now | 41/RISK/0 | 43/RISK/2 | 41/RISK/0 | no |
| PROVIDER_SCORE_AGGREGATOR_PLUS_DIRECT | intake@-30m | 12/CRITICAL/0 | 14/CRITICAL/2 | 12/CRITICAL/0 | no |
| PROVIDER_SCORE_RELAYED_ONLY | intake@now | 41/RISK/0 | 43/RISK/2 | 41/RISK/0 | no |
| PROVIDER_SCORE_RELAYED_ONLY | intake@-30m | 12/CRITICAL/0 | 14/CRITICAL/2 | 12/CRITICAL/0 | no |
| PROVIDER_SCORE_DIRECT_DUPLICATE_SAME_DAY | intake@now | 41/RISK/0 | 43/RISK/2 | 41/RISK/0 | no |
| PROVIDER_SCORE_DIRECT_DUPLICATE_SAME_DAY | intake@-30m | 12/CRITICAL/0 | 14/CRITICAL/2 | 12/CRITICAL/0 | no |
| PROVIDER_SCORE_FORGED_DIRECT | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| PROVIDER_SCORE_FORGED_DIRECT | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| PROVIDER_SCORE_FORGED_CAPABLE_WRONG_KIND | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| PROVIDER_SCORE_FORGED_CAPABLE_WRONG_KIND | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| PRIORITY_BEATS_FRESHER_LOWER_PRIORITY | intake@now | 41/RISK/0 | 43/RISK/2 | 43/RISK/2 | no |
| PRIORITY_BEATS_FRESHER_LOWER_PRIORITY | intake@-30m | 12/CRITICAL/0 | 14/CRITICAL/2 | 14/CRITICAL/2 | no |
| STALE_TOP_PRIORITY_LOSES_TO_FRESH_LOWER_PRIORITY | intake@now | 41/RISK/0 | 43/RISK/2 | 43/RISK/2 | no |
| STALE_TOP_PRIORITY_LOSES_TO_FRESH_LOWER_PRIORITY | intake@-30m | 12/CRITICAL/0 | 14/CRITICAL/2 | 14/CRITICAL/2 | no |
| SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| ZERO_SLEEP_SAMPLE | intake@now | 36/RISK/-5 | 36/RISK/-5 | 36/RISK/-5 | no |
| ZERO_SLEEP_SAMPLE | intake@-30m | 7/CRITICAL/-5 | 7/CRITICAL/-5 | 7/CRITICAL/-5 | no |
| NO_SLEEP_SAMPLE | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| NO_SLEEP_SAMPLE | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| STALE_HRV_30D | intake@now | 36/RISK/-5 | 41/RISK/0 | 41/RISK/0 | no |
| STALE_HRV_30D | intake@-30m | 7/CRITICAL/-5 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| STALE_RECOVERY_30D | intake@now | 36/RISK/-5 | 41/RISK/0 | 41/RISK/0 | no |
| STALE_RECOVERY_30D | intake@-30m | 7/CRITICAL/-5 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| STALE_ACTIVITY_30D | intake@now | 41/RISK/0 | 41/RISK/0 | 41/RISK/0 | no |
| STALE_ACTIVITY_30D | intake@-30m | 0/CRITICAL/0 | 12/CRITICAL/0 | 12/CRITICAL/0 | no |
| REAL_DEVICE_SLEEP_DISCREPANCY | intake@now | 41/RISK/0 | 41/RISK/0 | 40/RISK/-1 | no |
| REAL_DEVICE_SLEEP_DISCREPANCY | intake@-30m | 12/CRITICAL/0 | 12/CRITICAL/0 | 11/CRITICAL/-1 | no |
