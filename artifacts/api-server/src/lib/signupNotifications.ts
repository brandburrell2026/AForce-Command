import { pool } from "@workspace/db";
import { logger } from "./logger";
import { microsoftSignupMailConfigured, sendMicrosoftSignupNotification } from "./signupMicrosoftMail";

// A narrowly scoped, additive bootstrap, not a general schema synchronization.
// No existing signup, customer, order, or migration-ledger rows are changed.
const CREATE_QUEUE = `CREATE TABLE IF NOT EXISTS aforce_signup_notifications (
  signup_id integer PRIMARY KEY REFERENCES early_access_signups(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  accepted_at timestamptz,
  last_error text
)`;
let ready: Promise<unknown> | undefined;
export function ensureSignupNotificationQueue(): Promise<unknown> {
  ready ??= pool.query(CREATE_QUEUE).catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}

/** Commit the lead and its notification together, before reporting success. */
export async function captureWebsiteSignup(email: string, source: string): Promise<boolean> {
  await ensureSignupNotificationQueue();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO early_access_signups (email, source) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING RETURNING id`, [email, source],
    );
    if (inserted.rows[0]) {
      await client.query("INSERT INTO aforce_signup_notifications (signup_id) VALUES ($1)", [inserted.rows[0].id]);
    }
    await client.query("COMMIT");
    return inserted.rows.length > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

let running = false;
export async function retrySignupNotifications(): Promise<void> {
  if (running || !microsoftSignupMailConfigured()) return;
  running = true;
  try {
    await ensureSignupNotificationQueue();
    // Atomic leases prevent replicas/workers claiming the same pending row.
    // One row at a time: the 2-minute lease exceeds both bounded HTTP calls.
    for (let n = 0; n < 10; n++) {
      const claimed = await pool.query<{ signup_id: number; attempts: number; email: string; source: string }>(`
        WITH candidate AS (
          SELECT signup_id FROM aforce_signup_notifications
          WHERE accepted_at IS NULL AND next_attempt_at <= now()
            AND (lease_until IS NULL OR lease_until < now())
          ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED
        ), claimed AS (
          UPDATE aforce_signup_notifications q SET lease_until = now() + interval '2 minutes',
            attempts = q.attempts + 1 FROM candidate c WHERE q.signup_id = c.signup_id
          RETURNING q.signup_id, q.attempts
        ) SELECT c.*, s.email, s.source FROM claimed c
          JOIN early_access_signups s ON s.id = c.signup_id`);
      const row = claimed.rows[0];
      if (!row) break;
      try {
        await sendMicrosoftSignupNotification({ id: row.signup_id, email: row.email, source: row.source });
        await pool.query(`UPDATE aforce_signup_notifications SET accepted_at = now(),
          lease_until = NULL, last_error = NULL WHERE signup_id = $1`, [row.signup_id]);
        logger.info({ signupId: row.signup_id }, "Signup notification accepted by Microsoft 365");
      } catch (error) {
        // Store a bounded diagnostic code, never a provider body or token.
        const message = error instanceof Error && /^m365_[a-z0-9_]+$/.test(error.message)
          ? error.message : "notification_attempt_failed";
        const delay = Math.min(3600, 30 * 2 ** Math.min(row.attempts, 7));
        await pool.query(`UPDATE aforce_signup_notifications SET lease_until = NULL,
          next_attempt_at = now() + $2 * interval '1 second', last_error = $3
          WHERE signup_id = $1`, [row.signup_id, delay, message]);
        logger.warn({ signupId: row.signup_id, code: message }, "Signup notification pending retry");
      }
    }
  } finally { running = false; }
}

export function startSignupNotificationWorker(): void {
  if (!microsoftSignupMailConfigured()) {
    logger.warn("Microsoft 365 signup sending is unconfigured; new leads retain pending notifications");
  }
  const tick = () => { void retrySignupNotifications().catch(() => {
    logger.error("Signup notification worker failed; pending rows remain available for retry");
  }); };
  tick();
  setInterval(tick, 30000).unref();
}
