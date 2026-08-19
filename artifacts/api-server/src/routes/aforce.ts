/**
 * AForce OS REST endpoints.
 *
 * Mounted under `/api/aforce`. The Expo client (`services/realApi.ts`)
 * is the only consumer; the scoring engine itself stays on the client
 * — these routes just persist state and publish change events over WS.
 *
 *   GET  /state               → current UserState row (auto-seeded)
 *   POST /intake              → log an intake; returns updated state
 *   POST /signals             → update active symptoms
 *   POST /urine               → update urine signal (1-8)
 *   POST /energy              → update energy state
 *   POST /checkin             → mark morning-command seen
 *   POST /confirm             → ±3 confirmation answer
 *   POST /flags               → mirror clutch_active flag from client
 *   GET  /weather?lat&lon     → cached OpenWeather snapshot
 */

import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import stateRouter from "./aforce/state";
import intakeRouter from "./aforce/intake";
import statusRouter from "./aforce/status";
import socialRouter from "./aforce/social";
import journalRouter from "./aforce/journal";
import sensorsRouter from "./aforce/sensors";
import healthRecordsRouter from "./aforce/healthRecords";
import achievementsRouter from "./aforce/achievements";
import analyticsRouter from "./aforce/analytics";

const router: IRouter = Router();

// Every aforce route is per-user; requireAuth attaches req.userId
// (Clerk session in production, DEFAULT_USER_ID in dev fallback).
router.use(requireAuth);

router.use(stateRouter);
router.use(intakeRouter);
router.use(statusRouter);
router.use(socialRouter);
router.use(journalRouter);
router.use(sensorsRouter);
router.use(healthRecordsRouter);
router.use(analyticsRouter);
router.use(achievementsRouter);

export default router;
