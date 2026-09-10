/**
 * The analytics identity + consent authority (S1-3).
 *
 * Lives in this package, not in the api-server, for the reason
 * `accountDeletionCascade.ts` records: a sequence that exists once is the
 * sequence the tests actually exercise. The db-lane race laws drive these
 * functions directly, so what is proven is production's code path rather than
 * a structural copy of it.
 *
 * ── THE FOUR THINGS THIS FILE IS RESPONSIBLE FOR ───────────────────────────
 *
 * 1. A pseudonym that is RANDOM AND STORED, never derived from the Clerk id.
 *    A derived id cannot be rotated: a pure function of an unchanged input
 *    cannot produce a new value, so "rotation" would be a no-op forever.
 *
 * 2. One ACTIVE pseudonym per member, under concurrency. Two devices
 *    resolving at the same instant must receive the SAME value, and the
 *    loser's freshly minted candidate must never reach the database.
 *
 * 3. ONE authority for `decision_seq`. `advanceConsent` is the only function
 *    that writes it. Grant, revoke and suppress are its callers — one
 *    implementation, three entry points, so the monotonicity cannot be
 *    broken by a second writer that forgets the compare-and-set.
 *
 * 4. A gate the analytics WRITERS share. `consentedAnalyticsIdFor` resolves
 *    from the caller's own userId, so no surface trusts a client-supplied
 *    pseudonym — which is simultaneously the consent gate, the retired-id
 *    refusal, and the ownership check.
 *
 * ── WHAT ROTATION DELIBERATELY DOES NOT DO ─────────────────────────────────
 *
 * Rotation writes NO consent-evidence row and does NOT advance `decision_seq`.
 * It is an identity operation, not a consent decision — the member has not
 * changed their mind about collection, they have changed which pseudonym
 * carries it. Recording it as a consent event would require inventing a
 * disclosure version for a decision that was never made, and the founder has
 * ruled that sentinel values are not acceptable. It is also why the identity
 * row carries no `last_rotated_at`: a rotation timestamp beside any other
 * per-member timestamp re-links the retired pseudonym to its owner.
 */

import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import {
  aforceAnalyticsIdentities,
  aforceAnalyticsConsentState,
  aforceAnalyticsConsentEvents,
} from "./schema/aforce";

/** Anything that can run queries — `db` or a transaction handle. */
export type Dbx = {
  execute: (q: unknown) => Promise<unknown>;
  transaction: <T>(fn: (tx: Dbx) => Promise<T>) => Promise<T>;
  select: (...a: never[]) => never;
};

/** The sentinel `requireAuth` grants below production. Never a real member. */
export const DEFAULT_USER_ID_SENTINEL = "default";

export type IdentityStatus = "active" | "suppressed";

export interface ResolvedIdentity {
  readonly status: IdentityStatus;
  /** null when suppressed — a suppressed member holds no pseudonym. */
  readonly analyticsId: string | null;
}

export interface ConsentState {
  readonly granted: boolean;
  readonly decisionSeq: number;
  readonly disclosureVersion: number;
}

export type ConsentAction = "grant" | "revoke" | "suppress";

/**
 * Mint a pseudonym.
 *
 * FORMAT `anon_<16 hex>_<16 hex>` — 128 bits from `crypto.randomBytes`.
 *
 * The shape is not cosmetic: `lib/analytics-contract`'s ANALYTICS_ID_RE is
 * `/^anon_[a-z0-9]+_[a-z0-9]+$/`, enforced at three ingress points, and
 * lowercase hex is a subset of that charset. So a server-minted id validates
 * against the EXISTING contract with no change to it, and every already-issued
 * client id stays valid.
 *
 * This is a genuine upgrade, not a relocation: the client minter
 * (`analytics/event_envelope.ts`) used `Math.random()` twice — not a CSPRNG,
 * as its own comment concedes — and embedded `Date.now()` in base36, leaking
 * mint time into the identifier.
 */
export function mintAnalyticsId(): string {
  return `anon_${randomBytes(8).toString("hex")}_${randomBytes(8).toString("hex")}`;
}

