import {
  Duration,
  Experience,
  Provider
} from "@prisma/client";
import { z } from "zod";

export const createJobSchema = z.object({
  about: z.string().min(1),
  experience: z.nativeEnum(Experience),
  jobRole: z.nativeEnum(Provider),
  qualification: z.string().min(1),
  totalCandidate:z.number().min(0),
  duration:z.nativeEnum(Duration),

maxPriceRange:z.number().min(0),
minPriceRange:z.number().min(0),
  date: z
    .array(
      z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Each date must be a valid ISO 8601 string",
      })
    )
    .min(1, "At least one date is required"),

  startTime: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):([0-5]\d)$/,
      "Start time must be in 24-hour format (HH:mm)"
    ),

  endTime: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):([0-5]\d)$/,
      "End time must be in 24-hour format (HH:mm)"
    ),
});

export const jobValidation = {
  createJobSchema,
};
