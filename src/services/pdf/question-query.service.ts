import { ChapterModel, IChapterDocument } from "../../models/chapter.model";
import { ClassModel, IClassDocument } from "../../models/class.model";
import { QuestionModel, IQuestionDocument } from "../../models/question.model";
import { SubjectModel, ISubjectDocument } from "../../models/subject.model";
import { BoardModel } from "../../models/board.model";
import { SchoolModel } from "../../models/school.model";
BoardModel.ensureIndexes();
SchoolModel.ensureIndexes();
// ============================================================================
// TYPES
// ============================================================================

export interface QuestionGroup {
  /** Topic name, or "অন্যান্য" for questions with no resolvable topic. */
  title: string;
  questions: IQuestionDocument[];
}

export interface ChapterContext {
  chapter: IChapterDocument;
  subject: ISubjectDocument | null;
  klass: IClassDocument | null;
}

export type ScopeKind = "chapter" | "subject" | "class";

// ============================================================================
// SCOPE RESOLUTION
// ============================================================================

/**
 * Figures out whether the given id refers to a Chapter, a Subject, or
 * a Class, so the caller can pass a single id without saying what
 * kind of id it is.
 */
export async function resolveScopeKind(id: string): Promise<ScopeKind> {
  const [isChapter, isSubject, isClass] = await Promise.all([
    ChapterModel.exists({ _id: id }),
    SubjectModel.exists({ _id: id }),
    ClassModel.exists({ _id: id }),
  ]);

  if (isChapter) return "chapter";
  if (isSubject) return "subject";
  if (isClass) return "class";

  throw new Error(`No chapter, subject, or class found for id "${id}".`);
}

// ============================================================================
// CHAPTER FAN-OUT (subject -> its chapters, class -> its subjects' chapters)
// ============================================================================

export async function getChapterIdsForSubject(
  subjectId: string,
): Promise<string[]> {
  const chapters = await ChapterModel.find({ subject: subjectId })
    .sort({ order: 1 })
    .select("_id")
    .lean();

  return chapters.map((chapter) => String(chapter._id));
}

export async function getChapterIdsForClass(
  classId: string,
): Promise<string[]> {
  const subjects = await SubjectModel.find({ class: classId })
    .sort({ order: 1 })
    .select("_id")
    .lean();

  const chapterIds: string[] = [];

  for (const subject of subjects) {
    const chapters = await ChapterModel.find({ subject: subject._id })
      .sort({ order: 1 })
      .select("_id")
      .lean();

    chapterIds.push(...chapters.map((chapter) => String(chapter._id)));
  }

  return chapterIds;
}

// ============================================================================
// CHAPTER CONTEXT (for PDF header: class/subject/chapter names)
// ============================================================================

export async function getChapterContext(
  chapterId: string,
): Promise<ChapterContext> {
  const chapter = (await ChapterModel.findById(chapterId).lean()) as any;

  if (!chapter) {
    throw new Error("Chapter not found.");
  }

  const subject = (await SubjectModel.findById(chapter.subject).lean()) as any;
  const klass = subject
    ? await ClassModel.findById(subject.class).lean()
    : null;

  return {
    chapter: chapter as unknown as IChapterDocument,
    subject: subject as unknown as ISubjectDocument | null,
    klass: klass as unknown as IClassDocument | null,
  };
}

// ============================================================================
// AVAILABLE TYPES
// ============================================================================

/**
 * What question types actually exist for this chapter right now.
 *
 * This runs a `distinct` query every time. Once we start storing
 * `availableTypes` directly on the Chapter document (as planned),
 * this becomes a cheap field read instead — the call site
 * (pdf-generation.service.ts) won't need to change, only this
 * function's implementation.
 */
export async function getAvailableTypesForChapter(
  chapterId: string,
): Promise<string[]> {
  return QuestionModel.distinct("type", { chapter: chapterId });
}

// ============================================================================
// TOPIC-GROUPED QUESTIONS FOR ONE CHAPTER + TYPE
// ============================================================================

function getTopicNameFromQuestion(
  question: IQuestionDocument,
): string | undefined {
  const topic = (question as unknown as { topic?: { name?: string } }).topic;
  return topic?.name;
}

function getTopicIdFromQuestion(
  question: IQuestionDocument,
): string | undefined {
  const topic = (question as unknown as { topic?: { _id?: unknown } }).topic;
  return topic?._id ? String(topic._id) : undefined;
}

/**
 * Groups an already-fetched (and topic-populated) question list into
 * topic-wise groups, ordered by the chapter's own `topics` array so
 * the PDF follows the same topic order the chapter was authored in.
 * Topics that show up on questions but aren't in `chapter.topics`
 * (shouldn't normally happen) are appended after, sorted by name.
 * Questions with no resolvable topic land in a final "অন্যান্য" group.
 */
function groupQuestionsByTopic(
  chapter: IChapterDocument,
  questions: IQuestionDocument[],
): QuestionGroup[] {
  const topicOrder = (chapter.topics ?? []).map((topicId) => String(topicId));

  const byTopicId = new Map<string, IQuestionDocument[]>();
  const untitled: IQuestionDocument[] = [];

  for (const question of questions) {
    const topicId = getTopicIdFromQuestion(question);
    const topicName = getTopicNameFromQuestion(question);

    if (!topicId || !topicName) {
      untitled.push(question);
      continue;
    }

    if (!byTopicId.has(topicId)) {
      byTopicId.set(topicId, []);
    }

    byTopicId.get(topicId)!.push(question);
  }

  const groups: QuestionGroup[] = [];

  for (const topicId of topicOrder) {
    const topicQuestions = byTopicId.get(topicId);

    if (topicQuestions?.length) {
      groups.push({
        title: getTopicNameFromQuestion(topicQuestions[0]) ?? "অন্যান্য",
        questions: topicQuestions,
      });

      byTopicId.delete(topicId);
    }
  }

  // Any topic that had questions but wasn't listed in chapter.topics.
  const remaining = Array.from(byTopicId.values()).sort((a, b) => {
    const nameA = getTopicNameFromQuestion(a[0]) ?? "";
    const nameB = getTopicNameFromQuestion(b[0]) ?? "";
    return nameA.localeCompare(nameB, "bn");
  });

  for (const topicQuestions of remaining) {
    groups.push({
      title: getTopicNameFromQuestion(topicQuestions[0]) ?? "অন্যান্য",
      questions: topicQuestions,
    });
  }

  if (untitled.length) {
    groups.push({ title: "অন্যান্য", questions: untitled });
  }

  return groups;
}

export async function getQuestionsForChapterTypeGrouped(
  chapterId: string,
  type: string,
): Promise<QuestionGroup[]> {
  const chapter = await ChapterModel.findById(chapterId).lean();

  if (!chapter) {
    throw new Error("Chapter not found.");
  }

  const questions = await QuestionModel.find({ chapter: chapterId, type })
    .populate("topic", "name")
    .populate("boards.board", "name acronym")
    .populate("schools.school", "name")
    .sort({ createdAt: 1 })
    .lean();

  return groupQuestionsByTopic(
    chapter as unknown as IChapterDocument,
    questions as unknown as IQuestionDocument[],
  );
}
