import { Request, Response, NextFunction } from "express";

const checkImageMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if a file is attached
  //   if (!req.file) {
  //     res
  //       .status(400)
  //       .json({ message: "No file uploaded. Please provide an image." });
  //     return;
  //   }

  //   // Validate the file type
  //   const validMimeTypes = ["image/jpeg", "image/png", "image/gif"];
  //   if (!validMimeTypes.includes(req.file.mimetype)) {
  //     res.status(400).json({
  //       message: "Invalid file type. Only JPEG, PNG, and GIF are allowed.",
  //     });
  //     return;
  //   }

  // If everything is fine, proceed to the next middleware
  next();
};

export default checkImageMiddleware;
