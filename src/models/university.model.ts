import { Schema, model, Document, models } from "mongoose";

export interface IUniversity {
  name: string;
  acronym?: string;
  type?: string;
}

export interface IUniversityDocument extends IUniversity, Document {}

const universitySchema = new Schema<IUniversityDocument>(
  {
    name: { type: String, required: true, trim: true },
    acronym: { type: String, trim: true },
    type: { type: String, lowercase: true, trim: true }, // medical, engineering etc
  },
  { timestamps: true },
);

export const UniversityModel =
  models.University ||
  model<IUniversityDocument>("University", universitySchema);
