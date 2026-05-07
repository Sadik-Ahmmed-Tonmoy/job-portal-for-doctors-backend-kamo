import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiErrors";

const partnerPreference = () => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;
      const { considerSmoke, preferHijab } = req.body;

      switch (user.gender) {
        case "MALE":
          if (preferHijab === undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "As a male user, you must indicate whether you prefer your partner to wear a hijab."
            );
          }

          if (considerSmoke !== undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "As a male user, you should not provide the 'considerSmoke' field. It is only relevant for female users."
            );
          }
          break;

        case "FEMALE":
          if (considerSmoke === undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "As a female user, you must indicate whether you are open to a partner who smokes."
            );
          }

          if (preferHijab !== undefined) {
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "As a female user, you should not provide the 'preferHijab' field. It is only relevant for male users."
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

export default partnerPreference;
