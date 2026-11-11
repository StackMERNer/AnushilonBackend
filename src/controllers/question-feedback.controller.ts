import { Request, Response } from "express";
import {
  BookmarkService,
  ReportService,
} from "../services/question-feedback.service";
import { REPORT_REASONS } from "../config/reportReasons";
import { clamp, currentUserId, fail, oid } from "../utils/http";

export const addBookmark = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const questionId = oid(req.body?.questionId);
  if (!questionId) return res.status(400).json({ message: "প্রশ্ন সঠিক নয়" });
  try {
    await BookmarkService.add(userId, questionId);
    res.status(200).json({ isBookmarked: true });
  } catch (err) {
    fail(res, err);
  }
};

export const removeBookmark = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const questionId = oid(req.params.questionId);
  if (!questionId) return res.status(400).json({ message: "প্রশ্ন সঠিক নয়" });
  try {
    await BookmarkService.remove(userId, questionId);
    res.status(200).json({ isBookmarked: false });
  } catch (err) {
    fail(res, err);
  }
};

export const listBookmarks = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  try {
    res
      .status(200)
      .json(
        await BookmarkService.list(
          userId,
          clamp(req.query.page, 1, 1, 10000),
          clamp(req.query.limit, 20, 1, 50),
        ),
      );
  } catch (err) {
    fail(res, err);
  }
};

export const createReport = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;

  const questionId = oid(req.body?.questionId);
  if (!questionId) return res.status(400).json({ message: "প্রশ্ন সঠিক নয়" });

  const allowed = REPORT_REASONS as readonly string[];
  const reasons = Array.isArray(req.body?.reasons)
    ? [...new Set<string>(req.body.reasons.map(String))].filter((r) =>
        allowed.includes(r),
      )
    : [];
  if (!reasons.length)
    return res.status(400).json({ message: "অন্তত একটি সমস্যা বেছে নাও" });

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (message.length > 500)
    return res
      .status(400)
      .json({ message: "বার্তা সর্বোচ্চ ৫০০ অক্ষরের হতে পারবে" });
  if (reasons.includes("other") && message.length < 3)
    return res
      .status(400)
      .json({ message: "অন্যান্য বেছে নিলে সমস্যাটি লিখে জানাও" });

  try {
    await ReportService.create(userId, {
      questionId,
      reasons,
      message: message || undefined,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
};
