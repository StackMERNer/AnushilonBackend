/* =========================================================
   COMMON TYPES
========================================================= */

export type AnalyticsId = string;

export type QuestionAnalyticsGranularity = "day" | "week" | "month" | "year";

export type QuestionAnalyticsDateField = "createdAt" | "updatedAt";

export type QuestionAnalyticsSortDirection = "asc" | "desc";

export type QuestionAnalyticsGroupBy =
  | "class"
  | "subject"
  | "chapter"
  | "topic"
  | "type"
  | "board"
  | "school"
  | "university"
  | "examYear"
  | "difficulty"
  | "level"
  | "tag"
  | "createdAt"
  | "updatedAt";

export type QuestionAnalyticsDataQualityIssue =
  | "missing-question"
  | "missing-subject"
  | "missing-chapter"
  | "missing-topic"
  | "missing-answer"
  | "missing-mcq-options"
  | "invalid-mcq-answer-index"
  | "missing-board-year"
  | "missing-school-year"
  | "missing-university-year"
  | "missing-ref-id"
  | "possible-duplicate"
  | "orphaned-subject"
  | "orphaned-chapter"
  | "orphaned-topic";

export interface QuestionAnalyticsDateRange {
  from?: string;
  to?: string;
}

/* =========================================================
   UNIVERSAL FILTERS
========================================================= */

export interface QuestionAnalyticsFilters {
  classIds?: AnalyticsId[];
  subjectIds?: AnalyticsId[];
  chapterIds?: AnalyticsId[];
  topicIds?: AnalyticsId[];

  types?: string[];

  boardIds?: AnalyticsId[];
  schoolIds?: AnalyticsId[];
  universityIds?: AnalyticsId[];

  // Exam years from boards, schools, and universities.
  examYears?: number[];
  minExamYear?: number;
  maxExamYear?: number;

  // Database timestamps, not examination years.
  createdAt?: QuestionAnalyticsDateRange;
  updatedAt?: QuestionAnalyticsDateRange;

  difficulties?: string[];
  levels?: string[];
  tags?: string[];

  minRating?: number;
  maxRating?: number;

  hasAnswer?: boolean;
  hasContext?: boolean;
  hasOptions?: boolean;
  hasBoards?: boolean;
  hasSchools?: boolean;
  hasUniversities?: boolean;
  hasTopic?: boolean;

  dataQuality?: QuestionAnalyticsDataQualityIssue[];
}

export interface QuestionAnalyticsOption {
  id: AnalyticsId;
  name: string;
  count?: number;
}

export interface QuestionAnalyticsYearOption {
  year: number;
  questionCount: number;
}

export interface QuestionAnalyticsFilterOptions {
  classes: QuestionAnalyticsOption[];
  subjects: QuestionAnalyticsOption[];
  chapters: QuestionAnalyticsOption[];
  topics: QuestionAnalyticsOption[];

  types: QuestionAnalyticsOption[];

  boards: QuestionAnalyticsOption[];
  schools: QuestionAnalyticsOption[];
  universities: QuestionAnalyticsOption[];

  difficulties: QuestionAnalyticsOption[];
  levels: QuestionAnalyticsOption[];
  tags: QuestionAnalyticsOption[];

  examYears: QuestionAnalyticsYearOption[];

  availableDateRange: {
    createdAt: QuestionAnalyticsDateRange;
    updatedAt: QuestionAnalyticsDateRange;
  };
}

export interface QuestionAnalyticsPagination {
  page: number;
  limit: number;
}

export interface QuestionAnalyticsSort {
  field: string;
  direction: QuestionAnalyticsSortDirection;
}

export interface QuestionAnalyticsPaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface QuestionAnalyticsDistributionItem {
  id: string | null;
  label: string;
  count: number;
  percentage: number;
}

export interface QuestionAnalyticsTypeBreakdown extends QuestionAnalyticsDistributionItem {
  type: string | null;
}

export type QuestionAnalyticsTypeCounts = Record<string, number>;

export interface QuestionAnalyticsSummary {
  // Every document in the filtered dataset.
  totalQuestions: number;

  // Number of documents created in the selected date range.
  addedInPeriod: number;

  // Number of documents updated in the selected date range.
  updatedInPeriod: number;

  // Distinct entities represented by matching questions.
  classesRepresented: number;
  subjectsRepresented: number;
  chaptersRepresented: number;
  topicsRepresented: number;

  // Question metadata completeness.
  questionsWithAnswers: number;
  questionsWithoutAnswers: number;

  questionsWithBoards: number;
  questionsWithSchools: number;
  questionsWithUniversities: number;

  questionsWithTopic: number;
  questionsWithoutTopic: number;

  averageRating: number | null;

  growth: {
    currentPeriodCount: number;
    previousPeriodCount: number;
    absoluteChange: number;
    percentageChange: number | null;
  };
}

export interface QuestionAnalyticsTimePoint {
  date: string;
  count: number;
}

export interface QuestionAnalyticsTimeSeries {
  granularity: QuestionAnalyticsGranularity;
  dateField: QuestionAnalyticsDateField;
  points: QuestionAnalyticsTimePoint[];
}

export interface QuestionAnalyticsYearBreakdown {
  year: number;
  boardQuestionCount: number;
  schoolQuestionCount: number;
  universityQuestionCount: number;

  // Distinct question documents associated with this year.
  uniqueQuestionCount: number;
}

export interface QuestionAnalyticsTrends {
  additionsOverTime: QuestionAnalyticsTimeSeries;
  updatesOverTime: QuestionAnalyticsTimeSeries;

