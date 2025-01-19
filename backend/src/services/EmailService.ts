import nodemailer from 'nodemailer';
import { config } from '../config/config';

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
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
