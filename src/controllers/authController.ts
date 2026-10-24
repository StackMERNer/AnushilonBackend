import { Request, Response } from "express";
import { IUser, User } from "../models/User";
import { getServerErrorMessageFromUnknownError } from "../utils/utils";

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    //  Validate input
    if (!email || !password) {
      res.status(400).json({ message: "Missing required fields." });
      return;
    }

    //  Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: "User already exists." });
      return;
    }

    //  Create and save new user
    const user = new User({ name, email, password });
    await user.save();

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error: unknown) {
    console.error("❌ Registration error:", error);
    res
      .status(500)
      .json({ message: getServerErrorMessageFromUnknownError(error) });
    return;
  }
};

export const me = async (req: Request, res: Response) => {
  const user = await User.findOne({ _id: (req as any).user?._id }).lean();
  if (!user) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  res.json(user);
};

export const updateUserProfile = async (req: Request, res: Response) => {
  const _id = (req as any).user?._id;
  const updates: Partial<IUser> = req.body;
  if (!_id) {
    res.status(404).send({ message: "Unathorized. user _id not found!" });
    return;
  }
  const allowedFields: (keyof IUser)[] = ["name", "institute", "photoURL"];
  // Filter updates to only include allowed fields
  const filteredUpdates: Partial<IUser> = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      filteredUpdates[field] = updates[field];
    }
  }
  try {
    const updateUser = await User.findOneAndUpdate({ _id }, filteredUpdates, {
      new: true,
    });
    if (!updateUser) {
      res.status(404).send({ message: "User not found!" });
      return;
    }
    res.send(updateUser);
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
};
