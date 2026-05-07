import { Prisma, Provider, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { jwtHelpers } from "../../../helpers/jwtHelpers";
import { searchAndPaginate } from "../../../helpers/searchAndPaginate";
import prisma from "../../../shared/prisma";
  
const loginAdmin = async (payload: any) => {
  console.log("click") 
  const user = await prisma.admin.findUnique({
    where: {
      email: payload.email.toLowerCase(),
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await bcrypt.compare(
    payload.password.trim() as string,
    user?.password?.trim() as string
  );

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  const { password, createdAt, updatedAt, ...userInfo } = user;
  const accessToken = jwtHelpers.generateToken(
    { role: "ADMIN", ...userInfo },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in
  );
  return {
    accessToken,
  };
};

const getAllProviders = async (
  searchTerm: string,
  page: number,
  limit: number
) => {
  let whereClause = {};
  if (searchTerm && searchTerm.trim() !== "") {
    const cleanTerm = searchTerm.replace(/^"|"$/g, ""); // removes wrapping quotes
    whereClause = {
      OR: [
        { user: { email: { contains: cleanTerm, mode: "insensitive" } } },
        { user: { fullName: { contains: cleanTerm, mode: "insensitive" } } },
      ],
    };
  }

  const providers = await prisma.providerProfile.findMany({
    where: whereClause,
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      provider: true,
      stateLicenced: true,
      address: true,
      experience: true,
      user: true,
    },
  });

  const total = await prisma.providerProfile.count({
    where: whereClause, // ✅ make sure count matches filtering
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: providers,
  };
};

const getAllFacility = async (
  searchTerm: string,
  page: number,
  limit: number
) => {
  let whereClause = {};
  if (searchTerm && searchTerm.trim() !== "") {
    const cleanTerm = searchTerm.replace(/^"|"$/g, ""); // removes wrapping quotes
    whereClause = {
      OR: [
        { user: { email: { contains: cleanTerm, mode: "insensitive" } } },
        { user: { fullName: { contains: cleanTerm, mode: "insensitive" } } },
        { facilityName: { contains: cleanTerm, mode: "insensitive" } },
      ],
    };
  }

  const facilities = await prisma.facilityProfile.findMany({
    where: whereClause,
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      facilityName: true,
      address: true,
      user: true,
    },
  });

  const total = await prisma.facilityProfile.count({
    where: whereClause, // ✅ make sure count matches filtering
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: facilities,
  };
};

const userStatusUpdate = async (id: string) => {
  const user = await prisma.user.update({
    where: { id },
    data: {
      status: UserStatus.ACTIVE,
    },
  });
  return user;
};

const deleteUser = async (id: string) => {
  const user = await prisma.user.delete({
    where: { id },
  });
  return user;
};

const getAllJobsForAdmin = async (
  searchTerm: string,
  page: number,
  limit: number
) => {
  let whereClause = {};
  if (searchTerm && searchTerm.trim() !== "") {
    const cleanTerm = searchTerm.replace(/^"|"$/g, ""); // removes wrapping quotes
    const term = cleanTerm.toUpperCase();
    const enumMatch = Object.values(Provider).includes(term as Provider)
      ? { jobRole: { equals: term as Provider } }
      : {};

    whereClause = {
      OR: [
        enumMatch,
        { about: { contains: cleanTerm, mode: "insensitive" } },
        { qualification: { contains: cleanTerm, mode: "insensitive" } },
        { user: { email: { contains: cleanTerm, mode: "insensitive" } } },
        { user: { fullName: { contains: cleanTerm, mode: "insensitive" } } },
        {
          user: {
            facilityProfile: {
              facilityName: { contains: cleanTerm, mode: "insensitive" },
            },
          },
        },
      ],
    };
  }

  const jobs = await prisma.jobPost.findMany({
    where: whereClause,
    skip: (page - 1) * limit,
    take: limit,
    include: {
      schedule: true,
      user: {
        include: {
          facilityProfile: {
            select: {
              facilityName: true,
              address: true,
            },
          },
        },
      },
    },
  });

  const total = await prisma.jobPost.count({
    where: whereClause, // ✅ make sure count matches filtering
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: jobs,
  };
};

const deleteJobByAdmin = async (id: string) => {
  const isJobExist = await prisma.jobPost.findUnique({
    where: { id },
  });

  if (!isJobExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job not found");
  }

  const job = await prisma.jobPost.delete({
    where: { id },
  });
  return job;
};

const editJobByAdmin = async (id: string, data: any) => {
  const isJobExist = await prisma.jobPost.findUnique({
    where: { id },
  });

  if (!isJobExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job not found");
  }

  const job = await prisma.jobPost.update({
    where: { id },
    data,
  });
  return job;
};

const getAllRatingsForAdmin = async (
  searchTerm: string,
  page: number,
  limit: number
) => {
  let whereClause = {};
  if (searchTerm && searchTerm.trim() !== "") {
    const cleanTerm = searchTerm.replace(/^"|"$/g, ""); // removes wrapping quotes
    whereClause = {
      OR: [
        { user: { email: { contains: cleanTerm, mode: "insensitive" } } },
        { user: { fullName: { contains: cleanTerm, mode: "insensitive" } } },
        { job: { title: { contains: cleanTerm, mode: "insensitive" } } },
      ],
    };
  }

  const reviews = await prisma.review.findMany({
    where: whereClause,
    skip: (page - 1) * limit,
    take: limit,
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
        },
      },
      receiver: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
        },
      },
    },
  });

  const total = await prisma.review.count({
    where: whereClause,
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: reviews,
  };
};

const deleteRating = async (id: string) => {
  const isRatingExist = await prisma.review.findUnique({
    where: { id },
  });

  if (!isRatingExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Rating not found");
  }

  const rating = await prisma.review.delete({
    where: { id },
  });
  return rating;
};

const updateAdmin = async (id: string, data: any) => {
  const isAdminExist = await prisma.admin.findUnique({
    where: { id },
  });

  if (!isAdminExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "Admin not found");
  }

  const admin = await prisma.admin.update({
    where: { id },
    data: {
      country: data.country,
      city: data.city,
      state: data.province,
      bio: data.bio,
      nickName: data.displayName,
    },
  });
  return admin;
};

