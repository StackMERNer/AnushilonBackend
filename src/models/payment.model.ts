import { Schema, model, models } from "mongoose";
import {
  IPaymentDocument,
  MobileBankingType,
  PaymentStatusType,
  PlanType,
} from "../types/payment";

const SelectedSubjectSchema = new Schema(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const paymentSchema = new Schema<IPaymentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },

    plan: {
      type: String,
      enum: [
        "monthly",
        "six_month",
        "yearly",
        "subject_yearly",
        "custom",
      ] satisfies (PlanType | "custom")[],
      required: true,
    },

    selectedSubjects: {
      type: [SelectedSubjectSchema],
    },

    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["BDT"],
      default: "BDT",
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["bKash", "nagad", "rocket"] satisfies MobileBankingType[],
      required: true,
    },

    transactionId: {
      type: String,
      trim: true,
      index: true,
    },

    phoneNumber: {
      type: String,
      trim: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"] satisfies PaymentStatusType[],
      default: "pending",
      required: true,
      index: true,
    },

    statusMessage: {
      type: String,
      trim: true,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const Payment =
  models.Payment || model<IPaymentDocument>("Payment", paymentSchema);
