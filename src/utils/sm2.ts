export type Rating = 1 | 2 | 3 | 4;

export interface SchedulableCard {
  interval: number; // days
  ease: number;
  reps: number;
  lapses: number;
}

export interface ScheduleResult extends SchedulableCard {
  state: "learning" | "review";
  dueAt: Date;
}

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN_DELAY_MS = 10 * 60 * 1000; // come back in 10 minutes

export const MASTERED_DAYS = 21;

export function schedule(
  card: SchedulableCard,
  rating: Rating,
  now = new Date(),
): ScheduleResult {
  let { interval, ease, reps, lapses } = card;

  // Forgotten: reset, shown again shortly
  if (rating === 1) {
    return {
      state: "learning",
      interval: 0,
      ease: Math.max(MIN_EASE, ease - 0.2),
      reps: 0,
      lapses: reps > 0 ? lapses + 1 : lapses,
      dueAt: new Date(now.getTime() + AGAIN_DELAY_MS),
    };
  }

  let next: number;
  if (reps === 0) {
    next = rating === 2 ? 1 : rating === 3 ? 1 : 3;
  } else if (reps === 1) {
    next = rating === 2 ? 3 : rating === 3 ? 6 : 8;
  } else {
    const base = Math.max(interval, 1);
    next =
      rating === 2
        ? base * 1.2
        : rating === 3
          ? base * ease
          : base * ease * 1.3;
  }
  next = Math.max(1, Math.round(next));
  // Good/Easy must always move the card forward
  if (rating >= 3 && reps >= 2) next = Math.max(next, interval + 1);

  const easeDelta = rating === 2 ? -0.15 : rating === 4 ? 0.15 : 0;

  return {
    state: "review",
    interval: next,
    ease: Math.max(MIN_EASE, ease + easeDelta),
    reps: reps + 1,
    lapses,
    dueAt: new Date(now.getTime() + next * DAY_MS),
  };
}
