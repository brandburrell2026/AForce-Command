/**
 * Trainer surface API — Phase 1. Roles, redaction, consent, audit.
 *
 * Deliberately hand-written and kept OUT of the consumer OpenAPI spec and
 * `@workspace/api-client-react`, following the convention set by
 * `commandCenterAdmin.ts`: a privileged shape has no business in a bundle
 * shipped to every consumer client.
 *
 * Every response on this router is produced by `projectAthlete`. No route
 * returns a repository row directly, and no route builds a payload by deleting
 * keys — projections construct upward so an unwritten field cannot leak.
 *
 * Mounted behind `feature.trainer_api` (default OFF). With the flag off every
 * route 404s, which is also what a non-member sees.
 *
 * No UI in this phase, by design. The acceptance criteria are provable from
 * the API alone, which is the point of building this half first.
 */
import { Router, type IRouter } from "express";

import { createTrainerRepo, db, type TrainerRepo } from "@workspace/db";
import { isEnabled } from "../config/featureFlags";
import { sendApiError } from "../lib/apiError";
import { serializeError } from "../lib/serializeError";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAthleteSubject } from "../middlewares/requireAthleteSubject";
import { requireProgramAccess } from "../middlewares/requireProgramAccess";
import {
  disclosedMedical,
  projectAthlete,
  type AthleteSource,
} from "../lib/trainer/redaction";
import { levelReadsRoster, levelWritesAvailability } from "../lib/trainer/roles";

