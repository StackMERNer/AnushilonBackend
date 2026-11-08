import { IFilterdQuestion } from "../models/question.model";

export type Rating = 1 | 2 | 3 | 4; // again, hard, good, easy
type Named = { _id: string; name: string };

export interface IStudyQuestion extends Omit<
  IFilterdQuestion,
  "boards" | "schools" | "universities"
> {
  studyMode: "auto" | "self";
  boards: { board: Named; year: number; order: number | null }[];
  schools: { school: Named; year: number | null; order: number | null }[];
  universities: {
    university: Named;
    year: number | null;
    order: number | null;
    unit: string | null;
  }[];
}

export interface IStudyItem {
  card: { state: "learning" | "review"; interval: number };
  question: IStudyQuestion;
}
export interface IStudyQueue {
  totalDue: number;
  items: IStudyItem[];
}
export interface IProgressRow {
  total: number;
  studied: number;
  mastered: number;
  due: number;
}
export interface IChapterProgress extends IProgressRow {
  chapterId: string;
  name: string;
}
export interface ITopicProgress extends IProgressRow {
  topicId: string;
  name: string;
}
