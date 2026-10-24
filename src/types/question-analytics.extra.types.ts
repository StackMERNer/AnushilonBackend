// Additions to your question-analytics.types.ts (keep your file as-is, put this beside it).
import type {
  QuestionAnalyticsExamSourceRow,
  QuestionAnalyticsExamYearCoverageRow,
  QuestionAnalyticsFilters,
  QuestionAnalyticsGroupBy,
  QuestionAnalyticsPaginatedResult,
  QuestionAnalyticsTypeCounts,
} from "./question-analytics.ts";

export interface QuestionAnalyticsBreakdownRow {
  key: string | number | null;
  label: string;
  /** e.g. class name for a subject, "class › subject" for a chapter */
  parentLabel?: string;
  count: number;
  /** share of all questions matching the filters (can exceed 100 in total for tags/sources) */
  percentage: number;
  typeCounts: QuestionAnalyticsTypeCounts;
  latestExamYear: number | null;
  latestQuestionCreatedAt: string | null;
}

export interface QuestionAnalyticsBreakdownResponse extends QuestionAnalyticsPaginatedResult<QuestionAnalyticsBreakdownRow> {
  groupBy: QuestionAnalyticsGroupBy;
  totalQuestions: number;
}

export interface QuestionAnalyticsExamCoverageRequest {
  filters?: QuestionAnalyticsFilters;
}

export interface QuestionAnalyticsExamCoverageResponse {
  generatedAt: string;
  boards: QuestionAnalyticsExamSourceRow[];
  schools: QuestionAnalyticsExamSourceRow[];
  universities: QuestionAnalyticsExamSourceRow[];
  years: QuestionAnalyticsExamYearCoverageRow[];
}
