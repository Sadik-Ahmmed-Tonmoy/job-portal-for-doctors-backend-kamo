//

import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { userService } from "./user.service";
import sendResponse from "../../../shared/sendResponse";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import uploadToDigitalOcean from "../../../helpers/uploadToDigitalOcean";
import { deleteFromDigitalOcean } from "../../../helpers/deleteFromDigitalOccean";
import prisma from "../../../shared/prisma";
import { userValidation } from "./user.validation";
import { ConnectionCheckOutStartedEvent } from "mongodb";
import { log } from "console";
import { Provider } from "@prisma/client";

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createUser(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "A Otp has been send to your gmail",
    data: result,
  });
});

const updateProviderProfile = catchAsync(
  async (req: Request, res: Response) => {
    let uploadedDocumentUrl: string | null = null;
    let uploadedBLSUrl: string | null = null;
    let uploadedACLSUrl: string | null = null;
    let uploadedPALSUrl: string | null = null;
    let uploadedDIPLOMAUrl: string | null = null;
    let uploadedLICENCEUrl: string | null = null;
    let uploadedProfileImageUrl: string | null = null;

    const isNewProfile = !(await prisma.providerProfile.findUnique({
      where: { userId: req.user.id },
    }));

    const schema = isNewProfile
      ? userValidation.createProviderProfileSchema
      : userValidation.updateProviderProfile;

    schema.parse(req.body);

    try {
      const files = req.files as {
        document?: any[];
        BLS?: any[];
        ACLS?: any[];
        PALS?: any[];
        DIPLOMA?: any[];
        LICENCE?: any[];
        profileImage?: any[];
      };

      if (isNewProfile && !files?.document?.[0]) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Document is required for new profile",
        );
      }

      if (files?.document?.[0]) {
        uploadedDocumentUrl = await uploadToDigitalOcean(files.document[0]);
        req.body.document = [
          {
            url: uploadedDocumentUrl,
            fileName: files.document[0].originalname,
            isSelected: true,
          },
        ];
      }

      if (files?.BLS?.[0]) {
        uploadedBLSUrl = await uploadToDigitalOcean(files.BLS[0]);
        req.body.BLS = [
          {
            url: uploadedBLSUrl,
            fileName: files.BLS[0].originalname,
            isSelected: true,
          },
        ];
      }

      if (files?.ACLS?.[0]) {
        uploadedACLSUrl = await uploadToDigitalOcean(files.ACLS[0]);
        req.body.ACLS = [
          {
            url: uploadedACLSUrl,
            fileName: files.ACLS[0].originalname,
            isSelected: true,
          },
        ];
      }

      if (files?.PALS?.[0]) {
        uploadedPALSUrl = await uploadToDigitalOcean(files.PALS[0]);
        req.body.PALS = [
          {
            url: uploadedPALSUrl,
            fileName: files.PALS[0].originalname,
            isSelected: true,
          },
        ];
      }

      if (files?.DIPLOMA?.[0]) {
        uploadedDIPLOMAUrl = await uploadToDigitalOcean(files.DIPLOMA[0]);
        req.body.DIPLOMA = [
          {
            url: uploadedDIPLOMAUrl,
            fileName: files.DIPLOMA[0].originalname,
            isSelected: true,
          },
        ];
      }

      if (files?.LICENCE?.[0]) {
        uploadedLICENCEUrl = await uploadToDigitalOcean(files.LICENCE[0]);
        req.body.LICENCE = [
          {
            url: uploadedLICENCEUrl,
            fileName: files.LICENCE[0].originalname,
            isSelected: true,
          },
        ];
      }

      if (files?.profileImage?.[0]) {
        uploadedProfileImageUrl = await uploadToDigitalOcean(
          files.profileImage[0],
        );
        req.body.profileImage = uploadedProfileImageUrl;
      }
      const result = await userService.updateProviderProfile(
        req.body,
        req.user.id,
        isNewProfile,
      );

      sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Provider profile updated successfully",
        data: result,
      });
    } catch (error) {
      if (uploadedDocumentUrl) {
        await deleteFromDigitalOcean(uploadedDocumentUrl).catch(() => {});
      }
      if (uploadedProfileImageUrl) {
        await deleteFromDigitalOcean(uploadedProfileImageUrl).catch(() => {});
      }
      throw error;
    }
  },
);

const updateProviderResume = catchAsync(async (req: Request, res: Response) => {
  let uploadedDocumentUrl: string | null = null;

  try {
    // Handle files from form-data
    const file = req.file;

    // Upload document if provided
    if (file) {
      uploadedDocumentUrl = await uploadToDigitalOcean(file);
    }

    // Parse JSON from bodyData (string → object)
    let bodyData: { [key: string]: any } = {};

    // Add file URLs to payload
    if (uploadedDocumentUrl && file) {
      bodyData.document = [
        {
          url: uploadedDocumentUrl,
          fileName: file.originalname,
          isSelected: true,
        },
      ];
    }
    const result = await userService.updateProviderResume(
      bodyData,
      req.user.id,
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Provider profile updated successfully",
      data: result,
    });
  } catch (error) {
    // Rollback uploaded files if an error occurs
    if (uploadedDocumentUrl) {
      await deleteFromDigitalOcean(uploadedDocumentUrl).catch(() => {});
    }
    throw error;
  }
});

