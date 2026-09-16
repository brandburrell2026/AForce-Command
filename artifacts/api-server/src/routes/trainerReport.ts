/**
 * Coach handoff — Phase 8.
 *
 * The availability report, as JSON and as PDF. Mounted at /trainer with the
 * other trainer routers, behind `feature.trainer_api`.
 *
 * THE GUARD RUNS IN THE ROUTE, NOT ONLY IN THE TESTS. `scanForInference` is
 * called on every generated report before it is sent, and a report that trips
 * it is refused with a 500 rather than delivered. A test can only prove the
 * shapes it thought of; the runtime check also catches the field somebody adds
 * next year without reading the module header.
 */
import { Router, type IRouter } from "express";

import { createTrainerRepo, db, type TrainerRepo } from "@workspace/db";
import { isEnabled } from "../config/featureFlags";
import { sendApiError } from "../lib/apiError";
import { serializeError } from "../lib/serializeError";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { instrumentTrainerRepo } from "../observability/trainerRepoMetrics";
import { trainerMetrics, trainerRateLimit } from "../middlewares/trainerOps";
import { requireProgramAccess } from "../middlewares/requireProgramAccess";
import { incCounter, TRAINER_COUNTERS } from "../middlewares/trainerOps";
import { renderChartPdf } from "../lib/trainer/chartPdf";
import {
  buildAvailabilityReport,
  reportToLines,
  scanForInference,
  scanLinesForInference,
  type ReportAthleteInput,
  type ReportAvailability,
} from "../lib/trainer/availabilityReport";

function parseAvailability(value: string | null | undefined): ReportAvailability {
  return value === "available" || value === "limited" || value === "out" ? value : "unset";
}

