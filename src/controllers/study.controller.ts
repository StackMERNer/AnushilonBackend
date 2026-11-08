import { Request, Response } from "express";
import { Types } from "mongoose";
import { StudyService, StudyError } from "../services/study.service";

const oid = (v: unknown) =>
  typeof v === "string" && /^[a-f\d]{24}$/i.test(v)
    ? new Types.ObjectId(v)
    : null;

const clamp = (v: unknown, def: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : def;
};

function currentUserId(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?._id) {
    res.status(401).json({ message: "আবার লগইন করো" });
    return null;
  }
  return user._id as Types.ObjectId;
}

function fail(res: Response, err: unknown) {
  if (err instanceof StudyError)
    return res.status(err.status).json({ message: err.message });
  console.error(err);
  return res
    .status(500)
    .json({ message: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করো" });
}

export const getQueue = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  try {
    const data = await StudyService.getReviewQueue(userId, {
      limit: clamp(req.query.limit, 30, 1, 100),
      chapterId: oid(req.query.chapter) ?? undefined,
      topicId: oid(req.query.topic) ?? undefined,
    });
    res.status(200).json(data);
  } catch (err) {
    fail(res, err);
  }
};

export const startNew = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const chapterId = oid(req.body?.chapterId);
  if (!chapterId)
    return res.status(400).json({ message: "একটি অধ্যায় নির্বাচন করো" });
  try {
    const data = await StudyService.startNewCards(userId, {
      chapterId,
      topicId: oid(req.body?.topicId) ?? undefined,
      count: clamp(req.body?.count, 10, 1, 100),
    });
    res.status(200).json(data);
  } catch (err) {
    fail(res, err);
  }
};

export const submitReview = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const questionId = oid(req.body?.questionId);
  const rating = Number(req.body?.rating);
  if (!questionId) return res.status(400).json({ message: "প্রশ্ন সঠিক নয়" });
  if (![1, 2, 3, 4].includes(rating))
    return res.status(400).json({ message: "রেটিং সঠিক নয়" });
  try {
    const data = await StudyService.submitReview(userId, {
      questionId,
      rating,
      auto: !!req.body?.auto,
      timeTakenMs: Number.isFinite(Number(req.body?.timeTakenMs))
        ? Number(req.body.timeTakenMs)
        : undefined,
    });
    res.status(200).json(data);
  } catch (err) {
    fail(res, err);
  }
};

export const getSubjectProgress = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const subjectId = oid(req.params.subjectId);
  if (!subjectId)
    return res.status(400).json({ message: "একটি বিষয় নির্বাচন করো" });
  try {
    res
      .status(200)
      .json(await StudyService.getChapterProgress(userId, subjectId));
  } catch (err) {
    fail(res, err);
  }
};

export const getChapterProgress = async (req: Request, res: Response) => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const chapterId = oid(req.params.chapterId);
  if (!chapterId)
    return res.status(400).json({ message: "একটি অধ্যায় নির্বাচন করো" });
  try {
    res
      .status(200)
      .json(await StudyService.getTopicProgress(userId, chapterId));
  } catch (err) {
    fail(res, err);
  }
};
