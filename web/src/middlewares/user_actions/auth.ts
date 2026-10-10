import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../../models/userModel";
import ErrorHandler from "../../utils/errorHandler";
import { verifyAuthToken } from "../../utils/jwt";
import asyncErrorHandler from "../helpers/asyncErrorHandler";

/**
 * Extend Express Request to include user
 * (Ideally place this in a global typings file)
 */
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// Check if user is authenticated
export const isAuthenticatedUser = asyncErrorHandler(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token;

    if (!token) {
      return next(new ErrorHandler("Please Login to Access", 401));
    }

    try {
      const decodedData = verifyAuthToken(token);
      const user = await User.findById(decodedData.user_id);

      if (!user) {
        return next(new ErrorHandler("Please Login to Access", 401));
      }

      req.user = user;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new ErrorHandler("Invalid or expired token", 401));
      }

      return next(error);
    }
  }
);

// Role-based authorization
export const authorizeRoles =
  (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(`Role: ${req.user?.role} is not allowed`, 403)
      );
    }

    next();
  };