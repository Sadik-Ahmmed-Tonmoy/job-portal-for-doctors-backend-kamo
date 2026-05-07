import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { authService } from "./auth.service";
import sendResponse from "../../../shared/sendResponse";



const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.loginUserIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "user login successfully",
    data: result,
  });
});




const forgetPasswordToGmail = catchAsync(
  async (req: Request, res: Response) => {
    const email = req?.body?.email?.toLowerCase() as string;
    const response = await authService.forgetPasswordToGmail(email);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "OTP send successfully",
      data: response,
    });
  }
);
 

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const { otp, fcmToken ,reason} = req.body;
  const response = await authService.verifyOtp(otp, userId, fcmToken,reason);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "OTP verify  successfully",
    data: response,
  });
});
const resetPassword = catchAsync(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { newPassword } = req.body;
  const result = await authService.resetPassword(newPassword, userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password reset successfully.",
    data: result,
  });
});


const resendOtp=catchAsync(async (req: any, res: Response) => {
  
  const { email,reason } = req.body;
  const result = await authService.resendOtp(email, reason);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "otp resend  successfully.",
    data: result,
  });
});


// change password
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const id = req.user.id;
  const { oldPassword, newPassword } = req.body;

  await authService.changePassword(id, newPassword, oldPassword);
  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: "Password changed successfully",
    data: null,
  });
});

export const authController = {
  loginUser,
  forgetPasswordToGmail,
  verifyOtp,
  resetPassword,

  resendOtp,
  changePassword
};
