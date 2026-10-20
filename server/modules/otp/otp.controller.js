import { sendEmail } from "../../config/mail.js";
import { otpTemplate } from "../../config/email-template.js";
import * as OTPModel from "./otp.model.js";
import { randomInt } from 'node:crypto';
import { findPending } from '../auth/auth.model.js';

function generateOTP() {
  return randomInt(100000, 1000000).toString();
}

export async function sendOTP(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });
    if (!await findPending(email)) return res.status(400).json({ error: 'No pending registration found' });

    const otp = generateOTP();
    await OTPModel.saveOTP(email, otp);
    await sendEmail({
      to: email,
      subject: "Your SakayNE OTP Code",
      html: otpTemplate({ otp }),
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Both public verification URLs must create the account atomically. Checking
// and deleting the code alone would leave the user unable to register or log in.
export { verifyEmail as verifyOTP } from '../auth/auth.controller.js';
