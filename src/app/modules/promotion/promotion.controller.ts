import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { promotionService } from "./promotion.service";
import Api from "twilio/lib/rest/Api";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import uploadToDigitalOcean from "../../../helpers/uploadToDigitalOcean";
import { deleteFromDigitalOcean } from "../../../helpers/deleteFromDigitalOccean";
import { ConnectionCheckOutStartedEvent } from "mongodb";

const createPromotion = catchAsync(async (req: Request, res: Response) => {
  let promotionUrl;
  try {
    const file = req.file;
    if (!file) {
      throw new ApiError(httpStatus.NOT_FOUND, "promotion picture not found");
    }
    promotionUrl = await uploadToDigitalOcean(file);

    req.body.promotionImage = promotionUrl;
    (req.body.email = req.user.email), (req.body.fullName = req.user.fullName);
    req.body.userId = req.user.id;

    const response = await promotionService.createPromotion(
      req.body,
      req.user.stripeCustomerId
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "promotion create successfully",
      data: response,
    });
  } catch (error) {
    if (promotionUrl) {
      await deleteFromDigitalOcean(promotionUrl).catch(() => {});
    }
    throw error;
  }
});

const updatePromotionStatus = catchAsync(
  async (req: Request, res: Response) => {
    const response = await promotionService.updatePromotionStatus(
      req.body.promotionId,
      req.body.status as any
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "promotion update successfully",
      data: response,
    });
  }
);

const getPromotion = catchAsync(async (req: Request, res: Response) => {
  const response = await promotionService.getPromotion(
    req.query.status as string,
    Number(req.query.page),
    Number(req.query.limit)
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "promotion get successfully",
    data: response,
  });
});
const getPromotionByFacility = catchAsync(
  async (req: Request, res: Response) => {
    const response = await promotionService.getPromotionByFacility(
      req.user.id,
      req.query.status as string,
      Number(req.query.page),
      Number(req.query.limit)
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "promotion get successfully",
      data: response,
    });
  }
);
const getSinglePromotion = catchAsync(async (req: Request, res: Response) => {
  const response = await promotionService.getSinglePromotion(
    req.params.promotionId
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "single promotion get successfully",
    data: response,
  });
});

const updateSinglePromotion = catchAsync(
  async (req: Request, res: Response) => {
    let promotionUrl;
    try {
      req.body.stripeCustomerId = req.user.stripeCustomerId;
      req.body.facilityId = req.user.id;
      const file = req.file;
      if (file) {
        promotionUrl = await uploadToDigitalOcean(file);
      }
      file;

      req.body.promotionImage = promotionUrl;
      const response = await promotionService.updateSinglePromotion(req.body);
      sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "re promotion successfully",
        data: response,
      });
    } catch (error) {
      if (promotionUrl) {
        await deleteFromDigitalOcean(promotionUrl).catch(() => {});
      }
      throw error;
    }
  }
);

export const promotionController = {
  createPromotion,
  updatePromotionStatus,
  getPromotion,
  getPromotionByFacility,
  getSinglePromotion,
  updateSinglePromotion,
};
