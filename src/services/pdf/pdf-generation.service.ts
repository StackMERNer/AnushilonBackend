import fs from "node:fs/promises";
import path from "node:path";

import {
  getCollectionDefinitions,
  getTypeFolderName,
  getTypeLabel,
} from "./collections";
import { mapWithConcurrency } from "./concurrency.util";
import { generatePdfFromHtml } from "./playwright-pdf.service";
import { renderQuestionSetDocument } from "./question-html.renderer";
import {
  getAvailableTypesForChapter,
  getChapterContext,
  getChapterIdsForClass,
  getChapterIdsForSubject,
  getQuestionsForChapterTypeGrouped,
  resolveScopeKind,
} from "./question-query.service";

/**
 * How many Chromium pages we're willing to have rendering at once.
 * Each render is CPU + memory heavy (MathJax typesetting, font/image
 * waits, etc.), so keep this modest — tune based on the machine this
 * runs on. Override per call via `options.concurrency`.
 */
const DEFAULT_CONCURRENCY = 3;

const CLASS_FOLDER_FALLBACK = "অজানা-শ্রেণি";
const SUBJECT_FOLDER_FALLBACK = "অজানা-বিষয়";
const isDemoGeneration = true;
const DEMO_CHAPTER_COUNT = 2;

export interface GeneratedPdfInfo {
  chapterId: string;
  type: string;
  collectionKey: string;
  setNumber: number;
  fileName: string;
  outputPath: string;
  questionCount: number;
}

interface ChapterTypeJob {
  chapterId: string;
  type: string;
}

/**
 * Folder/file names come straight from DB fields (class/subject/
 * chapter names, all Bengali text) — this only strips characters
 * that are actually illegal in a path, it does not transliterate or
 * otherwise mangle the text.
 */
function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-");
}

/**
 * Writes a PDF to:
 *   generated-pdfs/<class>/<subject>/<chapter>/<type>/<fileName>
 *
 * File names are deterministic (set-1.pdf, set-2.pdf, ...) rather
 * than timestamped, so regenerating a chapter overwrites the same
 * file in place — matching the "PDFs are generated products, the
 * database is the source of truth" model.
 */
async function writePdf(
  html: string,
  pathSegments: string[],
  fileName: string,
) {
  const outputDirectory = path.join(
    process.cwd(),
    "generated-pdfs",
    ...pathSegments.map(sanitizePathSegment),
  );

  await fs.mkdir(outputDirectory, { recursive: true });

  const outputPath = path.join(outputDirectory, fileName);

  await generatePdfFromHtml(html, outputPath);

  return { fileName, outputPath };
}

/**
 * The actual unit of work run by the concurrency pool: for one
 * chapter + one type, generates every defined collection PDF (e.g.
 * "all" + "board-school" for mcq/cq/short — a single "all" PDF for
 * any other type), grouped topic-wise, skipping any collection that
 * turns out empty (e.g. no board/school-tagged questions yet).
 */
async function generateChapterTypePdfs(
  chapterId: string,
  type: string,
): Promise<GeneratedPdfInfo[]> {
  const [{ chapter, subject, klass }, questionGroups] = await Promise.all([
    getChapterContext(chapterId),
    getQuestionsForChapterTypeGrouped(chapterId, type),
  ]);

  const classFolder = klass?.name ?? CLASS_FOLDER_FALLBACK;
  const subjectFolder = subject?.name ?? SUBJECT_FOLDER_FALLBACK;
  const chapterFolder = chapter.name;
  const typeFolder = getTypeFolderName(type);

  const collections = getCollectionDefinitions(type);
  const results: GeneratedPdfInfo[] = [];

  for (const [index, collection] of collections.entries()) {
    const setNumber = index + 1;

    const filteredGroups = questionGroups
      .map((group) => ({
        title: group.title,
        questions: group.questions.filter(collection.filter),
      }))
      .filter((group) => group.questions.length > 0);

    const totalQuestions = filteredGroups.reduce(
      (sum, group) => sum + group.questions.length,
      0,
    );

    if (!totalQuestions) {
      continue;
    }

    const html = renderQuestionSetDocument({
      meta: {
        classLabel: klass?.name,
        subjectLabel: subject?.name,
        chapterLabel: chapter.name,
        collectionLabel: collection.label,
        typeLabel: getTypeLabel(type),
        totalQuestions,
      },
      groups: filteredGroups,
    });

    const { fileName, outputPath } = await writePdf(
      html,
      [classFolder, subjectFolder, chapterFolder, typeFolder],
      `${collection.label}.pdf`,
    );

    results.push({
      chapterId,
      type,
      collectionKey: collection.key,
      setNumber,
      fileName,
      outputPath,
      questionCount: totalQuestions,
    });
  }

  return results;
}

/**
 * Single entry point: give it a Chapter id, a Subject id, or a Class
 * id — it figures out which one it is, fans out to every chapter in
 * scope (just itself for a chapter id; every chapter of every subject
 * for a class id), discovers which question types actually exist per
 * chapter, and generates every defined collection PDF for each.
 *
 * PDFs land in:
 *   generated-pdfs/<class>/<subject>/<chapter>/<type>/set-N.pdf
 *
 * Rendering is batched through a small concurrency pool (see
 * concurrency.util.ts) so a subject/class with many chapters doesn't
 * try to open dozens of Chromium pages simultaneously.
 */
export async function generateQuestionSetPdfs(
  id: string,
  options?: { concurrency?: number },
): Promise<GeneratedPdfInfo[]> {
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
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

  // Metadata discovery (cheap `distinct` queries) — run upfront and
  // sequentially per chapter; this is the step that gets replaced by
  // a plain field read once `chapter.availableTypes` exists in the DB.
  const jobs: ChapterTypeJob[] = [];

  if (isDemoGeneration) {
    chapterIds = chapterIds.slice(0, DEMO_CHAPTER_COUNT);
  }

  for (const chapterId of chapterIds) {
    const types = await getAvailableTypesForChapter(chapterId);

    for (const type of types) {
      jobs.push({ chapterId, type });
    }
  }

  if (!jobs.length) {
    throw new Error("No questions found for the given id.");
  }

  // The heavy part — Chromium rendering — goes through the
  // concurrency-limited pool.
  const nestedResults = await mapWithConcurrency(jobs, concurrency, (job) =>
    generateChapterTypePdfs(job.chapterId, job.type),
  );

  return nestedResults.flat();
}
