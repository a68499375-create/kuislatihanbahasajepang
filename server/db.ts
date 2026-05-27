import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  uid: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatar: string;
  poin: number;
  xp: number;
  deskripsi?: string;
  ttl?: string;
  role?: 'user' | 'dev';
  termsAccepted?: boolean;
}

export interface Report {
  id: string;
  uid: string;
  username: string;
  category: string; // 'bug' | 'fitur' | 'audio' | 'lainnya'
  message: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'rejected';
}

export interface ChatMessage {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  avatar: string;
  text: string;
  createdAt: string;
  role?: 'user' | 'dev';
}

const DB_FILE = path.join(process.cwd(), 'server', 'db.json');

// Ensure database directory and file exist
function initializeDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], reports: [], chatMessages: [] }, null, 2), 'utf8');
  } else {
    // Migration: make sure all keys exist
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      let changed = false;
      if (!parsed.users) {
        parsed.users = [];
        changed = true;
      }
      if (!parsed.reports) {
        parsed.reports = [];
        changed = true;
      }
      if (!parsed.chatMessages) {
        parsed.chatMessages = [];
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('Migration error:', e);
    }
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function generateUID(): string {
  return 'UID-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

export function getUsers(): User[] {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    const users: User[] = parsed.users || [];
    let changed = false;
    for (const u of users) {
      const lowerUsername = (u.username || '').toLowerCase();
      const lowerEmail = (u.email || '').toLowerCase();
      const lowerDisplay = (u.displayName || '').toLowerCase();
      const isDev = lowerUsername === 'admin baik' || 
                    lowerUsername.includes('adminbaik') || 
                    lowerEmail.includes('adminbaik') ||
                    lowerEmail.includes('a68499375') ||
                    lowerDisplay === 'admin baik' ||
                    lowerDisplay.includes('adminbaik');
      if (isDev) {
        if (u.role !== 'dev') {
          u.role = 'dev';
          changed = true;
        }
      } else {
        if (u.role === 'dev') {
          u.role = 'user';
          changed = true;
        }
      }
    }
    if (changed) {
      parsed.users = users;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    }
    return users;
  } catch (err) {
    console.error('Error reading db.json, returning empty array:', err);
    return [];
  }
}

export function saveUsers(users: User[]): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    parsed.users = users;
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to db.json (users):', err);
  }
}

export function getReports(): Report[] {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.reports || [];
  } catch (err) {
    console.error('Error reading reports, returning empty array:', err);
    return [];
  }
}

export function saveReports(reports: Report[]): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    parsed.reports = reports;
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to db.json (reports):', err);
  }
}

export function getUserByEmail(email: string): User | undefined {
  const users = getUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function getUserByUsername(username: string): User | undefined {
  const users = getUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function getUserByUid(uid: string): User | undefined {
  const users = getUsers();
  return users.find((u) => u.uid === uid);
}

export function createUser(userInfo: {
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatar: string;
}): User {
  const users = getUsers();
  const lowerUsername = userInfo.username.toLowerCase();
  const lowerDisplayName = (userInfo.displayName || '').toLowerCase();
  
  // Set Developer role for specific admin/dev accounts
  const isDev = lowerUsername === 'admin baik' || 
                lowerUsername.includes('adminbaik') || 
                userInfo.email.toLowerCase().includes('adminbaik') ||
                userInfo.email.toLowerCase().includes('a68499375') ||
                lowerDisplayName === 'admin baik' ||
                lowerDisplayName.includes('adminbaik');

  const newUser: User = {
    uid: generateUID(),
    email: userInfo.email,
    username: userInfo.username,
    passwordHash: userInfo.passwordHash,
    displayName: userInfo.displayName,
    avatar: userInfo.avatar,
    poin: 0,
    xp: 0,
    deskripsi: 'Halo! Saya sedang belajar Bahasa Jepang.',
    ttl: '-',
    role: isDev ? 'dev' : 'user',
    termsAccepted: false
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

export function updateUser(uid: string, updates: Partial<User>): User | undefined {
  const users = getUsers();
  const index = users.findIndex((u) => u.uid === uid);
  if (index === -1) return undefined;
  
  users[index] = {
    ...users[index],
    ...updates,
  };
  saveUsers(users);
  return users[index];
}

export function getLeaderboard(): Omit<User, 'passwordHash' | 'email'>[] {
  const users = getUsers();
  // Filter and sort by points descending, then by xp descending
  return users
    .map(({ uid, username, displayName, avatar, poin, xp, deskripsi, ttl, role, termsAccepted }) => ({
      uid,
      username,
      displayName,
      avatar,
      poin,
      xp,
      deskripsi: deskripsi || 'Halo! Saya sedang belajar Bahasa Jepang.',
      ttl: ttl || '-',
      role: role || 'user',
      termsAccepted: !!termsAccepted
    }))
    .sort((a, b) => {
      if (b.poin !== a.poin) {
        return b.poin - a.poin;
      }
      return b.xp - a.xp;
    });
}

export function getChatMessages(): ChatMessage[] {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.chatMessages || [];
  } catch (err) {
    console.error('Error reading chatMessages, returning empty array:', err);
    return [];
  }
}

export function saveChatMessages(messages: ChatMessage[]): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    parsed.chatMessages = messages;
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to db.json (chatMessages):', err);
  }
}
