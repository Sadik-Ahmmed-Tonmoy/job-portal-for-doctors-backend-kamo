import { Router } from "express";
import auth from "../../middlewares/auth";
import { chatController } from "./chat.controller";
import { fileUploader } from "../../../helpers/fileUploader";

const router = Router();

router.get("/convarstion-list", auth(), chatController.getConversationList);

router.post(
  "/chat-image-upload",
  auth(),
  fileUploader.chatImage,
  chatController.chatImageUpload
);
router.patch(
  "/private-message-status/:conversationId",
  auth(),
  chatController.markMessagesAsRead
);

router.get(
  "/get-single-message/:conversationId",
  auth(),
  chatController.getSingleMessageList
);

export const chatRoute = router;
