import { Schema, model, Document, models } from "mongoose";

export interface ISchool {
  name: string;
}

export interface ISchoolDocument extends ISchool, Document {}

const schoolSchema = new Schema<ISchoolDocument>(
  {
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
