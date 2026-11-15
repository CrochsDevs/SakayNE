import { HttpError } from '../shared/errors.js';

export async function sendEmail({ to, subject, html }) {
  try {
    if (!process.env.BREVO_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) {
      throw Object.assign(new Error('Missing email configuration'), { code: 'MAIL_CONFIG_MISSING' });
    }
    // Never retry an ambiguous send automatically: the provider may already have queued it.
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
  } catch (error) {
    // Do not log recipient addresses, OTPs, provider responses, credentials or raw exceptions.
    const known = ['ETIMEDOUT', 'MAIL_CONFIG_MISSING', 'MAIL_NOT_ACCEPTED', 'MAIL_HTTP_REJECTED'];
    const code = error.name === 'TimeoutError' ? 'ETIMEDOUT' : known.includes(error.code) ? error.code : 'MAIL_PROVIDER_ERROR';
    const details = { provider: 'brevo', code, ...(Number.isInteger(error.responseCode) ? { responseCode: error.responseCode } : {}) };
    console.error('Mail delivery failed', details);
    const unavailable = new HttpError(503, 'Email delivery is temporarily unavailable. Please try again later.');
    unavailable.code = 'EMAIL_DELIVERY_UNAVAILABLE';
    unavailable.cause = error;
    throw unavailable;
  }
}
