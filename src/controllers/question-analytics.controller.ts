// question-analytics.controller.ts
import type { Request, Response } from "express";
import {
  getBreakdown,
  getDashboard,
  getExamCoverage,
  getFilterOptions,
  getQualityReport,
} from "../services/pdf/question-analytics.service";

const wrap =
  (fn: (body: any) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      const data = await fn(req.body ?? {});
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("[question-analytics]", err);
      res.status(500).json({
        success: false,
        data: null,
        message: err?.message ?? "Failed to compute question analytics",
      });
    }
  };

export const dashboardController = wrap(getDashboard);
export const filterOptionsController = wrap(getFilterOptions);
export const breakdownController = wrap((b) => {
  if (!b?.groupBy) throw new Error("groupBy is required");
  return getBreakdown(b);
});
export const qualityController = wrap(getQualityReport);
export const examCoverageController = wrap(getExamCoverage);
