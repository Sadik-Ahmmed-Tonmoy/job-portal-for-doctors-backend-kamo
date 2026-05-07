import { WebSocketServer } from "ws";
import { chatService } from "./app/modules/chat/chat.service";

import {
  handleJoinApp,
  handleJoinPrivateChat,
  handleSendPrivateMessage,
} from "./utlits/private.chat";
import { validateToken } from "./utlits/validateToken";
import startKeepAlive from "./utlits/startKeepAlive";
import {
  ExtendedWebSocket,
  MessageTypes,
  handleDisconnect,
} from "./utlits/socket.helpers";

import { parse } from "url";
import querystring from "querystring";

export const activeUsers = new Map<string, ExtendedWebSocket>();

export const chatRooms = new Map<string, Set<ExtendedWebSocket>>();

let wss: WebSocketServer;

export default function socketConnect(server: any) {
  wss = new WebSocketServer({ server });

  wss.on("connection", async (ws: ExtendedWebSocket, req) => {
    const urlParts = parse(req.url || "");
    const queryParams = querystring.parse(urlParts.query || "");

    let token = req.headers["x-token"] as string;
    if (!token) {
      token = queryParams.token as string;
    }

    const { id, role } = await validateToken(ws, token);

    if (!id) {
      return;
    }
    const keepAliveInterval = startKeepAlive(ws);
    ws.on("message", async (data: string) => {
      try {
        let parsedData = JSON.parse(data);
        parsedData.userId = id;
        parsedData.role = role;

        switch (parsedData.type) {
          case MessageTypes.JOIN_APP:
            await handleJoinApp(ws, id as unknown as string);
            break;
          case MessageTypes.JOIN_PRIVATE_CHAT:
            await handleJoinPrivateChat(ws, parsedData);
            break;
          case MessageTypes.SEND_PRIVATE_MESSAGE:
            await handleSendPrivateMessage(ws, parsedData);
            break;

          case MessageTypes.CONVERSATION_LIST:
            try {
              const { userId, page = 1, limit = 10 } = parsedData;
              const conversationList =
                await chatService.getConversationListIntoDB(
                  userId,
                  Number(page),
                  Number(limit),
                );
              const receiverSocket = activeUsers.get(userId);
              if (receiverSocket) {
                receiverSocket.send(
                  JSON.stringify({
                    type: MessageTypes.CONVERSATION_LIST,
                    conversationList,
                  }),
                );
              }
            } catch (error) {
              ws.send(
                JSON.stringify({
                  type: MessageTypes.FAILURE,
                  message: error,
                }),
              );
            }
            break;

          default:
            console.log("Unknown WebSocket message types:", parsedData.type);
        }
      } catch (error) {
        console.error("Error handling WebSocket messages:", error);
      }
    });
    ws.on("close", () => {
      clearInterval(keepAliveInterval);
      handleDisconnect(ws);
    });
  });
}
