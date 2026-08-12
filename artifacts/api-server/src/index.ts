import { createServer } from "node:http";
import { serializeError } from "./lib/serializeError";
import { db } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { beginDrain } from "./health/checks";
import { attachAforceHub } from "./lib/aforceHub";
import { initStripe } from "./lib/initStripe";
import { maybeStartWhoopFetchSweep } from "./lib/whoopFetchSweepBootstrap";
import { maybeStartWhoopAuthStatePurge } from "./lib/whoopAuthStatePurgeBootstrap";
import { maybeStartWhoopTokenBackfill } from "./lib/whoopTokenBackfillBootstrap";
import { getWhoopRefreshRegistry } from "./lib/whoopRegistry";
import {
  maybeStartOuraFetchSweep,
  maybeStartOuraAuthStatePurge,
} from "./lib/ouraFetchSweepBootstrap";
import { getOuraRefreshRegistry } from "./lib/ouraRegistry";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Express + WS share one HTTP server so they share one port (the
// Replit artifact only exposes a single PORT per workflow).
const server = createServer(app);
attachAforceHub(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  // Fire-and-forget — initStripe handles its own errors and falls back
  // gracefully if the Stripe integration isn't connected yet.
  void initStripe();
  // Hidden-infra: WHOOP fetch sweep only starts when
  // WHOOP_FETCH_SWEEP_INTERVAL_MS is set to a positive number. Shares
  // the process-singleton WhoopRefreshRegistry with the admin trigger
  // route so concurrent fetches for the same user collapse to one POST.
  maybeStartWhoopFetchSweep({
    db,
    refreshRegistry: getWhoopRefreshRegistry(),
    log: logger,
  });
  // Hidden-infra: only ticks when WHOOP_AUTH_STATE_PURGE_INTERVAL_MS
  // is set to a positive number. Reaps abandoned OAuth authorize rows
  // from `aforce_whoop_auth_states` that `consume` never deleted.
  // Hygiene only — table is bounded by inflight authorize attempts
  // per TTL window.
  maybeStartWhoopAuthStatePurge({
    db,
    log: logger,
  });
  // Hidden-infra: only ticks when WHOOP_TOKEN_BACKFILL_INTERVAL_MS is
  // set to a positive number AND WHOOP_TOKEN_ENCRYPTION_KEY is set.
  // Phase B of pgcrypto rollout — fills enc columns for legacy rows
  // written before encryption was enabled. Once it reports filled=0
  // for a sustained window, Phase C can flip reads to enc-only and
  // drop the plaintext columns.
  maybeStartWhoopTokenBackfill({
    db,
    log: logger,
  });
  // Hidden-infra: dormant by default — only starts when
  // OURA_FETCH_SWEEP_INTERVAL_MS is set to a positive number. Mirrors
  // the WHOOP fetch sweep wiring above; shares the process-singleton
  // OuraRefreshRegistry with the Oura sync route so concurrent
  // fetches for the same user collapse to one refresh.
  maybeStartOuraFetchSweep({
    db,
    refreshRegistry: getOuraRefreshRegistry(),
    log: logger,
  });
  // Hidden-infra: dormant by default — only ticks when
  // OURA_AUTH_STATE_PURGE_INTERVAL_MS is set to a positive number.
  // Reaps abandoned OAuth authorize rows from
  // `aforce_oura_auth_states` that `consume` never deleted. Hygiene
  // only, mirrors the WHOOP auth-state purge above.
  maybeStartOuraAuthStatePurge({
    db,
    log: logger,
  });
});

server.on("error", (err) => {
  logger.error({ err: serializeError(err) }, "Error listening on port");
  process.exit(1);
});

// Wave-3 PR8: an unhandled rejection/exception previously crashed the
// process with ZERO log output. Log a redacted fatal line (Railway
// captures stdout) and exit non-zero so the supervisor restarts us —
// fail loudly, never limp on in unknown state.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: serializeError(reason) }, "unhandledRejection — exiting");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err: serializeError(err) }, "uncaughtException — exiting");
  process.exit(1);
});

// Wave-3 PR7: graceful drain. SIGTERM flips /healthz(/deep) to `draining`
// (503) so the LB stops routing here, then the server closes once
// in-flight requests finish; a 20s deadline force-exits a wedged drain.
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — draining");
  beginDrain();
  server.close(() => {
    logger.info("drained; exiting");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("drain deadline exceeded; forcing exit");
    process.exit(0);
  }, 20_000).unref();
});
