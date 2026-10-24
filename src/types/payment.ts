import { Types } from "mongoose";

export type MobileBankingType = "bKash" | "nagad" | "rocket";
export type PaymentStatusType = "pending" | "verified" | "rejected";
export type PlanType = "monthly" | "six_month" | "yearly" | "subject_yearly";

export interface IPaymentDocument {
  userId: Types.ObjectId;
  email: string;
  name?: string;
  plan: PlanType;
  durationDays: number;
  amount: number;
  currency: "BDT";
  paymentMethod: MobileBankingType;
  transactionId: string;
  selectedSubjects?: { subjectId: string; price: number }[];
  phoneNumber?: string;
  paymentStatus: "pending" | "verified" | "rejected";
  statusMessage?: string; // if invalid or rejected
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
