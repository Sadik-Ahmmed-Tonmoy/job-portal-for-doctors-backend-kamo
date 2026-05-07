import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";

import sendResponse from "../../../shared/sendResponse";
import { jobService } from "./job.service";
import ApiError from "../../../errors/ApiErrors";

const createJob = catchAsync(async (req: Request, res: Response) => {
  const response = await jobService.createJob(req.body, req.user.id);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "job post create successfully",
    data: response,
  });
});

const searchJob = catchAsync(async (req: Request, res: Response) => {
  const { searchTerm, page, limit, distance, specialty, duration } = req.query;
  const response = await jobService.jobSearch(
    req.user.id,
    req.user,
    specialty,
    duration,
    searchTerm as string,
    Number(page) || 1,
    Number(limit) || 10,
    Number(distance),
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "job search results",
    data: response,
  });
});

const getAllJobPosts = catchAsync(async (req: Request, res: Response) => {
  const response = await jobService.getAllJobPosts();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All job posts retrieved successfully",
    data: response,
  });
});

const getJobsForFacilityByUserId = catchAsync(
  async (req: Request, res: Response) => {
    const response = await jobService.getJobsForFacilityByUserId(
      req.user.id,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Jobs for facility retrieved successfully",
      data: response,
    });
  },
);

const getJobById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  const response = await jobService.getJobById(
    id,
    userId,
    req.user.UserSubscription,
    req.user.role,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Job post retrieved successfully",
    data: response,
  });
});

const applyJob = catchAsync(async (req: Request, res: Response) => {
  const { jobId, facilityUserId } = req.body;
  const providerUserId = req.user.id;
  const response = await jobService.applyJob(
    providerUserId,
    jobId,
    facilityUserId,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Job application submitted successfully",
    data: response,
  });
});

const getAllAppliedJobsByJobId = catchAsync(
  async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const skip = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 10;

    const response = await jobService.getAllAppliedJobsByJobId(
      jobId,
      skip,
      limit,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All applied job applications retrieved successfully",
      data: response,
    });
  },
);

const getAllPendingRequestForJobApplicationByFacilityUserId = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const skip = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 10;

    const response =
      await jobService.getAllPendingRequestForJobApplicationByFacilityUserId(
        userId,
        skip,
        limit,
      );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All pending job application requests retrieved successfully",
      data: response,
    });
  },
);

const acceptOrDeclineApplication = catchAsync(
  async (req: Request, res: Response) => {
    const { applicationId } = req.params;
    const { action } = req.body; // action should be either "accept" or "decline"
    const response = await jobService.acceptOrDeclineApplication(
      applicationId,
      action,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: `Job application ${
        action === "APPROVED" ? "accepted" : "declined"
      } successfully`,
      data: response,
    });
  },
);

const getAllAcceptedAppliedJobs = catchAsync(
  async (req: Request, res: Response) => {
    const response = await jobService.getAllAcceptedAppliedJobs(
      req.user.id,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All accepted job applications retrieved successfully",
      data: response,
    });
  },
);

const getAllJobsByDate = catchAsync(async (req: Request, res: Response) => {
  const date = new Date(req.query.date as string);

  if (!date) {
    throw new ApiError(400, "Date query param is required");
  }

  const response = await jobService.getJobsByDateWithApplicationCount(
    date,
    Number(req.query.page) || 1,
    Number(req.query.limit) || 10,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All jobs for the specified date retrieved successfully",
    data: response,
  });
});

const getAllApprovedJobsByDate = catchAsync(
  async (req: Request, res: Response) => {
    const date = new Date(req.query.date as string);

    if (!date) {
      throw new ApiError(400, "Date query param is required");
    }

    const response = await jobService.getAllApprovedJobsByDate(
      req.user.id,
      date,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message:
        "All approved jobs for the specified date retrieved successfully",
      data: response,
    });
  },
);

const completeJobApplication = catchAsync(
  async (req: Request, res: Response) => {
    const { applicationId } = req.params;
    const { completionStatus } = req.body;
    const response = await jobService.completeJobApplication(
      applicationId,
      completionStatus,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: `Job application marked as ${completionStatus} successfully`,
      data: response,
    });
  },
);

const getAllCancelledRequestAndCancelledApplications = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const date = new Date(req.query.date as string);
    const status = req.query.status as "CANCELLED" | "REQUESTED" | "ALL";

    if (!date) {
      throw new ApiError(400, "Date query param is required");
    }
    const response =
      await jobService.getAllCancelRequestAndCancelledApplications(
        userId,
        date,
        status,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 10,
      );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All cancelled job application requests retrieved successfully",
      data: response,
    });
  },
);

