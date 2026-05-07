import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { notificationServices } from "./notification.service";
import sendResponse from "../../../shared/sendResponse";
import eventEmitter from "../../../sse/eventEmitter";

const getNotificationsFrom = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const result = await notificationServices.getNotificationsFromDB(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification retrieved successfully",
    data: result,
  });
});

const getNotificationsCount = catchAsync(
  async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write("event: connected\n");
    res.write(`data: Connected to notifications\n\n`);
    res.flushHeaders();
    const userId = req.params.id as string;
    const initialCount =
      await notificationServices.getNotificationsCount(userId);
    res.write("event: notificationCount\n");
    res.write(`data: ${JSON.stringify({ count: initialCount })}\n\n`);

    const listener = async (receiverId: string) => {
      if (userId === receiverId) {
        const count = await notificationServices.getNotificationsCount(userId);
       
        res.write(`event: notificationCount\n`);
        res.write(`data: ${JSON.stringify({ count })}\n\n`);
      }
    };

    eventEmitter.on(`notificationCount`, listener);

    const pingInterval = setInterval(() => {
      res.write("event: ping\n");
      res.write("data: keep-alive\n\n");
    }, 25000);

    // Cleanup on disconnect
    req.on("close", () => {
      clearInterval(pingInterval);
      eventEmitter.off("notificationCount", listener);
      res.end();
    });
  },
);
// const getNotificationsCount = catchAsync(
//   async (req: Request, res: Response) => {
//     //  Set headers and flush FIRST before any writes
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders(); 

//     const userId = req.params.id as string;

//     // Send initial connection confirmation
//     res.write("event: connected\n");
//     res.write(`data: Connected to notifications\n\n`);

//     // Send initial count
//     const initialCount = await notificationServices.getNotificationsCount(userId);
//     res.write("event: notificationCount\n");
//     res.write(`data: ${JSON.stringify({ count: initialCount })}\n\n`);

//     const listener = async (receiverId: string) => {
//       if (userId === receiverId) {
//         try {
//           const count = await notificationServices.getNotificationsCount(userId);
         
//           if (!res.writableEnded) {
//             res.write(`event: notificationCount\n`);
//             res.write(`data: ${JSON.stringify({ count })}\n\n`);
//           }
//         } catch (err) {
//           console.error("Error fetching notification count:", err);
//         }
//       }
//     };

//     // Register listener immediately
//     eventEmitter.on("notificationCount", listener);

//     const pingInterval = setInterval(() => {
//       if (!res.writableEnded) {
//         res.write("event: ping\n");
//         res.write("data: keep-alive\n\n");
//       }
//     }, 25000);

//     // Cleanup on disconnect
//     req.on("close", () => {
//       clearInterval(pingInterval);
//       eventEmitter.removeListener("notificationCount", listener);
//       if (!res.writableEnded) res.end();
//     });
//   }
// );
const readNotification = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await notificationServices.markNotificationsAsRead(id);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
});

const markBulkNotificationsAsRead = catchAsync(
  async (req: Request, res: Response) => {
    const result = await notificationServices.markBulkNotificationsAsRead(
      req.user.id,
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "bulk Notification marked as read",
      data: result,
    });
  },
);
export const notificationController = {
  getNotificationsFrom,
  getNotificationsCount,
  markBulkNotificationsAsRead,
  readNotification,
};
