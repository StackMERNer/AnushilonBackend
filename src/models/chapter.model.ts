import { Schema, model, Document, Types, models } from "mongoose";

export interface IChapter {
  name: string;
  subject: Types.ObjectId;
  isFree: boolean;
  status: string;
  order: number;
  badge: string[];
  topics: Types.ObjectId[];
  isActive: boolean;
}

export interface IChapterDocument extends IChapter, Document {}

const chapterSchema = new Schema<IChapterDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    isFree: {
      type: Boolean,
      required: true,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "inprogress"],
      default: "active",
    },
    order: {
      type: Number,
      required: true,
    },
    badge: {
      type: [String],
      default: [],
    },
    topics: [
      {
        type: Schema.Types.ObjectId,
        ref: "Topic",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const ChapterModel =
  models.Chapter || model<IChapterDocument>("Chapter", chapterSchema);
