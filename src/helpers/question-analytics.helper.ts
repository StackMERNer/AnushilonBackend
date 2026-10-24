// question-analytics.helpers.ts
// Filter -> Mongo match builder, shared aggregation fragments, data-quality matchers.
import { Model, Types } from "mongoose";
import type {
  QuestionAnalyticsDataQualityIssue as Issue,
  QuestionAnalyticsDateRange,
  QuestionAnalyticsFilters,
  QuestionAnalyticsPaginatedResult,
  QuestionAnalyticsPagination,
} from "../types/question-analytics";

// ⚠️ Adjust these import paths to your project.
import { QuestionModel } from "../models/question.model";
import { SubjectModel } from "../models/subject.model";
import { ChapterModel } from "../models/chapter.model";
import { TopicModel } from "../models/topic.model";
import { ClassModel } from "../models/class.model";
import { BoardModel } from "../models/board.model";
import { SchoolModel } from "../models/school.model";
import { UniversityModel } from "../models/university.model";

export type Doc = Record<string, any>;

export const Q = QuestionModel as Model<any>;
export const SubjectM = SubjectModel as Model<any>;
export const ChapterM = ChapterModel as Model<any>;
export const TopicM = TopicModel as Model<any>;
export const ClassM = ClassModel as Model<any>;
export const BoardM = BoardModel as Model<any>;
export const SchoolM = SchoolModel as Model<any>;
export const UniversityM = UniversityModel as Model<any>;

export const TZ = process.env.ANALYTICS_TIMEZONE || "Asia/Dhaka";
const TZ_OFFSET = process.env.ANALYTICS_UTC_OFFSET || "+06:00";
export const NONE = "__none__";

/* ------------------------------------------------------------------ */
/* small utils                                                         */
/* ------------------------------------------------------------------ */

export const arr = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
export const oids = (v: unknown): Types.ObjectId[] =>
  arr(v)
    .filter((x) => Types.ObjectId.isValid(x))
    .map((x) => new Types.ObjectId(x));
export const nums = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : [];
export const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
export const iso = (d: any): string | null =>
  d ? new Date(d).toISOString() : null;
export const pct = (n: number, total: number) =>
  total ? Math.round((n / total) * 1000) / 10 : 0;
export const and2 = (...docs: Doc[]): Doc => {
  const d = docs.filter((x) => x && Object.keys(x).length);
  return d.length ? { $and: d } : {};
};

