import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiErrors";

const religiousDetailsVerify = () => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;
      const {
        isRevert,
        revertHowLong,
        isSmoke,
        wearHijab,
        considerHijab,
      } = req.body;

      if (isRevert && (!revertHowLong || revertHowLong.trim() === "")) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Since you marked yourself as a revert Muslim, please specify how long you've been a revert."
        );
      }

      switch (user.gender) {
        case "MALE":
          if (isSmoke === undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "As a male user, you must specify whether you smoke."
            );
          }

          if (wearHijab !== undefined || considerHijab !== undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "As a male user, you should not provide hijab-related fields."
            );
          }
          break;

        case "FEMALE":
          if (wearHijab === undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "As a female user, please specify whether you wear hijab."
            );
          }

          if (wearHijab === false && considerHijab === undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "Since you do not wear hijab, please indicate if you would consider wearing it."
            );
          }

 
          break;

        default:
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Invalid gender '${user.gender}' provided. Gender must be either 'MALE' or 'FEMALE'.`
          );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export default religiousDetailsVerify;
