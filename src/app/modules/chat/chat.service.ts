import { Request } from "express";
import config from "../../../config";
import prisma from "../../../shared/prisma";

import { redis } from "../../../helpers/redis";

import uploadToDigitalOcean from "../../../helpers/uploadToDigitalOcean";
import { ConnectionCheckOutStartedEvent } from "mongodb";
import { Features_Flag, UserRole } from "@prisma/client";
import { activeUsers } from "../../../socket";
import { MessageTypes } from "../../../utlits/socket.helpers";
import { TrunkContextImpl } from "twilio/lib/rest/routes/v2/trunk";

const createConversationIntoDB = async (
  user1Id: string,
  user2Id: string,
  role: string,
) => {
  try {
    const [existingConversation, initiateUser] = await Promise.all([
      prisma.conversation.findFirst({
        where: {
          OR: [
            { user1Id, user2Id },
            { user1Id: user2Id, user2Id: user1Id },
          ],
        },
        select: { id: true, status: true },
      }),
      prisma.user.findUnique({
        where: { id: user1Id },
        select: {
          trackUserFeatureUsages: true,
          id: true,
          role: true,
          jobPost: {
            select: {
              JobApplication: {
                where: { providerUserId: user2Id },
                select: { id: true },
              },
            },
          },
        },
      }),
    ]);

    const directMessageFeature = initiateUser?.trackUserFeatureUsages.find(
      (tr: any) => tr.feature === Features_Flag.DIRECT_MESSAGE,
    );

    if (initiateUser?.role === "PROVIDER") {
      if (
        !directMessageFeature?.enabled &&
        (!existingConversation || existingConversation.status === "DEACTIVE")
      ) {
        const activeUser = activeUsers.get(user1Id);
        activeUser?.send(
          JSON.stringify({
            type: MessageTypes.FEATURE_LIMITATION,
            message:
              "Upgrade your plan. With your current plan you cannot directly message a facility until they contact you first.",
          }),
        );
        return null;
      }
    }

    if (initiateUser?.role === "FACILITY") {
      if (!directMessageFeature?.enabled && !existingConversation) {
        // check if provider applied to any of facility's job posts

        const providerHasApplied = initiateUser.jobPost.some(
          (job) => job.JobApplication.length > 0,
        );

        if (!providerHasApplied) {
          const activeUser = activeUsers.get(user1Id);
          activeUser?.send(
            JSON.stringify({
              type: MessageTypes.FEATURE_LIMITATION,
              message:
                "Upgrade your plan. You can only message providers who have applied to your job posts.",
            }),
          );
          return null;
        }
      }
    }

    if (existingConversation) {
      return existingConversation;
    }

    const newConversation = await prisma.conversation.create({
      data: { user1Id, user2Id },
      select: { id: true },
    });

    return newConversation;
  } catch (error) {
    console.error("Error creating or finding conversation:", error);
  }
};

