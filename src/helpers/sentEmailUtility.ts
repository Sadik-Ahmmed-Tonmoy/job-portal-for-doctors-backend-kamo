

import { ConnectionCheckOutStartedEvent } from "mongodb";
import nodemailer from "nodemailer";
 
 
const sentEmailUtility = async (
  emailTo: string,
  EmailSubject: string,
 
  EmailHTML: string,
   EmailText?: string,
) => {
  // Create a transporter

try {
  const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com", // Hostinger SMTP server
  port: 465, // Use 465 for SSL or 587 for TLS
  secure: true, // true for 465, false for 587
  auth: {
    user: process.env.HOSTINGER_EMAIL, // Your Hostinger email address
    pass: process.env.HOSTINGER_PASSWORD, // Email password or app-specific password
  },
});
 
 
  // Email options
  const mailOptions = {
    from: "no-reply@anesthelink.com",
    to: emailTo,
    subject: EmailSubject,
    html: EmailHTML,
    text: EmailText,
  };
 const result= await transporter.sendMail(mailOptions);


} catch (error) {
    console.log(error,"check error")
}
};
 
export default sentEmailUtility;