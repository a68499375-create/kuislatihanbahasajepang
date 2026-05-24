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
}

const DB_FILE = path.join(process.cwd(), 'server', 'db.json');

// Ensure database directory and file exist
function initializeDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
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
    return parsed.users || [];
  } catch (err) {
    console.error('Error reading db.json, returning empty array:', err);
    return [];
  }
}

export function saveUsers(users: User[]): void {
  initializeDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users }, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to db.json:', err);
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
    .map(({ uid, username, displayName, avatar, poin, xp, deskripsi, ttl }) => ({
      uid,
      username,
      displayName,
      avatar,
      poin,
      xp,
      deskripsi: deskripsi || 'Halo! Saya sedang belajar Bahasa Jepang.',
      ttl: ttl || '-',
    }))
    .sort((a, b) => {
      if (b.poin !== a.poin) {
        return b.poin - a.poin;
      }
      return b.xp - a.xp;
    });
}
