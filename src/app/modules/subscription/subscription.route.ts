import { Router } from "express";
import auth from "../../middlewares/auth";
import { subscriptionController } from "./subscription.controller";
import validateRequest from "../../middlewares/validateRequest";
import { subscriptionValidation } from "./subscription.validation";
import { UserRole } from "@prisma/client";

const router = Router();

router.post(
  "/create-subscription",
  validateRequest(subscriptionValidation.subscriptionSchema),
  auth(UserRole.ADMIN),
  subscriptionController.createSubscriptionPlan
);
router.post(
  "/purchase-subscription",
  auth(),
  subscriptionController.purchaseSubscription
);
router.get(
  "/get-subscription",
  auth(),
  subscriptionController.getAllSubscriptionPlans
);
router.patch("/cancel-subscription/:subscriptionId",auth(),subscriptionController.cancelSubscription)
export const subscriptionRouter = router;
