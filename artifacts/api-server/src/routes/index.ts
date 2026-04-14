import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import brandsRouter from "./brands.js";
import postsRouter from "./posts.js";
import metricsRouter from "./metrics.js";
import assetsRouter from "./assets.js";
import aiRouter from "./ai.js";
import authRouter from "./auth.js";
import adsRouter from "./ads.js";
import reviewsRouter from "./reviews.js";
import embedRouter from "./embed.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brandsRouter);
router.use(postsRouter);
router.use(metricsRouter);
router.use(assetsRouter);
router.use(aiRouter);
router.use(authRouter);
router.use(adsRouter);
router.use(reviewsRouter);
router.use(embedRouter);

export default router;
