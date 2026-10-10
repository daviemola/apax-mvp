import { Request, Response, NextFunction } from "express";
import User from "../models/userModel";
import asyncErrorHandler from "../middlewares/helpers/asyncErrorHandler";
import sendToken from "../utils/sendToken";
import ErrorHandler from "../utils/errorHandler";

const loginController = asyncErrorHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ErrorHandler("Please Enter Email And Password", 400));
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return next(new ErrorHandler("Invalid Email or Password", 401));
    }

    return sendToken(user, 200, res);
  }
);

export default loginController;
