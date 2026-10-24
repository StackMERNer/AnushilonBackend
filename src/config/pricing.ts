import { PlanType } from "../types/payment";

export const PLAN_DURATION_DAYS: { [key in PlanType]: number } = {
  monthly: 30,
  six_month: 180,
  yearly: 365,
  subject_yearly: 365,
};
