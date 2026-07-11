import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from './database.js';

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

// Predefined high-quality avatars from Obsidian Nebula designs
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
      createdAt: new Date().toISOString()
    });
  }
  res.json(user);
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
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file was uploaded or file type is invalid" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
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
      userName: 'Nebula',
      avatarUrl: '',
      text: `${user.name} has joined the Nebula.`,
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
  });

  // Handle Dynamic Video Change (Host to viewers)
  socket.on('change-video', async ({ videoUrl }) => {
    if (!currentRoomId || !currentUserId) return;

    const userConnection = roomConnections[currentRoomId]?.[socket.id];
    if (!userConnection || !userConnection.isHost) {
      return; // Only hosts can change the video
    }

    const resolvedUrl = await resolveVideoUrl(videoUrl);
    db.saveRoom(currentRoomId, { videoUrl: resolvedUrl });
    io.to(currentRoomId).emit('video-changed', { videoUrl: resolvedUrl });

    const systemMsg = {
      id: uuidv4(),
      userId: 'system',
      userName: 'Nebula',
      avatarUrl: '',
      text: `${userConnection.name} changed the video.`,
      timestamp: new Date().toISOString()
    };
    db.addMessage(currentRoomId, systemMsg);
    io.to(currentRoomId).emit('chat-message', systemMsg);
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
        userName: 'Nebula',
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
        userName: 'Nebula',
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
        userName: 'Nebula',
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
        userName: 'Nebula',
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
        userName: 'Nebula',
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
            userName: 'Nebula',
            avatarUrl: '',
            text: `${leavingUser.name} has left the Nebula.`,
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
  console.log(` Obsidian Nebula server running on port ${PORT}`);
  console.log(` Link: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
