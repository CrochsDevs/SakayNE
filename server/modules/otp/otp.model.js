import { getDB } from "../../config/db.js";

const collection = () => getDB().collection("otps");

export async function saveOTP(email, otp, purpose = 'registration') {
  await collection().deleteMany({ email });
  return collection().insertOne({
    email,
    otp,
    purpose,
    createdAt: new Date(),
    attempts: 0,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
}

export async function findOTP(email, otp, purpose = 'registration') {
  // One shared, atomic budget for both verification URLs, across IPs and processes.
  const record = await collection().findOneAndUpdate({
    email,
    purpose,
    expiresAt: { $gt: new Date() },
    $or: [{ attempts: { $lt: 5 } }, { attempts: { $exists: false } }],
  }, { $inc: { attempts: 1 } }, { returnDocument: 'before' });
  return record?.otp === otp ? record : null;
}

export async function deleteOTP(email) {
  return collection().deleteMany({ email });
}
