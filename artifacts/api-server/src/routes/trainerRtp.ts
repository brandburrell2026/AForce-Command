/**
 * Return-to-play API — Phase 6.
 *
 * Mounted at /trainer alongside the Phase 1 and Phase 4 routers, behind the
 * same `feature.trainer_api` flag.
 *
 * THE RULE THIS ROUTER EXISTS TO HOLD: a stage advances only when a
 * credentialed human signs it. There is no endpoint that sets a stage, no
 * endpoint that takes a stage number as a target, and no scheduler. The only
 * write that moves a progression is a sign-off carrying the caller's own id,
 * and it is refused unless it is the next stage in sequence.
 *
 * The coach projection is built by `coachView`, which constructs four fields
 * upward and is tested against the note text, the stopped reason and every
 * forbidden field name.
 */
import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";

import {
  createTrainerRepo,
  createTrainerRtpRepo,
  db,
  type TrainerRepo,
  type TrainerRtpRepo,
} from "@workspace/db";
import { isEnabled } from "../config/featureFlags";
import { sendApiError } from "../lib/apiError";
import { serializeError } from "../lib/serializeError";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { instrumentTrainerRepo } from "../observability/trainerRepoMetrics";
import { trainerMetrics, trainerRateLimit } from "../middlewares/trainerOps";
import { requireAthleteSubject } from "../middlewares/requireAthleteSubject";
import { requireProgramAccess } from "../middlewares/requireProgramAccess";
import { canSignOff, coachView, staffView, type RtpSource, type RtpStatus } from "../lib/trainer/returnToPlay";
import { levelWritesAvailability } from "../lib/trainer/roles";

function requestIdOf(req: { id?: unknown }): string | null {
  const id = req.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

/**
 * Bounds on a protocol's stage list.
 *
 * A protocol had no size limit anywhere, and `startProgression` FREEZES the
 * whole list into every progression — so an unbounded list is not one large
 * row, it is one large row per athlete per protocol, copied forever. The
 * strings are rendered into the coach view and the chart PDF as well.
 *
 * These ceilings are far above any real protocol (a graduated return to play
 * is five or six stages) and far below anything that hurts.
 */
const MAX_STAGES = 32;
const MAX_STAGE_KEY = 64;
const MAX_STAGE_LABEL = 120;
const MAX_STAGE_DESCRIPTION = 500;

function parseStages(value: unknown): { key: string; label: string; description?: string }[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > MAX_STAGES) return null;
  const out: { key: string; label: string; description?: string }[] = [];
  const keys = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const stage = raw as Record<string, unknown>;
    if (typeof stage["key"] !== "string" || stage["key"].length === 0) return null;
    if (stage["key"].length > MAX_STAGE_KEY) return null;
    if (typeof stage["label"] !== "string" || stage["label"].length === 0) return null;
    if (stage["label"].length > MAX_STAGE_LABEL) return null;
    if (typeof stage["description"] === "string" && stage["description"].length > MAX_STAGE_DESCRIPTION) {
      return null;
    }
    if (keys.has(stage["key"])) return null;
    keys.add(stage["key"]);
    out.push({
      key: stage["key"],
      label: stage["label"],
      ...(typeof stage["description"] === "string" ? { description: stage["description"] } : {}),
    });
  }
  return out;
}

