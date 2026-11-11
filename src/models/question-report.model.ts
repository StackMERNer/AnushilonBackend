import { Schema, model, models, Types } from "mongoose";
import { REPORT_REASONS } from "../config/reportReasons";

export interface IQuestionReport {
  user: Types.ObjectId;
  question: Types.ObjectId;
  reasons: string[];
  message?: string;
  status: "open" | "resolved" | "dismissed";
  adminNote?: string;
  resolvedAt?: Date;
  app: "anushilon" | "proshnokosh";
}

const questionReportSchema = new Schema<IQuestionReport>(
  {
    user: { type: Schema.Types.ObjectId, ref: "AnushilonUser", required: true },
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    reasons: { type: [String], enum: REPORT_REASONS, required: true },
    message: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
    },
    adminNote: { type: String, trim: true },
    app: {
      type: String,
      enum: ["anushilon", "proshnokosh"],
      default: "anushilon",
    },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

// one OPEN report per user per question (can re-report after it's handled)
questionReportSchema.index(
  { user: 1, question: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);
questionReportSchema.index({ user: 1, createdAt: -1 }); // daily-limit check
questionReportSchema.index({ status: 1, createdAt: -1 }); // admin inbox
questionReportSchema.index({ question: 1, status: 1 });

export const QuestionReportModel =
  models.QuestionReport ||
  model<IQuestionReport>("QuestionReport", questionReportSchema);
