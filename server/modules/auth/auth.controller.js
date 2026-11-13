import { getDB, transaction } from "../../config/db.js";
import { sendEmail } from "../../config/mail.js";
import { verifyEmailTemplate } from "../../config/email-template.js";
import { ROLES } from "../../shared/roles.js";
import * as AuthModel from "./auth.model.js";
import * as UserModel from "../users/users.model.js";
import * as OTPModel from "../otp/otp.model.js";
import bcrypt from "bcrypt";
import { randomInt } from 'node:crypto';
import { createSession } from '../../shared/session.js';
import { uploadImage, validateImage } from '../../config/cloudinary.js';
import { requireValue, sendError } from '../../shared/errors.js';

const validPassword = value => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(value);

function generateOTP() {
  return randomInt(100000, 1000000).toString();
}

export async function signup(req, res) {
  try {
    const { fullName, phone, password, role = 'passenger' } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!validEmail(email) || typeof fullName !== 'string' || !fullName.trim() || fullName.length > 150 || typeof phone !== 'string' || !phone.trim() || phone.length > 30 || !validPassword(password))
      return res.status(400).json({ error: 'Name, valid email, phone and a password of 8 characters to 72 UTF-8 bytes are required' });
    if (!['passenger', 'driver'].includes(role)) return res.status(400).json({ error: 'Invalid registration role' });
    if (role === 'driver' && (![req.body.licenseNo, req.body.plateNo].every(value => typeof value === 'string' && value.trim() && value.length <= 100) || !['bus', 'jeepney'].includes(req.body.vehicleType)))
      return res.status(400).json({ error: 'Driver license, plate number and vehicle type are required' });

    const existing = await AuthModel.findByEmail(email);
    if (existing)
      return res.status(400).json({ error: "Email already registered" });

    const otp = generateOTP();

    const hashedPassword = await bcrypt.hash(password, 10);

    const application = {};
    for (const key of ['address', 'licenseExpiry', 'color', 'seatingCapacity', 'franchiseNo', 'cpc', 'operatorName', 'route', 'companyName', 'contactPerson', 'contactNumber', 'dob']) {
      if (typeof req.body[key] === 'string') application[key] = req.body[key].slice(0, 250);
    }
    const documents = {};
    for (const key of ['licenseFront', 'licenseBack', 'vehicleReg', 'selfie']) {
      const doc = req.body.documents?.[key];
      if (doc !== undefined) {
        requireValue(doc && typeof doc.base64 === 'string' && doc.base64.length < 2500000 && ['image/jpeg', 'image/png', 'image/webp'].includes(doc.mimeType), 'Invalid registration document');
        validateImage(doc.base64, doc.mimeType);
        documents[key] = { base64: doc.base64, mimeType: doc.mimeType };
      }
    }
    await AuthModel.savePending(email, { fullName, email, phone, password: hashedPassword, role, licenseNo: req.body.licenseNo, plateNo: req.body.plateNo, vehicleType: req.body.vehicleType, vehicleModel: req.body.vehicleModel, application, documents });
    await OTPModel.saveOTP(email, otp);

    await sendEmail({
      to: email,
      subject: "Verify your Sakay account",
      html: verifyEmailTemplate({ otp }),
    });

    res.json({ message: "OTP sent to email", email });
  } catch (err) {
    sendError(res, err);
  }
}

export async function verifyEmail(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp } = req.body;
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter a six-digit verification code' });

    const existing = await AuthModel.findByEmail(email);
    if (existing?.verified) return res.status(409).json({ code: 'ACCOUNT_ALREADY_VERIFIED', error: 'Your email is already verified. Sign in with the password you created.' });

    const valid = await OTPModel.findOTP(email, otp);
    if (!valid) return res.status(400).json({ error: "Invalid or expired OTP" });

    const pending = await AuthModel.findPending(email);
    if (!pending) return res.status(400).json({ error: "No pending registration" });
    if (await AuthModel.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' });

    const { fullName, phone, password, role, licenseNo, plateNo, vehicleType, vehicleModel, application, documents } = pending.data;
    const validRole = ROLES[role?.toUpperCase()] || ROLES.PASSENGER;
    const documentUrls = {};
    if (validRole === 'driver') {
      const uploads = await Promise.all(Object.entries(documents || {}).map(async ([key, doc]) =>
        [key, await uploadImage(doc.base64, doc.mimeType, true)]));
      Object.assign(documentUrls, Object.fromEntries(uploads));
    }

    await transaction(async (db, session) => {
      const options = { session }, createdAt = new Date().toISOString();
      requireValue(await db.collection('otps').findOne({ _id: valid._id, expiresAt: { $gt: new Date() } }, options), 'Verification code expired during registration');
      requireValue(await db.collection('pending_users').findOne({ _id: pending._id }, options), 'Registration was replaced. Use the latest code');
      await db.collection('auth').insertOne({ email, password, role: validRole, verified: true, createdAt }, options);
      await db.collection('users').insertOne({ fullName, email, phone, createdAt }, options);
      if (validRole === 'driver') await db.collection('drivers').updateOne({ email }, { $set: {
        fullName, email, phone, licenseNo, plateNo, vehicleType, vehicleModel, application, documents: documentUrls,
        reservedSeats: 0, isAvailable: false, verified: false, approvalStatus: 'pending', rating: 0, totalTrips: 0, createdAt,
      } }, { ...options, upsert: true });
      await db.collection('pending_users').deleteOne({ _id: pending._id }, options);
      await db.collection('otps').deleteOne({ _id: valid._id }, options);
    });

    res.json({ message: "Account created successfully", email });
  } catch (err) {
    sendError(res, err);
  }
}

