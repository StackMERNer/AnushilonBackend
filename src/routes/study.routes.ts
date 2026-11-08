import { Router } from "express";

import * as c from "../controllers/study.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();
router.use(authenticate);

router.get("/queue", c.getQueue);
router.post("/new", c.startNew);
router.post("/review", c.submitReview);
router.get("/progress/subject/:subjectId", c.getSubjectProgress);
router.get("/progress/chapter/:chapterId", c.getChapterProgress);

export default router;
