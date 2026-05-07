import express from "express";

import { authRoute } from "../modules/auth/auth.routes";
import { chatRoute } from "../modules/chat/chat.routes";

import { userRoute } from "../modules/user/user.routes";
import { jobRoute } from "../modules/job/job.route";
import { subscriptionRouter } from "../modules/subscription/subscription.route";
import { adminRoute } from "../modules/admin/admin.route";
import { communityRoute } from "../modules/community/community.route";
import { ReviewRoutes } from "../modules/review/review.routes";
import { promotionRoute } from "../modules/promotion/promotion.route";
import { notificationRoute } from "../modules/notifications/notification.route";
import { ContactUsRoutes } from "../modules/ContactUs/contact.routes";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: authRoute,
  },
  {
    path: "/user",
    route: userRoute,
  },
  {
    path: "/chat",
    route: chatRoute,
  },
  {
    path: "/job",
    route: jobRoute,
  },
  {
    path: "/admin",
    route: adminRoute,
  },
  {
    path: "/subscription",
    route: subscriptionRouter,
  },
  {
    path: "/community",
    route: communityRoute,
  },
  {
    path: "/reviews",
    route: ReviewRoutes,
  },
  {
    path: "/promotion",
    route: promotionRoute,
  },
  {
    path:"/notification",
    route:notificationRoute
  },
  {
    path:"/contact",
    route:ContactUsRoutes
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
