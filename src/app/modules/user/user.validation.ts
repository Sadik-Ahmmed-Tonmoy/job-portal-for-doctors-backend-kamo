import {

  CaseTypePreference,
  Certification,
  // EhrSystem,
  Experience,
  FacilityType,
  HrRole,
  MD_DO,
  Provider,
  StateLicence,
  TimeSlot,
  UserRole,
} from "@prisma/client";
import { z } from "zod";

const userRegisterValidationSchema = z.object({
  fullName: z.string({ required_error: "full name is required" }),
  role: z.nativeEnum(UserRole),
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const updateProviderProfile = z.object({
  provider: z
    .array(
      z.nativeEnum(Provider, {
        errorMap: () => ({ message: "Invalid provider type" }),
      })
    )
    .min(1, "At least one case type must be selected")
    .optional(),
  fullName: z.string().min(1, "Full name is required").optional(),
  npiNumber: z.string().min(1, "NPI Number is required").optional(),
  licenceNumber: z.string().min(1, "Licence Number is required").optional(),
 phoneNumber: z.string().min(1, "Phone number is required").optional(),
 
  certification: z
    .array(
      z.nativeEnum(Certification, {
        errorMap: () => ({ message: "Invalid certificate type" }),
      })
    )
    .optional(),

  address: z
    .object({
      long: z.string().min(1, "Longitude is required"),
      lat: z.string().min(1, "Latitude is required"),
      fullAddress: z.string().min(1, "Address is required"),
    })
    .optional(),
  experience: z.nativeEnum(Experience).optional(),

  radius: z.number().min(0, "Radius must be a positive number").optional(),
  callRequest: z.boolean().optional(),

  stateLicenced: z
    .array(
      z.nativeEnum(StateLicence, {
        errorMap: () => ({ message: "Invalid state licence type" }),
      })
    )
    .optional(),

  providerAvailability: z
    .array(
      z.object({
        date: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid date format",
        }),
        startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid start time",
        }),
        endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: "Invalid end time",
        }),
        availability: z.boolean(),
      })
    )
    .min(1, "At least one availability slot is required")
    .optional(),

  caseTypePreference: z
    .array(
      z.nativeEnum(CaseTypePreference, {
        errorMap: () => ({ message: "Invalid case type" }),
      })
    )
    .min(1, "At least one case type must be selected")
    .optional(),
});

const createFacilityProfile = z.object({
  facilityName: z.string().min(1, "Facility Name is required"),
  address: z.object({
    long: z.string().min(1, "Longitude is required"),
    lat: z.string().min(1, "Latitude is required"),
    fullAddress: z.string().min(1, "Address is required"),
  }),

  caseType: z.nativeEnum(CaseTypePreference),
  // credentialDetails: z.nativeEnum(Certification),
  certification: z.array(
    z.nativeEnum(Certification, {
      errorMap: () => ({ message: "Invalid certificate  type" }),
    })
  ),
  // ehrSystem: z.nativeEnum(EhrSystem),
  // companySize: z.string().min(1, "Company Size is required"),
  website: z.string().url("Invalid URL format").optional(),

  md_do: z.array(
    z.nativeEnum(MD_DO, {
      errorMap: () => ({ message: "Invalid  type" }),
    })
  ),
  facilityType: z.nativeEnum(FacilityType),
  orLoad: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  phoneNumber: z.string(),
  role: z.nativeEnum(HrRole),
});
const updateFacilityProfile = z.object({
  facilityName: z.string().optional(),
  address: z
    .object({
      long: z.string().min(1, "Longitude is required"),
      lat: z.string().min(1, "Latitude is required"),
      fullAddress: z.string().min(1, "Address is required"),
    })
    .optional(),

  caseType: z.array(
    z.nativeEnum(CaseTypePreference, {
      errorMap: () => ({ message: "Invalid case type" }),
    })
  ).optional(),
  certification: z
    .array(
      z.nativeEnum(Certification, {
        errorMap: () => ({ message: "Invalid certificate type" }),
      })
    )
    .optional(),
  // ehrSystem: z.nativeEnum(EhrSystem).optional(),
  // companySize: z.string().min(1, "Company Size is required").optional(),
  website: z.string().url("Invalid URL format").optional(),

  md_do: z
    .array(
      z.nativeEnum(MD_DO, {
        errorMap: () => ({ message: "Invalid type" }),
      })
    )
    .optional(),
  facilityType: z.nativeEnum(FacilityType).optional(),
  orLoad: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
  role: z.nativeEnum(HrRole).optional(),
  HrDetails: z
    .object({
      email: z.string().email(),
      name: z.string().min(1),
      phoneNumber: z.string(),
      role: z.nativeEnum(HrRole),
    })
    .optional(),
});

const createProviderProfileSchema = updateProviderProfile.extend({
  provider: updateProviderProfile.shape.provider.unwrap(),
  npiNumber: updateProviderProfile.shape.npiNumber.unwrap(),
  licenceNumber: updateProviderProfile.shape.licenceNumber.unwrap(),
  certification: updateProviderProfile.shape.certification.unwrap(),
  address: updateProviderProfile.shape.address.unwrap(),
  radius: updateProviderProfile.shape.radius.unwrap(),
  callRequest: updateProviderProfile.shape.callRequest.unwrap(),
  stateLicenced: updateProviderProfile.shape.stateLicenced.unwrap(),
  caseTypePreference: updateProviderProfile.shape.caseTypePreference.unwrap(),
  providerAvailability:
    updateProviderProfile.shape.providerAvailability.unwrap(),
});

export const userValidation = {
  userRegisterValidationSchema,
  updateProviderProfile,
  createFacilityProfile,
  updateFacilityProfile,
  createProviderProfileSchema,
};
