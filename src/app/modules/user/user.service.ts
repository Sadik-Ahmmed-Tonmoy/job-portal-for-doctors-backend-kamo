import {
  FeatureFrequency,
  Features_Flag,
  FeatureType,
  jobApplier,
  JobStatus,
  Prisma,
  Provider,
  User,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcrypt";
import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors";
import prisma from "../../../shared/prisma";

import { Secret } from "jsonwebtoken";
import config from "../../../config";
import generateOTP from "../../../helpers/generateOtp";
import { jwtHelpers } from "../../../helpers/jwtHelpers";
import { sendOtpToGmail } from "../../../helpers/sendOtpToEmail";
import { deleteFromDigitalOcean } from "../../../helpers/deleteFromDigitalOccean";
import { ConnectionCheckOutStartedEvent } from "mongodb";

const createUser = async (payload: User) => {
  const hashPassword = await bcrypt.hash(payload?.password as string, 10);
  const existingUser = await prisma.user.findUnique({
    where: {
      email: payload.email.toLocaleLowerCase(),
    },
  });
  if (
    existingUser &&
    !existingUser.isOtpVerify &&
    existingUser.status !== "BLOCKED" &&
    existingUser.status !== "DELETED"
  ) {
    const otp = generateOTP();
    sendOtpToGmail(existingUser, otp);

    const token = jwtHelpers.generateToken(
      { id: existingUser.id },
      config.otpSecret.signup_otp_secret as Secret,
    );
    return { token, otp };
  }
  if (existingUser && existingUser.status === "BLOCKED") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "This email and phone number are blocked. Please contact support.",
    );
  }
  try {
    const result = await prisma.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email.toLowerCase(),
        password: hashPassword,
        role: payload.role,
      },
    });
    const otp = generateOTP();
    sendOtpToGmail(result, otp);

    const token = jwtHelpers.generateToken(
      { id: result.id },
      config.otpSecret.signup_otp_secret as Secret,
    );
    return {
      token,
      otp,
    };
  } catch (error: any) {
    console.log(error);
    if (error.code === "P2002") {
      throw new ApiError(httpStatus.CONFLICT, "Email  already exists");
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error);
  }
};

const updateProviderProfile = async (
  payload: any,
  userId: string,
  profile: any,
) => {
  if (payload.providerAvailability) {
    await prisma.providerAvailability.deleteMany({
      where: { provider: { userId } },
    });
  }
  const createData = {
    document: payload.document || [],
    BLS: payload.BLS || [],
    ACLS: payload.ACLS || [],
    PALS: payload.PALS || [],
    DIPLOMA: payload.DIPLOMA || [],
    LICENCE: payload.LICENCE || [],
    profileImage: payload.profileImage || null,
    certification: payload.certification || [],
    licenceNumber: payload.licenceNumber || "",
    phoneNumber: payload.phoneNumber || "",
    address: payload.address || { long: "", lat: "" },
    npiNumber: payload.npiNumber || "",
    radius: payload.radius ?? 0,
    experience: payload.experience || null,
    callRequest: payload.callRequest ?? false,
    stateLicenced: payload.stateLicenced || [],
    caseTypePreference: payload.caseTypePreference || [],
    provider: payload.provider || [],
    providerAvailability: payload.providerAvailability
      ? {
          createMany: {
            data: payload.providerAvailability.map((slot: any) => ({
              date: new Date(slot.date),
              startTime: new Date(slot.startTime),
              endTime: new Date(slot.endTime),
              availability: slot.availability,
            })),
          },
        }
      : undefined,
  };

  const updateData = {
    document: payload.document || profile.document,
    BLS: payload.BLS || profile.BLS,
    ACLS: payload.ACLS || profile.ACLS,
    PALS: payload.PALS || profile.PALS,
    DIPLOMA: payload.DIPLOMA || profile.DIPLOMA,
    LICENCE: payload.LICENCE || profile.LICENCE,
    profileImage: payload.profileImage || profile.profileImage,
    certification: payload.certification || profile.certification,
    licenceNumber: payload.licenceNumber || profile.licenceNumber,
    phoneNumber: payload.phoneNumber || profile.phoneNumber,
    address: payload.address || profile.address,
    npiNumber: payload.npiNumber || profile.npiNumber,
    radius: payload.radius ?? profile.radius,
    experience: payload.experience || null,
    callRequest: payload.callRequest || profile.callRequest,
    stateLicenced: payload.stateLicenced || profile.stateLicenced,
    caseTypePreference:
      payload.caseTypePreference || profile.caseTypePreference,
    provider: payload.provider || profile.provider,
    providerAvailability: payload.providerAvailability
      ? {
          createMany: {
            data: payload.providerAvailability.map((slot: any) => ({
              date: new Date(slot.date),
              startTime: new Date(slot.startTime),
              endTime: new Date(slot.endTime),
              availability: slot.availability,
            })),
          },
        }
      : profile.providerAvailability,
  };

  // -------------------------
  let updateLocation: any = {};

  // 4️⃣ Process location if lat/long are provided in address
  if (payload.address?.lat && payload.address?.long) {
    const lat = Number(payload.address.lat);
    const long = Number(payload.address.long);

    // Create GeoJSON Point (MongoDB format: [longitude, latitude])
    updateLocation = {
      type: "Point",
      coordinates: [long, lat],
    };
  }
  // -------------------------

  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      isProfile: true,
      profileImage: payload.profileImage || profile.profileImage,
      location: updateLocation,
      fullName: payload.fullName || profile.fullName,
      profileDetails: true,
      providerProfile: {
        upsert: {
          create: createData,
          update: updateData,
        },
      },
      // profileDetails: true,
    },

    include: {
      providerProfile: true,
    },
  });

  return result;
};

