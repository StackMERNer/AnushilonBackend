import { NextFunction, Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import {
  hasActiveSubscription,
  hasAllSubjectsActiveSubscription,
} from "../lib/subscription";
import { IQuestionPaper, QuestionPaper } from "../models/question-paper.model";
import { IQuestion, QuestionModel } from "../models/question.model";
import { IUser } from "../models/User";
import { FREE_QUESTION_PAPER_COUNT } from "../utils/constants";
import { toBengaliNumber } from "../services/pdf/utils";

// GET /question-papers?page=1&limit=10
export const getPaginatedPapers = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);

    const limit = 10;
    const skip = (page - 1) * limit;
    const authUser = (req as any).user as IUser;

    const {
      class: classId,
      subject: subjectId,
      chapter: chapterId,
    } = req.query;

    const filterQuery: Record<string, unknown> = {
      createdBy: authUser._id,
    };
    // Class
    if (typeof classId === "string" && Types.ObjectId.isValid(classId)) {
      filterQuery.class = new Types.ObjectId(classId);
    }

    // Subject + Chapter
    if (typeof subjectId === "string" && Types.ObjectId.isValid(subjectId)) {
      const subjectChapterFilter: Record<string, unknown> = {
        subject: new Types.ObjectId(subjectId),
      };

      if (typeof chapterId === "string" && Types.ObjectId.isValid(chapterId)) {
        subjectChapterFilter.chapters = new Types.ObjectId(chapterId);
      }

      filterQuery.subjects = {
        $elemMatch: subjectChapterFilter,
      };
    }

    const [papers, total] = await Promise.all([
      QuestionPaper.find(filterQuery)
        .populate("class")
        .populate("subjects.subject")
        .populate("subjects.chapters")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      QuestionPaper.countDocuments(filterQuery),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const paginatedResponse = {
      items: papers,
      totalItems: total,
      currentPage: page,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      limit,
    };

    return res.status(200).json(paginatedResponse);
  } catch (error) {
    console.error("Failed to fetch question papers:", error);

    return res.status(500).json({
      message: "Failed to fetch question papers",
      error,
    });
  }
};

// GET /question-papers/:id
export const getPaperById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id as string)) {
      return res.status(400).json({
        message: "Invalid question paper ID",
      });
    }

    const userId = (req as any).user?.id;
    const paper = await QuestionPaper.findOne({ _id: id, createdBy: userId })
      .populate({
        path: "class",
        select: "name",
      })
      .populate({
        path: "subjects.subject",
        select: "name subjectCode",
      })
      .populate({
        path: "subjects.chapters",
        select: "name",
      })
      .populate({
        path: "sections.items.question",
        select:
          "type context question questions answer options correctMcq boards schools sameContextQuesId difficulty",
        populate: [
          {
            path: "boards.board",
            model: "Board",
            select: "name acronym",
          },
          {
            path: "schools.school",
            model: "School",
            select: "name acronym", // adjust fields as needed
          },
        ],
      })
      .lean();

    if (!paper) {
      return res.status(404).json({
        message: "Question paper not found",
      });
    }

    return res.status(200).json(paper);
  } catch (error) {
    console.error("Failed to fetch question paper:", error);

    return res.status(500).json({
      message: "Failed to fetch question paper",
      error,
    });
  }
};

// POST /question-papers
export const createPaper = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as IUser;
    const userId = authUser?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Need to sign in first",
      });
    }

    const hasGlobalSubscription = hasActiveSubscription(authUser);

    const payload: Partial<IQuestionPaper> = req.body;
    const selectedSubjectIds =
      payload.subjects?.map((s: any) => s.subject) || [];

    const hasEverPurchasedSubjectSubscription =
      (authUser.subjectWiseSubscription?.length ?? 0) > 0;

    const hasAllSelectedSubjectsSubscription = hasAllSubjectsActiveSubscription(
      authUser,
      selectedSubjectIds,
    );

    if (!hasGlobalSubscription && hasEverPurchasedSubjectSubscription) {
      // Subject-subscription user.
      // They cannot use the free trial.
      if (!hasAllSelectedSubjectsSubscription) {
        return res.status(403).json({
          message: "নির্বাচিত সবগুলো বিষয়ের সাবস্ক্রিপশন নেই।",
        });
      }
    } else if (!hasGlobalSubscription && !hasEverPurchasedSubjectSubscription) {
      // Completely unsubscribed user → free trial.
      const userPapersCount = await QuestionPaper.countDocuments({
        createdBy: userId,
      });

      if (userPapersCount >= FREE_QUESTION_PAPER_COUNT) {
        return res.status(403).json({
          message: `আপনি ফ্রিতে ${toBengaliNumber(
            FREE_QUESTION_PAPER_COUNT,
          )} টি প্রশ্নপত্র তৈরী করেছেন। আরও প্রশ্নপত্র তৈরী করতে সাবস্ক্রাইব করুন।`,
        });
      }

      if ((payload.subjects?.length ?? 0) > 1) {
        return res.status(403).json({
          message:
            "আপনি ফ্রিতে প্রশ্নপত্র তৈরীর সময় সর্বোচ্চ ১ টি বিষয় নির্বাচন করতে পারবেন।",
        });
      }
    }

    const paperData = {
      title: payload.title,
      class: payload.class,
      subjects: payload.subjects,
      totalMarks: payload.totalMarks,
      duration: payload.duration,
      createdBy: userId,
    };

    const newPaper = await QuestionPaper.create(paperData);

    return res.status(201).json(newPaper);
  } catch (error) {
    console.error("Failed to create question paper:", error);
    return res.status(400).json({
      message: "Failed to create question paper",
      error,
    });
  }
};

