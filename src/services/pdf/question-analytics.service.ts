// question-analytics.service.ts
import type {
  QuestionAnalyticsBreakdownRequest,
  QuestionAnalyticsChapterRow,
  QuestionAnalyticsClassRow,
  QuestionAnalyticsDashboardRequest,
  QuestionAnalyticsDashboardResponse,
  QuestionAnalyticsDataQualityIssue as Issue,
  QuestionAnalyticsDistributionItem,
  QuestionAnalyticsExamSourceRow,
  QuestionAnalyticsExamYearCoverageRow,
  QuestionAnalyticsFilterOptions,
  QuestionAnalyticsFilterOptionsRequest,
  QuestionAnalyticsFilters,
  QuestionAnalyticsGranularity,
  QuestionAnalyticsOption,
  QuestionAnalyticsQualityReport,
  QuestionAnalyticsQualityRequest,
  QuestionAnalyticsQualityRow,
  QuestionAnalyticsQualitySummary,
  QuestionAnalyticsSubjectRow,
  QuestionAnalyticsSummary,
  QuestionAnalyticsTimeSeries,
  QuestionAnalyticsTopicRow,
  QuestionAnalyticsTypeBreakdown,
  QuestionAnalyticsTypeCounts,
  QuestionAnalyticsYearBreakdown,
} from "../../types/question-analytics";
import type {
  QuestionAnalyticsBreakdownResponse,
  QuestionAnalyticsBreakdownRow,
  QuestionAnalyticsExamCoverageRequest,
  QuestionAnalyticsExamCoverageResponse,
} from "../../types/question-analytics.extra.types";
import {
  ALL_ISSUES,
  BoardM,
  ISSUE_LABELS,
  Lookups,
  NONE,
  OmitKey,
  Periods,
  Q,
  SchoolM,
  TZ,
  UniversityM,
  and2,
  buildMatch,
  detectIssues,
  entryStages,
  getIssueContext,
  getIssueMatchers,
  getPeriods,
  groupStages,
  inRangeExpr,
  iso,
  loadLookups,
  paginate,
  pct,
  previousPeriod,
  Doc,
} from "../../helpers/question-analytics.helper";

const UNASSIGNED = "Unassigned";
const GRANULARITIES: QuestionAnalyticsGranularity[] = [
  "day",
  "week",
  "month",
  "year",
];

const maxN = (a: number | null, b: number | null | undefined) =>
  b == null ? a : a == null ? b : Math.max(a, b);
const maxS = (a: string | null, b: string | null) =>
  !b ? a : !a ? b : a > b ? a : b;
const mergeCounts = (
  a: QuestionAnalyticsTypeCounts,
  b: QuestionAnalyticsTypeCounts,
) => {
  for (const [k, v] of Object.entries(b)) a[k] = (a[k] ?? 0) + v;
};
const idStr = (v: any): string | null => (v == null ? null : String(v));

/* ================================================================== */
/* Hierarchy (class / subject / chapter / topic)                       */
/* ================================================================== */

interface HierarchyResult {
  classRows: QuestionAnalyticsClassRow[];
  subjectRows: QuestionAnalyticsSubjectRow[];
  chapterRows: QuestionAnalyticsChapterRow[];
  topicRows: QuestionAnalyticsTopicRow[];
  subjectGroups: any[];
  lookups: Lookups;
}

