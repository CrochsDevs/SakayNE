import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// A server-only deployment must not depend on files outside its root directory.
const logoPath = fileURLToPath(new URL('../assets/email-logo.png', import.meta.url));

let logoDataUri = null;
let logoLoaded = false;

function getLogo() {
  if (!logoLoaded) {
    try {
      const img = readFileSync(logoPath);
      logoDataUri = "data:image/png;base64," + img.toString("base64");
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    logoLoaded = true;
  }
  return logoDataUri;
}

const baseStyle = `
  <style>
    * { font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; padding: 0; background: #f5f5f5; }
  </style>
`;

export function verifyEmailTemplate({ otp }) {
  const logo = getLogo();
  return `<!DOCTYPE html>
<html>${baseStyle}
<body style="margin:0;padding:32px 16px;background:#f5f5f5">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#0D1F16;padding:32px;text-align:center">
      ${logo ? `<img src="${logo}" alt="Sakay" style="width:56px;height:56px" />` : '<span style="color:#fff;font-size:24px;font-weight:900">SAKAY</span>'}
    </div>
    <div style="padding:32px 28px">
      <h2 style="font-size:22px;font-weight:800;color:#0D1F16;margin:0 0 8px;text-align:center">Verify your email</h2>
      <p style="font-size:14px;color:#6B7280;margin:0 0 28px;text-align:center;line-height:22px">Use the code below to complete your account registration.</p>
      <div style="background:#F0F7F1;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="font-size:12px;color:#3F8451;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:2px">Verification Code</p>
        <div style="font-size:40px;font-weight:900;color:#0D1F16;letter-spacing:10px;font-family:'Courier New',monospace;text-align:center">${otp}</div>
      </div>
      <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0">Expires in <strong style="color:#3F8451">5 minutes</strong></p>
    </div>
    <div style="background:#F9FAFB;padding:20px;text-align:center;border-top:1px solid #E5E7EB">
      <p style="font-size:11px;color:#9CA3AF;margin:0">&copy; ${new Date().getFullYear()} Sakay</p>
    </div>
  </div>
</body></html>`;
}

export function otpTemplate({ otp }) {
  const logo = getLogo();
  return `<!DOCTYPE html>
<html>${baseStyle}
<body style="margin:0;padding:32px 16px;background:#f5f5f5">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#0D1F16;padding:32px;text-align:center">
      ${logo ? `<img src="${logo}" alt="Sakay" style="width:56px;height:56px" />` : '<span style="color:#fff;font-size:24px;font-weight:900">SAKAY</span>'}
    </div>
    <div style="padding:32px 28px">
      <h2 style="font-size:22px;font-weight:800;color:#0D1F16;margin:0 0 8px;text-align:center">Your OTP Code</h2>
      <p style="font-size:14px;color:#6B7280;margin:0 0 28px;text-align:center;line-height:22px">Use the code below to complete your verification.</p>
      <div style="background:#F0F7F1;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="font-size:12px;color:#3F8451;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:2px">OTP Code</p>
        <div style="font-size:40px;font-weight:900;color:#0D1F16;letter-spacing:10px;font-family:'Courier New',monospace;text-align:center">${otp}</div>
      </div>
      <p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0">Expires in <strong style="color:#3F8451">5 minutes</strong></p>
    </div>
    <div style="background:#F9FAFB;padding:20px;text-align:center;border-top:1px solid #E5E7EB">
      <p style="font-size:11px;color:#9CA3AF;margin:0">&copy; ${new Date().getFullYear()} Sakay</p>
    </div>
  </div>
</body></html>`;
}
