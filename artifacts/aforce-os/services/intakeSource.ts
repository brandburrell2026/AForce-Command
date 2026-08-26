/**
 * INTAKE PROVENANCE — the one canonical answer to "which surface created this?"
 *
 * Build 65 recorded two 12 oz intakes 52 seconds apart from a single reported
 * tap. The mechanism is still unknown, and it could not be narrowed because
 * every row carried `entry_source = NULL`: the column, the wire contract and the
 * server write all existed, but no client call site ever populated it. Two
 * events that could have been told apart in one query instead needed a code
 * audit that ruled out five hypotheses and still did not identify the cause.
 *
 * This module exists so a recurrence is attributable from data alone —
 * surface + client_event_id + timestamp + durable result — WITHOUT claiming the
 * duplicate defect is fixed. It is diagnostics, not a remedy.
 *
 * ONE SYSTEM, NOT TWO. `routes/aforce/intakeSchema.ts` already accepted a
 * capture-MODE enum (`tap`/`scan_log`/`voice`/`offline_replay`/`sensor`). Those
 * describe HOW an entry was captured, which cannot distinguish Home from
 * Hydration from Protocol — every one of them is a "tap". The list below is the
 * superset: the legacy values are retained verbatim so historical rows stay
 * valid and older clients keep working, and the surface values are added
 * alongside. The server enum is widened to exactly this list. There is no second
 * provenance field and no parallel vocabulary.
 *
 * PROVENANCE IS NOT IDENTITY. This says which screen produced the write. It
 * never carries a user id, a name, a location or any free text — the value is
 * always one of the literals below, so the field cannot become a PII channel.
 */

/**
 * Ordered: surfaces first, then the capture modes that predate them.
 * Keep in sync with the server enum in `routes/aforce/intakeSchema.ts` — the
 * contract test in `services/__tests__/intakeSource.contract.test.ts` fails if
 * they drift.
 */
export const INTAKE_SOURCES = [
  /** Home — the primary Log Water CTA and its amount picker. */
  'home',
  /** Hydration tab — the manual log affordance on the hydration screen. */
  'hydration',
  /** Scan — a beverage logged from a HydroScan result or category tray. */
  'scan',
  /** Protocol — logging driven by a protocol/command step. */
  'protocol',
  /** Recovery Coach — the "I've had the water" acknowledgement (flag-gated). */
  'recovery',
  /** Voice — spoken logging through the voice overlay. */
  'voice',
  /** Manual entry of a non-AForce drink (AddDrinkModal and friends). */
  'manual',
  // ── Legacy capture modes, retained so historical rows stay valid ──
  'tap',
  'scan_log',
  'offline_replay',
  'sensor',
] as const;

export type IntakeSource = (typeof INTAKE_SOURCES)[number];

/** The surfaces a NEW intake event can originate from today. */
export const NEW_INTAKE_SURFACES: readonly IntakeSource[] = [
  'home',
  'hydration',
  'scan',
  'protocol',
  'recovery',
  'voice',
  'manual',
];

export function isIntakeSource(value: unknown): value is IntakeSource {
  return typeof value === 'string' && (INTAKE_SOURCES as readonly string[]).includes(value);
}
