import twilio from "twilio";
import config from "../config";

const client = twilio(config.twilio.twilio_id, config.twilio.twilio_token);

export const sendMessage = async (phoneNumber: string, message: string) => {
  try {
    return
    const response = await client.messages.create({
      body: message,
      from: "+19206575935",
      to: phoneNumber,
    });
  
    return {
      success: true,
      message: "Message sent successfully.",
      sid: response.sid,
    };
  } catch (error: any) {
    console.error("Error sending message:", error.message);
    return {
      success: false,
      message: "Failed to send message.",
      error: error.message,
    };
  }
};
