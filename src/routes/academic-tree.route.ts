import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { ClassModel } from "../models/class.model";
import {
  getAcademicTree,
  getQuestionSources,
  getQuestionTypesByChapter,
  reorderAcademic,
  updateChapter,
  updateSubject,
  updateTopic,
} from "../controllers/academic.controller";
import adminMiddleware from "../middlewares/adminMiddleware";

const router = Router();

router.use(authenticate);
const ACTIVE_CLASSES = [
  "6a6e31bdd2ea30ebd6a29ded",
  "6a6e31bdd2ea30ebd6a29cae",
  "6a6e31bdd2ea30ebd6a29bab",
  "6a6e31bcd2ea30ebd6a29a39",
];
router.get("/classes", async (req, res) => {
  try {
    const classes = await ClassModel.find({ _id: { $in: ACTIVE_CLASSES } })
      .sort({ order: 1 })
      .select("-refId")
      .lean();
    res.status(200).json(classes);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/academic-tree", getAcademicTree);

router.get("/sources", getQuestionSources);

router.get("/question-types-by-chapter", getQuestionTypesByChapter);

// Update endpoints
router.use(adminMiddleware);
router.patch("/subjects/:id", updateSubject);
router.patch("/chapters/:id", updateChapter);
router.patch("/topics/:id", updateTopic);

router.patch("/reorder", reorderAcademic);

const academicTreeRoutes = router;

export default academicTreeRoutes;
