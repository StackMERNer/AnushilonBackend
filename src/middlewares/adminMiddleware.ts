// create admin middleware using userId

import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";

const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any)?.user?._id;
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(401).json({
        message: "You are not authorized to perform this action.",
      });
      return;
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};

export default adminMiddleware;
