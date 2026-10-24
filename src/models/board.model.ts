import { Schema, model, Document, models } from "mongoose";

export interface IBoard {
  name: string;
  acronym?: string;
}

export interface IBoardDocument extends IBoard, Document {}

const boardSchema = new Schema<IBoardDocument>(
  {
    name: { type: String, required: true, trim: true },
    acronym: { type: String, trim: true },
  },
  { timestamps: true },
);

export const BoardModel =
  models.Board || model<IBoardDocument>("Board", boardSchema);
