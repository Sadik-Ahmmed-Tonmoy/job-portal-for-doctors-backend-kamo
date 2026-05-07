import prisma from "../../../shared/prisma";
import bcrypt from "bcryptjs";
import ApiError from "../../../errors/ApiErrors";
import { jwtHelpers } from "../../../helpers/jwtHelpers";
import config from "../../../config";
import { UserStatus } from "@prisma/client";

import httpStatus from "http-status";

import { Secret } from "jsonwebtoken";

import { sendOtpToGmail } from "../../../helpers/sendOtpToEmail";
import { OtpReason } from "../../../enum/verifyEnum";
import generateOTP from "../../../helpers/generateOtp";
import { comparePassword, hashPassword } from "../../../utlits/passwordHelpers";
import { userService } from "../user/user.service";

const loginUserIntoDB = async (payload: any) => {
  payload.email = payload.email.toLowerCase();
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });

  if (!user.isOtpVerify) {
    const otp = generateOTP();
    sendOtpToGmail(user, otp);

    const token = jwtHelpers.generateToken(
      { id: user.id },
      config.otpSecret.login_otp_secret as Secret,
    );

    throw new ApiError(
      httpStatus.FORBIDDEN,
      "OTP sent to your Gmail. Please verify.",
      {
        token,

        reason: "LOGIN_OTP_SECRET",
        otp,
      },
    );
  }
  if (user.status === UserStatus.PENDING) {
    throw new ApiError(
      httpStatus.METHOD_NOT_ALLOWED,
      "your account is under reveiw",
    );
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new ApiError(
      httpStatus.METHOD_NOT_ALLOWED,
      "your account is disabled.please contact with admin",
    );
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  await prisma.user.update({
    where: {
      email: payload.email,
    },
    data: {
      fcmToken: payload.fcmToken,
    },
  });
  const accessToken = jwtHelpers.generateToken(
    user,
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );
  const { password, status, createdAt, updatedAt, ...userInfo } = user;

  return {
    accessToken,
    userInfo,
  };
};
const forgetPasswordToGmail = async (email: string) => {
  const existingUser = await prisma.user.findUniqueOrThrow({
    where: {
      email: email,
    },
  });
  const otp = generateOTP();
  sendOtpToGmail(existingUser, otp);

  const token = jwtHelpers.generateToken(
    { id: existingUser.id },
    config.otpSecret.forget_password_secret as Secret,
  );
  return {
    token,
    otp,
  };
};

// const forgetPasswordToPhone = async (phoneNumber: string) => {
//   const existingUser = await prisma.user.findUnique({
//     where: {
//       phoneNumber: phoneNumber,
//     },
//   });
//   if (!existingUser) {
//     throw new ApiError(httpStatus.NOT_FOUND, "user not found");
//   }
//   const otp = generateOTP();
//   const OTP_EXPIRATION_TIME = 5 * 60 * 1000;
//   const expiresAt = new Date(Date.now() + OTP_EXPIRATION_TIME);
//   // otpQueuePhone.add(
//   //   "send-otp-to-phone",
//   //   {
//   //     phoneNumber: existingUser.phoneNumber,
//   //     otpCode: otp,
//   //   },
//   //   {
//   //     jobId: `${existingUser.id}-${Date.now()}`,
//   //     removeOnComplete: true,
//   //     delay: 0,
//   //     backoff: 5000,
//   //     attempts: 3,
//   //     removeOnFail: true,
//   //   }
//   // );
//   await prisma.otp.upsert({
//     where: {
//       userId: existingUser.id,
//     },
//     create: {
//       userId: existingUser.id,
//       expiresAt: expiresAt,
//       otpCode: otp,
//     },
//     update: {
//       otpCode: otp,
//       expiresAt: expiresAt,
//     },
//   });

//   return jwtHelpers.generateToken(
//     { id: existingUser.id },
//     config.otpSecret.verify_otp_secret as Secret,
//     "5m"
//   );
// };