  byClass: QuestionAnalyticsDistributionItem[];
  bySubject: QuestionAnalyticsDistributionItem[];
  byQuestionType: QuestionAnalyticsTypeBreakdown[];

  byExamYear: QuestionAnalyticsYearBreakdown[];
  byDifficulty: QuestionAnalyticsDistributionItem[];
  byLevel: QuestionAnalyticsDistributionItem[];
}

export interface QuestionAnalyticsClassRow {
  classId: AnalyticsId | null;
  className: string;

  totalQuestions: number;
  typeCounts: QuestionAnalyticsTypeCounts;

  subjectCount: number;
  chapterCount: number;
  latestExamYear: number | null;
  latestQuestionCreatedAt: string | null;
}

export interface QuestionAnalyticsSubjectRow {
  subjectId: AnalyticsId | null;
  subjectName: string;

  classId: AnalyticsId | null;
  className: string;

  totalQuestions: number;
  typeCounts: QuestionAnalyticsTypeCounts;

  chapterCount: number;
  topicCount: number;
  latestExamYear: number | null;
  latestQuestionCreatedAt: string | null;
}

export interface QuestionAnalyticsChapterRow {
  chapterId: AnalyticsId | null;
  chapterName: string;

  subjectId: AnalyticsId | null;
  subjectName: string;

  classId: AnalyticsId | null;
  className: string;

  totalQuestions: number;
  typeCounts: QuestionAnalyticsTypeCounts;

  topicCount: number;
  latestExamYear: number | null;
  latestQuestionCreatedAt: string | null;

  questionsAddedInPeriod: number;
  questionsUpdatedInPeriod: number;

  questionsWithAnswers: number;
  questionsWithoutAnswers: number;
  questionsWithoutTopic: number;
}

export interface QuestionAnalyticsTopicRow {
  topicId: AnalyticsId | null;
  topicName: string;

  chapterId: AnalyticsId | null;
  chapterName: string;

  subjectId: AnalyticsId | null;
  subjectName: string;

  classId: AnalyticsId | null;
  className: string;

  totalQuestions: number;
  typeCounts: QuestionAnalyticsTypeCounts;

  latestExamYear: number | null;
  latestQuestionCreatedAt: string | null;
}

export interface QuestionAnalyticsExamSourceRow {
  sourceId: AnalyticsId | null;
  sourceName: string;

  sourceType: "board" | "school" | "university";

  associationCount: number;
  uniqueQuestionCount: number;

  latestExamYear: number | null;
  availableYears: number[];

  questionsAddedInPeriod: number;
  latestQuestionCreatedAt: string | null;
}

export interface QuestionAnalyticsExamYearCoverageRow {
  year: number;

  boardCount: number;
  schoolCount: number;
  universityCount: number;

  uniqueQuestionCount: number;
  typeCounts: QuestionAnalyticsTypeCounts;
}

export interface QuestionAnalyticsQualityIssueSummary {
  issue: QuestionAnalyticsDataQualityIssue;
  label: string;
  count: number;
  percentage: number;
}

export interface QuestionAnalyticsQualitySummary {
  totalQuestions: number;

  questionsWithNoDetectedIssues: number;
  questionsWithOneOrMoreIssues: number;

  totalIssueOccurrences: number;
  issues: QuestionAnalyticsQualityIssueSummary[];

  // Potential duplicate detection is heuristic.
  possibleDuplicateQuestions: number;
}

export interface QuestionAnalyticsQualityRow {
  questionId: AnalyticsId;
  refId: string | null;

  questionPreview: string;
  type: string;

  subjectId: AnalyticsId | null;
  chapterId: AnalyticsId | null;
  topicId: AnalyticsId | null;

  issues: QuestionAnalyticsDataQualityIssue[];

  createdAt: string | null;
  updatedAt: string | null;
}

export interface QuestionAnalyticsQualityReport {
  summary: QuestionAnalyticsQualitySummary;

  affectedQuestions: QuestionAnalyticsPaginatedResult<QuestionAnalyticsQualityRow>;
}

export interface QuestionAnalyticsDashboardResponse {
  generatedAt: string;

  filters: QuestionAnalyticsFilters;

  summary: QuestionAnalyticsSummary;
  trends: QuestionAnalyticsTrends;

  byClass: QuestionAnalyticsClassRow[];
  bySubject: QuestionAnalyticsSubjectRow[];
  byChapter: QuestionAnalyticsChapterRow[];
  byTopic: QuestionAnalyticsTopicRow[];

  quality: QuestionAnalyticsQualitySummary;
}

export interface QuestionAnalyticsDashboardRequest {
  filters?: QuestionAnalyticsFilters;

  granularity?: QuestionAnalyticsGranularity;

  dateField?: QuestionAnalyticsDateField;
}

export interface QuestionAnalyticsFilterOptionsRequest {
  filters?: QuestionAnalyticsFilters;
}

export interface QuestionAnalyticsBreakdownRequest {
  filters?: QuestionAnalyticsFilters;

  groupBy: QuestionAnalyticsGroupBy;

  pagination?: QuestionAnalyticsPagination;
  sort?: QuestionAnalyticsSort;
}

export interface QuestionAnalyticsQualityRequest {
  filters?: QuestionAnalyticsFilters;

  issues?: QuestionAnalyticsDataQualityIssue[];

  pagination?: QuestionAnalyticsPagination;
  sort?: QuestionAnalyticsSort;
}

export interface QuestionAnalyticsApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
