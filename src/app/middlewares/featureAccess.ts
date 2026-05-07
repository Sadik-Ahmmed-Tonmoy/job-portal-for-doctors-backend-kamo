import { Request, Response, NextFunction } from "express";
import { Features_Flag } from "@prisma/client";

import httpStatus from "http-status";
import ApiError from "../../errors/ApiErrors";
import prisma from "../../shared/prisma";

interface FeatureAccessOptions {
  features: Features_Flag[];
  requireAll?: boolean;
}

export const featureAccess =
  ({ features, requireAll = true }: FeatureAccessOptions) =>
  async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized user");
      }

      const activeSubscription = await prisma.userSubscription.findFirst({
        where: {
          userId,
          status: "ACTIVE",
        },
        select: {
          subscription: {
            select: {
              subscriptionFeatures: {
                where: {
                  feature: { in: features },
                },
                select: {
                  feature: true,
                  limit: true,
                  frequency: true,
                  extraValue: true,
                },
              },
            },
          },
        },
      });

      const allowedFeatures =
        activeSubscription?.subscription?.subscriptionFeatures ?? [];

      const allowedFeatureNames = new Set(
        allowedFeatures.map((f) => f.feature),
      );

      const hasAccess = requireAll
        ? features.every((f) => allowedFeatureNames.has(f))
        : features.some((f) => allowedFeatureNames.has(f));

      if (!hasAccess) {
        throw new ApiError(
          402,
          "Required feature(s) not available in your subscription to access this feature try to purchase premium plan",
        );
      }

      req.user.featureAccess = allowedFeatures;

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }

      console.error("Feature access error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
