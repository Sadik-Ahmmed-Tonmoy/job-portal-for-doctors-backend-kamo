import ApiError from "../../../errors/ApiErrors";
import prisma from "../../../shared/prisma";

const createReview = async (payload: any, senderId: string) => {
  const isReceiverExist = await prisma.user.findUnique({
    where: { id: payload.receiverId },
  });

  if (!isReceiverExist) {
    throw new ApiError(404, "Receiver not found");
  }

  // ✅ Create new review
  const review = await prisma.review.create({
    data: {
      receiverId: payload.receiverId,
      senderId,
      jobPostId: payload.jobPostId,
      rating: payload.rating,
      comment: payload.comment,
    },
  });

  // ✅ Get updated stats for the receiver
  const stats = await prisma.review.aggregate({
    where: { receiverId: payload.receiverId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  // ✅ Update receiver with new average rating & review count
  await prisma.user.update({
    where: { id: payload.receiverId },
    data: {
      averageRating: stats._avg.rating ?? 0.0,
      totalReviewCount: stats._count.rating,
    },
  });

  return review;
};

const getAllReview = async (
  receiverId: string,
  page: number,
  limit: number
) => {
  const reviews = await prisma.review.findMany({
    where: { receiverId },
    select: {
      id: true,

      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      sender: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
          facilityProfile: {
            select: {
              id: true,
              facilityName: true,
              profileImage: true,
              address: true,
            },
          },
          providerProfile: {
            select: {
              id: true,
              profileImage: true,
              user: {
                select: {
                  fullName: true,
                },
              },
              address: true,
            },
          },
        },
      },
      receiver: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
          facilityProfile: {
            select: {
              id: true,
              facilityName: true,
              profileImage: true,
              address: true,
            },
          },
          providerProfile: {
            select: {
              id: true,
              profileImage: true,
            },
          },
        },
      },
      jobPost: {
        select: {
          id: true,
          jobRole: true,
        },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.review.count({
    where: { receiverId },
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

const getAllReviewsForWeb = async (page: number, limit: number) => {
  const reviews = await prisma.review.findMany({
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      sender: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
          facilityProfile: {
            select: {
              id: true,
              facilityName: true,
              profileImage: true,
              address: true,
            },
          },
          providerProfile: {
            select: {
              id: true,
              profileImage: true,
            },
          },
        },
      },
      receiver: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
          facilityProfile: {
            select: {
              id: true,
              facilityName: true,
              profileImage: true,
              address: true,
            },
          },
          providerProfile: {
            select: {
              id: true,
              profileImage: true,
            },
          },
        },
      },
      jobPost: {
        select: {
          id: true,
          jobRole: true,
        },
      },
    },
  });

  const total = await prisma.review.count();

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

const getReceivedReviewByUserId = async (
  userId: string,
  page: number,
  limit: number
) => {
  const reviews = await prisma.review.findMany({
    where: { receiverId: userId },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      updatedAt: true,
      sender: {
        select: {
          id: true,
          email: true,
          profileImage: true,
          facilityProfile: {
            select: {
              id: true,
              facilityName: true,
              profileImage: true,
              address: true,
            },
          },
          providerProfile: {
            select: {
              id: true,
              profileImage: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      },
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.review.count({
    where: { receiverId: userId },
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

export const ReviewService = {
  createReview,
  getAllReview,
  getReceivedReviewByUserId,
  getAllReviewsForWeb,
};
