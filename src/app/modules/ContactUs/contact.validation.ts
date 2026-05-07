import { z } from "zod";

export const ContactUsSchema = z.object({

    fullName: z
      .string({
        required_error: "Full name is required",
      })
      .min(1, "Full name is required"),
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email address")
      .min(1, "Email is required"),
    phone: z.string().optional(),
    message: z
      .string({
        required_error: "Message is required",
      })
      .min(1, "Message is required"),

});
