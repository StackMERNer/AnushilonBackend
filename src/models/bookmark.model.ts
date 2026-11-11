import { Schema, model, models, Types } from "mongoose";

export interface IBookmark {
  user: Types.ObjectId;
  question: Types.ObjectId;
  subject?: Types.ObjectId;
  chapter?: Types.ObjectId;
  topic?: Types.ObjectId;
}

const bookmarkSchema = new Schema<IBookmark>(
  {
    user: { type: Schema.Types.ObjectId, ref: "AnushilonUser", required: true },
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject" },
    chapter: { type: Schema.Types.ObjectId, ref: "Chapter" },
    topic: { type: Schema.Types.ObjectId, ref: "Topic" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookmarkSchema.index({ user: 1, question: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, createdAt: -1 });
bookmarkSchema.index({ user: 1, chapter: 1, createdAt: -1 });

export const BookmarkModel =
  models.Bookmark || model<IBookmark>("Bookmark", bookmarkSchema);
