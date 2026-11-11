import { Types } from "mongoose";
import { UserCardModel } from "../models/user-card.model";
import { ReviewLogModel } from "../models/review-log.model";
import { SubjectModel } from "../models/subject.model";
import { ChapterModel } from "../models/chapter.model";
import { getTotals, statsBy } from "./study.service";
import { MASTERED_DAYS } from "../utils/sm2";

const DAY_MS = 86_400_000;
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6, no DST

// "YYYY-MM-DD" of the Dhaka calendar day containing instant t
const dayKey = (t: number) =>
  new Date(t + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
// instant of 00:00 Dhaka for the day containing t
const startOfDhakaDay = (t: number) =>
  Math.floor((t + DHAKA_OFFSET_MS) / DAY_MS) * DAY_MS - DHAKA_OFFSET_MS;

export const DashboardService = {
  async getSummary(userId: Types.ObjectId) {
    const now = Date.now();
    const todayStart = startOfDhakaDay(now);
    const since = new Date(todayStart - 365 * DAY_MS);

    const [dueCount, totalStudied, mastered, dayRows, last] = await Promise.all(
      [
        UserCardModel.countDocuments({
          user: userId,
          dueAt: { $lte: new Date(now) },
        }),
        UserCardModel.countDocuments({ user: userId }),
        UserCardModel.countDocuments({
          user: userId,
          interval: { $gte: MASTERED_DAYS },
        }),
        ReviewLogModel.aggregate([
          { $match: { user: userId, reviewedAt: { $gte: since } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$reviewedAt",
                  timezone: "+06:00",
                },
              },
              count: { $sum: 1 },
            },
          },
        ]),
        UserCardModel.findOne({
          user: userId,
          lastReviewedAt: { $exists: true },
        })
          .sort({ lastReviewedAt: -1 })
          .select("subject chapter")
          .lean(),
      ],
    );

    const byDay = new Map<string, number>(
      dayRows.map((r: any) => [r._id, r.count]),
    );

    // last 7 days, oldest -> today
    const last7Days = Array.from({ length: 7 }, (_, k) => {
      const date = dayKey(todayStart - (6 - k) * DAY_MS);
      return { date, count: byDay.get(date) ?? 0 };
    });

    // streak: consecutive days with >= 1 review. If nothing yet today,
    // the streak is still alive until the day ends, so start from yesterday.
    let streak = 0;
    let i = byDay.has(dayKey(todayStart)) ? 0 : 1;
    while (byDay.has(dayKey(todayStart - i * DAY_MS))) {
      streak++;
      i++;
    }

    let lastStudied: null | {
      subjectId: Types.ObjectId;
      subjectName: string;
      chapterId: Types.ObjectId;
      chapterName: string;
    } = null;
    if ((last as any)?.chapter && (last as any)?.subject) {
      const [chapter, subject] = await Promise.all([
        ChapterModel.findById((last as any).chapter)
          .select("name")
          .lean(),
        SubjectModel.findById((last as any).subject)
          .select("name")
          .lean(),
      ]);
      if (chapter && subject) {
        lastStudied = {
          subjectId: (subject as any)._id,
          subjectName: (subject as any).name,
          chapterId: (chapter as any)._id,
          chapterName: (chapter as any).name,
        };
      }
    }

    return {
      dueCount,
      totalStudied,
      mastered,
      reviewedToday: byDay.get(dayKey(todayStart)) ?? 0,
      streak,
      last7Days,
      lastStudied,
    };
  },

  /** Subjects for the user's class: their stream + "general" (+ any without a stream). */
  async getSubjects(
    userId: Types.ObjectId,
    user: { class?: Types.ObjectId; stream?: string },
  ) {
    if (!user.class) return [];

    const streams = ["generel"];
    if (user.stream) streams.push(user.stream);

    const subjects = await SubjectModel.find({
      class: user.class,
      isActive: true,
      version: "bangla",
      $or: [{ stream: { $in: streams } }, { stream: { $in: [null, ""] } }],
    })
      .sort({ order: 1 })
      .select("name subjectCode order")
      .lean();

    // const ids = subjects.map((s: any) => s._id);
    const [totals, stats] = await Promise.all([
      getTotals("subject"),
      statsBy(userId, "subject", {}),
    ]);

    return subjects.map((s: any) => {
      const st = stats.get(String(s._id));
      return {
        subjectId: s._id,
        name: s.name,
        subjectCode: s.subjectCode,
        total: totals.get(String(s._id)) ?? 0,
        studied: st?.studied ?? 0,
        mastered: st?.mastered ?? 0,
        due: st?.due ?? 0,
      };
    });
  },
};
