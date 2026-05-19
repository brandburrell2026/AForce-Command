/**
 * Referral loop (spec #7) — social-only, no rewards.
 *
 * Mounted under `/api/referrals`.
 *
 *   GET  /me     → { code, totalClaims } — auto-issues a code on first call
 *   POST /claim  → records (referrer_user_id, referee_user_id) once per user
 *
 * Anti-abuse rules:
 *   - Self-claim rejected (400) — referee_user_id !== referrer_user_id.
 *   - Double-claim rejected (409) — one row per referee_user_id (DB unique).
 *   - Unknown code rejected (404).
 *
 * Reward economy is intentionally NOT modeled. This slice (1+2) ships
 * code generation, share affordance, claim flow, and attribution write.
 * Leaderboard read + reward fulfillment land in follow-up slices.
 */

import { Router, type IRouter, type Request } from "express";
import { randomInt } from "crypto";
import { eq, sql, and } from "drizzle-orm";
import { db, aforceUsers, aforceReferralClaims } from "@workspace/db";
import {
  GetMyReferralInfoResponse,
  ClaimReferralBody,
  ClaimReferralResponse,
  GetReferralLeaderboardResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { DEFAULT_USER_ID } from "../lib/aforceState";
import {
  tierFor,
  nextTierFor,
  claimsToNextTier,
  handleForCode,
} from "../lib/referralTiers";

const LEADERBOARD_TOP_N = 100;

const router: IRouter = Router();

router.use(requireAuth);

function resolveUserId(req: Request): string {
  return req.userId ?? DEFAULT_USER_ID;
}

// Ambiguity-safe alphabet — no 0/O/1/I/L. 32 chars, 8 positions → 32^8
// ≈ 1.1 × 10^12 codes; collisions are astronomically rare but we still
// retry on the DB unique constraint just in case.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const MAX_CODE_RETRIES = 6;

function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Idempotently ensure an aforce_users row exists for this Clerk id.
 * New users may hit /referrals/me before the Stripe webhook has ever
 * fired, so we can't rely on that path to create the row.
 */
async function ensureUserRow(userId: string): Promise<void> {
  await db
    .insert(aforceUsers)
    .values({ id: userId })
    .onConflictDoNothing({ target: aforceUsers.id });
}

/**
 * Read or assign the user's referral code. Loops on the UNIQUE
 * constraint if a randomly generated code collides with another user.
 */
async function getOrIssueCode(userId: string): Promise<string> {
  const [existing] = await db
    .select({ referralCode: aforceUsers.referralCode })
    .from(aforceUsers)
    .where(eq(aforceUsers.id, userId))
    .limit(1);
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const candidate = generateCode();
    try {
      const [updated] = await db
        .update(aforceUsers)
        .set({ referralCode: candidate, updatedAt: new Date() })
        .where(
          and(
            eq(aforceUsers.id, userId),
            sql`${aforceUsers.referralCode} IS NULL`,
          ),
        )
        .returning({ referralCode: aforceUsers.referralCode });
      if (updated?.referralCode) return updated.referralCode;
      // A concurrent request issued a code first — re-read and return.
      const [reread] = await db
        .select({ referralCode: aforceUsers.referralCode })
        .from(aforceUsers)
        .where(eq(aforceUsers.id, userId))
        .limit(1);
      if (reread?.referralCode) return reread.referralCode;
    } catch (err: unknown) {
      // 23505 = unique_violation. Retry with a fresh code.
      const code = (err as { code?: string } | null)?.code;
      if (code !== "23505") throw err;
    }
  }
  throw new Error("referral_code_generation_exhausted");
}

// ─── GET /me ──────────────────────────────────────────────────────────────────
router.get("/me", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  try {
    await ensureUserRow(userId);
    const code = await getOrIssueCode(userId);
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(aforceReferralClaims)
      .where(eq(aforceReferralClaims.referrerUserId, userId));
    const totalClaims = row?.n ?? 0;
    const tier = tierFor(totalClaims);
    const nextTier = nextTierFor(totalClaims);
    res.json(
      GetMyReferralInfoResponse.parse({
        code,
        totalClaims,
        handle: handleForCode(code),
        tier,
        ...(nextTier ? { nextTier } : {}),
        claimsToNextTier: claimsToNextTier(totalClaims),
      }),
    );
  } catch (err) {
    req.log.error({ err }, "GET /referrals/me failed");
    res.status(500).json({ error: "referral_info_failed" });
  }
});

