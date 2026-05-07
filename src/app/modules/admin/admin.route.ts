import express from "express";

import validateRequest from "../../middlewares/validateRequest";

import { adminController } from "./admin.controller";
import { authValidation } from "../auth/auth.validation";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.post(
  "/admin-login",
  validateRequest(authValidation.authLoginSchema),
  adminController.loginAdmin
);

router.get("/providers", auth(UserRole.ADMIN), adminController.getAllProviders);

router.get("/facilities", auth(UserRole.ADMIN), adminController.getAllFacility);

router.patch(
  "/users/:id/status",
  auth(UserRole.ADMIN),
  adminController.userStatusUpdate
);

router.delete("/users/:id", auth(UserRole.ADMIN), adminController.deleteUser);

router.get("/jobs", auth(UserRole.ADMIN), adminController.getAllJobsForAdmin);

router.delete(
  "/jobs/:id",
  auth(UserRole.ADMIN),
  adminController.deleteJobByAdmin
);

router.patch("/jobs/:id", auth(UserRole.ADMIN), adminController.editJobByAdmin);

router.get(
  "/ratings",
  auth(UserRole.ADMIN),
  adminController.getAllRatingsForAdmin
);

router.delete(
  "/ratings/:id",
  auth(UserRole.ADMIN),
  adminController.deleteRating
);

router.patch("/update", auth(UserRole.ADMIN), adminController.updateAdmin);

router.get(
  "/dashboard",
  auth(UserRole.ADMIN),
  adminController.getDashboardHeaderNumbers
);

router.get(
  "/user-subscription-plan",
  auth(UserRole.ADMIN),
  adminController.getUserSubscrption
);
router.get("/admin-dashboard-data",auth(UserRole.ADMIN),adminController.adminDashboardData)

export const adminRoute = router;
