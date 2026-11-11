export const REPORT_REASONS = [
  "spelling",
  "wrong_question",
  "wrong_answer",
  "wrong_explanation",
  "display_issue",
  "wrong_chapter",
  "duplicate",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
