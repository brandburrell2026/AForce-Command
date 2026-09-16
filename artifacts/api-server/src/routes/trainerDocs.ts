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
import { requireAthleteSubject } from "../middlewares/requireAthleteSubject";
import { requireProgramAccess } from "../middlewares/requireProgramAccess";
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
    // See the note on session writes: whether revocation stops a clinician
    // from DOCUMENTING care is open. Disclosure back out is gated.
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
    // See the note on session writes: whether revocation stops a clinician
    // from DOCUMENTING care is open. Reading notes back IS gated.
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
        sendApiError(req, res, 503, "note_encryption_unavailable");
        return;
      }

      const fields = parseSoapFields(req.body);
      if (!fields) {
        sendApiError(req, res, 400, "invalid_note");
        return;
      }

      try {
        const entry = await docs.fileNote({
          programId: access.programId,
          subjectUserId: athleteId,
          authorUserId: actorId,
          fields,
          templateId:
            typeof (req.body as { templateId?: unknown })?.templateId === "string"
              ? ((req.body as { templateId: string }).templateId)
              : null,
        });

        await repo.logAccess({
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
      });
      if (!result.ok) {
        sendApiError(req, res, 404, "note_not_found");
        return;
      }
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
        const [questionnaires, screenings, noteVersions, auditTrail] = await Promise.all([
          docs.questionnaires(access.programId, athleteId),
          docs.screenings(access.programId, athleteId),
          docs.allNoteVersions(access.programId, athleteId),
          repo.accessTrail(access.programId, athleteId),
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
    // Consent not required to RECORD load: whether a revocation stops staff
    // from documenting the work an athlete actually did is a clinical
    // records question, not a disclosure question, and it is open. Reading
    // the list back IS gated, below.
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
  mounted.use(requireAuth);
  mounted.use(buildTrainerDocsRouter(createTrainerRepo(db), createTrainerDocsRepo(db)));
  return mounted;
}

export const trainerDocsRouter: IRouter = buildMountedTrainerDocsRouter();
