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
  role?: 'user' | 'dev' | 'pelajar' | 'vip' | 'vipPro' | 'pelajar' | 'vip' | 'vipPro';
  termsAccepted?: boolean;
  profileBackground?: string; // Customizable profile background
  scoreUpdatedAt?: string; // Timestamp for master-master score replication
  bannedUntil?: string; // ISO string, 'permanent', or undefined
  banReason?: string;
  coins?: number; // Coin balance for packages and shop purchases
  subActiveUntil?: string; // Expiration timestamp ISO string, 'lifetime', or undefined
  registeredIp?: string;
  deviceId?: string;
  warningMessage?: string;
  warningSeen?: boolean;
  forceResetProgress?: boolean;
  exchanges?: any[];
}

export interface Report {
  id: string;
  uid: string;
  username: string;
  category: string; // 'bug' | 'fitur' | 'audio' | 'lainnya'
  message: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'rejected';
  proofImage?: string; // Optional full Base64 payment proof image
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


let cachedDbData: DbData | null = null;
let writeTimeout: NodeJS.Timeout | null = null;

function getDbData(): DbData {
  if (!cachedDbData) {
    initializeDb();
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      cachedDbData = JSON.parse(data) as DbData;
    } catch (err) {
      console.error('Error reading DB_FILE into cache:', err);
      cachedDbData = {
        users: [], reports: [], chatMessages: [], tickets: [], bannedIps: [], bannedDevices: []
      };
    }
  }
  return cachedDbData;
}

function flushDbData(): void {
  if (writeTimeout) return;
  writeTimeout = setTimeout(() => {
    if (cachedDbData) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(cachedDbData, null, 2), 'utf8');
      } catch (err) {
        console.error('Error writing cachedDbData to DB_FILE:', err);
      }
    }
    writeTimeout = null;
  }, 100);
}

function flushDbDataSync(): void {
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  if (cachedDbData) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(cachedDbData, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing cachedDbData to DB_FILE synchronously:', err);
    }
  }
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

// Subscription tier roles that must NEVER be overwritten by dev-enforcement
const SUBSCRIPTION_ROLES = ['pelajar', 'vip', 'vipPro', 'bronze', 'gold', 'diamond'];

function isDevAccount(u: User): boolean {
  const lowerUsername = (u.username || '').toLowerCase();
  const lowerEmail = (u.email || '').toLowerCase();
  const lowerDisplay = (u.displayName || '').toLowerCase();
  return lowerUsername === 'admin baik' || 
         lowerUsername === 'admin' ||
         lowerUsername.includes('adminbaik') || 
         lowerEmail.includes('adminbaik') ||
         lowerEmail.includes('a68499375') ||
         lowerEmail === 'sapapenontonbg@gmail.com' ||
         lowerDisplay === 'admin baik' ||
         lowerDisplay.includes('adminbaik');
}

export function getUsers(): User[] {
  try {
    const parsed = getDbData();
    const users: User[] = parsed.users || [];
    // Dev enforcement is read-only: we return corrected data in memory
    // but do NOT write to disk to avoid race conditions with sync operations.
    for (const u of users) {
      const isDev = isDevAccount(u);
      if (isDev) {
        if (u.role !== 'dev') u.role = 'dev';
      } else {
        if (u.role === 'dev') u.role = 'user';
      }
    }
    return users;
  } catch (err) {
    console.error('Error reading users, returning empty array:', err);
    return [];
  }
}

export function saveUsers(users: User[]): void {
  try {
    const parsed = getDbData();
    parsed.users = users;
    flushDbData();
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error in saveUsers:', err);
  }
}

export function getReports(): Report[] {
  try {
    const parsed = getDbData();
    return parsed.reports || [];
  } catch (err) {
    console.error('Error reading reports, returning empty array:', err);
    return [];
  }
}

