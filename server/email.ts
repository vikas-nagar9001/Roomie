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
    text: `Hello ${name},\n\nYou've been invited to join Roomie. Click the following link to set your password and activate your account:\n\n${inviteLink}\n\nThis link will expire in 24 hours.\n\nBest regards,\nRoomie Team`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #4F46E5;">Welcome to Roomie</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>You've been invited to join <strong>Roomie</strong>. Click the button below to set your password and activate your account:</p>
        <p>
          <a href="${inviteLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; box-shadow: 2px 2px 6px rgba(0,0,0,0.2);">
            Set Your Password
          </a>
        </p>
        <p>Or copy and paste this link in your browser:</p>
        <p style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${inviteLink}</p>
        <p style="color: red;">This link will expire in 24 hours.</p>
        <p>Best regards,<br><strong>Roomie Team</strong></p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email, name, resetToken) {
  const baseUrl = await getBaseUrl();
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: "Roomie - Password Reset Request",
    text: `Hello ${name},\n\nWe received a request to reset your password. Click the following link to set a new password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nRoomie Team`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #E53E3E;">Password Reset Request</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; background-color: #E53E3E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; box-shadow: 2px 2px 6px rgba(0,0,0,0.2);">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link in your browser:</p>
        <p style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${resetLink}</p>
        <p style="color: red;">This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br><strong>Roomie Team</strong></p>
      </div>
    `,
  });
}