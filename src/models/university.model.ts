import { Schema, model, Document, models } from "mongoose";

export interface IUniversity {
  refId: string;
  name: string;
  acronym?: string;
  type?: string;
}

export interface IUniversityDocument extends IUniversity, Document {}

const universitySchema = new Schema<IUniversityDocument>(
  {
    refId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    acronym: { type: String, trim: true },
    type: { type: String, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export const UniversityModel =
  models.University ||
  model<IUniversityDocument>("University", universitySchema);
