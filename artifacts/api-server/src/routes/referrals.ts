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
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { DEFAULT_USER_ID } from "../lib/aforceState";

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
    res.json(GetMyReferralInfoResponse.parse({ code, totalClaims }));
  } catch (err) {
    req.log.error({ err }, "GET /referrals/me failed");
    res.status(500).json({ error: "referral_info_failed" });
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
