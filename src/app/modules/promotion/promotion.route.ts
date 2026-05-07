import { UserRole } from "@prisma/client";
import { promotionController } from "./promotion.controller";
import auth from "../../middlewares/auth";
import express from "express";
import { fileUploader } from "../../../helpers/fileUploader";
import { parseBodyData } from "../../middlewares/parseBodyData";

const router = express.Router();
router.post(
  "/create",
  auth(UserRole.FACILITY),
  fileUploader.promotionImage,
  parseBodyData,

  promotionController.createPromotion
);

router.patch(
  "/update-promotion",
  auth(UserRole.ADMIN, UserRole.FACILITY),
  promotionController.updatePromotionStatus
);
router.get("/get-promotion", auth(), promotionController.getPromotion);
router.get(
  "/get-promotion-facility",
  auth(UserRole.FACILITY),
  promotionController.getPromotionByFacility
);
router.get(
  "/get-single-promotion/:promotionId",
  auth(),
  promotionController.getSinglePromotion
);
router.patch(
  "/re-promotion",
  auth(UserRole.FACILITY),
  fileUploader.promotionImage,
  parseBodyData,
  promotionController.updateSinglePromotion
);
export const promotionRoute = router;
