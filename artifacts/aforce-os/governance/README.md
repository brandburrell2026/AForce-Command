# ⚠️ Governance lives at `/governance/` — not here

**This directory holds no governance documents. It must never hold any again.**

Per **Founder Decision 3 (2026-07-22)**, the repository-root `/governance/` directory is the
**sole authoritative governance source** for AForce OS.

## Where to go

| You want | Read |
|---|---|
| Locked principles | `/governance/AForce-Constitution.md` |
| The build contract | `/governance/Claude-Code-Build-Rules.md` |
| Per-section status | `/governance/Architecture-Appendix.md` |
| Which document wins a conflict | `/governance/SPECIFICATION-AUTHORITY.md` |
| Phase status | `/governance/FEATURE-PHASE-MATRIX.md` |
| Settled founder rulings | `/governance/decisions/` |
| Canonical specifications | `/docs/AFORCE-OS-MASTER-SPEC.md` |

## Why this directory was emptied

This directory previously held five duplicated governance files. The copy of
`Architecture-Appendix.md` had **drifted and become dangerously stale**: it was missing the
nine-line **DR-001** amendment and still presented §35 as unamended "Build Now".

Because this directory sits *inside the app source tree*, it was the copy an agent working in
`artifacts/aforce-os` was most likely to open — and it told that agent that **HydroScan may write
into HydroState, Performance Memory, and Command Confidence**, which DR-001 explicitly forbids.
That is a Score-Protection breach waiting to happen.

A full diff of all five mirrored files was taken before removal. The only mirror-only line in the
entire directory was the superseded status text itself. **No unique content existed, and none was
lost.** Full record: `/governance/SPECIFICATION-RECONCILIATION-REGISTER.md` §4.

## Enforcement

`scripts/src/check-governance-drift.mjs` fails CI if any `.md` file other than this README appears
here. Do not re-add governance copies — reference `/governance/` instead.
