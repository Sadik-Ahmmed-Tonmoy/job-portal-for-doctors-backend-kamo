import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { chatService } from "./chat.service";

const getConversationList = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await chatService.getConversationListIntoDB(
    userId,
    page,
    limit
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Conversation retrieved successfully",
    data: result.result,
    meta: result.meta,
  });
});

const chatImageUpload = catchAsync(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File;
  const image = await chatService.chatImageUploadIntoDB(file);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Image upload successfully",
    data: image,
  });
});


const getSingleMessageList = catchAsync(async (req: Request, res: Response) => {
  let { page = 1, limit = 20 } = req.query;
  const conversationId = req.params.conversationId as string;
  page = Number(page);
  limit = Number(limit);
  const result = await chatService.getMergedMessageList(
    conversationId,
    req.user.id,
    page,
    limit
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Message retrieved successfully",
    data: result.messages,
    meta: result.meta,
  });
});

const markMessagesAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id as string;
  const conversationId = req.params.conversationId as string;
  const result = await chatService.markMessagesAsRead(userId, conversationId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});



export const chatController = {
  getConversationList,
  getSingleMessageList,
  markMessagesAsRead,
  chatImageUpload,
 

};
