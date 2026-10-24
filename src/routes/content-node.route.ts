import { Router } from "express";
import {
  getNodes,
  createNode,
  updateNode,
  reorderNodes,
  getNodeById,
} from "../controllers/content-node.controller";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();
router.use(authenticate);

router.get("/", getNodes);
router.get("/:id", getNodeById);
router.post("/", createNode);
router.put("/reorder", reorderNodes);
router.patch("/:id", updateNode);
const contentNodeRoutes = router;
export default contentNodeRoutes;