function parseDate(s: string | undefined, endOfDay: boolean): Date | undefined {
  if (!s || typeof s !== "string") return undefined;
  const v = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? `${s}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${TZ_OFFSET}`
    : s;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface Period {
  from: Date;
  to: Date;
}
export interface Periods {
  created: Period;
  updated: Period;
}

export function resolvePeriod(
  range?: QuestionAnalyticsDateRange,
  days = 30,
): Period {
  const to = parseDate(range?.to, true) ?? new Date();
  const from =
    parseDate(range?.from, false) ?? new Date(to.getTime() - days * 86_400_000);
  return { from, to };
}
export function previousPeriod(p: Period): Period {
  const len = p.to.getTime() - p.from.getTime();
  return {
    from: new Date(p.from.getTime() - len - 1),
    to: new Date(p.from.getTime() - 1),
  };
}
export function getPeriods(f: QuestionAnalyticsFilters): Periods {
  const created = resolvePeriod(f.createdAt);
  return {
    created,
    updated: f.updatedAt ? resolvePeriod(f.updatedAt) : created,
  };
}

export function paginate<T>(
  items: T[],
  p?: Partial<QuestionAnalyticsPagination>,
): QuestionAnalyticsPaginatedResult<T> {
  const limit = Math.min(Math.max(Math.floor(p?.limit ?? 25), 1), 500);
  const page = Math.max(Math.floor(p?.page ?? 1), 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items: items.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Mongo expressions                                                   */
/* ------------------------------------------------------------------ */

/** Highest exam year of a question across boards / schools / universities. */
export const EXAM_YEAR_EXPR = {
  $max: [
    { $max: { $ifNull: ["$boards.year", []] } },
    { $max: { $ifNull: ["$schools.year", []] } },
    { $max: { $ifNull: ["$universities.year", []] } },
  ],
};

/** A question "has an answer" if answer text, a valid MCQ index, or any sub-answer exists. */
export const HAS_ANSWER_EXPR = {
  $or: [
    { $gt: [{ $strLenCP: { $ifNull: ["$answer", ""] } }, 0] },
    { $and: [{ $isNumber: "$correctMcq" }, { $gte: ["$correctMcq", 0] }] },
    {
      $gt: [
        {
          $size: {
            $filter: {
              input: { $ifNull: ["$questions", []] },
              as: "q",
              cond: {
                $gt: [{ $strLenCP: { $ifNull: ["$$q.answer", ""] } }, 0],
              },
            },
          },
        },
        0,
      ],
    },
  ],
};

/** Flattens boards/schools/universities into {src, ref, year} entries. */
const ENTRIES_EXPR = {
  $concatArrays: [
    {
      $map: {
        input: { $ifNull: ["$boards", []] },
        as: "x",
        in: { src: "b", ref: "$$x.board", year: "$$x.year" },
      },
    },
    {
      $map: {
        input: { $ifNull: ["$schools", []] },
        as: "x",
        in: { src: "s", ref: "$$x.school", year: "$$x.year" },
      },
    },
    {
      $map: {
        input: { $ifNull: ["$universities", []] },
        as: "x",
        in: { src: "u", ref: "$$x.university", year: "$$x.year" },
      },
    },
  ],
};

/** Condition (over `$$e`) applying year / board / school / university filters to entries. */
export function entryCond(f: QuestionAnalyticsFilters): any {
  const c: any[] = [];
  const years = nums(f.examYears);
  if (years.length) c.push({ $in: ["$$e.year", years] });
  const min = num(f.minExamYear);
  const max = num(f.maxExamYear);
  if (min !== undefined) c.push({ $gte: ["$$e.year", min] });
  if (max !== undefined) c.push({ $lte: ["$$e.year", max] });
  const refs: [string, Types.ObjectId[]][] = [
    ["b", oids(f.boardIds)],
    ["s", oids(f.schoolIds)],
    ["u", oids(f.universityIds)],
  ];
  for (const [src, ids] of refs)
    if (ids.length)
      c.push({ $or: [{ $ne: ["$$e.src", src] }, { $in: ["$$e.ref", ids] }] });
  return c.length ? { $and: c } : true;
}

/** Stages producing one document per matching exam entry (`entries.{src,ref,year}`). */
export function entryStages(
  f: QuestionAnalyticsFilters,
  src?: "b" | "s" | "u",
): any[] {
  const cond = entryCond(f);
  return [
    {
      $addFields: {
        entries: {
          $filter: {
            input: ENTRIES_EXPR,
            as: "e",
            cond: src ? { $and: [{ $eq: ["$$e.src", src] }, cond] } : cond,
          },
        },
      },
    },
    { $unwind: "$entries" },
  ];
}

/**
 * Generic $group with the stats every table needs.
 * Output docs: _id, total, typeCounts, latestExamYear, latestCreatedAt,
 * addedInPeriod, updatedInPeriod, withAnswers, withoutTopic, chapterCount, topicCount (+extra/post).
 */
export function groupStages(o: {
  id: any;
  periods: Periods;
  yearExpr?: any;
  extra?: Doc;
  post?: any[];
}): any[] {
  const inR = (field: string, p: Period) => ({
    $and: [{ $gte: [`$${field}`, p.from] }, { $lte: [`$${field}`, p.to] }],
  });
  return [
    { $addFields: { __y: o.yearExpr ?? EXAM_YEAR_EXPR, __a: HAS_ANSWER_EXPR } },
    {
      $group: {
        _id: o.id,
        total: { $sum: 1 },
        types: { $push: "$type" },
        latestExamYear: { $max: "$__y" },
        latestCreatedAt: { $max: "$createdAt" },
        addedInPeriod: {
          $sum: { $cond: [inR("createdAt", o.periods.created), 1, 0] },
        },
        updatedInPeriod: {
          $sum: { $cond: [inR("updatedAt", o.periods.updated), 1, 0] },
        },
        withAnswers: { $sum: { $cond: ["$__a", 1, 0] } },
        withoutTopic: {
          $sum: {
            $cond: [{ $eq: [{ $ifNull: ["$topic", null] }, null] }, 1, 0],
          },
        },
        chapters: { $addToSet: "$chapter" },
        topics: { $addToSet: "$topic" },
        ...(o.extra ?? {}),
      },
    },
    {
      $addFields: {
        typeCounts: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: ["$types"] },
              as: "t",
              in: {
                k: { $ifNull: ["$$t", "unknown"] },
                v: {
                  $size: {
                    $filter: {
                      input: "$types",
                      as: "x",
                      cond: { $eq: ["$$x", "$$t"] },
                    },
                  },
                },
              },
            },
          },
        },
        chapterCount: { $size: { $setDifference: ["$chapters", [null]] } },
        topicCount: { $size: { $setDifference: ["$topics", [null]] } },
      },
    },
    { $project: { types: 0, chapters: 0, topics: 0 } },
    ...(o.post ?? []),
  ];
}

