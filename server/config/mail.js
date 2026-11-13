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
  try {
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
    const known = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND', 'EENVELOPE', 'ESOCKET', 'EHOSTUNREACH', 'MAIL_CONFIG_MISSING', 'MAIL_NOT_ACCEPTED'];
    const details = { code: known.includes(error.code) ? error.code : 'MAIL_PROVIDER_ERROR', ...(Number.isInteger(error.responseCode) ? { responseCode: error.responseCode } : {}) };
    console.error('Mail delivery failed', details);
    const unavailable = new HttpError(503, 'Email delivery is temporarily unavailable. Please try again later.');
    unavailable.code = 'EMAIL_DELIVERY_UNAVAILABLE';
    unavailable.cause = error;
    throw unavailable;
  } finally { transporter?.close(); }
}
