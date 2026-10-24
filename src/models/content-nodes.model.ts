import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContentNodeDocument extends Document {
  name: string;
  parent?: mongoose.Types.ObjectId | null;
  children: mongoose.Types.ObjectId[];
  order: number;
  isActive: boolean;
  creator?: mongoose.Types.ObjectId;
  descendantIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ContentNodeSchema = new Schema<IContentNodeDocument>(
  {
    name: { type: String, required: true, trim: true },
    parent: { type: Schema.Types.ObjectId, ref: "ContentNode", default: null },
    children: [{ type: Schema.Types.ObjectId, ref: "ContentNode" }],
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    creator: { type: Schema.Types.ObjectId, ref: "User" },
    descendantIds: [{ type: Schema.Types.ObjectId, ref: "ContentNode" }],
  },
  { timestamps: true },
);

// Indexes for high performance on hierarchical lookup & sorting
ContentNodeSchema.index({ parent: 1, order: 1 });

export const ContentNode: Model<IContentNodeDocument> =
  mongoose.models.ContentNode ||
  mongoose.model<IContentNodeDocument>("ContentNode", ContentNodeSchema);
