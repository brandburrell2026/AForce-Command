/**
 * Trainer documentation API — Phase 4. Screening, notes, chart export.
 *
 * A separate router from `trainer.ts`, mounted at the same path. Phase 1's
 * redaction surface keeps its own builder and its own tests untouched, and
 * this one carries the write paths that only a clinical role may use.
 *
 * Behind `feature.trainer_api`, default OFF, like everything else here.
 *
 * TWO RULES THIS FILE ENFORCES AT THE EDGE:
 *
 *   1. NOTHING IS OVERWRITTEN. There is no PUT and no PATCH. An amendment is
 *      a POST that inserts a new version; the repository exposes no update
 *      path for note text, so this is structural rather than a convention.
 *
 *   2. NO PLAINTEXT NOTES IN PRODUCTION. Phase 0 ruling Q9 builds to the
 *      strictest plausible regime, so a note write is refused outright when
 *      no encryption key is configured in production. Failing the write is
 *      the honest outcome; writing plaintext and filing a follow-up is not.
 */
import { Router, type IRouter } from "express";

import {
  createTrainerDocsRepo,
  createTrainerRepo,
  db,
  noteEncryptionConfigured,
  noteEncryptionProblem,
  type TrainerDocsRepo,
  type TrainerRepo,
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
import { incCounter, TRAINER_COUNTERS } from "../middlewares/trainerOps";
import { buildChartLines, renderChartPdf } from "../lib/trainer/chartPdf";
import { levelSeesMedical, levelWritesAvailability } from "../lib/trainer/roles";

/** The request id lives on `req.id` (see `buildApiErrorBody`). */
function requestIdOf(req: { id?: unknown }): string | null {
  const id = req.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

function parseSoapFields(body: unknown): {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
} | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const field = (key: string): string | null => {
    const value = b[key];
    if (value === undefined || value === null) return null;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };
  const fields = {
    subjective: field("subjective"),
    objective: field("objective"),
    assessment: field("assessment"),
    plan: field("plan"),
  };
  // A note with nothing in it is not a note.
  const hasContent = Object.values(fields).some((v) => v !== null);
  return hasContent ? fields : null;
}

function parseAnswers(value: unknown): Record<string, number> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 1 || raw > 5) return null;
    out[key] = Math.round(raw);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * The client's idempotency key, if it sent one.
 *
 * The offline outbox already sends its item id under this name; it is stable
 * across every retry of one entry and different for every distinct entry.
 * Bounded and character-restricted because it reaches a unique index: an
 * unbounded attacker-chosen string in an index is a denial-of-service, and a
 * key with surprising characters is one nobody can grep for in an incident.
 */
function parseIdempotencyKey(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as { idempotencyKey?: unknown }).idempotencyKey;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return null;
  return /^[A-Za-z0-9._:-]+$/.test(trimmed) ? trimmed : null;
}