export async function login(req, res) {
  try {
    const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
    const { password } = req.body;
    if (!identifier || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required' });

    let loginEmail = identifier;
    if (!identifier.includes('@')) {
      const profiles = await getDB().collection('users').find({ phone: identifier }).limit(2).toArray();
      if (profiles.length !== 1) return res.status(401).json({ error: 'Use your email address to sign in' });
      loginEmail = profiles[0].email;
    }
    const authRecord = await AuthModel.findByEmail(loginEmail);
    if (!authRecord) return res.status(401).json({ error: "Invalid credentials" });

    let passValid = false;
    if (authRecord.password.startsWith("$2")) {
      passValid = await bcrypt.compare(password, authRecord.password);
    } else {
      passValid = password === authRecord.password;
      if (passValid) {
        const hashed = await bcrypt.hash(password, 10);
        await getDB().collection("auth").updateOne({ _id: authRecord._id }, { $set: { password: hashed } });
      }
    }

    if (!passValid) return res.status(401).json({ error: "Invalid credentials" });

    let profile = await UserModel.findByEmail(authRecord.email);
    if (!profile) {
      profile = await UserModel.createProfile({ fullName: "", email: authRecord.email, phone: "" });
    }

    const notifCount = await getDB().collection("notifications").countDocuments({ email: authRecord.email });
    if (notifCount === 0) {
      const now = new Date();
      await getDB().collection("notifications").insertMany([
        { email: authRecord.email, type: "welcome", title: "Welcome to Sakay!", message: "We're excited to have you on board. Start riding today!", read: false, createdAt: now.toISOString() },
      ]);
    }

    let driverInfo = null;
    if (authRecord.role === 'driver') {
      driverInfo = await getDB().collection("drivers").findOne({ email: authRecord.email });
    }

    res.json({
      user: {
        _id: profile._id,
        email: authRecord.email,
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        role: authRecord.role,
        avatar: profile.avatar || "",
        verified: authRecord.role === 'driver' ? !!(driverInfo?.verified) : true,
        approvalStatus: driverInfo?.approvalStatus || (authRecord.role === 'driver' ? 'pending' : 'approved'),
      },
      token: await createSession(authRecord.email, authRecord.role),
    });
  } catch (err) {
    sendError(res, err);
  }
}

export async function forgotPassword(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    const authRecord = await AuthModel.findByEmail(email);
    if (!authRecord) return res.status(404).json({ error: "Email not registered" });

    const otp = generateOTP();
    await OTPModel.saveOTP(email, otp, 'reset');
    await sendEmail({
      to: email,
      subject: "Reset your Sakay password",
      html: `<div style="max-width:520px;margin:0 auto;font-family:sans-serif"><div style="background:#0D1F16;padding:32px;border-radius:16px 16px 0 0;text-align:center"><span style="font-size:24px;font-weight:900;color:#fff;letter-spacing:1px">SAKAY</span></div><div style="background:#fff;padding:40px 32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px"><h2 style="font-size:22px;font-weight:800;color:#0D1F16;margin:0 0 8px;text-align:center">Reset your password</h2><p style="font-size:14px;color:#6B7280;margin:0 0 32px;text-align:center">Use this code to reset your password:</p><div style="background:#F0F7F1;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px"><div style="font-size:42px;font-weight:900;color:#0D1F16;letter-spacing:12px;font-family:'Courier New',monospace">${otp}</div></div><p style="font-size:13px;color:#9CA3AF;text-align:center;margin:0">Expires in 5 minutes.</p></div></div>`,
    });

    res.json({ message: "OTP sent to email", email });
  } catch (err) {
    sendError(res, err);
  }
}

export async function resetPassword(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp, newPassword } = req.body;
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter a six-digit reset code' });
    if (!validPassword(newPassword)) return res.status(400).json({ error: 'Password must have at least 8 characters and at most 72 UTF-8 bytes' });
    if (await AuthModel.findPending(email)) return res.status(400).json({ error: 'Finish registration before resetting a password' });

    const valid = await OTPModel.findOTP(email, otp, 'reset');
    if (!valid) return res.status(400).json({ error: "Invalid or expired OTP" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await transaction(async (db, session) => {
      const options = { session };
      requireValue(await db.collection('otps').findOne({ _id: valid._id, expiresAt: { $gt: new Date() } }, options), 'Reset code already used or expired');
      await db.collection('auth').updateOne({ email }, { $set: { password: hashed } }, options);
      await db.collection('otps').deleteOne({ _id: valid._id }, options);
      await db.collection('sessions').deleteMany({ email }, options);
    });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    sendError(res, err);
  }
}

export async function changePassword(req, res) {
  try {
    const { email, currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string') return res.status(400).json({ error: 'Current password is required' });

    const authRecord = await AuthModel.findByEmail(email);
    if (!authRecord) return res.status(404).json({ error: "Account not found" });

    let curValid = false;
    if (authRecord.password.startsWith("$2")) {
      curValid = await bcrypt.compare(currentPassword, authRecord.password);
    } else {
      curValid = currentPassword === authRecord.password;
    }

    if (!curValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    if (!validPassword(newPassword)) {
      return res.status(400).json({ error: 'Password must have at least 8 characters and at most 72 UTF-8 bytes' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await getDB().collection("auth").updateOne({ email }, { $set: { password: hashed } });
    await getDB().collection('sessions').deleteMany({ email, tokenHash: { $ne: req.auth.tokenHash } });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    sendError(res, err);
  }
}
