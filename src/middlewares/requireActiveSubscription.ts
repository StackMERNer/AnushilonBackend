import { NextFunction, Response } from "express";
import { hasActiveSubscription } from "../lib/subscription";
import { IUser } from "../models/User";

export function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    !(req as any).user ||
    !hasActiveSubscription((req as any).user as IUser)
  ) {
    return res.status(403).json({
      message: "Active subscription required",
    });
  }

  next();
}