const verifyOtp = async (
  otp: string,
  userId: string,
  fcmToken: string,
  reason: OtpReason,
) => {
  const existingOtp = await prisma.otp.findUnique({
    where: {
      userId: userId,
    },
    include: {
      user: true,
    },
  });
  let response;

  if (existingOtp?.otpCode !== otp) {
    throw new ApiError(httpStatus.NOT_FOUND, "Wrong OTP");
  }

  if (existingOtp.expiresAt && new Date() > existingOtp.expiresAt) {
    await prisma.otp.deleteMany({ where: { userId: userId } });
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Your OTP has expired. Please request a new one.",
    );
  }
  //this is becasue example if user first signup then withouth otp verfiy again try to signup now as password he forget then he have to forget password.now in forget password we will not make the status update right?thatwhy without froget password reason all verify will be status is active
  if (reason !== OtpReason.FORGET_PASSWORD) {
    await prisma.user.update({
      where: {
        id: existingOtp.userId,
      },
      data: {
        fcmToken: fcmToken,
        // status: UserStatus.ACTIVE,
        isOtpVerify: true,
      },
    });
  }

  if (reason === OtpReason.SIGNUP_OTP_SECRET || reason === OtpReason.LOGIN) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        title: "PREMIUM",
        role: existingOtp.user.role,
      },
      select: {
        id: true,
        subscriptionFeatures: true,
        title: true,
      },
    });

    if (subscription) {
      const result = await prisma.$transaction(
        async (tx) => {
          const threeMonthsLater = new Date();
          threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
          const data = await tx.userSubscription.create({
            data: {
              subscriptionId: subscription?.id,
              userId: userId,
              status: "ACTIVE",
              updatedAt: threeMonthsLater,
            },
          });
          //  await tx.user.update({
          //   where: {
          //     id: userId,
          //   },
          //   data: {
          //     isSubscription: true,
          //     planName: subscription.title,
          //   },
          // });

          await userService.featuredAddforSubscribedUser(
            tx,
            subscription?.subscriptionFeatures,
            userId,
          );
        },
        {
          timeout: 20000,
          maxWait: 15000,
        },
      );
    }
  }

  switch (reason) {
    case OtpReason.RESET_PASSWORD:
      response = {
        token: jwtHelpers.generateToken(
          { id: userId },
          config.jwt.jwt_secret as Secret,
          config.jwt.expires_in,
        ),
        isProfile: existingOtp.user.isProfile,
      };
      break;
    case OtpReason.FORGET_PASSWORD:
      response = {
        token: jwtHelpers.generateToken(
          { id: userId },
          config.otpSecret.reset_password_secret as Secret,
          config.jwt.expires_in,
        ),
        isProfile: existingOtp.user.isProfile,
      };
      break;
    case OtpReason.SIGNUP_OTP_SECRET:
      response = {
        token: jwtHelpers.generateToken(
          { id: userId },
          config.jwt.jwt_secret as Secret,
        ),
        isProfile: existingOtp.user.isProfile,
      };
      break;
    case OtpReason.LOGIN:
      response = {
        token: jwtHelpers.generateToken(
          { id: userId },
          config.jwt.jwt_secret as Secret,
        ),
        isProfile: existingOtp.user.isProfile,
      };
      break;
    default:
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP reason");
  }

  await prisma.otp.deleteMany({ where: { userId } });
  return response;
};

const resetPassword = async (newPassword: string, userId: string) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new ApiError(404, "user not found");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.jwt.gen_salt),
  );

  const result = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      password: hashedPassword,
    },
  });
  const token = jwtHelpers.generateToken(
    { id: userId },
    config.jwt.jwt_secret as Secret,
    config.jwt.expires_in as string,
  );

  return token;
};
const resendOtp = async (email: string, reason: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "user not found");
  }
  const otp = generateOTP();
  sendOtpToGmail(user, otp);
  let token;
  switch (reason) {
    case "SIGNUP_OTP_SECRET":
      token = jwtHelpers.generateToken(
        { id: user.id },
        config.otpSecret.signup_otp_secret as Secret,
      );
      break;
    case "RESET_PASSWORD_SECRET":
      token = jwtHelpers.generateToken(
        { id: user.id },
        config.otpSecret.reset_password_secret as Secret,
      );
      break;
    case "LOGIN_OTP_SECRET":
      token = jwtHelpers.generateToken(
        { id: user.id },
        config.otpSecret.login_otp_secret as Secret,
      );
      break;
    case "FORGET_PASSWORD_SECRET":
      token = jwtHelpers.generateToken(
        { id: user.id },
        config.otpSecret.forget_password_secret as Secret,
      );
      break;
    default:
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid reason provided");
  }

  return {
    token,
    otp,
  };
};

// change password
const changePassword = async (
  id: string,
  newPassword: string,
  oldPassword: string,
) => {
  if (!oldPassword) {
    throw new ApiError(httpStatus.FORBIDDEN, "Old Password is required");
  }

  if (!newPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, "New Password is required");
  }

  const userData = await prisma.user.findUnique({
    where: { id },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "No record found with this email");
  }

  const isCorrectPassword = await comparePassword(
    oldPassword,
    userData.password as string,
  );

  if (!isCorrectPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect old password!");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: {
      id: userData?.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return;
};

export const authService = {
  loginUserIntoDB,

  forgetPasswordToGmail,
  // forgetPasswordToPhone,
  verifyOtp,
  resetPassword,
  resendOtp,
  changePassword,
};
