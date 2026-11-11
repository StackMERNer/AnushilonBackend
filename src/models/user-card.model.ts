import { Schema, model, models, Types, Document } from "mongoose";

export interface IUserCard {
  user: Types.ObjectId;
  question: Types.ObjectId;
  type?: string;
  // denormalized from the question so progress needs no joins
  subject?: Types.ObjectId;
  chapter?: Types.ObjectId;
  topic?: Types.ObjectId;
  state: "learning" | "review";
  dueAt: Date;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReviewedAt?: Date;
  lastRating?: number;
}
export interface IUserCardDocument extends IUserCard, Document {}

const userCardSchema = new Schema<IUserCardDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "AnushilonUser", required: true },
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    type: { type: String },
    subject: { type: Schema.Types.ObjectId, ref: "Subject" },
    chapter: { type: Schema.Types.ObjectId, ref: "Chapter" },
    topic: { type: Schema.Types.ObjectId, ref: "Topic" },
    state: { type: String, enum: ["learning", "review"], default: "learning" },
    dueAt: { type: Date, required: true, default: () => new Date() },
    interval: { type: Number, default: 0 },
    ease: { type: Number, default: 2.5 },
    reps: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    lastReviewedAt: { type: Date },
    lastRating: { type: Number },
  },
  { timestamps: true },
);

userCardSchema.index({ user: 1, dueAt: 1 });
userCardSchema.index({ user: 1, question: 1 }, { unique: true });
userCardSchema.index({ user: 1, subject: 1, chapter: 1 });
userCardSchema.index({ user: 1, chapter: 1, topic: 1 });

export const UserCardModel =
  models.UserCard || model<IUserCardDocument>("UserCard", userCardSchema);
