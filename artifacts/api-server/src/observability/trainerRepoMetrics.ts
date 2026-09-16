/**
 * Count audit rows as they are written, without touching a single call site.
 *
 * The alert that matters most on this surface is "clinical reads are still
 * happening and audit rows have stopped" — a silent audit failure is
 * indistinguishable from a quiet morning unless something counts both. There
 * are twelve `logAccess` call sites across four routers and adding a counter
 * to each is exactly the pattern that produced the gaps Step 2 closed, so the
 * count lives in one decorator around the repository instead.
 *
 * `lib/db` deliberately has no metrics dependency — it is persistence and
 * nothing else — so the decoration happens here, at the seam where the API
 * server builds its repo.
 *
 * Everything else passes straight through. This must not change a return
 * value, swallow an error, or alter ordering: a counter that changed
 * behaviour would be worse than no counter.
 */
import type { TrainerRepo } from "@workspace/db";

import { incCounter, TRAINER_COUNTERS } from "../middlewares/trainerOps";

export function instrumentTrainerRepo(repo: TrainerRepo): TrainerRepo {
  return {
    ...repo,

    async logAccess(entry) {
      // Counted AFTER the write resolves. Counting before would report rows
      // that a failed insert never produced, which is the exact failure the
      // alert exists to catch.
      await repo.logAccess(entry);
      incCounter(TRAINER_COUNTERS.auditRows);
    },

    async logAccessMany(entries) {
      await repo.logAccessMany(entries);
      incCounter(TRAINER_COUNTERS.auditRows, entries.length);
    },
  };
}
