import { ConnectionCheckOutStartedEvent } from "mongodb";
import { chatService } from "../app/modules/chat/chat.service";
import prisma from "../shared/prisma";
import { activeUsers, chatRooms } from "../socket";
import {
  ExtendedWebSocket,
  MessageTypes,
  storeAndSendPrivateMessage,
} from "./socket.helpers";
import { redisSocketService } from "./socket.redis";

export const handleJoinApp = async (
  ws: ExtendedWebSocket,
  userId: any,
): Promise<void> => {
  ws.userId = userId;
  activeUsers.set(userId, ws);
  const success = await redisSocketService.storeUserConnection(userId, ws);
  if (!success) {
    return;
  }
  ws.send(
    JSON.stringify({
      type: MessageTypes.AUTH_SUCCESS,
      message: `Successfully joined`,
    }),
  );
};

async function handleJoinPrivateChat(ws: ExtendedWebSocket, parsedData: any) {
  const { userId, user2Id } = parsedData;
  for (const [roomId, sockets] of chatRooms.entries()) {
    if (sockets.has(ws)) {
      sockets.delete(ws);

      if (sockets.size === 0) {
        chatRooms.delete(roomId);
      }
    }
  }

  const conversation = await chatService.createConversationIntoDB(
    userId,
    user2Id,
    parsedData.role,
  );
    if (!conversation) {
    return;
  }
  const chatroomId = conversation?.id as string;
  ws.chatroomId = chatroomId;
  // ws.userId = userId;
  // activeUsers.set(userId, ws);
  if (!chatRooms.has(chatroomId)) {
    chatRooms.set(chatroomId, new Set());
  }

  chatRooms.get(chatroomId)?.add(ws);

  ws.send(
    JSON.stringify({
      type: MessageTypes.JOIN_PRIVATE_CHAT,
      message: `Successfully joined the private chat with user ${user2Id}`,
      chatroomId,
    }),
  );
  setImmediate(async () => {
    await prisma.privateMessage.updateMany({
      where: {
        conversationId: chatroomId,
        receiverId: userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  });
}

async function handleSendPrivateMessage(
  ws: ExtendedWebSocket,
  parsedData: any,
) {
  const { userId, receiverId, content, imageUrl } = parsedData;
  const senderSocket = activeUsers.get(userId);
  //  console.log(senderSocket?.chatroomId,"check sender socket")
  //  console.log(ws.chatroomId,"check ws")
  //  console.log(ws.userId,"chech user id")
  //  console.log(ws.user2Id,"check buser 2 id")

  const conversationId = senderSocket?.chatroomId || ws.chatroomId;

  try {
    if (conversationId) {
      await storeAndSendPrivateMessage(
        ws,
        userId,
        receiverId,
        content,
        imageUrl,
        conversationId,
      );
    } else {
      ws.send(
        JSON.stringify({
          type: MessageTypes.AUTH_FAILURE,
          message: "Conversation ID not found for sender.",
        }),
      );
    }
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: MessageTypes.AUTH_FAILURE,
        message: `Error sending private message:, ${error}`,
      }),
    );
  }
}

export { handleJoinPrivateChat, handleSendPrivateMessage };
