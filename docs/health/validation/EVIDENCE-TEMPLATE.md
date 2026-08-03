# Evidence Capture Template

**Last verified:** 2026-08-03
**Use:** copy this form once per validation run (one provider, one device/account
combination, one pass through a runbook). File the completed copy alongside the
squad's working notes and reference it from the `STAGE-LADDER.md` current-state
table update. Redact per `REDACTION.md` before this form is shared anywhere.

```
## Evidence Packet — <Provider> — <YYYY-MM-DD>

### Run identity
- Squad:
- Runbook version / commit SHA followed:
- Validator (who ran this):
- Independent reviewer (who will review — must differ from validator):

### Device / account
- Device model:
- OS version:
- App build SHA (git commit the build was cut from):
- Provider account type (free/paid tier, test account vs. real personal account):
- Provider hardware paired (e.g. Oura ring generation, Apple Watch model, none):

### Configuration
- Feature-flag configuration (list every health_* flag and its value for this run):
- Permission state requested:
- Permission state actually granted (may differ from requested — record what iOS/Android/provider actually reports):

### Timing
- Start time (UTC):
- Completion time (UTC):

### Data
- Metrics requested (list, referencing CanonicalHealthMetricType names):
- Metrics actually returned:
- Source attribution observed (provenanceChain / native origin, or "N/A — direct"):
- Freshness observed (age of most recent record at time of check):
- Canonical record output (attach representative sample — REDACTED, see below):

### Product surface output
- Connected Health screen: <what rendered>
- Home: <what rendered>
- Sleep: <what rendered>
- Weekly: <what rendered>
- Readiness: <what rendered>
- Evidence Engine: <what rendered>
- Screen reader label observed (state exact string read):

### Lifecycle
- Disconnect result: <what happened, including token/snapshot state after>
- Deletion result (if tested this run): <what happened>

### Attachments
- Screenshots: <file names/paths, redacted per REDACTION.md>
- Screen recording (where useful): <file name/path, redacted>
- Logs (sensitive data removed per REDACTION.md): <file name/path>

### Test result
- Acceptance criteria met (list 1–15 from ACCEPTANCE-CRITERIA.md, mark each Met / Not Met / N/A with one line of evidence pointer each):
- Test cases run (reference the runbook's §5 checklist by name; mark each Pass / Fail / Not Run):
- Gaps found (if any — each must be ticketed per VERDICT-DEFINITIONS.md PARTIAL rules):

### Verdict
- PASS / PARTIAL / FAIL (per VERDICT-DEFINITIONS.md):
- Rationale (one paragraph, referencing which criteria/test cases drove the verdict):
- Reviewer sign-off (name, date, per REVIEW-CHECKLIST.md):
```

## Filling this out honestly

- If a field doesn't apply (e.g. "provider hardware paired" for a
  cloud-only OAuth provider), write `N/A` and say why — never leave it
  blank, a blank field is indistinguishable from "forgot to check."
- "Metrics requested" vs. "metrics actually returned" is the single most
  important pair in this form — a mismatch here is exactly what
  `ACCEPTANCE-CRITERIA.md` criterion 2 (canonical normalization) and the
  Constitution's "no fabricated measurement" rule exist to catch. If a
  requested metric came back empty, say so explicitly rather than omitting
  the row.
- The "canonical record output" attachment should be an actual captured
  record (JSON or equivalent), not a paraphrase — but it must be redacted
  first (see `REDACTION.md`) since canonical records can carry device
  identifiers and precise timestamps.
