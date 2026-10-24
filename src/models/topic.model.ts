import { Schema, model, Document, Types, models } from "mongoose";

export interface ITopic {
  name: string;
  chapter: Types.ObjectId; // References the Chapter ObjectId
  isActive: boolean;
  order: number;
}

export interface ITopicDocument extends ITopic, Document {}

const topicSchema = new Schema<ITopicDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    chapter: {
      type: Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
    },
  },
  { timestamps: true },
);

export const TopicModel =
  models.Topic || model<ITopicDocument>("Topic", topicSchema);
