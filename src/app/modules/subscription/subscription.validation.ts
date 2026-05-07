import {
  FeatureFrequency,
  Features_Flag,
  IntervalType,
  SubscriptionType,
  UserRole,
  FeatureType,
} from "@prisma/client";
import { z } from "zod";



const featureJsonSchema = z.array(
  z.object({
    key: z.string().min(1, "Feature label is required"),
    value: z.union([z.string(), z.number()]),
  })
);


const subscriptionFeatureItemSchema = z
  .object({
    feature: z.nativeEnum(Features_Flag, {
      errorMap: () => ({ message: "Invalid feature flag" }),
    }),

    featureType: z.nativeEnum(FeatureType, {
      errorMap: () => ({ message: "Invalid feature type" }),
    }),

    title: z.string().min(1, "Feature title is required"),

    enabled: z.boolean().optional(),

    isGlobal: z.boolean().optional(),

    limit: z
      .number()
      .refine((val) => val >= -1, {
        message: "Limit must be >= -1",
      })
      .optional(),

    frequency: z
      .nativeEnum(FeatureFrequency, {
        errorMap: () => ({ message: "Invalid frequency value" }),
      })
      .optional(),

    extraValue: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    /* ------------------------------ QUOTA FEATURE ----------------------------- */
    if (data.featureType === "QUOTA") {
      if (data.limit === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["limit"],
          message: "Limit is required for QUOTA feature",
        });
      }

      if (!data.frequency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["frequency"],
          message: "Frequency is required for QUOTA feature",
        });
      }
    }

    /* ----------------------------- BOOLEAN FEATURE ---------------------------- */
    if (data.featureType === "BOOLEAN") {
      if (data.enabled === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["enabled"],
          message: "Enabled is required for BOOLEAN feature",
        });
      }
    }
  });

const subscriptionFeatureSchema = z.array(subscriptionFeatureItemSchema);


const subscriptionSchema = z
  .object({
    title: z.nativeEnum(SubscriptionType, {
      errorMap: () => ({ message: "Invalid subscription plan" }),
    }),

    role: z.nativeEnum(UserRole, {
      errorMap: () => ({ message: "Invalid role value" }),
    }),

    interval: z.nativeEnum(IntervalType, {
      errorMap: () => ({ message: "Invalid interval value" }),
    }),

    interval_count: z.number({
      required_error: "Interval count is required",
    }),

    price: z.number({
      required_error: "Price is required",
    }),

    discount: z.number().optional(),
    discountTitle: z.string().optional(),
    discountStartDate: z.string().optional(),
    discountEndDate: z.string().optional(),

    features: featureJsonSchema.optional(),

    subscriptionFeatures: subscriptionFeatureSchema,
  })
  .strict();



export const subscriptionValidation = {
  subscriptionSchema,
};
