import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scansRouter from "./scans";
import cyclesRouter from "./cycles";
import checkoutRouter from "./checkout";
import aforceRouter from "./aforce";
import entitlementRouter from "./entitlement";
import stripePortalRouter from "./stripePortal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scansRouter);
router.use(cyclesRouter);
router.use(checkoutRouter);
router.use(entitlementRouter);
router.use(stripePortalRouter);
router.use("/aforce", aforceRouter);

export default router;