export const inRangeExpr = (field: string, p: Period) => ({
  $and: [{ $gte: [`$${field}`, p.from] }, { $lte: [`$${field}`, p.to] }],
});

/* ------------------------------------------------------------------ */
/* Name lookups (topic -> chapter -> subject -> class)                 */
/* ------------------------------------------------------------------ */

export interface Lookups {
  classes: Map<string, any>;
  subjects: Map<string, any>;
  chapters: Map<string, any>;
  topics: Map<string, any>;
}

const uniq = (a?: any[]) => [...new Set((a ?? []).filter(Boolean).map(String))];
const toMap = (docs: any[]) =>
  new Map<string, any>(docs.map((d) => [String(d._id), d]));

export async function loadLookups(ids: {
  subjects?: any[];
  chapters?: any[];
  topics?: any[];
}): Promise<Lookups> {
  const topicIds = uniq(ids.topics);
  const topics = topicIds.length
    ? await TopicM.find({ _id: { $in: topicIds } })
        .select("name chapter order")
        .lean()
    : [];
  const chapterIds = uniq([
    ...(ids.chapters ?? []),
    ...topics.map((t: any) => t.chapter),
  ]);
  const chapters = chapterIds.length
    ? await ChapterM.find({ _id: { $in: chapterIds } })
        .select("name subject order")
        .lean()
    : [];
  const subjectIds = uniq([
    ...(ids.subjects ?? []),
    ...chapters.map((c: any) => c.subject),
  ]);
  const subjects = subjectIds.length
    ? await SubjectM.find({ _id: { $in: subjectIds } })
        .select("name class order")
        .lean()
    : [];
  const classIds = uniq(subjects.map((s: any) => s.class));
  const classes = classIds.length
    ? await ClassM.find({ _id: { $in: classIds } })
        .select("name order")
        .lean()
    : [];
  return {
    topics: toMap(topics),
    chapters: toMap(chapters),
    subjects: toMap(subjects),
    classes: toMap(classes),
  };
}

/* ------------------------------------------------------------------ */
/* Data-quality                                                        */
/* ------------------------------------------------------------------ */

export const ALL_ISSUES: Issue[] = [
  "missing-question",
  "missing-subject",
  "missing-chapter",
  "missing-topic",
  "missing-answer",
  "missing-mcq-options",
  "invalid-mcq-answer-index",
  "missing-board-year",
  "missing-school-year",
  "missing-university-year",
  "missing-ref-id",
  "possible-duplicate",
  "orphaned-subject",
  "orphaned-chapter",
  "orphaned-topic",
];

