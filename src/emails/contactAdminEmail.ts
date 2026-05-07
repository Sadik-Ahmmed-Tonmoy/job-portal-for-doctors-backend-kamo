import { IContactUs } from "../app/modules/ContactUs/contact.interface";

export const contactAdminEmail = (
  contactData: IContactUs
) => {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Message</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f7fa; color: #333333;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; border: 0; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 30px 30px 20px 30px; border-bottom: 1px solid #eeeeee;">
                            <h1 style="margin: 0; font-size: 22px; color: #333333;">New Contact Form Submission</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 24px; color: #555555;">You have received a new message from the contact form:</p>
                                        
                                        <!-- Submission Details -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 30px;">
                                            <tr>
                                                <td width="30%" style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; color: #555555;">First Name:</td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #333333;">${contactData.firstName}</td>
                                            </tr>
                                            <tr>
                                                <td width="30%" style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; color: #555555;">Last Name:</td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #333333;">${contactData.lastName}</td>
                                            </tr>
                                            <tr>
                                                <td width="30%" style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; color: #555555;">Email:</td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #333333;">${contactData.email}</td>
                                            </tr>
                                            <tr>
                                                <td width="30%" style="padding: 8px 0; border-bottom: 1px solid #eeeeee; font-weight: bold; color: #555555;">Phone:</td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #eeeeee; color: #333333;">${contactData.phone || 'Not provided'}</td>
                                            </tr>
                                            <tr>
                                                <td width="30%" style="padding: 8px 0; font-weight: bold; color: #555555;">Message:</td>
                                                <td style="padding: 8px 0; color: #333333;"></td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding: 15px 0 0 0; color: #333333; white-space: pre-line;">${contactData.message}</td>
                                            </tr>
                                        </table>
                                        
                                        <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 6px;">
                                            <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #555555;">Quick Actions:</p>
                                            <p style="margin: 0; font-size: 14px; line-height: 22px; color: #555555;">
                                                <a href="mailto:${contactData.email}" style="color: #4a6ee0; text-decoration: none;">✉ Reply to ${contactData.firstName}</a> | 
                                                <a href="tel:${contactData.phone}" style="color: #4a6ee0; text-decoration: none;">📞 Call ${contactData.phone ? contactData.phone : '(number not provided)'}</a>
                                            </p>
                                        </div>
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
                                        <p style="margin: 0 0 10px 0;">This is an automated message. Please do not reply directly to this email.</p>
                                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Your Company. All rights reserved.</p>
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