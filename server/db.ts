import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Disable TLS/SSL unauthorized rejection for local master-master database sync nodes
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
  profileBackground?: string; // Customizable profile background
  scoreUpdatedAt?: string; // Timestamp for master-master score replication
  bannedUntil?: string; // ISO string, 'permanent', or undefined
  banReason?: string;
  registeredIp?: string;
  deviceId?: string;
  warningMessage?: string;
  warningSeen?: boolean;
  forceResetProgress?: boolean;
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
  image?: string; // Base64 image attachment
}

export interface TicketMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  uid: string;
  username: string;
  message: string;
  createdAt: string;
  status: 'open' | 'active' | 'closed';
  messages: TicketMessage[];
}

// Resolve DB_FILE path relative to files safely to bypass process.cwd() shifts under Passenger
let DB_FILE = path.join(__dirname, '..', 'server', 'db.json');
if (!fs.existsSync(path.dirname(DB_FILE))) {
  // If run in dev mode or different context
  DB_FILE = path.join(__dirname, 'server', 'db.json');
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    // Fallback to process.cwd()
    DB_FILE = path.join(process.cwd(), 'server', 'db.json');
  }
}

// Ensure database directory and file exist
function initializeDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
      users: [], 
      reports: [], 
      chatMessages: [],
      announcement: "Selamat datang di Zenith Nihongo! Belajar bahasa Jepang interaktif dengan AI Sensei.",
      notification: "Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸",
      tickets: [],
      bannedIps: [],
      bannedDevices: []
    }, null, 2), 'utf8');
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
      if (!parsed.tickets) {
        parsed.tickets = [];
        changed = true;
      }
      if (parsed.announcement === undefined) {
        parsed.announcement = "Selamat datang di Zenith Nihongo! Belajar bahasa Jepang interaktif dengan AI Sensei.";
        changed = true;
      }
      if (parsed.notification === undefined) {
        parsed.notification = "Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸";
        changed = true;
      }
      if (!parsed.bannedIps) {
        parsed.bannedIps = [];
        changed = true;
      }
      if (!parsed.bannedDevices) {
        parsed.bannedDevices = [];
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
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
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
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
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
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error writing to db.json (chatMessages):', err);
  }
}

export interface DbData {
  users: User[];
  reports: Report[];
  chatMessages: ChatMessage[];
  announcement?: string;
  notification?: string;
  tickets?: Ticket[];
  bannedIps?: string[];
  bannedDevices?: string[];
}

export function getAnnouncement(): string {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.announcement || "BANGGGG KOK DOWNLOAD HARUS VIP ? BANTUIN PATUNGAN YOK SINI BARU FREE,,, GAK ADA YANG GRATIS DI DUNIA INI.";
  } catch (err) {
    console.error('Error reading announcement:', err);
    return "BANGGGG KOK DOWNLOAD HARUS VIP ? BANTUIN PATUNGAN YOK SINI BARU FREE,,, GAK ADA YANG GRATIS DI DUNIA INI.";
  }
}

export function saveAnnouncement(text: string): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    parsed.announcement = text;
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error writing announcement:', err);
  }
}

export function getNotification(): string {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.notification || "Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸";
  } catch (err) {
    console.error('Error reading notification:', err);
    return "Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸";
  }
}

export function saveNotification(text: string): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    parsed.notification = text;
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error writing notification:', err);
  }
}

export function getBannedIps(): string[] {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.bannedIps || [];
  } catch (err) {
    console.error('Error reading bannedIps:', err);
    return [];
  }
}

export function getBannedDevices(): string[] {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.bannedDevices || [];
  } catch (err) {
    console.error('Error reading bannedDevices:', err);
    return [];
  }
}

export function banIp(ip: string): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    const banned: string[] = parsed.bannedIps || [];
    if (!banned.includes(ip)) {
      banned.push(ip);
      parsed.bannedIps = banned;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
    }
  } catch (err) {
    console.error('Error saving banIp:', err);
  }
}

export function banDevice(device: string): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    const banned: string[] = parsed.bannedDevices || [];
    if (!banned.includes(device)) {
      banned.push(device);
      parsed.bannedDevices = banned;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
    }
  } catch (err) {
    console.error('Error saving banDevice:', err);
  }
}

export function unbanIp(ip: string): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    let banned: string[] = parsed.bannedIps || [];
    if (banned.includes(ip)) {
      banned = banned.filter(x => x !== ip);
      parsed.bannedIps = banned;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
    }
  } catch (err) {
    console.error('Error unbanIp:', err);
  }
}

export function unbanDevice(device: string): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    let banned: string[] = parsed.bannedDevices || [];
    if (banned.includes(device)) {
      banned = banned.filter(x => x !== device);
      parsed.bannedDevices = banned;
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
    }
  } catch (err) {
    console.error('Error unbanDevice:', err);
  }
}

export function getTickets(): Ticket[] {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.tickets || [];
  } catch (err) {
    console.error('Error reading tickets:', err);
    return [];
  }
}

export function saveTickets(tickets: Ticket[]): void {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    parsed.tickets = tickets;
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error writing tickets:', err);
  }
}