export const ISSUE_LABELS: Record<Issue, string> = {
  "missing-question": "No question text or sub-questions",
  "missing-subject": "Missing subject",
  "missing-chapter": "Missing chapter",
  "missing-topic": "Missing topic",
  "missing-answer": "Missing answer (non-MCQ)",
  "missing-mcq-options": "MCQ with fewer than 2 options",
  "invalid-mcq-answer-index": "MCQ correct answer missing / out of range",
  "missing-board-year": "Board entry without year",
  "missing-school-year": "School entry without year",
  "missing-university-year": "University entry without year",
  "missing-ref-id": "Missing refId",
  "possible-duplicate": "Possible duplicate (same text)",
  "orphaned-subject": "Subject no longer exists",
  "orphaned-chapter": "Chapter no longer exists",
  "orphaned-topic": "Topic no longer exists",
};

export interface IssueContext {
  dupSet: Set<string>;
  dupIds: Types.ObjectId[];
  orphanSubjects: Types.ObjectId[];
  orphanChapters: Types.ObjectId[];
  orphanTopics: Types.ObjectId[];
  orphanSets: {
    subject: Set<string>;
    chapter: Set<string>;
    topic: Set<string>;
  };
}

let ctxCache: { at: number; value: IssueContext } | null = null;
const CTX_TTL_MS = 5 * 60 * 1000;

