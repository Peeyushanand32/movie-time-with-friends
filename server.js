import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { google } from 'googleapis';
import { db } from './database.js';
import crypto from 'crypto';
import Razorpay from 'razorpay';

// Simple .env file loader for local development
if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      // Ignore comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return;
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (err) {
    console.error("Error parsing local .env file:", err);
  }
}

// Initialize Razorpay Instance
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log("====================================================");
  console.log("[Razorpay] Client initialized successfully.");
  console.log("====================================================");
} else {
  console.log("====================================================");
  console.log("[Razorpay] Missing RAZORPAY_KEY_ID/SECRET env vars.");
  console.log("====================================================");
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const UPLOAD_DIR = path.resolve('public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Initialize Google Drive Client (Service Account JWT)
let driveClient = null;

let gdClientEmail = process.env.GD_CLIENT_EMAIL;
let gdPrivateKey = process.env.GD_PRIVATE_KEY;

// If env variables are missing, check for a local service account JSON file in the root
if (!gdClientEmail || !gdPrivateKey) {
  try {
    const files = fs.readdirSync(path.resolve('.'));
    const keyFile = files.find(f => f.endsWith('.json') && f.startsWith('movie-'));
    if (keyFile) {
      const keyData = JSON.parse(fs.readFileSync(path.resolve(keyFile), 'utf8'));
      if (keyData.type === 'service_account') {
        gdClientEmail = keyData.client_email;
        gdPrivateKey = keyData.private_key;
        console.log(`[Google Drive] Found local credentials file: ${keyFile}`);
      }
    }
  } catch (err) {
    console.error("[Google Drive] Error scanning for local credentials file:", err);
  }
}

if (gdClientEmail && gdPrivateKey) {
  try {
    const auth = new google.auth.JWT({
      email: gdClientEmail,
      key: gdPrivateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    driveClient = google.drive({ version: 'v3', auth });
    console.log("====================================================");
    console.log("[Google Drive] Initialized client successfully.");
    console.log("====================================================");
  } catch (err) {
    console.error("[Google Drive] Failed to initialize API client:", err);
  }
} else {
  console.log("====================================================");
  console.log("[Google Drive] Client email or Private key missing.");
  console.log("[Google Drive] Falling back to local storage.");
  console.log("====================================================");
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${Date.now()}-${basename}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // limit to 500MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

app.use(express.json());
app.use(express.static(path.resolve('public')));

// Helper to resolve third-party video sharing links (Archive.org and Google Drive) into streamable formats
async function resolveVideoUrl(url) {
  if (!url) return url;
  const trimmedUrl = url.trim();
  try {
    const urlObj = new URL(trimmedUrl);
    
    // 1. Google Drive Link Resolver
    if (urlObj.hostname.includes('drive.google.com') && urlObj.pathname.includes('/file/d/')) {
      const parts = urlObj.pathname.split('/');
      const dIdx = parts.indexOf('d');
      if (dIdx !== -1 && parts[dIdx + 1]) {
        const fileId = parts[dIdx + 1];
        const newUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        console.log(`[Auto-Resolver] Converted Google Drive URL to direct stream: ${newUrl}`);
        return newUrl;
      }
    }
    
    // 2. Archive.org Link Resolver
    if (urlObj.hostname.includes('archive.org') && urlObj.pathname.includes('/details/')) {
      const parts = urlObj.pathname.split('/');
      const detailsIdx = parts.indexOf('details');
      if (detailsIdx !== -1 && parts[detailsIdx + 1]) {
        const identifier = parts[detailsIdx + 1];
        console.log(`[Auto-Resolver] Resolving Archive.org metadata for: ${identifier}`);
        // Fetch metadata from Archive.org API
        const response = await fetch(`https://archive.org/metadata/${identifier}`);
        if (response.ok) {
          const data = await response.json();
          // Find the first video file (.mp4, .webm or .mkv)
          const videoFile = data.files?.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.endsWith('.mkv'));
          if (videoFile) {
            const newUrl = `https://archive.org/download/${identifier}/${videoFile.name}`;
            console.log(`[Auto-Resolver] Converted Archive.org URL to direct stream: ${newUrl}`);
            return newUrl;
          }
        }
      }
    }
  } catch (e) {
    console.error("[Auto-Resolver] Failed to resolve video URL:", e);
  }
  return trimmedUrl;
}

// Predefined high-quality avatars from Movie Partner designs
const AVATARS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD4EI8_vyQW7UERp6LoH-hQHDh8uKCs3uhrq8qn0VzXXoF6-nkVpfiSWqtl6V7ngOuHv4s2nctk4tvMMU9DoVtlEPUqci5nmXeAWxgT28IkXri8R8QmF8EoDMndU5K9Ttnr-IVH0_PJIVARsLym-IA3lZ3aujA_L0LjxZg7DoGt6BolVWHZ3-rns3txN6q-Y2imJPSBXrCKcMxrnW_eNkIVB5Sq_Xld85_vxEfb39NGFPJzJENeYGe3Yxp0w3X2wPBAcmdHQy529Ec",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCoYvXafi5wyc_3ATntE40fEyFXEK3bdne_A2GoJnOHPqT5OZp0C3zLAo6UxUlsjHVlp84CtC6s1T-Dhn2pBSv_3Mw8pI4Hfzh74beiw11oA8c-51pEe7Cu75zJ-Dzptzd4qXGGeB8syc8Wv8Py67cUiD1_bXwEQtkUHfKS_Zp6fzZdVI9AdqtNdNw4h-zn7BDqzj98Cq78MCMkHlOz0sjmD5saYbCqqhfBz1I1uwVzU89r1RrmMxsATdFjh3o0jkOLWnWYNE18IWw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCOGeDeBt3aCnIDKOg8vGoq1gpXZg-jdWhjCy6oh6lx5hqzkJ3QFPI8TlIYElK5Ohi2PcprkfQywvUd3bj7O1vtCMkEBq8I0u72wr6eHXUs5aWkglqnuIFA03bDzn1aNfrtn529Vejcz4eDwftxMBfw0aI4WtQ933PF3XG2KZ5CdbwIZe_aYXzc_a0sQNRDgPIxvyvTaet-nI8pX-0oQ_gfMNNzeiTrh-GTpAq8YfjfZjIgGJohnmtmkLwg-4scA1RMsFVMMYnovYo",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuASKkMapRyV0Z1JNUyM8NmXNdnacasqJ5cVtews_MczqnK_B5_MJNTGu2tTpJE1NoclBtESr08FR_w9eDKaWS_Pgkv7X-IRfPmeyaSLQT6KvhnMYZ-vE3ACpDAu8-JrgDQUKkfIKLws9kCOTq7RE960u8wfpjZvj2ZQ3i8mmji056_uI-vlM9olN35kZZKf7ngTkff2e_xzIirDYV4X-O_BCltQjBMEXaKKHYqdxTKPgiv0sxpDSVnJF44gTdnU9NPI4Un2m1iMZfc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuARSv-n4QVue6mrjE6_0b4nSTwyfNm3BW2Au-tACtuspQjlwM7loj3ayeUmjEdKoYlmEFo5zOs-ZsYwk7RQuq8mzoNOTZueg-Vxh842EcfPfDZCztnvWW2_qJmDbG_h-t6NcXEQklmBUqTVDx5v_uVjZbEN4oquSTehkHSb-gJRcA0n-SlhfpqACk1X15uaIhd6qh1kK0wYUKvfR576N638Sv5MdrOYptWDb_J-GHxbnB5J5cEcH8zLssdj5EpaBDHq-7GYwNtf5UU",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDFwyNQlnxKAGb6c4LhZlQGO1p9rowO6kkSIhnBqqNd8OiJXN08BhzxI91DqldJt-QJ5vaxYtXHeQwhEW9Da4oMjCL0eXTr_MZjsgQjZ6NI-7rLVI9xOz9S9SEAarNtFA4uISub1qOBt0zRROJy6goQpcmZB0hhUTU7aAYrRUMWosUTrCVvBaEvrfRfCw0-9h67RjXNuNMbjdv8KrMZwWyfXuqbMmupFUkTOOVwBxf3ur9oxVK0fwKZ3yCAWvH5StmApkeYtQHGnHI",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCIgzHlWOlCnL5L2wDfnM1ITcENEYusuxUNny12zmXo82yUuAJN5cXfxVihFNa5WXBTDkLkxRfkrvxdJ9sy8d94OQPInXf3qppHChjI8A0DuEwxBXg_-b5dDlyYzaZ0N_y5yAsGpgFdfHQkWeoItcCo8gHPaXO2BxjrC54YtbtYYgdhk_h3ow55komGN_ZIf7VjCQU8bt9v4_IlreX2Ve0_pVlsv51XD5cnFiYFr6xWbEbF9_zQW6BNWrYmgU_ahmCQyijadzD7NXE",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCfljgZ2mhvuOeaO7C23Hg8yFZ0ar_JxL-0l8xq0L_vRvaVGK3PhL01H6zyb00tEtsN2In77Qfh7HBRNdYxfPVdXgaLyKYLO5olo1Q--0h0xZLe0yvCXUZi335gQwxmcRBnBVcCw2vDki-CTrgLy_hlP5I2yI185Ik5SKvIYQilrxOuYbvlcSPpDjI3iYxTOZx7JYvSIyzCEDlo4vgN8Vij2CvVa25Y3ceja2ezefsBpMT84uptRb_pzJUgaW0i3bGFylO4lTH4yoA",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBm3FHd90wOmqmbKS6SebvwmM6vHN_m_5I2ZrQ0n2vmw1JII0nP4w5TVCZGTWFTZKNSPwKGDeR8FrlNotQaQS-qTFGXs_8QgdexmEXyw4sJxJ0KXsx0hydwRrY7S7b7YoJHtt3P1E-WQlb9x3MtpTyhLwMuSb1nP-pHV9wfaebiqkO6yIXsFqGrW9ti2a0XFmbu436jbJgpNYLvfXUs3YCNcrGgVbs-I3hVyPq5OpU3hHsXZ1uHkMWr42DGN_2N7IKkL8BamSLRolk",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBAJEDlGLfun_Qt-h-pMMETs2wI9IbFOHw9NlTS2qhnE5r_9VNPvVFGqdl4mOpaokBt_dSZaEXuyo9qNo_Gsq9kF0XLd2s-b7NGBHuxQjcQs5gwFptI2ilw3C8-PphOPIDWjrCzzoymIxcSjxTt38KQ0DwQuZtTboI-da8fU5Hr9d0oFfYyhFzzXhPz26pcepXNwGuhUK3WKUuHXFUL_NTriOW2K2sWqfeOZYa7pEgT93HNiMabu9buEvu5cQqmTPMqwFDbAXUM51o",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAqXzSlsB8UYdOm-qKnIkif9GRXhglhOppdD1OgwvvmCK76umnafL32ifkpxi8OL-b4xaDBCqXg5crZcYsvzai3bAVb9_UJhb7WbWHmMK9Shp_eRNBBppeM2uHlXLzvZq1hqatHpHlfLagSSO43YXuNTX2Ijv4Yf0TsIX5XzlXtxfPbtIi4ZU40cQTspaPWjdaVtHAygfg-jzFt2fMc8WrY41e_-RL3FvE7XVWShTP3IQE9VO3uVfxLOK2MOGi6QN5gNCNhnsV3zPo",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCbipjTAKSdgsy_MdvI4PCBcNaXLDiyPemMxzM1aeWlVQmTcB8urMrkqL6O5lxEd5Rti8dr9fDhAXfowqvKZ13Iw0i2eiSwxrQ9lbGrVF74sIISMnOWq8NcHd2PEOsmwPFz-xjs9YsFKUCBS7uaZQXwXc1ga3qiFUOrWn-6YLttJwY-SapxKr8rXIJDv1RSScVjibqbIMelTeBNKE2gvKBy-krearn4wpYmtnjEKeXYDxuAHGfsI3MKl8Uwfap3n9qckfY-Y1RO15c"
];

// Helper to get default usernames
const DEFAULT_NAMES = ["StellarGamer", "CyberWanderer", "NeonSpectator", "LofiCoder", "OrbitWatcher", "CosmicCurator", "SolarVibe", "VoidPulse"];

// Helper to verify if user has active paid subscription
function isSubscriptionActive(user) {
  if (!user) return false;
  if (user.tier === 'free') return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt) > new Date();
}

// Helper to check if free user is blocked (exceeded 1-hour trial limit)
function isUserBlocked(user) {
  if (!user) return true;
  if (isSubscriptionActive(user)) return false;
  return (user.accumulatedTime || 0) >= 3600;
}

// API Endpoint to check session / initialize user
app.get('/api/user/session', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId || uuidv4();
  let user = db.getUser(userId);
  if (!user) {
    const randomName = DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)] + "_" + Math.floor(100 + Math.random() * 900);
    const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    user = db.saveUser(userId, {
      name: randomName,
      avatarUrl: randomAvatar,
      tier: 'free',
      accumulatedTime: 0,
      subscriptionExpiresAt: null,
      createdAt: new Date().toISOString()
    });
  }
  res.json(user);
});

