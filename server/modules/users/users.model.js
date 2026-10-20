import { ObjectId } from "../../shared/id.js";
import { getDB } from "../../config/db.js";

const users = () => getDB().collection("users");

export async function findByEmail(email) {
  return users().findOne({ email });
}

export async function findById(id) {
  return users().findOne({ _id: new ObjectId(id) });
}

export async function createProfile({ fullName, email, phone }) {
  // Concurrent first logins for a legacy account must share one profile.
  try {
    await users().updateOne({ email }, { $setOnInsert: {
      fullName, email, phone, createdAt: new Date().toISOString(),
    } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    // A simultaneous upsert may win the unique-email race.
    const existing = await findByEmail(email);
    if (existing) return existing;
    throw error;
  }
  return findByEmail(email);
}

export async function updateByEmail(email, data) {
  return users().updateOne({ email }, { $set: data });
}
