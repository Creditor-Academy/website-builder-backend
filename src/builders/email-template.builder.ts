const APP_NAME = process.env.APP_NAME || 'Buildora';
const YEAR = new Date().getFullYear();

const baseLayout = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${YEAR} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Password Reset ───────────────────────────────────────────────────────────

export const generatePasswordResetEmailHTML = (userName: string, resetUrl: string) => {
    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">Reset your password</h2>
      <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">Hi ${userName},</p>
      <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Reset Password</a>
      </div>
      <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">This link will expire in <strong>1 hour</strong>.</p>
      <p style="margin:0;color:#9ca3af;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;color:#9ca3af;font-size:12px;">If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
      </p>
    `);
};

export const generatePasswordResetEmailText = (userName: string, resetUrl: string) => {
    return `Hi ${userName},

We received a request to reset your ${APP_NAME} password.

Reset your password by visiting: ${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

© ${YEAR} ${APP_NAME}. All rights reserved.`;
};

// ─── Email Verification ───────────────────────────────────────────────────────

export const generateVerificationEmailHTML = (userName: string, verificationUrl: string) => {
    return baseLayout(`
      <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">Verify your email</h2>
      <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">Hi ${userName},</p>
      <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">Thanks for signing up! Please verify your email address by clicking the button below.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${verificationUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Verify Email</a>
      </div>
      <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">This link will expire in <strong>24 hours</strong>.</p>
      <p style="margin:0;color:#9ca3af;font-size:13px;">If you didn't create an account, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;color:#9ca3af;font-size:12px;">If the button doesn't work, copy and paste this link into your browser:<br/>
        <a href="${verificationUrl}" style="color:#6366f1;word-break:break-all;">${verificationUrl}</a>
      </p>
    `);
};

export const generateVerificationEmailText = (userName: string, verificationUrl: string) => {
    return `Hi ${userName},

Thanks for signing up for ${APP_NAME}!

Verify your email by visiting: ${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

© ${YEAR} ${APP_NAME}. All rights reserved.`;
};