/** Duplicate + orphan detection scans the collection, so it is cached for 5 minutes. */
export async function getIssueContext(): Promise<IssueContext> {
  if (ctxCache && Date.now() - ctxCache.at < CTX_TTL_MS) return ctxCache.value;

  const [dupGroups, qs, qc, qt] = await Promise.all([
    Q.aggregate([
      { $match: { question: { $type: "string" } } },
      {
        $project: {
          type: 1,
          q: { $trim: { input: { $toLower: "$question" } } },
          c: { $trim: { input: { $toLower: { $ifNull: ["$context", ""] } } } },
        },
      },
      { $match: { $expr: { $gte: [{ $strLenCP: "$q" }, 15] } } },
      {
        $group: {
          _id: { type: "$type", q: "$q", c: "$c" },
          ids: { $push: "$_id" },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
      { $limit: 5000 },
    ]).allowDiskUse(true),
    Q.distinct("subject"),
    Q.distinct("chapter"),
    Q.distinct("topic"),
  ]);

  const orphans = async (M: Model<any>, ids: any[]) => {
    const clean = ids.filter(Boolean);
    if (!clean.length) return [] as Types.ObjectId[];
    const found = new Set(
      (
        await M.find({ _id: { $in: clean } })
          .select("_id")
          .lean()
      ).map((d: any) => String(d._id)),
    );
    return clean.filter((id) => !found.has(String(id))) as Types.ObjectId[];
  };

  const [orphanSubjects, orphanChapters, orphanTopics] = await Promise.all([
    orphans(SubjectM, qs),
    orphans(ChapterM, qc),
    orphans(TopicM, qt),
  ]);

  const dupIds = (dupGroups as any[]).flatMap((g) => g.ids).slice(0, 50_000);
  const value: IssueContext = {
    dupIds,
    dupSet: new Set(dupIds.map(String)),
    orphanSubjects,
    orphanChapters,
    orphanTopics,
    orphanSets: {
      subject: new Set(orphanSubjects.map(String)),
      chapter: new Set(orphanChapters.map(String)),
      topic: new Set(orphanTopics.map(String)),
    },
  };
  ctxCache = { at: Date.now(), value };
  return value;
}

/** Mongo filter fragment for each issue. */
export async function getIssueMatchers(): Promise<Record<Issue, Doc>> {
  const c = await getIssueContext();
  const empty = (f: string): Doc => ({ [f]: { $in: [null, ""] } });
  return {
    "missing-question": {
      $and: [empty("question"), { "questions.0": { $exists: false } }],
    },
    "missing-subject": { subject: null },
    "missing-chapter": { chapter: null },
    "missing-topic": { topic: null },
    "missing-answer": {
      $and: [
        { type: { $ne: "mcq" } },
        empty("answer"),
        { "questions.0": { $exists: false } },
      ],
    },
    "missing-mcq-options": { type: "mcq", "options.1": { $exists: false } },
    "invalid-mcq-answer-index": {
      type: "mcq",
      $expr: {
        $or: [
          { $not: [{ $isNumber: "$correctMcq" }] },
          { $lt: ["$correctMcq", 0] },
          { $gte: ["$correctMcq", { $size: { $ifNull: ["$options", []] } }] },
        ],
      },
    },
    "missing-board-year": { boards: { $elemMatch: { year: null } } },
    "missing-school-year": { schools: { $elemMatch: { year: null } } },
    "missing-university-year": { universities: { $elemMatch: { year: null } } },
    "missing-ref-id": empty("refId"),
    "possible-duplicate": { _id: { $in: c.dupIds } },
    "orphaned-subject": { subject: { $in: c.orphanSubjects } },
    "orphaned-chapter": { chapter: { $in: c.orphanChapters } },
    "orphaned-topic": { topic: { $in: c.orphanTopics } },
  };
}

/** JS mirror of the matchers above, used to label the rows of one page. */
export function detectIssues(q: any, c: IssueContext): Issue[] {
  const e = (v: any) => v == null || v === "";
  const out: Issue[] = [];
  const hasSub = (q.questions?.length ?? 0) > 0;
  const isMcq = q.type === "mcq";
  const optLen = q.options?.length ?? 0;
  if (e(q.question) && !hasSub) out.push("missing-question");
  if (q.subject == null) out.push("missing-subject");
  if (q.chapter == null) out.push("missing-chapter");
  if (q.topic == null) out.push("missing-topic");
  if (!isMcq && e(q.answer) && !hasSub) out.push("missing-answer");
  if (isMcq && optLen < 2) out.push("missing-mcq-options");
  if (
    isMcq &&
    (typeof q.correctMcq !== "number" ||
      q.correctMcq < 0 ||
      q.correctMcq >= optLen)
  )
    out.push("invalid-mcq-answer-index");
  if (q.boards?.some((b: any) => b.year == null))
    out.push("missing-board-year");
  if (q.schools?.some((b: any) => b.year == null))
    out.push("missing-school-year");
  if (q.universities?.some((b: any) => b.year == null))
    out.push("missing-university-year");
  if (e(q.refId)) out.push("missing-ref-id");
  if (c.dupSet.has(String(q._id))) out.push("possible-duplicate");
  if (q.subject && c.orphanSets.subject.has(String(q.subject)))
    out.push("orphaned-subject");
  if (q.chapter && c.orphanSets.chapter.has(String(q.chapter)))
    out.push("orphaned-chapter");
  if (q.topic && c.orphanSets.topic.has(String(q.topic)))
    out.push("orphaned-topic");
  return out;
}

/* ------------------------------------------------------------------ */
/* Filters -> Mongo match                                              */
/* ------------------------------------------------------------------ */

export type OmitKey =
  | "classIds"
  | "subjectIds"
  | "chapterIds"
  | "topicIds"
  | "types"
  | "boardIds"
  | "schoolIds"
  | "universityIds"
  | "examYears"
  | "createdAt"
  | "updatedAt"
  | "difficulties"
  | "levels"
  | "tags";

function inOrNone(field: string, values: string[]): Doc {
  const real = values.filter((v) => v !== NONE);
  if (values.includes(NONE))
    return real.length
      ? { $or: [{ [field]: { $in: real } }, { [field]: { $in: [null, ""] } }] }
      : { [field]: { $in: [null, ""] } };
  return { [field]: { $in: real } };
}

const HAS_ANSWER_MATCH: Doc = {
  $or: [
    { answer: { $nin: [null, ""] } },
    { correctMcq: { $gte: 0 } },
    { questions: { $elemMatch: { answer: { $nin: [null, ""] } } } },
  ],
};

const flag = (and: Doc[], v: boolean | undefined, frag: Doc) => {
  if (v === true) and.push(frag);
  else if (v === false) and.push({ $nor: [frag] });
};

const dateCond = (r?: QuestionAnalyticsDateRange): Doc | null => {
  const from = parseDate(r?.from, false);
  const to = parseDate(r?.to, true);
  if (!from && !to) return null;
  return { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
};

/**
 * Builds the Mongo filter for a set of analytics filters.
 * `omit` removes some filters (used for cascading facet counts and period comparisons).
 * Class is not stored on a question, so class filters are resolved to subject ids first.
 */
export async function buildMatch(
  input: QuestionAnalyticsFilters = {},
  opts: { omit?: OmitKey[] } = {},
): Promise<Doc> {
  const f: Doc = { ...input };
  for (const k of opts.omit ?? []) {
    delete f[k];
    if (k === "examYears") {
      delete f.minExamYear;
      delete f.maxExamYear;
    }
  }
  const and: Doc[] = [];

  let subjectIds = arr(f.subjectIds);
  const classIds = oids(f.classIds);
  if (classIds.length) {
    const ids = new Set(
      (
        await SubjectM.find({ class: { $in: classIds } })
          .select("_id")
          .lean()
      ).map((s: any) => String(s._id)),
    );
    subjectIds = subjectIds.length
      ? subjectIds.filter((id) => ids.has(id))
      : [...ids];
    if (!subjectIds.length) return { _id: { $in: [] } };
  }
  if (subjectIds.length) and.push({ subject: { $in: oids(subjectIds) } });
  if (arr(f.chapterIds).length)
    and.push({ chapter: { $in: oids(f.chapterIds) } });
  if (arr(f.topicIds).length) and.push({ topic: { $in: oids(f.topicIds) } });

  if (arr(f.types).length) and.push({ type: { $in: arr(f.types) } });
  if (arr(f.difficulties).length)
    and.push(inOrNone("difficulty", arr(f.difficulties)));
  if (arr(f.levels).length) and.push(inOrNone("level", arr(f.levels)));
  if (arr(f.tags).length) and.push({ tags: { $in: arr(f.tags) } });

  if (oids(f.boardIds).length)
    and.push({ "boards.board": { $in: oids(f.boardIds) } });
  if (oids(f.schoolIds).length)
    and.push({ "schools.school": { $in: oids(f.schoolIds) } });
  if (oids(f.universityIds).length)
    and.push({ "universities.university": { $in: oids(f.universityIds) } });

  const yearCond: Doc = {};
  if (nums(f.examYears).length) yearCond.$in = nums(f.examYears);
  if (num(f.minExamYear) !== undefined) yearCond.$gte = f.minExamYear;
  if (num(f.maxExamYear) !== undefined) yearCond.$lte = f.maxExamYear;
  if (Object.keys(yearCond).length)
    and.push({
      $or: ["boards", "schools", "universities"].map((k) => ({
        [k]: { $elemMatch: { year: yearCond } },
      })),
    });

  const created = dateCond(f.createdAt);
  if (created) and.push({ createdAt: created });
  const updated = dateCond(f.updatedAt);
  if (updated) and.push({ updatedAt: updated });

  const minR = num(f.minRating);
  const maxR = num(f.maxRating);
  if (minR !== undefined || maxR !== undefined)
    and.push({
      rating: {
        ...(minR !== undefined ? { $gte: minR } : {}),
        ...(maxR !== undefined ? { $lte: maxR } : {}),
      },
    });

  flag(and, f.hasAnswer, HAS_ANSWER_MATCH);
  flag(and, f.hasContext, { context: { $nin: [null, ""] } });
  flag(and, f.hasOptions, { "options.0": { $exists: true } });
  flag(and, f.hasBoards, { "boards.0": { $exists: true } });
  flag(and, f.hasSchools, { "schools.0": { $exists: true } });
  flag(and, f.hasUniversities, { "universities.0": { $exists: true } });
  flag(and, f.hasTopic, { topic: { $ne: null } });

  const issues = arr(f.dataQuality) as Issue[];
  if (issues.length) {
    const m = await getIssueMatchers();
    const frags = issues.filter((i) => m[i]).map((i) => m[i]);
    if (frags.length) and.push({ $or: frags });
  }

  return and.length ? { $and: and } : {};
}
