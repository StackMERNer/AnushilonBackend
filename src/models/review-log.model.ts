import { Schema, model, models, Types } from "mongoose";

const reviewLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, required: true },
  question: { type: Schema.Types.ObjectId, required: true },
  rating: { type: Number, required: true },
  auto: { type: Boolean, default: false },
  prevInterval: Number,
  newInterval: Number,
  timeTakenMs: Number,
  reviewedAt: { type: Date, default: Date.now },
});
reviewLogSchema.index({ user: 1, reviewedAt: -1 });

export const ReviewLogModel =
  models.ReviewLog || model("ReviewLog", reviewLogSchema);
