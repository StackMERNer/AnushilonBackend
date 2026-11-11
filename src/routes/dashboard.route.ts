import { Router } from "express";

import * as c from "../controllers/dashboard.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();
router.use(authenticate);
router.get("/summary", c.getSummary);
router.get("/subjects", c.getSubjects);
export default router;