// API Endpoint for trial heartbeat (invoked every 30 seconds)
app.post('/api/user/heartbeat', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { isWatching } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: "Missing x-user-id header" });
  }
  let user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User session not found" });
  }

  const activeSub = isSubscriptionActive(user);
  if (!activeSub && isWatching) {
    const currentAccumulated = user.accumulatedTime || 0;
    user = db.saveUser(userId, {
      accumulatedTime: currentAccumulated + 30
    });
  }

  const blocked = isUserBlocked(user);

  // If user just got blocked, notify their active socket connection in rooms
  if (blocked) {
    for (const roomId in roomConnections) {
      for (const socketId in roomConnections[roomId]) {
        if (roomConnections[roomId][socketId].userId === userId) {
          io.to(socketId).emit('trial-expired');
        }
      }
    }
  }

  const { passwordHash, salt, ...safeUser } = user;
  res.json({
    accumulatedTime: safeUser.accumulatedTime,
    tier: safeUser.tier,
    subscriptionExpiresAt: safeUser.subscriptionExpiresAt,
    isBlocked: blocked,
    user: safeUser
  });
});

// API Endpoint to process mock subscription purchases (1d, 15d, 1m, 3m, 6m, 12m)
// API Endpoint to process subscription cancellation
app.post('/api/user/subscription', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { tier } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing x-user-id header" });
  }
  const user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User session not found" });
  }

  if (tier !== 'free') {
    return res.status(400).json({ error: "Upgrades must go through payment gateway verification." });
  }

  const updatedUser = db.saveUser(userId, {
    tier: 'free',
    subscriptionExpiresAt: null
  });

  const { passwordHash, salt, ...safeUser } = updatedUser;

  res.json({
    success: true,
    message: "Subscription cancelled.",
    user: safeUser
  });
});

