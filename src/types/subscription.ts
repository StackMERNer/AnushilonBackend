import { Types } from "mongoose";

export type SubscriptionType = "question_paper_create";

export interface ISubscriptionSubject {
  subjectId: Types.ObjectId;
  classId: Types.ObjectId;
  startedAt: Date;
  expiresAt: Date;
}

export interface ISubscriptionDocument {
  userId: Types.ObjectId;

  type: SubscriptionType;

  subjects: ISubscriptionSubject[];

  createdAt: Date;
  updatedAt: Date;
}
