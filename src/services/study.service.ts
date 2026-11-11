import { Types } from "mongoose";
import { QuestionModel } from "../models/question.model";
import { ChapterModel } from "../models/chapter.model";
import { TopicModel } from "../models/topic.model";
import { UserCardModel } from "../models/user-card.model";
import { ReviewLogModel } from "../models/review-log.model";
import { schedule, Rating, MASTERED_DAYS } from "../utils/sm2";
import { BookmarkService } from "./question-feedback.service";

export class StudyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const POPULATE = [
  { path: "boards.board", select: "name" },
  { path: "schools.school", select: "name" },
  { path: "universities.university", select: "name" },
];
const QUESTION_FIELDS =
  "refId type context question options correctMcq questions answer boards tags level difficulty sameContextQuesId studyMode";

// ---- totals cache (studyable questions per chapter/topic) ----
type Field = "chapter" | "topic" | "subject";

const TOTALS_TTL_MS = 10 * 60 * 1000;
const totalsCache: Partial<
  Record<Field, { at: number; map: Map<string, number> }>
> = {};

export async function getTotals(field: Field) {
  const hit = totalsCache[field];
  if (hit && Date.now() - hit.at < TOTALS_TTL_MS) return hit.map;
  const rows = await QuestionModel.aggregate([
    { $match: { studyMode: { $ne: "none" } } },
    { $group: { _id: `$${field}`, total: { $sum: 1 } } },
  ]);
  const map = new Map<string, number>(
    rows.map((r: any) => [String(r._id), r.total]),
  );
  totalsCache[field] = { at: Date.now(), map };
  return map;
}

const typeTotalsCache = new Map<
  string,
  { at: number; rows: { type: string; total: number }[] }
>();

async function getTypeTotals(chapterIds: Types.ObjectId[]) {
  const now = Date.now();
  const result = new Map<string, { type: string; total: number }[]>();
  const missing: Types.ObjectId[] = [];

  for (const id of chapterIds) {
    const hit = typeTotalsCache.get(String(id));
    if (hit && now - hit.at < TOTALS_TTL_MS) result.set(String(id), hit.rows);
    else missing.push(id);
  }

  if (missing.length) {
    const rows = await QuestionModel.aggregate([
      { $match: { chapter: { $in: missing }, studyMode: { $ne: "none" } } },
      {
        $group: {
          _id: { chapter: "$chapter", type: "$type" },
          total: { $sum: 1 },
        },
      },
    ]);
    const grouped = new Map<string, { type: string; total: number }[]>();
    for (const r of rows) {
      const key = String(r._id.chapter);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({ type: r._id.type, total: r.total });
    }
    for (const id of missing) {
      const list = grouped.get(String(id)) ?? [];
      typeTotalsCache.set(String(id), { at: now, rows: list });
      result.set(String(id), list);
    }
  }
  return result;
}

// ---- per-user stats grouped by chapter/topic ----
export async function statsBy(
  userId: Types.ObjectId,
  field: Field,
  match: Record<string, Types.ObjectId>,
) {
  const now = new Date();
  const rows = await UserCardModel.aggregate([
    { $match: { user: userId, ...match } },
    {
      $group: {
        _id: `$${field}`,
        studied: { $sum: 1 },
        mastered: {
          $sum: { $cond: [{ $gte: ["$interval", MASTERED_DAYS] }, 1, 0] },
        },
        due: { $sum: { $cond: [{ $lte: ["$dueAt", now] }, 1, 0] } },
      },
    },
  ]);
  return new Map<string, any>(rows.map((r: any) => [String(r._id), r]));
}