// DELETE /question-papers/:id
export const deletePaper = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authUser = (req as any).user as IUser;
    const deletedPaper = await QuestionPaper.findOneAndDelete({
      _id: id,
      createdBy: authUser._id,
      // createdBy: new Types.ObjectId("6ab3764a6fa79849fcaebff6"),
    });

    if (!deletedPaper) {
      return res.status(404).json({ message: "প্রশ্নপত্রটি পাওয়া যায় নি।" });
    }

    return res.status(200).json({ message: "প্রশ্নপত্রটি ডিলিট করা হয়েছে।" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "প্রশ্নপত্রটি ডিলিট করা যায়নি।", error });
  }
};

export const toggleQuestionInPaper = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { questionId } = req.body;

    if (!questionId) {
      return res.status(400).json({ message: "প্রশ্ন আইডি দেওয়া হয়নি।" });
    }

    let result: { status: number; message: string } | undefined;

    await session.withTransaction(async () => {
      const paper: IQuestionPaper | null =
        await QuestionPaper.findById(id).session(session);

      if (!paper) {
        result = { status: 404, message: "প্রশ্নপত্রটি পাওয়া যায়নি।" };
        return; // exits callback only, no res.* here
      }

      const question: Partial<IQuestion> | null =
        await QuestionModel.findById(questionId).session(session);

      if (!question) {
        result = { status: 404, message: "প্রশ্নটি পাওয়া যায়নি।" };
        return;
      }

      const questionType = question.type;
      if (!questionType) {
        result = { status: 400, message: "প্রশ্নটির ধরন নির্ধারণ করা যায়নি।" };
        return;
      }

      const existingSection = paper.sections.find((section) =>
        section.items.some(
          (item) =>
            item.type === "question" && item.question.toString() === questionId,
        ),
      );

      if (existingSection) {
        const questionIndex = existingSection.items.findIndex(
          (item) =>
            item.type === "question" && item.question.toString() === questionId,
        );

        if (questionIndex !== -1) {
          if (
            existingSection.type === "cq" &&
            questionIndex > 0 &&
            existingSection.items[questionIndex - 1].type === "text"
          ) {
            existingSection.items.splice(questionIndex - 1, 2);
          } else {
            existingSection.items.splice(questionIndex, 1);
          }
        }

        const hasQuestions = existingSection.items.some(
          (item) => item.type === "question",
        );

        if (!hasQuestions) {
          paper.sections.splice(paper.sections.indexOf(existingSection), 1);
        }

        await (paper as any).save({ session });
        result = { status: 200, message: "প্রশ্নটি রিমুভ করা হয়েছে।" };
        return;
      }

      const questionCount = paper.sections.reduce(
        (total, section) =>
          total +
          section.items.filter((item) => item.type === "question").length,
        0,
      );

      if (questionCount >= 300) {
        result = {
          status: 400,
          message: "একটি প্রশ্নপত্রে সর্বোচ্চ ৩০০ টি প্রশ্ন যোগ করা সম্ভব।",
        };
        return;
      }

      let section = paper.sections.find((s) => s.type === questionType);
      if (!section) {
        paper.sections.push({
          type: questionType,
          items: [{ type: "question_heading", questionType }],
        });
        section = paper.sections[paper.sections.length - 1];
      }

      if (questionType === "cq") {
        section.items.push({ type: "text", content: "" });
      }
      section.items.push({ type: "question", question: (question as any)._id });

      await (paper as any).save({ session });
      result = { status: 200, message: "প্রশ্নটি যুক্ত হয়েছে।" };
    });

    return res.status(result!.status).json({ message: result!.message });
  } catch (error) {
    console.error(error);
    next(error);
  } finally {
    await session.endSession();
  }
};
