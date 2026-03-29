import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import brandsRouter from "./brands.js";
import postsRouter from "./posts.js";
import metricsRouter from "./metrics.js";
import assetsRouter from "./assets.js";
import aiRouter from "./ai.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brandsRouter);
router.use(postsRouter);
router.use(metricsRouter);
router.use(assetsRouter);
router.use(aiRouter);

export default router;
