/**
 * /api/spatial-studio/projects — account-backed storage for AForce Spatial
 * Studio designs.
 *
 *   GET    /          list the member's projects (metadata + thumbnail)
 *   GET    /:id       one project with its document
 *   PUT    /:id       create or overwrite; 409 when the stored row is newer
 *                     than the `expectedUpdatedAt` the client last saw
 *   DELETE /:id       soft delete
 *
 * Documents carry uploaded images as data URLs and run to several MB, so
 * PUT mounts its own express.json({ limit: "12mb" }). The router is
 * therefore mounted in app.ts BEFORE the global 64 kB parser, with a
 * path-scoped clerkMiddleware in front of it (same reasoning as
 * smart-capture). Every query is scoped by the authenticated userId.
 *
 * Built with injected deps so the route logic is testable against the
 * in-memory store without Postgres or Clerk.
 */
import express, {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createSpatialStudioRepo, db, type SpatialStudioProjectStore } from "@workspace/db";

import { sendApiError } from "../lib/apiError";
import { logger } from "../lib/logger";
import { serializeError } from "../lib/serializeError";
import {
  MAX_BODY,
  MAX_DOCUMENT_BYTES,
  ProjectBodySchema,
  isValidProjectId,
  measureDocument,
} from "../lib/spatialStudio/projectBody";
import { requireAuth } from "../middlewares/requireAuth";
import { incCounter } from "../observability/metrics";

export interface SpatialStudioProjectsDeps {
  store: SpatialStudioProjectStore;
  /** Defaults to requireAuth; tests inject a stub that sets req.userId. */
  auth?: RequestHandler;
  /** Skip the per-user limiter (tests). */
  skipRateLimit?: boolean;
}

const userKey = (req: Request): string => {
  const userId = (req as Request & { userId?: string }).userId;
  return userId ? `u:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
};

function userIdOf(req: Request): string | null {
  return (req as Request & { userId?: string }).userId ?? null;
}

/** Table missing (schema not pushed yet) reads as "storage unavailable", not a crash. */
function isMissingRelation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

export function buildSpatialStudioProjectsRouter(deps: SpatialStudioProjectsDeps): IRouter {
  const router: IRouter = Router();
  const auth = deps.auth ?? requireAuth;
  const limiter = deps.skipRateLimit
    ? ((_req, _res, next) => next()) as RequestHandler
    : rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false, keyGenerator: userKey });

  const failed = (req: Request, res: Response, err: unknown, what: string) => {
    if (isMissingRelation(err)) {
      incCounter("spatial_studio.projects.table_missing");
      sendApiError(req, res, 503, "storage_unavailable");
      return;
    }
    logger.error({ err: serializeError(err) }, `[spatial-studio] ${what} failed`);
    incCounter("spatial_studio.projects.error");
    sendApiError(req, res, 500, "internal_error");
  };

  router.use(auth, limiter);

  router.get("/", async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) return sendApiError(req, res, 401, "unauthorized");
    try {
      res.json({ projects: await deps.store.list(userId) });
    } catch (err) {
      failed(req, res, err, "list");
    }
  });

  router.get("/:id", async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) return sendApiError(req, res, 401, "unauthorized");
    const id = String(req.params["id"] ?? "");
    if (!isValidProjectId(id)) return sendApiError(req, res, 400, "invalid_project_id");
    try {
      const project = await deps.store.get(userId, id);
      if (!project) return sendApiError(req, res, 404, "not_found");
      res.json({ project });
    } catch (err) {
      failed(req, res, err, "get");
    }
  });

  router.put("/:id", express.json({ limit: MAX_BODY }), async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) return sendApiError(req, res, 401, "unauthorized");
    const id = String(req.params["id"] ?? "");
    if (!isValidProjectId(id)) return sendApiError(req, res, 400, "invalid_project_id");
    const parsed = ProjectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_project", issues: parsed.error.issues.slice(0, 5) });
      return;
    }
    const { name, document, thumbnail, expectedUpdatedAt } = parsed.data;
    const measure = measureDocument(document);
    if (measure.bytes > MAX_DOCUMENT_BYTES) return sendApiError(req, res, 413, "project_too_large");
    try {
      const result = await deps.store.upsert(
        userId,
        id,
        { name, document, thumbnail, ...measure },
        expectedUpdatedAt,
      );
      if (result.kind === "conflict") {
        incCounter("spatial_studio.projects.conflict");
        res.status(409).json({ error: "conflict", current: result.current });
        return;
      }
      incCounter(`spatial_studio.projects.${result.kind}`);
      res.status(result.kind === "created" ? 201 : 200).json({ project: result.meta });
    } catch (err) {
      failed(req, res, err, "put");
    }
  });

  router.delete("/:id", async (req, res) => {
    const userId = userIdOf(req);
    if (!userId) return sendApiError(req, res, 401, "unauthorized");
    const id = String(req.params["id"] ?? "");
    if (!isValidProjectId(id)) return sendApiError(req, res, 400, "invalid_project_id");
    try {
      const removed = await deps.store.softDelete(userId, id);
      if (!removed) return sendApiError(req, res, 404, "not_found");
      res.status(204).end();
    } catch (err) {
      failed(req, res, err, "delete");
    }
  });

  // express.json rejects oversize bodies with entity.too.large and malformed
  // JSON with entity.parse.failed; answer in JSON rather than Express's HTML.
  router.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err && typeof err === "object" && "type" in err) {
      const e = err as { type?: string };
      if (e.type === "entity.too.large") return sendApiError(req, res, 413, "project_too_large");
      if (e.type === "entity.parse.failed") return sendApiError(req, res, 400, "invalid_json");
    }
    next(err);
  });

  return router;
}

export function buildDefaultSpatialStudioProjectsRouter(): IRouter {
  return buildSpatialStudioProjectsRouter({ store: createSpatialStudioRepo(db) });
}
