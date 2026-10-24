import { IBoard } from "../../models/board.model";
import { IQuestionDocument } from "../../models/question.model";
import { ISchool } from "../../models/school.model";
import { MATHJAX_CDN } from "./constants";
import { QuestionGroup } from "./question-query.service";
import { toBengaliNumber } from "./utils";

export interface PdfMeta {
  /** Defaults to a generic brand string if not provided. */
  productName?: string;
  classLabel?: string;
  subjectLabel?: string;
  chapterLabel?: string;
  /** e.g. "সকল MCQ" / "বোর্ড ও স্কুল গুরুত্বপূর্ণ MCQ" */
  collectionLabel: string;
  typeLabel: string;
  totalQuestions: number;
}

/**
 * Formats a 4-digit year to a 2-digit Bengali string (e.g. 2025 -> "২৫")
 */
function formatShortYear(year?: number | null): string {
  if (!year) return "";
  const shortYear = String(year).slice(-2);
  return toBengaliNumber(shortYear);
}

function escapeHtml(value: string = ""): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderRichText(value?: string): string {
  return value ?? "";
}

/**
 * Maps correct option index or value to Bengali letter label (ক, খ, গ, ঘ)
 */
function getBengaliOptionLabel(answerKey: any): string {
  if (answerKey === undefined || answerKey === null || answerKey === "") {
    return "";
  }
  const labels = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];

  if (typeof answerKey === "number" && labels[answerKey]) {
    return labels[answerKey];
  }

  const str = String(answerKey).trim();
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && labels[parsedNum]) {
    return labels[parsedNum];
  }

  // If answerKey is already 'ক', 'খ', 'a', 'b', etc.
  const charMap: Record<string, string> = {
    a: "ক",
    b: "খ",
    c: "গ",
    d: "ঘ",
    A: "ক",
    B: "খ",
    C: "গ",
    D: "ঘ",
  };

  return charMap[str] || str;
}

/**
 * Renders board and school metadata badges below questions.
 * Expects populated `boards.board` and `schools.school`.
 */
function renderQuestionMetaTags(question: any): string {
  const tags: string[] = [];

  // Format Boards
  if (Array.isArray(question.boards)) {
    question.boards.forEach((b: any) => {
      const boardObj: IBoard = b.board;
      if (!boardObj) return;

      const name = boardObj.acronym || boardObj.name || "";
      const yearStr = formatShortYear(b.year);
      tags.push(yearStr ? `${name} ${yearStr}` : name);
    });
  }

  // Format Schools
  if (Array.isArray(question.schools)) {
    question.schools.forEach((s: any) => {
      const schoolObj: ISchool = s.school;
      if (!schoolObj) return;

      const name = schoolObj.name || "";
      const yearStr = formatShortYear(s.year);
      tags.push(yearStr ? `${name} ${yearStr}` : name);
    });
  }

  if (!tags.length) return "";

  return `
    <div class="question-meta-tags">
      [${tags.map(escapeHtml).join("; ")}]
    </div>
  `;
}

function renderOptions(options: string[]): string {
  if (!options?.length) {
    return "";
  }

  const labels = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];

  const cleanedOptions = options
    .map((opt) => opt?.replace(/<[^>]*>/g, ""))
    .filter(Boolean);

  const hasLongOption = cleanedOptions.some((opt) => (opt ?? "").length > 20);
  const gridStyle = hasLongOption
    ? "grid-template-columns: 1fr;"
    : "grid-template-columns: 1fr 1fr;";

  return `
    <div class="options" style="${gridStyle}">
      ${options
        .map(
          (option, index) => `
            <div class="option">
              <span class="option-label">
                ${labels[index] ?? String.fromCharCode(97 + index)}
              </span>
              <span class="option-text">
                ${renderRichText(option)}
              </span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

/**
 * Render CQs: Questions listed first, followed by grouped solutions (guidebook format).
 */
