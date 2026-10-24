import mongoose from "mongoose";

export function getServerErrorMessageFromUnknownError(error: unknown): string {
  //  Mongoose Validation Error
  if (error instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(error.errors).map((e) => e.message);
    return messages.join(", ") || "Validation failed.";
  }

  //  Mongoose Cast Error (e.g., invalid ObjectId)
  if (error instanceof mongoose.Error.CastError) {
    return `Invalid ${error.path}: ${error.value}`;
  }

  //  Duplicate key error (MongoDB)
  // Example: E11000 duplicate key error collection: users index: email_1 dup key: { email: "test@test.com" }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as any).code === 11000
  ) {
    const keyValue = (error as any).keyValue || {};
    const field = Object.keys(keyValue)[0];
    return `${field ? field + " " : ""}already exists.`;
  }

  //  Custom API Error (if you use ApiErrorInstance on server too)
  if (error instanceof Error && error.name === "ApiError") {
    return error.message || "Application error occurred.";
  }

  //  Native JS Error
  if (error instanceof Error) {
    return error.message;
  }

  //  Unknown error type (string, number, object)
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "An unknown server error occurred.";
  }
}
