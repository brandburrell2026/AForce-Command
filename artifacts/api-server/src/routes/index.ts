import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scansRouter from "./scans";
import cyclesRouter from "./cycles";
import checkoutRouter from "./checkout";
import aforceRouter from "./aforce";
import entitlementRouter from "./entitlement";
import stripePortalRouter from "./stripePortal";
import cruiseRouter from "./cruise";
import battlesRouter from "./battles";
import circleRouter from "./circle";
import privacyRouter from "./privacy";
import voiceTtsRouter from "./voiceTts";
import designTokensRouter from "./designTokens";
import referralsRouter from "./referrals";
import earlyAccessRouter from "./earlyAccess";
// Note: smartCaptureRouter is mounted directly in app.ts BEFORE the global
// 64kB express.json() limiter (base64 photos blow past 64kB instantly).

const router: IRouter = Router();

router.use(healthRouter);
router.use(scansRouter);
router.use(cyclesRouter);
router.use(checkoutRouter);
router.use(entitlementRouter);
router.use(stripePortalRouter);
router.use(cruiseRouter);
router.use("/aforce", aforceRouter);
router.use("/battles", battlesRouter);
router.use("/circle", circleRouter);
router.use("/privacy", privacyRouter);
router.use(voiceTtsRouter);
router.use(designTokensRouter);
router.use("/referrals", referralsRouter);
router.use("/early-access", earlyAccessRouter);

export default router;
