import { mock } from 'node:test';

// In-process Brevo inbox for tests. No email is sent to an external service.
export async function startTestMail() {
  const messages = [];
  const realFetch = globalThis.fetch;
  const mocked = mock.method(globalThis, 'fetch', async (url, options) => {
    if (url !== 'https://api.brevo.com/v3/smtp/email') return realFetch(url, options);
    if (options?.headers?.['api-key'] !== 'local-mail-fixture') throw new Error('Unexpected test email credentials');
    const message = JSON.parse(options.body);
    messages.push(message.htmlContent);
    return Response.json({ messageId: `local-message-${messages.length}` }, { status: 201 });
  });
  return {
    messages,
    environment: { BREVO_API_KEY: 'local-mail-fixture', EMAIL_FROM: 'sender@example.test', APP_NAME: 'Sakay' },
    close: async () => { mocked.mock.restore(); },
  };
}
