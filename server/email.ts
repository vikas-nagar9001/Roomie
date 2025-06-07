import nodemailer from "nodemailer";
import ngrok from "ngrok";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: 'trackerzpoint@gmail.com',
    pass: 'gwtakwcwhppsnagz',
  },
});

async function getBaseUrl() {
  let baseUrl = process.env.BASE_URL;
 
  //for ngrok 

  // try {
  //   const tunnelUrl = await ngrok.connect(); // Secure connection
  //   if (tunnelUrl) { 
  //     baseUrl = tunnelUrl;
  //   }
  // } catch (error) {
  //   console.warn("Could not get ngrok URL, using localhost");
  // }
  return baseUrl;
}

async function sendEmail({ to, subject, text, html }) {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || "Roomie"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`✅ Email sent to ${to}: ${info.response}`);
    return info;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error.message);
    throw error;
  }
}

export async function sendInviteEmail(email, name, inviteToken) {
  const baseUrl = await getBaseUrl();
  const inviteLink = `${baseUrl}/set-password?token=${inviteToken}`;

  return sendEmail({
    to: email,
    subject: "Welcome to Roomie - Set Your Password",
    text: `Hello ${name},\n\nYou've been invited to join Roomie. Click the following link to set your password and complete your account setup:\n\n${inviteLink}\n\nThis link will expire in 24 hours.\n\nBest regards,\nRoomie Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: #6636A3; padding: 30px 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Roomie</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #6636A3; margin-top: 0; margin-bottom: 20px; font-size: 24px; font-weight: 700;">Welcome to Roomie!</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello <strong>${name}</strong>,</p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">You've been invited to join Roomie. Please click the button below to set your password and complete your account setup.</p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="display: inline-block; background: #6636A3; color: white; font-weight: 600; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(102, 54, 163, 0.3);">
                  Set Your Password
                </a>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Or copy and paste this link in your browser:</p>
              <p style="background: rgba(102, 54, 163, 0.05); padding: 12px 15px; border-radius: 6px; font-size: 14px; color: #6636A3; word-break: break-all; margin-bottom: 25px; border: 1px solid rgba(102, 54, 163, 0.1);">${inviteLink}</p>
              
              <div style="background-color: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
                <p style="color: #ef4444; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500;">⚠️ This link will expire in 24 hours.</p>
              </div>
              
              <div style="background-color: rgba(102, 54, 163, 0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #6636A3; margin-bottom: 25px;">
                <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0;">If you have any questions or need assistance, please contact our support team.</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #6636A3; padding: 25px 30px; text-align: center;">
              <p style="color: #e5e7eb; font-size: 14px; margin: 0 0 10px 0;">Best regards,</p>
              <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0;">Roomie Team</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
                <p style="color: #e5e7eb; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Roomie. All rights reserved.</p>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
}
}

export async function sendPasswordResetEmail(email, name, resetToken) {
  const baseUrl = await getBaseUrl();
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: "Roomie - Password Reset Request",
    text: `Hello ${name},\n\nWe received a request to reset your password. Click the following link to set a new password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nRoomie Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: #6636A3; padding: 30px 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Roomie</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #6636A3; margin-top: 0; margin-bottom: 20px; font-size: 24px; font-weight: 700;">Password Reset Request</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello <strong>${name}</strong>,</p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">We received a request to reset your password. Please click the button below to set a new password.</p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; background: #6636A3; color: white; font-weight: 600; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(102, 54, 163, 0.3);">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Or copy and paste this link in your browser:</p>
              <p style="background: rgba(102, 54, 163, 0.05); padding: 12px 15px; border-radius: 6px; font-size: 14px; color: #6636A3; word-break: break-all; margin-bottom: 25px; border: 1px solid rgba(102, 54, 163, 0.1);">${resetLink}</p>
              
              <div style="background-color: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
                <p style="color: #ef4444; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500;">⚠️ This link will expire in 1 hour.</p>
              </div>
              
              <div style="background-color: rgba(102, 54, 163, 0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #6636A3; margin-bottom: 25px;">
                <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0;">If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #6636A3; padding: 25px 30px; text-align: center;">
              <p style="color: #e5e7eb; font-size: 14px; margin: 0 0 10px 0;">Best regards,</p>
              <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0;">Roomie Team</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
                <p style="color: #e5e7eb; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Roomie. All rights reserved.</p>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
}
