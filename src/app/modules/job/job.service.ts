import {
  jobApplier,
  JobStatus,
  JobStatusAfterApprovedByFacility,
  NotificationType,
  Prisma,
  $Enums,
  Features_Flag,
} from "@prisma/client";
 
import httpStatus from "http-status";
import moment, { duration } from "moment";
import ApiError from "../../../errors/ApiErrors";
import prisma from "../../../shared/prisma";
import { notificationServices } from "../notifications/notification.service";
import { ConnectionCheckOutStartedEvent } from "mongodb";

const createJob = async (payload: any, userId: string) => {
  const [startHour, startMinute] = payload.startTime.split(":").map(Number);
  const [endHour, endMinute] = payload.endTime.split(":").map(Number);

  const scheduleEntries = payload.date.map((isoString: string) => {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) throw new Error("Invalid date from payload");

    const startTime = new Date(date);
    startTime.setUTCHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setUTCHours(endHour, endMinute, 0, 0);

    return { date, startTime, endTime };
  });

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const result = await prisma.$transaction(async (tr) => {
        const jobCreate = await tr.jobPost.create({
          data: {
            about: payload.about,
            experience: payload.experience,
            userId: userId,
            jobRole: payload.jobRole,
            qualification: payload.qualification,
            totalCandidate: payload.totalCandidate,
            minPriceRange: payload.minPriceRange,
            maxPriceRange: payload.maxPriceRange,
            duration: payload.duration,
            schedule: {
              create: scheduleEntries,
            },
          },
        });

        await tr.trackUserFeatureUsage.update({
          where: {
            userId_feature: {
              userId: userId,
              feature: "JOB_POST",
            },
          },
          data: {
            usedCount: { increment: 1 },
          },
        });

        return jobCreate;
      });

      return result;
    } catch (error: any) {
      if (error?.code === "P2034" && attempt < MAX_RETRIES - 1) {
        attempt++;
        console.warn(`⚠️ Deadlock detected, retrying... (attempt ${attempt})`);
        await new Promise((res) => setTimeout(res, 100 * attempt));
      } else {
        throw error;
      }
    }
  }
};

// const getJobpost = async (
//   userId: string,
//   page: number = 1,
//   limit: number = 10
// ) => {
//   const skip = (page - 1) * limit;

//   const jobPosts = await prisma.jobPost.findMany({
//     where: { userId },
//     skip,
//     take: limit,
//     include: {
//       schedule: true,
//       user: {
//         select: {
//           facilityProfile: {
//             select: {
//               facilityName: true,
//               address: true,
//               facilityType: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   const withTotalUserCountForThisJobMatcher = await Promise.all(
//     jobPosts.map(async (job: JobPost) => ({
//       ...job,
//       totalUserCountForThisJob: job?.jobRole
//         ? await prisma.user.count({
//             where: {
//               role: "PROVIDER",
//               status: "ACTIVE",
//               providerProfile: {
//                 provider: {
//                   hasSome: Array.isArray(job.jobRole)
//                     ? job.jobRole
//                     : [job.jobRole],
//                 },
//               },
//             },
//           })
//         : 0,
//     }))
//   );

//   const total = await prisma.jobPost.count({ where: { userId } });

//   return {
//     meta: {
//       total,
//       page,
//       limit,
//       totalPages: Math.ceil(total / limit),
//     },
//     data: withTotalUserCountForThisJobMatcher,
//   };
// };

const getJobsForFacilityByUserId = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  // 1️⃣ Fetch job posts with schedule + facility profile
  const jobPosts = await prisma.jobPost.findMany({
    where: { userId },
    skip,
    take: limit,
    include: {
      schedule: true,
      user: {
        select: {
          facilityProfile: {
            select: {
              profileImage: true,
              facilityName: true,
              address: true,
              facilityType: true,
            },
          },
        },
      },
    },
  });

  if (jobPosts.length === 0) {
    return {
      meta: { total: 0, page, limit, totalPages: 0 },
      data: [],
    };
  }

  const jobIds = jobPosts.map((job) => job.id);
  const jobRoles = [...new Set(jobPosts.map((job) => job.jobRole))];

  // 2️⃣ Applications count per job (grouped)
  const applications = await prisma.jobApplication.groupBy({
    by: ["jobPostId"],
    where: { jobPostId: { in: jobIds } },
    _count: { jobPostId: true },
  });

  const applicationCounts: Record<string, number> = {};
  applications.forEach((app) => {
    applicationCounts[app.jobPostId] = app._count.jobPostId;
  });

  // 3️⃣ Provider count per jobRole (grouped)
  const providers = await prisma.user.findMany({
    where: {
      role: "PROVIDER",
      status: "ACTIVE",
      providerProfile: {
        provider: { hasSome: jobRoles },
      },
    },
    select: {
      providerProfile: { select: { provider: true } },
    },
  });

  const providerRoleCounts: Record<string, number> = {};
  jobRoles.forEach((role) => {
    providerRoleCounts[role] = providers.filter((p) =>
      p.providerProfile?.provider.includes(role),
    ).length;
  });

  // 4️⃣ Pagination meta
  const total = await prisma.jobPost.count({ where: { userId } });

  // 5️⃣ Merge results
  const withCounts = jobPosts.map((job) => ({
    ...job,
    totalAppliedCountToThisJob: applicationCounts[job.id] || 0,
    totalUserCountForThisJob: providerRoleCounts[job.jobRole] || 0,
  }));

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: withCounts,
  };
};

