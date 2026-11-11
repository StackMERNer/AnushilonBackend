import { Request, Response } from "express";
import { DashboardService } from "../services/dashboard.service";

const fail = (res: Response, err: unknown) => {
  console.error(err);
  return res
    .status(500)
    .json({ message: "কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করো" });
};

export const getSummary = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?._id) return res.status(401).json({ message: "আবার লগইন করো" });
  try {
    res.status(200).json(await DashboardService.getSummary(user._id));
  } catch (err) {
    fail(res, err);
  }
};

export const getSubjects = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?._id) return res.status(401).json({ message: "আবার লগইন করো" });
  try {
    res
      .status(200)
      .json(
        await DashboardService.getSubjects(user._id, {
          class: user.class,
          stream: user.stream,
        }),
      );
  } catch (err) {
    fail(res, err);
  }
};
