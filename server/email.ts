import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'trackerzpoint@gmail.com',
    pass: 'gwtakwcwhppsnagz'
  }
});

export async function sendInviteEmail(email: string, name: string, inviteToken: string) {
  const inviteLink = `${process.env.APP_URL || 'http://localhost:5000'}/set-password?token=${inviteToken}`;

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