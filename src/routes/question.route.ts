import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { getFilteredQuestions } from "../controllers/question.controller";
import { requireServerSecret } from "../middlewares/requireServerSecret";

const router = Router();
router.use(authenticate);

router.use("/filtered", requireServerSecret, getFilteredQuestions);

const questionRoutes = router;
export default questionRoutes;
