import { getDB } from "../../config/db.js";

const collection = () => getDB().collection("otps");

export async function saveOTP(email, otp, purpose = 'registration') {
  await collection().deleteMany({ email });
  return collection().insertOne({
    email,
    otp,
    purpose,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
}

export async function findOTP(email, otp, purpose = 'registration') {
  return collection().findOne({
    email,
    otp,
    purpose,
    expiresAt: { $gt: new Date() },
  });
}

export async function deleteOTP(email) {
  return collection().deleteMany({ email });
}