const pricesMap = {
  premium: {
    '1d': 39,
    '15d': 79,
    '1m': 179,
    '3m': 479,
    '6m': 889,
    '12m': 1499
  },
  ultimate: {
    '1d': 49,
    '15d': 99,
    '1m': 199,
    '3m': 499,
    '6m': 900,
    '12m': 1600
  }
};

// Razorpay Payments: Create Order
app.post('/api/payment/create-order', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { tier, duration } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing x-user-id header" });
  }
  const user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User session not found" });
  }

  if (!['premium', 'ultimate'].includes(tier)) {
    return res.status(400).json({ error: "Invalid subscription tier for purchase" });
  }
  if (!['1d', '15d', '1m', '3m', '6m', '12m'].includes(duration)) {
    return res.status(400).json({ error: "Invalid duration" });
  }

  const priceInRs = pricesMap[tier]?.[duration];
  if (!priceInRs) {
    return res.status(400).json({ error: "Invalid tier or duration for pricing" });
  }
  const amount = priceInRs * 100; // in paise
  const currency = 'INR';

  // Check if we are running in Simulator Mode (unconfigured Razorpay client)
  if (!razorpay) {
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    console.log(`[Payment] Creating Simulated Order: ${mockOrderId}`);
    return res.json({
      id: mockOrderId,
      currency,
      amount,
      isMock: true,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key'
    });
  }

  try {
    const options = {
      amount: amount,
      currency: currency,
      receipt: `rcpt_${userId.replace('usr_', '')}_${Date.now().toString().slice(-5)}`,
      notes: {
        website_name: "Movie Partner"
      }
    };

    const order = await razorpay.orders.create(options);
    console.log(`[Payment] Razorpay Order Created: ${order.id}`);
    res.json({
      id: order.id,
      currency: order.currency,
      amount: order.amount,
      isMock: false,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('[Payment Create Order Catch Error]:', err);
    res.status(400).json({
      error: 'Razorpay failed to create payment order: ' + (err.description || err.message)
    });
  }
});

