import { getDB, transaction } from '../../config/db.js';
import { requireValue } from '../../shared/errors.js';
const dateKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const rewards = [0.1,0.2,0.3,0.4,0.5,0.6,1];
const daysBetween = (a,b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
async function award(db, session, email, amount, reason) {
 await db.collection('tokens').updateOne({ email }, { $inc: { balance: amount, lifetime: amount } }, { upsert: true, session });
 await db.collection('token_history').insertOne({ email, amount, reason, type: 'earned', createdAt: new Date().toISOString() }, { session });
}
const respond = fn => async (req,res) => { try { await fn(req,res); } catch(e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Unable to update rewards' }); } };
export const getBalance = respond(async(req,res) => { const doc = await getDB().collection('tokens').findOne({ email: req.auth.email }); res.json({ tokens: doc?.balance || 0, lifetime: doc?.lifetime || 0 }); });
export const getHistory = respond(async(req,res) => { res.json({ history: await getDB().collection('token_history').find({ email: req.auth.email }).sort({ createdAt: -1 }).limit(100).toArray() }); });
export const addTokens = (req,res) => res.status(403).json({ error: 'Rewards can only be granted by verified server actions' });
export const getCompletedTasks = respond(async(req,res) => {
 const email = req.auth.email;
 const [doc, rides, rate] = await Promise.all([getDB().collection('completed_tasks').findOne({ email }), getDB().collection('rides').countDocuments({ passengerEmail: email, status: 'completed' }), getDB().collection('rides').countDocuments({ passengerEmail: email, rating: { $gte: 1 } })]);
 res.json({ ...(doc?.tasks || {}), counts: { rides, rate } });
});
export const completeTask = respond(async(req,res) => {
 const email = req.auth.email, task = req.body.task;
 requireValue(['rides','rate'].includes(task), 'This reward is not available');
 await transaction(async(db,session) => {
  const options = { session };
  const doc = await db.collection('completed_tasks').findOne({ email }, options);
  requireValue(!doc?.tasks?.[task], 'Reward already claimed', 409);
  const query = task === 'rides' ? { passengerEmail: email, status: 'completed' } : { passengerEmail: email, rating: { $gte: 1 } };
  requireValue(await db.collection('rides').countDocuments(query, options) >= 10, 'Complete 10 qualifying rides or ratings first');
  await db.collection('completed_tasks').updateOne({ email }, { $set: { ['tasks.' + task]: true } }, { ...options, upsert: true });
  await award(db,session,email,1,task === 'rides' ? 'Complete 10 rides' : 'Rate 10 drivers');
 });
 res.json({ success: true });
});
export const claimDaily = respond(async(req,res) => {
 const email = req.auth.email, day = req.body.day, today = dateKey();
 requireValue(Number.isInteger(day) && day >= 0 && day < 7, 'Invalid daily reward');
 await transaction(async(db,session) => {
  const options = { session };
  const streak = await db.collection('streaks').findOne({ email }, options);
  requireValue(streak?.lastClaimDate !== today, 'Already claimed today. Come back tomorrow!', 409);
  const previousDay = streak && daysBetween(today,streak.lastClaimDate) === 1 ? streak.currentDay : -1;
  const expected = (previousDay + 1) % 7;
  requireValue(day === expected, 'Claim Day ' + (expected + 1) + ' next');
  await db.collection('streaks').updateOne({ email }, { $set: { currentDay: day, lastClaimDate: today } }, { ...options, upsert: true });
  await db.collection('daily_claims').updateOne({ email, date: today }, { $set: { ['days.' + day]: true } }, { ...options, upsert: true });
  await award(db,session,email,rewards[day],'Daily check-in bonus');
 });
 res.json({ success: true, currentDay: day, amount: rewards[day] });
});
export const getDailyClaims = respond(async(req,res) => {
 const email = req.auth.email, today = dateKey();
 const streak = await getDB().collection('streaks').findOne({ email });
 let currentDay = streak?.currentDay ?? -1;
 if (streak && daysBetween(today,streak.lastClaimDate) > 1) currentDay = -1;
 const claimedToday = streak?.lastClaimDate === today;
 res.json({ days: claimedToday ? { [currentDay]: true } : {}, currentDay, streakActive: currentDay >= 0, claimedToday, nextDay: claimedToday ? null : (currentDay + 1) % 7 });
});
