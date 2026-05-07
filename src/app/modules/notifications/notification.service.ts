import ApiError from "../../../errors/ApiErrors";
import admin from "../../../helpers/firebaseAdmin";

import prisma from "../../../shared/prisma";
import eventEmitter from "../../../sse/eventEmitter";

const sendSingleNotification = async ({
  receiverId,
  title,
  body,
  type,
  additionData,
}: any) => {
  const user = await prisma.user.findUnique({
    where: { id: receiverId },
  });

  // Always save the notification in the database
  await prisma.notifications.create({
    data: {
      receiverId: receiverId,
      title,
      body,
      type: type,
      addtionalData: additionData,
    },
  });
  eventEmitter.emit("notificationCount", receiverId);
  // If no FCM token, exit gracefully — no error
  if (!user?.fcmToken) {
    return {
      message: "Notification saved, but FCM token not available.",
      sent: false,
    };
  }

  const message = {
    notification: {
      body,
      title,
    },
    token: user.fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);

    return {
      message: "Notification sent successfully.",
      response,
      sent: true,
    };
  } catch (error: any) {
    // Log error but still return success for DB save
    console.error("FCM send error:", error);

    return {
      message: "Notification saved in DB but failed to send via FCM.",
      error: error.message,
      sent: false,
    };
  }
};

const sendMultipulNotifications = async (
  body: string,
  title: string,
  receiverIds?: string[],
) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { fcmToken: { not: null } },
          ...(receiverIds ? [{ id: { in: receiverIds } }] : []),
        ],
      },
      select: {
        id: true,
        fcmToken: true,
      },
    });

    await prisma.notifications.createMany({
      data: users.map((user) => ({
        receiverId: user.id,
        body: body,
        title: title,
      })),
    });

    if (users.length === 0) {
      return;
    }

    const fcmTokens = users.map((user) => user.fcmToken);

    const message = {
      notification: {
        body: body,
      },
      tokens: fcmTokens,
    };

    await admin.messaging().sendEachForMulticast(message as any);
    return;
  } catch (error) {
    console.log(error);
  }

  // Collect failed tokens
};
const sendNotifications = async (body: string, title: string) => {
  try {
    const users = await prisma.user.findMany({
      where: { fcmToken: { not: null } },
      select: { id: true, fcmToken: true },
    });

    if (users.length === 0) {
      throw new ApiError(404, "No users found with valid FCM tokens.");
    }

    const fcmTokens = users.map((user) => user.fcmToken);

    const message = {
      notification: {
        title: title || "Notification",
        body: body,
      },
      tokens: fcmTokens,
    };
    const response = await admin
      .messaging()
      .sendEachForMulticast(message as any);
    const successIndices = response.responses
      .map((res, idx) => (res.success ? idx : null))
      .filter((idx) => idx !== null) as number[];

    const successfulUsers = successIndices.map((idx) => users[idx]);
    if (successfulUsers.length > 0) {
      await prisma.notifications.createMany({
        data: successfulUsers.map((user) => ({
          receiverId: user.id,
          title: title || "Notification",
          body: body,
        })),
      });
    }
    const failedTokens = response.responses
      .map((res, idx) => (!res.success ? fcmTokens[idx] : null))
      .filter((token) => token !== null);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens,
    };
  } catch (error) {
    throw new ApiError(500, "Failed to send notifications.");
  }
};

const getNotificationsFromDB = async (receiverId: string) => {
  const notifications = await prisma.notifications.findMany({
    where: { receiverId: receiverId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // if (notifications.length === 0) {
  //   throw new ApiError(404, "No notifications found for the user");
  // }

  return notifications;
};

const getNotificationsCount = async (receiverId: string) => {
  const count = await prisma.notifications.count({
    where: {
      isRead: false,
      receiverId: receiverId,
    },
  });
  return count;
};

const markNotificationsAsRead = async (notificationId: string) => {
  const result = await prisma.notifications.update({
    where: {
      id: notificationId,
    },
    data: {
      isRead: true,
    },
  });
  eventEmitter.emit("notificationCount", result?.receiverId);
  return result;
};
const markBulkNotificationsAsRead = async (receiverId: string) => {
  const result = await prisma.notifications.updateMany({
    where: {
      receiverId: receiverId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  eventEmitter.emit("notificationCount", receiverId);

  return result;
};
export const notificationServices = {
  sendSingleNotification,
  sendMultipulNotifications,
  getNotificationsFromDB,
  sendNotifications,
  getNotificationsCount,
  markNotificationsAsRead,
  markBulkNotificationsAsRead,
};
