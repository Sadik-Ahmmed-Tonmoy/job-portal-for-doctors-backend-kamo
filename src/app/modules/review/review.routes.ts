import express from "express";
import { ReviewController } from "./review.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.post(
  "/",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  ReviewController.createReview
);

router.get(
  "/",
  auth(UserRole.PROVIDER, UserRole.FACILITY, UserRole.ADMIN),
  ReviewController.getAllReview
);

router.get(
  "/received/:userId",
  auth(UserRole.PROVIDER, UserRole.FACILITY),
  ReviewController.getReceivedReviewByUserId
);

router.get("/web", ReviewController.getAllReviewsForWeb);


export const ReviewRoutes = router;
