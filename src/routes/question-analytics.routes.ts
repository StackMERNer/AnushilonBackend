// question-analytics.routes.ts
import { Router } from "express";
import {
  breakdownController,
  dashboardController,
  examCoverageController,
  filterOptionsController,
  qualityController,
} from "../controllers/question-analytics.controller";
import { authenticate } from "../middlewares/authMiddleware";
import adminMiddleware from "../middlewares/adminMiddleware";
// ⚠️ import your own auth middleware, e.g.:
// import { authenticate, requireAdmin } from "../middlewares/auth";

const router = Router();

router.use(authenticate, adminMiddleware);

router.post("/dashboard", dashboardController);
router.post("/filter-options", filterOptionsController);
router.post("/breakdown", breakdownController);
router.post("/quality", qualityController);
router.post("/exam-coverage", examCoverageController);

export default router;

// In your app/router setup:
//   app.use("/api/admin/question-analytics", questionAnalyticsRouter);
// (frontend baseUrl below must match, minus whatever prefix apiClient already adds)
