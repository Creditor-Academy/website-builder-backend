import { Resend } from 'resend';
import {
  generatePasswordResetEmailHTML,
  generateVerificationEmailHTML,
  generatePasswordResetEmailText,
  generateVerificationEmailText,
  generateWelcomeEmailHTML,
  generateWelcomeEmailText,
} from "../builders/email-template.builder.js";

const APP_NAME = process.env.APP_NAME || 'Buildora';

class EmailService {
  private resend: Resend | null = null;
  private fromAddress: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromAddress = process.env.EMAIL_FROM || `${APP_NAME} <noreply@buildora.app>`;

    if (apiKey) {
      this.resend = new Resend(apiKey);
      console.log('[EmailService] Resend configured successfully');
    } else {
      console.warn('[EmailService] RESEND_API_KEY not set — emails will be logged to console only');
    }
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.resend) {
      console.log(`[EmailService][DEV] Email to ${to}:`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Body: ${text || html}`);
      return true;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
        ...(text ? { text } : {}),
      });

      if (error) {
        console.error('[EmailService] Failed to send email:', error);
        return false;
      }

      console.log(`[EmailService] Email sent to ${to} (id: ${data?.id})`);
      return true;
    } catch (err) {
      console.error('[EmailService] Error sending email:', err);
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, userName: string, resetToken: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = `Reset your ${APP_NAME} password`;

    const html = generatePasswordResetEmailHTML(userName, resetUrl);
    const text = generatePasswordResetEmailText(userName, resetUrl);

    return await this.sendEmail(to, subject, html, text);
  }

  async sendVerificationEmail(to: string, userName: string, verificationToken: string) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const subject = `Verify your ${APP_NAME} email`;

    const html = generateVerificationEmailHTML(userName, verificationUrl);
    const text = generateVerificationEmailText(userName, verificationUrl);

    return await this.sendEmail(to, subject, html, text);
  }

  async sendWelcomeEmail(to: string, userName: string) {
    const loginUrl = `${process.env.FRONTEND_URL}/login`;
    const subject = `Welcome to ${APP_NAME}!`;

    const html = generateWelcomeEmailHTML(userName, loginUrl);
    const text = generateWelcomeEmailText(userName, loginUrl);

    return await this.sendEmail(to, subject, html, text);
  }
}

export default new EmailService();