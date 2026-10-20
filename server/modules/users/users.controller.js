import * as UserModel from "./users.model.js";
import { getDB } from "../../config/db.js";
import { uploadImage } from "../../config/cloudinary.js";

export async function getProfile(req, res) {
  try {
    const userId = req.headers["user-id"];
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.headers["user-id"];
    const { fullName, phone } = req.body;
    if (typeof fullName !== 'string' || !fullName.trim() || typeof phone !== 'string' || !phone.trim()) return res.status(400).json({ error: 'Name and phone are required' });

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    await UserModel.updateByEmail(user.email, { fullName, phone });
    await getDB().collection('drivers').updateOne({ email: user.email }, { $set: { fullName, phone } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function uploadAvatar(req, res) {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    const url = await uploadImage(image, mimeType);

    const userId = req.headers["user-id"];
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    await UserModel.updateByEmail(user.email, { avatar: url });

    res.json({ avatar: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
