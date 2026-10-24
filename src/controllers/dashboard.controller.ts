// controllers/dashboard.controller.ts

import { Request, Response, NextFunction } from "express";
import { QuestionPaper } from "../models/question-paper.model";

export const getDashboardData = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as any).user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const now = new Date();

    // First day of current month
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // First day of next month
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // First day of previous month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalPapers, thisMonthPapers, lastMonthPapers, recentPapers] =
      await Promise.all([
        // Total papers created by this user
        QuestionPaper.countDocuments({
          createdBy: userId,
        }),

        // Papers created this month
        QuestionPaper.countDocuments({
          createdBy: userId,
          createdAt: {
            $gte: startOfThisMonth,
            $lt: startOfNextMonth,
          },
        }),

        // Papers created last month
        QuestionPaper.countDocuments({
          createdBy: userId,
          createdAt: {
            $gte: startOfLastMonth,
            $lt: startOfThisMonth,
          },
        }),

        // Recent papers
        QuestionPaper.find({
          createdBy: userId,
        })
          .select(
            "title class subjects totalMarks duration createdAt updatedAt",
          )
          .populate("class", "name")
          .populate("subjects.subject", "name")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

    res.status(200).json({
      success: true,
      data: {
        totalPapers,
        thisMonthPapers,
        lastMonthPapers,
        recentPapers,
      },
    });
  } catch (error) {
    next(error);
  }
};
