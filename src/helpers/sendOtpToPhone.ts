import { Secret } from "jsonwebtoken";
import config from "../config";
import prisma from "../shared/prisma";
import generateOTP from "./generateOtp";
import { jwtHelpers } from "./jwtHelpers";
// import { otpQueuePhone } from "./redis";

export const sendOtpToPhone = async (existingUser: any) => {
  const otp = generateOTP();
  const OTP_EXPIRATION_TIME = 1 * 60 * 1000;
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_TIME);
  // otpQueuePhone.add(
  //   "send-otp-to-phone",
  //   {
  //     phoneNumber: existingUser.phoneNumber,
  //     otpCode: otp,
  //   },
  //   {
  //     jobId: `${existingUser.id}-${Date.now()}`,
  //     removeOnComplete: true,
  //     delay: 0,
  //     backoff: 5000,
  //     attempts: 3,
  //     removeOnFail: true,
  //   }
  // );
  await prisma.otp.upsert({
    where: {
      userId: existingUser.id,
    },
    create: {
      userId: existingUser.id,
      expiresAt: expiresAt,
      otpCode: otp,
    },
    update: {
      otpCode: otp,
      expiresAt: expiresAt,
    },
  });
  return otp;
  // return jwtHelpers.generateToken(
  //   { id: existingUser.id },
  //   config.otpSecret.verify_otp_secret as Secret,
  //   "5m"
  // );
};
