import { Schema, model, Document, Types, models } from "mongoose";

// ============================================================================
// 1. TYPES & ENUMS
// ============================================================================

export type QuestionLevel =
  | "knowledge"
  | "comprehension"
  | "application"
  | "skills"
  | string;

export interface IQuestionBoard {
  board: Types.ObjectId;
  year: number;
  order: number | null;
}

export interface IQuestionSchool {
  school: Types.ObjectId;
  year: number | null;
  order: number | null;
}

export interface ISubQuestion {
  question: string;
  answer: string;
}

export interface IQuestion {
  refId: string;
  type: string; // 'mcq', 'cq', 'short', etc.
  context?: string;
  question: string; // Main question text
  options: string[]; // Options array for MCQs
  correctMcq?: number;
  questions?: ISubQuestion[];
  answer?: string;

  // Relations to other entities
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  topic: Types.ObjectId; // single topic
  boards: IQuestionBoard[];
  schools: IQuestionSchool[];
  universities: IQuestionUniversity[];

  // Metadata & Taxonomy
  rating?: number;
  tags: string[];
  level?: QuestionLevel;
  difficulty?: string;
  sameContextQuesId?: string;
}

export interface IFilterdQuestion extends Omit<
  IQuestion,
  "subject" | "chapter" | "topic"
> {
  _id: string;
}

export interface IQuestionDocument extends IQuestion, Document {}

// ============================================================================
// 2. SUB-SCHEMAS
// ============================================================================

const SubQuestionSchema = new Schema<ISubQuestion>(
  {
    question: {
      type: String,
    },
    answer: {
      type: String,
      required: true,
    },
  },
  { _id: true },
);

const questionBoardSchema = new Schema<IQuestionBoard>(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    order: {
      type: Number,
      default: null,
    },
  },
  { _id: false },
);

const questionSchoolSchema = new Schema<IQuestionSchool>(
  {
    school: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    year: {
      type: Number,
      default: null,
    },
    order: {
      type: Number,
      default: null,
    },
  },
  { _id: false },
);

interface IQuestionUniversity {
  university: Types.ObjectId;
  year: number | null;
  order: number | null;
  unit: string | null;
}

const questionUniversitySchema = new Schema<IQuestionUniversity>(
  {
    university: {
      type: Schema.Types.ObjectId,
      ref: "University",
      required: true,
    },
    year: {
      type: Number,
      default: null,
    },
    order: {
      type: Number,
      default: null,
    },
    unit: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

// ============================================================================
// 3. MAIN QUESTION SCHEMA
// ============================================================================

const questionSchema = new Schema<IQuestionDocument>(
  {
    refId: {
      type: String,
      unique: true,
      index: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    context: {
      type: String,
      trim: true,
    },
    question: {
      type: String,
      trim: true,
    },
    options: {
      type: [String],
      default: [],
    },
    correctMcq: {
      type: Number,
      default: null,
    },
    questions: {
      type: [SubQuestionSchema],
      default: undefined,
    },
    answer: {
      type: String,
      trim: true,
    },

    // Relational ObjectIds
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      index: true,
    },
    chapter: {
      type: Schema.Types.ObjectId,
      ref: "Chapter",
      index: true,
    },
    topic: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      index: true,
    },

    // Embedded Arrays
    boards: {
      type: [questionBoardSchema],
      default: [],
    },
    schools: {
      type: [questionSchoolSchema],
      default: [],
    },
    universities: {
      type: [questionUniversitySchema],
      default: [],
    },

    // Metadata & Taxonomy
    rating: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    level: {
      type: String,
      trim: true,
    },
    difficulty: {
      type: String,
      trim: true,
      index: true,
    },
    sameContextQuesId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================================
// 4. COMPOUND INDEXES FOR QUERY OPTIMIZATION
// ============================================================================

// Chapter & Topic filtering
questionSchema.index({ chapter: 1, topic: 1, type: 1 });

// Subject-level querying
questionSchema.index({ subject: 1, type: 1 });

questionSchema.index({ subject: 1, chapter: 1, "boards.board": 1 });

export const QuestionModel =
  models.Question || model<IQuestionDocument>("Question", questionSchema);
