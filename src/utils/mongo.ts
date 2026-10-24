import mongoose from "mongoose";

export const toObjectIds = (ids: string | string[]) => {
  if (Array.isArray(ids))
    return ids.map((id) => new mongoose.Types.ObjectId(id));
  return new mongoose.Types.ObjectId(ids);
};
