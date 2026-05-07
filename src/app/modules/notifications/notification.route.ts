import { Router } from "express";
import auth from "../../middlewares/auth";
import { notificationController } from "./notification.controller";

const router = Router();

router.get("/", auth(), notificationController.getNotificationsFrom);
router.get("/count/:id", notificationController.getNotificationsCount);
router.patch(
  "/read/:id",
  auth(),

  notificationController.readNotification
);
router.patch(
  "/bulk-read",
  auth(),
  
  notificationController.markBulkNotificationsAsRead
);

export const notificationRoute = router;
