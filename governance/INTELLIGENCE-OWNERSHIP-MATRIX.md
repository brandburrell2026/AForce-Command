# Intelligence Ownership Matrix

**Status:** FROZEN (Phase 3.5) · **Frozen:** 2026-07-22 · **Authority:** tier 3

What each system owns, consumes, produces, persists, may mutate, must never mutate, may emit,
must never emit — and its authoritative store, required upstream systems, required downstream
gate, and current status.

**Ownership is exclusive.** Two systems may not own the same concept. Any future change requires
the change-control process in `INTELLIGENCE-CHANGE-CONTROL.md`.

---

## Core Intelligence

### HydroState™ (§1–17)
| Field | Value |
|---|---|
| **Owns** | The hero metric; performance state; band classification |
| **Consumes** | Adaptive Profile, intake, environment, sleep readiness, wearables |
| **Produces** | Score, 4-band performance state, 5-band status |
| **Persists** | `aforce_user_state`, `aforce_score_snapshots` |
| **May mutate** | Its own score — **only** from completed behaviour |
| **Must never mutate** | Anything else; never mutated *by* advisory systems |
| **May emit** | Score, band, state label |
| **Must never emit** | A medical claim; a competing metric |
| **Authoritative store** | PostgreSQL `aforce_user_state` |
| **Required upstream** | Profile, intake, context |
| **Required downstream gate** | none (not intelligence-derived copy) |
| **Status** | **Live** |

### Command Confidence™ (§58)
| Field | Value |
|---|---|
| **Owns** | Confidence in *today's command* |
| **Consumes** | Today-behaviour, fresh biometrics/weather |
| **Produces** | high / medium / low |
| **Persists** | none (derived at read) |
| **May mutate** | nothing |
| **Must never mutate** | Score; HydroState |
| **May emit** | Confidence display (§58 UI-only) |
| **Must never emit** | A prediction; a second score |
| **Authoritative store** | derived |
| **Required upstream** | HydroState, context |
| **Required downstream gate** | §42 for any intelligence-derived copy |
| **Status** | **Live** |
| **Frozen constraint** | **Adherence / follow-rate is deliberately NOT an input** — wiring it would let follow-rate silently upgrade confidence (Score-Protection breach) |

### Performance Memory™
| Field | Value |
|---|---|
| **Owns** | The historical record of completed behaviour |
| **Consumes** | Ledger, check-ins, snapshots |
| **Produces** | Streaks, trends, unified memory |
| **Persists** | Ledger + domain tables (append-only) |
| **May mutate** | Append only |
| **Must never mutate** | **Never overwrites history**; never score |
| **May emit** | Historical summaries |
| **Must never emit** | Prediction; diagnosis |
| **Authoritative store** | PostgreSQL domain ledgers |
| **Required upstream** | completed behaviour |
| **Required downstream gate** | §42 |
| **Status** | **Live** |

### Evidence Engine™
| Field | Value |
|---|---|
| **Owns** | Explanation — *why* |
| **Consumes** | All engines; graph provenance |
| **Produces** | Plain-language explanation from the user's own data |
| **Persists** | none |
| **May mutate** | nothing |
| **Must never mutate** | Score; any record |
| **May emit** | Explanations — **after §42** |
| **Must never emit** | Causal claims; forecasts; anything without provenance |
| **Authoritative store** | n/a |
| **Required upstream** | any producing system |
| **Required downstream gate** | **§42 — mandatory** |
| **Status** | **Live** (unchanged by Phase 4) |

### Adaptive Response Engine™ (§59)
| Field | Value |
|---|---|
| **Owns** | Personal Response Library; What Worked; Confidence After Action |
| **Consumes** | Ledger, outcomes |
| **Produces** | Per-category response entries |
| **Persists** | Local + server ledger |
| **May mutate** | Its own library |
| **Must never mutate** | Score; HydroState |
| **May emit** | Cause-and-effect **from the user's own history only** |
| **Must never emit** | *risk · injury · diagnosis · prevent* |
| **Authoritative store** | ledger |
| **Required upstream** | completed behaviour |
| **Required downstream gate** | §42 |
| **Status** | **Live** |

### Living Performance Model™ (§61)
| Field | Value |
|---|---|
| **Owns** | "Your body taught us" reflection |
| **Consumes** | §59 library; **§38 graph (expansion, not built)** |
| **Produces** | Daily lesson; on-track state; (future) Manual, Journey, Legacy |
| **Persists** | `aforce_lpm_snapshots` *(designed, not created)* |
| **May mutate** | its own snapshot |
| **Must never mutate** | Score; graph |
| **May emit** | Daily lesson — **after §42** |
| **Must never emit** | Prevention/causal medical language; a manufactured lesson |
| **Authoritative store** | server (designed) |
| **Required upstream** | §59 (+§38 future) |
| **Required downstream gate** | §42 |
| **Status** | **Live** (daily lesson) · **Specified** (expansion) |

## Learning Intelligence

### Performance Knowledge Graph™ (§38)
| Field | Value |
|---|---|
| **Owns** | Relationship + provenance substrate |
| **Consumes** | Canonical intelligence events; §59 library |
| **Produces** | Nodes, edges, observation counts, contradictions, evidence state |
| **Persists** | `aforce_graph_nodes`, `aforce_graph_edges` **(defined, NOT deployed)** |
| **May mutate** | Its own nodes/edges |
| **Must never mutate** | HydroState; score; Performance Memory; §59 library |
| **May emit** | **Nothing user-facing.** Structured records only, via the adapter boundary |
| **Must never emit** | A graph visualization; a score; user copy |
| **Authoritative store** | PostgreSQL (pending deploy — R-21) |
| **Required upstream** | Normalization |
| **Required downstream gate** | Evidence Engine adapter → §42 |
| **Status** | **Partially Built** |

