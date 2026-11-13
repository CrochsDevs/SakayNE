import { sendError, requireValue } from '../../shared/errors.js';
import { BUS_SERVICE_ENABLED, BUS_COMING_SOON } from '../../../client/src/data/service-availability.mjs';
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
    const pending = await findPending(email);
    if (!pending) return res.status(400).json({ error: 'No pending registration found' });
    requireValue(!(pending.data?.role === 'driver' && pending.data?.vehicleType === 'bus' && !BUS_SERVICE_ENABLED), BUS_COMING_SOON, 409);

    const otp = generateOTP();
    await OTPModel.saveOTP(email, otp);
    await sendEmail({
      to: email,
      subject: "Your Sakay OTP Code",
      html: otpTemplate({ otp }),
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    sendError(res, err);
  }
}

// Both public verification URLs must create the account atomically. Checking
// and deleting the code alone would leave the user unable to register or log in.
export { verifyEmail as verifyOTP } from '../auth/auth.controller.js';
