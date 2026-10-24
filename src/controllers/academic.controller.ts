import { QUESTION_TYPE_LABEL_MAP } from "./../utils/constants";
import { Request, Response } from "express";
import { SubjectModel } from "../models/subject.model";
import { TopicModel } from "../models/topic.model";
import { ChapterModel } from "../models/chapter.model";
import { BoardModel } from "../models/board.model";
import { IQuestionPaper, QuestionPaper } from "../models/question-paper.model";
import { QuestionModel } from "../models/question.model";
import { SchoolModel } from "../models/school.model";
import mongoose from "mongoose";

export const getAcademicTree = async (req: Request, res: Response) => {
  try {
    const { classId, upto = "subject", paperId, status = "active" } = req.query;

    const authUser = (req as any).user;
    const isAdmin = authUser?.role === "admin";

    if (!classId) {
      return res.status(400).json({ message: "classId is required" });
    }

    let questionPaper;

    if (paperId) {
      questionPaper = (await QuestionPaper.findById(paperId)) as IQuestionPaper;
    }

    let subjectQuery: any = {
      class: classId,
      version: "bangla",
    };

    if (!isAdmin) {
      subjectQuery.isActive = true;
    }

    if (questionPaper) {
      subjectQuery._id = { $in: questionPaper.subjects.map((s) => s.subject) };
    } else if (status === "active") {
      subjectQuery.isActive = true;
    }

    // 1. Fetch Subjects for selected Class
    const subjects = await SubjectModel.find(subjectQuery)
      .sort({ order: 1 })
      .select("_id name order stream chapters version isActive")
      .lean();

    if (upto === "subject") {
      return res.status(200).json({ items: subjects });
    }

    // 2. Fetch Chapters for those Subjects
    const subjectIds = subjects.map((s) => s._id);
    const chapterQuery: any = { subject: { $in: subjectIds } };

    if (!isAdmin) {
      chapterQuery.isActive = true;
    } else if (status === "active") {
      chapterQuery.isActive = true;
    }

    if (questionPaper) {
      chapterQuery._id = {
        $in: questionPaper.subjects.map((s) => s.chapters).flat(),
      };
    }

    const chapters = await ChapterModel.find(chapterQuery)
      .sort({ order: 1 })
      .select("_id name order topics subject isActive")
      .lean();

    if (upto === "chapter") {
      const tree = subjects.map((subject: any) => ({
        ...subject,
        chapters: chapters.filter(
          (c) => c.subject.toString() === subject._id.toString(),
        ),
      }));
      return res.status(200).json({ items: tree });
    }

    // 3. Fetch Topics if upto === "topic"
    if (upto === "topic") {
      const chapterIds = chapters.map((c) => c._id);
      const topicsQuery: any = {
        chapter: { $in: chapterIds },
      };

      if (!isAdmin) {
        topicsQuery.isActive = true;
      } else if (status === "active") {
        topicsQuery.isActive = true;
      }

      const topics = await TopicModel.find(topicsQuery)
        .sort({ order: 1 })
        .select("_id name order chapter isActive")
        .lean();

      const chapterMap = chapters.map((chapter) => ({
        ...chapter,
        topics: topics.filter(
          (t: any) => t.chapter.toString() === (chapter as any)._id.toString(),
        ),
      }));

      const tree = subjects.map((subject) => ({
        ...subject,
        chapters: chapterMap.filter(
          (c: any) => c.subject.toString() === (subject as any)._id.toString(),
        ),
      }));

      return res.status(200).json({ items: tree });
    }

    return res.status(400).json({ message: "Invalid 'upto' parameter" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch academic tree", error });
  }
};

// --- SUBJECT UPDATER ---
export const updateSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive, order, stream, version } = req.body;

    const updatedSubject = await SubjectModel.findByIdAndUpdate(
      id,
      { $set: { name, isActive, order, stream, version } },
      { new: true, runValidators: true },
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    return res.status(200).json({
      message: "Subject updated successfully",
      subject: updatedSubject,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update subject", error });
  }
};

// --- CHAPTER UPDATER ---
export const updateChapter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive, order, badge } = req.body;

    const updatedChapter = await ChapterModel.findByIdAndUpdate(
      id,
      { $set: { name, isActive, order, badge } },
      { new: true, runValidators: true },
    );

    if (!updatedChapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }

    return res.status(200).json({
      message: "Chapter updated successfully",
      chapter: updatedChapter,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update chapter", error });
  }
};

// --- TOPIC UPDATER ---
export const updateTopic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive, order } = req.body;

    const updatedTopic = await TopicModel.findByIdAndUpdate(
      id,
      { $set: { name, isActive, order } },
      { new: true, runValidators: true },
    );

    if (!updatedTopic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    return res.status(200).json({
      message: "Topic updated successfully",
      topic: updatedTopic,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update topic", error });
  }
};

export const getQuestionSources = async (req: Request, res: Response) => {
  try {
    const { subjectId, chapterId, questionType } = req.query;

    const match: Record<string, any> = {};

    if (subjectId) {
      match.subject = new mongoose.Types.ObjectId(subjectId as string);
    }

    if (chapterId) {
      match.chapter = new mongoose.Types.ObjectId(chapterId as string);
    }

    if (
      questionType &&
      questionType !== "null" &&
      questionType !== "undefined"
    ) {
      match.type = questionType;
    }

    const [result] = await QuestionModel.aggregate([
      { $match: match },

      {
        $facet: {
          boards: [
            { $unwind: "$boards" },

            {
              $group: {
                _id: null,
                ids: { $addToSet: "$boards.board" },
                years: { $addToSet: "$boards.year" },
              },
            },

            {
              $project: {
                _id: 0,
                ids: 1,
                years: 1,
              },
            },
          ],

          schools: [
            { $unwind: "$schools" },

            {
              $group: {
                _id: null,
                ids: { $addToSet: "$schools.school" },
              },
            },

            {
              $project: {
                _id: 0,
                ids: 1,
              },
            },
          ],
        },
      },
    ]);

    const boardIds = result?.boards[0]?.ids ?? [];

    const boardYears = (result?.boards[0]?.years ?? [])
      .filter((year: number | null) => year != null)
      .sort((a: number, b: number) => b - a);

    const schoolIds = result?.schools[0]?.ids ?? [];

    const [boards, schools] = await Promise.all([
      BoardModel.find({
        _id: { $in: boardIds },
      })
        .select("name acronym")
        .lean(),

      SchoolModel.find({
        _id: { $in: schoolIds },
      })
        .select("name")
        .lean(),
    ]);

    return res.send({
      boards,
      boardYears,
      schools,
    });
  } catch (error) {
    console.error("Error fetching question sources:", error);

    return res.status(500).send({
      message: "Failed to fetch boards, years and schools",
    });
  }
};

export const getQuestionTypesByChapter = async (
  req: Request,
  res: Response,
) => {
  try {
    const { chapterId } = req.query;

    if (!chapterId) {
      return res.status(400).json({
        message: "Chapter ID is required",
      });
    }

    const types = await QuestionModel.distinct("type", {
      chapter: chapterId,
    });
    const labeledTypes = types.map((t) => ({
      label: QUESTION_TYPE_LABEL_MAP[t] || t,
      value: t,
    }));
    return res.status(200).json({ types: labeledTypes });
  } catch (error) {
    console.error("Failed to get question types by chapter:", error);

    return res.status(500).json({
      message: "Failed to get question types",
    });
  }
};

type ReorderType = "subject" | "chapter" | "topic";

interface ReorderBody {
  type: ReorderType;
  parentId: string;
  orderedIds: string[];
}

export const reorderAcademic = async (
  req: Request<{}, {}, ReorderBody>,
  res: Response,
) => {
  try {
    const { type, parentId, orderedIds } = req.body;

    if (!type || !parentId || !Array.isArray(orderedIds)) {
      return res.status(400).json({
        message: "type, parentId and orderedIds are required",
      });
    }

    if (!["subject", "chapter", "topic"].includes(type)) {
      return res.status(400).json({
        message: "Invalid reorder type",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        message: "Invalid parentId",
      });
    }

    const Model =
      type === "subject"
        ? SubjectModel
        : type === "chapter"
          ? ChapterModel
          : TopicModel;

    const parentField =
      type === "subject" ? "class" : type === "chapter" ? "subject" : "chapter";

    // Verify all items belong to the supplied parent
    const items = await Model.find({
      _id: { $in: orderedIds },
      [parentField]: parentId,
    }).select("_id");

    if (items.length !== orderedIds.length) {
      return res.status(400).json({
        message: "Invalid items or items do not belong to this parent",
      });
    }

    const operations = orderedIds.map((id, index) => ({
      updateOne: {
        filter: {
          _id: id,
          [parentField]: parentId,
        },
        update: {
          $set: {
            order: index,
          },
        },
      },
    }));

    await Model.bulkWrite(operations);

    return res.status(200).json({
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("reorderAcademic:", error);

    return res.status(500).json({
      message: "Failed to update order",
    });
  }
};
