import mongoose, { Schema, Document, models, model } from "mongoose";

interface IInstitute {
  name: string;
  address: string;
}

export interface ISubjectSubscription {
  subjectId: mongoose.Types.ObjectId;
  startedAt: Date;
  expiresAt: Date;
}

export interface IUser extends Document {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  role: "student" | "admin";
  institute?: IInstitute;
  subjectWiseSubscription: ISubjectSubscription[];
  subscription: {
    startedAt: Date;
    expiresAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema(
  {
    startedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      required: true,
      type: Date,
    },
  },
  {
    _id: false,
  },
);

const UserSchema = new Schema<IUser>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    photoURL: { type: String, default: "" },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },
    institute: {
      name: { type: String, default: "", trim: true, maxlength: 80 },
      address: { type: String, default: "", trim: true, maxlength: 80 },
    },
    subscription: {
      type: subscriptionSchema,
      default: undefined,
    },
  },
  { timestamps: true },
);

export const User =
  models.AnushilonUser || model<IUser>("AnushilonUser", UserSchema);