const selectUploadedResume = catchAsync(async (req: Request, res: Response) => {
  const url = req.body.url;
  const result = await userService.selectUploadedResume(url, req.user.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Uploaded resume selected successfully",
    data: {},
  });
});

const deleteDocument = catchAsync(async (req: Request, res: Response) => {
  const url = req.body.url;
  const result = await userService.deleteDocument(url, req.user.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Document deleted successfully",
    data: result,
  });
});

const updateProviderBLS = catchAsync(async (req: Request, res: Response) => {
  let uploadedBLSUrl: string | null = null;
  const file = req.file;
  try {
    if (file) {
      uploadedBLSUrl = await uploadToDigitalOcean(file);
    }
  } catch (error) {
    if (uploadedBLSUrl) {
      await deleteFromDigitalOcean(uploadedBLSUrl).catch(() => {});
    }
    throw error;
  }
  const result = await userService.updateProviderBLS(
    {
      BLS: [
        {
          url: uploadedBLSUrl as string,
          fileName: file?.originalname,
          isSelected: true,
        },
      ],
    },
    req.user.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider BLS updated successfully",
    data: result,
  });
});

const updateProviderACLS = catchAsync(async (req: Request, res: Response) => {
  let uploadedACLSUrl: string | null = null;
  const file = req.file;
  try {
    if (file) {
      uploadedACLSUrl = await uploadToDigitalOcean(file);
    }
  } catch (error) {
    if (uploadedACLSUrl) {
      await deleteFromDigitalOcean(uploadedACLSUrl).catch(() => {});
    }
    throw error;
  }
    const result = await userService.updateProviderACLS(
      {
        ACLS: [
          {
            url: uploadedACLSUrl as string,
            fileName: file?.originalname,
            isSelected: true,
          },
        ],
      },
      req.user.id,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Provider ACLS updated successfully",
      data: result,
    });
});

const updateProviderPALS = catchAsync(async (req: Request, res: Response) => {
  let uploadedPALSUrl: string | null = null;
  const file = req.file;
  try {
    if (file) {
      uploadedPALSUrl = await uploadToDigitalOcean(file);
    }
  } catch (error) {
    if (uploadedPALSUrl) {
      await deleteFromDigitalOcean(uploadedPALSUrl).catch(() => {});
    }
    throw error;
  }
  const result = await userService.updateProviderPALS(
    {
      PALS: [
        {
          url: uploadedPALSUrl as string,
          fileName: file?.originalname,
          isSelected: true,
        },
      ],
    },
    req.user.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider PALS updated successfully",
    data: result,
  });
});

const updateProviderDIPLOMA = catchAsync(async (req: Request, res: Response) => {
  let uploadedDIPLOMAUrl: string | null = null;
  const file = req.file;
  try {
    if (file) {
      uploadedDIPLOMAUrl = await uploadToDigitalOcean(file);
    }
  } catch (error) {
    if (uploadedDIPLOMAUrl) {
      await deleteFromDigitalOcean(uploadedDIPLOMAUrl).catch(() => {});
    }
    throw error;
  }
  const result = await userService.updateProviderDIPLOMA(
    {
      DIPLOMA: [
        {
          url: uploadedDIPLOMAUrl as string,
          fileName: file?.originalname,
          isSelected: true,
        },
      ],
    },
    req.user.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider DIPLOMA updated successfully",
    data: result,
  });
});

const updateProviderLICENCE = catchAsync(async (req: Request, res: Response) => {
  let uploadedLICENCEUrl: string | null = null;
  const file = req.file;
  try {
    if (file) {
      uploadedLICENCEUrl = await uploadToDigitalOcean(file);
    }
  } catch (error) {
    if (uploadedLICENCEUrl) {
      await deleteFromDigitalOcean(uploadedLICENCEUrl).catch(() => {});
    }
    throw error;
  }
  const result = await userService.updateProviderLICENCE(
    {
      LICENCE: [
        {
          url: uploadedLICENCEUrl as string,
          fileName: file?.originalname,
          isSelected: true,
        },
      ],
    },
    req.user.id,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider LICENCE updated successfully",
    data: result,
  });
});

const deleteProviderBLS = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteProviderBLS(req.user.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider BLS deleted successfully",
    data: result,
  });
});

const deleteProviderACLS = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteProviderACLS(req.user.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider ACLS deleted successfully",
    data: result,
  });
});

const deleteProviderPALS = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteProviderPALS(req.user.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider PALS deleted successfully",
    data: result,
  });
});