const oldSearchJob = async (
  userId: string,
  searchTerm: string,
  page: number,
  limit: number,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      providerProfile: {
        select: {
          provider: true,
          providerAvailability: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { providerProfile } = user;

  let whereClause: any = {};

  const cleanedSearchTerm = searchTerm?.trim().replace(/^"|"$/g, "");

  if (cleanedSearchTerm && cleanedSearchTerm.length > 0) {
    whereClause = {
      OR: [
        { about: { contains: cleanedSearchTerm, mode: "insensitive" } },
        { qualification: { contains: cleanedSearchTerm, mode: "insensitive" } },
        {
          user: {
            facilityProfile: {
              facilityName: {
                contains: cleanedSearchTerm,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    };
  } else {
    if (!providerProfile) {
      throw new Error("Provider profile not found");
    }

    if (!providerProfile.provider?.length) {
      throw new Error("Provider role not set");
    }

    const availability = providerProfile.providerAvailability;

    if (!availability?.length) {
      return [];
    }

    // const availabilityConditions = availability.map((slot) => ({
    //   schedule: {
    //     some: {
    //       AND: [
    //         { date: slot.date },
    //         { startTime: { gte: slot.startTime } },
    //         { endTime: { lte: slot.endTime } },
    //       ],
    //     },
    //   },
    // }));

    whereClause = {
      jobRole: { in: providerProfile.provider },
      // OR: availabilityConditions,
    };
  }
  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(limit, 1);
  const jobs = await prisma.jobPost.findMany({
    where: whereClause,
    include: {
      schedule: true,
      user: {
        select: {
          id: true,
          facilityProfile: {
            select: {
              facilityName: true,
              address: true,
              profileImage: true,

              HrDetails: {
                select: {
                  phoneNumber: true,
                  role: true,
                },
              },
            },
          },
        },
      },
      JobApplication: {
        where: {
          providerUserId: userId,
        },
        select: {
          id: true,
        },
      },
    },
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    orderBy: { createdAt: "desc" },
  });

  //   const result = jobs.map((job) => ({
  //   ...job,
  //   isApplied: job.JobApplication.length > 0,
  // }));

  const total = await prisma.jobPost.count({ where: whereClause });

  return {
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
    data: jobs,
  };
};
// const jobSearch = async (
//   userId: string,
//   userInfo: any,
//   specialty: any,
//   duration: any,
//   searchTerm?: string,
//   page = 1,
//   limit = 10,
//   distance?: number,
// ) => {
//   const skip = (page - 1) * limit;
//   const now = new Date(); // Today is 2026-03-31

//   const lng = Number(userInfo?.location?.coordinates?.[0]);
//   const lat = Number(userInfo?.location?.coordinates?.[1]);

//   const basePipeline: any[] = [];
//   const userJobPostTrackFeature = userInfo.trackUserFeatureUsages.find(
//     (tr: any) => tr.feature == Features_Flag.ADVANCED_SEARCH,
//   );
//   const isAdvancedEnabled = userJobPostTrackFeature?.enabled;

//   const userHasLocation = Number.isFinite(lat) && Number.isFinite(lng);
//   const isCustomDistance = Number.isFinite(distance);

//   if (isCustomDistance) {
//     if (!isAdvancedEnabled) {
//       throw new ApiError(402, "Advanced search is not available in your plan");
//     }
//     if (!userHasLocation) {
//       throw new ApiError(httpStatus.BAD_REQUEST, "User location is required");
//     }
//     basePipeline.push({
//       $geoNear: {
//         near: { type: "Point", coordinates: [lng, lat] },
//         distanceField: "distance",
//         maxDistance: distance! * 1000,
//         spherical: true,
//       },
//     });
//   } else if (userHasLocation) {
//     basePipeline.push({
//       $geoNear: {
//         near: { type: "Point", coordinates: [lng, lat] },
//         distanceField: "distance",
//         maxDistance: 50 * 1000,
//         spherical: true,
//       },
//     });
//   }

//   basePipeline.push({ $match: { role: "FACILITY" } });
//   basePipeline.push(
//     {
//       $lookup: {
//         from: "jobPost",
//         localField: "_id",
//         foreignField: "userId",
//         as: "jobs",
//       },
//     },
//     { $unwind: "$jobs" },
//     {
//       $match: {
//         $expr: { $lt: ["$jobs.totalAccepted", "$jobs.totalCandidate"] },
//       },
//     },
//   );

//   if (specialty) {
//     if (!isAdvancedEnabled) throw new ApiError(402, "Advanced search required");
//     basePipeline.push({ $match: { "jobs.jobRole": specialty } });
//   } else if (
//     userInfo.role === "PROVIDER" &&
//     userInfo.providerProfile?.provider?.length > 0
//   ) {
//     basePipeline.push({
//       $match: { "jobs.jobRole": { $in: userInfo.providerProfile.provider } },
//     });
//   }

//   if (duration) {
//     if (!isAdvancedEnabled) throw new ApiError(402, "Advanced search required");
//     basePipeline.push({ $match: { "jobs.duration": duration } });
//   }

//   basePipeline.push(
//     {
//       $lookup: {
//         from: "schedule",
//         let: { jobId: { $toString: "$jobs._id" } },
//         pipeline: [
//           {
//             $match: {
//               $expr: { $eq: ["$jobPostId", { $toObjectId: "$$jobId" }] },
//             },
//           },
//         ],
//         as: "schedules",
//       },
//     },
//     {
//       $addFields: {
//         schedules: {
//           $filter: {
//             input: "$schedules",
//             as: "s",
//             cond: { $gt: ["$$s.endTime", "$$NOW"] }, //  Use MongoDB's $$NOW
//           },
//         },
//       },
//     },
//     { $match: { "schedules.0": { $exists: true } } },
//   );

//   // 5. Search Term
//   if (searchTerm) {
//     basePipeline.push({
//       $match: {
//         $or: [
//           { "jobs.about": { $regex: searchTerm, $options: "i" } },
//           { "jobs.qualification": { $regex: searchTerm, $options: "i" } },
//         ],
//       },
//     });
//   }

//   // 6. FIXED: APPLIED JOBS FILTER (Move this BEFORE count calculation)
//   basePipeline.push(
//     {
//       $lookup: {
//         from: "jobApplications",
//         let: { jobId: "$jobs._id" },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $and: [
//                   { $eq: ["$jobPostId", "$$jobId"] },
//                   { $eq: ["$providerUserId", { $toObjectId: userId }] },
//                 ],
//               },
//             },
//           },
//         ],
//         as: "JobApplication",
//       },
//     },
//     { $match: { JobApplication: { $size: 0 } } },
//   );

//   // 7. FACILITY & HR (Needed for final project but can be before count)
//   basePipeline.push(
//     {
//       $lookup: {
//         from: "facilityProfile",
//         localField: "_id",
//         foreignField: "userId",
//         as: "facilityProfile",
//       },
//     },
//     { $unwind: { path: "$facilityProfile", preserveNullAndEmptyArrays: true } },
//     {
//       $lookup: {
//         from: "hrDetails",
//         localField: "facilityProfile._id",
//         foreignField: "facilityProfileId",
//         as: "facilityProfile.HrDetails",
//       },
//     },
//   );

//   // 8. CALCULATE TOTAL (Now it will be 2 instead of 4)
//   const countPipeline = [...basePipeline, { $count: "total" }];
//   const countResult: any = await prisma.$runCommandRaw({
//     aggregate: "users",
//     pipeline: countPipeline,
//     cursor: {},
//   });

//   const total = countResult.cursor.firstBatch[0]?.total || 0;
//   const totalPages = Math.ceil(total / limit);

//   // 9. SAVED JOBS & PROJECTION
//   const pipeline: any[] = [...basePipeline];

//   pipeline.push({
//     $lookup: {
//       from: "savedJobs",
//       let: { jobId: "$jobs._id" },
//       pipeline: [
//         {
//           $match: {
//             $expr: {
//               $and: [
//                 { $eq: ["$jobPostId", "$$jobId"] },
//                 { $eq: ["$userId", { $toObjectId: userId }] },
//               ],
//             },
//           },
//         },
//       ],
//       as: "SavedJob",
//     },
//   });

//   const fields = {
//     _id: 0,
//     id: { $toString: "$jobs._id" },
//     userId: { $toString: "$_id" },
//     jobRole: "$jobs.jobRole",
//     about: "$jobs.about",
//     qualification: "$jobs.qualification",
//     minPriceRange: "$jobs.minPriceRange",
//     maxPriceRange: "$jobs.maxPriceRange",
//     experience: "$jobs.experience",
//     totalCandidate: "$jobs.totalCandidate",
//     totalAccepted: "$jobs.totalAccepted",
//     duration: "$jobs.duration",
//     createdAt: {
//       $dateToString: {
//         date: "$jobs.createdAt",
//         format: "%Y-%m-%dT%H:%M:%S.%LZ",
//       },
//     },
//     updatedAt: {
//       $dateToString: {
//         date: "$jobs.updatedAt",
//         format: "%Y-%m-%dT%H:%M:%S.%LZ",
//       },
//     },
//     schedule: {
//       $map: {
//         input: "$schedules",
//         as: "s",
//         in: {
//           id: { $toString: "$$s._id" },
//           jobPostId: { $toString: "$$s.jobPostId" },
//           date: {
//             $dateToString: {
//               date: "$$s.date",
//               format: "%Y-%m-%dT%H:%M:%S.%LZ",
//             },
//           },
//           startTime: {
//             $dateToString: {
//               date: "$$s.startTime",
//               format: "%Y-%m-%dT%H:%M:%S.%LZ",
//             },
//           },
//           endTime: {
//             $dateToString: {
//               date: "$$s.endTime",
//               format: "%Y-%m-%dT%H:%M:%S.%LZ",
//             },
//           },
//         },
//       },
//     },
//     user: {
//       id: { $toString: "$_id" },
//       facilityProfile: {
//         facilityName: "$facilityProfile.facilityName",
//         profileImage: "$facilityProfile.profileImage",
//         address: "$facilityProfile.address",
//         HrDetails: {
//           $map: {
//             input: "$facilityProfile.HrDetails",
//             as: "hr",
//             in: { phoneNumber: "$$hr.phoneNumber", role: "$$hr.role" },
//           },
//         },
//       },
//     },
//     isApplied: { $literal: false },
//     isSaved: { $gt: [{ $size: "$SavedJob" }, 0] },
//     distance: 1,
//   };

//   const providerFreeUser = {
//     _id: 0,
//     id: { $toString: "$jobs._id" },
//     userId: { $toString: "$_id" },
//     jobRole: "$jobs.jobRole",
//     qualification: "$jobs.qualification",
//     minPriceRange: "$jobs.minPriceRange",
//     maxPriceRange: "$jobs.maxPriceRange",
//     user: {
//       id: { $toString: "$_id" },
//       facilityProfile: {
//         facilityName: "$facilityProfile.facilityName",
//         address: "$facilityProfile.address",
//       },
//     },
//     isApplied: { $literal: false },
//     isSaved: { $gt: [{ $size: "$SavedJob" }, 0] },
//     distance: 1,
//   };

//   const viewAllJobsDetails = userInfo.trackUserFeatureUsages.find(
//     (tr: any) => tr.feature == Features_Flag.VIEW_FULL_JOB_DETAILS,
//   );

//   pipeline.push(
//     { $skip: skip },
//     { $limit: limit },
//     {
//       $project:
//         userInfo.role == "PROVIDER" &&
//         viewAllJobsDetails &&
//         !viewAllJobsDetails.enabled
//           ? providerFreeUser
//           : fields,
//     },
//   );

//   const result: any = await prisma.$runCommandRaw({
//     aggregate: "users",
//     pipeline,
//     cursor: {},
//   });

//   return {
//     meta: { total, page, limit, totalPages },
//     data: result.cursor.firstBatch,
//   };
// };

const jobSearch = async (
  userId: string,
  userInfo: any,
  specialty: any,
  duration: any,
  searchTerm?: string,
  page = 1,
  limit = 10,
  distance?: number,
) => {
  const skip = (page - 1) * limit;

  console.log(userInfo, "check user info");
  const lng = Number(userInfo?.location?.coordinates?.[0]);
  const lat = Number(userInfo?.location?.coordinates?.[1]);

  const basePipeline: any[] = [];
  const userJobPostTrackFeature = userInfo.trackUserFeatureUsages.find(
    (tr: any) => tr.feature == Features_Flag.ADVANCED_SEARCH,
  );

  const isAdvancedEnabled = userJobPostTrackFeature?.enabled;

  // 1. Determine the radius
  let searchRadius: number;

  if (Number.isFinite(distance)) {
    if (!isAdvancedEnabled) {
      throw new ApiError(402, "Advanced search is not available in your plan");
    }
    searchRadius = distance!;
  } else {
    searchRadius = userInfo.providerProfile?.radius ?? 50;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User location is required");
  }

  basePipeline.push({
    $geoNear: {
      near: { type: "Point", coordinates: [lng, lat] },
      distanceField: "distance",
      maxDistance: searchRadius * 1609.34,
      spherical: true,
    },
  });
  basePipeline.push({ $match: { role: "FACILITY" } });
  basePipeline.push(
    {
      $lookup: {
        from: "jobPost",
        localField: "_id",
        foreignField: "userId",
        as: "jobs",
      },
    },
    { $unwind: "$jobs" },
    {
      $match: {
        $expr: { $lt: ["$jobs.totalAccepted", "$jobs.totalCandidate"] },
      },
    },
  );

  if (specialty) {
    if (!isAdvancedEnabled) throw new ApiError(402, "Advanced search required");
    basePipeline.push({ $match: { "jobs.jobRole": specialty } });
  } else if (
    userInfo.role === "PROVIDER" &&
    userInfo.providerProfile?.provider?.length > 0
  ) {
    basePipeline.push({
      $match: { "jobs.jobRole": { $in: userInfo.providerProfile.provider } },
    });
  }

  if (duration) {
    if (!isAdvancedEnabled) throw new ApiError(402, "Advanced search required");
    basePipeline.push({ $match: { "jobs.duration": duration } });
  }

  basePipeline.push(
    {
      $lookup: {
        from: "schedule",
        let: { jobId: { $toString: "$jobs._id" } },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$jobPostId", { $toObjectId: "$$jobId" }] },
            },
          },
        ],
        as: "schedules",
      },
    },
    {
      $addFields: {
        schedules: {
          $filter: {
            input: "$schedules",
            as: "s",
            cond: { $gt: ["$$s.endTime", "$$NOW"] }, //  Use MongoDB's $$NOW
          },
        },
      },
    },
    { $match: { "schedules.0": { $exists: true } } },
  );

  // 5. Search Term
  if (searchTerm) {
    basePipeline.push({
      $match: {
        $or: [
          { "jobs.about": { $regex: searchTerm, $options: "i" } },
          { "jobs.qualification": { $regex: searchTerm, $options: "i" } },
        ],
      },
    });
  }

  // 6. FIXED: APPLIED JOBS FILTER (Move this BEFORE count calculation)
  basePipeline.push(
    {
      $lookup: {
        from: "jobApplications",
        let: { jobId: "$jobs._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$jobPostId", "$$jobId"] },
                  { $eq: ["$providerUserId", { $toObjectId: userId }] },
                ],
              },
            },
          },
        ],
        as: "JobApplication",
      },
    },
    { $match: { JobApplication: { $size: 0 } } },
  );

  // 7. FACILITY & HR (Needed for final project but can be before count)
  basePipeline.push(
    {
      $lookup: {
        from: "facilityProfile",
        localField: "_id",
        foreignField: "userId",
        as: "facilityProfile",
      },
    },
    { $unwind: { path: "$facilityProfile", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "hrDetails",
        localField: "facilityProfile._id",
        foreignField: "facilityProfileId",
        as: "facilityProfile.HrDetails",
      },
    },
  );

  const countPipeline = [...basePipeline, { $count: "total" }];
  const countResult: any = await prisma.$runCommandRaw({
    aggregate: "users",
    pipeline: countPipeline,
    cursor: {},
  });

  const total = countResult.cursor.firstBatch[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // 9. SAVED JOBS & PROJECTION
  const pipeline: any[] = [...basePipeline];

  pipeline.push({
    $lookup: {
      from: "savedJobs",
      let: { jobId: "$jobs._id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$jobPostId", "$$jobId"] },
                { $eq: ["$userId", { $toObjectId: userId }] },
              ],
            },
          },
        },
      ],
      as: "SavedJob",
    },
  });

  const fields = {
    _id: 0,
    id: { $toString: "$jobs._id" },
    userId: { $toString: "$_id" },
    jobRole: "$jobs.jobRole",
    about: "$jobs.about",
    qualification: "$jobs.qualification",
    minPriceRange: "$jobs.minPriceRange",
    maxPriceRange: "$jobs.maxPriceRange",
    experience: "$jobs.experience",
    totalCandidate: "$jobs.totalCandidate",
    totalAccepted: "$jobs.totalAccepted",
    duration: "$jobs.duration",
    createdAt: {
      $dateToString: {
        date: "$jobs.createdAt",
        format: "%Y-%m-%dT%H:%M:%S.%LZ",
      },
    },
    updatedAt: {
      $dateToString: {
        date: "$jobs.updatedAt",
        format: "%Y-%m-%dT%H:%M:%S.%LZ",
      },
    },
    schedule: {
      $map: {
        input: "$schedules",
        as: "s",
        in: {
          id: { $toString: "$$s._id" },
          jobPostId: { $toString: "$$s.jobPostId" },
          date: {
            $dateToString: {
              date: "$$s.date",
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
            },
          },
          startTime: {
            $dateToString: {
              date: "$$s.startTime",
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
            },
          },
          endTime: {
            $dateToString: {
              date: "$$s.endTime",
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
            },
          },
        },
      },
    },
    user: {
      id: { $toString: "$_id" },
      facilityProfile: {
        facilityName: "$facilityProfile.facilityName",
        profileImage: "$facilityProfile.profileImage",
        address: "$facilityProfile.address",
        HrDetails: {
          $map: {
            input: "$facilityProfile.HrDetails",
            as: "hr",
            in: { phoneNumber: "$$hr.phoneNumber", role: "$$hr.role" },
          },
        },
      },
    },
    isApplied: { $literal: false },
    isSaved: { $gt: [{ $size: "$SavedJob" }, 0] },
    distance: 1,
  };

  const providerFreeUser = {
    _id: 0,
    id: { $toString: "$jobs._id" },
    userId: { $toString: "$_id" },
    jobRole: "$jobs.jobRole",
    qualification: "$jobs.qualification",
    minPriceRange: "$jobs.minPriceRange",
    maxPriceRange: "$jobs.maxPriceRange",
    user: {
      id: { $toString: "$_id" },
      facilityProfile: {
        facilityName: "$facilityProfile.facilityName",
        address: "$facilityProfile.address",
      },
    },
    isApplied: { $literal: false },
    isSaved: { $gt: [{ $size: "$SavedJob" }, 0] },
    distance: 1,
  };

  const viewAllJobsDetails = userInfo.trackUserFeatureUsages.find(
    (tr: any) => tr.feature == Features_Flag.VIEW_FULL_JOB_DETAILS,
  );

  pipeline.push(
    { $skip: skip },
    { $limit: limit },
    {
      $project:
        userInfo.role == "PROVIDER" &&
        viewAllJobsDetails &&
        !viewAllJobsDetails.enabled
          ? providerFreeUser
          : fields,
    },
  );

  const result: any = await prisma.$runCommandRaw({
    aggregate: "users",
    pipeline,
    cursor: {},
  });

  return {
    meta: { total, page, limit, totalPages },
    data: result.cursor.firstBatch,
  };
};
const getJobById = async (
  id: string,
  userId: string,
  subscriptionPlan: any,
  role: string,
) => {
  const subscriptionTitle = subscriptionPlan?.[0]?.subscription?.title || "FREE";

const isFreeProvider =
  subscriptionTitle === "FREE" && role === "PROVIDER";

  const job = await prisma.jobPost.findUnique({
    where: { id },
    select: {
      totalClicks: true,
      id: true,
      userId: true,
      jobRole: true,
      about: true,
      qualification: true,
      minPriceRange: true,
      maxPriceRange: true,
      experience: true,
      totalCandidate: true,
      totalAccepted: true,
      duration: true,
      schedule: true,
      user: {
        select: {
          id: true,
          averageRating: true,
          totalReviewCount: true,
          facilityProfile: {
            select: {
              profileImage: true,
              facilityName: true,
              address: true,
              facilityType: true,
              website: true,
              caseType: true,
              HrDetails: {
                select: {
                  phoneNumber: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!job) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job not found");
  }

  // track clicks
  if (!job.totalClicks.includes(userId)) {
    job.totalClicks.push(userId);
    await prisma.jobPost.update({
      where: { id },
      data: { totalClicks: job.totalClicks },
    });
  }

  const jobApplication = await prisma.jobApplication.findFirst({
    where: {
      jobPostId: id,
      providerUserId: userId,
    },
  });

  const totalAppliedCountToThisJob = await prisma.jobApplication.count({
    where: { jobPostId: id },
  });

  const totalUserCountMatchedForThisJob = await prisma.user.count({
    where: {
      role: "PROVIDER",
      status: "ACTIVE",
      providerProfile: {
        provider: { has: job.jobRole },
      },
    },
  });

  if (isFreeProvider) {
    return {
      id: job.id,
      jobRole: job.jobRole,
      qualification: job.qualification,
      totalClicks: job.totalClicks,
      user: {
        id: job.user?.id,
        facilityProfile: {
          facilityName: job.user?.facilityProfile?.facilityName,
          address: job.user?.facilityProfile?.address,
          HrDetails: job.user?.facilityProfile?.HrDetails,
        },
      },
      jobApplication,
      totalAppliedCountToThisJob,
      totalUserCountMatchedForThisJob,
    };
  }

  return {
    ...job,
    jobApplication,
    totalAppliedCountToThisJob,
    totalUserCountMatchedForThisJob,
  };
};

// const totalUserCountMatchedForThisJob = await prisma.providerProfile.count({
//   where: { provider: { has: job.jobRole } },
// });

const getMatchedUsersByJobRole = async (
  jobRole: string,
  page = 1,
  limit = 10,
) => {
  // 🔐 Normalize input
  const normalizedRole = String(jobRole).trim().toUpperCase();

  // ✅ Validate against enum
  const validRoles = Object.values($Enums.Provider);

  if (!validRoles.includes(normalizedRole as $Enums.Provider)) {
    throw new Error(
      `Invalid job role. Allowed values: ${validRoles.join(", ")}`,
    );
  }

  // 🛡 Pagination guard
  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Math.min(100, Number(limit) || 10));

  const where: Prisma.UserWhereInput = {
    role: "PROVIDER",
    status: "ACTIVE",
    providerProfile: {
      provider: {
        has: normalizedRole as $Enums.Provider,
      },
    },
  };

  const [matchedUsers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,

      select: {
        id: true,
        fullName: true,
        profileImage: true,
        providerProfile: {
          select: {
            provider: true,
            stateLicenced: true,
            document: true,
            experience: true,
            address: true,
            phoneNumber: true,
          },
        },
      },
    }),

    prisma.user.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: matchedUsers,
  };
};

const getAllJobPosts = async () => {
  const jobs = await prisma.jobPost.findMany({
    include: {
      schedule: true,
    },
  });
  return jobs;
};

// const getJobByProvidesSelectedTimeAndCertifications = async (
//   userId: string,
//   selectedTime: { start: Date; end: Date },
//   certifications: string[]
// ) => {
//   const user = await prisma.user.findUnique({
//     where: { id: userId },
//     select: {
//       role: true,
//       providerProfile: {
//         select: {
//           provider: true,
//           providerAvailability: true,
//         },
//       },
//     },
//   });

//   if (!user) {
//     throw new Error("User not found");
//   }

//   const { providerProfile } = user;

//   if (!providerProfile) {
//     throw new Error("Provider profile not found");
//   }

//   if (!providerProfile.provider?.length) {
//     throw new Error("Provider role not set");
//   }

//   const availability = providerProfile.providerAvailability;

//   if (!availability?.length) {
//     return [];
//   }

//   const availabilityConditions = availability.map((slot) => ({
//     schedule: {
//       some: {
//         AND: [
//           { date: slot.date },
//           { startTime: { gte: slot.startTime } },
//           { endTime: { lte: slot.endTime } },
//         ],
//       },
//     },
//   }));

//   const jobs = await prisma.jobPost.findMany({
//     where: {
//       jobRole: { in: providerProfile.provider },
//       OR: availabilityConditions,
//       AND: [
//         { startTime: { gte: selectedTime.start } },
//         { endTime: { lte: selectedTime.end } },
//         { certifications: { hasSome: certifications } },
//       ],
//     },
//     include: {
//       schedule: true,
//     },
//   });

//   return jobs;
// };

// apply job, save resume

const applyJob = async (
  providerUserId: string,
  jobPostId: string,
  facilityUserId: string,
) => {
  const existing = await prisma.jobApplication.findUnique({
    where: {
      providerUserId_jobPostId: {
        providerUserId: providerUserId,
        jobPostId: jobPostId,
      },
    },
  });

  if (existing) {
    throw new Error("You have already applied for this job.");
  }

  // Create new application

  const result = await prisma.$transaction(async (tr) => {
    const application = await tr.jobApplication.create({
      data: {
        providerUserId: providerUserId,
        jobPostId: jobPostId,
        facilityUserId: facilityUserId,
        applier: jobApplier.PROVIDER,
      },
    });

    await tr.trackUserFeatureUsage.update({
      where: {
        userId_feature: {
          userId: providerUserId,
          feature: "JOB_APPLY",
        },
      },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    });
    return application;
  });
  notificationServices.sendSingleNotification({
    receiverId: facilityUserId,
    title: "📨 New Job Application Received",
    body: "A provider has applied to your job posting.",
    type: NotificationType.JOBAPPLY,
    additionData: { jobId: jobPostId },
  });

  return result;
};

const getAllAppliedJobsByJobId = async (
  jobId: string,
  page: number,
  limit: number,
) => {
  // Ensure valid values
  const safePage = Math.max(1, page); // at least 1
  const safeLimit = Math.max(1, limit); // at least 1

  const skip = (safePage - 1) * safeLimit;
  const applications = await prisma.jobApplication.findMany({
    where: {
      jobPostId: jobId,
      status: JobStatus.PENDING,
    },
    skip,
    take: safeLimit,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          profileImage: true,
          providerProfile: {
            select: {
              provider: true,
              stateLicenced: true,
              document: true,
              experience: true,
              address: true,
              phoneNumber: true,
              BLS: true,
              ACLS: true,
              PALS: true,
              DIPLOMA: true,
              LICENCE: true,
            },
          },
        },
      },
      // jobPost: {
      //   include: {
      //     schedule: true,
      //     user: {
      //       select: {
      //         facilityProfile: {
      //           select: {
      //             facilityName: true,
      //             address: true,
      //             facilityType: true,
      //           },
      //         },

      //       },
      //     },
      //   },
      // },
    },
  });

  const total = await prisma.jobApplication.count({
    where: { jobPostId: jobId, status: JobStatus.PENDING },
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: applications,
  };
};

const getAllPendingRequestForJobApplicationByFacilityUserId = async (
  facilityUserId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;
  const applications = await prisma.jobApplication.findMany({
    where: {
      facilityUserId: facilityUserId,
      status: JobStatus.PENDING,
      applier: jobApplier.PROVIDER,
    },
    skip,
    take: limit,
    include: {
      user: {
        include: {
          providerProfile: true,
        },
      },
    },
  });

  const total = await prisma.jobApplication.count({
    where: {
      facilityUserId,
      status: JobStatus.PENDING,
      applier: jobApplier.PROVIDER,
    },
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: applications,
  };
};

const acceptOrDeclineApplication = async (
  applicationId: string,
  action: JobStatus,
) => {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const updatedApplication = await prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      status: action,

      ...(action === "APPROVED" && {
        jobPost: {
          update: {
            totalAccepted: {
              increment: 1,
            },
          },
        },
      }),
    },
  });
  notificationServices.sendSingleNotification({
    receiverId:
      application.applier === "FACILITY"
        ? application.facilityUserId
        : application.providerUserId,
    title: `${
      action == "APPROVED" ? " Application Accepted" : " Application Rejected"
    }`,
    body: `${
      action == "APPROVED"
        ? `Congratulations! Your job application has been accepted by the ${application.applier == "FACILITY" ? "provider" : "facility"} `
        : `Unfortunately, your job application was not accepted by the ${application.applier == "FACILITY" ? "provider" : "facility"} `
    }`,
    type: NotificationType.ACCEPTORDECLINE,

    additionData: { jobId: application.jobPostId },
  });
  return updatedApplication;
};

