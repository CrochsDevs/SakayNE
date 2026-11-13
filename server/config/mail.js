import nodemailer from "nodemailer";
import { HttpError } from '../shared/errors.js';

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail({ to, subject, html }) {
  let transporter;
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
  try {
    if (!['smtp', 'brevo'].includes(provider)) {
      throw Object.assign(new Error('Unsupported email provider'), { code: 'MAIL_CONFIG_INVALID' });
    }
    if (provider === 'brevo') {
      if (!process.env.BREVO_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) {
        throw Object.assign(new Error('Missing email configuration'), { code: 'MAIL_CONFIG_MISSING' });
      }
      // HTTPS works independently of SMTP port availability. Never retry an
      // ambiguous send automatically: the provider may already have queued it.
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY.trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: (process.env.APP_NAME || 'Sakay').replace(/SakayNE/g, 'Sakay'), email: process.env.EMAIL_FROM.trim() },
          to: [{ email: to }], subject, htmlContent: html,
        }),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) {
        // Provider responses can contain addresses or other private data.
        await response.body?.cancel();
        throw Object.assign(new Error('Email provider rejected request'), { code: 'MAIL_HTTP_REJECTED', responseCode: response.status });
      }
      const result = await response.json();
      if (typeof result.messageId !== 'string' || !result.messageId.trim()) {
        throw Object.assign(new Error('Email not accepted'), { code: 'MAIL_NOT_ACCEPTED' });
      }
      return { accepted: [to], messageId: result.messageId };
    }
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw Object.assign(new Error('Missing email configuration'), { code: 'MAIL_CONFIG_MISSING' });
    }
    transporter = createTransporter();
    const result = await transporter.sendMail({
      from: { name: (process.env.APP_NAME || 'Sakay').replace(/SakayNE/g, 'Sakay'), address: process.env.SMTP_USER },
      to: { address: to },
      subject,
      html,
    });
    if (!result.accepted?.length) throw Object.assign(new Error('Recipient not accepted'), { code: 'MAIL_NOT_ACCEPTED' });
    return result;
  } catch (error) {
    // Do not log recipient addresses, OTPs, SMTP responses, credentials or raw exceptions.
    const known = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND', 'EENVELOPE', 'ESOCKET', 'EHOSTUNREACH', 'MAIL_CONFIG_MISSING', 'MAIL_CONFIG_INVALID', 'MAIL_NOT_ACCEPTED', 'MAIL_HTTP_REJECTED'];
    const code = error.name === 'TimeoutError' ? 'ETIMEDOUT' : known.includes(error.code) ? error.code : 'MAIL_PROVIDER_ERROR';
    const details = { provider: ['smtp', 'brevo'].includes(provider) ? provider : 'invalid', code, ...(Number.isInteger(error.responseCode) ? { responseCode: error.responseCode } : {}) };
    console.error('Mail delivery failed', details);
    const unavailable = new HttpError(503, 'Email delivery is temporarily unavailable. Please try again later.');
    unavailable.code = 'EMAIL_DELIVERY_UNAVAILABLE';
    unavailable.cause = error;
    throw unavailable;
  } finally { transporter?.close(); }
}
