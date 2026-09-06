import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import activityRouter from "./activity";
import archiveRouter from "./archive";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use(activityRouter);
router.use(archiveRouter);

export default router;