const getDashboardHeaderNumbers = async () => {
  const totalProviders = await prisma.providerProfile.count();
  const totalFacilities = await prisma.facilityProfile.count();
  const totalJobs = await prisma.jobPost.count();
  const totalAcceptedJobs = await prisma.jobApplication.count();

  return {
    totalProviders,
    totalFacilities,
    totalJobs,
    totalAcceptedJobs,
  };
};

const getUserSubscrption = async (
  page: number,
  limit: number,
  searchQuery: string
) => {
  const additionalFilter: Prisma.UserWhereInput = {
    NOT: {
      role: "ADMIN",
    },
  };
  const user = await searchAndPaginate<
    typeof prisma.user,
    Prisma.UserWhereInput,
    Prisma.UserSelect
  >(
    prisma.user,
    ["fullName", "email"],
    page || 1,
    limit || 10,
    searchQuery,
    additionalFilter,
    {
      select: {
        fullName: true,

        profileImage: true,

        UserSubscription: {
          select: {
            status: true,
            createdAt: true,
          
            subscription: {
              select: {
                interval: true,
                title: true,
              },
            },
          },
        },
      },
    }
  );

  return user;
};

const adminDashboardData = async (filter: string) => {
  const now = new Date();
  const year = now.getUTCFullYear();

  // --- Subscription Earnings ---
  const subscriptionAgg: any = await prisma.$runCommandRaw({
    aggregate: "userSubscription",
    pipeline: [
      {
        $lookup: {
          from: "subscription",
          localField: "subscriptionId",
          foreignField: "_id",
          as: "subscription",
        },
      },
      { $unwind: "$subscription" },
      { $group: { _id: null, total: { $sum: "$subscription.price" } } },
    ],
    cursor: {},
  });
  const subscriptionEarning =
    subscriptionAgg?.cursor?.firstBatch?.[0]?.total ?? 0;

  // --- Promotion Earnings (only ACTIVE) ---
  const promotionAgg: any = await prisma.$runCommandRaw({
    aggregate: "promotion",
    pipeline: [
      { $match: { promotionStatus: "ACTIVE" } },
      { $group: { _id: null, total: { $sum: "$value" } } },
    ],
    cursor: {},
  });
  const promotionEarning = promotionAgg?.cursor?.firstBatch?.[0]?.total ?? 0;

  const totalEarnings = subscriptionEarning + promotionEarning;

  const totalSubscription = await prisma.userSubscription.count();

  const subscriptionBreakdownAgg: any = await prisma.$runCommandRaw({
    aggregate: "userSubscription",
    pipeline: [
      {
        $lookup: {
          from: "subscription",
          localField: "subscriptionId",
          foreignField: "_id",
          as: "subscription",
        },
      },
      { $unwind: "$subscription" },
      { $group: { _id: "$subscription.title", count: { $sum: 1 } } },
    ],
    cursor: {},
  });

  const subscriptions = subscriptionBreakdownAgg.cursor?.firstBatch ?? [];
  const totalSubsCount = subscriptions.reduce(
    (acc: any, s: any) => acc + s.count,
    0
  );
  const subscriptionPercentages = subscriptions.map((s: any) => ({
    title: s._id,
    count: s.count,
    percentage: totalSubsCount ? (s.count / totalSubsCount) * 100 : 0,
    color: getRandomColor(),
  }));

  let earningsByFilter: any[] = [];

  const addEarnings = (map: Map<any, number>, key: any, value: number) => {
    map.set(key, (map.get(key) ?? 0) + value);
  };

  if (filter === "monthly") {
    const subscriptionMonthly: any = await prisma.$runCommandRaw({
      aggregate: "userSubscription",
      pipeline: [
        {
          $lookup: {
            from: "subscription",
            localField: "subscriptionId",
            foreignField: "_id",
            as: "subscription",
          },
        },
        { $unwind: "$subscription" },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            total: { $sum: "$subscription.price" },
          },
        },
      ],
      cursor: {},
    });

    const promotionMonthly: any = await prisma.$runCommandRaw({
      aggregate: "promotion",
      pipeline: [
        { $match: { promotionStatus: "ACTIVE" } },
        {
          $group: {
            _id: {
              year: { $year: "$startTime" },
              month: { $month: "$startTime" },
            },
            total: { $sum: "$value" },
          },
        },
      ],
      cursor: {},
    });

    const monthMap = new Map<number, number>();
    for (let i = 1; i <= 12; i++) monthMap.set(i, 0);

    subscriptionMonthly.cursor.firstBatch.forEach((r: any) =>
      addEarnings(monthMap, r._id.month, r.total)
    );
    promotionMonthly.cursor.firstBatch.forEach((r: any) =>
      addEarnings(monthMap, r._id.month, r.total)
    );

    earningsByFilter = Array.from({ length: 12 }, (_, i) => ({
      _id: { year, month: i + 1 },
      total: monthMap.get(i + 1) ?? 0,
    }));
  } else if (filter === "yearly") {
    const subscriptionYearly: any = await prisma.$runCommandRaw({
      aggregate: "userSubscription",
      pipeline: [
        {
          $lookup: {
            from: "subscription",
            localField: "subscriptionId",
            foreignField: "_id",
            as: "subscription",
          },
        },
        { $unwind: "$subscription" },
        {
          $group: {
            _id: { year: { $year: "$createdAt" } },
            total: { $sum: "$subscription.price" },
          },
        },
      ],
      cursor: {},
    });

    const promotionYearly: any = await prisma.$runCommandRaw({
      aggregate: "promotion",
      pipeline: [
        { $match: { promotionStatus: "ACTIVE" } },
        {
          $group: {
            _id: { year: { $year: "$startTime" } },
            total: { $sum: "$value" },
          },
        },
      ],
      cursor: {},
    });

    const yearMap = new Map<number, number>();
    subscriptionYearly.cursor.firstBatch.forEach((r: any) =>
      addEarnings(yearMap, r._id.year, r.total)
    );
    promotionYearly.cursor.firstBatch.forEach((r: any) =>
      addEarnings(yearMap, r._id.year, r.total)
    );

    earningsByFilter = Array.from(yearMap.entries()).map(([yr, total]) => ({
      _id: { year: yr },
      total,
    }));
  } else if (filter === "weekly") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);

    const subscriptionWeekly: any = await prisma.$runCommandRaw({
      aggregate: "userSubscription",
      pipeline: [
        { $match: { createdAt: { $gte: sevenDaysAgo, $lte: now } } },
        {
          $lookup: {
            from: "subscription",
            localField: "subscriptionId",
            foreignField: "_id",
            as: "subscription",
          },
        },
        { $unwind: "$subscription" },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            total: { $sum: "$subscription.price" },
          },
        },
      ],
      cursor: {},
    });

    const promotionWeekly: any = await prisma.$runCommandRaw({
      aggregate: "promotion",
      pipeline: [
        {
          $match: {
            promotionStatus: "ACTIVE",
            startTime: { $gte: sevenDaysAgo, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$startTime" },
              month: { $month: "$startTime" },
              day: { $dayOfMonth: "$startTime" },
            },
            total: { $sum: "$value" },
          },
        },
      ],
      cursor: {},
    });

    const dayMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      dayMap.set(key, 0);
    }

    subscriptionWeekly.cursor.firstBatch.forEach((r: any) => {
      const key = `${r._id.year}-${r._id.month}-${r._id.day}`;
      addEarnings(dayMap, key, r.total);
    });
    promotionWeekly.cursor.firstBatch.forEach((r: any) => {
      const key = `${r._id.year}-${r._id.month}-${r._id.day}`;
      addEarnings(dayMap, key, r.total);
    });

    earningsByFilter = Array.from(dayMap.entries()).map(([key, total]) => ({
      _id: key,
      total,
    }));
  }

  return {
    totalEarnings,
    subscriptionEarning,
    promotionEarning,
    totalSubscription,
    subscriptionPercentages,
    earnings: earningsByFilter,
  };
};

function getRandomColor(): string {
  // Pick from a palette of visually distinct colors for charts
  const palette = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#C9CBCF",
    "#E7E9ED",
    "#8DD17E",
    "#FF6F91",
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

export const adminService = {
  loginAdmin,
  getAllProviders,
  getAllFacility,
  userStatusUpdate,
  deleteUser,
  getAllJobsForAdmin,
  deleteJobByAdmin,
  editJobByAdmin,
  getAllRatingsForAdmin,
  deleteRating,
  updateAdmin,
  getDashboardHeaderNumbers,
  getUserSubscrption,
  adminDashboardData,
};
