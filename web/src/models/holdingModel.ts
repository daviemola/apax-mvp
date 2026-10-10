import mongoose, { Document, Schema, Types } from "mongoose";

export const ASSET_TYPES = ["gold", "silver", "platinum"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export interface IHolding extends Document {
  user: Types.ObjectId;
  asset: AssetType;
  amount: number;
  updatedAt: Date;
}

const holdingSchema = new Schema<IHolding>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    asset: {
      type: String,
      enum: ASSET_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

holdingSchema.index({ user: 1, asset: 1 }, { unique: true });

const Holding =
  mongoose.models.Holding ??
  mongoose.model<IHolding>("Holding", holdingSchema);

export default Holding;
