import express from "express";
import { me, updateUserProfile } from "../controllers/authController";
import { authenticate } from "../middlewares/authMiddleware";

const router = express.Router();
router.use(authenticate);
router.get("/me", me);
router.patch("/me", updateUserProfile);

export default router;