const chatImageUploadIntoDB = async (file: Express.Multer.File) => {
  const image = await uploadToDigitalOcean(file);
  return image;
};
const getConversationListIntoDB = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
) => {
  const skip = (page - 1) * limit;

  const [privateConversations, privateCount] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        status: "ACTIVE",
      },

      select: {
        id: true,
        lastMessage: true,
        updatedAt: true,
        user1Id: true,
        user1: {
          select: {
            id: true,
            profileImage: true,
            role: true,
            fullName: true,
            providerProfile: {
              select: {
                phoneNumber: true,
                callRequest: true,
              },
            },
            facilityProfile: {
              select: {
                HrDetails: {
                  select: {
                    phoneNumber: true,
                  },
                },
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            profileImage: true,
            role: true,
            fullName: true,
            providerProfile: {
              select: {
                phoneNumber: true,
                callRequest: true,
              },
            },
          },
        },
        _count: {
          select: {
            privateMessage: {
              where: {
                receiverId: userId,
                read: false,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
    }),
    prisma.conversation.count({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    }),
  ]);

  // Map private conversations

  const privateConversationsData = await Promise.all(
    privateConversations.map(async (conv) => {
      const otherUser: any = conv?.user1Id === userId ? conv.user2 : conv.user1;
      const callRequestProvider = otherUser.providerProfile;
      const callRequest = callRequestProvider
        ? otherUser.providerProfile.callRequest
        : true;
      const phoneNumber =
        otherUser.role === UserRole.PROVIDER
          ? otherUser.providerProfile?.phoneNumber || null
          : otherUser.facilityProfile?.HrDetails?.[0]?.phoneNumber || null;

      return {
        conversationId: conv?.id,
        type: "private",
        participants: {
          userId: otherUser?.id || "",
          username: otherUser?.fullName || "",
          image: otherUser?.profileImage,
          phoneNumber: phoneNumber,
          callRequest: callRequest,
        },
        lastMessage: conv?.lastMessage || "",
        lastMessageTime: conv?.updatedAt || new Date(0),
        unseen: conv?._count?.privateMessage || 0,
      };
    }),
  );

  const totalPages = Math.ceil(privateCount / limit);

  const result = {
    result: privateConversationsData,
    meta: {
      page: totalPages,
      limit: limit,
      total: privateCount,
    },
  };
  return result;
};

const getSingleMessageList = async (
  userId: string,
  receiverId: string,
  page: number,
  limit: number,
) => {
  const skip = (page - 1) * limit;
  const result = await prisma.privateMessage.findMany({
    where: {
      OR: [
        {
          senderId: userId,
          receiverId: receiverId,
        },
        {
          senderId: receiverId,
          receiverId: userId,
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  const totalMessage = await prisma.privateMessage.count({
    where: {
      OR: [
        {
          senderId: userId,
          receiverId: receiverId,
        },
        {
          senderId: receiverId,
          receiverId: userId,
        },
      ],
    },
  });
  const totalPages = Math.ceil(totalMessage / limit);

  return {
    result,
    meta: {
      page,
      limit,
      totalPage: totalPages,
      total: totalMessage,
    },
  };
};

const markMessagesAsRead = async (userId: string, conversationId: string) => {
  await prisma.privateMessage.updateMany({
    where: {
      receiverId: userId,
      conversationId: conversationId,
      read: false,
    },
    data: {
      read: true,
      updatedAt: new Date(),
    },
  });

  return { success: true, message: "Messages marked as read" };
};

// const getMergedMessageList = async (
//   conversationId: string,
//   userId: string,
//   page: number,
//   limit: number
// ) => {
//   const redisKey = `chat:messages:${conversationId}`;

//   const [redisCount, dbCount] = await Promise.all([
//     redis.zcard(redisKey),
//     prisma.privateMessage.count({ where: { conversationId } }),
//   ]);

//   console.log(redisCount, dbCount, "check count");
//   const total = redisCount + dbCount;
//   const totalPage = Math.ceil(total / limit);

//   const startIndex = total - page * limit;
//   const endIndex = startIndex + limit - 1;

//   const messages: any[] = [];

//   if (endIndex < redisCount) {
//     console.log(endIndex, redisCount, "check redis");
//     const redisStart = redisCount - 1 - endIndex;
//     const redisEnd = redisCount - 1 - startIndex;

//     const redisRaw = await redis.zrevrange(redisKey, redisStart, redisEnd);
//     const redisMessages = redisRaw.map((msg) => JSON.parse(msg));

//     messages.push(...redisMessages);
//   } else if (startIndex < redisCount) {
//     console.log(startIndex, redisCount, "check redis start index");
//     const redisStart = 0;
//     const redisEnd = redisCount - 1 - startIndex;
//     console.log(redisEnd,"check redis end")

//     const redisRaw = await redis.zrevrange(redisKey, redisStart, redisEnd);
//     const redisMessages = redisRaw.map((msg) => JSON.parse(msg));

//     const remaining = limit - redisMessages.length;

//     const dbMessages = await prisma.privateMessage.findMany({
//       where: { conversationId },
//       orderBy: { createdAt: "desc" },
//       skip: 0,
//       take: remaining,
//     });

//     messages.push(...redisMessages, ...dbMessages);
//   } else {
//     const dbSkip = startIndex - redisCount;

//     const dbMessages = await prisma.privateMessage.findMany({
//       where: { conversationId },
//       orderBy: { createdAt: "desc" },
//       skip: dbSkip,
//       take: limit,
//     });

//     messages.push(...dbMessages);
//   }

//   return {
//     messages: messages,
//     meta: {
//       page,
//       limit,
//       totalPage,
//       total,
//     },
//   };
// };

// const getMergedMessageList = async (
//   conversationId: string,
//   userId: string,
//   page: number,
//   limit: number
// ) => {
//   const start = (page - 1) * limit;
//   const end = start + limit - 1;
//   const redisKey = `chat:messages:${conversationId}`;

//   const [redisCount, dbCount] = await Promise.all([
//     redis.zcard(redisKey),
//     prisma.privateMessage.count({ where: { conversationId } }),
//   ]);

//   const total = redisCount + dbCount;
//   const totalPage = Math.ceil(total / limit);

//   const messages: any[] = [];

//   if (start < redisCount) {
//     const redisEnd = Math.min(end, redisCount - 1);
//     const redisRaw = await redis.zrange(redisKey, start, redisEnd);
//     const redisMessages = redisRaw.map((msg) => JSON.parse(msg));

//     const remaining = limit - redisMessages.length;
//     let dbMessages: any[] = [];
//     if (remaining > 0) {
//       dbMessages = await prisma.privateMessage.findMany({
//         where: { conversationId },

//         orderBy: { createdAt: "asc" },
//         skip: 0,
//         take: remaining,
//       });
//     }

//     messages.push(
//       ...[...redisMessages, ...dbMessages].sort(
//         (a, b) =>
//           new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
//       )
//     );
//   } else {
//     const dbSkip = start - redisCount;
//     const dbMessages = await prisma.privateMessage.findMany({
//       where: { conversationId },
//       orderBy: { createdAt: "asc" },
//       skip: dbSkip,
//       take: limit,
//     });

//     messages.push(...dbMessages);
//   }

//   await prisma.privateMessage.updateMany({
//     where: {
//       conversationId: conversationId,
//       receiverId: userId,
//       read: false,
//     },
//     data: {
//       read: true,
//     },
//   });

//   return {
//     messages,
//     meta: {
//       page,
//       limit,
//       totalPage,
//       total,
//     },
//   };
// };
const getMergedMessageList = async (
  conversationId: string,
  userId: string,
  page: number,
  limit: number,
) => {
  const redisKey = `chat:messages:${conversationId}`;

  const [redisCount, dbCount] = await Promise.all([
    redis.zcard(redisKey),
    prisma.privateMessage.count({ where: { conversationId } }),
  ]);

  const total = redisCount + dbCount;
  const totalPage = Math.ceil(total / limit);

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit - 1;

  const messages: any[] = [];

  const redisRaw = await redis.zrevrange(redisKey, 0, -1);
  const redisMessages = redisRaw.map((msg) => JSON.parse(msg));

  const dbMessagesAll = await prisma.privateMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
  });

  const allMessages = [...redisMessages, ...dbMessagesAll];
  allMessages.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const paginatedMessages = allMessages.slice(startIndex, endIndex + 1);

  return {
    messages: paginatedMessages.reverse(),
    meta: {
      page,
      limit,
      totalPage,
      total,
    },
  };
};

export const chatService = {
  getConversationListIntoDB,
  createConversationIntoDB,
  getSingleMessageList,
  markMessagesAsRead,
  chatImageUploadIntoDB,

  getMergedMessageList,
};
