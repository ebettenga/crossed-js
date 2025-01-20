import { render } from "jsx-email";
import nodemailer from "nodemailer";
import { config } from "../config/config";
import { Template as ResetPasswordTemplate } from "../emails/ResetPassword";

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass,
      },
    });
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html: body,
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  }

  async sendPasswordResetEmail(
    to: string,
    username: string,
    resetToken: string,
  ): Promise<void> {
    try {
      const resetLink = `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/reset-password?token=${resetToken}`;
      const emailHtml = await render(
        ResetPasswordTemplate({ username, resetLink }),
      );

      await this.sendEmail(
        to,
        "Reset Your Password",
        emailHtml,
      );
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
