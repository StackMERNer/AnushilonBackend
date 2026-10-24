import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import {
  createPaper,
  deletePaper,
  getPaginatedPapers,
  getPaperById,
  toggleQuestionInPaper,
} from "./../controllers/question-paper.controller";
import { requireServerSecret } from "../middlewares/requireServerSecret";

const router = Router();
router.use(authenticate);
router.get("/", requireServerSecret, getPaginatedPapers);
router.get("/:id", requireServerSecret, getPaperById);
router.post("/", createPaper);
// router.patch("/:id", updatePaperInfo);
router.delete("/:id", deletePaper);
router.patch("/:id/toggle-question", toggleQuestionInPaper);
// router.patch("/:id/questions", updatePaperQuestions);

const paperRoutes = router;

export default paperRoutes;
