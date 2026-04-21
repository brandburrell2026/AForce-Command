import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scansRouter from "./scans";
import cyclesRouter from "./cycles";
import checkoutRouter from "./checkout";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scansRouter);
router.use(cyclesRouter);
router.use(checkoutRouter);

export default router;
