import { Router } from "express";
import multer from "multer";

import {
  uploadImageController,
  getImageController,
  deleteImageController,
} from "../controllers/imageController";
import { authenticate } from "../middlewares/authMiddleware";
import adminMiddleware from "../middlewares/adminMiddleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

router.get("/:imageId", getImageController);

router.use(authenticate);
router.use(adminMiddleware);
router.post("/upload", upload.single("file"), uploadImageController);

router.delete("/:imageId", deleteImageController);

export default router;