export function mergeDatabases(local: DbData, remote: DbData): { merged: DbData; changed: boolean } {
  let changed = false;
  const merged: DbData = {
    users: [...(local.users || [])],
    reports: [...(local.reports || [])],
    chatMessages: [...(local.chatMessages || [])],
    announcement: local.announcement || remote.announcement || "Selamat datang di Zenith Nihongo!",
    notification: local.notification || remote.notification || "Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸",
    tickets: [...(local.tickets || [])],
    bannedIps: [...(local.bannedIps || [])],
    bannedDevices: [...(local.bannedDevices || [])]
  };

  // 1. Merge users based on uid
  for (const rUser of (remote.users || [])) {
    const lIdx = merged.users.findIndex(u => u.uid === rUser.uid);
    if (lIdx === -1) {
      merged.users.push(rUser);
      changed = true;
    } else {
      const lUser = merged.users[lIdx];
      const rScoreTime = new Date(rUser.scoreUpdatedAt || 0).getTime();
      const lScoreTime = new Date(lUser.scoreUpdatedAt || 0).getTime();
      const hasScoreChange = rScoreTime > lScoreTime || 
                            (rUser.scoreUpdatedAt && !lUser.scoreUpdatedAt) || 
                            (rUser.poin !== lUser.poin && !rUser.scoreUpdatedAt && !lUser.scoreUpdatedAt && (rUser.poin || 0) > (lUser.poin || 0));
      const hasMetaChange = rUser.role !== lUser.role || 
                            rUser.termsAccepted !== lUser.termsAccepted || 
                            rUser.displayName !== lUser.displayName || 
                            rUser.avatar !== lUser.avatar ||
                            rUser.profileBackground !== lUser.profileBackground;
                            
      if (hasScoreChange || hasMetaChange) {
        merged.users[lIdx] = { ...lUser, ...rUser };
        changed = true;
      }
    }
  }

  // 2. Merge reports based on id
  for (const rReport of (remote.reports || [])) {
    const lIdx = merged.reports.findIndex(r => r.id === rReport.id);
    if (lIdx === -1) {
      merged.reports.push(rReport);
      changed = true;
    } else {
      const lReport = merged.reports[lIdx];
      if (rReport.status !== lReport.status) {
        merged.reports[lIdx] = { ...lReport, ...rReport };
        changed = true;
      }
    }
  }

  // 3. Merge chatMessages based on id
  for (const rMsg of (remote.chatMessages || [])) {
    const lIdx = merged.chatMessages.findIndex(m => m.id === rMsg.id);
    if (lIdx === -1) {
      merged.chatMessages.push(rMsg);
      changed = true;
    }
  }

  if (changed || (remote.chatMessages && remote.chatMessages.length !== (local.chatMessages ? local.chatMessages.length : 0))) {
    merged.chatMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    changed = true;
  }

  // 4. Merge tickets based on id
  for (const rTicket of (remote.tickets || [])) {
    const lIdx = merged.tickets.findIndex(t => t.id === rTicket.id);
    if (lIdx === -1) {
      merged.tickets.push(rTicket);
      changed = true;
    } else {
      const lTicket = merged.tickets[lIdx];
      if (rTicket.status !== lTicket.status || rTicket.messages.length > lTicket.messages.length) {
        merged.tickets[lIdx] = rTicket;
        changed = true;
      }
    }
  }

  // 5. Sync announcement & notification (keep remote if local is empty/default and remote is custom)
  if (remote.announcement && remote.announcement !== local.announcement) {
    merged.announcement = remote.announcement;
    changed = true;
  }
  if (remote.notification && remote.notification !== local.notification) {
    merged.notification = remote.notification;
    changed = true;
  }

  // 6. Merge bannedIps
  for (const rip of (remote.bannedIps || [])) {
    if (!merged.bannedIps!.includes(rip)) {
      merged.bannedIps!.push(rip);
      changed = true;
    }
  }

  // 7. Merge bannedDevices
  for (const rdev of (remote.bannedDevices || [])) {
    if (!merged.bannedDevices!.includes(rdev)) {
      merged.bannedDevices!.push(rdev);
      changed = true;
    }
  }

  return { merged, changed };
}

let isSyncing = false;

export async function syncWithPeer() {
  if (isSyncing) return;
  const peerUrl = process.env.SYNC_PEER_URL;
  const secretKey = process.env.SYNC_SECRET_KEY || 'ZenithNihongoSyncSecret2026';
  if (!peerUrl) return;

  isSyncing = true;
  try {
    const localDataRaw = fs.readFileSync(DB_FILE, 'utf8');
    const localData = JSON.parse(localDataRaw) as DbData;

    console.log(`[SYNC] Sending database to peer: ${peerUrl}`);
    const res = await fetch(`${peerUrl}/api/database/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': secretKey
      },
      body: JSON.stringify(localData)
    });

    if (res.ok) {
      const resData = await res.json() as any;
      if (resData.status === 'success' && resData.data) {
        const remoteData = resData.data as DbData;
        const { merged, changed } = mergeDatabases(localData, remoteData);
        if (changed) {
          console.log('[SYNC] Database merged and updated from peer!');
          fs.writeFileSync(DB_FILE, JSON.stringify(merged, null, 2), 'utf8');
        } else {
          console.log('[SYNC] Database is already fully synchronized!');
        }
      }
    } else {
      console.error(`[SYNC ERROR] Peer returned status ${res.status}`);
    }
  } catch (err) {
    console.error('[SYNC ERROR] Failed to sync with peer:', (err as Error).message);
  } finally {
    isSyncing = false;
  }
}

export function handleIncomingSync(remoteDb: DbData): DbData {
  initializeDb();
  const localRaw = fs.readFileSync(DB_FILE, 'utf8');
  const localDb = JSON.parse(localRaw) as DbData;
  const { merged, changed } = mergeDatabases(localDb, remoteDb);
  if (changed) {
    console.log('[SYNC API] Merged incoming data and writing locally.');
    fs.writeFileSync(DB_FILE, JSON.stringify(merged, null, 2), 'utf8');
  }
  return merged;
}