### Prediction Engine™ (§39)
| Field | Value |
|---|---|
| **Owns** | Forward projection of the user's own demonstrated pattern |
| **Consumes** | §38 edges; HydroState **read-only** |
| **Produces** | Projections with state, confidence, expiry |
| **Persists** | `aforce_predictions` *(designed, not created)* |
| **May mutate** | its own projections |
| **Must never mutate** | **HydroState; Today's Command; score** |
| **May emit** | Projections — **only after §42** |
| **Must never emit** | Public copy directly; certainty; health forecasts |
| **Authoritative store** | server (designed) |
| **Required upstream** | §38 |
| **Required downstream gate** | Evidence Engine → **§42 (blocking)** |
| **Status** | **Specified** — not authorized |

### Performance DNA™ (§40)
| Field | Value |
|---|---|
| **Owns** | Durable qualitative patterns |
| **Consumes** | §38 edges over time |
| **Produces** | Pattern states + evidence for **and against** |
| **Persists** | `aforce_dna_patterns` *(designed, not created)* |
| **May mutate** | its own patterns |
| **Must never mutate** | **HydroState; score.** **Must never create a score of any kind.** |
| **May emit** | Patterns with contradictions — after §42 |
| **Must never emit** | A DNA score; genetic/deterministic/permanent framing |
| **Authoritative store** | server (designed) |
| **Required upstream** | §38 |
| **Required downstream gate** | §42 (blocking) |
| **Status** | **Specified** — not authorized |

## Interaction Intelligence

### §42 Language and Claims Gate
| Field | Value |
|---|---|
| **Owns** | The emit / suppress / transform decision |
| **Consumes** | Claim candidates; adapter verdict; policy + locale registries |
| **Produces** | Gate decisions with reasons and audit |
| **Persists** | audit records *(designed)* |
| **May mutate** | nothing |
| **Must never mutate** | Score; any record; **never originates a recommendation** |
| **May emit** | A decision + governed copy key |
| **Must never emit** | Rendered user copy; generative rewrites |
| **Authoritative store** | `CLAIMS-REGISTER.md` (policy) |
| **Required upstream** | Evidence Engine adapter |
| **Required downstream gate** | terminal — it *is* the gate |
| **Status** | **Partially Built** |

### AI Coach (§64)
| Field | Value |
|---|---|
| **Owns** | Conversational surface |
| **Consumes** | HydroState, memory, §59 patterns, Recovery Window |
| **Produces** | Conversation |
| **Persists** | conversation state |
| **May mutate** | nothing |
| **Must never mutate** | Score; HydroState |
| **May emit** | Coach copy — **must never bypass §42** |
| **Must never emit** | Diagnosis; unqualified prediction |
| **Authoritative store** | n/a |
| **Required upstream** | Core Intelligence |
| **Required downstream gate** | **§42 — mandatory** |
| **Status** | **Live** |

### HydroScan™ (§28–37)
| Field | Value |
|---|---|
| **Owns** | Advisory product/decision intelligence |
| **Consumes** | Camera, context |
| **Produces** | Advisory scan rows |
| **Persists** | `aforce_hydro_scans` (append-only) |
| **May mutate** | its own history |
| **Must never mutate** | **HydroState, band, Performance Memory, recovery score — permanent (DR-001)** |
| **May emit** | Advisory signals — after §42 |
| **Must never emit** | Proof of hydration status; dehydration; diagnosis; treatment need |
| **Authoritative store** | PostgreSQL |
| **Required upstream** | none |
| **Required downstream gate** | §42 |
| **Status** | **Live** (base scan) |

### Explainability (§52) · Response Timeline (§60)
| Field | Value |
|---|---|
| **Owns** | User route into reasoning (§52); time-bucketed query over Performance Memory (§60) |
| **May mutate** | nothing |
| **Must never emit** | anything bypassing §42 |
| **Required downstream gate** | §42 |
| **Status** | §52 **Specified** · §60 **Built-Hidden** (`response_timeline_enabled` OFF, also data-gated 60–90 days) |

## Operating modes

### Guardian™
| Field | Value |
|---|---|
| **Owns** | Readiness and recovery oversight; escalation |
| **May mutate** | nothing |
| **Must never emit** | *injury-risk protection* · injury prediction/prevention · medical-risk assessment |
| **Canonical description** | **"Performance readiness and recovery oversight."** (DR-003) |
| **Required downstream gate** | §42 (strict surface) |
| **Status** | **Specified** (Phase 3) |

### Clutch™
| Field | Value |
|---|---|
| **Owns** | High-demand preparation mode |
| **May mutate** | monitoring frequency; never score |
| **Required downstream gate** | §42 |
| **Status** | **Specified** (Phase 3) |

## Context Intelligence

### Tomorrow Load Forecast™ (§22) · Performance Drift™ (§27) · Environmental Pressure™ · Climate Profile™
| Field | Value |
|---|---|
| **Owns** | Forward demand (§22) · slow directional movement (§27) · current external load · persistent local climate adaptation |
| **Consumes** | Weather, calendar, location, history |
| **Produces** | Context signals |
| **Persists** | `aforce_demand_snapshots` / derived |
| **May mutate** | their own signals |
| **Must never mutate** | **HydroState directly; score** |
| **May emit** | Context — **labelled context-based, never personal learning** |
| **Must never emit** | **A command.** Context informs Core; it never commands (D-07) |
| **Required downstream gate** | §42 |
| **Status** | **Live** (Environmental Pressure, Climate Profile) · **Specified** (§22, §27 surfaces) |
