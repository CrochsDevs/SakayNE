import dotenv from "dotenv";
import http from "http";
import { connectDB, closeDB } from "../config/db.js";
import app from "./app.js";
import { startReservationExpiry } from '../modules/rides/expiration.js';

dotenv.config();

const PORT = Number(process.env.PORT || 3010);

const startServer = async () => {
  try {
    if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error('PORT must be a number from 0 to 65535');
    await connectDB();
    console.log("✅ MongoDB connected successfully");

    const server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, '0.0.0.0', () => {
        server.off('error', reject);
        resolve();
      });
    });
    console.log(`🚀 Server running at http://0.0.0.0:${server.address().port}`);
    const stopExpiry = startReservationExpiry();
    server.once('close', stopExpiry);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? `Cannot start Sakay: port ${PORT} is already in use. Stop the existing API process with Ctrl+C in its terminal before running npm start again.`
      : `Server startup failed: ${error.message}`);
    await closeDB();
    process.exitCode = 1;
  }
};

startServer();
