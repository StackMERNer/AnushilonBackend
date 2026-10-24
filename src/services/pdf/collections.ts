import { IQuestionDocument } from "../../models/question.model";
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
/**
 * The question types we currently have defined collection rules for.
 * Anything else (a type string that isn't one of these) falls back to
 * a single "all questions" collection — see FALLBACK_COLLECTION below.
 */
export type KnownQuestionType = "mcq" | "cq" | "short";

export const QUESTION_TYPE_LABELS: Record<KnownQuestionType, string> = {
  mcq: "বহুনির্বাচনি প্রশ্ন",
  cq: "সৃজনশীল প্রশ্ন",
  short: "সংক্ষিপ্ত প্রশ্ন",
};

/**
 * Returns the directory folder name for a given question type.
 */
export function getTypeFolderName(type: string): string {
  return QUESTION_TYPE_LABELS[type as KnownQuestionType] ?? type;
}

/**
 * Returns a display label for any type string — a known label if we
 * have one, otherwise the raw type string itself (so an unanticipated
 * type like "practical" still renders something sensible).
 */
export function getTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS[type as KnownQuestionType] ?? type;
}

export interface CollectionDefinition {
  /** Stable identifier — used in filenames. */
  key: string;
  /** Bengali label shown in the PDF header. */
  label: string;
  /** A question belongs in this collection when this returns true. */
  filter: (question: IQuestionDocument) => boolean;
}

const hasBoardOrSchoolRelevance = (question: IQuestionDocument): boolean =>
  Boolean(question.boards?.length) || Boolean(question.schools?.length);

/**
 * MVP collection rules per known type.
 *
 * "all" always wins the everything-included case. "board-school" is a
 * first pass at "important" filtering — anything with at least one
 * board or school reference attached. This is intentionally coarse;
 * once real importance/priority scoring exists (Top 300, Super
 * Suggestion, Model Test, etc.) those become additional entries here
 * without touching the generation pipeline itself.
 */
const DEFAULT_COLLECTIONS: Record<KnownQuestionType, CollectionDefinition[]> = {
  mcq: [
    { key: "all", label: "সকল MCQ", filter: () => true },
    {
      key: "board-school",
      label: "বোর্ড ও স্কুল গুরুত্বপূর্ণ MCQ",
      filter: hasBoardOrSchoolRelevance,
    },
  ],
  cq: [
    { key: "all", label: "সকল সৃজনশীল প্রশ্ন (CQ)", filter: () => true },
    {
      key: "board-school",
      label: "বোর্ড ও স্কুল গুরুত্বপূর্ণ সৃজনশীল প্রশ্ন (CQ)",
      filter: hasBoardOrSchoolRelevance,
    },
  ],
  short: [
    { key: "all", label: "সকল সংক্ষিপ্ত প্রশ্ন", filter: () => true },
    {
      key: "board-school",
      label: "বোর্ড ও স্কুল গুরুত্বপূর্ণ সংক্ষিপ্ত প্রশ্ন",
      filter: hasBoardOrSchoolRelevance,
    },
  ],
};

const FALLBACK_COLLECTION: CollectionDefinition = {
  key: "all",
  label: "সকল প্রশ্ন",
  filter: () => true,
};

/**
 * Returns the collections to generate for a given type string. Known
 * types (mcq/cq/short) get their defined rule set; anything else gets
 * a single fallback "all questions" collection, per spec.
 */
export function getCollectionDefinitions(type: string): CollectionDefinition[] {
  if (type in DEFAULT_COLLECTIONS) {
    return DEFAULT_COLLECTIONS[type as KnownQuestionType];
  }

  return [FALLBACK_COLLECTION];
}
