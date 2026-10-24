import { Schema, model, models, Document } from "mongoose";
type tagType =
  | "guide"
  | "main_book"
  | "lecture_sheet"
  | "main_book_solved"
  | "others";
export interface IContentDocument extends Document {
  title?: string;
  description?: string;
  url: string;
  contentNode: Schema.Types.ObjectId;
  type: "pdf" | "docx";
  tags: tagType[];
}

const contentSchema = new Schema<IContentDocument>(
  {
    title: { type: String, required: false, trim: true },
    description: { type: String, trim: true },
    url: { type: String, required: true },
    contentNode: {
      type: Schema.Types.ObjectId,
      ref: "ContentNode",
      required: true,
    },
    type: { type: String, enum: ["pdf", "docx"], required: true },
    tags: [
      {
        type: String,
        enum: [
          "guide",
          "main_book",
          "lecture_sheet",
          "main_book_solved",
          "others",
        ],
        required: true,
      },
    ],
  },
  { timestamps: true },
);

export const ContentModel =
  models.Content || model<IContentDocument>("Content", contentSchema);