const approveOrRejectCancellationRequest = catchAsync(
  async (req: Request, res: Response) => {
    const { applicationId } = req.params;
    const { action } = req.body; // action should be either "approve" or "reject"
    const response = await jobService.approveOrRejectCancellationRequest(
      applicationId,
      action,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: `Job application ${action === "approve" ? "approved" : "rejected"} successfully`,
      data: response,
    });
  },
);

const hireProviderFromFacility = catchAsync(
  async (req: Request, res: Response) => {
    const { providerUserId, jobId } = req.body;

    const response = await jobService.hireProviderFromFacility(
      providerUserId,
      jobId,
      req.user.id,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Provider hired successfully",
      data: response,
    });
  },
);

const allAppliedJobsForProvider = catchAsync(
  async (req: Request, res: Response) => {
    const providerUserId = req.user.id;
    const response = await jobService.allAppliedJobsForProvider(
      providerUserId,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All applied jobs for provider retrieved successfully",
      data: response,
    });
  },
);

const allCompletedJobsForProvider = catchAsync(
  async (req: Request, res: Response) => {
    const providerUserId = req.user.id;
    const response = await jobService.allCompletedJobsForProvider(
      providerUserId,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All completed jobs for provider retrieved successfully",
      data: response,
    });
  },
);

const cancelRequestFromProvider = catchAsync(
  async (req: Request, res: Response) => {
    const { jobPostId, cancellationReason } = req.body;
    const providerUserId = req.user.id;

    const response = await jobService.cancelRequestFromProvider(
      providerUserId,
      jobPostId,
      cancellationReason,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Cancellation request sent successfully",
      data: response,
    });
  },
);

const getAllJobsUsingFacilityUserId = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const response = await jobService.getAllJobsUsingFacilityUserId(
      userId,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All jobs for facility retrieved successfully",
      data: response,
    });
  },
);

const allRequestedJobsForProvider = catchAsync(
  async (req: Request, res: Response) => {
    const providerUserId = req.user.id;
    const response = await jobService.allRequestedJobsForProvider(
      providerUserId,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All requested jobs for provider retrieved successfully",
      data: response,
    });
  },
);

const allCancelledJobsForProvider = catchAsync(
  async (req: Request, res: Response) => {
    const providerUserId = req.user.id;
    const response = await jobService.allCancelledJobsForProvider(
      providerUserId,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All cancelled jobs for provider retrieved successfully",
      data: response,
    });
  },
);

const getMatchedUsersByJobRole = catchAsync(
  async (req: Request, res: Response) => {
    const jobRole = req.query.jobRole as string;

    const response = await jobService.getMatchedUsersByJobRole(
      jobRole,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Matched users retrieved successfully",
      data: response,
    });
  },
);

const saveJob = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const jobPostId = req.params.jobPostId;
  const response = await jobService.saveJob(userId, jobPostId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Job saved successfully",
    data: response,
  });
});

const getSavedJobs = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const response = await jobService.getSavedJobs(
    userId,
    Number(req.query.page) || 1,
    Number(req.query.limit) || 10,
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Saved jobs retrieved successfully",
    data: response,
  });
});

const removeSavedJob = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { jobPostId } = req.params;
  const response = await jobService.removeSavedJob(userId, jobPostId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Job removed from saved jobs",
    data: response,
  });
});

export const jobController = {
  createJob,
  searchJob,
  getAllJobPosts,
  getJobsForFacilityByUserId,
  getJobById,
  applyJob,
  getAllAppliedJobsByJobId,
  getAllPendingRequestForJobApplicationByFacilityUserId,
  acceptOrDeclineApplication,
  getAllAcceptedAppliedJobs,
  getAllJobsByDate,
  getAllApprovedJobsByDate,
  completeJobApplication,
  getAllCancelledRequestAndCancelledApplications,
  approveOrRejectCancellationRequest,
  hireProviderFromFacility,
  allAppliedJobsForProvider,
  allCompletedJobsForProvider,
  cancelRequestFromProvider,
  getAllJobsUsingFacilityUserId,
  allRequestedJobsForProvider,
  allCancelledJobsForProvider,
  getMatchedUsersByJobRole,
  saveJob,
  getSavedJobs,
  removeSavedJob,
};
