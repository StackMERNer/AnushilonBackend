import { Schema, model, Document, models } from "mongoose";

export interface IClass {
  name: string;
  order: number;
}

export interface IClassDocument extends IClass, Document {}

const classSchema = new Schema<IClassDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

export const ClassModel =
  models.Class || model<IClassDocument>("Class", classSchema);
