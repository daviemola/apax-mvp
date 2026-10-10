import { CookieOptions, Response } from "express";
import { IUser } from "../models/userModel";

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const sendToken = (user: IUser, statusCode: number, res: Response) => {
  const token = user.getJWTToken();

  const options: CookieOptions = {
    ...authCookieOptions,
    expires: new Date(
      Date.now() +
        Number(process.env.COOKIE_EXPIRE ?? 7) * 24 * 60 * 60 * 1000
    ),
  };

  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.resetPasswordToken;
  delete safeUser.resetPasswordExpire;

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    user: safeUser,
  });
};

export default sendToken;