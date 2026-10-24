// Declare modules for compiled JS models
declare module "dist/models/Question" {
  import { Document, Model } from "mongoose";
  const Question: Model<Document>;
  export default Question;
}

declare module "dist/models/ContentNode" {
  import { Document, Model } from "mongoose";
  const ContentNode: Model<Document>;
  export default ContentNode;
}

// Add other models as needed
declare module "dist/models/Subject" {
  import { Document, Model } from "mongoose";
  const Subject: Model<Document>;
  export default Subject;
}

// ...repeat for Part, Chapter, Topic, Board, Year, Unit
