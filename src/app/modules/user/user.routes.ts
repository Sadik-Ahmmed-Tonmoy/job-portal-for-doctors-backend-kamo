import express from "express";

import { Features_Flag, UserRole } from "@prisma/client";
import { fileUploader } from "../../../helpers/fileUploader";
import auth from "../../middlewares/auth";
import { parseBodyData } from "../../middlewares/parseBodyData";
import validateRequest from "../../middlewares/validateRequest";
import { userController } from "./user.controller";
import { userValidation } from "./user.validation";
import { featureAccess } from "../../middlewares/featureAccess";
// import { injectFileIntoBody } from "../../middlewares/injectFile";

const router = express.Router();

router.post(
  "/create",
  validateRequest(userValidation.userRegisterValidationSchema),
  userController.createUser,
);

router.patch(
  "/update-provider-profile",
  auth(UserRole.PROVIDER),
  fileUploader.providerDocumentAndImage,
  parseBodyData,
  validateRequest(userValidation.updateProviderProfile),
  userController.updateProviderProfile,
);
router.patch(
  "/update-provider-document",
  auth(UserRole.PROVIDER),
  fileUploader.providerDocument,
  parseBodyData,
  userController.updateProviderResume,
);

router.patch(
  "/update-provider-BLS",
  auth(UserRole.PROVIDER),
  fileUploader.providerBLS,
  parseBodyData,
  userController.updateProviderBLS,
);

router.patch(
  "/update-provider-ACLS",
  auth(UserRole.PROVIDER),
  fileUploader.providerACLS,
  parseBodyData,
  userController.updateProviderACLS,
);

router.patch(
  "/update-provider-PALS",
  auth(UserRole.PROVIDER),
  fileUploader.providerPALS,
  parseBodyData,
  userController.updateProviderPALS,
);

router.patch(
  "/update-provider-DIPLOMA",
  auth(UserRole.PROVIDER),
  fileUploader.providerDIPLOMA,
  parseBodyData,
  userController.updateProviderDIPLOMA,
);

router.patch(
  "/update-provider-LICENCE",
  auth(UserRole.PROVIDER),
  fileUploader.providerLICENCE,
  parseBodyData,
  userController.updateProviderLICENCE,
);

router.delete(
  "/delete-provider-BLS",
  auth(UserRole.PROVIDER),
  userController.deleteProviderBLS, 
);
router.delete(
  "/delete-provider-ACLS",
  auth(UserRole.PROVIDER),
  userController.deleteProviderACLS,
);
router.delete(
  "/delete-provider-PALS",
  auth(UserRole.PROVIDER),
  userController.deleteProviderPALS,
);
router.delete(
  "/delete-provider-DIPLOMA",
  auth(UserRole.PROVIDER),
  userController.deleteProviderDIPLOMA,
);
router.delete(
  "/delete-provider-LICENCE",
  auth(UserRole.PROVIDER),
  userController.deleteProviderLICENCE,
);


router.patch(
  "/select-uploaded-resume",
  auth(UserRole.PROVIDER),
  userController.selectUploadedResume,
);

router.delete(
  "/delete-document",
  auth(UserRole.PROVIDER),
  userController.deleteDocument,
);

router.post(
  "/create-facility-profile",
  auth(UserRole.FACILITY),
  parseBodyData,
  userController.createFacilityProfile,
);

router.patch(
  "/update-facility-profile",
  auth(UserRole.FACILITY),
  fileUploader.profileImage,
  parseBodyData,
  validateRequest(userValidation.updateFacilityProfile),
  userController.updateFacilityProfile,
);

router.get(
  "/get-profile",
  auth(UserRole.PROVIDER, UserRole.FACILITY, UserRole.ADMIN),
  userController.getUserProfile,
);

router.get(
  "/get-profile-by-id/:id",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  userController.getProfileById,
);

router.get(
  "/get-backup-users/:jobId",
  auth(UserRole.FACILITY),
  featureAccess({
    features: [Features_Flag.FEATURED_LISTING],

  }),
  userController.getBackUpUsersByJobId,
);

router.get(
  "/get-providers-by-facility",
  auth(UserRole.FACILITY),
  userController.getProvidersByFacilityId,
);
router.get(
  "/get-upcoming-schedule",
  auth(UserRole.PROVIDER),
  userController.getUpcomingSchedue,
);
router.get(
  "/get-provider-upcoming-schedule",
  auth(UserRole.PROVIDER),
  userController.getProviderUpcomingSchedule,
);
router.get(
  "/get-provider-availability",
  auth(UserRole.PROVIDER),
  userController.getProviderAvailability,
);

router.get(
  "/get-all-facility-header-counts",
  auth(UserRole.FACILITY),
  userController.getAllFacilityHeaderCounts,
);

export const userRoute = router;
