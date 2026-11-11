export const QUESTION_FIELDS =
  "refId type context question options correctMcq questions answer boards tags level difficulty sameContextQuesId studyMode";

export const POPULATE = [
  { path: "boards.board", select: "name acronym" },
  { path: "schools.school", select: "name" },
  { path: "universities.university", select: "name" },
];
