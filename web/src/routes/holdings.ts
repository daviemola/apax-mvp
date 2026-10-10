import { Router, Response } from "express";
import asyncErrorHandler from "../middlewares/helpers/asyncErrorHandler";
import {
  AuthenticatedRequest,
  isAuthenticatedUser,
} from "../middlewares/user_actions/auth";
import Holding, {
  ASSET_TYPES,
  AssetType,
} from "../models/holdingModel";

interface PortfolioHolding {
  asset: AssetType;
  amount: number;
  updatedAt: Date | null;
}

const isAssetType = (asset: unknown): asset is AssetType =>
  typeof asset === "string" &&
  (ASSET_TYPES as readonly string[]).includes(asset);

const router = Router();

router.get(
  "/",
  isAuthenticatedUser,
  asyncErrorHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Please Login to Access",
        });
        return;
      }

      const records = await Holding.find({ user: user._id })
        .select("asset amount updatedAt")
        .lean()
        .exec();

      const holdings: Record<AssetType, PortfolioHolding> = {
        gold: { asset: "gold", amount: 0, updatedAt: null },
        silver: { asset: "silver", amount: 0, updatedAt: null },
        platinum: { asset: "platinum", amount: 0, updatedAt: null },
      };

      for (const record of records) {
        const asset: unknown = record.asset;
        if (!isAssetType(asset)) {
          continue;
        }

        holdings[asset] = {
          asset,
          amount: record.amount,
          updatedAt: record.updatedAt,
        };
      }

      res.status(200).json({
        success: true,
        data: {
          userId: user._id.toString(),
          holdings,
        },
      });
    }
  )
);

export default router;