// Razorpay Payments: Verify Signature and Activate Subscription
app.post('/api/payment/verify-payment', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, tier, duration } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing x-user-id header" });
  }
  const user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User session not found" });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment details for verification.' });
  }

  let isValid = false;
  
  // Verify mock payment signature
  if (razorpay_order_id.startsWith('order_mock_') && razorpay_payment_id.startsWith('pay_mock_')) {
    console.log('[Payment] Verifying Mock Payment for order:', razorpay_order_id);
    isValid = true;
  } else if (razorpay) {
    // Verify real signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');
    isValid = generated_signature === razorpay_signature;
  }

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid signature. Payment verification failed.' });
  }

  // Calculate expiration date
  const daysMap = {
    '1d': 1,
    '15d': 15,
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '12m': 365
  };
  const days = daysMap[duration] || 30;
  const expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const updatedUser = db.saveUser(userId, {
    tier: tier,
    subscriptionExpiresAt: expirationDate
  });

  const { passwordHash, salt, ...safeUser } = updatedUser;

  console.log(`[Payment] Success! User ${safeUser.name} upgraded to ${tier} until ${expirationDate}`);

  res.json({
    success: true,
    message: `Successfully subscribed to ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan!`,
    user: safeUser
  });
});

// API Endpoints for Authentication (Signup / Login)
app.post('/api/auth/signup', (req, res) => {
  const { username, password, avatarUrl } = req.body;
  const tempUserId = req.headers['x-user-id'] || uuidv4();

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const defaultAvatar = avatarUrl || AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const newUser = db.registerUser(tempUserId, username, password, defaultAvatar);
    const { passwordHash, salt, ...safeUser } = newUser;
    res.status(201).json({ success: true, user: safeUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const safeUser = db.verifyUser(username, password);
  if (safeUser) {
    res.json({ success: true, user: safeUser });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

// API Endpoints for Google Sign-In
app.get('/api/auth/google/config', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.post('/api/auth/google', async (req, res) => {
  const { credential, isDemo } = req.body;
  const tempUserId = req.headers['x-user-id'] || uuidv4();

  if (!credential) {
    return res.status(400).json({ error: "Google credential token is required" });
  }

  try {
    let email, name, picture, googleId;

    const currentClientId = process.env.GOOGLE_CLIENT_ID;
    const isMockMode = isDemo || !currentClientId || currentClientId.startsWith('your-');

    if (isMockMode) {
      const tokenParts = credential.split('.');
      if (tokenParts.length < 2) {
        throw new Error("Invalid token format");
      }
      const decodedPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      email = decodedPayload.email;
      name = decodedPayload.name;
      picture = decodedPayload.picture;
      googleId = decodedPayload.sub;
    } else {
      const client = new google.auth.OAuth2(currentClientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: currentClientId
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      googleId = payload.sub;
    }

    if (!googleId) {
      throw new Error("Failed to retrieve Google ID from token");
    }

    let user = db.getUserByGoogleId(googleId);

    if (!user) {
      user = db.registerGoogleUser(tempUserId, googleId, email, name, picture);
    }

    const { passwordHash, salt, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error("[Google Auth Error]", err);
    res.status(400).json({ error: err.message || "Failed to authenticate with Google" });
  }
});

// API Endpoint to update user profile
app.post('/api/user/profile', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { name, avatarUrl } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing x-user-id header" });
  }
  let user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User session not found" });
  }
  user = db.saveUser(userId, {
    name: name || user.name,
    avatarUrl: avatarUrl || user.avatarUrl
  });
  res.json(user);
});

// API Endpoint to handle direct video uploads
app.post('/api/upload', upload.single('video'), async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(401).json({ error: "Missing x-user-id header. Unauthorized." });
  }

  const user = db.getUser(userId);
  if (!user) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(404).json({ error: "User session not found." });
  }

  // Check trial expiration
  if (isUserBlocked(user)) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(403).json({ error: "Subscription required. Your 1-hour free trial has ended." });
  }

  // Check tier permissions
  if (user.tier === 'free') {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(403).json({ error: "Free tier users cannot upload video files. Please upgrade to Premium or Ultimate!" });
  }

  if (req.file) {
    const fileSize = req.file.size;
    if (user.tier === 'premium' && fileSize > 200 * 1024 * 1024) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({ error: "Premium tier users can upload files up to 200MB. Please upgrade to Ultimate for larger uploads!" });
    }
  }

  if (!req.file) {
    return res.status(400).json({ error: "No video file was uploaded or file type is invalid" });
  }

  const localPath = req.file.path;
  const filename = req.file.filename;

  // Check if Google Drive client is configured and active
  if (driveClient) {
    try {
      console.log(`[Google Drive] Uploading file to Google Drive: ${filename}`);

      const fileMetadata = {
        name: filename,
        parents: process.env.GD_FOLDER_ID ? [process.env.GD_FOLDER_ID] : []
      };

      const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(localPath)
      };

      // 1. Upload file to Google Drive
      const file = await driveClient.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
      });

      const fileId = file.data.id;
      console.log(`[Google Drive] File uploaded successfully. File ID: ${fileId}`);

      // 2. Set public sharing permission to "Anyone with the link can view"
      await driveClient.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      console.log(`[Google Drive] Public reader permission applied to: ${fileId}`);

      // 3. Clean up the temporary local file on the server
      try {
        fs.unlinkSync(localPath);
        console.log(`[Google Drive] Cleaned up temporary local file: ${filename}`);
      } catch (unlinkErr) {
        console.error(`[Google Drive] Warning: Failed to clean up temp file:`, unlinkErr);
      }

      // 4. Return direct download/streaming Google Drive link
      const fileUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      res.json({ success: true, fileUrl });
      return;
    } catch (err) {
      console.error("[Google Drive] Upload failed. Falling back to local storage:", err);
      // Fallback: Continue execution and return local static file link below
    }
  }

  // Fallback / Standard local storage return
  const fileUrl = `/uploads/${filename}`;
  res.json({ success: true, fileUrl });
});

