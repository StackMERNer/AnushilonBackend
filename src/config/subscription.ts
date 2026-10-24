export const PLAN_FEATURES = {
  FREE: {
    explanations: false,
    weeklyLeaderboard: false,
    maxExamsPerDay: 3,
  },
  BASIC: {
    explanations: true,
    weeklyLeaderboard: true,
    maxExamsPerDay: 10,
  },
  PRO: {
    explanations: true,
    weeklyLeaderboard: true,
    maxExamsPerDay: Infinity,
  },
} as const;