const deleteProviderDIPLOMA = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteProviderDIPLOMA(req.user.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider DIPLOMA deleted successfully",
    data: result,
  });
});

const deleteProviderLICENCE = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteProviderLICENCE(req.user.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Provider LICENCE deleted successfully",
    data: result,
  });
});



const createFacilityProfile = catchAsync(
  async (req: Request, res: Response) => {
    const result = await userService.createFacilityProfile(
      req.body,
      req.user.id,
    );
    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Facility profile created successfully",
      data: result,
    });
  },
);

const updateFacilityProfile = catchAsync(
  async (req: Request, res: Response) => {
    let uploadedProfileImageUrl: string | null = null;

    try {
      const file = req.file;

      if (file) {
        uploadedProfileImageUrl = await uploadToDigitalOcean(file);
        req.body.profileImage = uploadedProfileImageUrl;
      }
    } catch (error) {
      // Rollback uploaded files if an error occurs
      if (uploadedProfileImageUrl) {
        await deleteFromDigitalOcean(uploadedProfileImageUrl).catch(() => {});
      }
      throw error;
    }
    const result = await userService.updateFacilityProfile(
      req.body,
      req.user.id,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Facility profile updated successfully",
      data: result,
    });
  },
);

// const updateFaciltyProfile = catchAsync(async (req: Request, res: Response) => {
//   let uploadedProfileImageUrl: string | null = null;

//   const profile = await prisma.facilityProfile.findUnique({
//     where: { userId: req.user.id },
//   });

//   const isNewProfile = !profile;
//   //  console.log(isNewProfile, "isNewProfile");
//   const schema = isNewProfile
//     ? userValidation.createFacilityProfile
//     : userValidation.updateFacilityProfile;

//   schema.parse(req.body);

//   try {
//     const file = req.file;

//     if (file) {
//       uploadedProfileImageUrl = await uploadToDigitalOcean(file);
//       req.body.profileImage = uploadedProfileImageUrl;
//     }

//     const result = await userService.updateFaciltyProfile(
//       req.body,
//       req.user.id,
//       profile
//     );

//     sendResponse(res, {
//       statusCode: 201,
//       success: true,
//       message: "facility profile update successfully",
//       data: result,
//     });
//   } catch (error) {
//     // Rollback uploaded files if an error occurs
//     if (uploadedProfileImageUrl) {
//       await deleteFromDigitalOcean(uploadedProfileImageUrl).catch(() => {});
//     }
//     throw error;
//   }
// });

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getUserProfile(req.user.id);
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User profile not found");
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User profile retrieved successfully",
    data: result,
  });
});

const getProfileById = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getProfileById(req.params.id, req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const getBackUpUsersByJobId = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.params.jobId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Job ID is required");
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const result = await userService.getBackUpUsersByJobId(
      req.params.jobId,
      page,
      limit,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Backup users retrieved successfully",
      data: result,
    });
  },
);

const getProvidersByFacilityId = catchAsync(
  async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await userService.getProvidersByFacilityId(
      req.user.id,
      {
        searchTerm: req.query.searchTerm as string,
        jobRoles: req.query.jobRoles
          ? ((req.query.jobRoles as string).split(",") as Provider[])
          : undefined,
        certificates: req.query.certificates
          ? (req.query.certificates as string).split(",")
          : undefined,
        states: req.query.states
          ? (req.query.states as string).split(",")
          : undefined,
        ratings: req.query.ratings
          ? (req.query.ratings as string)
              .split(",")
              .map((rating) => Number(rating))
          : undefined,
        experience: req.query.experience as string | undefined,
      },
      req.user.UserSubscription as any,
      page,
      limit,
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Providers retrieved successfully",
      data: result,
    });
  },
);

const getUpcomingSchedue = catchAsync(async (req: Request, res: Response) => {
  const { filter, month, weekStart, weekEnd, year } = req.query;
  const result = await userService.getUpcomingSchedule(
    filter,
    month,
    req.user.id,
    weekStart,
    weekEnd,
    Number(year),
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "upcoming schedule get successfully",
    data: result,
  });
});
const getProviderUpcomingSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const result = await userService.getProviderUpcomingSchedule(
      req.user.id,
      // Number(page),
      // Number(limit)
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "provider upcoming schedule get successfully",
      data: result,
    });
  },
);
const getProviderAvailability = catchAsync(
  async (req: Request, res: Response) => {
    const result = await userService.getProviderAvailability(
      req.user.id,
      // Number(page),
      // Number(limit)
    );
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "provider avaialibility get successfully",
      data: result,
    });
  },
);

const getAllFacilityHeaderCounts = catchAsync(
  async (req: Request, res: Response) => {
    const result = await userService.getAllFacilityHeaderCounts(req.user.id);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Facility header counts retrieved successfully",
      data: result,
    });
  },
);

export const userController = {
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
  getUpcomingSchedue,
  getProviderUpcomingSchedule,
  getProviderAvailability,
  getAllFacilityHeaderCounts,

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
