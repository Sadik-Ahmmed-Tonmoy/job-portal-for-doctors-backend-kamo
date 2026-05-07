import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { authController } from "./auth.controller";
import { authValidation } from "./auth.validation";
import auth from "../../middlewares/auth";
import verifyOtpToken from "../../middlewares/verifyOtpToken";

const router = express.Router();

router.post(
  "/login",
  validateRequest(authValidation.authLoginSchema),
  authController.loginUser
);

router.post(
  "/forgetpassword-otp-to-gmail",
  authController.forgetPasswordToGmail
);

router.post(
  "/verfiy-otp",
  validateRequest(authValidation.verifyOtpSchema),
  verifyOtpToken(),
  authController.verifyOtp
);
router.patch("/reset-password", verifyOtpToken(), authController.resetPassword);

router.post(
  "/resend-otp",
  validateRequest(authValidation.resendOtpSchema),
  authController.resendOtp
);

router.put("/change-password", auth(), authController.changePassword);

export const authRoute = router;
