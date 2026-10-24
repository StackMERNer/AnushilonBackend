// routes/dashboard.routes.ts

import { Router } from "express";
import { getDashboardData } from "../controllers/dashboard.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

router.get("/", authenticate, getDashboardData);

export default router;
