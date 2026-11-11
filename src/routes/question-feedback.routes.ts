import { Router } from "express";
import * as c from "../controllers/question-feedback.controller";
import { authenticate } from "../middlewares/authMiddleware";

export const bookmarkRouter = Router();
bookmarkRouter.use(authenticate);
bookmarkRouter.get("/", c.listBookmarks);
bookmarkRouter.post("/", c.addBookmark);
bookmarkRouter.delete("/:questionId", c.removeBookmark);

export const reportRouter = Router();
reportRouter.use(authenticate);
reportRouter.post("/", c.createReport);
