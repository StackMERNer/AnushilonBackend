import express from "express";
import {
  getUsers
} from "../controllers/usersController";
import adminMiddleware from "../middlewares/adminMiddleware";
import { authenticate } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(authenticate);

router.use(adminMiddleware);
router.get("/", getUsers);
export default router;