// ─── GET /leaderboard ─────────────────────────────────────────────────────────
//
// Anonymous: every recruiter is shown as "Operator XXXX" derived from
// their invite code (handleForCode). No PII (no email, no Clerk name).
// The caller's own row carries isYou=true so the client can highlight
// it; if the caller is unranked (0 claims) we report yourRank=0.
router.get("/leaderboard", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  try {
    await ensureUserRow(userId);

    // Top N recruiters with dense_rank — ties share a rank, the next
    // bracket increments by 1 (so a 3-way tie at #1 is followed by #2,
    // not #4). This matches how leaderboards typically read socially.
    const topRows = await db.execute<{
      user_id: string;
      referral_code: string | null;
      claims: number;
      rank: number;
    }>(sql`
      SELECT
        u.id            AS user_id,
        u.referral_code AS referral_code,
        c.claims        AS claims,
        DENSE_RANK() OVER (ORDER BY c.claims DESC)::int AS rank
      FROM (
        SELECT referrer_user_id, COUNT(*)::int AS claims
        FROM aforce_referral_claims
        GROUP BY referrer_user_id
      ) c
      JOIN aforce_users u ON u.id = c.referrer_user_id
      ORDER BY c.claims DESC, u.id ASC
      LIMIT ${LEADERBOARD_TOP_N}
    `);

    const entries = topRows.rows.map((r) => ({
      handle: handleForCode(r.referral_code),
      tier: tierFor(r.claims),
      claims: r.claims,
      rank: r.rank,
      isYou: r.user_id === userId,
    }));

    // Total number of users with at least 1 claim (the denominator).
    const [totalRow] = await db
      .select({ n: sql<number>`count(distinct referrer_user_id)::int` })
      .from(aforceReferralClaims);
    const totalParticipants = totalRow?.n ?? 0;

    // Caller's own claim count + rank. Rank uses the same DENSE_RANK
    // ordering as the leaderboard for consistency. yourRank=0 means
    // the caller has 0 claims and is therefore not yet ranked.
    const [meRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(aforceReferralClaims)
      .where(eq(aforceReferralClaims.referrerUserId, userId));
    const yourClaims = meRow?.n ?? 0;

    let yourRank = 0;
    if (yourClaims > 0) {
      const fromTop = entries.find((e) => e.isYou);
      if (fromTop) {
        yourRank = fromTop.rank;
      } else {
        // Dense rank: count DISTINCT claim values above the caller so
        // off-board ranks match the DENSE_RANK ordering used in the
        // top-N query (ties share a rank, no gaps).
        const rankRes = await db.execute<{ rank: number }>(sql`
          SELECT (
            1 + COUNT(DISTINCT c.claims)
          )::int AS rank
          FROM (
            SELECT referrer_user_id, COUNT(*)::int AS claims
            FROM aforce_referral_claims
            GROUP BY referrer_user_id
          ) c
          WHERE c.claims > ${yourClaims}
        `);
        yourRank = rankRes.rows[0]?.rank ?? 0;
      }
    }

    res.json(
      GetReferralLeaderboardResponse.parse({
        entries,
        yourRank,
        yourClaims,
        totalParticipants,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "GET /referrals/leaderboard failed");
    res.status(500).json({ error: "referral_leaderboard_failed" });
  }
});

// ─── POST /claim ──────────────────────────────────────────────────────────────
router.post("/claim", async (req, res): Promise<void> => {
  const parsed = ClaimReferralBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_code" });
    return;
  }
  const userId = resolveUserId(req);
  const code = parsed.data.code.toUpperCase();

  try {
    await ensureUserRow(userId);

    // Look up referrer by code.
    const [referrer] = await db
      .select({ id: aforceUsers.id })
      .from(aforceUsers)
      .where(eq(aforceUsers.referralCode, code))
      .limit(1);
    if (!referrer) {
      res.status(404).json({ error: "unknown_code" });
      return;
    }
    if (referrer.id === userId) {
      res.status(400).json({ error: "self_claim" });
      return;
    }

    // Insert the attribution row. The UNIQUE index on referee_user_id
    // makes this race-safe — second insert hits 23505 and we then
    // either ack the prior claim (idempotent retry of the same code)
    // or reject as a conflict (different code, already attributed).
    try {
      await db.insert(aforceReferralClaims).values({
        referrerUserId: referrer.id,
        refereeUserId: userId,
        codeUsed: code,
      });
    } catch (err: unknown) {
      const c = (err as { code?: string } | null)?.code;
      if (c === "23505") {
        const [prior] = await db
          .select({
            referrerUserId: aforceReferralClaims.referrerUserId,
            codeUsed: aforceReferralClaims.codeUsed,
          })
          .from(aforceReferralClaims)
          .where(eq(aforceReferralClaims.refereeUserId, userId))
          .limit(1);
        if (prior && prior.codeUsed.toUpperCase() === code) {
          // Same code resubmitted (network retry, double-tap, etc.) —
          // ack the existing attribution instead of error.
          res.json(
            ClaimReferralResponse.parse({
              ok: true,
              referrerUserId: prior.referrerUserId,
            }),
          );
          return;
        }
        res.status(409).json({ error: "already_claimed" });
        return;
      }
      throw err;
    }

    res.json(
      ClaimReferralResponse.parse({ ok: true, referrerUserId: referrer.id }),
    );
  } catch (err) {
    req.log.error({ err }, "POST /referrals/claim failed");
    res.status(500).json({ error: "referral_claim_failed" });
  }
});

export default router;
