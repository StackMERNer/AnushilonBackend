import { Request, Response, NextFunction } from "express";
import { verifyInternalSecret } from "./ensureUserRecord";

export function requireServerSecret(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secret = req.headers["x-internal-secret"];
  const isVarified = verifyInternalSecret(secret as string);
  if (!isVarified) {
    res.status(401).json({ message: "Unauthorized: Invalid server request." });
    return;
  }
  next();
}