const AVAILABILITY_STATUSES = ["available", "limited", "out"] as const;
type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** The request id lives on `req.id` (see `buildApiErrorBody`), not `req.requestId`. */
function requestIdOf(req: { id?: unknown }): string | null {
  const id = req.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

function parseAvailabilityStatus(value: unknown): AvailabilityStatus | null {
  return typeof value === "string" && (AVAILABILITY_STATUSES as readonly string[]).includes(value)
    ? (value as AvailabilityStatus)
    : null;
}

/**
 * Assemble the full internal shape for one athlete.
 *
 * Phase 1 reads membership, consent, availability and notes. Readiness and
 * hydration are left null here: wiring them to `aforce_user_state` and
 * `aforce_score_snapshots` is Phase 2's board work, and inventing numbers now
 * would put fabricated data behind a redaction test that is supposed to prove
 * the real thing. The projection and the audit do not care whether a value is
 * null — they care which KEYS the level may see.
 */
async function loadAthleteSource(
  repo: TrainerRepo,
  programId: string,
  athleteUserId: string,
  displayName: string,
  includeMedical: boolean,
): Promise<AthleteSource> {
  const [consent, availability, notes] = await Promise.all([
    repo.consent(programId, athleteUserId),
    repo.currentAvailability(programId, athleteUserId),
    includeMedical ? repo.medicalNotes(programId, athleteUserId) : Promise.resolve([]),
  ]);

  return buildAthleteSource({ athleteUserId, displayName, consent, availability, notes });
}

/**
 * Assemble the source shape from parts that have ALREADY been fetched.
 *
 * Split out of `loadAthleteSource` so the single-athlete route and the
 * roster's batched reads build the identical shape from the identical
 * defaults. If a missing availability row meant `null` on one path and
 * something else on the other, the projection would differ between the board
 * and the record for the same athlete, and no test on either path alone would
 * notice. One assembler is what stops that.
 */
function buildAthleteSource(parts: {
  athleteUserId: string;
  displayName: string;
  consent: { granted: boolean; decisionSeq: number };
  availability: {
    status: string;
    reason: string | null;
    setByUserId: string;
    setAt: string;
  } | null;
  notes: AthleteSource["medicalNotes"];
}): AthleteSource {
  const { athleteUserId, displayName, consent, availability, notes } = parts;
  return {
    athleteUserId,
    displayName,
    position: null,
    consentGranted: consent.granted,
    consentDecisionSeq: consent.decisionSeq,
    readinessScore: null,
    tier: null,
    hydrationScore: null,
    minutesSinceLastIntake: null,
    loadSummary: null,
    loadDetail: null,
    availabilityStatus: availability?.status ?? null,
    availabilityReason: availability?.reason ?? null,
    availabilitySetByUserId: availability?.setByUserId ?? null,
    availabilitySetAt: availability?.setAt ?? null,
    medicalNotes: notes,
  };
}

export function buildTrainerRouter(repo: TrainerRepo): IRouter {
  const router: IRouter = Router();

  // The flag gate runs before auth so a disabled surface is indistinguishable
  // from one that does not exist.
  router.use((req, res, next) => {
    if (!isEnabled("feature.trainer_api")) {
      sendApiError(req, res, 404, "not_found");
      return;
    }
    next();
  });

  // NOTE: `requireAuth` is applied by the default export below, not here.
  // Keeping it outside the builder is what lets the acceptance suite mount
  // this router with an injected identity and prove the redaction rules
  // without Clerk and without Postgres — the same shape the intake route
  // tests use.

  // ─── GET /trainer/programs/:programId/roster ─────────────────────────────
  router.get("/programs/:programId/roster", requireProgramAccess(repo), async (req, res) => {
    const access = req.programAccess;
    const actorId = req.userId;
    if (!access || !actorId) {
      sendApiError(req, res, 403, "program_access_required");
      return;
    }

    if (!levelReadsRoster(access.level)) {
      // An athlete has no roster view. Their own record is their own route.
      sendApiError(req, res, 403, "roster_not_available_to_role");
      return;
    }

    try {
      // FOUR STATEMENTS, whatever the roster size. This used to assemble
      // itself one athlete at a time — a consent read, an availability read
      // and a notes read per member, then one audit INSERT per disclosure.
      // At 500 athletes that was 1,902 statements and 49.7s of summed
      // database time for a single board load, issued as a nested
      // `Promise.all` against a pool of 10 shared with checkout, intake and
      // the health checks. Measured, before and after, in
      // `docs/benchmarks/trainer-board.md`.
      //
      // Nothing about WHAT is returned changed: the same projection runs per
      // athlete, on the same source shape, and a missing row still means
      // exactly what it meant when each athlete was fetched alone.
      const athletes = await repo.athletes(access.programId);
      const ids = athletes.map((m) => m.userId);
      const includeMedical = access.level === "clinical";

      const [consents, availability, notes] = await Promise.all([
        repo.consentMany(access.programId, ids),
        repo.currentAvailabilityMany(access.programId, ids),
        includeMedical
          ? repo.medicalNotesMany(access.programId, ids)
          : Promise.resolve(new Map<string, never[]>()),
      ]);

      const rows = athletes.map((m) => {
        const src = buildAthleteSource({
          athleteUserId: m.userId,
          displayName: m.userId, // display name lands with the roster import
          consent: consents.get(m.userId) ?? { granted: false, decisionSeq: 0 },
          availability: availability.get(m.userId) ?? null,
          notes: notes.get(m.userId) ?? [],
        });
        return { src, projected: projectAthlete(src, access.level) };
      });

      // Audit every row that actually disclosed medical content. One entry per
      // subject, never a single "read the roster" row — the log answers "who
      // looked at ME", which a roster-level entry could not. Batched into one
      // INSERT; the rows written are identical to the ones written before.
      await repo.logAccessMany(
        rows
          .filter((r) => disclosedMedical(r.projected.fields))
          .map((r) => ({
            actorUserId: actorId,
            subjectUserId: r.src.athleteUserId,
            programId: access.programId,
            actorRole: access.role,
            resource: "roster",
            action: "read",
            fields: r.projected.fields,
            redactionLevel: access.level,
            consentDecisionSeq: r.src.consentDecisionSeq,
            requestId: requestIdOf(req),
            route: req.path,
          })),
      );

      res.json({
        programId: access.programId,
        redactionLevel: access.level,
        athletes: rows.map((r) => r.projected.payload),
      });
    } catch (err) {
      logger.error({ err: serializeError(err), programId: access.programId }, "[trainer] roster read failed");
      sendApiError(req, res, 500, "roster_read_failed");
    }
  });

  // ─── GET /trainer/programs/:programId/athletes/:athleteId ────────────────
  router.get(
    "/programs/:programId/athletes/:athleteId",
    requireProgramAccess(repo),
    // NOT consent-gated at the middleware: this route's refusal is a
    // PROJECTION, not a 403. An unconsented athlete collapses to identity and
    // consent state inside `projectAthlete`, so staff can see the roster is
    // incomplete without learning anything about the person. That is the
    // Phase 0 §0b ruling, and turning it into an error would lose it.
    requireAthleteSubject(repo, { consent: "not-required" }),
    async (req, res) => {
      const access = req.programAccess;
      const actorId = req.userId;
      const subject = req.athleteSubject;
      if (!access || !actorId || !subject) {
        sendApiError(req, res, 403, "program_access_required");
        return;
      }
      const athleteId = subject.athleteUserId;

      try {
        const src = await loadAthleteSource(
          repo,
          access.programId,
          athleteId,
          athleteId,
          access.level === "clinical" || access.level === "self",
        );
        const projected = projectAthlete(src, access.level);

        if (disclosedMedical(projected.fields)) {
          await repo.logAccess({
            actorUserId: actorId,
            subjectUserId: athleteId,
            programId: access.programId,
            actorRole: access.role,
            resource: "athlete_record",
            action: "read",
            fields: projected.fields,
            redactionLevel: access.level,
            consentDecisionSeq: src.consentDecisionSeq,
            requestId: requestIdOf(req),
            route: req.path,
          });
        }

        res.json({
          programId: access.programId,
          redactionLevel: access.level,
          athlete: projected.payload,
        });
      } catch (err) {
        logger.error({ err: serializeError(err), programId: access.programId }, "[trainer] athlete read failed");
        sendApiError(req, res, 500, "athlete_read_failed");
      }
    },
  );

  // ─── POST /trainer/programs/:programId/athletes/:athleteId/availability ──
  router.post(
    "/programs/:programId/athletes/:athleteId/availability",
    requireProgramAccess(repo),
    // Consent gates DISCLOSURE, not documentation — founder ruling,
    // 2026-09-16. An athlete who revokes does not thereby become unrecorded:
    // a clinician who gave care has a duty to write it down, and blocking the
    // write would destroy a record someone is obliged to keep. Reading any of
    // it back IS gated, which is where revocation takes effect. Setting availability is also a safety
    // act: revoking consent must not clear an athlete to play.
    requireAthleteSubject(repo, { consent: "not-required" }),
    async (req, res) => {
      const access = req.programAccess;
      const actorId = req.userId;
      const subject = req.athleteSubject;
      if (!access || !actorId || !subject) {
        sendApiError(req, res, 403, "program_access_required");
        return;
      }
      const athleteId = subject.athleteUserId;

      // Only the clinical roles write availability. The system never sets it
      // and no other role may — §2.2: clearance is entered by a credentialed
      // human, timestamped and attributed.
      if (!levelWritesAvailability(access.level)) {
        sendApiError(req, res, 403, "availability_write_not_permitted");
        return;
      }

      const body = req.body as
        | { status?: unknown; reason?: unknown; baseVersion?: unknown }
        | undefined;
      const status = parseAvailabilityStatus(body?.status);
      if (!status) {
        sendApiError(req, res, 400, "invalid_availability_status");
        return;
      }
      const reason = typeof body?.reason === "string" && body.reason.length > 0 ? body.reason : null;

      // The version the caller was looking at when they decided. `null` is a
      // positive claim — "availability has never been set" — not a missing
      // field, so an absent `baseVersion` is a 400 rather than a free pass.
      // A client that does not send one is a client that would overwrite
      // anything, which is the behaviour this replaces.
      if (!("baseVersion" in (body ?? {}))) {
        sendApiError(req, res, 400, "base_version_required");
        return;
      }
      const rawVersion = body?.baseVersion;
      if (rawVersion !== null && !Number.isInteger(rawVersion)) {
        sendApiError(req, res, 400, "invalid_base_version");
        return;
      }
      const baseVersion = rawVersion as number | null;

      try {
        const applied = await repo.appendAvailability({
          programId: access.programId,
          athleteUserId: athleteId,
          status,
          reason,
          setByUserId: actorId,
          expectedVersion: baseVersion,
        });

        if (!applied.ok) {
          // 409 with BOTH values. The client holds them side by side until a
          // person chooses; it does not merge them and neither does this.
          res.status(409).json({
            error: "availability_conflict",
            attempted: { status, reason },
            current: applied.current,
          });
          return;
        }

        // EVERY status write is audited, whether or not it carried a reason.
        // The brief's §Phase 1 criterion is "every status write", not "every
        // status write that disclosed something".
        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "availability",
          action: "write",
          fields: reason === null ? ["status"] : ["status", "reason"],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.status(201).json({ ok: true, status });
      } catch (err) {
        logger.error({ err: serializeError(err), programId: access.programId }, "[trainer] availability write failed");
        sendApiError(req, res, 500, "availability_write_failed");
      }
    },
  );

  // ─── POST /trainer/programs/:programId/consent ───────────────────────────
  // The ATHLETE's own grant or revoke. No staff role may call it — consent
  // that staff can set is not consent.
  router.post("/programs/:programId/consent", requireProgramAccess(repo), async (req, res) => {
    const access = req.programAccess;
    const actorId = req.userId;
    if (!access || !actorId) {
      sendApiError(req, res, 403, "program_access_required");
      return;
    }
    if (access.level !== "self") {
      sendApiError(req, res, 403, "consent_is_athlete_only");
      return;
    }

    const body = req.body as { granted?: unknown; expectedSeq?: unknown } | undefined;
    if (typeof body?.granted !== "boolean" || typeof body?.expectedSeq !== "number") {
      sendApiError(req, res, 400, "invalid_consent_payload");
      return;
    }

    try {
      const result = await repo.setConsent({
        programId: access.programId,
        athleteUserId: actorId,
        granted: body.granted,
        expectedSeq: body.expectedSeq,
      });
      if (!result.ok) {
        // 409: the caller's expectation did not match committed state. The
        // current state comes back so the client can resolve without guessing.
        res.status(409).json({ ok: false, current: result.current });
        return;
      }
      res.json({ ok: true, state: result.state });
    } catch (err) {
      logger.error({ err: serializeError(err), programId: access.programId }, "[trainer] consent write failed");
      sendApiError(req, res, 500, "consent_write_failed");
    }
  });

  return router;
}

/**
 * Default wiring for the app: real repo, real auth.
 *
 * Tests call `buildTrainerRouter` directly with a fake repo and their own
 * identity middleware.
 */
function buildMountedTrainerRouter(): IRouter {
  const mounted: IRouter = Router();
  mounted.use(requireAuth);
  mounted.use(buildTrainerRouter(createTrainerRepo(db)));
  return mounted;
}

export const trainerRouter: IRouter = buildMountedTrainerRouter();
