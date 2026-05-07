import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ReviewService } from "./review.service";

const createReview = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await ReviewService.createReview(req.body, userId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Review created successfully",
    data: result,
  });
});

const getAllReview = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await ReviewService.getAllReview(userId, page, limit);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All reviews retrieved successfully",
    data: result,
  });
});

const getReceivedReviewByUserId = catchAsync(async (req, res) => {
  const userId = req.params.userId;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await ReviewService.getReceivedReviewByUserId(userId, page, limit);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Received reviews retrieved successfully",
    data: result,
  });
});

const getAllReviewsForWeb = catchAsync(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await ReviewService.getAllReviewsForWeb(page, limit);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All reviews for web retrieved successfully",
    data: result,
  });
});

export const ReviewController = {
  createReview,
  getAllReview,
  getReceivedReviewByUserId,
  getAllReviewsForWeb

};