const updateProviderResume = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          document: true,
          profileImage: true,
        },
      },
    },
  });

  const currentDocumentList = Array.isArray(userData?.providerProfile?.document)
    ? userData.providerProfile.document
    : [];

  const updateCurrentDocument = currentDocumentList.map((doc) => {
    if (
      typeof doc === "object" &&
      doc !== null &&
      "fileName" in doc &&
      "url" in doc
    ) {
      return {
        url: (doc as any).url ?? "",
        fileName: (doc as any).fileName ?? "",
        isSelected: false,
      };
    }
    return {
      url: "",
      fileName: "",
      isSelected: false,
    };
  });

  const newDocuments = Array.isArray(payload.document)
    ? payload.document
    : payload.document
      ? [payload.document] // wrap single item into an array
      : [];

  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      providerProfile: {
        update: {
          document: [...newDocuments, ...updateCurrentDocument],
        },
      },
      profileDetails: true,
    },
    include: {
      providerProfile: true,
    },
  });

  return result;
};

const selectUploadedResume = async (url: string, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          document: true,
        },
      },
    },
  });

  const currentDocumentList = Array.isArray(userData?.providerProfile?.document)
    ? userData.providerProfile.document
    : [];
  const selectedDocument = currentDocumentList.find((doc) => {
    return (doc as any).url == url;
  });
  const updateSelectedDocument =
    selectedDocument && typeof selectedDocument === "object"
      ? { ...(selectedDocument as object), isSelected: true }
      : { url: "", fileName: "", isSelected: true };

  if (!selectedDocument) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Selected document not found in the user's profile",
    );
  }
  const existingDocs = currentDocumentList.filter(
    (doc) =>
      doc &&
      typeof doc === "object" &&
      doc !== null &&
      "url" in doc &&
      (doc as any).url !== url,
  );

  const updateCurrentDocument = existingDocs.map((doc) => {
    if (
      typeof doc === "object" &&
      doc !== null &&
      "fileName" in doc &&
      "url" in doc
    ) {
      return {
        url: (doc as any).url ?? "",
        fileName: (doc as any).fileName ?? "",
        isSelected: false,
      };
    }
    return {
      url: "",
      fileName: "",
      isSelected: false,
    };
  });
  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      providerProfile: {
        update: {
          document: [updateSelectedDocument, ...updateCurrentDocument],
        },
      },
    },
  });
  return result;
};

const deleteDocument = async (url: string, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          document: true,
        },
      },
    },
  });

  const currentDocumentList = Array.isArray(userData?.providerProfile?.document)
    ? userData.providerProfile.document
    : [];
  const documentToDelete = currentDocumentList.find((doc) => {
    return (doc as any).url == url;
  });

  if (!documentToDelete) {
    throw new ApiError(httpStatus.NOT_FOUND, "Document not found");
  }

  const updatedDocumentList = currentDocumentList.filter(
    (doc) => (doc as any).url !== url,
  );

  const [firstDocument, ...restDocuments] = updatedDocumentList;
  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      providerProfile: {
        update: {
          document: [
            firstDocument &&
            typeof firstDocument === "object" &&
            firstDocument !== null
              ? { ...firstDocument, isSelected: true }
              : { url: "", fileName: "", isSelected: true },
            ...restDocuments,
          ],
        },
      },
    },
  });
  return result;
};

const updateProviderBLS = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          BLS: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const currentBls = userData.providerProfile?.BLS;

  if (!payload.BLS) {
    throw new ApiError(httpStatus.BAD_REQUEST, "BLS is required");
  }

  // Safely extract previous BLS url from JSON value
  let previousBlsUrl: string | undefined;
  if (Array.isArray(currentBls) && currentBls.length > 0) {
    const first = currentBls[0] as any;
    if (first && typeof first === "object" && "url" in first) {
      previousBlsUrl = first.url as string | undefined;
    }
  }
  if (payload.BLS && previousBlsUrl) {
    await deleteFromDigitalOcean(previousBlsUrl).catch(() => {});
  }
  console.log(payload.BLS, "payload.BLS", previousBlsUrl, "previousBlsUrl");
  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      providerProfile: {
        update: { BLS: payload.BLS },
      },
    },
    select: {
      providerProfile: {
        select: {
          BLS: true,
        },
      },
    },
  });

  return result;
};

const updateProviderACLS = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          ACLS: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentAcls = userData.providerProfile?.ACLS;
  if (!payload.ACLS) {
    throw new ApiError(httpStatus.BAD_REQUEST, "ACLS is required");
  }
  if (payload.ACLS && Array.isArray(currentAcls) && currentAcls.length > 0) {
    const first = currentAcls[0] as any;
    if (
      first &&
      typeof first === "object" &&
      "url" in first &&
      typeof first.url === "string"
    ) {
      await deleteFromDigitalOcean(first.url).catch(() => {});
    }
  }

  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { ACLS: payload.ACLS } } },
    select: {
      providerProfile: {
        select: {
          ACLS: true,
        },
      },
    },
  });
  return result;
};