// API Endpoint to check Google Drive Connection status
app.get('/api/drive-check', async (req, res) => {
  const status = {
    envEmailSet: !!process.env.GD_CLIENT_EMAIL,
    envKeySet: !!process.env.GD_PRIVATE_KEY,
    driveClientInitialized: !!driveClient,
    localKeyFileExists: false,
    error: null,
    driveListTest: null
  };

  try {
    const files = fs.readdirSync(path.resolve('.'));
    status.localKeyFileExists = files.some(f => f.endsWith('.json') && f.startsWith('movie-'));
  } catch (e) {
    status.localKeyFileExistsError = e.message;
  }

  if (driveClient) {
    try {
      const driveRes = await driveClient.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
      });
      status.driveListTest = "Success! Found " + (driveRes.data.files ? driveRes.data.files.length : 0) + " files.";
    } catch (err) {
      status.error = err.message;
    }
  } else {
    status.error = "Drive client is not initialized.";
  }

  res.json(status);
});

// API Endpoint to list rooms
app.get('/api/rooms', (req, res) => {
  const rooms = db.getRooms().map(room => {
    const { passcode, ...rest } = room;
    return {
      ...rest,
      isPrivate: !!passcode
    };
  });
  res.json(rooms);
});

// API Endpoint to create a room
app.post('/api/rooms', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { title, videoUrl, category, passcode } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing x-user-id header" });
  }
  const user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User profile not found" });
  }

  // Check trial expiration
  if (isUserBlocked(user)) {
    return res.status(403).json({ error: "Subscription required. Your 1-hour free trial has ended." });
  }

  // Check passcode permission (Premium/Ultimate only)
  if (passcode && passcode.trim() && user.tier === 'free') {
    return res.status(403).json({ error: "Creating passcode-protected private rooms is a Premium/Ultimate feature. Please upgrade your subscription!" });
  }
  
  if (!title || !videoUrl) {
    return res.status(400).json({ error: "Title and Video URL are required" });
  }

  const roomId = uuidv4();
  const resolvedUrl = await resolveVideoUrl(videoUrl);
  const newRoom = db.saveRoom(roomId, {
    title,
    videoUrl: resolvedUrl,
    category: category || "General",
    hostId: userId,
    hostName: user.name,
    createdAt: new Date().toISOString(),
    userCount: 0,
    passcode: passcode ? passcode.trim() : null,
    queue: [],
    bannedUsers: []
  });

  const { passcode: _, ...roomWithoutPasscode } = newRoom;
  res.json({
    ...roomWithoutPasscode,
    isPrivate: !!newRoom.passcode
  });
});

// API Endpoint to get single room details
app.get('/api/rooms/:id', (req, res) => {
  const room = db.getRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  const { passcode, ...rest } = room;
  res.json({
    ...rest,
    isPrivate: !!passcode
  });
});

// API Endpoint to delete a room
app.delete('/api/rooms/:id', (req, res) => {
  const userId = req.headers['x-user-id'];
  const roomId = req.params.id;

  if (!userId) {
    return res.status(400).json({ error: "Missing x-user-id header" });
  }

  const room = db.getRoom(roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  if (roomId === 'featured-interstellar') {
    return res.status(400).json({ error: "Featured room cannot be deleted" });
  }

  if (room.hostId !== userId) {
    return res.status(403).json({ error: "Only the host can delete this room" });
  }

  db.deleteRoom(roomId);

  if (room.videoUrl && room.videoUrl.startsWith('/uploads/')) {
    deleteFileImmediately(room.videoUrl);
  }

  io.to(roomId).emit('room-deleted', { roomId });

  res.json({ success: true, message: "Room deleted successfully." });
});

// API Endpoint to verify room passcode
app.post('/api/rooms/:id/verify', (req, res) => {
  const room = db.getRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  const { passcode } = req.body;
  if (room.passcode === passcode) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Incorrect passcode" });
  }
});

// Real-time tracking of active socket connections in rooms
const roomConnections = {}; // { roomId: { socketId: { userId, name, avatarUrl, isHost, isMuted } } }

// Active deletion timers: { roomId: { timer: Timeout, fileUrl: String } }
const activeDeletionTimers = {};

// Function to schedule movie file deletion
function scheduleDeletion(roomId, fileUrl, duration, currentTime = 0) {
  // Clear any existing deletion timer for this room
  cancelDeletion(roomId);

  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;

  const filename = path.basename(fileUrl);
  const filepath = path.join(UPLOAD_DIR, filename);

  const remainingTime = Math.max(0, duration - currentTime);
  const delayMs = (remainingTime + 30 * 60) * 1000;

  console.log(`[Auto-Delete] Scheduling deletion of ${filename} in ${(delayMs / 1000 / 60).toFixed(1)} minutes (Remaining: ${(remainingTime / 60).toFixed(1)} mins + 30 mins).`);

  const timer = setTimeout(() => {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`[Auto-Delete] Successfully deleted completed movie file: ${filename}`);
      }
      delete activeDeletionTimers[roomId];
    } catch (err) {
      console.error(`[Auto-Delete] Error deleting file ${filename}:`, err);
    }
  }, delayMs);

  activeDeletionTimers[roomId] = {
    timer,
    fileUrl
  };
}

// Function to cancel active deletion timer
function cancelDeletion(roomId) {
  if (activeDeletionTimers[roomId]) {
    clearTimeout(activeDeletionTimers[roomId].timer);
    console.log(`[Auto-Delete] Cancelled deletion timer for room: ${roomId}`);
    delete activeDeletionTimers[roomId];
  }
}

