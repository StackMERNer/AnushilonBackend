import { Request, Response } from "express";
import { Types } from "mongoose";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const oid = (v: unknown) =>
  typeof v === "string" && /^[a-f\d]{24}$/i.test(v)
    ? new Types.ObjectId(v)
    : null;

export const clamp = (v: unknown, def: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : def;
};

export function currentUserId(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user?._id) {
    res.status(401).json({ message: "আবার লগইন করো" });
    return null;
  }
  return user._id as Types.ObjectId;
}

export function fail(res: Response, err: unknown) {
  if (err instanceof HttpError)
    return res.status(err.status).json({ message: err.message });
  console.error(err);
  return res
    .status(500)
    .json({ message: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করো" });
}
