// routes for admin

import { Router } from "express";
import { getDashboardData } from "../controllers/dashboard.controller";
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