async function computeHierarchy(
  match: Doc,
  periods: Periods,
  want: {
    class?: boolean;
    subject?: boolean;
    chapter?: boolean;
    topic?: boolean;
  },
): Promise<HierarchyResult> {
  const run = (field: string): Promise<any[]> =>
    Q.aggregate([
      { $match: match },
      ...groupStages({ id: `$${field}`, periods }),
    ]).allowDiskUse(true) as any;

  const [sg, cg, tg] = await Promise.all([
    want.class || want.subject ? run("subject") : Promise.resolve([] as any[]),
    want.chapter ? run("chapter") : Promise.resolve([] as any[]),
    want.topic ? run("topic") : Promise.resolve([] as any[]),
  ]);

  const lk = await loadLookups({
    subjects: sg.map((g) => g._id),
    chapters: cg.map((g) => g._id),
    topics: tg.map((g) => g._id),
  });

  const chain = (chapterId: any) => {
    const ch = chapterId ? lk.chapters.get(String(chapterId)) : undefined;
    const sub = ch ? lk.subjects.get(String(ch.subject)) : undefined;
    const cls = sub ? lk.classes.get(String(sub.class)) : undefined;
    return { ch, sub, cls };
  };

  const subjectRows: QuestionAnalyticsSubjectRow[] = sg
    .map((g) => {
      const s = g._id ? lk.subjects.get(String(g._id)) : undefined;
      const c = s ? lk.classes.get(String(s.class)) : undefined;
      return {
        subjectId: idStr(g._id),
        subjectName:
          g._id == null ? "No subject" : (s?.name ?? "Unknown subject"),
        classId: c ? String(c._id) : null,
        className: c?.name ?? UNASSIGNED,
        totalQuestions: g.total,
        typeCounts: g.typeCounts ?? {},
        chapterCount: g.chapterCount,
        topicCount: g.topicCount,
        latestExamYear: g.latestExamYear ?? null,
        latestQuestionCreatedAt: iso(g.latestCreatedAt),
      };
    })
    .sort((a, b) => b.totalQuestions - a.totalQuestions);

  const classMap = new Map<string, QuestionAnalyticsClassRow>();
  for (const g of sg) {
    const s = g._id ? lk.subjects.get(String(g._id)) : undefined;
    const cid = s?.class ? String(s.class) : null;
    const key = cid ?? NONE;
    let row = classMap.get(key);
    if (!row) {
      row = {
        classId: cid,
        className: cid
          ? (lk.classes.get(cid)?.name ?? "Unknown class")
          : UNASSIGNED,
        totalQuestions: 0,
        typeCounts: {},
        subjectCount: 0,
        chapterCount: 0,
        latestExamYear: null,
        latestQuestionCreatedAt: null,
      };
      classMap.set(key, row);
    }
    row.totalQuestions += g.total;
    mergeCounts(row.typeCounts, g.typeCounts ?? {});
    if (g._id) row.subjectCount += 1;
    row.chapterCount += g.chapterCount;
    row.latestExamYear = maxN(row.latestExamYear, g.latestExamYear);
    row.latestQuestionCreatedAt = maxS(
      row.latestQuestionCreatedAt,
      iso(g.latestCreatedAt),
    );
  }
  const classRows = [...classMap.values()].sort(
    (a, b) => b.totalQuestions - a.totalQuestions,
  );

  const chapterRows: QuestionAnalyticsChapterRow[] = cg
    .map((g) => {
      const { ch, sub, cls } = chain(g._id);
      return {
        chapterId: idStr(g._id),
        chapterName:
          g._id == null ? "No chapter" : (ch?.name ?? "Unknown chapter"),
        subjectId: sub ? String(sub._id) : null,
        subjectName: sub?.name ?? UNASSIGNED,
        classId: cls ? String(cls._id) : null,
        className: cls?.name ?? UNASSIGNED,
        totalQuestions: g.total,
        typeCounts: g.typeCounts ?? {},
        topicCount: g.topicCount,
        latestExamYear: g.latestExamYear ?? null,
        latestQuestionCreatedAt: iso(g.latestCreatedAt),
        questionsAddedInPeriod: g.addedInPeriod,
        questionsUpdatedInPeriod: g.updatedInPeriod,
        questionsWithAnswers: g.withAnswers,
        questionsWithoutAnswers: g.total - g.withAnswers,
        questionsWithoutTopic: g.withoutTopic,
      };
    })
    .sort((a, b) => b.totalQuestions - a.totalQuestions);

  const topicRows: QuestionAnalyticsTopicRow[] = tg
    .map((g) => {
      const t = g._id ? lk.topics.get(String(g._id)) : undefined;
      const { ch, sub, cls } = chain(t?.chapter);
      return {
        topicId: idStr(g._id),
        topicName: g._id == null ? "No topic" : (t?.name ?? "Unknown topic"),
        chapterId: ch ? String(ch._id) : null,
        chapterName: ch?.name ?? UNASSIGNED,
        subjectId: sub ? String(sub._id) : null,
        subjectName: sub?.name ?? UNASSIGNED,
        classId: cls ? String(cls._id) : null,
        className: cls?.name ?? UNASSIGNED,
        totalQuestions: g.total,
        typeCounts: g.typeCounts ?? {},
        latestExamYear: g.latestExamYear ?? null,
        latestQuestionCreatedAt: iso(g.latestCreatedAt),
      };
    })
    .sort((a, b) => b.totalQuestions - a.totalQuestions);

  return {
    classRows,
    subjectRows,
    chapterRows,
    topicRows,
    subjectGroups: sg,
    lookups: lk,
  };
}

/* ================================================================== */
/* Small aggregations                                                  */
/* ================================================================== */

async function timeSeries(
  match: Doc,
  field: "createdAt" | "updatedAt",
  granularity: QuestionAnalyticsGranularity,
): Promise<QuestionAnalyticsTimeSeries> {
  const trunc: Doc = { date: `$${field}`, unit: granularity, timezone: TZ };
  if (granularity === "week") trunc.startOfWeek = "monday";
  const rows = await Q.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: { $dateTrunc: trunc },
            timezone: TZ,
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return {
    granularity,
    dateField: field,
    points: rows.map((r: any) => ({
      date: r._id as string,
      count: r.count as number,
    })),
  };
}

