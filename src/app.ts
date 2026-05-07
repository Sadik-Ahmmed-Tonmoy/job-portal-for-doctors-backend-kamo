import express, { Application, NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import cors from "cors";
import router from "./app/routes";
import GlobalErrorHandler from "./app/middlewares/globalErrorHandler";
import { PrismaClient } from "@prisma/client";
import path from "path";

import handleWebHook from "./helpers/stripe.webhook";

import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import {
  assignJobQueue,
  conversationListQueue,
  messagePersistenceQueue,
  otpQueueEmail,
  otpQueuePhone,
} from "./helpers/redis";
import { runCronJob } from "./helpers/runCornJob";

const app: Application = express();
app.post(
  "/api/v1/stripe/payment-webhook",
  express.raw({ type: "application/json" }),
  handleWebHook
);

const prisma = new PrismaClient();
const corsOptions = {
  origin: [
    "https://sericiosmans-dashboard.vercel.app",
    "http://localhost:3007",
    "http://localhost:3008",
    "http://localhost:3000",
    "http://admin.serviciosremans.com",
    "https://kamodoc-frontend.vercel.app",
    "http://145.223.120.135:3007",
    "https://kamodoc-frontend-five.vercel.app",
    "http://206.162.244.145:3000",
    "https://api.anesthelink.com",
    "https://anesthelink.com",
    "https://admin.anesthelink.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware setup
prisma
  .$connect()
  .then(() => {
    console.log("✅ Database connected successfully!");
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
  });

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const uploadDir = path.join(process.cwd(), "uploads");

// Route handler for root endpoint
app.get("/", (req: Request, res: Response) => {
  res.send({
    Message: "Welcome to api main route",
  });
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../src/views"));

app.get("/payment", (req: Request, res: Response) => {
  res.render("stripe");
});

// Router setup
app.use("/api/v1", router);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [
    new BullMQAdapter(otpQueueEmail),
    new BullMQAdapter(otpQueuePhone),
    new BullMQAdapter(conversationListQueue),
    new BullMQAdapter(assignJobQueue),
    
  ],
  serverAdapter,
});

// Mount the dashboard
app.use("/admin/queues", serverAdapter.getRouter());
runCronJob();
// Global Error Handler

// API Not found handler
app.use(GlobalErrorHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "API NOT FOUND!",
    error: {
      path: req.originalUrl,
      message: "Your requested path is not found!",
    },
  });
});

export default app;