export function buildTrainerReportRouter(repo: TrainerRepo): IRouter {
  const router: IRouter = Router();

  router.use((req, res, next) => {
    if (!isEnabled("feature.trainer_api")) {
      sendApiError(req, res, 404, "not_found");
      return;
    }
    next();
  });

  /** Assemble the report for a program, or null when the guard trips. */
  async function generate(
    programId: string,
    generatedByUserId: string,
  ): Promise<ReturnType<typeof buildAvailabilityReport> | null> {
    const members = await repo.athletes(programId);
    const athletes: ReportAthleteInput[] = await Promise.all(
      members.map(async (m) => {
        const availability = await repo.currentAvailability(programId, m.userId);
        return {
          athleteUserId: m.userId,
          // Display names land with the roster import; the id stands in for
          // now and is equally free of clinical content.
          displayName: m.userId,
          position: null,
          availability: parseAvailability(availability?.status),
        };
      }),
    );

    const report = buildAvailabilityReport({
      programId,
      generatedByUserId,
      generatedAt: new Date().toISOString(),
      athletes,
    });

    const findings = scanForInference(report);
    if (findings.length > 0) {
      incCounter(TRAINER_COUNTERS.inferenceGuardTripped);
      logger.error(
        { programId, terms: findings.map((f) => f.term) },
        "[trainer] availability report refused: inference guard tripped",
      );
      return null;
    }
    return report;
  }

  /** The request id lives on `req.id` (see `buildApiErrorBody`). */
  function requestIdOf(req: { id?: unknown }): string | null {
    const id = req.id;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  }

  /**
   * File one audit row per athlete the report covered.
   *
   * The report carries no medical field by design, which is why it is safe to
   * circulate — but it is still a document about named people that gets
   * forwarded, printed and filed, and this table's subject index exists to
   * answer an athlete's "who looked at me". A roster-wide export that logged
   * nothing, or logged one row with no subject, could not answer it.
   *
   * One batched insert, not one per athlete: see `logAccessMany`.
   */
  async function logReportAccess(
    req: { id?: unknown; path: string },
    access: NonNullable<Express.Request["programAccess"]>,
    actorId: string,
    report: ReturnType<typeof buildAvailabilityReport>,
    resource: "availability_report" | "availability_report_pdf",
  ): Promise<void> {
    const subjects = [
      ...report.available,
      ...report.limited,
      ...report.out,
      ...report.unset,
    ];
    await repo.logAccessMany(
      subjects.map((a) => ({
        actorUserId: actorId,
        subjectUserId: a.athleteUserId,
        programId: access.programId,
        actorRole: access.role,
        resource,
        action: "read" as const,
        // Exactly what the report discloses about them, and nothing it does
        // not: no reason, no stage, no duration.
        fields: ["displayName", "position", "availability"],
        redactionLevel: access.level,
        // The report is not consent-gated content — it carries no medical
        // field — so the decision sequence is not resolved per athlete here.
        consentDecisionSeq: null,
        requestId: requestIdOf(req),
        route: req.path,
      })),
    );
  }

  // ─── GET /programs/:programId/availability-report ─────────────────────────
  // Every staff role may read it. It is the one artefact on this surface that
  // is safe to circulate, which is the entire point of it.
  router.get("/programs/:programId/availability-report", requireProgramAccess(repo), async (req, res) => {
    const access = req.programAccess;
    const actorId = req.userId;
    if (!access || !actorId) {
      sendApiError(req, res, 403, "program_access_required");
      return;
    }
    if (access.level === "self") {
      // An athlete has no roster view, here or anywhere else.
      sendApiError(req, res, 403, "report_not_available_to_role");
      return;
    }

    try {
      const report = await generate(access.programId, actorId);
      if (!report) {
        sendApiError(req, res, 500, "report_failed_inference_guard");
        return;
      }
      await logReportAccess(req, access, actorId, report, "availability_report");
      res.json({ report });
    } catch (err) {
      logger.error({ err: serializeError(err) }, "[trainer] availability report failed");
      sendApiError(req, res, 500, "report_failed");
    }
  });

  // ─── GET /programs/:programId/availability-report.pdf ─────────────────────
  router.get(
    "/programs/:programId/availability-report.pdf",
    requireProgramAccess(repo),
    async (req, res) => {
      const access = req.programAccess;
      const actorId = req.userId;
      if (!access || !actorId) {
        sendApiError(req, res, 403, "program_access_required");
        return;
      }
      if (access.level === "self") {
        sendApiError(req, res, 403, "report_not_available_to_role");
        return;
      }

      try {
        const report = await generate(access.programId, actorId);
        if (!report) {
          sendApiError(req, res, 500, "report_failed_inference_guard");
          return;
        }

        // The PDF is the artefact that actually gets forwarded, printed and
        // filed, so the rendering is scanned too — not just the data it was
        // rendered from. A caption added to the renderer never passes
        // through `generate`.
        const lines = reportToLines(report);
        const rendered = scanLinesForInference(report, lines);
        if (rendered.length > 0) {
          incCounter(TRAINER_COUNTERS.inferenceGuardTripped);
          logger.error(
            { programId: access.programId, count: rendered.length },
            "[trainer] refused report pdf: rendered lines tripped the inference guard",
          );
          sendApiError(req, res, 500, "report_failed_inference_guard");
          return;
        }

        const pdf = renderChartPdf(lines);

        // Logged before it is sent. A document that leaves without a log
        // entry is the gap the audit trail exists to close.
        await logReportAccess(req, access, actorId, report, "availability_report_pdf");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="availability-${access.programId}-${report.generatedAt.slice(0, 10)}.pdf"`,
        );
        res.send(Buffer.from(pdf, "latin1"));
      } catch (err) {
        logger.error({ err: serializeError(err) }, "[trainer] availability report pdf failed");
        sendApiError(req, res, 500, "report_failed");
      }
    },
  );

  return router;
}

function buildMountedTrainerReportRouter(): IRouter {
  const mounted: IRouter = Router();
  // Metrics first, so a 429 is measured too — a surface that goes
  // quiet because it is being throttled must not look like a surface
  // nobody is using.
  mounted.use(trainerMetrics);
  mounted.use(requireAuth);
  // After auth, so the limiter keys on the user rather than punishing
  // a whole training room behind one connection.
  mounted.use(trainerRateLimit);
  mounted.use(buildTrainerReportRouter(instrumentTrainerRepo(createTrainerRepo(db))));
  return mounted;
}

export const trainerReportRouter: IRouter = buildMountedTrainerReportRouter();
