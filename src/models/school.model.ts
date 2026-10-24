import { Schema, model, Document, models } from "mongoose";

export interface ISchool {
  refId: string; // Old _id
  name: string;
}

export interface ISchoolDocument extends ISchool, Document {}

const schoolSchema = new Schema<ISchoolDocument>(
  {
    refId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

export const SchoolModel =
  models.School || model<ISchoolDocument>("School", schoolSchema);
