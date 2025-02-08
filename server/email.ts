import nodemailer from 'nodemailer';
import ngrok from 'ngrok';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'trackerzpoint@gmail.com',
    pass: 'gwtakwcwhppsnagz'
  }
});

async function getBaseUrl() {
  let baseUrl = 'http://localhost:5000';
  try {
    const tunnelUrl = await ngrok.getUrl();
    if (tunnelUrl) {
      baseUrl = tunnelUrl;
    }
  } catch (error) {
    console.warn('Could not get ngrok URL, using localhost');
  }
  return baseUrl;
}

export async function sendInviteEmail(email: string, name: string, inviteToken: string) {
  const baseUrl = await getBaseUrl();
  const inviteLink = `${baseUrl}/set-password?token=${inviteToken}`;

  try {
    const info = await transporter.sendMail({
      from: '"RoomieBuddy" <trackerzpoint@gmail.com>',
      to: email,
      subject: "Welcome to RoomieBuddy - Set Your Password",
      text: `Hello ${name},\n\nYou've been invited to join RoomieBuddy. Click the following link to set your password and activate your account:\n\n${inviteLink}\n\nThis link will expire in 24 hours.\n\nBest regards,\nRoomieBuddy Team`,
      html: `
        <h2>Welcome to RoomieBuddy</h2>
        <p>Hello ${name},</p>
        <p>You've been invited to join RoomieBuddy. Click the button below to set your password and activate your account:</p>
        <p>
          <a href="${inviteLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Set Your Password
          </a>
        </p>
        <p>Or copy and paste this link in your browser:</p>
        <p>${inviteLink}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>RoomieBuddy Team</p>
      `,
    });

    console.log('Email sent successfully:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, name: string, resetToken: string) {
  const baseUrl = await getBaseUrl();
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  try {
    const info = await transporter.sendMail({
      from: '"RoomieBuddy" <trackerzpoint@gmail.com>',
      to: email,
      subject: "RoomieBuddy - Password Reset Request",
      text: `Hello ${name},\n\nWe received a request to reset your password. Click the following link to set a new password:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nRoomieBuddy Team`,
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetLink}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>RoomieBuddy Team</p>
      `,
    });

    console.log('Password reset email sent successfully:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}