export function saveReports(reports: Report[]): void {
  try {
    const parsed = getDbData();
    parsed.reports = reports;
    flushDbData();
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error in saveReports:', err);
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
    role: 'user',
    termsAccepted: false
  };
  
  // Check dev status using the shared helper
  if (isDevAccount(newUser)) {
    newUser.role = 'dev';
  }
  
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

export function updateUser(uid: string, updates: Partial<User>): User | undefined {
  try {
    const parsed = getDbData();
    const users: User[] = parsed.users || [];
    const index = users.findIndex((u) => u.uid === uid);
    if (index === -1) return undefined;
    
    const oldUser = users[index];
    const updatedUser = {
      ...oldUser,
      ...updates,
      scoreUpdatedAt: new Date().toISOString()
    };
    
    // Log subscription changes for debugging
    if (updates.role || updates.subActiveUntil || updates.coins !== undefined || updates.exchanges) {
      console.log(`[SUB] updateUser ${uid}: role=${oldUser.role}->${updatedUser.role}, sub=${oldUser.subActiveUntil}->${updatedUser.subActiveUntil}, coins=${oldUser.coins}->${updatedUser.coins}`);
    }
    
    users[index] = updatedUser;
    flushDbData();
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
    
    // Return the user with dev enforcement applied (for API response)
    const isDev = isDevAccount(updatedUser);
    if (isDev && updatedUser.role !== 'dev') {
      return { ...updatedUser, role: 'dev' };
    }
    return updatedUser;
  } catch (err) {
    console.error('Error in updateUser:', err);
    return undefined;
  }
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
  try {
    const parsed = getDbData();
    return parsed.chatMessages || [];
  } catch (err) {
    console.error('Error reading chatMessages, returning empty array:', err);
    return [];
  }
}

export function saveChatMessages(messages: ChatMessage[]): void {
  try {
    const parsed = getDbData();
    parsed.chatMessages = messages;
    flushDbData();
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error in saveChatMessages:', err);
  }
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
  try {
    const parsed = getDbData();
    parsed.announcement = text;
    flushDbData();
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error in saveAnnouncement:', err);
  }
}

export function getNotification(): string {
  try {
    const parsed = getDbData();
    return parsed.notification || "Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸";
  } catch (err) {
    console.error('Error reading notification, returning default:', err);
    return "Ada materi kuis JLPT baru hari ini! Yuk mulai belajar 🌸";
  }
}

export function saveNotification(text: string): void {
  try {
    const parsed = getDbData();
    parsed.notification = text;
    flushDbData();
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error in saveNotification:', err);
  }
}

export function getBannedIps(): string[] {
  try {
    const parsed = getDbData();
    return parsed.bannedIps || [];
  } catch (err) {
    console.error('Error reading bannedIps, returning empty array:', err);
    return [];
  }
}

export function getBannedDevices(): string[] {
  try {
    const parsed = getDbData();
    return parsed.bannedDevices || [];
  } catch (err) {
    console.error('Error reading bannedDevices, returning empty array:', err);
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
  try {
    const parsed = getDbData();
    return parsed.tickets || [];
  } catch (err) {
    console.error('Error reading tickets, returning empty array:', err);
    return [];
  }
}

export function saveTickets(tickets: Ticket[]): void {
  try {
    const parsed = getDbData();
    parsed.tickets = tickets;
    flushDbData();
    setTimeout(() => { syncWithPeer().catch(console.error); }, 100);
  } catch (err) {
    console.error('Error in saveTickets:', err);
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
      
      const hasMetaChange = rUser.termsAccepted !== lUser.termsAccepted || 
                            rUser.displayName !== lUser.displayName || 
                            rUser.avatar !== lUser.avatar ||
                            rUser.profileBackground !== lUser.profileBackground ||
                            rUser.warningSeen !== lUser.warningSeen ||
                            rUser.warningMessage !== lUser.warningMessage ||
                            rUser.forceResetProgress !== lUser.forceResetProgress ||
                            rUser.deskripsi !== lUser.deskripsi ||
                            rUser.ttl !== lUser.ttl ||
                            rUser.bannedUntil !== lUser.bannedUntil ||
                            rUser.banReason !== lUser.banReason;
                            
      if (hasScoreChange || hasMetaChange) {
        // ===================================================================
        // SUBSCRIPTION & PREMIUM FIELD SYNC RESOLUTION
        // VPS is the primary authority for subscriptions and coins.
        // - On VPS: we preserve local subscription/coins unless they are empty
        //   and the remote (Shared Hosting) has values (which helps restore data).
        // - On Shared Hosting: we always adopt the remote (VPS) values.
        // ===================================================================
        const peerUrl = process.env.SYNC_PEER_URL || '';
        const isVps = !peerUrl || peerUrl.includes('my.id');

        let finalRole = lUser.role ?? 'user';
        let finalSubActiveUntil = lUser.subActiveUntil;
        let finalCoins = lUser.coins ?? 0;

        if (isVps) {
          const localHasSub = ['pelajar', 'vip', 'vipPro', 'bronze', 'gold', 'diamond'].includes(lUser.role || '') || lUser.subActiveUntil;
          const remoteHasSub = ['pelajar', 'vip', 'vipPro', 'bronze', 'gold', 'diamond'].includes(rUser.role || '') || rUser.subActiveUntil;
          
          if (!localHasSub && remoteHasSub) {
            finalRole = rUser.role ?? 'user';
            finalSubActiveUntil = rUser.subActiveUntil;
          }
          if ((lUser.coins ?? 0) === 0 && (rUser.coins ?? 0) > 0) {
            finalCoins = rUser.coins ?? 0;
          }
        } else {
          finalRole = rUser.role ?? lUser.role ?? 'user';
          finalSubActiveUntil = rUser.subActiveUntil ?? lUser.subActiveUntil;
          finalCoins = rUser.coins ?? lUser.coins ?? 0;
        }

        // Merge exchanges: combine unique entries from both local and remote by id
        const localExchanges = lUser.exchanges || [];
        const remoteExchanges = rUser.exchanges || [];
        const exchangeMap = new Map<string, any>();
        for (const ex of localExchanges) { exchangeMap.set(ex.id, ex); }
        for (const ex of remoteExchanges) { if (!exchangeMap.has(ex.id)) exchangeMap.set(ex.id, ex); }
        const combinedEx = Array.from(exchangeMap.values());
        
        // Determine base record based on which one is newer or has higher score
        const remoteIsNewer = rScoreTime > lScoreTime || (rUser.scoreUpdatedAt && !lUser.scoreUpdatedAt);
        const baseMerged = remoteIsNewer ? { ...lUser, ...rUser } : { ...rUser, ...lUser };
        
        // Re-apply protected/selected subscription fields AFTER base merge
        merged.users[lIdx] = { 
          ...baseMerged, 
          role: finalRole, 
          subActiveUntil: finalSubActiveUntil,
          coins: finalCoins,
          exchanges: combinedEx
        };
        
        // Debug logging for subscription field protection
        if (rUser.role !== finalRole || rUser.subActiveUntil !== finalSubActiveUntil || (rUser.coins ?? 0) !== finalCoins) {
          console.log(`[SYNC RESOLVE] ${lUser.uid} (${lUser.displayName}): resolved role=${finalRole}, sub=${finalSubActiveUntil}, coins=${finalCoins} (remote had role=${rUser.role}, sub=${rUser.subActiveUntil}, coins=${rUser.coins})`);
        }
        
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
    const localData = getDbData();

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
          cachedDbData = merged;
          flushDbData();
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
  const localDb = getDbData();
  const { merged, changed } = mergeDatabases(localDb, remoteDb);
  if (changed) {
    console.log('[SYNC API] Merged incoming data and writing locally.');
    cachedDbData = merged;
    flushDbDataSync();
    
    // Verify subscription data integrity after write
    const verifyDb = getDbData();
    for (const lUser of localDb.users || []) {
      if (SUBSCRIPTION_ROLES.includes(lUser.role as string) || lUser.subActiveUntil) {
        const written = verifyDb.users?.find(u => u.uid === lUser.uid);
        if (written && (written.role !== lUser.role || written.subActiveUntil !== lUser.subActiveUntil || written.coins !== lUser.coins)) {
          console.error(`[SYNC INTEGRITY ERROR] ${lUser.uid}: subscription data was corrupted during sync! Restoring...`);
          // Restore subscription fields
          written.role = lUser.role;
          written.subActiveUntil = lUser.subActiveUntil;
          written.coins = lUser.coins;
          written.exchanges = lUser.exchanges;
          flushDbDataSync();
        }
      }
    }
  }
  return merged;
}