const updateProviderPALS = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          PALS: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentPals = userData.providerProfile?.PALS;
  if (!payload.PALS) {
    throw new ApiError(httpStatus.BAD_REQUEST, "PALS is required");
  }
  if (payload.PALS && Array.isArray(currentPals) && currentPals.length > 0) {
    const first = currentPals[0] as any;
    if (
      first &&
      typeof first === "object" &&
      "url" in first &&
      typeof first.url === "string"
    ) {
      await deleteFromDigitalOcean(first.url).catch(() => {});
    }
  }
  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { PALS: payload.PALS } } },
    select: {
      providerProfile: {
        select: {
          PALS: true,
        },
      },
    },
  });

  return result;
};

const updateProviderDIPLOMA = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          DIPLOMA: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentDiploma = userData.providerProfile?.DIPLOMA;
  if (!payload.DIPLOMA) {
    throw new ApiError(httpStatus.BAD_REQUEST, "DIPLOMA is required");
  }
  if (
    payload.DIPLOMA &&
    Array.isArray(currentDiploma) &&
    currentDiploma.length > 0
  ) {
    const first = currentDiploma[0] as any;
    if (
      first &&
      typeof first === "object" &&
      "url" in first &&
      typeof first.url === "string"
    ) {
      await deleteFromDigitalOcean(first.url).catch(() => {});
    }
  }
  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { DIPLOMA: payload.DIPLOMA } } },
    select: {
      providerProfile: {
        select: {
          DIPLOMA: true,
        },
      },
    },
  });
  return result;
};

const updateProviderLICENCE = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          LICENCE: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentLicence = userData.providerProfile?.LICENCE;
  if (!payload.LICENCE) {
    throw new ApiError(httpStatus.BAD_REQUEST, "LICENCE is required");
  }
  if (
    payload.LICENCE &&
    Array.isArray(currentLicence) &&
    currentLicence.length > 0
  ) {
    const first = currentLicence[0] as any;
    if (
      first &&
      typeof first === "object" &&
      "url" in first &&
      typeof first.url === "string"
    ) {
      await deleteFromDigitalOcean(first.url).catch(() => {});
    }
  }
  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { LICENCE: payload.LICENCE } } },
    select: {
      providerProfile: {
        select: {
          LICENCE: true,
        },
      },
    },
  });
  return result;
};

const deleteProviderBLS = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          BLS: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentBls = userData.providerProfile?.BLS;
  if (!Array.isArray(currentBls) || currentBls.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "BLS is required");
  }
  const first = currentBls[0] as any;
  if (
    first &&
    typeof first === "object" &&
    "url" in first &&
    typeof first.url === "string"
  ) {
    await deleteFromDigitalOcean(first.url).catch(() => {});
  }

  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { BLS: null } } },
    select: {
      providerProfile: {
        select: {
          BLS: true,
        },
      },
    },
  });
  return result;
};

const deleteProviderACLS = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          ACLS: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentAcls = userData.providerProfile?.ACLS;
  if (!Array.isArray(currentAcls) || currentAcls.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "ACLS is required");
  }
  const first = currentAcls[0] as any;
  if (
    first &&
    typeof first === "object" &&
    "url" in first &&
    typeof first.url === "string"
  ) {
    await deleteFromDigitalOcean(first.url).catch(() => {});
  }
  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { ACLS: null } } },
    select: {
      providerProfile: {
        select: {
          ACLS: true,
        },
      },
    },
  });
  return result;
};

const deleteProviderPALS = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          PALS: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentPals = userData.providerProfile?.PALS;
  if (!Array.isArray(currentPals) || currentPals.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "PALS is required");
  }
  const first = currentPals[0] as any;
  if (
    first &&
    typeof first === "object" &&
    "url" in first &&
    typeof first.url === "string"
  ) {
    await deleteFromDigitalOcean(first.url).catch(() => {});
  }
  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { PALS: null } } },
    select: {
      providerProfile: {
        select: {
          PALS: true,
        },
      },
    },
  });
  return result;
};

const deleteProviderDIPLOMA = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          DIPLOMA: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentDiploma = userData.providerProfile?.DIPLOMA;
  if (!Array.isArray(currentDiploma) || currentDiploma.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "DIPLOMA is required");
  }
  const first = currentDiploma[0] as any;
  if (
    first &&
    typeof first === "object" &&
    "url" in first &&
    typeof first.url === "string"
  ) {
    await deleteFromDigitalOcean(first.url).catch(() => {});
  }
  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { DIPLOMA: null } } },
    select: {
      providerProfile: {
        select: {
          DIPLOMA: true,
        },
      },
    },
  });
  return result;
};

const deleteProviderLICENCE = async (userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      providerProfile: {
        select: {
          LICENCE: true,
        },
      },
    },
  });
  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const currentLicence = userData.providerProfile?.LICENCE;
  if (!Array.isArray(currentLicence) || currentLicence.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "LICENCE is required");
  }
  const first = currentLicence[0] as any;
  if (
    first &&
    typeof first === "object" &&
    "url" in first &&
    typeof first.url === "string"
  ) {
    await deleteFromDigitalOcean(first.url).catch(() => {});
  }
  const result = await prisma.user.update({
    where: { id: userId },
    data: { providerProfile: { update: { LICENCE: null } } },
    select: {
      providerProfile: {
        select: {
          LICENCE: true,
        },
      },
    },
  });
  return result;
};

