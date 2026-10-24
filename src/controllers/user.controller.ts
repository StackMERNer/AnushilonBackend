import { Request, Response } from "express";
import { User } from "../models/User";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const skip = (page - 1) * limit;

    const [users, totalItems] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),

      User.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    const response = {
      items: users,
      totalItems,
      currentPage: page,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      limit,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("getAllUsers error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getUserByEmailOrId = async (req: Request, res: Response) => {
  try {
    const { emailOrId } = req.params;

    const user = await User.findOne({ $or: [{ email: emailOrId }] });

    return res.status(200).json(user);
  } catch (error) {
    console.error("getUserByEmailOrId error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
