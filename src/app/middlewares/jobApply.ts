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
export const jobApply = async (
  req: Request & { user?: any },
  res: Response,
  next: NextFunction,
) => {
  try {
    const userJobApplyTrackFeature = req.user.trackUserFeatureUsages.find(
      (tr: any) => tr.feature == Features_Flag.JOB_APPLY,
    );

    // if (!userJobApplyTrackFeature) {
    //   throw new ApiError(
    //     httpStatus.FORBIDDEN,
    //     "Job post feature not available on your plan",
    //   );
    // }

    if (
      userJobApplyTrackFeature.limit > 0 &&
      userJobApplyTrackFeature.limit <= userJobApplyTrackFeature.usedCount
    ) {
      throw new ApiError(402, "you have reached your job apply  limit");
    }

    next();
  } catch (error: any) {
    console.log(error, "check error");
    next(error);
    // throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error);
  }
};
