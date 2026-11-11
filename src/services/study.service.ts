import { Types } from "mongoose";
import { QuestionModel } from "../models/question.model";
import { ChapterModel } from "../models/chapter.model";
import { TopicModel } from "../models/topic.model";
import { UserCardModel } from "../models/user-card.model";
import { ReviewLogModel } from "../models/review-log.model";
import { schedule, Rating, MASTERED_DAYS } from "../utils/sm2";

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
    } = {},
  ) {
    const { limit = 30, chapterId, topicId } = opts;
    const filter: Record<string, any> = {
      user: userId,
      dueAt: { $lte: new Date() },
    };
    if (chapterId) filter.chapter = chapterId;
    if (topicId) filter.topic = topicId;

    const [cards, totalDue] = await Promise.all([
      UserCardModel.find(filter)
        .sort({ dueAt: 1 })
        .limit(limit)
        .select("question state interval dueAt")
        .lean(),
      UserCardModel.countDocuments(filter),
    ]);

    const questions = await QuestionModel.find({
      _id: { $in: cards.map((c: any) => c.question) },
    })
      .select(QUESTION_FIELDS)
      .populate(POPULATE)
      .lean();
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
    },
  ) {
    const { chapterId, topicId, count } = opts;

    const seen = await UserCardModel.distinct("question", {
      user: userId,
      chapter: chapterId,
    });

    const questions = await QuestionModel.find({
      chapter: chapterId,
      ...(topicId ? { topic: topicId } : {}),
      studyMode: { $ne: "none" },
      _id: { $nin: seen },
    })
      .sort({ _id: 1 })
      .limit(count)
      .select("subject chapter topic")
      .lean();

    if (questions.length) {
      try {
        await UserCardModel.insertMany(
          questions.map((q: any) => ({
            user: userId,
            question: q._id,
            subject: q.subject,
            chapter: q.chapter,
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
    const [totals, stats] = await Promise.all([
      getTotals("chapter"),
      statsBy(userId, "chapter", { subject: subjectId }),
    ]);
    console.log({
      chapterCount: chapters.length,
      totalMapSize: totals.size,
      matchingIds: chapters.filter((c: any) => totals.has(String(c._id)))
        .length,
      chapterIds: chapters.slice(0, 5).map((c: any) => String(c._id)),
      totalKeys: [...totals.keys()].slice(0, 5),
    });
    console.log("totals", totals);
    return chapters.map((c: any) => {
      const s = stats.get(String(c._id));
      console.log(String(c._id), totals.get(String(c._id)));
      return {
        chapterId: c._id,
        name: c.name,
        total: totals.get(String(c._id)) ?? 0,
        studied: s?.studied ?? 0,
        mastered: s?.mastered ?? 0,
        due: s?.due ?? 0,
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
