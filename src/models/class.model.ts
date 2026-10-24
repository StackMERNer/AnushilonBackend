import { Schema, model, Document, models } from "mongoose";
export type PricingScope = "whole_class" | "individual_subject";

export interface IClassPricing {
  scope: PricingScope;
  durationDays: number;
  price: number;
}
export interface IClass {
  refId: string;
  name: string;
  order: number;
  pricing: IClassPricing[];
}
const classPricingSchema = new Schema<IClassPricing>(
  {
    scope: {
      type: String,
      enum: ["whole_class", "individual_subject"],
      required: true,
    },

    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);
export interface IClassDocument extends IClass, Document {}

const classSchema = new Schema<IClassDocument>(
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
    order: {
      type: Number,
      required: true,
    },
    pricing: {
      type: [classPricingSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const ClassModel =
  models.Class || model<IClassDocument>("Class", classSchema);