export const StudyService = {
  /** Due cards, oldest first, capped so the user isn't overwhelmed. */
  async getReviewQueue(
    userId: Types.ObjectId,
    opts: {
      limit?: number;
      chapterId?: Types.ObjectId;
      topicId?: Types.ObjectId;
      types?: string[];
    } = {},
  ) {
    const { limit = 30, chapterId, topicId, types } = opts;
    const filter: Record<string, any> = {
      user: userId,
      dueAt: { $lte: new Date() },
    };
    if (chapterId) filter.chapter = chapterId;
    if (topicId) filter.topic = topicId;
    if (types?.length) filter.type = { $in: types };

    const [cards, totalDue] = await Promise.all([
      UserCardModel.find(filter)
        .sort({ dueAt: 1 })
        .limit(limit)
        .select("question state interval dueAt")
        .lean(),
      UserCardModel.countDocuments(filter),
    ]);

    // const questions = await QuestionModel.find({
    //   _id: { $in: cards.map((c: any) => c.question) },
    // })
    //   .select(QUESTION_FIELDS)
    //   .populate(POPULATE)
    //   .lean();

    const questions = await BookmarkService.markBookmarked(
      userId,
      await QuestionModel.find({
        _id: { $in: cards.map((c: any) => c.question) },
      })
        .select(QUESTION_FIELDS)
        .populate(POPULATE)
        .lean(),
    );

    const byId = new Map(questions.map((q: any) => [String(q._id), q]));

    const items = cards.flatMap((c: any) => {
      const q = byId.get(String(c.question));
      return q
        ? [{ card: { state: c.state, interval: c.interval }, question: q }]
        : [];
    });
    return { totalDue, items };
  },

  async getDueCount(userId: Types.ObjectId) {
    const filter: Record<string, any> = {
      user: userId,
      dueAt: { $lte: new Date() },
    };
    const count = await UserCardModel.countDocuments(filter);
    return { count };
  },

  /** Introduce `count` unseen questions from a chapter (optionally a topic). */
  async startNewCards(
    userId: Types.ObjectId,
    opts: {
      chapterId: Types.ObjectId;
      topicId?: Types.ObjectId;
      count: number;
      types?: string[];
    },
  ) {
    const { chapterId, topicId, count, types } = opts;

    const seen = await UserCardModel.distinct("question", {
      user: userId,
      chapter: chapterId,
    });

    const questions = await QuestionModel.find({
      chapter: chapterId,
      ...(topicId ? { topic: topicId } : {}),
      ...(types?.length ? { type: { $in: types } } : {}),
      studyMode: { $ne: "none" },
      _id: { $nin: seen },
    })
      .sort({ _id: 1 })
      .limit(count)
      .select("subject chapter topic type")
      .lean();

    if (questions.length) {
      try {
        await UserCardModel.insertMany(
          questions.map((q: any) => ({
            user: userId,
            question: q._id,
            subject: q.subject,
            chapter: q.chapter,
            type: q.type,
            topic: q.topic,
            dueAt: new Date(),
          })),
          { ordered: false },
        );
      } catch (err: any) {
        // double-click races hit the unique index; ignore those only
        const onlyDuplicates =
          err?.code === 11000 ||
          err?.writeErrors?.every((e: any) => e.code === 11000);
        if (!onlyDuplicates) throw err;
      }
    }
    return { created: questions.length };
  },

  async submitReview(
    userId: Types.ObjectId,
    input: {
      questionId: Types.ObjectId;
      rating: number;
      auto?: boolean;
      timeTakenMs?: number;
    },
  ) {
    if (![1, 2, 3, 4].includes(input.rating))
      throw new StudyError(400, "Invalid rating");

    const card = await UserCardModel.findOne({
      user: userId,
      question: input.questionId,
    });
    if (!card) throw new StudyError(404, "Card not found");

    const prevInterval = card.interval;
    const next = schedule(card, input.rating as Rating);

    card.set({
      ...next,
      lastReviewedAt: new Date(),
      lastRating: input.rating,
    });
    await card.save();

    await ReviewLogModel.create({
      user: userId,
      question: input.questionId,
      rating: input.rating,
      auto: !!input.auto,
      prevInterval,
      newInterval: next.interval,
      timeTakenMs: input.timeTakenMs,
    });

    return { dueAt: next.dueAt, interval: next.interval, state: next.state };
  },

  /** Chapters of a subject with total / studied / mastered / due. */
  async getChapterProgress(userId: Types.ObjectId, subjectId: Types.ObjectId) {
    const chapters = await ChapterModel.find({
      subject: subjectId,
      isActive: true,
    })
      .sort({ order: 1 })
      .select("name order")
      .lean();
    const ids = chapters.map((c: any) => c._id);
    const now = new Date();

    const [typeTotals, rows] = await Promise.all([
      getTypeTotals(ids),
      UserCardModel.aggregate([
        { $match: { user: userId, subject: subjectId } },
        {
          $group: {
            _id: { chapter: "$chapter", type: "$type" },
            studied: { $sum: 1 },
            mastered: {
              $sum: { $cond: [{ $gte: ["$interval", MASTERED_DAYS] }, 1, 0] },
            },
            due: { $sum: { $cond: [{ $lte: ["$dueAt", now] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const byType = new Map<string, any>(); // "chapter|type" -> stats
    const byChapter = new Map<
      string,
      { studied: number; mastered: number; due: number }
    >();
    for (const r of rows) {
      const ch = String(r._id.chapter);
      const sum = byChapter.get(ch) ?? { studied: 0, mastered: 0, due: 0 };
      sum.studied += r.studied;
      sum.mastered += r.mastered;
      sum.due += r.due;
      byChapter.set(ch, sum);
      if (r._id.type) byType.set(`${ch}|${r._id.type}`, r);
    }

    return chapters.map((c: any) => {
      const key = String(c._id);
      const list = [...(typeTotals.get(key) ?? [])].sort(
        (a, b) => b.total - a.total,
      );
      const sum = byChapter.get(key);
      return {
        chapterId: c._id,
        name: c.name,
        total: list.reduce((a, t) => a + t.total, 0),
        studied: sum?.studied ?? 0,
        mastered: sum?.mastered ?? 0,
        due: sum?.due ?? 0,
        types: list.map((t) => {
          const s = byType.get(`${key}|${t.type}`);
          return {
            type: t.type,
            total: t.total,
            studied: s?.studied ?? 0,
            mastered: s?.mastered ?? 0,
            due: s?.due ?? 0,
          };
        }),
      };
    });
  },

  /** Topics of a chapter with the same numbers. */
  async getTopicProgress(userId: Types.ObjectId, chapterId: Types.ObjectId) {
    const topics = await TopicModel.find({ chapter: chapterId, isActive: true })
      .sort({ order: 1 })
      .select("name order")
      .lean();
    const [totals, stats] = await Promise.all([
      getTotals("topic"),
      statsBy(userId, "topic", { chapter: chapterId }),
    ]);
    return topics.map((t: any) => {
      const s = stats.get(String(t._id));
      return {
        topicId: t._id,
        name: t.name,
        total: totals.get(String(t._id)) ?? 0,
        studied: s?.studied ?? 0,
        mastered: s?.mastered ?? 0,
        due: s?.due ?? 0,
      };
    });
  },
};
