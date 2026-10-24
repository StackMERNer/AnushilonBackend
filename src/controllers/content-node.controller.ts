import { Request, Response } from "express";
import { ContentNode } from "../models/content-nodes.model";

// Get nodes (filtered by parent if requested, ordered by 'order')
export const getNodes = async (req: Request, res: Response) => {
  try {
    const { parentId } = req.query;
    const filter =
      parentId !== undefined
        ? { parent: parentId === "null" ? null : parentId }
        : {};

    const nodes = await ContentNode.find(filter).sort({ order: 1 });
    return res.status(200).json(nodes);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// get node by id
export const getNodeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const node = await ContentNode.findById(id);
    return res.status(200).json(node);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
// Create a new node
export const createNode = async (req: Request, res: Response) => {
  try {
    const { name, parent, isActive, creator } = req.body;
    const parentId = parent || null;

    // Determine the order for the new node (highest current order + 1)
    const lastNode = await ContentNode.findOne({ parent: parentId }).sort({
      order: -1,
    });
    const order = lastNode ? lastNode.order + 1 : 0;

    const newNode = await ContentNode.create({
      name,
      parent: parentId,
      order,
      isActive: isActive ?? true,
      creator,
      children: [],
      descendantIds: [],
    });

    // Update parent's children array if parent exists
    if (parentId) {
      await ContentNode.findByIdAndUpdate(parentId, {
        $push: { children: newNode._id },
      });
    }

    return res.status(201).json(newNode);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateNode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive, order } = req.body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = order;

    const updatedNode = await ContentNode.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!updatedNode) {
      return res.status(404).json({ message: "Node not found" });
    }

    return res.status(200).json(updatedNode);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
// Batch update order of siblings
export const reorderNodes = async (req: Request, res: Response) => {
  try {
    const { nodes } = req.body as { nodes: { _id: string; order: number }[] };

    if (!Array.isArray(nodes)) {
      return res.status(400).json({ message: "Invalid payload format" });
    }

    // Bulk execution for performance
    const bulkOps = nodes.map((node) => ({
      updateOne: {
        filter: { _id: node._id },
        update: { $set: { order: node.order } },
      },
    }));

    await ContentNode.bulkWrite(bulkOps);

    return res
      .status(200)
      .json({ success: true, message: "Nodes reordered successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
