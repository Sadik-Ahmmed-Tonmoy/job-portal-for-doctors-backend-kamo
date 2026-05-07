import { NextFunction, Request, Response } from "express";
import config from "../../config";
import { Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import { jwtHelpers } from "../../helpers/jwtHelpers";
import ApiError from "../../errors/ApiErrors";
import prisma from "../../shared/prisma";

const verifyOtpToken = (...roles: string[]) => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Verify token needed");
      }

      const token = authHeader.split(" ")[1];
      const { reason } = req.body;

      if (!token) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Verify token needed");
      }

      let secretKey: Secret | undefined;

      switch (reason) {
        case "SIGNUP_OTP_SECRET":
          secretKey = config.otpSecret.signup_otp_secret;
          break;
        case "RESET_PASSWORD_SECRET":
          secretKey = config.otpSecret.reset_password_secret;
          break;
        case "LOGIN_OTP_SECRET":
          secretKey = config.otpSecret.login_otp_secret;
          break;
        case "FORGET_PASSWORD_SECRET":
          secretKey = config.otpSecret.forget_password_secret;
          break;
        default:
          throw new ApiError(httpStatus.BAD_REQUEST, "Invalid reason provided");
      }

      if (!secretKey) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Secret key missing");
      }

      const verifiedUser = jwtHelpers.verifyToken(token, secretKey);
    

      const existingUser = await prisma.user.findUnique({
        where: { id: verifiedUser.id },
      });

      if (!existingUser) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "User not found!");
      }

      req.user = verifiedUser;

      if (roles.length && !roles.includes(verifiedUser.role)) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Forbidden! You are not authorized"
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export default verifyOtpToken;