const createFacilityProfile = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      location: true,
      facilityProfile: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (userData.facilityProfile) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Facility profile already exists for this user",
    );
  }

  // const isFacilityExists = await prisma.facilityProfile.findUnique({
  //   where: { userId },
  // });

  // if (isFacilityExists) {
  //   throw new ApiError(httpStatus.CONFLICT, "Facility profile already exists");
  // }

  // -------------------------
  let updateLocation: any = {};

  // 4️⃣ Process location if lat/long are provided in address
  if (payload.address?.lat && payload.address?.long) {
    const lat = Number(payload.address.lat);
    const long = Number(payload.address.long);

    // Create GeoJSON Point (MongoDB format: [longitude, latitude])
    updateLocation = {
      type: "Point",
      coordinates: [long, lat],
    };
  } else if (userData?.location) {
    updateLocation = userData.location;
  }
  // -------------------------

  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      isProfile: true,
      location: updateLocation,
      profileDetails: true,
      facilityProfile: {
        create: {
          address: payload.address,
          caseType: payload.caseType,
          // certification: payload.certification,
          // ehrSystem: payload.ehrSystem,
          facilityName: payload.facilityName,
          md_do: payload.md_do,
          facilityType: payload.facilityType,
          orLoad: payload.orLoad,
          // companySize: payload.companySize,
          website: payload.website ? payload.website : "",
          HrDetails: {
            create: {
              email: payload.HrDetails.email,
              name: payload.HrDetails.name,
              phoneNumber: payload.HrDetails.phoneNumber,
              role: payload.HrDetails.role,
            },
          },
        },
      },
    },
  });
  return result;
};
// const updateFaciltyProfile = async (
//   payload: any,
//   userId: string,
//   profile: any
// ) => {
//   console.log(payload, "update facility profile");

//   // Default values with valid enums
//   const safePayload = {
//     address: payload.address ?? { long: 0, lat: 0, fullAddress: "" },
//     caseType: payload.caseType ?? "GENERAL",
//     certification: payload.certification ?? [],
//     ehrSystem: payload.ehrSystem ?? "EPIC", // valid enum default
//     facilityName: payload.facilityName ?? "Unknown Facility",
//     md_do: payload.md_do ?? [],
//     facilityType: payload.facilityType ?? "SURGICAL_CENTER", // valid enum default
//     orLoad: payload.orLoad ?? "GENERAL",
//     companySize: payload.companySize ?? "1-10",
//     website: payload.website ?? "",
//     profileImage: payload.profileImage ?? null,
//     HrDetails: {
//       email: payload.email ?? "",
//       name: payload.name ?? "",
//       phoneNumber: payload.phoneNumber ?? "",
//       role: payload.role ?? "HR_MANAGER", // valid enum default
//     },
//   };

//   const result = await prisma.user.update({
//     where: { id: userId },
//     data: {
//       facilityProfile: {
//         upsert: {
//           create: {
//             address: safePayload.address,
//             caseType: safePayload.caseType,
//             certification: safePayload.certification,
//             ehrSystem: safePayload.ehrSystem,
//             facilityName: safePayload.facilityName,
//             md_do: safePayload.md_do,
//             facilityType: safePayload.facilityType,
//             orLoad: safePayload.orLoad,
//             companySize: safePayload.companySize,
//             website: safePayload.website,
//             HrDetails: {
//               create: {
//                 email: safePayload.HrDetails.email,
//                 name: safePayload.HrDetails.name,
//                 phoneNumber: safePayload.HrDetails.phoneNumber,
//                 role: safePayload.HrDetails.role,
//               },
//             },
//           },
//           update: {
//             profileImage: safePayload.profileImage || profile?.profileImage,
//             address: safePayload.address || profile?.address,
//             caseType: safePayload.caseType || profile?.caseType,
//             certification: safePayload.certification || profile?.certification,
//             ehrSystem: safePayload.ehrSystem || profile?.ehrSystem,
//             facilityName: safePayload.facilityName || profile?.facilityName,
//             companySize: safePayload.companySize || profile?.companySize,
//             website: safePayload.website || profile?.website,
//             md_do: safePayload.md_do || profile?.md_do,
//             facilityType: safePayload.facilityType || profile?.facilityType,
//             orLoad: safePayload.orLoad || profile?.orLoad,
//           },
//         },
//       },
//       profileDetails: true,
//     },
//     include: {
//       facilityProfile: {
//         include: {
//           HrDetails: true,
//         },
//       },
//     },
//   });

