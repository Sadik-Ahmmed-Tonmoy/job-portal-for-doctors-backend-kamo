import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { Request, Response } from "express";
import { subscriptionService } from "./subscription.service";
const createSubscriptionPlan = catchAsync(
  async (req: Request, res: Response) => {
    const payload = req.body;
    const subscriptionPlan = await subscriptionService.createSubscriptionIntoDb(
      payload
    );
    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Subscription plan created successfully",
      data: subscriptionPlan,
    });
  }
);
const purchaseSubscription = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const { id, email, fullName, stripeCustomerId } = req.user;

  const subscriptionPlan = await subscriptionService.purchaseSubscription(
    payload,
    id,
    email,
    fullName,
    stripeCustomerId
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Subscription plan purchase  successfully",
    data: subscriptionPlan,
  });
});
const getAllSubscriptionPlans = catchAsync(
  async (req: Request, res: Response) => {
    const subscriptionPlan =
      await subscriptionService.getAllSubscriptionPlans(req.user.role);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Subscription plan get  successfully",
      data: subscriptionPlan,
    });
  }
);

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const subscriptionPlan = await subscriptionService.cancelSubscription(
    req.params.subscriptionId,
    req.user.id
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Subscription plan cancell  successfully",
    data: subscriptionPlan,
  });
});
export const subscriptionController = {
  createSubscriptionPlan,
  purchaseSubscription,
  getAllSubscriptionPlans,
  cancelSubscription,
};
