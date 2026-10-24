import { randomUUID } from "crypto";
import { ImageModel } from "../models/Image";
import { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinaryConfig";
import { Request, Response } from "express";
const ACTIVE_PROVIDER = "imgbb";
export async function uploadImage(file: Express.Multer.File) {
  const imageId = `img_${randomUUID()}`;

  const [imgbb, cloudinary] = await Promise.all([
    uploadToImgBB(file),
    uploadToCloudinary(file),
  ]);

  await ImageModel.create({
    imageId,
    providers: {
      imgbb,
      cloudinary,
    },
  });

  return {
    imageId,
    url: imgbb.url,
  };
}
export interface UploadedImageProvider {
  url: string;
  metadata: Record<string, unknown>;
}

export async function uploadToCloudinary(
  file: Express.Multer.File,
): Promise<UploadedImageProvider> {
  const base64 = file.buffer.toString("base64");

  const dataUri = `data:${file.mimetype};base64,${base64}`;

  const result: UploadApiResponse = await cloudinary.uploader.upload(dataUri, {
    folder: "proshnokoshuploads",
    resource_type: "image",
  });

  return {
    url: result.secure_url,
    metadata: {
      publicId: result.public_id,
      version: result.version,
      bytes: result.bytes,
      format: result.format,
    },
  };
}

export interface UploadedImageProvider {
  url: string;
  metadata: Record<string, unknown>;
}

export async function uploadToImgBB(
  file: Express.Multer.File,
): Promise<UploadedImageProvider> {
  const imageBase64 = file.buffer.toString("base64");

  const body = new URLSearchParams({
    key: process.env.IMGBB_API_KEY!,
    image: imageBase64,
  });

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(
      `ImgBB upload failed: ${response.status} ${response.statusText}`,
    );
  }

  const result = await response.json();

  const data = result.data;

  return {
    url: data.url,
    metadata: {
      deleteUrl: data.delete_url,
      displayUrl: data.display_url,
      thumbUrl: data.thumb?.url,
      size: data.size,
      expiration: data.expiration,
    },
  };
}

export async function uploadImageController(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Image file is required",
      });
      return;
    }

    const result = await uploadImage(req.file);

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to upload image",
    });
  }
}

export async function getImageController(req: Request, res: Response) {
  // A clean, user-friendly 404 image placeholder
  const FALLBACK_IMAGE_URL =
    "https://placehold.co/200x50/e2e8f0/64748b?text=Image+Not+Found";

  try {
    const image = await ImageModel.findOne({
      imageId: req.params.imageId,
    });

    // If no document is found in DB, redirect to fallback image
    if (!image) {
      return res.redirect(FALLBACK_IMAGE_URL);
    }

    const imgbb = image.providers.get("imgbb");
    const cloudinary = image.providers.get("cloudinary");

    if (imgbb?.url) {
      return res.redirect(imgbb.url);
    } else if (cloudinary?.url) {
      return res.redirect(cloudinary.url);
    } else {
      // Document exists, but both provider URLs are empty/missing
      return res.redirect(FALLBACK_IMAGE_URL);
    }
  } catch (error) {
    console.error(error);
    // Even on server crash, redirect to fallback so the UI doesn't completely break
    return res.redirect(FALLBACK_IMAGE_URL);
  }
}

export async function deleteImageController(req: Request, res: Response) {
  try {
    const image = await ImageModel.findOneAndDelete({
      imageId: req.params.imageId,
    });

    if (!image) {
      res.status(404).json({
        success: false,
        message: "Image not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Image deleted",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete image",
    });
  }
}
