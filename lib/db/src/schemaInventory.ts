/**
 * Catalog inventory + delta classification for reviewed schema applies.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The S1-2 production apply was reviewed against an expected delta of 14
 * objects, measured on PostgreSQL 16. Production returned 29. The extra 15
 * were PostgreSQL 18's CATALOGUED NOT NULL CONSTRAINTS — PG17+ records them in
 * `pg_constraint` with `contype = 'n'`, PG16 does not record them at all.
 *
 * Nothing about the applied schema differed. The same DDL simply has a
 * different catalogue REPRESENTATION on a newer server. But a plain
 * "expected exactly N objects" comparison cannot tell that from real drift,
 * and would have read a routine version difference as a stop condition — or,
 * worse, taught the next reader to wave through numeric mismatches.
 *
 * So the delta is CLASSIFIED, not counted:
 *
 *   explicit     the objects the reviewed DDL names outright
 *   implied      objects PostgreSQL always creates for those declarations
 *                (a PRIMARY KEY's backing index, a bigserial's sequence)
 *   catalogued   the same declarations surfacing as catalogue rows only on
 *                certain server versions (PG17+ NOT NULL constraints)
 *   unexpected   everything else — the only category that is drift
 *
 * A future PostgreSQL catalogue change lands in `catalogued` or `unexpected`
 * depending on whether it is recognised, and an UNRECOGNISED one is loud.
 * That is deliberate: the failure mode we must avoid is a silent reinterpretation
 * of application drift as a version artifact.
 */

/**
 * The inventory query. Identical text is used before and after an apply so
 * the two are comparable.
 *
 * `contype::text` is required: `contype` is `"char"`, and `'constraint:'||contype`
 * raises `operator is not unique: unknown || "char"` (42725) without the cast.
 */
export const INVENTORY_SQL = `
  select 'table'::text kind, tablename::text name, ''::text detail
    from pg_tables where schemaname='public'
  union all
  select 'index', indexname, indexdef from pg_indexes where schemaname='public'
  union all
  select 'constraint:'||contype::text, conname, pg_get_constraintdef(oid)
    from pg_constraint where connamespace='public'::regnamespace
  union all
  select 'sequence', sequencename, '' from pg_sequences where schemaname='public'
  order by 1,2`;

export interface InventoryRow {
  readonly kind: string;
  readonly name: string;
  readonly detail: string;
}

/** What a reviewed apply is allowed to add. */
export interface ExpectedDelta {
  /** Objects the DDL names outright, as `kind|name`. */
  readonly explicit: readonly string[];
  /** Objects PostgreSQL always creates for those declarations. */
  readonly implied: readonly string[];
  /**
   * Objects that appear only on some server versions for the SAME
   * declarations. Each carries the reason, so an unexplained entry cannot be
   * added silently.
   */
  readonly catalogued: ReadonlyArray<{ readonly key: string; readonly reason: string }>;
}

export interface DeltaReport {
  readonly explicit: string[];
  readonly implied: string[];
  readonly catalogued: string[];
  /** The only category that means drift. */
  readonly unexpected: string[];
  /** Present before but gone after — always a stop condition. */
  readonly removed: string[];
  /** Same key, different definition — always a stop condition. */
  readonly changed: string[];
  /** Declared as expected but never appeared. */
  readonly missing: string[];
  readonly ok: boolean;
}

const key = (r: InventoryRow): string => `${r.kind}|${r.name}`;

/**
 * Compare two inventories against a reviewed expectation.
 *
 * `ok` is true only when nothing was removed, nothing changed definition,
 * nothing unexpected appeared, and every explicitly reviewed object arrived.
 * A `catalogued` row that does NOT appear is not a failure — that is exactly
 * the PG16-vs-PG18 case, where the same DDL yields fewer catalogue rows.
 */
export function classifyDelta(
  pre: readonly InventoryRow[],
  post: readonly InventoryRow[],
  expected: ExpectedDelta,
): DeltaReport {
  const preKeys = new Set(pre.map(key));
  const postKeys = new Set(post.map(key));
  const preDetail = new Map(pre.map((r) => [key(r), r.detail]));

  const explicitSet = new Set(expected.explicit);
  const impliedSet = new Set(expected.implied);
  const cataloguedSet = new Set(expected.catalogued.map((c) => c.key));

  const explicit: string[] = [];
  const implied: string[] = [];
  const catalogued: string[] = [];
  const unexpected: string[] = [];

  for (const row of post) {
    const k = key(row);
    if (preKeys.has(k)) continue; // not added
    if (explicitSet.has(k)) explicit.push(k);
    else if (impliedSet.has(k)) implied.push(k);
    else if (cataloguedSet.has(k)) catalogued.push(k);
    else unexpected.push(k);
  }

  const removed = pre.filter((r) => !postKeys.has(key(r))).map(key);
  const changed = post
    .filter((r) => preKeys.has(key(r)) && preDetail.get(key(r)) !== r.detail)
    .map(key);

  // Only EXPLICIT objects must arrive. Implied objects follow from them, and
  // catalogued ones are version-dependent by definition.
  const missing = expected.explicit.filter((k) => !postKeys.has(k) || preKeys.has(k));

  return {
    explicit,
    implied,
    catalogued,
    unexpected,
    removed,
    changed,
    missing,
    ok:
      unexpected.length === 0 &&
      removed.length === 0 &&
      changed.length === 0 &&
      missing.length === 0,
  };
}

/**
 * The reviewed S1-2 delta.
 *
 * Explicit and implied were verified on PostgreSQL 16 and 18; the catalogued
 * group appears on PG17+ only. Production (PG18.6) returned explicit +
 * implied + catalogued; a PG16 server returns explicit + implied and the
 * catalogued group is simply absent, which `classifyDelta` treats as fine.
 */
export const S1_EXPECTED_DELTA: ExpectedDelta = {
  explicit: [
    "table|aforce_analytics_consent_events",
    "table|aforce_analytics_consent_state",
    "table|aforce_analytics_identities",
    "index|aforce_analytics_consent_events_user_idx",
    "index|aforce_analytics_identities_analytics_id_uq",
    "constraint:c|aforce_analytics_identities_status_enum",
    "constraint:c|aforce_analytics_identities_suppressed_has_no_id",
  ],
  implied: [
    // Each PRIMARY KEY creates a constraint AND its backing index.
    "constraint:p|aforce_analytics_consent_events_pkey",
    "constraint:p|aforce_analytics_consent_state_pkey",
    "constraint:p|aforce_analytics_identities_pkey",
    "index|aforce_analytics_consent_events_pkey",
    "index|aforce_analytics_consent_state_pkey",
    "index|aforce_analytics_identities_pkey",
    // `bigserial` creates the sequence.
    "sequence|aforce_analytics_consent_events_id_seq",
  ],
  catalogued: (
    [
      ["aforce_analytics_consent_events", ["action", "decision_seq", "disclosure_version", "id", "recorded_at", "user_id"]],
      ["aforce_analytics_consent_state", ["decision_seq", "disclosure_version", "granted", "updated_at", "user_id"]],
      ["aforce_analytics_identities", ["issued_at", "status", "updated_at", "user_id"]],
    ] as ReadonlyArray<readonly [string, readonly string[]]>
  ).flatMap(([table, cols]) =>
    cols.map((col) => ({
      key: `constraint:n|${table}_${col}_not_null`,
      reason:
        "PostgreSQL 17+ catalogues NOT NULL constraints in pg_constraint " +
        "(contype='n'); PG16 does not record them at all. Same DDL, different " +
        "catalogue representation.",
    })),
  ),
};
