import { Schema, model, Document, Types, models } from "mongoose";

export interface ISubject {
  name: string;
  stream: string;
  chapters: Types.ObjectId[];
  subjectCode: string;
  order: number;
  class: Types.ObjectId;
  version: string[];
  isActive: boolean;
}

export interface ISubjectDocument extends ISubject, Document {}

const subjectSchema = new Schema<ISubjectDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    stream: {
      type: String,
      lowercase: true,
      trim: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
    },
    chapters: [
      {
        type: Schema.Types.ObjectId,
        ref: "Chapter",
      },
    ],
    order: {
      type: Number,
      required: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    version: {
      type: [String],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const SubjectModel =
  models.Subject || model<ISubjectDocument>("Subject", subjectSchema);