/** Rows come back from `execute` under `.rows`. */
function rowsOf<T>(res: unknown): T[] {
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * Resolve the member's active pseudonym, minting one on first use.
 *
 * CONCURRENCY. One transaction, and the row is taken under `FOR UPDATE`
 * before any decision is made, so this serialises against `rotate` and
 * `suppress` on the same row:
 *
 *   - two simultaneous first resolves: one INSERT wins; the loser's
 *     `DO NOTHING` affects no row, it then blocks on `FOR UPDATE` until the
 *     winner commits, and reads the winner's value. Its own candidate is
 *     discarded and never written.
 *   - resolve vs rotate: whichever takes the lock first is observed whole by
 *     the other. Resolve cannot return a retired value, because by the time
 *     the lock is released the row holds only the new one.
 *   - resolve vs suppress: if suppress commits first, resolve sees
 *     `suppressed` and mints nothing. If resolve commits first it returns the
 *     then-active pseudonym — correct at the instant it was issued.
 *
 * A suppressed member is NEVER revived here: the INSERT path is reachable
 * only when no row exists, and the database additionally forbids a suppressed
 * row from holding a pseudonym at all (CHECK
 * `aforce_analytics_identities_suppressed_has_no_id`).
 */
export async function resolveAnalyticsIdentity(
  dbx: Dbx,
  userId: string,
): Promise<ResolvedIdentity> {
  assertRealMember(userId);
  return dbx.transaction(async (tx) => {
    const candidate = mintAnalyticsId();
    await tx.execute(sql`
      insert into ${aforceAnalyticsIdentities} (user_id, analytics_id)
      values (${userId}, ${candidate})
      on conflict (user_id) do nothing
    `);
    const rows = rowsOf<{ analytics_id: string | null; status: IdentityStatus }>(
      await tx.execute(sql`
        select analytics_id, status from ${aforceAnalyticsIdentities}
         where user_id = ${userId}
         for update
      `),
    );
    const row = rows[0];
    if (!row) {
      // Unreachable: the INSERT above either created the row or found one.
      throw new Error("analytics identity row vanished mid-transaction");
    }
    return { status: row.status, analyticsId: row.analytics_id };
  });
}

/**
 * Issue a new pseudonym for an active member.
 *
 * History is NOT re-keyed: rows already written under the retired pseudonym
 * keep it and become unattributable, which is the entire product of rotation.
 * `routes/commandCenterAdmin.ts` aggregates ~20 times by `analytics_id`, so
 * re-keying would silently rewrite historical reporting as well.
 *
 * Returns null when the member is suppressed — a suppressed identity cannot
 * be rotated back into existence.
 */
export async function rotateAnalyticsIdentity(
  dbx: Dbx,
  userId: string,
): Promise<string | null> {
  assertRealMember(userId);
  return dbx.transaction(async (tx) => {
    const rows = rowsOf<{ status: IdentityStatus }>(
      await tx.execute(sql`
        select status from ${aforceAnalyticsIdentities}
         where user_id = ${userId} for update
      `),
    );
    if (!rows[0] || rows[0].status !== "active") return null;
    const next = mintAnalyticsId();
    await tx.execute(sql`
      update ${aforceAnalyticsIdentities}
         set analytics_id = ${next}, updated_at = now()
       where user_id = ${userId}
    `);
    return next;
  });
}

/**
 * THE SINGLE AUTHORITY for `decision_seq`.
 *
 * Compare-and-set: a write must present the sequence it believes is current.
 * A mismatch is REFUSED, not applied — which is what stops a device holding a
 * stale local state from re-granting consent the member revoked elsewhere.
 *
 * `expectedSeq === null` means "I believe no decision exists yet" and is the
 * ONLY route into the insert. An absent row reports `decisionSeq: null`, never
 * 0 — encoding it as 0 makes the first grant a permanent 409 loop, because the
 * CAS `where decision_seq = 0` matches no row and the refusal hands back the
 * same 0 that caused it.
 *
 * Client timestamps are never used to order decisions: two devices with skewed
 * clocks would silently reorder a member's own choices.
 *
 * ── CONCURRENCY: TWO MECHANISMS, TWO DISTINCT JOBS ─────────────────────────
 *
 * This function previously read the row with a plain SELECT and never looked
 * at what the CAS `UPDATE` actually affected. Under READ COMMITTED that is not
 * a compare-and-set at all: two transactions both read seq N and both pass the
 * guard; the winner's UPDATE applies; the loser's UPDATE blocks, and when the
 * winner commits PostgreSQL re-evaluates the loser's WHERE against the NEW row
 * version, so it matches nothing — and the loser, never having checked,
 * returned `ok: true` for a decision that was never written and appended
 * evidence for it. A member's revoke could be reported confirmed and dropped.
 *
 * The repair uses two mechanisms, and they are NOT redundant — each answers a
 * different question, and each is proven by its own law and its own mutant:
 *
 *   `FOR UPDATE` decides WHAT THE LOSER IS TOLD. It serialises the readers, so
 *   the loser's read happens after the winner commits and therefore returns the
 *   CANONICAL state. Without it the loser still fails, but reports the stale
 *   value it read — and a client that reconciles against a stale seq retries
 *   with the same losing expectation forever.
 *
 *   The AFFECTED-ROW CHECK decides WHETHER THE LOSER IS TOLD IT WON. The CAS
 *   lives in the UPDATE's own WHERE clause, and only a confirmed single-row
 *   update may report success or append evidence. Without it, a stale caller is
 *   told `ok: true` — the original defect.
 *
 * Evidence is appended only AFTER the update is confirmed applied, so the
 * append-only consent log can never describe a transition that did not happen.
 */
export async function advanceConsent(
  dbx: Dbx,
  args: {
    userId: string;
    action: ConsentAction;
    disclosureVersion: number;
    expectedSeq: number | null;
  },
): Promise<{ ok: true; state: ConsentState } | { ok: false; current: ConsentState | null }> {
  assertRealMember(args.userId);
  const granted = args.action === "grant";
  return dbx.transaction(async (tx) => {
    if (args.expectedSeq === null) {
      // "I believe no decision exists yet." The INSERT itself is the test:
      // `on conflict do nothing` affects no row when one already exists —
      // whether it was there all along or another transaction created it
      // while we were running. Same idiom as the resolver above.
      const inserted = rowsOf<{ decision_seq: number }>(
        await tx.execute(sql`
          insert into ${aforceAnalyticsConsentState}
            (user_id, granted, decision_seq, disclosure_version)
          values (${args.userId}, ${granted}, 1, ${args.disclosureVersion})
          on conflict (user_id) do nothing
          returning decision_seq
        `),
      );
      if (inserted.length !== 1) {
        // Refused. Report the canonical state, read under the lock so it is
        // the committed truth and not a snapshot from before the winner.
        return { ok: false as const, current: await lockConsentTx(tx, args.userId) };
      }
      await appendEvidence(tx, args.userId, args.action, args.disclosureVersion, 1);
      return {
        ok: true as const,
        state: { granted, decisionSeq: 1, disclosureVersion: args.disclosureVersion },
      };
    }

    // Take the row before deciding anything. A concurrent decision on the same
    // member now serialises behind us rather than reading the same stale seq.
    const current = await lockConsentTx(tx, args.userId);
    if (current === null) return { ok: false as const, current: null };

    // The CAS is the UPDATE's WHERE clause — the one place that both tests the
    // expectation and applies the change, so the two can never disagree.
    const nextSeq = current.decisionSeq + 1;
    const applied = rowsOf<{ decision_seq: number }>(
      await tx.execute(sql`
        update ${aforceAnalyticsConsentState}
           set granted = ${granted},
               decision_seq = ${nextSeq},
               disclosure_version = ${args.disclosureVersion},
               updated_at = now()
         where user_id = ${args.userId} and decision_seq = ${args.expectedSeq}
        returning decision_seq
      `),
    );
    if (applied.length !== 1) {
      // The expectation did not match. Nothing was written, so nothing is
      // claimed and no evidence is appended.
      return { ok: false as const, current };
    }
    await appendEvidence(tx, args.userId, args.action, args.disclosureVersion, nextSeq);
    return {
      ok: true as const,
      state: { granted, decisionSeq: nextSeq, disclosureVersion: args.disclosureVersion },
    };
  });
}

/**
 * Append to the durable record of what a member was shown and agreed to.
 *
 * NEVER read by the operative gate. If the gate could be answered from here,
 * deleting the evidence would silently change what the app is permitted to
 * collect — one object with two incompatible lifetimes.
 *
 * `disclosureVersion` is always the version the member ACTED UNDER, never a
 * sentinel. That is why `rotate` writes nothing here: it is not a decision,
 * so there is no version it was made against.
 */
async function appendEvidence(
  tx: Dbx,
  userId: string,
  action: ConsentAction,
  disclosureVersion: number,
  decisionSeq: number,
): Promise<void> {
  await tx.execute(sql`
    insert into ${aforceAnalyticsConsentEvents}
      (user_id, action, disclosure_version, decision_seq)
    values (${userId}, ${action}, ${disclosureVersion}, ${decisionSeq})
  `);
}

async function readConsentTx(tx: Dbx, userId: string): Promise<ConsentState | null> {
  const rows = rowsOf<{ granted: boolean; decision_seq: number; disclosure_version: number }>(
    await tx.execute(sql`
      select granted, decision_seq, disclosure_version
        from ${aforceAnalyticsConsentState} where user_id = ${userId}
    `),
  );
  const r = rows[0];
  return r
    ? { granted: r.granted, decisionSeq: r.decision_seq, disclosureVersion: r.disclosure_version }
    : null;
}

/**
 * The same read, taking the row for the duration of the transaction.
 *
 * Deliberately NOT folded into `readConsentTx`. That one serves `readConsent`,
 * which answers `GET /analytics-consent` and runs on the resolve path — making
 * it lock would put a row lock on every read of a member's consent state, so
 * an ordinary poll could block a decision. Locking belongs to the transaction
 * that intends to WRITE, and only there.
 *
 * `FOR UPDATE` on a `where user_id = …` that matches nothing locks nothing.
 * That is why the first-decision path uses `on conflict do nothing` as its
 * test instead of relying on this.
 */
async function lockConsentTx(tx: Dbx, userId: string): Promise<ConsentState | null> {
  const rows = rowsOf<{ granted: boolean; decision_seq: number; disclosure_version: number }>(
    await tx.execute(sql`
      select granted, decision_seq, disclosure_version
        from ${aforceAnalyticsConsentState} where user_id = ${userId}
        for update
    `),
  );
  const r = rows[0];
  return r
    ? { granted: r.granted, decisionSeq: r.decision_seq, disclosureVersion: r.disclosure_version }
    : null;
}

/** The operative consent state, or null when the member has never decided. */
export async function readConsent(dbx: Dbx, userId: string): Promise<ConsentState | null> {
  return readConsentTx(dbx, userId);
}

/**
 * Delete-my-data. ONE transaction:
 *   1. delete the member's analytics rows, found via THEIR OWN pseudonym
 *   2. clear the pseudonym and mark the identity suppressed
 *   3. record the consent state change through the single sequence authority
 *
 * OWNERSHIP. The pseudonym is resolved from `req.userId` server-side and the
 * caller-supplied value is not used at all. Before this, the route deleted
 * `where analytics_id = <caller-supplied>` with no ownership check, so any
 * authenticated caller who supplied another member's id erased that member's
 * history.
 *
 * A member who never decided has nothing to evidence, so no consent row and
 * no evidence row is written — rather than inventing a disclosure version for
 * a decision that never happened.
 */
export async function forgetAnalyticsForMember(
  dbx: Dbx,
  userId: string,
): Promise<{ deleted: number; status: IdentityStatus }> {
  assertRealMember(userId);
  return dbx.transaction(async (tx) => {
    const rows = rowsOf<{ analytics_id: string | null; status: IdentityStatus }>(
      await tx.execute(sql`
        select analytics_id, status from ${aforceAnalyticsIdentities}
         where user_id = ${userId} for update
      `),
    );
    const row = rows[0];
    if (!row) return { deleted: 0, status: "suppressed" as const };

    let deleted = 0;
    if (row.analytics_id !== null) {
      const del = await tx.execute(sql`
        delete from aforce_analytics_events where analytics_id = ${row.analytics_id}
      `);
      deleted = (del as { rowCount?: number }).rowCount ?? 0;
    }

    await tx.execute(sql`
      update ${aforceAnalyticsIdentities}
         set analytics_id = null, status = 'suppressed', updated_at = now()
       where user_id = ${userId}
    `);

    const current = await readConsentTx(tx, userId);
    if (current !== null && current.granted) {
      const nextSeq = current.decisionSeq + 1;
      await tx.execute(sql`
        update ${aforceAnalyticsConsentState}
           set granted = false, decision_seq = ${nextSeq}, updated_at = now()
         where user_id = ${userId} and decision_seq = ${current.decisionSeq}
      `);
      await appendEvidence(tx, userId, "suppress", current.disclosureVersion, nextSeq);
    }
    return { deleted, status: "suppressed" as const };
  });
}

/**
 * THE SHARED WRITER GATE. Returns the pseudonym analytics may be written
 * under, or null.
 *
 * Resolves from the CALLER'S userId — it never trusts a client-supplied
 * pseudonym — so one function is simultaneously:
 *   - the consent gate (null unless consent is granted),
 *   - the suppression gate (a suppressed row holds no pseudonym),
 *   - and the retired-id refusal (a retired value simply is not what this
 *     returns, so a submitted one cannot match).
 *
 * Does NOT mint. An emission path must never create an identity as a side
 * effect of writing an event.
 */
export async function consentedAnalyticsIdFor(
  dbx: Dbx,
  userId: string | undefined,
): Promise<string | null> {
  if (!userId || userId === DEFAULT_USER_ID_SENTINEL) return null;
  const rows = rowsOf<{ analytics_id: string | null; granted: boolean | null }>(
    await dbx.execute(sql`
      select i.analytics_id, c.granted
        from ${aforceAnalyticsIdentities} i
        left join ${aforceAnalyticsConsentState} c on c.user_id = i.user_id
       where i.user_id = ${userId} and i.status = 'active'
    `),
  );
  const r = rows[0];
  if (!r || r.analytics_id === null || r.granted !== true) return null;
  return r.analytics_id;
}

/**
 * The identity endpoints must never operate as the shared dev sentinel.
 * `requireAuth` grants DEFAULT_USER_ID below production on two paths (missing
 * CLERK_SECRET_KEY, and configured-but-signed-out), and on an identity
 * endpoint that would mint ONE pseudonym shared by everybody.
 */
function assertRealMember(userId: string): void {
  if (!userId || userId === DEFAULT_USER_ID_SENTINEL) {
    throw new Error("analytics identity requires a real member");
  }
}
