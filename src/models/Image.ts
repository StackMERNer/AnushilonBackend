import { Schema, model, InferSchemaType } from "mongoose";

const imageSchema = new Schema(
  {
    imageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    providers: {
      type: Map,
      of: {
        url: String,
        metadata: Schema.Types.Mixed,
      },
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export type ImageDocument = InferSchemaType<typeof imageSchema>;

export const ImageModel = model("Image", imageSchema);