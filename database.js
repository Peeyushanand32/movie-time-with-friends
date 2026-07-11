import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_FILE = path.resolve('db.json');

// Default database structure
const defaultDb = {
  users: {}, // username -> User object or userId -> User object. Let's map by userId but also allow username lookup.
  rooms: {
    // Seed an initial room for a cool watch party out-of-the-box
    "featured-interstellar": {
      id: "featured-interstellar",
      title: "Interstellar Watch Party",
      videoUrl: "https://www.youtube.com/watch?v=zSWdZAZE3Tc", // Interstellar trailer
      category: "Movies & TV",
      hostId: "system",
      hostName: "Nebula_Voyager",
      createdAt: new Date().toISOString(),
      userCount: 0,
      messages: [
        {
          id: "m1",
          userId: "system",
          userName: "Nebula_Voyager",
          avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuD-hP_w7MokkTtZNoylSNihD9tiZIJFgpo0WmAiIE0WXGMrZBg06mflC1n9eFcOOGc2h3IUZz-AfBeKwxCXvLLFgR-1AoF96uJgBmd4HowfBbCClZMlijohHYVL0Vc3PlcuUBlQ5r83kG4etIck9ES964okiOzPY_9dGvND9i9NiaIZFfykwvaRyz3H2uWiwI5dmguGGcYlreUJFx47RONMhFLpYRkQbkuUOH8Ed2u1Zs6nJU2xiSPsLb1OWI4gzNcAskt-uWY0sSs",
          text: "Welcome to the Obsidian Nebula! Play the video and let's watch in sync.",
          timestamp: new Date().toISOString()
        }
      ],
      queue: [],
      bannedUsers: []
    }
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(defaultDb);
      return defaultDb;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file, using fallback state:", err);
    return defaultDb;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing to database file:", err);
  }
}

// Password hashing utility
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export const db = {
  getUser(userId) {
    const data = readDb();
    return data.users[userId] || null;
  },

  getUserByUsername(username) {
    const data = readDb();
    const cleanUsername = username.toLowerCase().trim();
    return Object.values(data.users).find(u => u.username && u.username.toLowerCase() === cleanUsername) || null;
  },

  saveUser(userId, userData) {
    const data = readDb();
    data.users[userId] = {
      ...data.users[userId],
      ...userData,
      id: userId
    };
    writeDb(data);
    return data.users[userId];
  },

  registerUser(userId, username, password, avatarUrl) {
    const data = readDb();
    const cleanUsername = username.trim();
    
    // Check if user already exists
    const existing = Object.values(data.users).find(u => u.username && u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      throw new Error("Username already taken");
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newUser = {
      id: userId,
      username: cleanUsername,
      name: cleanUsername, // default display name is username
      passwordHash,
      salt,
      avatarUrl,
      createdAt: new Date().toISOString()
    };

    data.users[userId] = newUser;
    writeDb(data);
    return newUser;
  },

  verifyUser(username, password) {
    const user = this.getUserByUsername(username);
    if (!user || !user.passwordHash || !user.salt) {
      return null;
    }
    const hash = hashPassword(password, user.salt);
    if (hash === user.passwordHash) {
      // return user without sensitive auth fields
      const { passwordHash, salt, ...safeUser } = user;
      return safeUser;
    }
    return null;
  },

  getRooms() {
    const data = readDb();
    return Object.values(data.rooms);
  },

  getRoom(roomId) {
    const data = readDb();
    return data.rooms[roomId] || null;
  },

  saveRoom(roomId, roomData) {
    const data = readDb();
    data.rooms[roomId] = {
      messages: [],
      queue: [],
      bannedUsers: [],
      ...data.rooms[roomId],
      ...roomData,
      id: roomId
    };
    writeDb(data);
    return data.rooms[roomId];
  },

  deleteRoom(roomId) {
    if (roomId === "featured-interstellar") return;
    const data = readDb();
    delete data.rooms[roomId];
    writeDb(data);
  },

  addMessage(roomId, message) {
    const data = readDb();
    if (data.rooms[roomId]) {
      if (!data.rooms[roomId].messages) {
        data.rooms[roomId].messages = [];
      }
      data.rooms[roomId].messages.push(message);
      if (data.rooms[roomId].messages.length > 100) {
        data.rooms[roomId].messages.shift();
      }
      writeDb(data);
    }
  },

  // Queue Operations
  getQueue(roomId) {
    const room = this.getRoom(roomId);
    return room ? (room.queue || []) : [];
  },

  addQueueItem(roomId, videoUrl, title, addedBy, addedByName) {
    const data = readDb();
    if (!data.rooms[roomId]) return null;
    if (!data.rooms[roomId].queue) {
      data.rooms[roomId].queue = [];
    }
    const queueItem = {
      id: crypto.randomBytes(8).toString('hex'),
      videoUrl,
      title,
      addedBy,
      addedByName,
      timestamp: new Date().toISOString()
    };
    data.rooms[roomId].queue.push(queueItem);
    writeDb(data);
    return queueItem;
  },

  removeQueueItem(roomId, itemId) {
    const data = readDb();
    if (!data.rooms[roomId] || !data.rooms[roomId].queue) return false;
    const originalLength = data.rooms[roomId].queue.length;
    data.rooms[roomId].queue = data.rooms[roomId].queue.filter(item => item.id !== itemId);
    writeDb(data);
    return data.rooms[roomId].queue.length < originalLength;
  },

  clearQueue(roomId) {
    const data = readDb();
    if (!data.rooms[roomId]) return;
    data.rooms[roomId].queue = [];
    writeDb(data);
  },

  // Moderation Operations
  banUser(roomId, userId) {
    const data = readDb();
    if (!data.rooms[roomId]) return;
    if (!data.rooms[roomId].bannedUsers) {
      data.rooms[roomId].bannedUsers = [];
    }
    if (!data.rooms[roomId].bannedUsers.includes(userId)) {
      data.rooms[roomId].bannedUsers.push(userId);
      writeDb(data);
    }
  },

  unbanUser(roomId, userId) {
    const data = readDb();
    if (!data.rooms[roomId] || !data.rooms[roomId].bannedUsers) return;
    data.rooms[roomId].bannedUsers = data.rooms[roomId].bannedUsers.filter(id => id !== userId);
    writeDb(data);
  },

  isUserBanned(roomId, userId) {
    const room = this.getRoom(roomId);
    if (!room || !room.bannedUsers) return false;
    return room.bannedUsers.includes(userId);
  }
};
