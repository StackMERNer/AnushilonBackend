import { Schema, model, Document, models } from "mongoose";

export interface IBoard {
  refId: string;
  name: string;
  acronym?: string;
}

export interface IBoardDocument extends IBoard, Document {}

const boardSchema = new Schema<IBoardDocument>(
  {
    refId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    acronym: { type: String, trim: true },
  },
  { timestamps: true },
);

export const BoardModel =
  models.Board || model<IBoardDocument>("Board", boardSchema);
