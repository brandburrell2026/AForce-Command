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
import { requireProgramAccess } from "../middlewares/requireProgramAccess";
import { renderChartPdf } from "../lib/trainer/chartPdf";
import {
  buildAvailabilityReport,
  reportToLines,
  scanForInference,
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
      logger.error(
        { programId, terms: findings.map((f) => f.term) },
        "[trainer] availability report refused: inference guard tripped",
      );
      return null;
    }
    return report;
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

        const pdf = renderChartPdf(reportToLines(report));
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
  mounted.use(requireAuth);
  mounted.use(buildTrainerReportRouter(createTrainerRepo(db)));
  return mounted;
}

export const trainerReportRouter: IRouter = buildMountedTrainerReportRouter();
