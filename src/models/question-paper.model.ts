import { ObjectId } from "mongoose";
import { Schema, models, model } from "mongoose";

// ======================================================
// Interfaces
// ======================================================

export interface IQuestionPaperSubject {
  subject: ObjectId;
  chapters: ObjectId[];
}

export type PaperQuestionType = "mcq" | "cq" | string;

export interface IPaperTextItem {
  type: "text";
  content: string; // rich HTML
}

export interface IPaperQuestionHeadingItem {
  type: "question_heading";

  // Used to determine the default heading
  // when content is not provided.
  questionType: PaperQuestionType;

  // If omitted, frontend renders the default heading.
  // If provided, frontend renders this custom rich HTML.
  content?: string;
}

export interface IPaperQuestionItem {
  type: "question";
  question: ObjectId;
  questionNo?: string;
}

export type IPaperSectionItem =
  | IPaperTextItem
  | IPaperQuestionHeadingItem
  | IPaperQuestionItem;

export interface IPaperSection {
  type: PaperQuestionType;
  items: IPaperSectionItem[];
}

export interface IQuestionPaper {
  title: string;
  instruction?: string; // rich HTML

  class: ObjectId;
  subjects: IQuestionPaperSubject[];

  totalMarks: number;
  duration: number; // minutes

  sections: IPaperSection[];

  createdBy?: ObjectId;
  updatedBy?: ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

// ======================================================
// Subject Schema
// ======================================================

const PaperSubjectSchema = new Schema<IQuestionPaperSubject>(
  {
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    chapters: [
      {
        type: Schema.Types.ObjectId,
        ref: "Chapter",
      },
    ],
  },
  {
    _id: false,
  },
);

// ======================================================
// Section Item Schema
// ======================================================

const PaperSectionItemSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["text", "question_heading", "question"],
      required: true,
    },

    // ----------------------------------------
    // Text / Question Heading
    // ----------------------------------------

    content: {
      type: String,
    },

    // ----------------------------------------
    // Question Heading
    // ----------------------------------------

    questionType: {
      type: String,
    },

    // ----------------------------------------
    // Question
    // ----------------------------------------

    question: {
      type: Schema.Types.ObjectId,
      ref: "Question",
    },

    questionNo: {
      type: String,
    },
  },
  {
    _id: true,
  },
);

// ======================================================
// Section Schema
// ======================================================

const PaperSectionSchema = new Schema<IPaperSection>(
  {
    type: {
      type: String,
      required: true,
    },

    items: {
      type: [PaperSectionItemSchema],
      default: [],
    },
  },
  {
    _id: true,
  },
);

// ======================================================
// Question Paper Schema
// ======================================================

const QuestionPaperSchema = new Schema<IQuestionPaper>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },

    instruction: {
      type: String,
    },

    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    subjects: {
      type: [PaperSubjectSchema],
      default: [],
    },

    totalMarks: {
      type: Number,
      required: true,
      min: 0,
    },

    duration: {
      type: Number,
      required: true,
      min: 0,
    },

    sections: {
      type: [PaperSectionSchema],
      default: [],
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// ======================================================
// Model
// ======================================================

export const QuestionPaper =
  models.QuestionPaper ||
  model<IQuestionPaper>("QuestionPaper", QuestionPaperSchema);
