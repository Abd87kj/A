const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, games: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getUser(userId, guildId) {
  const db = loadDB();
  const key = `${guildId}_${userId}`;
  if (!db.users[key]) {
    db.users[key] = {
      userId,
      guildId,
      points: 100,
      wins: 0,
      losses: 0,
      items: [],
      activeShields: 0,
      activeNukes: 0,
      activeHackers: 0,
    };
    saveDB(db);
  }
  return db.users[key];
}

function saveUser(user) {
  const db = loadDB();
  const key = `${user.guildId}_${user.userId}`;
  db.users[key] = user;
  saveDB(db);
}

function addPoints(userId, guildId, amount) {
  const user = getUser(userId, guildId);
  user.points = Math.max(0, user.points + amount);
  saveUser(user);
  return user.points;
}

function getTopUsers(guildId, limit = 10) {
  const db = loadDB();
  return Object.values(db.users)
    .filter(u => u.guildId === guildId)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

const activeSessions = new Map();

function getSession(channelId) {
  return activeSessions.get(channelId) || null;
}

function setSession(channelId, data) {
  activeSessions.set(channelId, data);
}

function deleteSession(channelId) {
  activeSessions.delete(channelId);
}

module.exports = {
  getUser,
  saveUser,
  addPoints,
  getTopUsers,
  getSession,
  setSession,
  deleteSession,
};
