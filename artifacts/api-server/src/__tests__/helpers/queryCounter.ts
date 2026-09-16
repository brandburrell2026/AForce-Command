/**
 * Count the SQL statements a block of code actually issues.
 *
 * Written for the roster fan-out work, and kept because "how many queries
 * does this endpoint make" is the kind of claim that should be asserted
 * rather than reasoned about. The board's cost was described as `1 + 3N`
 * from reading the code; this is what measures it.
 *
 * WHY IT HOOKS TWO PLACES. `pg.Pool` runs a simple query on the pool itself,
 * but a transaction checks a client out with `pool.connect()` and issues
 * everything — including BEGIN and COMMIT — on that client. Counting only
 * `pool.query` would miss every statement inside a transaction, which on this
 * surface is most of the interesting ones. So the pool's own `query` is
 * wrapped, and each client is wrapped as it is handed out.
 *
 * Restores both on stop, and is safe to nest badly (stop is idempotent).
 */
import type { Pool, PoolClient } from "pg";

export interface QueryRecord {
  /** The SQL text, collapsed to one line for reporting. */
  sql: string;
  /** Milliseconds from issue to resolution, as the client observed it. */
  ms: number;
}

export interface QueryTally {
  records: QueryRecord[];
  /** Statement count, including BEGIN/COMMIT. */
  get count(): number;
  /** Statement count excluding transaction control, which is the number
   *  that scales with roster size and the one worth asserting on. */
  get statements(): number;
  /** Summed client-observed duration. Not server execution time: it
   *  includes round trip, which is the honest thing for a latency budget. */
  get totalMs(): number;
  /** How many times each distinct statement shape ran — the fan-out shows
   *  up here as one shape with a count of N. */
  byShape(): { sql: string; n: number; ms: number }[];
  stop(): void;
}

const oneLine = (sql: string): string => sql.replace(/\s+/g, " ").trim();

/** A statement's shape: parameters and literals removed, so N executions of
 *  the same prepared query collapse to one row. */
const shapeOf = (sql: string): string =>
  oneLine(sql)
    .replace(/\$\d+/g, "$?")
    .replace(/'[^']*'/g, "'?'")
    .replace(/\b\d+\b/g, "?");

const isTxnControl = (sql: string): boolean =>
  /^(begin|commit|rollback|savepoint|release)\b/i.test(oneLine(sql));

export function countQueries(pool: Pool): QueryTally {
  const records: QueryRecord[] = [];
  let stopped = false;

  const wrap = <T extends { query: (...args: never[]) => unknown }>(target: T): (() => void) => {
    const original = target.query.bind(target) as (...args: unknown[]) => unknown;
    const patched = (...args: unknown[]): unknown => {
      const first = args[0];
      const sql =
        typeof first === "string"
          ? first
          : typeof (first as { text?: unknown })?.text === "string"
            ? ((first as { text: string }).text)
            : "<unknown>";
      const started = performance.now();
      const finish = () => {
        if (!stopped) records.push({ sql: oneLine(sql), ms: performance.now() - started });
      };

      const result = original(...args);
      // `query` returns a promise unless a callback was supplied; record on
      // settle either way so a failed statement is still counted.
      if (result && typeof (result as Promise<unknown>).then === "function") {
        return (result as Promise<unknown>).then(
          (value) => {
            finish();
            return value;
          },
          (err) => {
            finish();
            throw err;
          },
        );
      }
      finish();
      return result;
    };
    (target as { query: unknown }).query = patched;
    return () => {
      (target as { query: unknown }).query = original;
    };
  };

  const restorers: (() => void)[] = [wrap(pool as unknown as { query: (...a: never[]) => unknown })];

  // Every client handed out from here on, including ones a transaction takes.
  const onConnect = (client: PoolClient): void => {
    restorers.push(wrap(client as unknown as { query: (...a: never[]) => unknown }));
  };
  pool.on("connect", onConnect);

  return {
    records,
    get count() {
      return records.length;
    },
    get statements() {
      return records.filter((r) => !isTxnControl(r.sql)).length;
    },
    get totalMs() {
      return records.reduce((sum, r) => sum + r.ms, 0);
    },
    byShape() {
      const map = new Map<string, { sql: string; n: number; ms: number }>();
      for (const r of records) {
        const shape = shapeOf(r.sql);
        const existing = map.get(shape);
        if (existing) {
          existing.n += 1;
          existing.ms += r.ms;
        } else {
          map.set(shape, { sql: shape, n: 1, ms: r.ms });
        }
      }
      return [...map.values()].sort((a, b) => b.n - a.n);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      pool.off("connect", onConnect);
      for (const restore of restorers.splice(0)) restore();
    },
  };
}
