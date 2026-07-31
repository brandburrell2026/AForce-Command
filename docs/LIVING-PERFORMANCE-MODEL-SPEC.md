# §61 — Living Performance Model™ Specification (Amended & Expanded)

**Status:** Build Now (daily lesson — **shipped**) · Phase 2 (Your Body's Manual, Confidence
Journey) · Phase 4 (Legacy summary)
**Amended by:** Founder Decisions 1 and 5 · **Updated:** 2026-07-22

> **§61 is amended and expanded, never duplicated** (Founder Decision 5). Build Rule 6 forbids
> building a parallel system alongside an existing one. The Living Performance Model™ keeps its
> section number, its shipped behavior, and its tests.

---

## 1. Purpose

The Living Performance Model™ reflects back what the user's own body has taught the OS. It is the
voice of Constitution Principle 13: *your body teaches AForce OS. AForce OS listens, remembers,
and reflects what it learned back to you. It is never the one claiming to know best.*

## 2. What already ships (unchanged)

The daily lesson is **built, headless-tested, and live** at
`artifacts/aforce-os/utils/intelligence/livingPerformanceModel.ts`.

| Existing behavior | Status |
|---|---|
| Reads the §59 Personal Response Library | Unchanged |
| Surfaces the single most grounded takeaway for today | Unchanged |
| Qualification: category READY + notable outcome + confidence above the config floor | Unchanged |
| **Silent Intelligence on-track state** — "You're exactly where you should be" when nothing stands out | Unchanged |
| **No fabrication** — empty/low-confidence/steady library yields on-track, never a manufactured lesson | Unchanged |
| Pure + RN-free; Score-Protection tested | Unchanged |
| Structured output only; copy governed by `livingPerformanceLanguage.ts` and locale keys | Unchanged |

**The amendment changes the source, not the surface contract.** Existing exports, signatures, and
tests stay green (`INTELLIGENCE-VALIDATION-MATRIX.md` M-1).

## 3. The amendment

### 3.1 Additional source

The daily lesson may **additionally** draw on the §38 Performance Knowledge Graph™, not only the
§59 Personal Response Library. §38 becomes an *additional* input — §59 remains a source, and the
existing qualification and on-track rules apply unchanged to both.

### 3.2 Your Body's Manual — specified as the user-facing read of §38

Previously named and phase-tagged but unspecified. It is now defined as **the accumulated,
plain-language record of what this person's body has demonstrated** — the natural home for the
graph.

| Rule | Detail |
|---|---|
| Source | §38 edges, with provenance |
| Register | "your body taught us" |
| Evidence | Every entry carries confidence, observation period, evidence count |
| Contradictions | Shown, never hidden — consistent with §40 |
| Never a graph | Users see plain language, never nodes or edges |
| Phase | Phase 2; §38 must be complete first |

### 3.3 Confidence Journey — specified as §41 provenance confidence over time

Defined as **the history of how confident the OS has become about this person**, drawn from §41
provenance records. It shows the relationship deepening — the mechanical expression of
Principle 12: *the OS exists to learn this person so well that every future recommendation becomes
more personal, more trusted, and more effortless than the last.*

Phase 2; §41 must be complete first.

### 3.4 Legacy summary — unchanged, Phase 4

Locks carry forward exactly:

- **Never prevention or causal medical language.** Never "prevented X events."
- Always completed behavior: "completed X commands, improved Y%, thank you for showing up."
- Phase 4, with language review before any surface.

## 4. Preserved locks (all carry forward)

| # | Lock |
|---|---|
| 1 | **"Your body taught us"** — never "what I learned about [name]". A hard compliance rule, not a style preference. |
| 2 | **Silent Intelligence** — when on track, say so plainly. Silence and "you're exactly where you should be" are valid outputs. |
| 3 | **No fabrication** — never invent a lesson to fill a slot. |
| 4 | **Score Protection** — reads derived outcomes only; never awards, mutates, or fabricates score. |
| 5 | **Pure and RN-free** — runs under the vitest pure runner. |
| 6 | **Structured output only** — copy lives in language modules and locale keys, never inline. |
| 7 | **Legacy summaries** never use prevention or causal medical language. |

## 5. Language gate

§42 applies to all expanded surfaces. Banned vocabulary is absolute
(`governance/CLAIMS-REGISTER.md` §1). The existing daily lesson is already compliant and is
**approved and shipped**; the expansion surfaces are not yet approved
(`CLAIMS-REGISTER.md` §7).

## 6. Validation

`INTELLIGENCE-VALIDATION-MATRIX.md` — universal V-1…V-8 plus M-1…M-4. **M-1 (existing daily-lesson
tests still green) is the regression gate on the entire amendment.**