export function buildTrainerDocsRouter(repo: TrainerRepo, docs: TrainerDocsRepo): IRouter {
  const router: IRouter = Router();

  router.use((req, res, next) => {
    if (!isEnabled("feature.trainer_api")) {
      sendApiError(req, res, 404, "not_found");
      return;
    }
    next();
  });

  // ─── POST /programs/:programId/questionnaire ─────────────────────────────
  // The athlete's own morning submission. Staff cannot answer for them.
  router.post("/programs/:programId/questionnaire", requireProgramAccess(repo), async (req, res) => {
    const access = req.programAccess;
    const actorId = req.userId;
    if (!access || !actorId) {
      sendApiError(req, res, 403, "program_access_required");
      return;
    }
    if (access.level !== "self") {
      sendApiError(req, res, 403, "questionnaire_is_athlete_only");
      return;
    }

    const body = req.body as { answers?: unknown; forDate?: unknown } | undefined;
    const answers = parseAnswers(body?.answers);
    const forDate = typeof body?.forDate === "string" ? body.forDate : null;
    if (!answers || !forDate || !/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
      sendApiError(req, res, 400, "invalid_questionnaire");
      return;
    }

    try {
      const entry = await docs.submitQuestionnaire({
        programId: access.programId,
        athleteUserId: actorId,
        answers,
        forDate,
      });

      // Actor and subject are the same person here, which is exactly why this
      // is worth a row: the athlete's own "who touched my record" query
      // should show their submission sitting beside every staff read of it.
      const consent = await repo.consent(access.programId, actorId);
      await repo.logAccess({
        actorUserId: actorId,
        subjectUserId: actorId,
        programId: access.programId,
        actorRole: access.role,
        resource: "questionnaire",
        action: "write",
        fields: ["answers", "forDate"],
        redactionLevel: access.level,
        consentDecisionSeq: consent.decisionSeq,
        requestId: requestIdOf(req),
        route: req.path,
      });

      res.status(201).json({ ok: true, entry });
    } catch (err) {
      logger.error({ err: serializeError(err) }, "[trainer] questionnaire write failed");
      sendApiError(req, res, 500, "questionnaire_write_failed");
    }
  });

  // ─── POST /programs/:programId/athletes/:athleteId/screening ──────────────
  router.post(
    "/programs/:programId/athletes/:athleteId/screening",
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
        sendApiError(req, res, 403, "screening_write_not_permitted");
        return;
      }

      const body = req.body as { items?: unknown; cleared?: unknown; notes?: unknown } | undefined;
      if (typeof body?.cleared !== "boolean" || typeof body?.items !== "object" || body.items === null) {
        sendApiError(req, res, 400, "invalid_screening");
        return;
      }

      try {
        const entry = await docs.submitScreening({
          programId: access.programId,
          athleteUserId: athleteId,
          items: body.items as Record<string, boolean>,
          notes: typeof body.notes === "string" && body.notes.length > 0 ? body.notes : null,
          cleared: body.cleared,
          screenedByUserId: actorId,
        });

        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "screening",
          action: "write",
          fields: ["items", "cleared", ...(entry.notes ? ["notes"] : [])],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.status(201).json({ ok: true, entry });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] screening write failed");
        sendApiError(req, res, 500, "screening_write_failed");
      }
    },
  );

  // ─── POST /programs/:programId/athletes/:athleteId/notes ──────────────────
  router.post(
    "/programs/:programId/athletes/:athleteId/notes",
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
        sendApiError(req, res, 403, "note_write_not_permitted");
        return;
      }
      if (process.env["NODE_ENV"] === "production" && !noteEncryptionConfigured()) {
        // The reason, never the value. `noteEncryptionProblem` is written so
        // that no branch of it can return key material.
        logger.error(
          { reason: noteEncryptionProblem() },
          "[trainer] refused note write: no usable encryption key configured",
        );
        incCounter(TRAINER_COUNTERS.noteEncryptionUnavailable);
        sendApiError(req, res, 503, "note_encryption_unavailable");
        return;
      }

      const fields = parseSoapFields(req.body);
      if (!fields) {
        sendApiError(req, res, 400, "invalid_note");
        return;
      }

      try {
        const { entry, replayed } = await docs.fileNote({
          programId: access.programId,
          subjectUserId: athleteId,
          authorUserId: actorId,
          fields,
          templateId:
            typeof (req.body as { templateId?: unknown })?.templateId === "string"
              ? ((req.body as { templateId: string }).templateId)
              : null,
          idempotencyKey: parseIdempotencyKey(req.body),
        });

        // A REPLAY IS NOT A SECOND DISCLOSURE. The note already existed and
        // nothing new was written, so filing a second audit row would
        // overstate what happened — the log would show two clinicians' worth
        // of activity for one. Counted instead, so a retry storm is visible
        // in metrics rather than in the medical record.
        if (replayed) incCounter(TRAINER_COUNTERS.noteWriteReplayed);

        if (!replayed) await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "medical_note",
          action: "write",
          fields: Object.entries(fields)
            .filter(([, v]) => v !== null)
            .map(([k]) => k),
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.status(201).json({ ok: true, entry });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] note write failed");
        sendApiError(req, res, 500, "note_write_failed");
      }
    },
  );

  // ─── POST /programs/:programId/notes/:noteId/amend ────────────────────────
  // An amendment, never an edit. The prior version stays exactly as it was.
  router.post("/programs/:programId/notes/:noteId/amend", requireProgramAccess(repo), async (req, res) => {
    const access = req.programAccess;
    const actorId = req.userId;
    const noteId = Number(req.params["noteId"]);
    if (!access || !actorId || !Number.isInteger(noteId)) {
      sendApiError(req, res, 400, "invalid_note_id");
      return;
    }
    if (!levelWritesAvailability(access.level)) {
      sendApiError(req, res, 403, "note_write_not_permitted");
      return;
    }
    if (process.env["NODE_ENV"] === "production" && !noteEncryptionConfigured()) {
      incCounter(TRAINER_COUNTERS.noteEncryptionUnavailable);
        sendApiError(req, res, 503, "note_encryption_unavailable");
      return;
    }

    const fields = parseSoapFields(req.body);
    const reason = (req.body as { amendmentReason?: unknown })?.amendmentReason;
    if (!fields || typeof reason !== "string" || reason.trim().length === 0) {
      // An amendment must say why. A silent revision is the thing the
      // append-only rule exists to prevent.
      sendApiError(req, res, 400, "amendment_requires_reason");
      return;
    }

    try {
      const result = await docs.amendNote({
        programId: access.programId,
        noteId,
        authorUserId: actorId,
        fields,
        amendmentReason: reason,
        idempotencyKey: parseIdempotencyKey(req.body),
      });
      if (!result.ok) {
        sendApiError(req, res, 404, "note_not_found");
        return;
      }

      // THE AMENDMENT IS THE ONE OPERATION THE APPEND-ONLY DESIGN EXISTS TO
      // MAKE DEFENSIBLE, and it was the one operation that wrote nothing to
      // the access log. "Who changed this record, when, and why" was
      // answerable from the note chain and invisible to the athlete's own
      // "who touched my record" query, which reads this table.
      //
      // The subject comes from the note rather than the URL — this route has
      // no `:athleteId`, so it cannot use `requireAthleteSubject`, and the
      // note itself is the authority on whose record it is.
      if (result.replayed) incCounter(TRAINER_COUNTERS.noteWriteReplayed);

      const consent = await repo.consent(access.programId, result.subjectUserId);
      if (!result.replayed) await repo.logAccess({
        actorUserId: actorId,
        subjectUserId: result.subjectUserId,
        programId: access.programId,
        actorRole: access.role,
        resource: "medical_note",
        action: "amend",
        fields: Object.entries(fields)
          .filter(([, v]) => v !== null)
          .map(([k]) => k),
        redactionLevel: access.level,
        consentDecisionSeq: consent.decisionSeq,
        requestId: requestIdOf(req),
        route: req.path,
      });

      res.status(201).json({ ok: true, entry: result.entry });
    } catch (err) {
      logger.error({ err: serializeError(err) }, "[trainer] note amend failed");
      sendApiError(req, res, 500, "note_amend_failed");
    }
  });

  // ─── GET /programs/:programId/athletes/:athleteId/notes ───────────────────
  router.get(
    "/programs/:programId/athletes/:athleteId/notes",
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
      if (!levelSeesMedical(access.level)) {
        sendApiError(req, res, 403, "notes_not_available_to_role");
        return;
      }

      try {
        const notes = await docs.currentNotes(access.programId, athleteId);
        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "medical_note",
          action: "read",
          fields: ["subjective", "objective", "assessment", "plan"],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });
        res.json({ notes });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] note read failed");
        sendApiError(req, res, 500, "note_read_failed");
      }
    },
  );

  // ─── GET /programs/:programId/athletes/:athleteId/chart.pdf ───────────────
  router.get(
    "/programs/:programId/athletes/:athleteId/chart.pdf",
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
      if (!levelSeesMedical(access.level)) {
        sendApiError(req, res, 403, "chart_not_available_to_role");
        return;
      }

      try {
        const [questionnaires, screenings, noteVersions, auditTrail, auditTrailTotal] =
          await Promise.all([
          docs.questionnaires(access.programId, athleteId),
          docs.screenings(access.programId, athleteId),
          docs.allNoteVersions(access.programId, athleteId),
          repo.accessTrail(access.programId, athleteId),
          repo.accessTrailCount(access.programId, athleteId),
        ]);

        const exportedAt = new Date().toISOString();
        const pdf = renderChartPdf(
          buildChartLines({
            programId: access.programId,
            athleteUserId: athleteId,
            exportedByUserId: actorId,
            exportedAt,
            questionnaires,
            screenings,
            noteVersions,
            auditTrail,
            auditTrailTotal,
          }),
        );

        // The export is itself an access of the record, so it is logged
        // before it is sent. A chart that leaves without a log entry is the
        // gap the audit trail exists to close.
        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "chart_export",
          action: "read",
          fields: ["questionnaires", "screenings", "noteVersions", "auditTrail"],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="chart-${athleteId}-${exportedAt.slice(0, 10)}.pdf"`,
        );
        res.send(Buffer.from(pdf, "latin1"));
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] chart export failed");
        sendApiError(req, res, 500, "chart_export_failed");
      }
    },
  );

  // ─── POST /programs/:programId/athletes/:athleteId/sessions ───────────────
  // Load entry. Phase 0 question Q13 answered: staff with load access enter
  // it — clinical or strength — and the athlete's RPE is what they report to
  // that person. A correction is a new row; there is no update path.
  router.post(
    "/programs/:programId/athletes/:athleteId/sessions",
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
      // Load is the one thing strength & performance writes. §2.3 gives that
      // role full load access; it gives them nothing medical, which is why
      // this is a different check from the note and screening routes.
      if (access.level !== "clinical" && access.level !== "performance") {
        sendApiError(req, res, 403, "session_write_not_permitted");
        return;
      }

      const body = req.body as
        | { sessionDate?: unknown; rpe?: unknown; durationMin?: unknown; sessionType?: unknown }
        | undefined;
      const sessionDate = typeof body?.sessionDate === "string" ? body.sessionDate : null;
      const rpe = typeof body?.rpe === "number" ? body.rpe : NaN;
      const durationMin = typeof body?.durationMin === "number" ? body.durationMin : NaN;

      if (
        !sessionDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ||
        !Number.isInteger(rpe) ||
        rpe < 1 ||
        rpe > 10 ||
        !Number.isInteger(durationMin) ||
        durationMin < 1 ||
        durationMin > 600
      ) {
        sendApiError(req, res, 400, "invalid_session");
        return;
      }

      try {
        const entry = await docs.recordSession({
          programId: access.programId,
          athleteUserId: athleteId,
          sessionDate,
          rpe,
          durationMin,
          sessionType:
            typeof body?.sessionType === "string" && body.sessionType.length > 0
              ? body.sessionType
              : null,
          enteredByUserId: actorId,
        });

        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "training_session",
          action: "write",
          fields: ["sessionDate", "rpe", "durationMin", ...(entry.sessionType ? ["sessionType"] : [])],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.status(201).json({ ok: true, entry });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] session write failed");
        sendApiError(req, res, 500, "session_write_failed");
      }
    },
  );

  // ─── GET /programs/:programId/athletes/:athleteId/sessions ────────────────
  router.get(
    "/programs/:programId/athletes/:athleteId/sessions",
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
      // A coach gets load as a summary, never the session list (§2.3).
      if (access.level === "coaching" || access.level === "compliance") {
        sendApiError(req, res, 403, "sessions_not_available_to_role");
        return;
      }

      try {
        const sessions = await docs.sessions(access.programId, athleteId);

        await repo.logAccess({
          actorUserId: actorId,
          subjectUserId: athleteId,
          programId: access.programId,
          actorRole: access.role,
          resource: "training_session",
          action: "read",
          fields: ["sessionDate", "rpe", "durationMin", "sessionType"],
          redactionLevel: access.level,
          consentDecisionSeq: subject.consentDecisionSeq,
          requestId: requestIdOf(req),
          route: req.path,
        });

        res.json({ sessions });
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] session read failed");
        sendApiError(req, res, 500, "session_read_failed");
      }
    },
  );

  return router;
}

function buildMountedTrainerDocsRouter(): IRouter {
  const mounted: IRouter = Router();
  // Metrics first, so a 429 is measured too — a surface that goes
  // quiet because it is being throttled must not look like a surface
  // nobody is using.
  mounted.use(trainerMetrics);
  mounted.use(requireAuth);
  // After auth, so the limiter keys on the user rather than punishing
  // a whole training room behind one connection.
  mounted.use(trainerRateLimit);
  mounted.use(buildTrainerDocsRouter(instrumentTrainerRepo(createTrainerRepo(db)), createTrainerDocsRepo(db)));
  return mounted;
}

export const trainerDocsRouter: IRouter = buildMountedTrainerDocsRouter();
