// mongodb error lists : https://github.com/mongodb/mongo/blob/master/src/mongo/base/error_codes.yml
const getFriendlyErrorMessage = (
  error: any
): { message: string; details?: any } => {
  if (error.name === "MongoServerError") {
    // Check for duplicate key error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue)[0]; // Get the field causing the duplicate
      return {
        message: `The value for '${duplicateField}' already exists. Please use a different value.`,
        details: error.keyValue, // Optional: Include details about the duplicate field
      };
    }

    // General MongoServerError handling
    return {
      message: error.message,
      details: {
        code: error.code,
        reason: error.message, // Include technical details for debugging
      },
    };
  }

  // Additional specific error handlers (e.g., ValidationError)
  if (error.name === "ValidationError") {
    return {
      message: error.message,
      details: error.errors, // Optional: Include validation error details
    };
  }

  // Generic error fallback
  return {
    message: error.message,
  };
};

export default getFriendlyErrorMessage;