//   return result;
// };
const updateFacilityProfile = async (payload: any, userId: string) => {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      location: true,
      facilityProfile: {
        select: {
          userId: true,
          profileImage: true,
          address: true,
          caseType: true,
          facilityName: true,
          md_do: true,
          facilityType: true,
          orLoad: true,
          website: true,
          HrDetails: true,
        },
      },
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!userData.facilityProfile) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Facility profile not found for this user",
    );
  }

  // const isFacilityExists = await prisma.facilityProfile.findUnique({
  //   where: { userId },
  // });

  // if (isFacilityExists) {
  //   throw new ApiError(httpStatus.CONFLICT, "Facility profile already exists");
  // }

  // -------------------------
  let updateLocation: any = {};

  // 4️⃣ Process location if lat/long are provided in address
  if (payload.address?.lat && payload.address?.long) {
    const lat = Number(payload.address.lat);
    const long = Number(payload.address.long);

    // Create GeoJSON Point (MongoDB format: [longitude, latitude])
    updateLocation = {
      type: "Point",
      coordinates: [long, lat],
    };
  } else if (userData?.location) {
    updateLocation = userData.location;
  }
  // -------------------------

  // const facilityProfile = await prisma.facilityProfile.findUnique({
  //   where: { userId },
  //   include: {
  //     HrDetails: true,
  //   },
  // });

  // if (!facilityProfile) {
  //   throw new ApiError(httpStatus.NOT_FOUND, "Facility profile not found");
  // }

  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      profileImage:
        payload.profileImage || userData?.facilityProfile?.profileImage,
      location: updateLocation || userData?.location,
      facilityProfile: {
        update: {
          profileImage:
            payload.profileImage || userData?.facilityProfile?.profileImage,
          address: payload.address || userData?.facilityProfile?.address,
          caseType: payload.caseType || userData?.facilityProfile?.caseType,
          // certification: payload.certification || facilityProfile.certification,
          // ehrSystem: payload.ehrSystem || facilityProfile.ehrSystem,
          facilityName:
            payload.facilityName || userData?.facilityProfile?.facilityName,
          md_do: payload.md_do || userData?.facilityProfile?.md_do,
          facilityType:
            payload.facilityType || userData?.facilityProfile?.facilityType,
          orLoad: payload.orLoad || userData?.facilityProfile?.orLoad,
          // companySize: payload.companySize || userData?.facilityProfile?.companySize,
          website: payload.website || userData?.facilityProfile?.website,
          HrDetails: {
            update: userData?.facilityProfile?.HrDetails.map((hr) => ({
              where: { id: hr.id },
              data: {
                email: payload.HrDetails?.email ?? hr.email,
                name: payload.HrDetails?.name ?? hr.name,
                phoneNumber: payload.HrDetails?.phoneNumber ?? hr.phoneNumber,
                role: payload.HrDetails?.role ?? hr.role,
              },
            })),
          },
        },
      },
    },
    include: {
      facilityProfile: {
        include: {
          HrDetails: true,
        },
      },
    },
  });

  return result;
};

const getUserProfile = async (userId: string) => {
  // await prisma.facilityProfile.deleteMany({})
  const result = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      providerProfile: {
        include: {
          providerAvailability: true,
        },
      },
      facilityProfile: {
        include: {
          HrDetails: true,
        },
      },
      UserSubscription: {
        select: {
          subscriptionId: true,
          subscription: {
            select: {
              title: true,
            },
          },
          status: true,
        },
      },
      admin: {
        select: {
          id: true,
          nickName: true,
          email: true,
          state: true,
          city: true,
          country: true,
          bio: true,

          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User profile not found");
  }

  const { password, ...userProfile } = result;
  return userProfile;
};

// const getProfileById = async (id: string, userInfo: any) => {
//     if(userInfo.role===UserRole.FACILITY){

// const facilityViewProviderProfile = userInfo.trackUserFeatureUsages.find(
//     (tr: any) => tr.feature == Features_Flag.VIEW_FULL_PROVIDER_PROFILE,
//   );

//   if (!facilityViewProviderProfile) {
//     throw new ApiError(
//       httpStatus.FORBIDDEN,
//       "view provider profile  not available on your plan",
//     );
//   }

//   console.log(facilityViewProviderProfile)

//    const result = await prisma.user.findUnique({
//     where: { id },
//     select: {
//       id: true,
//       fullName: true,
//       averageRating: true,
//       totalReviewCount: true,
//       email: true,
//       facilityProfile: {
//         include: {
//           HrDetails: true,
//         },
//       },
//       providerProfile: {
//         select: {
//           id: true,
//           provider: true,
//           phoneNumber: true,
//           npiNumber: true,
//           licenceNumber: true,
//           address: true,
//           profileImage: true,
//           certification: true,
//           stateLicenced: true,
//           document: true,
//           experience: true,
//           userId: true,
//           caseTypePreference: true,
//           callRequest: true,
//           radius: true,
//           createdAt: true,
//           updatedAt: true,
//           providerAvailability: true,
//         },
//       },
//     },
//   });
//   return result
//     }

//   const result = await prisma.user.findUnique({
//     where: { id },
//     select: {
//       id: true,
//       fullName: true,
//       averageRating: true,
//       totalReviewCount: true,
//       email: true,
//       facilityProfile: {
//         include: {
//           HrDetails: true,
//         },
//       },
//       providerProfile: {
//         select: {
//           id: true,
//           provider: true,
//           phoneNumber: true,
//           npiNumber: true,
//           licenceNumber: true,
//           address: true,
//           profileImage: true,
//           certification: true,
//           stateLicenced: true,
//           document: true,
//           experience: true,
//           userId: true,
//           caseTypePreference: true,
//           callRequest: true,
//           radius: true,
//           createdAt: true,
//           updatedAt: true,
//           providerAvailability: true,
//         },
//       },
//     },
//   });

//   if (!result) {
//     throw new ApiError(httpStatus.NOT_FOUND, "User profile not found");
//   }

//   return result;
// };
const getProfileById = async (id: string, userInfo: any) => {
  const isFacility = userInfo.role === UserRole.FACILITY;

  const facilityViewProviderProfile = isFacility
    ? userInfo.trackUserFeatureUsages.find(
        (tr: any) => tr.feature === Features_Flag.VIEW_FULL_PROVIDER_PROFILE,
      )
    : null;
  let isFullAccess = true;
  if (isFacility && facilityViewProviderProfile) {
    isFullAccess = facilityViewProviderProfile?.enabled;
  }

  const providerProfileSelect = isFullAccess
    ? {
        select: {
          id: true,
          provider: true,
          phoneNumber: true,
          npiNumber: true,
          licenceNumber: true,
          address: true,
          profileImage: true,
          certification: true,
          stateLicenced: true,
          document: true,
          experience: true,
          LICENCE: true,
          DIPLOMA: true,
          PALS: true,
          ACLS: true,
          BLS: true,
          userId: true,
          caseTypePreference: true,
          callRequest: true,
          radius: true,
          createdAt: true,
          updatedAt: true,
          providerAvailability: true,
        },
      }
    : {
        select: {
          id: true,
          provider: true,
          profileImage: true,
          address: true,
        },
      };

  const result = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      averageRating: true,
      totalReviewCount: true,
      email: true,
      facilityProfile: isFullAccess
        ? { include: { HrDetails: true } }
        : { select: { id: true } },
      providerProfile: providerProfileSelect,
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User profile not found");
  }

  return result;
};
// const getBackUpUsersByJobId = async (
//   jobId: string,
//   page: number,
//   limit: number,
// ) => {
//   const job = await prisma.jobPost.findUnique({
//     where: { id: jobId },
//     select: {
//       id: true,
//       jobRole: true,
//     },
//   });

