import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { QuestionModel } from "../models/question.model"; // Adjust path as needed
import { IQuestionPaper, QuestionPaper } from "../models/question-paper.model";
import {
  hasActiveSubscription,
  hasAllSubjectsActiveSubscription,
} from "../lib/subscription";
import { IUser } from "../models/User";

// Interface representing the expected query parameters
export interface FilteredQuestionsQueryParams {
  page?: string;
  limit?: string;
  subject?: string;
  chapter?: string;
  topics?: string; // Comma-separated string of IDs
  paper?: string;
  boards?: string; // Comma-separated string of IDs
  schools?: string; // Comma-separated string of IDs
  universities?: string; // Comma-separated string of IDs
  questionType?: string;
  year?: string;
  selectedOnly?: string;
}

/**
 * Controller to fetch filtered questions with pagination
 * GET /questions/filtered
 */
export const getFilteredQuestions = async (
  req: Request<{}, {}, {}, FilteredQuestionsQueryParams>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      page: reqPage = "1",
      limit: reqLimit = "20",
      subject,
      chapter,
      topics,
      paper,
      boards,
      schools,
      universities,
      questionType,
      year,
      selectedOnly,
    } = req.query;

    let page = Math.max(1, parseInt(reqPage, 10) || 1);
    let limit = Math.max(1, parseInt(reqLimit, 10) || 20);

    let query: Record<string, unknown> = {};

    if (!paper) {
      res.status(400).json({ message: "একটি প্রশ্নপত্র নির্বাচন করুন" });
      return;
    }
    const authUser = (req as any).user;

    const questionPaper: IQuestionPaper | null = (await QuestionPaper.findOne({
      _id: new Types.ObjectId(paper),
      createdBy: authUser?._id,
    }).lean()) as any as IQuestionPaper;

    if (!questionPaper) {
      res.status(400).json({ message: "প্রশ্নপত্রটি পাওয়া যায় নি।" });
      return;
    }
    const selectedQuestions = questionPaper.sections
      .map((section) =>
        section.items
          .filter((item) => item.type === "question")
          .map((item) => item.question),
      )
      .flat()
      .filter(Boolean);

    // return if there's no subject selected
    if (!subject) {
      res.status(400).json({ message: "একটি বিষয় নির্বাচন করুন" });
      return;
    }

    const isSubjectInPaper = (questionPaper as IQuestionPaper).subjects.some(
      (paperSubject) => paperSubject.subject.toString() === subject,
    );

    if (!isSubjectInPaper) {
      res.status(400).json({
        message: "এই বিষয়টি প্রশ্নপত্রে নির্বাচিত নেই।",
      });
      return;
    }

    const hasSubscription =
      hasActiveSubscription(authUser as IUser) ||
      hasAllSubjectsActiveSubscription(authUser, [subject]);

    // 1. Single Foreign Key Filters
    if (subject) {
      query.subject = new Types.ObjectId(subject);
    }

    if (chapter) {
      query.chapter = new Types.ObjectId(chapter);
    }

    if (questionType) {
      query.type = questionType;
    }

    // 2. Multi-ID Filters (Comma-separated string to ObjectId array)
    if (topics) {
      const topicIds = topics
        .split(",")
        .filter(Boolean)
        .map((id) => new Types.ObjectId(id.trim()));

      if (topicIds.length) {
        query.topic = { $in: topicIds };
      }
    }

    if (boards || year) {
      const boardFilter: Record<string, unknown> = {};

      if (boards) {
        const boardIds = boards
          .split(",")
          .filter(Boolean)
          .map((id) => new Types.ObjectId(id.trim()));

        if (boardIds.length) {
          boardFilter.board = { $in: boardIds };
        }
      }

      if (year) {
        const parsedYear = parseInt(year, 10);

        if (!Number.isNaN(parsedYear)) {
          boardFilter.year = parsedYear;
        }
      }

      if (Object.keys(boardFilter).length > 0) {
        query.boards = {
          $elemMatch: boardFilter,
        };
      }
    }

    if (schools) {
      const schoolIds = schools
        .split(",")
        .filter(Boolean)
        .map((id) => new Types.ObjectId(id.trim()));

      if (schoolIds.length) {
        query.schools = {
          $elemMatch: { school: { $in: schoolIds } },
        };
      }
    }

    if (universities) {
      const universityIds = universities
        .split(",")
        .filter(Boolean)
        .map((id) => new Types.ObjectId(id.trim()));

      if (universityIds.length) {
        query.universities = {
          $elemMatch: { university: { $in: universityIds } },
        };
      }
    }

    if (!hasSubscription) {
      page = 1; // limit to 1 page for free users
      limit = Math.min(limit, 20);
    }

    if (selectedOnly === "true") {
      query = {
        _id: { $in: selectedQuestions },
      };
    }
    // 4. Pagination Calculation
    const skip = (page - 1) * limit;
    // 5. Database Execution
    const [items, totalItems] = await Promise.all([
      QuestionModel.find(query)
        .select(
          "type context question options questions level difficulty answer correctMcq schools, boards",
        )
        .populate("schools.school", "name")
        .populate("boards.board", "name acronym year")
        .sort({ createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuestionModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;
    const nextPage = page < totalPages ? page + 1 : null;

    // 6. Response matching the PaginatedResponse<T> contract
    res.status(200).json({
      items,
      totalItems,
      currentPage: page,
      totalPages,
      nextPage,
      limit,
    });
  } catch (error) {
    next(error);
  }
};
