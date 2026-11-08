import mongoose from "mongoose";
import { QuestionModel } from "../models/question.model";
import { PASSAGE_TYPES, AUTO_TYPES } from "../config/questionTypeConfig";
import connectDB from "../config/db";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await connectDB();

  // 1. default everything that has no mode yet
  const self = await QuestionModel.updateMany(
    { studyMode: { $exists: false } },
    { $set: { studyMode: "self" } },
  );
  // 2. passages: not studyable
  const none = await QuestionModel.updateMany(
    { type: { $in: PASSAGE_TYPES } },
    { $set: { studyMode: "none" } },
  );
  // 3. MCQs that can actually be auto-checked
  const auto = await QuestionModel.updateMany(
    {
      type: { $in: AUTO_TYPES },
      correctMcq: { $ne: null },
      "options.0": { $exists: true },
    },
    { $set: { studyMode: "auto" } },
  );

  console.log({
    self: self.modifiedCount,
    none: none.modifiedCount,
    auto: auto.modifiedCount,
  });
  await mongoose.disconnect();
}
run();
