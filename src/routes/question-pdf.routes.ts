import { Router } from "express";

import { generateQuestionSetPdfs } from "../services/pdf/pdf-generation.service";
import {
  getChapterContext,
  getChapterIdsForClass,
  getChapterIdsForSubject,
  getQuestionsForChapterTypeGrouped,
  resolveScopeKind,
} from "../services/pdf/question-query.service";
import { renderQuestionSetDocument } from "../services/pdf/question-html.renderer";
import { getCollectionDefinitions } from "../services/pdf/collections";
const router = Router();

router.get("/generate/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "ID parameter is required." });
    }
    const result = await generateQuestionSetPdfs(id);

    return res.status(200).json({
      success: true,
      message: "PDF generated successfully.",
      result: result,
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return res.status(500).json({
      success: false,
      error: error,
      message: "Failed to generate PDF.",
    });
  }
});
router.get("/preview/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "ID parameter is required." });
    }
    // const result = await generateQuestionSetPdfs(id);
    const scopeKind = await resolveScopeKind(id);

    let chapterIds: string[];

    if (scopeKind === "chapter") {
      chapterIds = [id];
    } else if (scopeKind === "subject") {
      chapterIds = await getChapterIdsForSubject(id);
    } else {
      chapterIds = await getChapterIdsForClass(id);
    }

    if (!chapterIds.length) {
      throw new Error("No chapters found for the given id.");
    }

    const chapterId = chapterIds[1];
    const questionType = "mcq";
    const [{ chapter, subject, klass }, questionGroups] = await Promise.all([
      getChapterContext(chapterId),
      getQuestionsForChapterTypeGrouped(chapterId, questionType),
    ]);

    const collections = getCollectionDefinitions(questionType);

    const filteredGroups = questionGroups
      .map((group) => ({
        title: group.title,
        questions: group.questions.filter(collections[0].filter),
      }))
      .filter((group) => group.questions.length > 0);

    const totalQuestions = filteredGroups.reduce(
      (sum, group) => sum + group.questions.length,
      0,
    );
    const html = renderQuestionSetDocument({
      meta: {
        classLabel: "preview class",
        subjectLabel: "preview subject",
        chapterLabel: "preview chapter",
        collectionLabel: "preview collection",
        typeLabel: "preview type",
        totalQuestions,
      },
      groups: filteredGroups,
    });

    // return res.status(200).json({
    //   success: true,
    //   message: "PDF generated successfully.",
    //   result: result,
    // });

    return res.status(200).send(html);
  } catch (error) {
    console.error("PDF generation error:", error);
    return res.status(500).json({
      success: false,
      error: error,
      message: "Failed to generate PDF.",
    });
  }
});

export default router;
