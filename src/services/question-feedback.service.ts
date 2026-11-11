import { Types } from "mongoose";
import { QuestionModel } from "../models/question.model";
import { BookmarkModel } from "../models/bookmark.model";
import { QuestionReportModel } from "../models/question-report.model";
import { HttpError } from "../utils/http";
import { QUESTION_FIELDS, POPULATE } from "../config/questionFields";

const DAILY_REPORT_LIMIT = 30;

export const BookmarkService = {
  async add(userId: Types.ObjectId, questionId: Types.ObjectId) {
    const q: any = await QuestionModel.findById(questionId)
      .select("subject chapter topic")
      .lean();
    if (!q) throw new HttpError(404, "প্রশ্ন পাওয়া যায়নি");
    try {
      await BookmarkModel.updateOne(
        { user: userId, question: questionId },
        {
          $setOnInsert: {
            subject: q.subject,
            chapter: q.chapter,
            topic: q.topic,
          },
        },
        { upsert: true },
      );
    } catch (err: any) {
      if (err?.code !== 11000) throw err; // concurrent double-tap: already saved
    }
  },

  async remove(userId: Types.ObjectId, questionId: Types.ObjectId) {
    await BookmarkModel.deleteOne({ user: userId, question: questionId });
  },

  /** Newest bookmarks first, in your paginated response shape. */
  async list(userId: Types.ObjectId, page: number, limit: number) {
    const [rows, totalItems] = await Promise.all([
      BookmarkModel.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("question")
        .lean(),
      BookmarkModel.countDocuments({ user: userId }),
    ]);

    const questions = await QuestionModel.find({
      _id: { $in: rows.map((r: any) => r.question) },
    })
      .select(QUESTION_FIELDS)
      .populate(POPULATE)
      .lean();
    const byId = new Map(questions.map((q: any) => [String(q._id), q]));

    const items = rows.flatMap((r: any) => {
      const q = byId.get(String(r.question));
      return q ? [{ ...q, isBookmarked: true }] : [];
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    return {
      items,
      totalItems,
      currentPage: page,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      limit,
    };
  },

  /** Adds isBookmarked to a page of questions. Safe to call without a user. */
  async markBookmarked<T extends { _id: any }>(
    userId: Types.ObjectId | undefined,
    questions: T[],
  ): Promise<(T & { isBookmarked: boolean })[]> {
    const plain = questions.map((q: any) =>
      typeof q.toObject === "function" ? q.toObject() : q,
    );
    if (!userId || !plain.length)
      return plain.map((q) => ({ ...q, isBookmarked: false }));

    const rows = await BookmarkModel.find({
      user: userId,
      question: { $in: plain.map((q) => q._id) },
    })
      .select("question")
      .lean();
    const set = new Set(rows.map((r: any) => String(r.question)));
    return plain.map((q) => ({ ...q, isBookmarked: set.has(String(q._id)) }));
  },
};

export const ReportService = {
  async create(
    userId: Types.ObjectId,
    input: { questionId: Types.ObjectId; reasons: string[]; message?: string },
  ) {
    if (!(await QuestionModel.exists({ _id: input.questionId })))
      throw new HttpError(404, "প্রশ্ন পাওয়া যায়নি");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await QuestionReportModel.countDocuments({
      user: userId,
      createdAt: { $gte: since },
    });
    if (recent >= DAILY_REPORT_LIMIT)
      throw new HttpError(
        429,
        "আজকের জন্য রিপোর্টের সীমা শেষ। কাল আবার চেষ্টা করো।",
      );

    try {
      // same user re-reporting a still-open question just updates it
      await QuestionReportModel.updateOne(
        { user: userId, question: input.questionId, status: "open" },
        { $set: { reasons: input.reasons, message: input.message } },
        { upsert: true },
      );
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
  },
};
