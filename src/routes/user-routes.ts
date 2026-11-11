// routes for admin
import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import {
  getAllUsers,
  getUserByEmailOrId,
} from "../controllers/user.controller";
import adminMiddleware from "../middlewares/adminMiddleware";

const router = Router();
router.use(authenticate);
router.use(adminMiddleware);
router.get("/", getAllUsers);
router.get("/:emailOrId", getUserByEmailOrId);

export default router;
