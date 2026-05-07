import { ObjectId } from "mongodb";

import { redisSocketService } from "./socket.redis";
import { activeUsers, chatRooms } from "../socket";
import { messagePersistenceQueue, redis } from "../helpers/redis";
import WebSocket from "ws";

import prisma from "../shared/prisma";
import { ConversationStatus, NotificationType } from "@prisma/client";
import { notificationServices } from "../app/modules/notifications/notification.service";

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  user2Id?: string;
  chatroomId?: string;
  groupId?: string;
}

export enum MessageTypes {
  JOIN_PRIVATE_CHAT = "joinPrivateChat",
  SEND_PRIVATE_MESSAGE = "sendPrivateMessage",
  RECEIVED_PRIVATE_MESSAGE = "receivePrivateMessage",
  CONVERSATION_LIST = "conversationList",
  JOIN_CONVERSATION_LIST = "joinConversationList",
  AUTH_SUCCESS = "authSuccess",
  AUTH_FAILURE = "authFailure",
  FAILURE = "Failure",
  JOIN_APP = "joinApp",
  JOIN_GROUP = "joinGroup",
  SEND_GROUP_MESSAGE = "sendGroupMessage",
  RECEIVED_GROUP_MESSAGE = "receiveGroupMessage",
  FEATURE_LIMITATION = "  feature_limitation",
}

const MAX_REDIS_MESSAGES = 5;

function broadcastToGroup(
  groupId: string,
  message: any,
  groupRooms: Map<string, Set<ExtendedWebSocket>>,
) {
  const groupClients = groupRooms.get(groupId);
  if (!groupClients) return;

  groupClients.forEach((client: ExtendedWebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

export const handleConversationJoinEvent = async (
  ws: ExtendedWebSocket,
  userId: string,
  activeUsers: Map<
    string,
    { socket: ExtendedWebSocket; lastActiveAt: Date | null }
  >,
) => {
  ws.userId = userId;
  activeUsers.set(userId, { socket: ws, lastActiveAt: new Date() });
  ws.send(
    JSON.stringify({
      type: MessageTypes.JOIN_CONVERSATION_LIST,
      message: `Successfully joined`,
    }),
  );
};

async function storeAndSendPrivateMessage(
  ws: ExtendedWebSocket,
  senderId: string,
  receiverId: string,
  content: string,
  imageUrl: string,
  conversationId: string,
) {
  try {
    const timestamp = new Date().toISOString();

    const [senderDetails, receiverDetails] = await Promise.all([
      redisSocketService.getUserDetails(senderId),
      redisSocketService.getUserDetails(receiverId),
    ]);

    const messagePayload = {
      id: new ObjectId().toString(),
      senderId,
      receiverId,
      content,
      imageUrl,
      createdAt: timestamp,
      read: false,
      updatedAt: timestamp,
    };

    const chatRoom = chatRooms.get(conversationId);

    if (chatRoom) {
      for (const clientSocket of chatRoom) {
        if (clientSocket.readyState === clientSocket.OPEN) {
          const isSender = clientSocket.userId === senderId;
          clientSocket.send(
            JSON.stringify({
              ...messagePayload,
              conversationId,
              type: MessageTypes.RECEIVED_PRIVATE_MESSAGE,
              receiver: isSender ? receiverDetails : senderDetails,
            }),
          );
        }
      }
    }

    const redisKey = `chat:messages:${conversationId}`;
    const messageObject = { ...messagePayload, conversationId };

    const keyType = await redis.type(redisKey);
    if (keyType !== "zset" && keyType !== "none") {
      await redis.del(redisKey);
    }

    await redis.zadd(
      redisKey,
      new Date(timestamp).getTime(),
      JSON.stringify(messageObject),
    );

    const isReceiverInRoom =
      chatRoom &&
      [...chatRoom].some((clientSocket) => clientSocket.userId === receiverId);

    if (!isReceiverInRoom) {
      await redis.hincrby(
        `conversation:unseen:${conversationId}`,
        receiverId,
        1,
      );
    }

    await redisSocketService.updateConversationList(
      senderId,
      receiverId,
      conversationId,
      content,
    );

    const [senderConversationList, receiverConversationList] =
      await Promise.all([
        redisSocketService.getConversationListFromRedis(senderId, 1, 10),
        redisSocketService.getConversationListFromRedis(receiverId, 1, 10),
      ]);

    [senderId, receiverId].forEach((userId) => {
      const socket = activeUsers.get(userId);
      if (socket && socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            type: MessageTypes.CONVERSATION_LIST,
            result:
              userId === senderId
                ? senderConversationList
                : receiverConversationList,
          }),
        );
      }
    });

    setImmediate(async () => {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: content ? content : imageUrl,
          status: ConversationStatus.ACTIVE,
        },
      });
      const isReceiverConnected =
        activeUsers.has(receiverId) &&
        activeUsers.get(receiverId)?.readyState === WebSocket.OPEN;

      if (!isReceiverConnected) {
        await notificationServices.sendSingleNotification({
          receiverId,

          title: "New Message Request",
          body: `${senderDetails?.username} send you a message`,
          type: NotificationType.NEW_MESSAGE,
          additionData: {
            receiverId: receiverId,
            senderId:senderDetails!.id,
            conversationId: conversationId,
            userName: senderDetails!.username,
            userProfile: senderDetails!.image,
            phoneNumber: senderDetails!.phoneNumber,
          },
        });
      }
      const listLength = await redis.zcard(redisKey);
      if (listLength >= MAX_REDIS_MESSAGES) {
        await messagePersistenceQueue.add(
          "persistMessagesToDB",
          { conversationId },
          {
            jobId: `persist:${conversationId}:${Date.now()}`,
            removeOnComplete: true,
            delay: 0,
            attempts: 3,
            removeOnFail: { count: 3 },
          },
        );
      }
    });
  } catch (error: any) {
    ws.send(
      JSON.stringify({
        type: MessageTypes.FAILURE,
        message: `Message sending failed: ${error.message || error}`,
      }),
    );
  }
}

function handleDisconnect(ws: ExtendedWebSocket) {
  try {
    if (ws.userId) {
      activeUsers.delete(ws.userId);
      redisSocketService.removeUserConnection(ws.userId);
      if (ws.chatroomId && chatRooms.has(ws.chatroomId)) {
        const chatRoom = chatRooms.get(ws.chatroomId);
        chatRoom?.delete(ws);
        if (chatRoom && chatRoom.size === 0) {
          chatRooms.delete(ws.chatroomId);
        }
      }
    }
  } catch (error) {
    return;
  }
}

export {
  broadcastToGroup,
  ExtendedWebSocket,
  handleDisconnect,
  storeAndSendPrivateMessage,
};
