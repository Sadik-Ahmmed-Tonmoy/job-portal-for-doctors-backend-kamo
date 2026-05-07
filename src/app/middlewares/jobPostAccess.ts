import { Request, Response, NextFunction } from "express";
import { Features_Flag } from "@prisma/client";

import httpStatus from "http-status";
import ApiError from "../../errors/ApiErrors";
import prisma from "../../shared/prisma";
import { ConnectionCheckOutStartedEvent } from "mongodb";

// interface FeatureAccessOptions {
//   features: Features_Flag[];
//   requireAll?: boolean;
// }
export const jobPostAccess = async (
  req: Request & { user?: any },
  res: Response,
  next: NextFunction,
) => {
  try {
    const userJobPostTrackFeature = req.user.trackUserFeatureUsages.find(
      (tr: any) => tr.feature == Features_Flag.JOB_POST,
    );

    if (!userJobPostTrackFeature) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Job post feature not available on your plan",
      );
    }

    if (
      userJobPostTrackFeature.limit > 0 &&
      userJobPostTrackFeature.limit <= userJobPostTrackFeature.usedCount
    ) {
      throw new ApiError(402, "you have reached your job post limit");
    }

    next();
  } catch (error: any) {
    console.log(error, "check error");
    next(error);
   
  }
};
