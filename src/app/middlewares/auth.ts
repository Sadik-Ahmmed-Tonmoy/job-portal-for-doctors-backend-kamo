import { NextFunction, Request, Response } from "express";

import config from "../../config";
import { Secret } from "jsonwebtoken";

import httpStatus from "http-status";
import { jwtHelpers } from "../../helpers/jwtHelpers";
import ApiError from "../../errors/ApiErrors";
import prisma from "../../shared/prisma";

const auth = (...roles: string[]) => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Verify token needed");
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        if (req.headers.accept === "text/event-stream") {
          res.writeHead(httpStatus.UNAUTHORIZED, {
            "Content-Type": "text/event-stream",
            Connection: "close",
          });
          res.write(
            `event: error\ndata: ${JSON.stringify({
              message: "User not found!",
            })}\n\n`,
          );
          res.end();
          return;
        }
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
      }

      const verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt.jwt_secret as Secret,
      );


      const existingUser = await prisma.user.findUnique({
        where: { id: verifiedUser.id },

        include: {
          trackUserFeatureUsages: true,
          UserSubscription: {
            include: {
              subscription: true,
            },
          },
          providerProfile: true,
          facilityProfile: true,
        },
      });
      if (!existingUser) {
        if (req.headers.accept === "text/event-stream") {
          res.writeHead(httpStatus.UNAUTHORIZED, {
            "Content-Type": "text/event-stream",
            Connection: "close",
          });
          res.write(
            `event: error\ndata: ${JSON.stringify({
              message: "User not found!",
            })}\n\n`,
          );
          res.end();
          return;
        }

        throw new ApiError(httpStatus.UNAUTHORIZED, "User not found!");
      }

      req.user = existingUser;

      if (roles.length && !roles.includes(existingUser.role)) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Forbidden! You are not authorized",
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

export default auth;
