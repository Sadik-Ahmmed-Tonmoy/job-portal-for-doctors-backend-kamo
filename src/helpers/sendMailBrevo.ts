import axios from "axios";
import config from "../config";

const sendEmailToBrevo = async (
  to: string,
  subject: string,
  html: string,
  text?: string
) => {
  const payload = {
    sender: {
      name: "Kamodoc",
      email: "tahlib.swan@ballink-sports.com",
    },
    to: [
      {
        email: to,
      },
    ],
    subject,
    htmlContent: html,
    textContent: text || "This is the plain text version of the email.",
  };
  try {
    await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
      headers: {
        "api-key": config.brevo.brevo_api_key,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.log(error);
  }
};

export default sendEmailToBrevo;
