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

async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
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

export async function sendInviteEmail(email: string, name: string, inviteToken: string) {
  const baseUrl = await getBaseUrl();
  const inviteLink = `${baseUrl}/set-password?token=${inviteToken}`;

  return sendEmail({
    to: email,
    subject: "Welcome to Roomie - Set Your Password",
    text: `Hello ${name},\n\nYou've been invited to join Roomie. Click the following link to set your password and activate your account:\n\n${inviteLink}\n\nThis link will expire in 24 hours.\n\nBest regards,\nRoomie Team`,
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header with Logo and Gradient -->
        <div style="background: linear-gradient(to right, #582c84, #5433a7); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <img src="${baseUrl}/Roomie.png" alt="Roomie Logo" style="width: 60px; height: 48px; object-fit: contain;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Welcome to Roomie</h1>
          </div>
        </div>

        <!-- Main Content -->
        <div style="background: #1a1a2e; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; color: #fff; margin-bottom: 20px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong style="color: #a78bfa;">${name}</strong>,</p>
          
          <p style="font-size: 16px; margin-bottom: 24px; color: rgba(255, 255, 255, 0.9);">You've been invited to join <strong>Roomie</strong>. Click the button below to set your password and activate your account:</p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(to right, #582c84, #5433a7); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; box-shadow: 0 4px 12px rgba(88, 44, 132, 0.3); transition: all 0.3s;">
              Set Your Password
            </a>
          </div>

          <!-- Alternative Link -->
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; margin-top: 20px;">
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin: 0 0 8px 0;">Or copy and paste this link in your browser:</p>
            <p style="color: #a78bfa; font-size: 14px; word-break: break-all; margin: 0;">${inviteLink}</p>
          </div>

          <!-- Expiry Warning -->
          <p style="color: #f87171; font-size: 14px; margin-top: 24px;">
            <strong>⚠️ This link will expire in 24 hours.</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-top: 24px;">
          <p style="margin-bottom: 12px;">Best regards,<br><strong style="color: #a78bfa;">Roomie Team</strong></p>
          <p style="font-size: 12px; color: rgba(255, 255, 255, 0.5);">© ${new Date().getFullYear()} Roomie. All rights reserved.</p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string) {
  const baseUrl = await getBaseUrl();
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: "Roomie - Password Reset Request",
    text: `Hello ${name},\n\nWe received a request to reset your password. Click the following link to set a new password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nRoomie Team`,
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header with Logo and Gradient -->
        <div style="background: linear-gradient(to right, #582c84, #5433a7); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <img src="${baseUrl}/Roomie.png" alt="Roomie Logo" style="width: 60px; height: 48px; object-fit: contain;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Password Reset</h1>
          </div>
        </div>

        <!-- Main Content -->
        <div style="background: #1a1a2e; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; color: #fff; margin-bottom: 20px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong style="color: #a78bfa;">${name}</strong>,</p>
          
          <p style="font-size: 16px; margin-bottom: 24px; color: rgba(255, 255, 255, 0.9);">We received a request to reset your password. Click the button below to set a new password:</p>
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(to right, #582c84, #5433a7); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; box-shadow: 0 4px 12px rgba(88, 44, 132, 0.3); transition: all 0.3s;">
              Reset Password
            </a>
          </div>

          <!-- Alternative Link -->
          <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; margin-top: 20px;">
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin: 0 0 8px 0;">Or copy and paste this link in your browser:</p>
            <p style="color: #a78bfa; font-size: 14px; word-break: break-all; margin: 0;">${resetLink}</p>
          </div>

          <!-- Warning Message -->
          <div style="margin-top: 24px; padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px;">
            <p style="color: #f87171; font-size: 14px; margin: 0;">
              <strong>⚠️ This link will expire in 1 hour.</strong>
            </p>
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin: 8px 0 0 0;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-top: 24px;">
          <p style="margin-bottom: 12px;">Best regards,<br><strong style="color: #a78bfa;">Roomie Team</strong></p>
          <p style="font-size: 12px; color: rgba(255, 255, 255, 0.5);">© ${new Date().getFullYear()} Roomie. All rights reserved.</p>
        </div>
      </div>
    `,
  });
}