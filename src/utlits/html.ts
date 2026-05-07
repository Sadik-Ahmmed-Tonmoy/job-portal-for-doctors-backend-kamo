export const otpVerifyHtmlFormat = async (otp: string, username: string) => {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Verification Needed</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #FF7600; background-image: linear-gradient(135deg, #FF7600, #45a049); padding: 30px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">Account Verification</h1>
            </div>
            <div style="padding: 20px 12px; text-align: center;">
                <p style="font-size: 16px; color: #333;">Hi ${username},</p>
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Your OTP code is:</p>
                <p style="font-size: 22px; font-weight: bold; color: #FF7600; background: #f3f3f3; display: inline-block; padding: 10px 20px; border-radius: 5px; user-select: all;">
                    ${otp}
                </p>
                <p style="font-size: 14px; color: #777; margin-top: 10px;">
                    This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.
                </p>
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 14px; color: #888888; margin-bottom: 0;">If you have any questions, feel free to contact our support team.</p>
                </div>
            </div>
            <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 12px; color: #999999;">
                <p style="margin: 0;">© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>`;
};
