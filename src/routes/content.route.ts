// create content routes

import { Router } from "express";
import {
  createContent,
  getContentFilesByContentNode,
} from "../controllers/content.controller";
import { authenticate } from "../middlewares/authMiddleware";
const router = Router();
router.use(authenticate);
router.post("/", createContent);
router.get("/:id", getContentFilesByContentNode);

const contentRoutes = router;
export default contentRoutes;