//   const jobRole = job?.jobRole;

//   const result = await prisma.user.findMany({
//     where: {
//       providerProfile: {
//         provider: {
//           has: jobRole,
//         },
//       },
//       UserSubscription:{
//         every:{
//           subscription:{
//             title:"PREMIUM"
//           }
//         }
//       }
//     },
//     select: {
//       id: true,
//       email: true,
//       averageRating: true,
//       providerProfile: true,
//     },
//     orderBy: {
//       averageRating: "desc",
//     },
//     skip: (page - 1) * limit,
//     take: limit,
//   });

//   const total = await prisma.user.count({
//     where: {
//       providerProfile: {
//         provider: {
//           has: jobRole,
//         },
//       },
//     },
//   });

//   return {
//     meta: {
//       total,
//       page,
//       limit,
//       totalPages: Math.ceil(total / limit),
//     },
//     data: result,
//   };
// };
const getBackUpUsersByJobId = async (
  jobId: string,
  page: number,
  limit: number,
) => {
  const job = await prisma.jobPost.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobRole: true,
    },
  });

  const jobRole = job?.jobRole;

  const freePlan = await prisma.subscription.findFirst({
    where: { title: "FREE", role: "PROVIDER" },
    select: { id: true },
  });

  const whereClause: Prisma.UserWhereInput = {
    role: "PROVIDER",
    providerProfile: {
      provider: {
        has: jobRole,
      },
    },

    UserSubscription: {
      some: {
        status: "ACTIVE",
        subscriptionId: {
          not: freePlan?.id,
        },
      },
    },
  };

  const [result, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        averageRating: true,
        providerProfile: true,
      },
      orderBy: {
        averageRating: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  };
};
const getProvidersByFacilityId = async (
  userId: string,
  filters: {
    searchTerm?: string;
    jobRoles?: Provider[]; // e.g. ["CRNA", "AA"]
    certificates?: string[]; // e.g. ["BLS", "ACLS"]
    states?: string[]; // e.g. ["California", "Texas"]
    ratings?: number[]; // e.g. [4, 5]
    experience?: string; // e.g. "2-3yr"
  },
  subscription: any,
  page: number = 1,
  limit: number = 10,
) => {
  // Step 1: get unique job roles for facility
  // console.log(subscription, "check subscription");
  const subscriptionTitle = subscription?.[0]?.subscription?.title ?? "FREE";

const isFreeFacility = subscriptionTitle === "FREE";

  // const isFreeFacility = subscription[0]?.subscription?.title === "FREE" || false;
  

  const uniqueJobRoles = await prisma.jobPost.groupBy({
    by: ["jobRole"],
    where: { userId },
  });

  const jobRoles = uniqueJobRoles.map((job) => job.jobRole);

  // Step 2: base condition
  const whereCondition: any = {
    providerProfile: {
      provider: { hasSome: jobRoles },
    },
  };

  if (filters?.jobRoles?.length) {
    if (isFreeFacility) {
      throw new ApiError(402, "advance search is not available in your plan  ");
    }
    whereCondition.providerProfile.provider = { hasSome: filters.jobRoles };
  }

  // Search Term
  if (filters.searchTerm) {
    whereCondition.OR = [
      { fullName: { contains: filters.searchTerm, mode: "insensitive" } },
      ...(Object.values(Provider).includes(filters.searchTerm as Provider)
        ? [
            {
              providerProfile: {
                provider: { has: filters.searchTerm as Provider },
              },
            },
          ]
        : []),
    ];
  }

  // Certification filter (enum array → hasSome)
  if (filters.certificates?.length) {
    if (isFreeFacility) {
      throw new ApiError(402, "advance search is not available in your plan  ");
    }
    whereCondition.providerProfile = {
      ...whereCondition.providerProfile,
      certification: { hasSome: filters.certificates },
    };
  }

  // State filter
  if (filters.states?.length) {
    if (isFreeFacility) {
      throw new ApiError(402, "advance search is not available in your plan  ");
    }
    whereCondition.providerProfile = {
      ...whereCondition.providerProfile,
      stateLicenced: { hasSome: filters.states }, // ✅ enum array filter
    };
  }

  // Rating filter
  if (filters.ratings?.length) {
    if (isFreeFacility) {
      throw new ApiError(402, "advance search is not available in your plan  ");
    }
    whereCondition.averageRating = { in: filters.ratings };
  }

  // Experience filter
  if (filters.experience) {
    if (isFreeFacility) {
      throw new ApiError(402, "advance search is not available in your plan  ");
    }
    whereCondition.providerProfile = {
      ...whereCondition.providerProfile,
      experience: { in: [filters.experience] }, // ✅ directly filter
    };
  }

  // Step 4: Transaction query
  const [result, total] = await prisma.$transaction([
    prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        fullName: true,
        email: true,
        averageRating: true,
        providerProfile: true,
      },
      orderBy: { averageRating: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: whereCondition }),
  ]);

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  };
};