// Function to delete the file immediately (e.g. when video changed or room destroyed)
function deleteFileImmediately(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  const filename = path.basename(fileUrl);
  const filepath = path.join(UPLOAD_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`[Auto-Delete] Deleted file immediately: ${filename}`);
    }
  } catch (err) {
    console.error(`[Auto-Delete] Error during immediate file deletion for ${filename}:`, err);
  }
}

// Fail-safe cleanup job running on startup and every 30 minutes
function runPeriodicCleanup() {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const now = Date.now();
    const expiryAge = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

    files.forEach(file => {
      if (file === '.gitkeep') return;
      const filepath = path.join(UPLOAD_DIR, file);
      const stat = fs.statSync(filepath);

      // If file is older than 4 hours, delete it
      if (now - stat.mtimeMs > expiryAge) {
        fs.unlinkSync(filepath);
        console.log(`[Fail-Safe Cleanup] Deleted stale upload file: ${file}`);
      }
    });
  } catch (err) {
    console.error("[Fail-Safe Cleanup] Error during periodic uploads cleanup:", err);
  }
}

// Run cleanup immediately on startup
runPeriodicCleanup();
// Run every 30 minutes
setInterval(runPeriodicCleanup, 30 * 60 * 1000);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  let currentRoomId = null;
  let currentUserId = null;

  socket.on('join-room', ({ roomId, userId, passcode }) => {
    // 1. Verify if user is banned
    if (db.isUserBanned(roomId, userId)) {
      socket.emit('error', 'You are banned from this room.');
      return;
    }

    currentRoomId = roomId;
    currentUserId = userId;

    const user = db.getUser(userId);
    if (!user) {
      socket.emit('error', 'User not found');
      return;
    }

    // Trial expiration check
    if (isUserBlocked(user)) {
      socket.emit('error', 'Subscription required. Your 1-hour free trial has ended.');
      socket.emit('trial-expired');
      return;
    }

    const room = db.getRoom(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    // Verify passcode if room is private
    if (room.passcode && room.passcode !== passcode) {
      socket.emit('error', 'Invalid passcode. Access denied.');
      return;
    }

    // Capacity limit check based on host's tier
    if (room.hostId && room.hostId !== 'system') {
      const hostUser = db.getUser(room.hostId);
      const activeCount = Object.keys(roomConnections[roomId] || {}).length;
      let limit = 5; // Default limit
      if (hostUser && isSubscriptionActive(hostUser)) {
        if (hostUser.tier === 'premium') limit = 15;
        if (hostUser.tier === 'ultimate') limit = Infinity;
      }
      if (activeCount >= limit) {
        socket.emit('error', `This room is at capacity based on the host's subscription plan. Limit: ${limit}.`);
        return;
      }
    }

    // Join room channel
    socket.join(roomId);

    // Track active user in memory
    if (!roomConnections[roomId]) {
      roomConnections[roomId] = {};
    }

    // If host or if room has no host, assign host role
    const isHost = room.hostId === userId || Object.keys(roomConnections[roomId]).length === 0;

    roomConnections[roomId][socket.id] = {
      userId,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isHost,
      isMuted: false
    };

    // Update database room occupant count
    const activeUsers = Object.entries(roomConnections[roomId]).map(([sid, info]) => ({
      socketId: sid,
      ...info
    }));
    db.saveRoom(roomId, { userCount: activeUsers.length });

    // Send chat history, current status, and current queue
    socket.emit('room-joined', {
      roomDetails: db.getRoom(roomId),
      isHost,
      chatHistory: room.messages || [],
      queue: room.queue || []
    });

    // Notify others in room
    io.to(roomId).emit('presence-update', activeUsers);
    
    // Broadcast message: user joined
    const systemMsg = {
      id: uuidv4(),
      userId: 'system',
      userName: 'System',
      avatarUrl: '',
      text: `${user.name} has joined the room.`,
      timestamp: new Date().toISOString()
    };
    db.addMessage(roomId, systemMsg);
    io.to(roomId).emit('chat-message', systemMsg);
  });

  // Handle Chat Message
  socket.on('chat-message', (text) => {
    if (!currentRoomId || !currentUserId) return;
    
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection) return;

    if (userConnection.isMuted) {
      socket.emit('error', 'You have been muted by the host.');
      return;
    }

    // Verify if user's trial expired mid-session
    const user = db.getUser(currentUserId);
    if (isUserBlocked(user)) {
      socket.emit('error', 'Subscription required. Your 1-hour free trial has ended.');
      socket.emit('trial-expired');
      return;
    }

    const newMsg = {
      id: uuidv4(),
      userId: currentUserId,
      userName: userConnection.name,
      avatarUrl: userConnection.avatarUrl,
      text,
      timestamp: new Date().toISOString()
    };

    db.addMessage(currentRoomId, newMsg);
    io.to(currentRoomId).emit('chat-message', newMsg);
  });

  // Handle Playback Controls (Host to viewers)
  socket.on('video-control', (event) => {
    // Event has { type: 'play'|'pause'|'seek', time: Number }
    if (!currentRoomId) return;

    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) {
      // Ignore control events from non-hosts to prevent tampering
      return;
    }

    // Broadcast play/pause/seek events to other viewers
    socket.to(currentRoomId).emit('video-state-change', event);

    // Dynamic Deletion Timer Scheduling
    const room = db.getRoom(currentRoomId);
    if (room && room.videoUrl && room.videoUrl.startsWith('/uploads/') && room.videoDuration) {
      if (event.type === 'play' || event.type === 'seek') {
        scheduleDeletion(currentRoomId, room.videoUrl, room.videoDuration, event.time);
      } else if (event.type === 'pause') {
        cancelDeletion(currentRoomId);
      }
    }
  });

  // Handle Dynamic Video Change (Host to viewers)
  socket.on('change-video', async ({ videoUrl }) => {
    if (!currentRoomId || !currentUserId) return;

    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) {
      return; // Only hosts can change the video
    }

    // If there was an old file deletion scheduled for this room, clear and delete the old file immediately
    const oldRoom = db.getRoom(currentRoomId);
    if (oldRoom && oldRoom.videoUrl && oldRoom.videoUrl.startsWith('/uploads/')) {
      cancelDeletion(currentRoomId);
      deleteFileImmediately(oldRoom.videoUrl);
    }

    const resolvedUrl = await resolveVideoUrl(videoUrl);
    db.saveRoom(currentRoomId, { videoUrl: resolvedUrl, videoDuration: null });
    io.to(currentRoomId).emit('video-changed', { videoUrl: resolvedUrl });

    const systemMsg = {
      id: uuidv4(),
      userId: 'system',
      userName: 'System',
      avatarUrl: '',
      text: `${userConnection.name} changed the video.`,
      timestamp: new Date().toISOString()
    };
    db.addMessage(currentRoomId, systemMsg);
    io.to(currentRoomId).emit('chat-message', systemMsg);
  });

  // Handle Video Duration Report for Auto-Deletion
  socket.on('report-duration', ({ duration }) => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) return;

    db.saveRoom(currentRoomId, { videoDuration: duration });
    console.log(`[Auto-Delete] Saved room ${currentRoomId} video duration: ${duration}s`);
  });

  // Handle Emoji Reactions
  socket.on('send-reaction', ({ reaction }) => {
    if (!currentRoomId) return;
    io.to(currentRoomId).emit('receive-reaction', { reaction });
  });

  // Request state from host (for newly joined clients)
  socket.on('request-sync', () => {
    if (!currentRoomId) return;

    // Find the host socket in this room
    const connections = roomConnections[currentRoomId] || {};
    const hostSocketId = Object.keys(connections).find(sid => connections[sid].isHost);
    
    if (hostSocketId && hostSocketId !== socket.id) {
      // Ask host socket to report its player state
      io.to(hostSocketId).emit('get-current-player-state', socket.id);
    }
  });

  // Host response to request-sync
  socket.on('host-player-state', ({ targetSocketId, time, isPlaying }) => {
    io.to(targetSocketId).emit('sync-to-state', { time, isPlaying });
  });

  // ==========================================
  // PLAYLIST QUEUE SOCKET HANDLERS
  // ==========================================
  socket.on('add-to-queue', async ({ videoUrl, title }) => {
    if (!currentRoomId || !currentUserId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection) return;

    const resolvedUrl = await resolveVideoUrl(videoUrl);
    const item = db.addQueueItem(currentRoomId, resolvedUrl, title, currentUserId, userConnection.name);
    if (item) {
      io.to(currentRoomId).emit('queue-updated', db.getQueue(currentRoomId));
      
      const systemMsg = {
        id: uuidv4(),
        userId: 'system',
        userName: 'System',
        avatarUrl: '',
        text: `${userConnection.name} added "${title}" to the queue.`,
        timestamp: new Date().toISOString()
      };
      db.addMessage(currentRoomId, systemMsg);
      io.to(currentRoomId).emit('chat-message', systemMsg);
    }
  });

  socket.on('remove-from-queue', ({ itemId }) => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection) return;

    const success = db.removeQueueItem(currentRoomId, itemId);
    if (success) {
      io.to(currentRoomId).emit('queue-updated', db.getQueue(currentRoomId));
    }
  });

  socket.on('clear-queue', () => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) return; // Only host can clear queue

    db.clearQueue(currentRoomId);
    io.to(currentRoomId).emit('queue-updated', []);
  });

  socket.on('play-next-video', ({ itemId }) => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) return;

    const queue = db.getQueue(currentRoomId);
    const item = queue.find(i => i.id === itemId);
    if (item) {
      // 1. Update active room URL
      db.saveRoom(currentRoomId, { videoUrl: item.videoUrl });
      // 2. Remove item from queue
      db.removeQueueItem(currentRoomId, itemId);
      
      // 3. Emit change to all clients
      io.to(currentRoomId).emit('video-changed', { videoUrl: item.videoUrl });
      io.to(currentRoomId).emit('queue-updated', db.getQueue(currentRoomId));

      const systemMsg = {
        id: uuidv4(),
        userId: 'system',
        userName: 'System',
        avatarUrl: '',
        text: `Playing next video: "${item.title}".`,
        timestamp: new Date().toISOString()
      };
      db.addMessage(currentRoomId, systemMsg);
      io.to(currentRoomId).emit('chat-message', systemMsg);
    }
  });

  // ==========================================
  // HOST MODERATION SOCKET HANDLERS
  // ==========================================
  socket.on('kick-user', ({ targetSocketId, targetUserId }) => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) return; // Host only

    const targetUser = roomConnections[currentRoomId]?.[targetSocketId];
    if (targetUser) {
      // Notify the target client they are kicked
      io.to(targetSocketId).emit('kicked-from-room', { reason: 'Kicked by the host' });
      
      // Force socket leave
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(currentRoomId);
      }

      // Cleanup target user connection info
      delete roomConnections[currentRoomId][targetSocketId];
      const activeUsers = Object.entries(roomConnections[currentRoomId]).map(([sid, info]) => ({
        socketId: sid,
        ...info
      }));
      db.saveRoom(currentRoomId, { userCount: activeUsers.length });

      // Notify others in room
      io.to(currentRoomId).emit('presence-update', activeUsers);

      const systemMsg = {
        id: uuidv4(),
        userId: 'system',
        userName: 'System',
        avatarUrl: '',
        text: `${targetUser.name} was kicked from the room by the host.`,
        timestamp: new Date().toISOString()
      };
      db.addMessage(currentRoomId, systemMsg);
      io.to(currentRoomId).emit('chat-message', systemMsg);
    }
  });

  socket.on('ban-user', ({ targetSocketId, targetUserId }) => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) return; // Host only

    const targetUser = roomConnections[currentRoomId]?.[targetSocketId];
    
    // Add to DB bans
    db.banUser(currentRoomId, targetUserId);

    if (targetUser) {
      io.to(targetSocketId).emit('kicked-from-room', { reason: 'Banned from the room by the host' });
      
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(currentRoomId);
      }

      delete roomConnections[currentRoomId][targetSocketId];
      const activeUsers = Object.entries(roomConnections[currentRoomId]).map(([sid, info]) => ({
        socketId: sid,
        ...info
      }));
      db.saveRoom(currentRoomId, { userCount: activeUsers.length });

      io.to(currentRoomId).emit('presence-update', activeUsers);

      const systemMsg = {
        id: uuidv4(),
        userId: 'system',
        userName: 'System',
        avatarUrl: '',
        text: `${targetUser.name} was banned from the room by the host.`,
        timestamp: new Date().toISOString()
      };
      db.addMessage(currentRoomId, systemMsg);
      io.to(currentRoomId).emit('chat-message', systemMsg);
    }
  });

  socket.on('mute-user', ({ targetSocketId, isMuted }) => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) return; // Host only

    const targetUser = roomConnections[currentRoomId]?.[targetSocketId];
    if (targetUser) {
      targetUser.isMuted = isMuted;

      // Update presence with mute status
      const activeUsers = Object.entries(roomConnections[currentRoomId]).map(([sid, info]) => ({
        socketId: sid,
        ...info
      }));
      io.to(currentRoomId).emit('presence-update', activeUsers);
      
      // Let target user know they are muted
      io.to(targetSocketId).emit('mute-status-changed', { isMuted });

      const systemMsg = {
        id: uuidv4(),
        userId: 'system',
        userName: 'System',
        avatarUrl: '',
        text: `${targetUser.name} has been ${isMuted ? 'muted' : 'unmuted'} by the host.`,
        timestamp: new Date().toISOString()
      };
      db.addMessage(currentRoomId, systemMsg);
      io.to(currentRoomId).emit('chat-message', systemMsg);
    }
  });

  // Handle WebRTC Call Presence
  socket.on('join-call', () => {
    if (!currentRoomId || !currentUserId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (userConnection) {
      userConnection.inCall = true;
      // Notify all other sockets in the room that this user joined the call
      socket.to(currentRoomId).emit('user-joined-call', {
        socketId: socket.id,
        userId: currentUserId,
        name: userConnection.name,
        avatarUrl: userConnection.avatarUrl
      });
    }
  });

  socket.on('leave-call', () => {
    if (!currentRoomId) return;
    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (userConnection) {
      userConnection.inCall = false;
      // Notify all other sockets in the room that this user left the call
      socket.to(currentRoomId).emit('user-left-call', {
        socketId: socket.id
      });
    }
  });

  // ==========================================
  // WEBRTC SIGNALING HANDLERS
  // ==========================================
  socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
    socket.to(targetSocketId).emit('webrtc-offer', {
      senderSocketId: socket.id,
      offer
    });
  });

  socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
    socket.to(targetSocketId).emit('webrtc-answer', {
      senderSocketId: socket.id,
      answer
    });
  });

  socket.on('webrtc-candidate', ({ targetSocketId, candidate }) => {
    socket.to(targetSocketId).emit('webrtc-candidate', {
      senderSocketId: socket.id,
      candidate
    });
  });

  // Handing socket disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    if (currentRoomId && roomConnections[currentRoomId]) {
      const leavingUser = roomConnections[currentRoomId][socket.id];
      if (leavingUser && leavingUser.inCall) {
        socket.to(currentRoomId).emit('user-left-call', {
          socketId: socket.id
        });
      }
      delete roomConnections[currentRoomId][socket.id];

      const activeUsers = Object.entries(roomConnections[currentRoomId]).map(([sid, info]) => ({
        socketId: sid,
        ...info
      }));

      // If room is completely empty, clean it up after 5 minutes unless it's a featured room
      if (activeUsers.length === 0) {
        db.saveRoom(currentRoomId, { userCount: 0 });

        // Immediate cleanup of uploaded file if room becomes empty
        const room = db.getRoom(currentRoomId);
        if (room && room.videoUrl && room.videoUrl.startsWith('/uploads/')) {
          cancelDeletion(currentRoomId);
          deleteFileImmediately(room.videoUrl);
        }

        if (currentRoomId !== 'featured-interstellar') {
          setTimeout(() => {
            if (!roomConnections[currentRoomId] || Object.keys(roomConnections[currentRoomId]).length === 0) {
              db.deleteRoom(currentRoomId);
            }
          }, 300000); // 5 min delay
        }
      } else {
        db.saveRoom(currentRoomId, { userCount: activeUsers.length });

        // If the leaving user was the host, re-assign host status to another connected socket
        if (leavingUser && leavingUser.isHost) {
          const firstSocketId = Object.keys(roomConnections[currentRoomId])[0];
          roomConnections[currentRoomId][firstSocketId].isHost = true;
          io.to(firstSocketId).emit('host-status-changed', true);
        }

        // Notify remaining users
        io.to(currentRoomId).emit('presence-update', activeUsers);

        if (leavingUser) {
          const systemMsg = {
            id: uuidv4(),
            userId: 'system',
            userName: 'System',
            avatarUrl: '',
            text: `${leavingUser.name} has left the room.`,
            timestamp: new Date().toISOString()
          };
          db.addMessage(currentRoomId, systemMsg);
          io.to(currentRoomId).emit('chat-message', systemMsg);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Movie Partner server running on port ${PORT}`);
  console.log(` Link: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
