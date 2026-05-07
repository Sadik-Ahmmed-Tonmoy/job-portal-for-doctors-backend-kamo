import { z } from "zod";

const authLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
const verifyOtpSchema = z.object({
  otp: z.string(),
  reason: z.string({ required_error: "reson is needed" }),
  // fcmToken: z.string({ required_error: "fcm token need" }),
});
const resendOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  reason: z.string({ required_error: "reson is needed" }),
});

export const authValidation = {
  authLoginSchema,
  verifyOtpSchema,
  resendOtpSchema,
};