const getAllAcceptedAppliedJobs = async (
  facilityUserId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const applications = await prisma.jobApplication.findMany({
    where: {
      facilityUserId,
      status: JobStatus.APPROVED,
    },
    skip,
    take: limit,
    include: {
      jobPost: {
        include: {
          schedule: true,
          user: {
            select: {
              facilityProfile: {
                select: {
                  facilityName: true,
                  address: true,
                  facilityType: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const total = await prisma.jobApplication.count({
    where: { facilityUserId, status: JobStatus.APPROVED },
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: applications,
  };
};

const getJobsByDateWithApplicationCount = async (
  date: Date,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  // Fetch jobs with schedule on this date
  const jobs = await prisma.jobPost.findMany({
    where: {
      schedule: {
        some: { date },
      },
    },
    include: {
      JobApplication: true, // include applications to count
    },
    skip,
    take: limit,
  });

  // Map jobs to include applied count
  const jobsWithAppliedCount = jobs.map((job) => ({
    ...job,
    appliedCount: job.JobApplication.length,
  }));

  // Total number of jobs for this date
  const total = await prisma.jobPost.count({
    where: { schedule: { some: { date } } },
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: jobsWithAppliedCount,
  };
};

const getAllApprovedJobsByDate = async (
  facilityUserId: string,
  date: Date,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  // Fetch JobPosts that have schedules on the given date
  const jobs = await prisma.jobPost.findMany({
    where: {
      schedule: { some: { date } },
      JobApplication: {
        some: {
          facilityUserId: facilityUserId,
          status: JobStatus.APPROVED,
          statusAfterApproval: {
            not: JobStatusAfterApprovedByFacility.CANCELLED,
          },
        },
      },
    },
    include: {
      JobApplication: {
        where: {
          status: JobStatus.APPROVED,
          facilityUserId: facilityUserId,
        },
        select: {
          id: true,
          status: true,
          statusAfterApproval: true,
          jobPost: {
            select: {
              schedule: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
              providerProfile: {
                select: {
                  provider: true,
                  stateLicenced: true,
                  // document: true,
                },
              },
            },
          },
        },
      },
      schedule: { where: { date } },
    },
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  // Total number of jobs for pagination
  const total = await prisma.jobPost.count({
    where: {
      schedule: { some: { date } },
      JobApplication: {
        some: {
          facilityUserId: facilityUserId,
          status: JobStatus.APPROVED,
          statusAfterApproval: {
            not: JobStatusAfterApprovedByFacility.CANCELLED,
          },
        },
      },
    },
  });

  const now = new Date();

  // Post-process to update statusAfterApproval dynamically
  const processedJobs = jobs.map((job) => {
    return {
      ...job,
      JobApplication: job.JobApplication.map((app) => {
        // Find matching schedule for this jobPost
        const schedules = app.jobPost.schedule;
        let dynamicStatus = app.statusAfterApproval;

        // schedules.forEach((sch) => {
        //   const start = new Date(sch.startTime);
        //   const end = new Date(sch.endTime);
        //   const date = new Date(sch.date);

        //   if (now >= start && now <= end && moment(date).isSame(now, "day")) {
        //     dynamicStatus = "INPROGRESS"; // override status
        //   } else if (
        //     moment(date).isBefore(now, "day") &&
        //     dynamicStatus !== JobStatusAfterApprovedByFacility.COMPLETED &&
        //     dynamicStatus !== JobStatusAfterApprovedByFacility.CANCELLED &&
        //     dynamicStatus !== JobStatusAfterApprovedByFacility.REQUESTED
        //   ) {
        //     dynamicStatus = "PAST"; // override status
        //   }
        // });

        schedules.forEach((sch) => {
          const start = new Date(sch.startTime);
          const end = new Date(sch.endTime);
          const date = new Date(sch.date);

          if (now >= start && now <= end && moment(date).isSame(now, "day")) {
            dynamicStatus = "INPROGRESS";
          } else if (
            now > end &&
            moment(date).isSame(now, "day") &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.COMPLETED &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.CANCELLED &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.REQUESTED &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.NO_SHOW
          ) {
            dynamicStatus = "PAST"; // ended today
          } else if (
            moment(date).isBefore(now, "day") &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.COMPLETED &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.CANCELLED &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.REQUESTED &&
            dynamicStatus !== JobStatusAfterApprovedByFacility.NO_SHOW
          ) {
            dynamicStatus = "PAST"; // ended before today
          }
        });

        return {
          ...app,
          statusAfterApproval: dynamicStatus,
        };
      }),
    };
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: processedJobs,
  };
};

const completeJobApplication = async (
  applicationId: string,
  completionStatus: string,
) => {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new ApiError(httpStatus.NOT_FOUND, "Application not found");
  }

  // Update the application status
  const updatedApplication = await prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      statusAfterApproval:
        completionStatus == "approve"
          ? JobStatusAfterApprovedByFacility.COMPLETED
          : completionStatus == "reject"
            ? JobStatusAfterApprovedByFacility.NO_SHOW
            : application.statusAfterApproval,
    },
  });

  return updatedApplication;
};
const getAllCancelRequestAndCancelledApplications = async (
  facilityUserId: string,
  date: Date,
  status: "CANCELLED" | "REQUESTED" | "ALL" = "ALL",
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  // Build dynamic filter for status
  let statusFilter: any = undefined;

  if (status === "CANCELLED") {
    statusFilter = JobStatusAfterApprovedByFacility.CANCELLED;
  } else if (status === "REQUESTED") {
    statusFilter = JobStatusAfterApprovedByFacility.REQUESTED;
  } else if (status === "ALL") {
    statusFilter = {
      in: [
        JobStatusAfterApprovedByFacility.CANCELLED,
        JobStatusAfterApprovedByFacility.REQUESTED,
      ],
    };
  }

  const whereCondition: any = {
    jobPost: {
      schedule: { some: { date } },
    },
    facilityUserId,
  };

  if (statusFilter) {
    whereCondition.statusAfterApproval = statusFilter;
  }

  const applications = await prisma.jobApplication.findMany({
    where: whereCondition,
    include: {
      jobPost: {
        select: {
          id: true,
          schedule: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          profileImage: true,
          providerProfile: {
            select: {
              provider: true,
              stateLicenced: true,
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });

  return {
    meta: {
      total: applications.length,
      page,
      limit,
      totalPages: Math.ceil(applications.length / limit),
    },
    data: applications,
  };
};

const approveOrRejectCancellationRequest = async (
  applicationId: string,
  status: "approve" | "rejected",
) => {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new ApiError(httpStatus.NOT_FOUND, "Application not found");
  }

  // Update the application status
  const updatedApplication = await prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      statusAfterApproval:
        status === "approve"
          ? JobStatusAfterApprovedByFacility.CANCELLED
          : JobStatusAfterApprovedByFacility.PENDING,
    },
  });
  notificationServices.sendSingleNotification({
    receiverId: application.providerUserId,
    title: `Job Cancellation Request ${
      status === "approve" ? "Approved" : "Rejected"
    }`,
    body:
      status === "approve"
        ? "The facility has approved your job cancellation request."
        : "The facility has rejected your job cancellation request.",
    type: NotificationType.PROVIDERJOBREQEST,
    additionData: { jobId: application.jobPostId },
  });
  return updatedApplication;
};

const hireProviderFromFacility = async (
  providerUserId: string,
  jobPostId: string,
  facilityUserId: string,
) => {
  // Check if the job post exists
  const jobPost = await prisma.jobPost.findUnique({
    where: { id: jobPostId },
  });

  if (!jobPost) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job post not found");
  }

  // Check if the provider has already been hired for this job
  const existingApplication = await prisma.jobApplication.findUnique({
    where: {
      providerUserId_jobPostId: {
        providerUserId,
        jobPostId,
      },
    },
  });

  if (existingApplication) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You have already sent a hire request to this provider for this job.",
      "You have already sent a hire request to this provider for this job.",
    );
  }

  // Create a new job application with status APPROVED
  const application = await prisma.jobApplication.create({
    data: {
      providerUserId,
      jobPostId,
      facilityUserId,
      applier: jobApplier.FACILITY,
    },
  });
  notificationServices.sendSingleNotification({
    receiverId: providerUserId,
    title: "📢 Job Invitation Received",
    body: "A facility has invited you to work on their job posting.",
    type: NotificationType.HIREREQUEST,
    additionData: { jobId: jobPostId, applicationId: application?.id },
  });
  return application;
};

const allAppliedJobsForProvider = async (
  providerUserId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const jobs = await prisma.jobApplication.findMany({
    where: {
      providerUserId,
      applier: jobApplier.PROVIDER,
    },
    select: {
      id: true,
      appliedAt: true,
      statusAfterApproval: true,
      jobPost: {
        select: {
          id: true,
          qualification: true,
          about: true,
          schedule: true,
          jobRole: true,
          maxPriceRange: true,
          minPriceRange: true,
          user: {
            select: {
              facilityProfile: {
                select: {
                  id: true,
                  facilityName: true,
                  address: true,
                },
              },
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });

  const totalJobs = await prisma.jobApplication.count({
    where: {
      providerUserId,
      applier: jobApplier.PROVIDER,
    },
  });

  return {
    meta: {
      total: totalJobs,
      page,
      limit,
      totalPages: Math.ceil(totalJobs / limit),
    },
    data: jobs,
  };
};

const allRequestedJobsForProvider = async (
  providerUserId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const jobs = await prisma.jobApplication.findMany({
    where: {
      providerUserId,
      applier: jobApplier.PROVIDER,
      statusAfterApproval: JobStatusAfterApprovedByFacility.REQUESTED,
    },
    select: {
      appliedAt: true,
      statusAfterApproval: true,
      jobPost: {
        select: {
          id: true,
          qualification: true,
          about: true,
          schedule: true,
          jobRole: true,
          maxPriceRange: true,
          minPriceRange: true,
          user: {
            select: {
              id: true,
              facilityProfile: {
                select: {
                  id: true,
                  facilityName: true,
                  address: true,
                },
              },
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });

  const totalJobs = await prisma.jobApplication.count({
    where: {
      providerUserId,
      applier: jobApplier.PROVIDER,
      statusAfterApproval: JobStatusAfterApprovedByFacility.REQUESTED,
    },
  });

  return {
    meta: {
      total: totalJobs,
      page,
      limit,
      totalPages: Math.ceil(totalJobs / limit),
    },
    data: jobs,
  };
};

const allCancelledJobsForProvider = async (
  providerUserId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const jobs = await prisma.jobApplication.findMany({
    where: {
      providerUserId,
      applier: jobApplier.PROVIDER,
      statusAfterApproval: JobStatusAfterApprovedByFacility.CANCELLED,
    },
    select: {
      appliedAt: true,
      statusAfterApproval: true,
      jobPost: {
        select: {
          id: true,
          qualification: true,
          about: true,
          schedule: true,
          jobRole: true,
          maxPriceRange: true,
          minPriceRange: true,
          user: {
            select: {
              facilityProfile: {
                select: {
                  id: true,
                  facilityName: true,
                  address: true,
                },
              },
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });

  const totalJobs = await prisma.jobApplication.count({
    where: {
      providerUserId,
      applier: jobApplier.PROVIDER,
      statusAfterApproval: JobStatusAfterApprovedByFacility.CANCELLED,
    },
  });

  return {
    meta: {
      total: totalJobs,
      page,
      limit,
      totalPages: Math.ceil(totalJobs / limit),
    },
    data: jobs,
  };
};

const allCompletedJobsForProvider = async (
  providerUserId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const jobs = await prisma.jobApplication.findMany({
    where: {
      providerUserId,
      statusAfterApproval: JobStatusAfterApprovedByFacility.COMPLETED,
    },
    select: {
      appliedAt: true,
      statusAfterApproval: true,
      jobPost: {
        select: {
          id: true,
          qualification: true,
          about: true,
          schedule: true,
          jobRole: true,
          maxPriceRange: true,
          minPriceRange: true,
          user: {
            select: {
              id: true,
              facilityProfile: {
                select: {
                  id: true,
                  facilityName: true,
                  address: true,
                },
              },
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });

  const totalJobs = await prisma.jobApplication.count({
    where: {
      providerUserId,
      statusAfterApproval: JobStatusAfterApprovedByFacility.COMPLETED,
    },
  });

  return {
    meta: {
      total: totalJobs,
      page,
      limit,
      totalPages: Math.ceil(totalJobs / limit),
    },
    data: jobs,
  };
};

const cancelRequestFromProvider = async (
  providerUserId: string,
  jobPostId: string,
  cancellationReason: string,
) => {
  const application = await prisma.jobApplication.findUnique({
    where: {
      providerUserId_jobPostId: {
        providerUserId,
        jobPostId,
      },
    },
  });

  if (!application) {
    throw new ApiError(httpStatus.NOT_FOUND, "Application not found");
  }
  const updatedApplication = await prisma.jobApplication.update({
    where: { id: application.id },
    data: {
      statusAfterApproval: JobStatusAfterApprovedByFacility.REQUESTED,
      cancellationReason,
    },
  });
  notificationServices.sendSingleNotification({
    receiverId: application.facilityUserId,
    title: "📢 Cancel Request  Received",
    body: "A Provider  has send you a cancel request",
    type: NotificationType.CANCELREQUEST,
    additionData: { jobId: jobPostId, userId: providerUserId },
  });
  return updatedApplication;
};

const getAllJobsUsingFacilityUserId = async (
  userId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;

  const jobs = await prisma.jobPost.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      qualification: true,
      about: true,
      schedule: true,
      jobRole: true,
      maxPriceRange: true,
      minPriceRange: true,
      experience: true,

      user: {
        select: {
          facilityProfile: {
            select: {
              id: true,
              facilityName: true,
              address: true,
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });

  const totalJobs = await prisma.jobPost.count({
    where: {
      userId,
    },
  });

  return {
    meta: {
      total: totalJobs,
      page,
      limit,
      totalPages: Math.ceil(totalJobs / limit),
    },
    data: jobs,
  };
};

const newSearchJob = async (
  userId: string,
  searchTerm: string,
  page: number,
  limit: number,
  distance: number | null = null,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      providerProfile: {
        select: {
          provider: true,
          providerAvailability: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { providerProfile } = user;

  let whereClause: any = {};

  const cleanedSearchTerm = searchTerm?.trim().replace(/^"|"$/g, "");

  if (cleanedSearchTerm && cleanedSearchTerm.length > 0) {
    whereClause = {
      OR: [
        { about: { contains: cleanedSearchTerm, mode: "insensitive" } },
        { qualification: { contains: cleanedSearchTerm, mode: "insensitive" } },
        {
          user: {
            facilityProfile: {
              facilityName: {
                contains: cleanedSearchTerm,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    };
  } else {
    if (!providerProfile) {
      throw new Error("Provider profile not found");
    }

    if (!providerProfile.provider?.length) {
      throw new Error("Provider role not set");
    }

    const availability = providerProfile.providerAvailability;

    if (!availability?.length) {
      return {
        meta: {
          total: 0,
          page: Math.max(page, 1),
          limit: Math.max(limit, 1),
          totalPages: 0,
        },
        data: [],
      };
    }

    whereClause = {
      jobRole: { in: providerProfile.provider },
    };
  }

  console.log("Base whereClause:", JSON.stringify(whereClause, null, 2));
  // console.log("Provider's roles:", providerProfile.provider);

  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(limit, 1);
  const skip = (safePage - 1) * safeLimit;

  // If distance is not provided, just do the regular search like oldSearchJob
  if (!distance || distance <= 0) {
    console.log("Running regular search (no distance filter)...");

    const [jobs, total] = await Promise.all([
      prisma.jobPost.findMany({
        where: whereClause,
        include: {
          schedule: true,
          user: {
            select: {
              id: true,
              facilityProfile: {
                select: {
                  facilityName: true,
                  address: true,
                  profileImage: true,
                  HrDetails: {
                    select: {
                      phoneNumber: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
          JobApplication: {
            where: {
              providerUserId: userId,
            },
            select: {
              id: true,
            },
          },
        },
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobPost.count({ where: whereClause }),
    ]);

    console.log(`Found ${jobs.length} jobs in regular search`);

    const jobsWithAppliedStatus = jobs.map((job) => ({
      ...job,
      isApplied: job.JobApplication.length > 0,
      distance: null,
    }));

    return {
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
      data: jobsWithAppliedStatus,
    };
  }

  // If distance IS provided, then do the distance-based search
  try {
    // Get user location for distance calculation
    const userWithLocation = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        location: true,
      },
    });

    if (!userWithLocation?.location) {
      console.log("Provider doesn't have location set");
      // If provider doesn't have location, return empty results for distance search
      return {
        meta: {
          total: 0,
          page: safePage,
          limit: safeLimit,
          totalPages: 0,
        },
        data: [],
      };
    }

    const userLocation = userWithLocation.location as {
      type: string;
      coordinates: [number, number];
    };

    console.log("Running distance-based search with distance:", distance, "km");
    console.log("Provider location:", userLocation);

    // First, find ALL facilities with location and facilityProfile
    const allFacilitiesWithLocation = await prisma.user.findMany({
      where: {
        location: { not: null },
        facilityProfile: { isNot: null },
      },
      select: {
        id: true,
        location: true,
      },
    });

    console.log(
      `Total facilities with location: ${allFacilitiesWithLocation.length}`,
    );

    // Manually calculate distance for each facility
    const facilitiesWithinDistance = allFacilitiesWithLocation
      .map((facility) => {
        const facilityLocation = facility.location as any;
        if (!facilityLocation?.coordinates) return null;

        const distanceKm = calculateDistance(
          userLocation.coordinates[1], // provider lat
          userLocation.coordinates[0], // provider lon
          facilityLocation.coordinates[1], // facility lat
          facilityLocation.coordinates[0], // facility lon
        );

        return {
          id: facility.id,
          distance: distanceKm,
        };
      })
      .filter((facility) => facility !== null && facility.distance <= distance);

    console.log(
      `Facilities within ${distance}km: ${facilitiesWithinDistance.length}`,
    );

    if (facilitiesWithinDistance.length === 0) {
      console.log("No facilities found within the specified distance");
      return {
        meta: {
          total: 0,
          page: safePage,
          limit: safeLimit,
          totalPages: 0,
        },
        data: [],
      };
    }

    const facilityIds = facilitiesWithinDistance.map((f: any) => f.id);
    const distanceMap = new Map(
      facilitiesWithinDistance.map((f: any) => [f.id, f.distance]),
    );

    console.log("Facility IDs within distance:", facilityIds);

    // Combine the where clause with facility filter
    const finalWhereClause = {
      ...whereClause,
      userId: { in: facilityIds },
    };

    console.log(
      "Final whereClause with distance filter:",
      JSON.stringify(finalWhereClause, null, 2),
    );

    const [jobs, total] = await Promise.all([
      prisma.jobPost.findMany({
        where: finalWhereClause,
        include: {
          schedule: true,
          user: {
            select: {
              id: true,
              location: true,
              facilityProfile: {
                select: {
                  facilityName: true,
                  address: true,
                  profileImage: true,
                  HrDetails: {
                    select: {
                      phoneNumber: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
          JobApplication: {
            where: {
              providerUserId: userId,
            },
            select: {
              id: true,
            },
          },
        },
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobPost.count({ where: finalWhereClause }),
    ]);

    console.log(`Found ${jobs.length} jobs from facilities within distance`);

    // Calculate distance for each job
    const jobsWithDistance = jobs.map((job) => {
      const distance = distanceMap.get(job.userId) || null;

      return {
        ...job,
        distance,
        isApplied: job.JobApplication.length > 0,
      };
    });

    // Sort by distance (nearest first)
    jobsWithDistance.sort((a, b) => {
      const distA = a.distance || Infinity;
      const distB = b.distance || Infinity;
      return distA - distB;
    });

    return {
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
      data: jobsWithDistance,
    };
  } catch (error) {
    console.error("Error in distance-based search:", error);

    // Fallback to regular search if distance search fails
    const [jobs, total] = await Promise.all([
      prisma.jobPost.findMany({
        where: whereClause,
        include: {
          schedule: true,
          user: {
            select: {
              id: true,
              facilityProfile: {
                select: {
                  facilityName: true,
                  address: true,
                  profileImage: true,
                  HrDetails: {
                    select: {
                      phoneNumber: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
          JobApplication: {
            where: {
              providerUserId: userId,
            },
            select: {
              id: true,
            },
          },
        },
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.jobPost.count({ where: whereClause }),
    ]);

    const jobsWithAppliedStatus = jobs.map((job) => ({
      ...job,
      isApplied: job.JobApplication.length > 0,
      distance: null,
    }));

    return {
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
      data: jobsWithAppliedStatus,
    };
  }
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  // Round to 2 decimal places
  return Math.round(distance * 100) / 100;
}

const saveJob = async (userId: string, jobPostId: string) => {
  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobPostId: { userId: userId, jobPostId } },
  });
  if (existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Job already saved");
  }
  await prisma.savedJob.create({ data: { userId: userId, jobPostId } });
  return { message: "Job saved successfully", success: true };
};

const getSavedJobs = async (userId: string, page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const savedJobs = await prisma.savedJob.findMany({
    where: { userId: userId },
    include: {
      jobPost: {
        include: {
          schedule: true,
          user: {
            select: {
              id: true,
              facilityProfile: {
                select: {
                  id: true,
                  facilityName: true,
                  address: true,
                  profileImage: true,
                },
              },
            },
          },
          JobApplication: {
            where: {
              providerUserId: userId,
            },
            select: {
              id: true,
              statusAfterApproval: true,
              appliedAt: true,
            },
          },
        },
      },
    },
    skip,
    take: limit,
  });

  const total = await prisma.savedJob.count({ where: { userId: userId } });
  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: savedJobs,
  };
};

const removeSavedJob = async (userId: string, jobPostId: string) => {
  await prisma.savedJob.delete({
    where: { userId_jobPostId: { userId: userId, jobPostId } },
  });
  return { message: "Job removed from saved jobs", success: true };
};

export const jobService = {
  createJob,
  getAllJobPosts,
  getJobsForFacilityByUserId,
  newSearchJob,
  getJobById,
  applyJob,
  getAllAppliedJobsByJobId,
  getAllPendingRequestForJobApplicationByFacilityUserId,
  acceptOrDeclineApplication,
  getAllAcceptedAppliedJobs,
  getJobsByDateWithApplicationCount,
  getAllApprovedJobsByDate,
  completeJobApplication,
  getAllCancelRequestAndCancelledApplications,
  approveOrRejectCancellationRequest,
  hireProviderFromFacility,
  allAppliedJobsForProvider,
  allCompletedJobsForProvider,
  cancelRequestFromProvider,
  getAllJobsUsingFacilityUserId,
  allRequestedJobsForProvider,
  allCancelledJobsForProvider,
  jobSearch,
  oldSearchJob,
  getMatchedUsersByJobRole,
  saveJob,
  getSavedJobs,
  removeSavedJob,
};
