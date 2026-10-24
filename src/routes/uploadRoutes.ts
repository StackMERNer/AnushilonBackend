// uploadRoutes
import express from "express";
import cloudinary from "../config/cloudinaryConfig";
import { Request, Response } from "express";
import upload from "../middlewares/uploadMiddleware";

const router = express.Router();

// router.post("/test", async (req, res) => {
//   res.send("Upload Page");
// });

// Cloudinary upload endpoint
router.post(
  "/upload",
  upload.single("file"),
  // checkImageMiddleware,
  async (req: Request, res: Response) => {
    // console.log("req", req.body);
    try {
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Create a Promise to handle the upload stream
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "auto", folder: "items" }, // 'auto' determines the resource type (e.g., image or video)
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        // Pipe the buffer to Cloudinary
        uploadStream.end(req.file?.buffer);
      });

      // Send the uploaded file's URL as a response
      res.status(200).json({ imageUrl: (result as any)?.secure_url });
    } catch (error: any) {
      console.error("Cloudinary upload error:", error);
      res
        .status(500)
        .json({ error: `Error uploading image: ${error.message}` });
    }
  }
);

// Cloudinary delete endpoint
router.delete("/delete", async (req: Request, res: Response) => {
  const { imageUrl } = req.query;

  // Validate that image URL is provided
  if (!imageUrl) {
    res.status(400).json({ message: "No image URL provided" });
    return;
  }

  try {
    // Extract publicId from the image URL
    const regex = /\/upload\/(?:v[0-9]+\/)?(.+?)(?=\.[a-zA-Z]{3,4}$)/;
    const matches = (imageUrl as string).match(regex);
    if (!matches || matches.length < 2) {
      res.status(400).json({ message: "Invalid image URL" });
      return;
    }

    const publicId = matches[1]; // Extracted publicId

    // Delete image from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok") {
      res.status(200).json({ message: "Image deleted successfully" });
    } else {
      res.status(400).json({ message: "Image not found or already deleted" });
    }
  } catch (error: any) {
    res.status(500).json({ message: `Error deleting image: ${error.message}` });
  }
});

export default router;