const getUpcomingSchedule = async (
  filter: any,
  month: any,
  userId: string,
  weekStart?: any,
  weekEnd?: any,
  year?: number,
) => {
  const finalYear = year ?? new Date().getFullYear();
  const monthIndex = new Date(`${month} 1, ${finalYear}`).getMonth();

  const monthStart = new Date(Date.UTC(finalYear, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(finalYear, monthIndex + 1, 0, 23, 59, 59));
  const weekStartDate = weekStart ? new Date(weekStart) : monthStart;
  const weekEndDate = weekEnd ? new Date(weekEnd) : monthEnd;

  const generateDateRange = (start: Date, end: Date) => {
    const dates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split("T")[0]);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return dates;
  };

  const allDates =
    filter === "weekly"
      ? generateDateRange(weekStartDate, weekEndDate)
      : generateDateRange(monthStart, monthEnd);

  const pipeline: any[] = [
    { $match: { userId: { $oid: userId } } },

    {
      $lookup: {
        from: "jobApplications",
        let: { providerId: { $oid: userId } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$providerUserId", "$$providerId"] },
                  { $eq: ["$status", "APPROVED"] },
                  { $ne: ["$statusAfterApproval", "CANCELLED"] },
                ],
              },
            },
          },
          { $project: { jobPostId: 1 } },
        ],
        as: "providerJob",
      },
    },

    {
      $lookup: {
        from: "jobPost",
        localField: "providerJob.jobPostId",
        foreignField: "_id",
        as: "jobPostDetails",
      },
    },

    {
      $lookup: {
        from: "schedule",
        localField: "providerJob.jobPostId",
        foreignField: "jobPostId",
        as: "jobSchedules",
      },
    },

    {
      $lookup: {
        from: "facilityProfile",
        localField: "jobPostDetails.userId",
        foreignField: "userId",
        as: "facilityDetails",
      },
    },

    {
      $lookup: {
        from: "providerAvailability",
        localField: "_id",
        foreignField: "profileId",
        as: "providerAvailability",
      },
    },

    {
      $addFields: {
        scheduledDates: {
          $map: {
            input: { $ifNull: ["$jobSchedules", []] },
            as: "s",
            in: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$$s.date" } },
              startTime: "$$s.startTime",
              endTime: "$$s.endTime",
              jobPostId: "$$s.jobPostId",
            },
          },
        },
        availabilityDates: {
          $map: {
            input: { $ifNull: ["$providerAvailability", []] },
            as: "a",
            in: { $dateToString: { format: "%Y-%m-%d", date: "$$a.date" } },
          },
        },
      },
    },

    {
      $project: {
        calendar: {
          $arrayToObject: {
            $map: {
              input: { $literal: allDates },
              as: "day",
              in: {
                k: "$$day",
                v: {
                  $let: {
                    vars: {
                      daySchedules: {
                        $filter: {
                          input: "$scheduledDates",
                          as: "s",
                          cond: { $eq: ["$$s.date", "$$day"] },
                        },
                      },
                    },
                    in: {
                      status: {
                        $cond: [
                          { $gt: [{ $size: "$$daySchedules" }, 0] },
                          "Scheduled",
                          {
                            $cond: [
                              { $in: ["$$day", "$availabilityDates"] },
                              "Available",
                              "Day Off",
                            ],
                          },
                        ],
                      },
                      jobs: {
                        $map: {
                          input: "$$daySchedules",
                          as: "sched",
                          in: {
                            jobPost: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: "$jobPostDetails",
                                    as: "jp",
                                    cond: {
                                      $eq: ["$$jp._id", "$$sched.jobPostId"],
                                    },
                                  },
                                },
                                0,
                              ],
                            },
                            schedule: {
                              startTime: "$$sched.startTime",
                              endTime: "$$sched.endTime",
                            },
                            facilityLocation: {
                              $arrayElemAt: [
                                {
                                  $map: {
                                    input: "$facilityDetails",
                                    as: "fd",
                                    in: "$$fd.address",
                                  },
                                },
                                0,
                              ],
                            },
                            facilityName: {
                              $arrayElemAt: [
                                {
                                  $map: {
                                    input: "$facilityDetails",
                                    as: "fd",
                                    in: "$$fd.facilityName",
                                  },
                                },
                                0,
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const result = await prisma.$runCommandRaw({
    aggregate: "providerProfile",
    pipeline,
    cursor: {},
  });

  return result;
};

const getProviderUpcomingSchedule = async (providerId: string) => {
  const now = new Date();

  const jobApplications = await prisma.jobApplication.findMany({
    where: { providerUserId: providerId },
    include: {
      jobPost: {
        include: {
          schedule: true,
          JobApplication: {
            select: {
              facilityUser: {
                select: {
                  fullName: true,
                  facilityProfile: {
                    select: {
                      address: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return jobApplications.map((app) => {
    let computedStatus = "Day Off";

    if (app.statusAfterApproval === "NO_SHOW") {
      computedStatus = "NO SHOW";
    } else if (app.statusAfterApproval === "REQUESTED") {
      computedStatus = "REQUESTED";
    } else if (app.statusAfterApproval === "COMPLETED") {
      computedStatus = "COMPLETED";
    } else if (app.statusAfterApproval === "CANCELLED") {
      computedStatus = "CANCELLED";
    } else if (
      app.jobPost.schedule.some(
        (sched) =>
          sched.startTime <= now &&
          sched.endTime >= now &&
          app.status === "APPROVED",
      )
    ) {
      computedStatus = "INPROGRESS";
    } else if (
      app.jobPost.schedule.some(
        (sched) => sched.endTime < now && app.status === "APPROVED",
      )
    ) {
      computedStatus = "PENDING COMPLETION";
    } else if (
      app.jobPost.schedule.some(
        (sched) => sched.startTime > now && app.status === "APPROVED",
      )
    ) {
      computedStatus = "SCHEDULED";
    } else if (app.statusAfterApproval === "PENDING") {
      computedStatus = "PENDING";
    }

    return {
      jobPostDetails: app.jobPost,
      computedStatus,
    };
  });
};
const getProviderAvailability = async (providerId: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.providerProfile.findUnique({
    where: {
      userId: providerId,
    },
    select: {
      providerAvailability: {
        where: {
          date: {
            gte: today,
          },
        },
        select: {
          availability: true,
          date: true,
          endTime: true,
          startTime: true,
        },
        orderBy: {
          date: "asc",
        },
      },
    },
  });

  return result;
};

const getAllFacilityHeaderCounts = async (userId: string) => {
  const pendingRequestCount = await prisma.jobApplication.count({
    where: {
      facilityUserId: userId,
      status: JobStatus.PENDING,
      applier: jobApplier.PROVIDER,
    },
  });
  const upcomingJobsCountForNextSevenDays = await prisma.jobPost.count({
    where: {
      userId: userId,
      schedule: {
        some: {
          startTime: {
            gte: new Date(),
            lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
    },
  });

  return {
    pendingRequestCount,
    upcomingJobsCountForNextSevenDays,
  };
};

const featuredAddforSubscribedUser = async (
  tx: any,
  subscriptionFeatures: any,
  userId: string,
) => {
  // if (!subscriptionFeatures || subscriptionFeatures.length === 0) {
  //   await tx.trackUserFeatureUsage.updateMany({
  //     where: { userId, isGlobal: false },
  //     data: { isActive: false },
  //   });
  //   return;
  // }

  const activeFeatureFlags: Features_Flag[] = subscriptionFeatures.map(
    (f: any) => f.feature,
  );

  await Promise.all(
    subscriptionFeatures.map((sub: any) => {
      const expiredAt = calculateExpiredAt(sub.frequency);

      return tx.trackUserFeatureUsage.upsert({
        where: {
          userId_feature: {
            userId,
            feature: sub.feature,
          },
        },
        create: {
          userId,
          feature: sub.feature,
          featureType: sub.featureType,
          limit: sub.limit,
          enabled: sub.enabled,
          expiredAt,
          isGlobal: sub.isGlobal,
          isActive: true,
        },
        update: {
          limit: sub.limit,
          expiredAt,
          isActive: true,
        },
      });
    }),
  );

  await tx.trackUserFeatureUsage.deleteMany({
    where: {
      userId,
      feature: { notIn: activeFeatureFlags },
    },
    // data: {
    //   isActive: false,
    // },
  });
};
const calculateExpiredAt = (frequency: FeatureFrequency): Date | null => {
  const now = new Date();

  switch (frequency) {
    case "HOUR":
      now.setHours(now.getHours() + 1);
      return now;

    case "DAY":
      now.setDate(now.getDate() + 1);
      return now;

    case "WEEK":
      now.setDate(now.getDate() + 7);
      return now;

    case "MONTH":
      now.setMonth(now.getMonth() + 1);
      return now;

    case "NONE":
    default:
      return null;
  }
};

export const userService = {
  createUser,
  updateProviderProfile,
  updateProviderResume,
  selectUploadedResume,
  deleteDocument,
  createFacilityProfile,
  updateFacilityProfile,
  // updateFaciltyProfile,
  getUserProfile,
  getProfileById,
  getBackUpUsersByJobId,
  getProvidersByFacilityId,
  getUpcomingSchedule,
  getProviderUpcomingSchedule,
  getProviderAvailability,
  getAllFacilityHeaderCounts,
  featuredAddforSubscribedUser,
  calculateExpiredAt,

  updateProviderBLS,
  updateProviderACLS,
  updateProviderPALS,
  updateProviderDIPLOMA,
  updateProviderLICENCE,
  deleteProviderBLS,
  deleteProviderACLS,
  deleteProviderPALS,
  deleteProviderDIPLOMA,
  deleteProviderLICENCE,
};
