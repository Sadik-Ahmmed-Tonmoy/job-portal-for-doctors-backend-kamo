import express from "express";

import validateRequest from "../../middlewares/validateRequest";
import { jobController } from "./job.controller";
import { jobValidation } from "./job.validation";
import { Features_Flag, UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import { featureAccess } from "../../middlewares/featureAccess";
import { jobPostAccess } from "../../middlewares/jobPostAccess";
import { jobApply } from "../../middlewares/jobApply";

const router = express.Router();

router.post(
  "/create",
  auth(UserRole.FACILITY),
  jobPostAccess,
  validateRequest(jobValidation.createJobSchema),

  jobController.createJob,
);
router.get(
  "/facility",
  auth(UserRole.FACILITY),
  jobController.getJobsForFacilityByUserId,
);

router.get(
  "/all-pending-requests",
  auth(UserRole.FACILITY),
  jobController.getAllPendingRequestForJobApplicationByFacilityUserId,
);

router.get(
  "/search-jobs",
  auth(UserRole.PROVIDER, UserRole.FACILITY, UserRole.ADMIN),
  jobController.searchJob,
);

router.get(
  "/all",
  // auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getAllJobPosts,
);

router.get(
  "/all-jobs-by-date",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getAllJobsByDate,
);

router.get(
  "/all-accepted",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getAllAcceptedAppliedJobs,
);

router.get(
  "/all-approved-jobs-by-date",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getAllApprovedJobsByDate,
);

router.post(
  "/apply",
  auth(UserRole.PROVIDER),
  jobApply,
  jobController.applyJob,
);

router.get(
  "/all-applied-by-job-id/:jobId",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getAllAppliedJobsByJobId,
);

router.patch(
  "/accept-or-decline-application/:applicationId",
  auth(UserRole.FACILITY, UserRole.PROVIDER),
  jobController.acceptOrDeclineApplication,
);

router.patch(
  "/complete-application/:applicationId",
  auth(UserRole.FACILITY),
  jobController.completeJobApplication,
);

router.get(
  "/all-cancelled",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getAllCancelledRequestAndCancelledApplications,
);

router.post(
  "/approve-or-reject-cancellation/:applicationId",
  auth(UserRole.FACILITY),
  jobController.approveOrRejectCancellationRequest,
);

router.post(
  "/hire-provider",
  auth(UserRole.FACILITY),
  jobController.hireProviderFromFacility,
);

router.get(
  "/get-all-applied-jobs-by-provider",
  auth(UserRole.PROVIDER),
  jobController.allAppliedJobsForProvider,
);

router.get(
  "/get-all-completed-jobs-by-provider",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.allCompletedJobsForProvider,
);

router.post(
  "/cancel-request-from-provider",
  auth(UserRole.PROVIDER),
  jobController.cancelRequestFromProvider,
);

router.get(
  "/get-all-jobs-using-facility-user-id/:id",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getAllJobsUsingFacilityUserId,
);

router.get(
  "/get-all-requested-jobs-by-provider",
  auth(UserRole.PROVIDER),
  jobController.allRequestedJobsForProvider,
);

router.get(
  "/get-all-cancelled-jobs-by-provider",
  auth(UserRole.PROVIDER),
  jobController.allCancelledJobsForProvider,
);

router.get(
  "/get-matched-users-by-job-role",
  auth(UserRole.FACILITY),
  jobController.getMatchedUsersByJobRole,
);


router.post(
  "/save-job/:jobPostId",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.saveJob,
);

router.get(
  "/get-saved-jobs",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getSavedJobs,
);

router.delete(
  "/remove-saved-job/:jobPostId",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.removeSavedJob,
);

 
router.get(
  "/:id",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  jobController.getJobById,
);

export const jobRoute = router;
