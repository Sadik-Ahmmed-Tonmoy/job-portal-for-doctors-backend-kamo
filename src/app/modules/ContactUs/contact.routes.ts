import express from "express";
import { ContactUsSchema } from "./contact.validation";
import validateRequest from "../../middlewares/validateRequest";
import { ContactUsController } from "./contact.controller";

const router = express.Router();

router.post(
  "/create",
  validateRequest(ContactUsSchema),
  ContactUsController.createContactUs
);


export const ContactUsRoutes = router;
