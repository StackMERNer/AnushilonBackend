import { Request, Response } from "express";
import { User } from "../models/User";
import { PaginatedResponse } from "../types/pagination";

// export const getUserOrCreate = async (req: Request, res: Response) => {
//   const { uid, email, displayName, photoURL } = req.body;
//   try {
//     let user = await User.findOne({ email });
//     if (user) {
//       // if (!(user.uid === uid)) {
//       //   user.uid = uid;
//       //   await user.save();
//       // }
//       return res.status(200).json(user);
//     }

//     // create new user if user does not exit with the email
//     user = new User({ uid, email, name: displayName, dpUrl: photoURL });
//     await user.save();
//     // add a notification for new resistered user.
//     const notification = new Notification({
//       user: user._id,
//       type: "USER_SIGN_UP",
//     });
//     await notification.save();
//     res.status(200).json(user);
//   } catch (error) {
//     res.status(500).json({ message: "Internal server error", error });
//   }
// };

// Controller: Fetch all users
export const getUsers = async (req: Request, res: Response) => {
  try {
    // Extract pagination parameters from query
    const page = parseInt(req.query.page as string) || 1; // Default to page 1
    const limit = parseInt(req.query.limit as string) || 10; // Default to 10 items per page
    const query: { [key: string]: string } = {};
    const role = req.query.role as string;

    if (role) query.role = role;
    // Calculate the starting index
    const startIndex = (page - 1) * limit;

    // Get total count of users
    const total = await User.countDocuments();

    // Fetch users with pagination
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    const totalPages = Math.ceil(total / limit);
    const paginatedResponse: PaginatedResponse<any> = {
      items: users,
      currentPage: page,
      limit,
      totalPages,
      totalItems: total,
      nextPage: page > totalPages ? page + 1 : null,
    };

    // Send paginated response
    res.status(200).json(paginatedResponse);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const params = req.params;
    const user = await User.findOne({ uid: params.uid });
    res.json(user);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Get the leaderboard
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    // Assuming you have a score field in the User model
    const leaderboard = await User.find().sort({ score: -1 }).limit(10);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Get the leaderboard
export const updateUser = async (req: Request, res: Response) => {
  const { _id } = req.params;
  const updates = req.body;
  try {
    const updateUser = await User.findOneAndUpdate({ _id }, updates, {
      new: true,
    });
    if (!updateUser) {
      return res.status(404).send({ message: "User not found!" });
    }
    res.send(updates);
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error", error: error });
  }
};
