import { sendError } from '../../shared/errors.js';
import { getDB } from "../../config/db.js";
import { ObjectId } from "../../shared/id.js";

export async function getNotifications(req, res) {
  try {
    const email = req.headers["user-email"];
    if (!email) return res.status(400).json({ error: "Email required" });

    const notifs = await getDB().collection("notifications")
      .find({ email })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const unread = notifs.filter((n) => !n.read).length;

    res.json({ notifications: notifs, unread });
  } catch (err) {
    sendError(res, err);
  }
}

export async function markRead(req, res) {
  try {
    const { email, notificationId } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const filter = { email };
    if (notificationId) {
      if (!ObjectId.isValid(notificationId)) return res.status(400).json({ error: 'Invalid notification ID' });
      filter._id = new ObjectId(notificationId);
    }

    await getDB().collection("notifications").updateMany(filter, { $set: { read: true } });

    res.json({ message: "Marked as read" });
  } catch (err) {
    sendError(res, err);
  }
}

export async function getSettings(req, res) {
  try {
    const email = req.headers["user-email"];
    if (!email) return res.status(400).json({ error: "Email required" });
    const settings = await getDB().collection("notification_settings").findOne({ email });
    res.json({ push: settings?.push ?? true, email: settings?.emailEnabled ?? true, sms: settings?.sms ?? false, promo: settings?.promo ?? true });
  } catch (err) {
    sendError(res, err);
  }
}

export async function updateSettings(req, res) {
  try {
    const email = req.auth.email;
    const { push, emailEnabled, sms, promo } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    await getDB().collection("notification_settings").updateOne(
      { email },
      { $set: { push: !!push, emailEnabled: !!emailEnabled, sms: !!sms, promo: !!promo, updatedAt: new Date().toISOString() } },
      { upsert: true },
    );
    res.json({ message: "Settings updated" });
  } catch (err) {
    sendError(res, err);
  }
}