async function distribution(
  match: Doc,
  idExpr: string,
  total: number,
  unwindTags = false,
): Promise<Array<QuestionAnalyticsDistributionItem & { type: string | null }>> {
  const rows = await Q.aggregate([
    { $match: match },
    ...(unwindTags
      ? [{ $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } }]
      : []),
    { $group: { _id: { $ifNull: [idExpr, null] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r: any) => {
    const id = r._id == null || r._id === "" ? null : String(r._id);
    return {
      id,
      type: id,
      label: id ?? "Unspecified",
      count: r.count,
      percentage: pct(r.count, total),
    };
  });
}

/* ================================================================== */
/* Exam years & sources                                                */
/* ================================================================== */

async function getExamYears(
  filters: QuestionAnalyticsFilters,
  match: Doc,
): Promise<QuestionAnalyticsExamYearCoverageRow[]> {
  const rows = await Q.aggregate([
    { $match: match },
    ...entryStages(filters),
    { $match: { "entries.year": { $ne: null } } },
    {
      $group: {
        _id: { year: "$entries.year", q: "$_id" },
        srcs: { $addToSet: "$entries.src" },
        type: { $first: "$type" },
      },
    },
    {
      $group: {
        _id: { year: "$_id.year", type: "$type" },
        unique: { $sum: 1 },
        b: { $sum: { $cond: [{ $in: ["b", "$srcs"] }, 1, 0] } },
        s: { $sum: { $cond: [{ $in: ["s", "$srcs"] }, 1, 0] } },
        u: { $sum: { $cond: [{ $in: ["u", "$srcs"] }, 1, 0] } },
      },
    },
  ]).allowDiskUse(true);

  const byYear = new Map<number, QuestionAnalyticsExamYearCoverageRow>();
  for (const r of rows as any[]) {
    const year = r._id.year as number;
    let row = byYear.get(year);
    if (!row) {
      row = {
        year,
        boardCount: 0,
        schoolCount: 0,
        universityCount: 0,
        uniqueQuestionCount: 0,
        typeCounts: {},
      };
      byYear.set(year, row);
    }
    row.boardCount += r.b;
    row.schoolCount += r.s;
    row.universityCount += r.u;
    row.uniqueQuestionCount += r.unique;
    row.typeCounts[r._id.type ?? "unknown"] =
      (row.typeCounts[r._id.type ?? "unknown"] ?? 0) + r.unique;
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

async function getExamSources(
  filters: QuestionAnalyticsFilters,
  match: Doc,
  periods: Periods,
): Promise<{
  boards: QuestionAnalyticsExamSourceRow[];
  schools: QuestionAnalyticsExamSourceRow[];
  universities: QuestionAnalyticsExamSourceRow[];
}> {
  const groups: any[] = await Q.aggregate([
    { $match: match },
    ...entryStages(filters),
    ...groupStages({
      id: { src: "$entries.src", ref: "$entries.ref" },
      periods,
      yearExpr: "$entries.year",
      extra: {
        ids: { $addToSet: "$_id" },
        years: { $addToSet: "$entries.year" },
        periodIds: {
          $addToSet: {
            $cond: [inRangeExpr("createdAt", periods.created), "$_id", null],
          },
        },
      },
      post: [
        {
          $addFields: {
            uniqueCount: { $size: "$ids" },
            periodCount: { $size: { $setDifference: ["$periodIds", [null]] } },
          },
        },
        { $project: { ids: 0, periodIds: 0 } },
      ],
    }),
  ]).allowDiskUse(true);

  const refIds = (src: string) =>
    groups.filter((g) => g._id.src === src).map((g) => g._id.ref);
  const [boards, schools, unis] = await Promise.all([
    BoardM.find({ _id: { $in: refIds("b") } })
      .select("name acronym")
      .lean(),
    SchoolM.find({ _id: { $in: refIds("s") } })
      .select("name")
      .lean(),
    UniversityM.find({ _id: { $in: refIds("u") } })
      .select("name acronym")
      .lean(),
  ]);
  const nameMap = (docs: any[]) =>
    new Map<string, string>(
      docs.map((d) => [
        String(d._id),
        d.acronym ? `${d.name} (${d.acronym})` : d.name,
      ]),
    );
  const names = { b: nameMap(boards), s: nameMap(schools), u: nameMap(unis) };
  const types = { b: "board", s: "school", u: "university" } as const;

  const build = (src: "b" | "s" | "u"): QuestionAnalyticsExamSourceRow[] =>
    groups
      .filter((g) => g._id.src === src)
      .map((g) => ({
        sourceId: idStr(g._id.ref),
        sourceName: names[src].get(String(g._id.ref)) ?? "Unknown",
        sourceType: types[src],
        associationCount: g.total,
        uniqueQuestionCount: g.uniqueCount,
        latestExamYear: g.latestExamYear ?? null,
        availableYears: (g.years as Array<number | null>)
          .filter((y): y is number => y != null)
          .sort((a, b) => b - a),
        questionsAddedInPeriod: g.periodCount,
        latestQuestionCreatedAt: iso(g.latestCreatedAt),
      }))
      .sort((a, b) => b.uniqueQuestionCount - a.uniqueQuestionCount);

  return { boards: build("b"), schools: build("s"), universities: build("u") };
}

export async function getExamCoverage(
  req: QuestionAnalyticsExamCoverageRequest,
): Promise<QuestionAnalyticsExamCoverageResponse> {
  const filters = req.filters ?? {};
  const match = await buildMatch(filters);
  const [years, sources] = await Promise.all([
    getExamYears(filters, match),
    getExamSources(filters, match, getPeriods(filters)),
  ]);
  return { generatedAt: new Date().toISOString(), years, ...sources };
}

/* ================================================================== */
/* Quality                                                             */
/* ================================================================== */

async function getQualitySummary(
  match: Doc,
  matchers: Record<Issue, Doc>,
): Promise<QuestionAnalyticsQualitySummary> {
  const [total, withIssues, ...counts] = await Promise.all([
    Q.countDocuments(match),
    Q.countDocuments(and2(match, { $or: ALL_ISSUES.map((i) => matchers[i]) })),
    ...ALL_ISSUES.map((i) => Q.countDocuments(and2(match, matchers[i]))),
  ]);
  const issues = ALL_ISSUES.map((issue, i) => ({
    issue,
    label: ISSUE_LABELS[issue],
    count: counts[i] as number,
    percentage: pct(counts[i] as number, total),
  })).sort((a, b) => b.count - a.count);
  return {
    totalQuestions: total,
    questionsWithNoDetectedIssues: total - withIssues,
    questionsWithOneOrMoreIssues: withIssues,
    totalIssueOccurrences: issues.reduce((a, b) => a + b.count, 0),
    issues,
    possibleDuplicateQuestions:
      issues.find((i) => i.issue === "possible-duplicate")?.count ?? 0,
  };
}

const QUALITY_SORT = ["createdAt", "updatedAt", "refId", "type", "rating"];

function previewOf(q: any): string {
  const raw =
    q.question || q.context || q.questions?.[0]?.question || q.answer || "";
  const s = String(raw).replace(/\s+/g, " ").trim();
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

export async function getQualityReport(
  req: QuestionAnalyticsQualityRequest,
): Promise<QuestionAnalyticsQualityReport> {
  const filters = req.filters ?? {};
  const match = await buildMatch(filters);
  const matchers = await getIssueMatchers();
  const ctx = await getIssueContext();

  const wanted = (
    (req.issues?.length ? req.issues : ALL_ISSUES) as Issue[]
  ).filter((i) => matchers[i]);
  const query = and2(match, { $or: wanted.map((i) => matchers[i]) });

  const limit = Math.min(
    Math.max(Math.floor(req.pagination?.limit ?? 25), 1),
    200,
  );
  const page = Math.max(Math.floor(req.pagination?.page ?? 1), 1);
  const sortField = QUALITY_SORT.includes(req.sort?.field ?? "")
    ? req.sort!.field
    : "createdAt";
  const dir = req.sort?.direction === "asc" ? 1 : -1;

  const [summary, total, docs] = await Promise.all([
    getQualitySummary(match, matchers),
    Q.countDocuments(query),
    Q.find(query)
      .sort({ [sortField]: dir, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "refId type question context answer options correctMcq questions subject chapter topic boards schools universities createdAt updatedAt",
      )
      .lean(),
  ]);

  const items: QuestionAnalyticsQualityRow[] = (docs as any[]).map((q) => ({
    questionId: String(q._id),
    refId: q.refId ?? null,
    questionPreview: previewOf(q),
    type: q.type,
    subjectId: idStr(q.subject),
    chapterId: idStr(q.chapter),
    topicId: idStr(q.topic),
    issues: detectIssues(q, ctx),
    createdAt: iso(q.createdAt),
    updatedAt: iso(q.updatedAt),
  }));

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    summary,
    affectedQuestions: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  };
}

/* ================================================================== */
/* Dashboard                                                           */
/* ================================================================== */

const TOPIC_ROW_CAP = 300;

export async function getDashboard(
  req: QuestionAnalyticsDashboardRequest,
): Promise<QuestionAnalyticsDashboardResponse> {
  const filters = req.filters ?? {};
  const granularity = GRANULARITIES.includes(req.granularity as any)
    ? (req.granularity as QuestionAnalyticsGranularity)
    : "month";
  const periods = getPeriods(filters);
  const match = await buildMatch(filters);
  const [matchNoCreated, matchNoUpdated, matchers] = await Promise.all([
    buildMatch(filters, { omit: ["createdAt"] }),
    buildMatch(filters, { omit: ["updatedAt"] }),
    getIssueMatchers(),
  ]);

  const prev = previousPeriod(periods.created);
  const range = (f: string, p: { from: Date; to: Date }) => ({
    [f]: { $gte: p.from, $lte: p.to },
  });

  const [
    h,
    years,
    quality,
    additions,
    updates,
    byTypeRaw,
    byDifficultyRaw,
    byLevelRaw,
    withBoards,
    withSchools,
    withUnis,
    addedCount,
    prevCount,
    updatedCount,
    ratingAgg,
  ] = await Promise.all([
    computeHierarchy(match, periods, {
      class: true,
      subject: true,
      chapter: true,
      topic: true,
    }),
    getExamYears(filters, match),
    getQualitySummary(match, matchers),
    timeSeries(match, "createdAt", granularity),
    timeSeries(match, "updatedAt", granularity),
    distribution(match, "$type", 0),
    distribution(match, "$difficulty", 0),
    distribution(match, "$level", 0),
    Q.countDocuments(and2(match, { "boards.0": { $exists: true } })),
    Q.countDocuments(and2(match, { "schools.0": { $exists: true } })),
    Q.countDocuments(and2(match, { "universities.0": { $exists: true } })),
    Q.countDocuments(and2(matchNoCreated, range("createdAt", periods.created))),
    Q.countDocuments(and2(matchNoCreated, range("createdAt", prev))),
    Q.countDocuments(and2(matchNoUpdated, range("updatedAt", periods.updated))),
    Q.aggregate([
      { $match: and2(match, { rating: { $gt: 0 } }) },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]),
  ]);

  const sum = (k: string) =>
    h.subjectGroups.reduce((a, g) => a + (g[k] || 0), 0);
  const total = sum("total");
  const withAnswers = sum("withAnswers");
  const withoutTopic = sum("withoutTopic");

  // distributions were fetched before `total` was known — fill the percentages now
  const fixPct = <T extends QuestionAnalyticsDistributionItem>(
    items: T[],
  ): T[] => items.map((i) => ({ ...i, percentage: pct(i.count, total) }));

  const byType: QuestionAnalyticsTypeBreakdown[] = fixPct(byTypeRaw).map(
    (i) => ({
      id: i.id,
      type: i.type,
      label: i.label,
      count: i.count,
      percentage: i.percentage,
    }),
  );

  const dist = (
    rows: Array<{ id: string | null; label: string; count: number }>,
  ) =>
    rows.map((r) => ({
      id: r.id,
      label: r.label,
      count: r.count,
      percentage: pct(r.count, total),
    }));

  const summary: QuestionAnalyticsSummary = {
    totalQuestions: total,
    addedInPeriod: addedCount,
    updatedInPeriod: updatedCount,
    classesRepresented: h.classRows.filter((c) => c.classId).length,
    subjectsRepresented: h.subjectRows.filter((s) => s.subjectId).length,
    chaptersRepresented: h.chapterRows.filter((c) => c.chapterId).length,
    topicsRepresented: h.topicRows.filter((t) => t.topicId).length,
    questionsWithAnswers: withAnswers,
    questionsWithoutAnswers: total - withAnswers,
    questionsWithBoards: withBoards,
    questionsWithSchools: withSchools,
    questionsWithUniversities: withUnis,
    questionsWithTopic: total - withoutTopic,
    questionsWithoutTopic: withoutTopic,
    averageRating:
      ratingAgg[0]?.avg != null
        ? Math.round(ratingAgg[0].avg * 100) / 100
        : null,
    growth: {
      currentPeriodCount: addedCount,
      previousPeriodCount: prevCount,
      absoluteChange: addedCount - prevCount,
      percentageChange: prevCount
        ? Math.round(((addedCount - prevCount) / prevCount) * 1000) / 10
        : null,
    },
  };

  const byExamYear: QuestionAnalyticsYearBreakdown[] = years.map((y) => ({
    year: y.year,
    boardQuestionCount: y.boardCount,
    schoolQuestionCount: y.schoolCount,
    universityQuestionCount: y.universityCount,
    uniqueQuestionCount: y.uniqueQuestionCount,
  }));

  return {
    generatedAt: new Date().toISOString(),
    filters,
    summary,
    trends: {
      additionsOverTime: additions,
      updatesOverTime: updates,
      byClass: h.classRows.map((c) => ({
        id: c.classId,
        label: c.className,
        count: c.totalQuestions,
        percentage: pct(c.totalQuestions, total),
      })),
      bySubject: h.subjectRows.map((s) => ({
        id: s.subjectId,
        label: `${s.subjectName} (${s.className})`,
        count: s.totalQuestions,
        percentage: pct(s.totalQuestions, total),
      })),
      byQuestionType: byType,
      byExamYear,
      byDifficulty: dist(byDifficultyRaw),
      byLevel: dist(byLevelRaw),
    },
    byClass: h.classRows,
    bySubject: h.subjectRows,
    byChapter: h.chapterRows,
    byTopic: h.topicRows.slice(0, TOPIC_ROW_CAP),
    quality,
  };
}

/* ================================================================== */
/* Filter options (cascading facets)                                   */
/* ================================================================== */

export async function getFilterOptions(
  req: QuestionAnalyticsFilterOptionsRequest,
): Promise<QuestionAnalyticsFilterOptions> {
  const f = req.filters ?? {};
  const m = (k: OmitKey) => buildMatch(f, { omit: [k] });
  const without = (...keys: Array<keyof QuestionAnalyticsFilters>) => {
    const c: QuestionAnalyticsFilters = { ...f };
    for (const k of keys) delete c[k];
    return c;
  };
  const grp = (match: Doc, expr: string, limit = 1000): Promise<any[]> =>
    Q.aggregate([
      { $match: match },
      { $group: { _id: expr, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]) as any;
  const srcGroup = (
    match: Doc,
    filt: QuestionAnalyticsFilters,
    src: "b" | "s" | "u",
  ): Promise<any[]> =>
    Q.aggregate([
      { $match: match },
      ...entryStages(filt, src),
      { $group: { _id: "$entries.ref", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1000 },
    ]) as any;
  const nullable = (rows: any[]): QuestionAnalyticsOption[] =>
    rows.map((r) => ({
      id: r._id == null || r._id === "" ? NONE : String(r._id),
      name: r._id == null || r._id === "" ? "Unspecified" : String(r._id),
      count: r.count,
    }));

  const [
    mClass,
    mSubject,
    mChapter,
    mTopic,
    mType,
    mDiff,
    mLevel,
    mTag,
    mBoard,
    mSchool,
    mUni,
    mYear,
  ] = await Promise.all([
    m("classIds"),
    m("subjectIds"),
    m("chapterIds"),
    m("topicIds"),
    m("types"),
    m("difficulties"),
    m("levels"),
    m("tags"),
    m("boardIds"),
    m("schoolIds"),
    m("universityIds"),
    m("examYears"),
  ]);

  const [
    gClass,
    gSubject,
    gChapter,
    gTopic,
    gType,
    gDiff,
    gLevel,
    gTag,
    gBoard,
    gSchool,
    gUni,
    gYear,
    range,
  ] = await Promise.all([
    grp(mClass, "$subject"),
    grp(mSubject, "$subject"),
    grp(mChapter, "$chapter"),
    grp(mTopic, "$topic", 500),
    grp(mType, "$type"),
    grp(mDiff, "$difficulty"),
    grp(mLevel, "$level"),
    Q.aggregate([
      { $match: mTag },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
    ]) as Promise<any[]>,
    srcGroup(mBoard, without("boardIds"), "b"),
    srcGroup(mSchool, without("schoolIds"), "s"),
    srcGroup(mUni, without("universityIds"), "u"),
    Q.aggregate([
      { $match: mYear },
      ...entryStages(without("examYears", "minExamYear", "maxExamYear")),
      { $match: { "entries.year": { $ne: null } } },
      { $group: { _id: "$entries.year", ids: { $addToSet: "$_id" } } },
      { $project: { count: { $size: "$ids" } } },
      { $sort: { _id: -1 } },
    ]).allowDiskUse(true) as Promise<any[]>,
    Q.aggregate([
      {
        $group: {
          _id: null,
          cMin: { $min: "$createdAt" },
          cMax: { $max: "$createdAt" },
          uMin: { $min: "$updatedAt" },
          uMax: { $max: "$updatedAt" },
        },
      },
    ]) as Promise<any[]>,
  ]);

  const lk = await loadLookups({
    subjects: [...gClass, ...gSubject].map((g) => g._id),
    chapters: gChapter.map((g) => g._id),
    topics: gTopic.map((g) => g._id),
  });
  const ord = (d: any) => d?.order ?? 0;

  // classes (aggregate subject counts up to class)
  const classCounts = new Map<string, number>();
  for (const g of gClass) {
    const cid = lk.subjects.get(String(g._id))?.class;
    if (cid)
      classCounts.set(
        String(cid),
        (classCounts.get(String(cid)) ?? 0) + g.count,
      );
  }
  const classes = [...classCounts.entries()]
    .map(([id, count]) => ({
      id,
      name: lk.classes.get(id)?.name ?? "Unknown",
      count,
      o: ord(lk.classes.get(id)),
    }))
    .sort((a, b) => a.o - b.o)
    .map(({ o: _o, ...r }) => r);

  const subjects = gSubject
    .filter((g) => g._id)
    .map((g) => {
      const s = lk.subjects.get(String(g._id));
      const c = s ? lk.classes.get(String(s.class)) : undefined;
      return {
        id: String(g._id),
        name: `${s?.name ?? "Unknown"} (${c?.name ?? UNASSIGNED})`,
        count: g.count,
        k: [ord(c), ord(s)],
      };
    })
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1])
    .map(({ k: _k, ...r }) => r);

  const chapters = gChapter
    .filter((g) => g._id)
    .map((g) => {
      const ch = lk.chapters.get(String(g._id));
      const s = ch ? lk.subjects.get(String(ch.subject)) : undefined;
      const c = s ? lk.classes.get(String(s.class)) : undefined;
      return {
        id: String(g._id),
        name: `${ch?.name ?? "Unknown"} (${s?.name ?? UNASSIGNED}, ${c?.name ?? UNASSIGNED})`,
        count: g.count,
        k: [ord(c), ord(s), ord(ch)],
      };
    })
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2])
    .map(({ k: _k, ...r }) => r);

  const topics = gTopic
    .filter((g) => g._id)
    .map((g) => {
      const t = lk.topics.get(String(g._id));
      const ch = t ? lk.chapters.get(String(t.chapter)) : undefined;
      const s = ch ? lk.subjects.get(String(ch.subject)) : undefined;
      const c = s ? lk.classes.get(String(s.class)) : undefined;
      return {
        id: String(g._id),
        name: `${t?.name ?? "Unknown"} (${ch?.name ?? UNASSIGNED})`,
        count: g.count,
        k: [ord(c), ord(s), ord(ch), ord(t)],
      };
    })
    .sort(
      (a, b) =>
        a.k[0] - b.k[0] ||
        a.k[1] - b.k[1] ||
        a.k[2] - b.k[2] ||
        a.k[3] - b.k[3],
    )
    .map(({ k: _k, ...r }) => r);

  const named = async (
    rows: any[],
    M: any,
    withAcr: boolean,
  ): Promise<QuestionAnalyticsOption[]> => {
    const docs = await M.find({ _id: { $in: rows.map((r) => r._id) } })
      .select(withAcr ? "name acronym" : "name")
      .lean();
    const nm = new Map<string, string>(
      docs.map((d: any) => [
        String(d._id),
        d.acronym ? `${d.name} (${d.acronym})` : d.name,
      ]),
    );
    return rows.map((r) => ({
      id: String(r._id),
      name: nm.get(String(r._id)) ?? "Unknown",
      count: r.count,
    }));
  };
  const [boards, schools, universities] = await Promise.all([
    named(gBoard, BoardM, true),
    named(gSchool, SchoolM, false),
    named(gUni, UniversityM, true),
  ]);

  const r0 = range[0];
  const rangeOf = (min: any, max: any) => ({
    ...(min ? { from: new Date(min).toISOString() } : {}),
    ...(max ? { to: new Date(max).toISOString() } : {}),
  });

  return {
    classes,
    subjects,
    chapters,
    topics,
    types: gType.map((r) => ({
      id: String(r._id),
      name: String(r._id),
      count: r.count,
    })),
    boards,
    schools,
    universities,
    difficulties: nullable(gDiff),
    levels: nullable(gLevel),
    tags: gTag.map((r) => ({
      id: String(r._id),
      name: String(r._id),
      count: r.count,
    })),
    examYears: gYear.map((r) => ({
      year: r._id as number,
      questionCount: r.count as number,
    })),
    availableDateRange: {
      createdAt: rangeOf(r0?.cMin, r0?.cMax),
      updatedAt: rangeOf(r0?.uMin, r0?.uMax),
    },
  };
}

/* ================================================================== */
/* Breakdown (generic group-by table)                                  */
/* ================================================================== */

const BREAKDOWN_SORT = [
  "count",
  "label",
  "latestExamYear",
  "latestQuestionCreatedAt",
];

export async function getBreakdown(
  req: QuestionAnalyticsBreakdownRequest,
): Promise<QuestionAnalyticsBreakdownResponse> {
  const filters = req.filters ?? {};
  const periods = getPeriods(filters);
  const match = await buildMatch(filters);
  const total = await Q.countDocuments(match);
  const mk = (
    r: Omit<QuestionAnalyticsBreakdownRow, "percentage">,
  ): QuestionAnalyticsBreakdownRow => ({
    ...r,
    percentage: pct(r.count, total),
  });

  let rows: QuestionAnalyticsBreakdownRow[] = [];
  const g = req.groupBy;

  if (g === "class" || g === "subject" || g === "chapter" || g === "topic") {
    const h = await computeHierarchy(match, periods, { [g]: true });
    if (g === "class")
      rows = h.classRows.map((r) =>
        mk({
          key: r.classId,
          label: r.className,
          count: r.totalQuestions,
          typeCounts: r.typeCounts,
          latestExamYear: r.latestExamYear,
          latestQuestionCreatedAt: r.latestQuestionCreatedAt,
        }),
      );
    if (g === "subject")
      rows = h.subjectRows.map((r) =>
        mk({
          key: r.subjectId,
          label: r.subjectName,
          parentLabel: r.className,
          count: r.totalQuestions,
          typeCounts: r.typeCounts,
          latestExamYear: r.latestExamYear,
          latestQuestionCreatedAt: r.latestQuestionCreatedAt,
        }),
      );
    if (g === "chapter")
      rows = h.chapterRows.map((r) =>
        mk({
          key: r.chapterId,
          label: r.chapterName,
          parentLabel: `${r.className} › ${r.subjectName}`,
          count: r.totalQuestions,
          typeCounts: r.typeCounts,
          latestExamYear: r.latestExamYear,
          latestQuestionCreatedAt: r.latestQuestionCreatedAt,
        }),
      );
    if (g === "topic")
      rows = h.topicRows.map((r) =>
        mk({
          key: r.topicId,
          label: r.topicName,
          parentLabel: `${r.className} › ${r.subjectName} › ${r.chapterName}`,
          count: r.totalQuestions,
          typeCounts: r.typeCounts,
          latestExamYear: r.latestExamYear,
          latestQuestionCreatedAt: r.latestQuestionCreatedAt,
        }),
      );
  } else if (g === "board" || g === "school" || g === "university") {
    const s = await getExamSources(filters, match, periods);
    const list =
      g === "board" ? s.boards : g === "school" ? s.schools : s.universities;
    rows = list.map((r) =>
      mk({
        key: r.sourceId,
        label: r.sourceName,
        count: r.uniqueQuestionCount,
        typeCounts: {},
        latestExamYear: r.latestExamYear,
        latestQuestionCreatedAt: r.latestQuestionCreatedAt,
      }),
    );
  } else if (g === "examYear") {
    const years = await getExamYears(filters, match);
    rows = years.map((y) =>
      mk({
        key: y.year,
        label: String(y.year),
        count: y.uniqueQuestionCount,
        typeCounts: y.typeCounts,
        latestExamYear: y.year,
        latestQuestionCreatedAt: null,
      }),
    );
  } else {
    const pre: any[] = [];
    let id: any;
    if (g === "type") id = "$type";
    else if (g === "difficulty") id = "$difficulty";
    else if (g === "level") id = "$level";
    else if (g === "tag") {
      pre.push({
        $unwind: { path: "$tags", preserveNullAndEmptyArrays: true },
      });
      id = "$tags";
    } else {
      // createdAt / updatedAt -> month buckets
      id = { $dateToString: { format: "%Y-%m", date: `$${g}`, timezone: TZ } };
    }
    const groups: any[] = await Q.aggregate([
      { $match: match },
      ...pre,
      ...groupStages({ id, periods }),
    ]).allowDiskUse(true);
    rows = groups.map((r) => {
      const key = r._id == null || r._id === "" ? null : (r._id as string);
      return mk({
        key,
        label: key ?? "Unspecified",
        count: r.total,
        typeCounts: r.typeCounts ?? {},
        latestExamYear: r.latestExamYear ?? null,
        latestQuestionCreatedAt: iso(r.latestCreatedAt),
      });
    });
  }

  const field = BREAKDOWN_SORT.includes(req.sort?.field ?? "")
    ? req.sort!.field
    : "count";
  const dir = req.sort?.direction === "asc" ? 1 : -1;
  rows.sort((a: any, b: any) => {
    const av = field === "label" ? a.label : a[field];
    const bv = field === "label" ? b.label : b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last regardless of direction
    if (bv == null) return -1;
    return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
  });

  return {
    ...paginate(rows, req.pagination),
    groupBy: g,
    totalQuestions: total,
  };
}
