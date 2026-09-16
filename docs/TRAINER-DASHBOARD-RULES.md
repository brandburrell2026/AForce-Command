# Trainer dashboard — standing rules (read every turn)

1. `scoringEngine.ts` and `statusColor.ts` are PROTECTED. Never edit, move, or refactor.
2. No diagnostic or predictive language in any UI copy, ever. Recommendations only.
3. Medical redaction is server-side. A coach response must not contain the field at all.
4. Notes are append-only and versioned. Nothing is overwritten.
5. Every new surface behind `trainer_<surface>_enabled`, default off.
6. Production Neon is the Replit-managed instance. Verify against the deploy env var,
   never the Replit UI panel.
7. Brand: #0D0D0D / #C1281B / #F5F0E8 · Archivo Black / IBM Plex Mono / Inter. No new tokens.
8. Tier bands are locked. Clutch readiness high-is-good, Guardian risk low-is-good.
9. Branch → plan → review → merge. One phase, one PR.
10. Clinical practice, privacy law, or scope ambiguity → STOP AND ASK. Do not guess.
