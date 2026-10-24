// create content controller

import { Request, Response } from "express";
import { ContentModel } from "../models/content.model";
import { PaginatedResponse } from "../types/pagination";
import { Types } from "mongoose";
import { ContentNode } from "../models/content-nodes.model";

export const createContent = async (req: Request, res: Response) => {
  try {
    const newContent = await ContentModel.create(req.body);
    // get populated new content
    const populatedContent = await ContentModel.findById(
      newContent._id,
    ).populate("contentNode");
    return res.status(201).json(populatedContent);
  } catch (error) {
    return res.status(400).json({ message: "Failed to create content", error });
  }
};
// Helper function to recursively retrieve all descendant node IDs
const getAllDescendantNodeIds = async (
  targetNodeId: string | Types.ObjectId,
): Promise<string[]> => {
  const descendantIds: string[] = [targetNodeId.toString()];

  const getChildren = async (parentId: string) => {
    // Find direct children of the current node
    const children = await ContentNode.find({ parent: parentId })
      .select("_id")
      .lean();

    for (const child of children) {
      const childId = child._id.toString();
      descendantIds.push(childId);
      // Recursively fetch children of this child
      await getChildren(childId);
    }
  };

  await getChildren(targetNodeId.toString());
  return descendantIds;
};

export const getContentFilesByContentNode = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { page: reqPage, limit: reqLimit } = req.query;

    // 1. Parse & sanitize pagination query params
    const page = Math.max(1, parseInt(reqPage as string, 10) || 1);
    const limit = 20; // default
    // const limit = Math.max(
    //   1,
    //   Math.min(100, parseInt(reqLimit as string, 10) || 10),
    // );
    const skip = (page - 1) * limit;

    // 2. Gather target node ID and all descendant node IDs
    const targetAndDescendantNodeIds = await getAllDescendantNodeIds(
      id as string,
    );

    // 3. Filter contents matching any of the collected node IDs
    const filter = { contentNode: { $in: targetAndDescendantNodeIds } };

    // 4. Query items and total count concurrently
    const [items, totalItems] = await Promise.all([
      ContentModel.find(filter)
        .skip(skip)
        .limit(limit)
        .populate("contentNode")
        .lean(),
      ContentModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    const nextPage = page < totalPages ? page + 1 : null;

    const response: PaginatedResponse<(typeof items)[number]> = {
      items,
      totalItems,
      currentPage: page,
      totalPages,
      nextPage,
      limit,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    return res.status(500).json({
      message: "Failed to fetch content files",
      error: error.message || error,
    });
  }
};
