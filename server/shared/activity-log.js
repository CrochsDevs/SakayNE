import { randomUUID } from 'node:crypto';

const actions = [
  ['POST', /^\/api\/auth\/signup$/, 'auth.signup'],
  ['POST', /^\/api\/(?:auth\/verify-email|otp\/verify)$/, 'auth.verify_email'],
  ['POST', /^\/api\/auth\/login$/, 'auth.signin'],
  ['POST', /^\/api\/auth\/forgot-password$/, 'auth.forgot_password'],
  ['POST', /^\/api\/auth\/reset-password$/, 'auth.reset_password'],
  ['POST', /^\/api\/auth\/change-password$/, 'auth.change_password'],
  ['POST', /^\/api\/auth\/logout$/, 'auth.signout'],
  ['POST', /^\/api\/otp\/send$/, 'auth.resend_otp'],
  ['POST', /^\/api\/rides$/, 'booking.create'],
  ['PATCH', /^\/api\/rides\/[a-f\d]{24}\/status$/i, 'booking.update_status'],
  ['POST', /^\/api\/rides\/[a-f\d]{24}\/rating$/i, 'booking.rate'],
  ['POST', /^\/api\/reports$/, 'report.create'],
  ['PATCH', /^\/api\/admin\/reports\/[a-f\d]{24}$/i, 'report.review'],
  ['PUT', /^\/api\/drivers\/availability$/, 'driver.availability'],
  ['PATCH', /^\/api\/admin\/drivers\/[a-f\d]{24}$/i, 'driver.review'],
];

// Log only allowlisted metadata. Never log bodies, query strings, headers,
// email addresses, credentials, OTPs, precise locations or complaint content.
export function activityLog(req, res, next) {
  const action = actions.find(([method, pattern]) => method === req.method && pattern.test(req.path.replace(/\/$/, '')))?.[2];
  if (!action) return next(); // Frequent GPS, heartbeat and polling calls stay quiet.
  const started = performance.now(), requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  let logged = false;
  const record = aborted => {
    if (logged) return;
    logged = true;
    const status = aborted ? 499 : res.statusCode;
    const entry = { timestamp: new Date().toISOString(), type: 'activity', level: status >= 500 ? 'error' : status >= 400 ? 'warning' : 'info',
      action, requestId, method: req.method, status, outcome: aborted ? 'aborted' : status >= 500 ? 'failed' : status >= 400 ? 'rejected' : 'succeeded',
      durationMs: Math.round(performance.now() - started),
      ...(req.auth ? { actorId: req.auth.userId, role: req.auth.role } : {}),
    };
    const write = status >= 500 ? console.error : status >= 400 ? console.warn : console.info;
    write(JSON.stringify(entry));
  };
  res.once('finish', () => record(false));
  res.once('close', () => { if (!res.writableFinished) record(true); });
  next();
}
