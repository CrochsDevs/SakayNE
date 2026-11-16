const baseStyle = `
  <style>
    * { font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; padding: 0; background: #f5f5f5; }
  </style>
`;

export function verifyEmailTemplate({ otp }) {
  return renderOtpEmail({ otp, title: 'Verify your email', description: 'Enter this code in Sakay to complete your account registration.', label: 'VERIFICATION CODE' });
}

export function otpTemplate({ otp }) {
  return renderOtpEmail({ otp, title: 'Your verification code', description: 'Enter this code in Sakay to continue.', label: 'ONE-TIME CODE' });
}

export function passwordResetTemplate({ otp }) {
  return renderOtpEmail({ otp, title: 'Reset your password', description: 'Enter this code in Sakay to choose a new password.', label: 'PASSWORD RESET CODE' });
}

function renderOtpEmail({ otp, title, description, label }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${baseStyle}</head>
<body style="margin:0;padding:32px 14px;background:#F3F6F4;color:#153B32;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px"><tr><td align="center" style="padding:2px 20px 18px">
      <span style="display:inline-block;color:#167047;font-size:25px;line-height:31px;font-weight:800;letter-spacing:2px">SAKAY</span>
      <div style="margin-top:3px;color:#6F8177;font-size:10px;line-height:15px;letter-spacing:1.5px">YOUR RIDE, MADE EASIER</div>
    </td></tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E3EAE6;border-radius:16px;overflow:hidden">
      <tr><td align="center" style="padding:34px 28px 36px">
        <h1 style="margin:0 0 10px;color:#153B32;font-size:25px;line-height:32px;font-weight:700">${title}</h1>
        <p style="margin:0 0 26px;color:#64746D;font-size:15px;line-height:23px">${description}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F1F7F3;border:1px solid #DCEBE1;border-radius:12px">
          <tr><td align="center" style="padding:21px 16px 20px">
            <p style="margin:0 0 11px;color:#347A53;font-size:11px;line-height:16px;font-weight:700;letter-spacing:2px">${label}</p>
            <div style="display:inline-block;padding:8px 16px;background:#FFFFFF;border:1px solid #D5E4DA;border-radius:8px;color:#153B32;font-family:'Courier New',Courier,monospace;font-size:34px;line-height:42px;font-weight:700;letter-spacing:8px">${otp}</div>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;color:#77857E;font-size:13px;line-height:20px">This code expires in <strong style="color:#347A53">5 minutes</strong>.</p>
        <p style="margin:16px 0 0;color:#88948E;font-size:12px;line-height:18px">If you didn’t request this code, you can safely ignore this email.</p>
      </td></tr>
      <tr><td align="center" style="padding:16px 20px;background:#F8FAF9;border-top:1px solid #E7ECE9">
        <p style="margin:0;color:#8A9690;font-size:11px;line-height:17px">&copy; ${year} Sakay</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
