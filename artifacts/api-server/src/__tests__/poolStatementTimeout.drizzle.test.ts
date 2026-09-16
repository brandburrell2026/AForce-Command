/**
 * Every pooled connection carries a statement timeout.
 *
 * `connectionTimeoutMillis` bounded the wait FOR a connection and nothing
 * bounded what happened once a query had one. A statement that ran long — a
 * missing index after a data shape changes, a lock held by another session, a
 * plan that flipped — held one of ten connections indefinitely, and that pool
 * is shared by every route in the process. The first symptom is unrelated
 * endpoints timing out.
 *
 * The option is called `statement_timeout` and is passed through to the
 * session, which is easy to believe and worth checking: a misspelled or
 * unsupported key in a `pg` config object is silently ignored, so the failure
 * mode of getting this wrong is a setting that looks present in the source
 * and is absent in the database.
 */
import { afterAll, describe, expect, it, vi } from "vitest";

import { pool } from "@workspace/db";

const DB = Boolean(process.env["DB_TESTS"]);

describe.runIf(DB)("pool statement timeout", () => {
  it("is applied to the shared pool's sessions, and is not zero", async () => {
    const { rows } = await pool.query<{ statement_timeout: string }>(
      "show statement_timeout",
    );
    const value = rows[0]!.statement_timeout;
    expect(value).not.toBe("0");
    // Postgres renders it in whatever unit is tidiest; any non-zero duration
    // is the property. The exact figure is a tuning decision, not a contract.
    expect(value).toMatch(/^\d+\s*(ms|s|min)$/);
  });

  it("applies to a connection checked out for a transaction, not just simple queries", async () => {
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ statement_timeout: string }>(
        "show statement_timeout",
      );
      expect(rows[0]!.statement_timeout).not.toBe("0");
    } finally {
      client.release();
    }
  });

  /**
   * End to end, with a short timeout, so the mechanism is demonstrated rather
   * than inferred from a `SHOW`. A fresh module instance is imported with the
   * environment variable set, because the pool is constructed at module load.
   */
  it("cancels a statement that exceeds it", async () => {
    vi.resetModules();
    const prior = process.env["PG_STATEMENT_TIMEOUT_MS"];
    process.env["PG_STATEMENT_TIMEOUT_MS"] = "500";

    const fresh = await import("@workspace/db");
    const shortPool = fresh.pool;
    try {
      const shown = await shortPool.query<{ statement_timeout: string }>(
        "show statement_timeout",
      );
      expect(shown.rows[0]!.statement_timeout).toBe("500ms");

      const started = Date.now();
      // 57014 is query_canceled — the timeout firing, not a connection error.
      await expect(shortPool.query("select pg_sleep(5)")).rejects.toMatchObject({
        code: "57014",
      });
      // Cancelled near the limit rather than at the five-second sleep.
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      await shortPool.end();
      if (prior === undefined) delete process.env["PG_STATEMENT_TIMEOUT_MS"];
      else process.env["PG_STATEMENT_TIMEOUT_MS"] = prior;
      vi.resetModules();
    }
  });

  afterAll(() => {
    vi.resetModules();
  });
});
