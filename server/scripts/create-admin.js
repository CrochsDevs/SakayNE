import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { connectDB, closeDB, transaction } from '../config/db.js';
dotenv.config();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters)');
try {
  const db = await connectDB();
  if (await db.collection('auth').findOne({ email })) throw new Error('Account already exists. No account was changed.');
  const hashed = await bcrypt.hash(password, 12);
  await transaction(async (database, session) => {
    await database.collection('auth').insertOne({ email, password: hashed, role: 'admin', verified: true, createdAt: new Date().toISOString() }, { session });
    await database.collection('users').insertOne({ email, fullName: 'SakayNE Administrator', phone: '', createdAt: new Date().toISOString() }, { session });
  });
  console.log('Admin created. Sign in to review driver applications.');
} finally { await closeDB(); }
