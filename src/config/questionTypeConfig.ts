export type StudyMode = "auto" | "self" | "none";

// Display-only content, nothing to answer. Please confirm this list.
export const PASSAGE_TYPES = [
  "ssc_seen_passage_1st",
  "seen_passage_1st",
  "seen_passage_2nd",
  "ssc_unseen_passage",
  "unseen_passage",
];

// Auto-rated only if the doc also has options and correctMcq.
export const AUTO_TYPES = ["mcq", "mcq_english"];

export function deriveStudyMode(q: {
  type: string;
  options?: string[];
  correctMcq?: number | null;
}): StudyMode {
  if (PASSAGE_TYPES.includes(q.type)) return "none";
  if (AUTO_TYPES.includes(q.type) && q.options?.length && q.correctMcq != null)
    return "auto";
  return "self";
}