function renderCQSection(question: IQuestionDocument): string {
  if (!question.questions?.length) {
    return "";
  }

  const labels = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
  const solutions = question.questions?.map((q) => q.answer) || [];
  const hasSolutions = solutions.some((sol) => sol && sol.trim().length > 0);

  return `
    <div class="sub-questions">
      ${question.questions
        .map(
          (subQuestion, index) => `
            <div class="sub-question">
              <span class="sub-question-label">
                ${labels[index] ?? `${index + 1}`}.
              </span>
              <span class="sub-question-text">
                ${renderRichText(subQuestion.question)}
              </span>
            </div>
          `,
        )
        .join("")}
    </div>

    ${
      hasSolutions
        ? `
          <div class="cq-solutions-group">
            <div class="cq-solutions-heading">উত্তর:</div>
            ${solutions
              .map((sol, index) => {
                if (!sol) return "";
                const label = labels[index] ?? `${index + 1}`;
                return `
                  <div class="cq-solution-item">
                    <span class="cq-solution-label">${label}</span>
                    <div class="cq-solution-text">${renderRichText(sol)}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : ""
    }
  `;
}

function renderQuestion(
  question: IQuestionDocument,
  questionNumber: number,
): string {
  const displayNumber = toBengaliNumber(questionNumber);

  // Extract MCQ answer key
  const rawAnswer =
    (question as any).correctAnswer ??
    (question as any).answer ??
    (question as any).correctOption;
  const isMcq =
    question.type === "mcq" ||
    (question.options && question.options.length > 0);
  const correctOptionLabel =
    isMcq && rawAnswer !== undefined ? getBengaliOptionLabel(rawAnswer) : "";

  return `
    <article class="question question-${question.type}">
      <div class="question-row">
        <div class="question-number">
          <span class="num">${displayNumber}.</span>
          ${
            correctOptionLabel
              ? `<div class="correct-answer-badge">${correctOptionLabel}</div>`
              : ""
          }
        </div>

        <div class="question-content">
          ${
            question.context
              ? `
                <div class="context">
                  ${renderRichText(question.context)}
                </div>
              `
              : ""
          }

          <div class="question-text">
            ${renderRichText(question.question)}
          </div>

          ${renderQuestionMetaTags(question)}

          ${renderOptions(question.options)}

          ${
            question.answer &&
            (!question.questions || question.questions.length === 0)
              ? `
                <div class="solution-box">
                  <span class="solution-label">ব্যাখ্যা:</span>
                  <div class="solution-text">${renderRichText(question.answer)}</div>
                </div>
              `
              : ""
          }

          ${renderCQSection(question)}
        </div>
      </div>
    </article>
  `;
}

function renderGroups(groups: QuestionGroup[]): string {
  let questionNumber = 0;

  return groups
    .map((group) => {
      const questionsHtml = group.questions
        .map((question) => {
          questionNumber += 1;
          return renderQuestion(question, questionNumber);
        })
        .join("");

      return `
        <h3 class="topic-title">
          ${escapeHtml(group.title)}
        </h3>

        ${questionsHtml}
      `;
    })
    .join("");
}

function renderHeader(meta: PdfMeta): string {
  const titleParts = [meta.classLabel, meta.subjectLabel].filter(Boolean);

  return `
    <header class="document-header">
      <h1 class="product-name">
        ${escapeHtml(meta.productName ?? "প্রশ্নব্যাংক")}
      </h1>

      ${
        titleParts.length
          ? `
            <h2 class="doc-title">
              ${escapeHtml(titleParts.join(" — "))}
            </h2>
          `
          : ""
      }

      ${
        meta.chapterLabel
          ? `
            <div class="doc-subtitle">
              ${escapeHtml(meta.chapterLabel)}
            </div>
          `
          : ""
      }

      <div class="exam-info">
        <div class="exam-info-item">
          <span class="exam-info-label">ধরন:</span>
          ${escapeHtml(meta.typeLabel)}
        </div>

        <div class="exam-info-item">
          <span class="exam-info-label">সংগ্রহ:</span>
          ${escapeHtml(meta.collectionLabel)}
        </div>

        <div class="exam-info-item">
          <span class="exam-info-label">মোট প্রশ্ন:</span>
          ${toBengaliNumber(meta.totalQuestions)}
        </div>
      </div>
    </header>
  `;
}

export function renderQuestionSetDocument(params: {
  meta: PdfMeta;
  groups: QuestionGroup[];
}): string {
  const { meta, groups } = params;

  return `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(
    [meta.subjectLabel, meta.chapterLabel, meta.collectionLabel]
      .filter(Boolean)
      .join(" — ") ||
      meta.productName ||
      "Question Set",
  )}</title>

  <!-- Google Fonts: Noto Serif Bengali -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;600;700;800&display=swap" rel="stylesheet">

  <script>
    window.MathJax = {
      tex2jax: {
        inlineMath: [
          ["$", "$"],
          ["\\\\(", "\\\\)"]
        ],
        displayMath: [
          ["$$", "$$"],
          ["\\\\[", "\\\\]"]
        ],
        processEscapes: true,
        processEnvironments: true,
        skipTags: [
          "script",
          "noscript",
          "style",
          "textarea",
          "pre",
          "code"
        ]
      },
      messageStyle: "none",
      showProcessingMessages: false,
      showMathMenu: false
    };
  </script>

  <script type="text/javascript" src="${MATHJAX_CDN}"></script>

  <style>
    * {
      box-sizing: border-box;
    }

    html {
      background: #e5e5e5;
    }

    body {
      margin: 0;
      padding: 30px 0;
      background: #e5e5e5;
      color: #000;
      font-family: "Noto Serif Bengali", serif;
      font-size: 13.5px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /*
     * =========================================================
     * A4 Document Layout
     * =========================================================
     */

    .document {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm 13mm;
      background: #ffffff;
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.14);
    }

    /*
     * =========================================================
     * Header
     * =========================================================
     */

    .document-header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1.5px solid #000;
    }

    .product-name {
      margin: 0;
      font-size: 19px;
      line-height: 1.25;
      font-weight: 800;
      color: #000;
    }

    .doc-title {
      margin: 4px 0 0;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.3;
    }

    .doc-subtitle {
      margin: 2px 0 6px;
      font-size: 14px;
      font-weight: 600;
    }

    .exam-info {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
      padding: 5px 8px;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      font-size: 11.5px;
      font-weight: 600;
    }

    .exam-info-item {
      text-align: center;
      white-space: nowrap;
    }

    .exam-info-label {
      color: #222;
      margin-right: 3px;
    }

    /*
     * =========================================================
     * Topic Headings
     * =========================================================
     */

    .topic-title {
      margin: 12px 0 6px;
      padding-bottom: 2px;
      border-bottom: 1px solid #000;
      font-size: 13px;
      font-weight: 700;
      color: #000;
    }

    .topic-title:first-child {
      margin-top: 0;
    }

    /*
     * =========================================================
     * Questions — TWO COLUMNS (No bottom borders)
     * =========================================================
     */

    .questions {
      column-count: 2;
      column-gap: 16px;
      column-rule: 1px solid #aaa;
    }

    .question {
      display: block;
      width: 100%;
      padding-bottom: 4px;
      margin-bottom: 10px;
      border-bottom: none !important;
    }

    .question-row {
      display: flex;
      align-items: flex-start;
      gap: 5px;
    }


    .question-number .num {
      font-weight: 700;
      font-size: 13.5px;
      line-height: 1.4;
    }

    .correct-answer-badge {
      margin-top: 2px;
      font-size: 10px;
      background: #000;
      color: #fff;
      height: 16px;
      width: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .question-content {
      flex: 1;
      min-width: 0;
    }

    .context {
      margin-bottom: 4px;
      // font-style: italic;
    }

    .question-text {
      margin-bottom: 4px;
      line-height: 1.5;
    }

    .question-meta-tags {
      font-size: 10.5px;
      color: #333;
      font-weight: 600;
      margin-top: 2px;
      margin-bottom: 4px;
    }

    /*
     * =========================================================
     * MCQ Options
     * =========================================================
     */

    .options {
      display: grid;
      column-gap: 10px;
      row-gap: 4px;
      margin-top: 5px;
    }

    .option {
      display: flex;
      align-items: flex-start;
      min-width: 0;
      line-height: 1.4;
    }

    .option-label {
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      margin-right: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #000;
      border-radius: 50%;
      font-size: 10.5px;
      font-weight: 600;
      line-height: 1;
      background: transparent;
    }

    .option-text {
      flex: 1;
      min-width: 0;
    }

    /*
     * =========================================================
     * CQ Sub-questions & Grouped Answers
     * =========================================================
     */

    .sub-questions {
      margin-top: 6px;
    }

    .sub-question {
      display: flex;
      align-items: flex-start;
      margin-bottom: 4px;
    }

    .sub-question-label {
      flex: 0 0 auto;
      width: 18px;
      font-weight: 700;
      font-size: 12px;
    }

    .sub-question-text {
      flex: 1;
      min-width: 0;
    }

    .cq-solutions-group {
      margin-top: 6px;
      padding-top: 4px;
    }

    .cq-solutions-heading {
      font-weight: 700;
      font-size: 12px;
      margin-bottom: 5px;
      text-decoration: underline;
    }

    .cq-solution-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 5px;
      font-size: 12.5px;
    }

    .cq-solution-label {
      flex: 0 0 auto;
      background-color: #000;
      color: #fff;
      font-weight: 700;
      font-size: 11px;
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 0 4px 0 4px; /* Top-Right & Bottom-Left rounded */
      margin-right: 6px;
      margin-top: 1px;
      line-height: 1;
    }

    .cq-solution-text {
      flex: 1;
      min-width: 0;
    }

    /*
     * =========================================================
     * Single MCQ Solution Box (Border-free)
     * =========================================================
     */

    .solution-box {
      margin-top: 5px;
      padding: 2px 0;
      border: none !important;
      font-size: 12px;
    }

    .solution-label {
      font-weight: 700;
      margin-right: 4px;
    }

    .solution-text {
      display: inline;
    }

    /*
     * =========================================================
     * Rich Text HTML Tables Styling (Plain B&W Print-Friendly)
     * =========================================================
     */

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
      font-size: 12px;
    }

    table, th, td {
      border: 1px solid #000;
    }

    th, td {
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }

    th {
      font-weight: 700;
      background-color: #ffffff;
    }

    /*
     * =========================================================
     * MathJax
     * =========================================================
     */

    .MathJax {
      font-size: 100% !important;
    }

    /*
     * =========================================================
     * Print Optimization
     * =========================================================
     */

    @page {
      size: A4;
      margin: 10mm;
    }

    @media print {
      html, body {
        background: #ffffff !important;
        padding: 0 !important;
        color: #000 !important;
      }

      .document {
        width: auto !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
    }

    @media screen and (max-width: 800px) {
      body {
        padding: 10px 0;
      }

      .document {
        width: 100%;
        min-height: auto;
        padding: 15px;
        box-shadow: none;
      }
    }
  </style>
</head>

<body>
  <main class="document">
    ${renderHeader(meta)}

    <section class="questions">
      ${renderGroups(groups)}
    </section>
  </main>

  <script>
    document.addEventListener("DOMContentLoaded", function () {
      if (window.MathJax && window.MathJax.Hub) {
        window.MathJax.Hub.Queue([
          "Typeset",
          window.MathJax.Hub
        ]);
      }
    });
  </script>
</body>
</html>
  `;
}
