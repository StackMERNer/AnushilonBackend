import { NextFunction, Request, Response } from "express";

export function isValidServerSecret(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const secret = req.headers["x-app-secret"];

  if (secret === process.env.INTERNAL_SECRET) {
    // Request is from your server
    (req as any).isContainValidSecret = true;
  }
  next();
}
