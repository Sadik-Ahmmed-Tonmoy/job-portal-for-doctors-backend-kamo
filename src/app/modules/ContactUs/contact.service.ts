import config from "../../../config";
import { contactAdminEmail } from "../../../emails/contactAdminEmail";
import sendEmail from "../../../helpers/sendMailBrevo";

import { IContactUs } from "./contact.interface";

const createContactUs = async (data: IContactUs) => {
  const html = contactAdminEmail(data);
  await sendEmail(config.emailSender.email!, "New Contact Us Message",  html);
};
 
export const ContactUsService = {
  createContactUs,
};
