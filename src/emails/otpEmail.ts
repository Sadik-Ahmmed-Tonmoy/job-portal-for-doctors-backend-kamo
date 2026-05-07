export const otpEmail = (
  randomOtp: string,
  userEmail: string
) => {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
</head>
 <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f7fa; color: #333333;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; border: 0; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                    <!-- Header with Logo -->
                    <tr>
                        <td align="center" style="padding: 30px 30px 20px 30px; border-bottom: 1px solid #eeeeee;">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Minimalist_info_Icon.png/1024px-Minimalist_info_Icon.png" alt="Company Logo" width="150" style="height: auto; display: block;" />
                        </td>
                    </tr>
                    
                    <!-- Email Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0 0 20px 0; font-size: 24px; line-height: 30px; color: #333333; text-align: center;">Verify Your Email Address</h1>
                                        <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 24px; color: #555555;">Thank you for signing up! To complete your registration and access all features, please verify your email address.</p>
                                        
                                        <!-- Verification Code Box -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 25px;">
                                            <tr>
                                                <td align="center">
                                                    <div style="background-color: #f7f9fc; border: 1px solid #e1e5eb; border-radius: 6px; padding: 20px; max-width: 300px; margin: 0 auto;">
                                                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center;">Your verification code:</p>
                                                        <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #4a6ee0; text-align: center;">${randomOtp}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 24px; color: #555555; text-align: center;">Or click the button below to verify your email address:</p>
                                        
                                   
                                        
                                        <p style="margin: 0; font-size: 14px; line-height: 22px; color: #777777;">If you didn't create an account, you can safely ignore this email.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #eeeeee; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                                <tr>
                                    <td style="color: #777777; font-size: 13px; text-align: center;">
                                        <p style="margin: 0 0 10px 0;">&copy; ${new Date().getFullYear()} Your Company. All rights reserved.</p>
                                
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};