export function buildTrainerRtpRouter(repo: TrainerRepo, rtp: TrainerRtpRepo): IRouter {
  const router: IRouter = Router();

  router.use((req, res, next) => {
    if (!isEnabled("feature.trainer_api")) {
      sendApiError(req, res, 404, "not_found");
      return;
    }
    next();
  });

  // ─── POST /programs/:programId/rtp/protocols ──────────────────────────────
  // Program-defined stages. Nothing is hardcoded in this repo.
  router.post("/programs/:programId/rtp/protocols", requireProgramAccess(repo), async (req, res) => {
    const access = req.programAccess;
    const actorId = req.userId;
    if (!access || !actorId) {
      sendApiError(req, res, 403, "program_access_required");
      return;
    }
    if (!levelWritesAvailability(access.level)) {
      sendApiError(req, res, 403, "protocol_write_not_permitted");
      return;
    }

    const body = req.body as { name?: unknown; stages?: unknown; version?: unknown } | undefined;
    const stages = parseStages(body?.stages);
    if (typeof body?.name !== "string" || body.name.length === 0 || !stages) {
      sendApiError(req, res, 400, "invalid_protocol");
      return;
    }

    try {
      const protocol = await rtp.createProtocol({
        id: randomUUID(),
        programId: access.programId,
        name: body.name,
        version: typeof body.version === "number" && Number.isInteger(body.version) ? body.version : 1,
        stages,
        createdByUserId: actorId,
      });
      res.status(201).json({ ok: true, protocol });
    } catch (err) {
      logger.error({ err: serializeError(err) }, "[trainer] protocol write failed");
      sendApiError(req, res, 500, "protocol_write_failed");
    }
  });

  // ─── POST /programs/:programId/athletes/:athleteId/rtp ────────────────────
  router.post(
    "/programs/:programId/athletes/:athleteId/rtp",
    requireProgramAccess(repo),
    // Consent gates DISCLOSURE, not documentation — founder ruling,
    // 2026-09-16. An athlete who revokes does not thereby become unrecorded:
    // a clinician who gave care has a duty to write it down, and blocking the
    // write would destroy a record someone is obliged to keep. Reading any of
    // it back IS gated, which is where revocation takes effect.
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
      if (!levelWritesAvailability(access.level)) {
        sendApiError(req, res, 403, "rtp_write_not_permitted");
        return;
      }

      const protocolId = (req.body as { protocolId?: unknown })?.protocolId;
      if (typeof protocolId !== "string") {
        sendApiError(req, res, 400, "protocol_id_required");
        return;
      }

      try {
        const protocol = (await rtp.protocols(access.programId)).find((p) => p.id === protocolId);
        if (!protocol) {
          sendApiError(req, res, 404, "protocol_not_found");
          return;
        }

        const progression = await rtp.startProgression({
          id: randomUUID(),
          programId: access.programId,
          athleteUserId: athleteId,
          protocolId: protocol.id,
          stages: protocol.stages,
          startedByUserId: actorId,
        });

        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "return_to_play",
          action: "write",
          fields: ["protocolId", "stagesSnapshot"],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.status(201).json({ ok: true, progression });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] rtp start failed");
        sendApiError(req, res, 500, "rtp_start_failed");
      }
    },
  );

  // ─── POST /programs/:programId/athletes/:athleteId/rtp/signoff ────────────
  // The ONLY way a stage advances. Requires the caller's own credential, the
  // exact next stage index, and refuses everything else.
  router.post(
    "/programs/:programId/athletes/:athleteId/rtp/signoff",
    requireProgramAccess(repo),
    // Consent gates DISCLOSURE, not documentation — founder ruling,
    // 2026-09-16. An athlete who revokes does not thereby become unrecorded:
    // a clinician who gave care has a duty to write it down, and blocking the
    // write would destroy a record someone is obliged to keep. Reading any of
    // it back IS gated, which is where revocation takes effect.
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
      if (!levelWritesAvailability(access.level)) {
        sendApiError(req, res, 403, "signoff_not_permitted");
        return;
      }

      const stageIndex = (req.body as { stageIndex?: unknown })?.stageIndex;
      if (typeof stageIndex !== "number") {
        sendApiError(req, res, 400, "stage_index_required");
        return;
      }

      try {
        const progression = await rtp.progression(access.programId, athleteId);
        if (!progression) {
          sendApiError(req, res, 404, "progression_not_found");
          return;
        }
        const signoffs = await rtp.signoffs(progression.id);

        const source: RtpSource = {
          progressionId: progression.id,
          athleteUserId: progression.athleteUserId,
          stages: progression.stages,
          signoffs,
          status: progression.status as RtpStatus,
          stoppedReason: progression.stoppedReason,
          startedAt: progression.startedAt,
        };

        const allowed = canSignOff(source, stageIndex);
        if (!allowed.ok) {
          // 409, not 400: the request is well formed, the progression simply
          // is not where the caller thinks it is.
          res.status(409).json({ ok: false, code: allowed.reason });
          return;
        }

        const stage = progression.stages[stageIndex]!;
        const note = (req.body as { note?: unknown })?.note;
        const result = await rtp.signOff({
          progressionId: progression.id,
          programId: access.programId,
          stageIndex,
          stageKey: stage.key,
          signedByUserId: actorId,
          note: typeof note === "string" && note.length > 0 ? note : null,
        });

        if (!result.ok) {
          // Lost the race at the unique index. Someone else signed it first.
          res.status(409).json({ ok: false, code: "stage_already_signed" });
          return;
        }

        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "return_to_play",
          action: "write",
          fields: result.entry.note === null ? ["stageIndex"] : ["stageIndex", "note"],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.status(201).json({ ok: true, entry: result.entry });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] rtp signoff failed");
        sendApiError(req, res, 500, "rtp_signoff_failed");
      }
    },
  );

  // ─── GET /programs/:programId/athletes/:athleteId/rtp ─────────────────────
  // Role-projected. A coach gets four fields; staff get the protocol.
  router.get(
    "/programs/:programId/athletes/:athleteId/rtp",
    requireProgramAccess(repo),
    requireAthleteSubject(repo),
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
        const progression = await rtp.progression(access.programId, athleteId);
        if (!progression) {
          res.json({ progression: null });
          return;
        }
        const signoffs = await rtp.signoffs(progression.id);
        const availability = await repo.currentAvailability(access.programId, athleteId);

        const source: RtpSource = {
          progressionId: progression.id,
          athleteUserId: progression.athleteUserId,
          stages: progression.stages,
          signoffs,
          status: progression.status as RtpStatus,
          stoppedReason: progression.stoppedReason,
          startedAt: progression.startedAt,
          availabilityStatus: availability?.status ?? null,
        };

        // Clinical and the athlete themselves see the protocol. Everyone
        // else — coach, strength, compliance — gets the four-field view.
        const staff = access.level === "clinical" || access.level === "self";
        const payload = staff ? staffView(source) : coachView(source);

        // LOGGED BEFORE THE BRANCH, not inside it. This used to return the
        // coach view above the log, so every coach and strength read of a
        // return-to-play progression left no trace at all — the reads most
        // worth tracing, because they are the ones going to someone who may
        // not see why an athlete is on a protocol. `fields` names what THIS
        // level actually received, so the row records the disclosure that
        // happened rather than the fullest one that could have.
        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "return_to_play",
          action: "read",
          fields: Object.keys(payload),
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.json({ redactionLevel: access.level, progression: payload });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] rtp read failed");
        sendApiError(req, res, 500, "rtp_read_failed");
      }
    },
  );

  return router;
}

function buildMountedTrainerRtpRouter(): IRouter {
  const mounted: IRouter = Router();
  // Metrics first, so a 429 is measured too — a surface that goes
  // quiet because it is being throttled must not look like a surface
  // nobody is using.
  mounted.use(trainerMetrics);
  mounted.use(requireAuth);
  // After auth, so the limiter keys on the user rather than punishing
  // a whole training room behind one connection.
  mounted.use(trainerRateLimit);
  mounted.use(buildTrainerRtpRouter(instrumentTrainerRepo(createTrainerRepo(db)), createTrainerRtpRepo(db)));
  return mounted;
}

export const trainerRtpRouter: IRouter = buildMountedTrainerRtpRouter();
