import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, otp: string, type: "verify" | "reset" | "login") {
  const subjects: Record<string, string> = {
    verify: "Thyleads — Verify Your Email",
    reset: "Thyleads — Reset Your Password",
    login: "Thyleads — Login Verification Code",
  };
  const headings: Record<string, string> = {
    verify: "Verify Your Email",
    reset: "Reset Your Password",
    login: "Login Verification",
  };
  const descriptions: Record<string, string> = {
    verify: "Enter this code to complete your registration",
    reset: "Enter this code to reset your password",
    login: "Enter this code to verify your login",
  };
  const subject = subjects[type];

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8f9fa; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6800FF; font-size: 24px; margin: 0;">Thyleads</h1>
      </div>
      <div style="background: white; border-radius: 12px; padding: 32px; text-align: center;">
        <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">
          ${headings[type]}
        </h2>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 24px;">
          ${descriptions[type]}
        </p>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 0 auto; display: inline-block;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6800FF; font-family: monospace;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0;">
          This code expires in 10 minutes. Do not share it with anyone.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Thyleads" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}
