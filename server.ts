import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { 
  getUsers, 
  getUserByEmail, 
  getUserByUsername, 
  getUserByUid, 
  createUser, 
  updateUser, 
  getLeaderboard,
  hashPassword,
  generateUID,
  saveUsers,
  getReports,
  saveReports,
  getChatMessages,
  saveChatMessages,
  handleIncomingSync,
  getAnnouncement,
  saveAnnouncement,
  getNotification,
  saveNotification,
  getBannedIps,
  getBannedDevices,
  banIp,
  banDevice,
  unbanIp,
  unbanDevice,
  getTickets,
  saveTickets,
  DbData,
  User,
  syncWithPeer
} from './server/db.js';

import dotenv from 'dotenv';
import fs from 'fs';
let envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env');
}
if (!fs.existsSync(envPath)) {
  envPath = path.join(process.cwd(), '.env');
}
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || '3000';

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Lazy initializer for Google GenAI
let ai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return ai;
}

// ==========================================
// AUTHENTICATION & PROFILE ENDPOINTS
// ==========================================

// Manual auth endpoints removed — Google-only login

// Helper to verify if an IP, device, or user account is suspended/banned
function isBannedCheck(user: any, req: Request): { banned: boolean; reason: string } {
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || req.ip || '').split(',')[0].trim();
  const clientDevice = (req.body && req.body.deviceId) || (req.query && req.query.deviceId) || '';

  // 1. Check global IP ban list
  const bannedIps = getBannedIps();
  if (bannedIps.includes(clientIp)) {
    return { banned: true, reason: 'IP Anda telah diblokir oleh developer karena melanggar aturan.' };
  }

  // 2. Check global Device ban list
  const bannedDevices = getBannedDevices();
  if (clientDevice && bannedDevices.includes(clientDevice)) {
    return { banned: true, reason: 'Perangkat Anda telah diblokir oleh developer karena melanggar aturan.' };
  }

  if (user) {
    // 3. Check permanent suspension
    if (user.bannedUntil === 'permanent') {
      return { banned: true, reason: user.banReason || 'Akun Anda telah dinonaktifkan secara permanen.' };
    }

    // 4. Check temporary suspension
    if (user.bannedUntil) {
      const banTime = new Date(user.bannedUntil).getTime();
      const now = Date.now();
      if (banTime > now) {
        const remaining = Math.ceil((banTime - now) / 60000);
        return { banned: true, reason: `Akun Anda ditangguhkan sementara. Sisa waktu: ${remaining} menit. Alasan: ${user.banReason || 'Melanggar aturan.'}` };
      }
    }

    // 5. Check if user's registered IP/Device is globally banned
    if (user.registeredIp && bannedIps.includes(user.registeredIp)) {
      return { banned: true, reason: 'IP terdaftar akun Anda terblokir.' };
    }
    if (user.deviceId && bannedDevices.includes(user.deviceId)) {
      return { banned: true, reason: 'Perangkat terdaftar akun Anda terblokir.' };
    }
  }

  return { banned: false, reason: '' };
}



// Google Login/Oauth
app.post('/api/auth/google', (req: Request, res: Response) => {
  try {
    const { email, displayName, avatar } = req.body;

    const globalBan = isBannedCheck(null, req);
    if (globalBan.banned) {
      res.status(403).json({ status: 'error', message: globalBan.reason });
      return;
    }

    if (!email) {
      res.status(400).json({ status: 'error', message: 'Email Google tidak valid.' });
      return;
    }

    const av = avatar || '';
    const name = displayName || email.split('@')[0];

    let user = getUserByEmail(email);
    if (user) {
      const banStatus = isBannedCheck(user, req);
      if (banStatus.banned) {
        res.status(403).json({ status: 'error', message: banStatus.reason });
        return;
      }

      const updateData: any = {};
      
      // Removed insecure auto-assign

      // Auto-migrate old tier names to new ones
      const roleMigration: Record<string, string> = { 'bronze': 'pelajar', 'gold': 'vip', 'diamond': 'vipPro' };
      if (user.role && roleMigration[user.role]) {
        updateData.role = roleMigration[user.role] as any;
      }
      
      const isDisplayPlaceholder = !user.displayName || 
                                   user.displayName === 'undefined' || 
                                   user.displayName === 'null' || 
                                   user.displayName === '' || 
                                   user.displayName === 'Pelajar';
      if (isDisplayPlaceholder) {
        updateData.displayName = name;
      }
      
      const isAvatarPlaceholder = !user.avatar || 
                                  user.avatar === 'undefined' || 
                                  user.avatar === 'null' || 
                                  user.avatar === '' || 
                                  user.avatar.includes('ui-avatars.com');
      if (isAvatarPlaceholder) {
        updateData.avatar = av;
      }
      
      // Save registered IP and Device ID on Google OAuth login
      const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || req.ip || '').split(',')[0].trim();
      const clientDevice = (req.body && req.body.deviceId) || '';
      if (clientIp) updateData.registeredIp = clientIp;
      if (clientDevice) updateData.deviceId = clientDevice;

      if (Object.keys(updateData).length > 0) {
        const updated = updateUser(user.uid, updateData);
        if (updated) user = updated;
      }
    } else {
      // Autocreate user
      const uniqueSuffix = Math.floor(100 + Math.random() * 900);
      const generatedUsername = email.split('@')[0] + uniqueSuffix;
      
      const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || req.ip || '').split(',')[0].trim();
      const clientDevice = (req.body && req.body.deviceId) || '';

      user = createUser({
        email,
        username: generatedUsername,
        passwordHash: hashPassword(generateUID()), // random secure pass
        displayName: name,
        avatar: av,
      });

      const updateData: any = {};
      if (clientIp) updateData.registeredIp = clientIp;
      if (clientDevice) updateData.deviceId = clientDevice;
      
      // Removed insecure auto-assign

      if (Object.keys(updateData).length > 0) {
        const updated = updateUser(user.uid, updateData);
        if (updated) user = updated;
      }
    }

    const { passwordHash: _, ...safeUser } = user;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Check Session/Status
app.post('/api/auth/check', (req: Request, res: Response) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(401).json({ status: 'error', message: 'User tidak ditemukan' });
      return;
    }

    const banStatus = isBannedCheck(user, req);
    if (banStatus.banned) {
      res.status(403).json({ status: 'error', message: banStatus.reason });
      return;
    }

    // Auto-migrate old tier names
    const roleMigration: Record<string, string> = { 'bronze': 'pelajar', 'gold': 'vip', 'diamond': 'vipPro' };
    if (user.role && roleMigration[user.role]) {
      updateUser(uid, { role: roleMigration[user.role] as any });
      user.role = roleMigration[user.role] as any;
    }

    // Save registered IP and Device ID on session status check
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || req.ip || '').split(',')[0].trim();
    const clientDevice = (req.body && req.body.deviceId) || '';
    const updates: Partial<User> = {};
    if (clientIp) updates.registeredIp = clientIp;
    if (clientDevice) updates.deviceId = clientDevice;
    if (Object.keys(updates).length > 0) {
      const updated = updateUser(user.uid, updates);
      if (updated) {
        const { passwordHash: _, ...safeUser } = updated;
        res.json({ status: 'success', data: safeUser });
        return;
      }
    }

    const { passwordHash: _, ...safeUser } = user;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Delete Account Endpoint
app.post('/api/auth/delete-account', (req: Request, res: Response) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      res.status(400).json({ status: 'error', message: 'User Session ID dibutuhkan.' });
      return;
    }

    const users = getUsers();
    const index = users.findIndex((u) => u.uid === uid);
    if (index === -1) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const deletedUser = users[index];
    users.splice(index, 1);
    saveUsers(users);

    res.json({ status: 'success', message: `Akun ${deletedUser.displayName} berhasil dihapus.` });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update Profile info
app.post('/api/profile/update', (req: Request, res: Response) => {
  try {
    const { uid, displayName, username, avatar, deskripsi, ttl, profileBackground } = req.body;
    if (!uid) {
      res.status(400).json({ status: 'error', message: 'User Session ID dibutuhkan.' });
      return;
    }

    // Verify username availability if updated
    const existing = getUserByUsername(username);
    if (existing && existing.uid !== uid) {
      res.status(400).json({ status: 'error', message: 'Username sudah digunakan oleh orang lain.' });
      return;
    }

    const updated = updateUser(uid, {
      displayName: displayName || 'Pelajar',
      username: username || 'user',
      avatar: avatar || '',
      deskripsi: deskripsi !== undefined ? deskripsi : '',
      ttl: ttl !== undefined ? ttl : '',
      profileBackground: profileBackground !== undefined ? profileBackground : '',
    });

    if (!updated) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Accept Terms and Conditions
app.post('/api/profile/accept-terms', (req: Request, res: Response) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      res.status(400).json({ status: 'error', message: 'User Session ID dibutuhkan.' });
      return;
    }

    const updated = updateUser(uid, { termsAccepted: true });
    if (!updated) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Create bug report / feature suggestion
app.post('/api/reports/create', (req: Request, res: Response) => {
  try {
    const { uid, category, message } = req.body;
    if (!uid || !category || !message) {
      res.status(400).json({ status: 'error', message: 'UID, kategori, dan pesan laporan wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    const username = user ? user.username : 'Guest / Anonim';

    const reports = getReports();
    const newReport = {
      id: 'REP-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      uid,
      username,
      category,
      message,
      createdAt: new Date().toISOString(),
      status: 'pending' as const
    };

    reports.push(newReport);
    saveReports(reports);

    res.json({ status: 'success', message: 'Laporan berhasil terkirim. Terima kasih atas masukan Anda!', data: newReport });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get latest live chat messages
app.get('/api/chat/messages', (req: Request, res: Response) => {
  try {
    const messages = getChatMessages();
    // Return only the last 80 messages to keep performance light
    const limit = 80;
    const sorted = messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const sliced = sorted.slice(-limit);
    res.json({ status: 'success', data: sliced });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Send message to live chat
app.post('/api/chat/send', (req: Request, res: Response) => {
  try {
    const { uid, text } = req.body;
    if (!uid || !text || !text.trim()) {
      res.status(400).json({ status: 'error', message: 'UID dan isi pesan wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Pengguna tidak ditemukan.' });
      return;
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 250) {
      res.status(400).json({ status: 'error', message: 'Pesan tidak boleh melebihi 250 karakter.' });
      return;
    }

    const messages = getChatMessages();
    
    // Check if user is 'admin baik' for DEV role assignment
    const isDev = user.role === 'dev';

    const newMessage = {
      id: 'MSG-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      uid: user.uid,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar || '',
      text: trimmedText,
      createdAt: new Date().toISOString(),
      role: isDev ? ('dev' as const) : ('user' as const)
    };

    messages.push(newMessage);
    
    // Keep only last 150 messages in database to prevent massive file bloating
    if (messages.length > 150) {
      messages.shift();
    }
    
    saveChatMessages(messages);

    res.json({ status: 'success', data: newMessage });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get all reports (exclusive for developer)
app.get('/api/reports/list', (req: Request, res: Response) => {
  try {
    const requesterUid = req.query.uid as string;
    if (!requesterUid) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const user = getUserByUid(requesterUid);
    if (!user) {
      res.status(401).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    // Check if user is developer (role === 'dev' or username matches dev profiles)
    const isDev = user.role === 'dev';
    if (!isDev) {
      res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur ini eksklusif untuk Developer.' });
      return;
    }

    const reports = getReports();
    // Sort reports: pending first, then newest first
    const sorted = reports.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json({ status: 'success', data: sorted });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update status of report (exclusive for developer)
app.post('/api/reports/update-status', (req: Request, res: Response) => {
  try {
    const { uid, reportId, status } = req.body;
    if (!uid || !reportId || !status) {
      res.status(400).json({ status: 'error', message: 'UID, ID laporan, dan status baru wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(401).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const isDev = user.role === 'dev';
    if (!isDev) {
      res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      return;
    }

    const reports = getReports();
    const idx = reports.findIndex(r => r.id === reportId);
    if (idx === -1) {
      res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan.' });
      return;
    }

    reports[idx].status = status;
    saveReports(reports);

    res.json({ status: 'success', message: 'Status laporan berhasil diperbarui.', data: reports[idx] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update Score & Leaderboard Points
app.post('/api/score/update', (req: Request, res: Response) => {
  try {
    const { uid, poin, xp } = req.body;
    if (!uid) {
      res.status(400).json({ status: 'error', message: 'User Session ID dibutuhkan.' });
      return;
    }

    const scorePoin = Math.max(0, parseInt(poin || '0'));
    const scoreXp = Math.max(0, parseInt(xp || '0'));

    const updated = updateUser(uid, {
      poin: scorePoin,
      xp: scoreXp,
      scoreUpdatedAt: new Date().toISOString()
    });

    if (!updated) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    res.json({ status: 'success', data: { poin: updated.poin, xp: updated.xp } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Bi-directional Master-Master Database Synchronization
app.post('/api/database/sync', (req: Request, res: Response) => {
  try {
    const secretHeader = req.headers['x-sync-secret'];
    const expectedSecret = process.env.SYNC_SECRET_KEY;
    
    if (!expectedSecret || secretHeader !== expectedSecret) {
      res.status(401).json({ status: 'error', message: 'Unauthorized sync request' });
      return;
    }

    const remoteDb = req.body as DbData;
    if (!remoteDb || !remoteDb.users || !remoteDb.reports || !remoteDb.chatMessages) {
      res.status(400).json({ status: 'error', message: 'Invalid database payload' });
      return;
    }

    const mergedDb = handleIncomingSync(remoteDb);
    res.json({ status: 'success', data: mergedDb });
  } catch (error: any) {
    console.error('[SYNC API ERROR]', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get Leaderboard (Top 50)
app.get('/api/leaderboard', (req: Request, res: Response) => {
  try {
    const leaderboard = getLeaderboard().slice(0, 50);
    res.json({ status: 'success', data: leaderboard });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// ANNOUNCEMENT ENDPOINTS
// ==========================================

// Get global announcement
app.get('/api/announcement', (req: Request, res: Response) => {
  try {
    const text = getAnnouncement();
    res.json({ status: 'success', data: text });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update global announcement (Dev only)
app.post('/api/announcement/update', (req: Request, res: Response) => {
  try {
    const { uid, text } = req.body;
    if (!uid || text === undefined) {
      res.status(400).json({ status: 'error', message: 'UID dan isi pengumuman wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user || user.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur khusus Developer.' });
      return;
    }

    saveAnnouncement(text);
    res.json({ status: 'success', message: 'Pengumuman berhasil diperbarui.', data: text });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// NOTIFICATION BROADCAST ENDPOINTS
// ==========================================

// Get global notification text
app.get('/api/notification', (req: Request, res: Response) => {
  try {
    const text = getNotification();
    res.json({ status: 'success', data: text });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update global notification (Dev only)
app.post('/api/notification/update', (req: Request, res: Response) => {
  try {
    const { uid, text } = req.body;
    if (!uid || text === undefined) {
      res.status(400).json({ status: 'error', message: 'UID dan isi notifikasi wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user || user.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur khusus Developer.' });
      return;
    }

    saveNotification(text);
    res.json({ status: 'success', message: 'Notifikasi berhasil diperbarui & disiarkan.', data: text });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// SUPPORT TICKETS ENDPOINTS (Live Chat Help)
// ==========================================

// Create new support ticket
app.post('/api/tickets/create', (req: Request, res: Response) => {
  try {
    const { uid, message } = req.body;
    if (!uid || !message || !message.trim()) {
      res.status(400).json({ status: 'error', message: 'UID dan isi keluhan awal wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const tickets = getTickets();
    const newTicket = {
      id: 'TCK-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      uid,
      username: user.username,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'open' as const,
      messages: [
        {
          id: 'TMSG-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
          senderUid: uid,
          senderName: user.displayName || user.username,
          text: message.trim(),
          createdAt: new Date().toISOString()
        }
      ]
    };

    tickets.push(newTicket);
    saveTickets(tickets);

    res.json({ status: 'success', message: 'Tiket berhasil dibuka.', data: newTicket });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// List support tickets
app.get('/api/tickets/list', (req: Request, res: Response) => {
  try {
    const requesterUid = req.query.uid as string;
    if (!requesterUid) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const user = getUserByUid(requesterUid);
    if (!user) {
      res.status(401).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const tickets = getTickets();
    if (user.role === 'dev') {
      // Dev sees all tickets
      res.json({ status: 'success', data: tickets });
    } else {
      // Normal user only sees their own
      const myTickets = tickets.filter(t => t.uid === requesterUid);
      res.json({ status: 'success', data: myTickets });
    }
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Send message within a support ticket
app.post('/api/tickets/message/send', (req: Request, res: Response) => {
  try {
    const { uid, ticketId, text } = req.body;
    if (!uid || !ticketId || !text || !text.trim()) {
      res.status(400).json({ status: 'error', message: 'UID, ID tiket, dan isi pesan wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const tickets = getTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) {
      res.status(404).json({ status: 'error', message: 'Tiket tidak ditemukan.' });
      return;
    }

    const ticket = tickets[idx];
    // Check permission: must be either the ticket owner OR a developer
    if (ticket.uid !== uid && user.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      return;
    }

    // Auto-update status to active if a dev replies
    if (user.role === 'dev' && ticket.status === 'open') {
      ticket.status = 'active';
    }

    const newMsg = {
      id: 'TMSG-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      senderUid: uid,
      senderName: user.displayName || user.username,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    ticket.messages.push(newMsg);
    saveTickets(tickets);

    res.json({ status: 'success', data: ticket });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Close a support ticket
app.post('/api/tickets/close', (req: Request, res: Response) => {
  try {
    const { uid, ticketId } = req.body;
    if (!uid || !ticketId) {
      res.status(400).json({ status: 'error', message: 'UID dan ID tiket wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const tickets = getTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx === -1) {
      res.status(404).json({ status: 'error', message: 'Tiket tidak ditemukan.' });
      return;
    }

    const ticket = tickets[idx];
    if (ticket.uid !== uid && user.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      return;
    }

    ticket.status = 'closed' as const;
    saveTickets(tickets);

    res.json({ status: 'success', message: 'Tiket berhasil ditutup.', data: ticket });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// DEVELOPER MANAGEMENT ENDPOINTS
// ==========================================

// List all users for Developer Dashboard
app.get('/api/users/list', (req: Request, res: Response) => {
  try {
    const requesterUid = req.query.uid as string;
    if (!requesterUid) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const user = getUserByUid(requesterUid);
    if (!user || user.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      return;
    }

    const users = getUsers();
    const safeUsers = users.map(({ passwordHash: _, ...safeUser }) => safeUser);
    res.json({ status: 'success', data: safeUsers });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update user role to developer
app.post('/api/users/update-role', (req: Request, res: Response) => {
  try {
    const { uid, targetUid, newRole } = req.body;
    if (!uid || !targetUid || !newRole) {
      res.status(400).json({ status: 'error', message: 'UID, target UID, dan role baru wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user || user.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      return;
    }

    const updated = updateUser(targetUid, { role: newRole });
    if (!updated) {
      res.status(404).json({ status: 'error', message: 'Target user tidak ditemukan.' });
      return;
    }

    res.json({ status: 'success', message: 'Role berhasil diperbarui.', data: updated });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Reset user points and XP to 0 (Dev only)
app.post('/api/users/reset-score', (req: Request, res: Response) => {
  try {
    const { uid, targetUid } = req.body;
    if (!uid || !targetUid) {
      res.status(400).json({ status: 'error', message: 'UID dan target UID wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user || user.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      return;
    }

    const updated = updateUser(targetUid, { 
      poin: 0, 
      xp: 0,
      scoreUpdatedAt: new Date().toISOString()
    });
    if (!updated) {
      res.status(404).json({ status: 'error', message: 'Target user tidak ditemukan.' });
      return;
    }

    res.json({ status: 'success', message: 'Skor & XP pengguna berhasil direset.', data: updated });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Request manual QRIS top-up
app.post('/api/topup/request', (req: Request, res: Response) => {
  try {
    const { uid, amount, note, proof } = req.body;
    if (!uid || !amount || !proof) {
      res.status(400).json({ status: 'error', message: 'UID, nominal, dan bukti gambar wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    // Save as a special report in the system so the developer sees it instantly
    const reports = getReports();
    const newReport = {
      id: 'REP-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      uid,
      username: user.username,
      category: 'topup',
      message: `[TOPUP REQUEST] Koin: ${parseInt(amount).toLocaleString()} | Catatan: ${note || '-'}`,
      createdAt: new Date().toISOString(),
      status: 'menunggu' as const,
      proofImage: proof,
      topupAmount: parseInt(amount)
    };

    reports.push(newReport);
    saveReports(reports);

    res.json({ status: 'success', message: 'Permintaan top up berhasil dikirim.', data: newReport });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Approve topup request and give coins to user (Dev only)
app.post('/api/topup/approve', (req: Request, res: Response) => {
  try {
    const { uid, reportId } = req.body;
    if (!uid || !reportId) {
      res.status(400).json({ status: 'error', message: 'UID dan ID laporan wajib diisi.' });
      return;
    }

    const admin = getUserByUid(uid);
    if (!admin || admin.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak.' });
      return;
    }

    const reports = getReports();
    const reportIdx = reports.findIndex(r => r.id === reportId && r.category === 'topup');
    if (reportIdx === -1) {
      res.status(404).json({ status: 'error', message: 'Laporan topup tidak ditemukan.' });
      return;
    }

    const report = reports[reportIdx];
    if (report.status === 'selesai') {
      res.status(400).json({ status: 'error', message: 'Topup ini sudah diproses sebelumnya.' });
      return;
    }

    // Parse amount from report
    let coinAmount = report.topupAmount || 0;
    if (!coinAmount) {
      // Fallback: parse from message
      const match = report.message.match(/Koin:\s*([\d.,]+)/);
      if (match) {
        coinAmount = parseInt(match[1].replace(/[.,]/g, ''));
      }
    }

    if (coinAmount <= 0) {
      res.status(400).json({ status: 'error', message: 'Jumlah koin tidak valid.' });
      return;
    }

    // Give coins to user
    const targetUser = getUserByUid(report.uid);
    if (!targetUser) {
      res.status(404).json({ status: 'error', message: 'User pemilik topup tidak ditemukan.' });
      return;
    }

    updateUser(report.uid, {
      coins: (targetUser.coins || 0) + coinAmount
    });

    // Update report status to selesai
    reports[reportIdx].status = 'selesai';
    saveReports(reports);

    res.json({ status: 'success', message: `Topup ${coinAmount.toLocaleString()} koin berhasil dikirim ke @${targetUser.username}.`, data: reports[reportIdx] });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Buy subscription package using coins
app.post('/api/profile/buy-sub', (req: Request, res: Response) => {
  try {
    const { uid, tier, price, duration } = req.body;
    if (!uid || !tier || !price) {
      res.status(400).json({ status: 'error', message: 'UID, paket, dan harga wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const currentCoins = user.coins || 0;
    if (currentCoins < price) {
      res.status(400).json({ status: 'error', message: 'Koin Anda tidak cukup untuk membeli paket ini.' });
      return;
    }

    // Set dynamic active duration for purchased package (fallback to 30 days)
    const days = parseInt(duration) || 30;
    const date = new Date();
    date.setDate(date.getDate() + days);
    const activeUntil = date.toISOString();

    // Preserve 'dev' role if they purchase packages for testing
    const finalRole = user.role === 'dev' ? 'dev' : tier;

    // Save to user exchanges array
    const exchanges = user.exchanges || [];
    exchanges.push({
      id: 'TX-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      tier,
      price,
      duration: days,
      createdAt: new Date().toISOString()
    });

    const updated = updateUser(uid, {
      coins: currentCoins - price,
      role: finalRole,
      subActiveUntil: activeUntil,
      exchanges
    });

    res.json({ status: 'success', message: `Berhasil membeli paket ${tier.toUpperCase()}`, data: updated });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get User Transactions (both top-ups from reports and exchanges from user record)
app.get('/api/users/transactions', (req: Request, res: Response) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) {
      res.status(400).json({ status: 'error', message: 'UID wajib diisi.' });
      return;
    }

    const user = getUserByUid(uid);
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    // 1. Fetch topup requests from reports
    const reports = getReports();
    const userTopups = reports.filter(r => r.uid === uid && r.category === 'topup');

    // 2. Fetch exchanges from user object
    const userExchanges = user.exchanges || [];

    // Combine both into a cohesive transaction list
    const transactions = [
      ...userTopups.map(r => ({
        id: r.id,
        type: 'topup',
        title: `Top Up Koin via QRIS`,
        description: `Koin: ${r.topupAmount?.toLocaleString() || '0'} | ${r.message || ''}`,
        amount: r.topupAmount || 0,
        price: r.topupAmount || 0, // 1 coin = 1 IDR
        status: r.status, // 'menunggu' | 'proses' | 'selesai'
        createdAt: r.createdAt
      })),
      ...userExchanges.map((e: any) => ({
        id: e.id,
        type: 'exchange',
        title: `Tukar Koin ke Paket ${e.tier.toUpperCase()}`,
        description: `Durasi: ${e.duration === 'lifetime' || e.duration === 99999 ? 'Seumur Hidup' : `${e.duration} Hari`}`,
        amount: e.price,
        price: e.price,
        status: 'selesai',
        createdAt: e.createdAt
      }))
    ];

    // Sort transactions by date descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ status: 'success', data: transactions });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Gift Coins to user by UID (Dev/Admin only)
app.post('/api/users/gift-coins', (req: Request, res: Response) => {
  try {
    const { uid, targetUid, amount } = req.body;
    if (!uid || !targetUid || !amount) {
      res.status(400).json({ status: 'error', message: 'UID admin, target UID, dan jumlah koin wajib diisi.' });
      return;
    }

    const admin = getUserByUid(uid);
    if (!admin || admin.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur khusus Developer.' });
      return;
    }

    const targetUser = getUserByUid(targetUid);
    if (!targetUser) {
      res.status(404).json({ status: 'error', message: 'Target murid tidak ditemukan.' });
      return;
    }

    const updated = updateUser(targetUid, {
      coins: (targetUser.coins || 0) + parseInt(amount)
    });

    res.json({ status: 'success', message: 'Koin berhasil dikirim.', data: updated });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Gift Subscription package to user by UID (Dev/Admin only)
app.post('/api/users/gift-subscription', (req: Request, res: Response) => {
  try {
    const { uid, targetUid, tier, duration } = req.body;
    if (!uid || !targetUid || !tier) {
      res.status(400).json({ status: 'error', message: 'UID admin, target UID, dan paket wajib diisi.' });
      return;
    }

    const admin = getUserByUid(uid);
    if (!admin || admin.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur khusus Developer.' });
      return;
    }

    const targetUser = getUserByUid(targetUid);
    if (!targetUser) {
      res.status(404).json({ status: 'error', message: 'Target murid tidak ditemukan.' });
      return;
    }

    let activeUntil: string | undefined = undefined;
    if (duration === 'lifetime') {
      activeUntil = 'lifetime';
    } else if (duration) {
      const days = parseInt(duration);
      const date = new Date();
      date.setDate(date.getDate() + days);
      activeUntil = date.toISOString();
    } else {
      activeUntil = 'lifetime'; // fallback
    }

    const exchanges = targetUser.exchanges || [];
    exchanges.push({
      id: 'TX-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      tier,
      price: 0, // Gifted by developer (Rp 0)
      duration: duration === 'lifetime' ? 'lifetime' : (duration ? parseInt(duration) : 'lifetime'),
      createdAt: new Date().toISOString()
    });

    // Preserve 'dev' role if gifting packages
    const finalRole = targetUser.role === 'dev' ? 'dev' : tier;
    const updated = updateUser(targetUid, {
      role: finalRole,
      subActiveUntil: activeUntil,
      exchanges
    });

    res.json({ status: 'success', message: `Paket ${tier.toUpperCase()} berhasil diaktifkan.`, data: updated });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Clear warning acknowledgment for user
app.post('/api/profile/clear-warning', (req: Request, res: Response) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      res.status(400).json({ status: 'error', message: 'UID wajib diisi.' });
      return;
    }
    const updated = updateUser(uid, { warningSeen: true });
    if (!updated) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }
    res.json({ status: 'success', data: updated });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Clear force reset progress flag for user
app.post('/api/profile/clear-reset', (req: Request, res: Response) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      res.status(400).json({ status: 'error', message: 'UID wajib diisi.' });
      return;
    }
    // Remove the forceResetProgress flag by setting it to undefined
    const updated = updateUser(uid, { forceResetProgress: undefined } as any);
    if (!updated) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }
    res.json({ status: 'success', data: updated });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Exclusive Moderate API Suite for Developer Portal
app.post('/api/users/moderate', (req: Request, res: Response) => {
  try {
    const { uid, targetUid, action, durationHours, reason, warningMessage } = req.body;
    if (!uid || !targetUid || !action) {
      res.status(400).json({ status: 'error', message: 'UID, target UID, dan aksi wajib diisi.' });
      return;
    }

    const devUser = getUserByUid(uid);
    if (!devUser || devUser.role !== 'dev') {
      res.status(403).json({ status: 'error', message: 'Akses ditolak. Fitur khusus Developer.' });
      return;
    }

    const targetUser = getUserByUid(targetUid);
    if (!targetUser) {
      res.status(404).json({ status: 'error', message: 'Target pengguna tidak ditemukan.' });
      return;
    }

    let updated: User | undefined = targetUser;

    switch (action) {
      case 'reset':
        // Full Reset to default values
        updated = updateUser(targetUid, {
          poin: 0,
          xp: 0,
          deskripsi: 'Halo! Saya sedang belajar Bahasa Jepang.',
          ttl: '-',
          profileBackground: '',
          forceResetProgress: true, // triggers localStorage wipe on client side
          scoreUpdatedAt: new Date().toISOString()
        });
        break;

      case 'ban_temp':
        const hours = parseFloat(durationHours || '1');
        const banExpiration = new Date(Date.now() + hours * 3600000).toISOString();
        updated = updateUser(targetUid, {
          bannedUntil: banExpiration,
          banReason: reason || `Melanggar peraturan komunitas (${hours} jam).`
        });
        break;

      case 'ban_perm':
        updated = updateUser(targetUid, {
          bannedUntil: 'permanent',
          banReason: reason || 'Melanggar peraturan komunitas secara permanen.'
        });
        break;

      case 'unban':
        // Safe type assertions to clear flags
        updated = updateUser(targetUid, {
          bannedUntil: undefined,
          banReason: undefined
        } as any);
        break;

      case 'ban_ip':
        if (targetUser.registeredIp) {
          banIp(targetUser.registeredIp);
        } else {
          res.status(400).json({ status: 'error', message: 'Target pengguna belum memiliki IP terdaftar.' });
          return;
        }
        break;

      case 'unban_ip':
        if (targetUser.registeredIp) {
          unbanIp(targetUser.registeredIp);
        } else {
          res.status(400).json({ status: 'error', message: 'Target pengguna tidak memiliki IP terdaftar.' });
          return;
        }
        break;

      case 'ban_device':
        if (targetUser.deviceId) {
          banDevice(targetUser.deviceId);
        } else {
          res.status(400).json({ status: 'error', message: 'Target pengguna belum memiliki Device ID terdaftar.' });
          return;
        }
        break;

      case 'unban_device':
        if (targetUser.deviceId) {
          unbanDevice(targetUser.deviceId);
        } else {
          res.status(400).json({ status: 'error', message: 'Target pengguna tidak memiliki Device ID terdaftar.' });
          return;
        }
        break;

      case 'warn':
        updated = updateUser(targetUid, {
          warningMessage: warningMessage || 'Harap patuhi ketentuan penggunaan Zenith Nihongo.',
          warningSeen: false
        });
        break;

      case 'clear_warn':
        updated = updateUser(targetUid, {
          warningMessage: undefined,
          warningSeen: undefined
        } as any);
        break;

      default:
        res.status(400).json({ status: 'error', message: 'Aksi moderasi tidak dikenal.' });
        return;
    }

    res.json({ 
      status: 'success', 
      message: `Tindakan '${action}' berhasil diterapkan ke @${targetUser.username}.`, 
      data: updated,
      globalBannedIps: getBannedIps(),
      globalBannedDevices: getBannedDevices()
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});


// ==========================================
// SECURE SERVER-SIDE GEMINI AI ENDPOINTS
// ==========================================

// Gemini smart Tip/Mnemonic for characters
app.post('/api/gemini/tip', async (req: Request, res: Response) => {
  try {
    const { char, romaji, mean } = req.body;
    if (!char) {
      res.status(400).json({ status: 'error', message: 'Karakter dibutuhkan.' });
      return;
    }

    const prompt = `Berikan 1 tips hafalan singkat (maksimal 15 kata, Bahasa Indonesia) untuk mengingat karakter Jepang "${char}" yang dibaca "${romaji}"` + 
                   (mean ? ` dengan arti "${mean}"` : '') + 
                   `. Contoh format: "Ingat bentuk あ seperti huruf 'a' yang ditulis cepat"`;

    const client = getGenAI();
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    res.json({ status: 'success', tip: response.text || 'Terus berlatih, kamu pasti bisa!' });
  } catch (error: any) {
    console.error('Gemini error:', error);
    res.json({ status: 'success', tip: 'Menggali inspirasi mandiri... Terus berlatih!' });
  }
});

// Gemini Interactive Quiz Generator with strict Type System Schema
app.post('/api/gemini/quiz', async (req: Request, res: Response) => {
  try {
    const { levelName } = req.body;
    const levelStr = levelName || 'N5';

    const prompt = `Buat 1 soal kuis bahasa Jepang interaktif untuk level ${levelStr} beserta pilihan jawabannya dan penjelasannya.`;

    const client = getGenAI();
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Anda adalah pembuat soal kuis bahasa Jepang profesional tingkat tinggi.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            soal: { 
              type: Type.STRING, 
              description: 'Karakter Jepang, kata, atau kalimat yang ditanyakan (misal: "熟", "こんにちは", dsb).' 
            },
            tipe: { 
              type: Type.STRING, 
              description: 'Pertanyaan eksplisit (misal: "Apa arti kanji di atas?", "Bagaimana cara baca hiragana ini?", dsb).' 
            },
            jawaban_benar: { 
              type: Type.STRING, 
              description: 'Jawaban yang tepat sesuai soal.' 
            },
            pilihan: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array berisi empat pilihan jawaban yang masuk akal namun hanya ada satu yang benar. Jawaban benar wajib ada di dalam array ini.'
            },
            penjelasan: { 
              type: Type.STRING, 
              description: 'Penjelasan singkat informatif dalam bahasa Indonesia tentang jawaban yang benar.' 
            }
          },
          required: ['soal', 'tipe', 'jawaban_benar', 'pilihan', 'penjelasan']
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Respons kosong dari AI');
    }

    const questionData = JSON.parse(text);
    res.json({ status: 'success', data: questionData });
  } catch (error: any) {
    console.error('Quiz Generation Error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal men-generate soal AI. Silakan coba kuis konvensional terlebih dahulu.' });
  }
});

// secure teacher chat (Sensei AI) endpoint
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { messages, character } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ status: 'error', message: 'History chat dibutuhkan dalam bentuk array.' });
      return;
    }

    const charId = character || 'default';
    let chatContext = `Kamu adalah Sensei AI, asisten tutor bahasa Jepang profesional. Jawab dalam Bahasa Indonesia yang ramah, ringkas, dan jelas.
Gunakan format terstruktur apabila mengajar kosa kata/kanji baru:
Kanji/Kana: [Karakter]
Romaji: [Romaji]
Arti: [Arti]
Contoh: [Kalimat] ([Romaji]) - [Arti kalimat].
Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca di layar HP/komputer.`;

    switch (charId) {
      case 'mahiru':
        chatContext = `Kamu adalah Shina Mahiru (椎名真昼), karakter gadis SMA yang sangat manis, sopan, tenang, lembut, penuh perhatian, dan hangat bagai malaikat dari 'The Angel Next Door Spoils Me Rotten'. 
Bicaralah sebagai Shina Mahiru yang ramah, sopan, agak pemalu namun sangat peduli dan ingin membantu lawan bicaramu belajar bahasa Jepang.
Gunakan Bahasa Indonesia yang manis, sopan, dan terstruktur. Selipkan kepedulian khas Mahiru. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
        break;
      case 'umi':
        chatContext = `Kamu adalah Asanagi Umi (朝凪海), karakter gadis SMA yang ceria, tomboi, santai, blak-blakan, bersahabat, aktif, dan sedikit jahil dari 'You Like Me, Not My Daughter?'.
Bicaralah dengan gaya bahasa santai, gaul, bersahabat, penuh energi, anggap lawan bicaramu teman dekat.
Jelaskan bahasa Jepang secara seru dan asyik. Gunakan Bahasa Indonesia yang santai dan aktif. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
        break;
      case 'nagisa':
        chatContext = `Kamu adalah Kubo Nagisa (久保渚咲), karakter gadis SMA yang super imut, manis, jahil, suka menggoda, manja, lembut, dan penuh kehangatan dari 'Kubo Won't Let Me Be Invisible'.
Bicaralah dengan gaya yang imut, manja, lembut, suka bercanda menggoda lawan bicaramu, selipkan ketawa kecil imut ('Fufu~').
Jelaskan bahasa Jepang secara manis dan manja dalam Bahasa Indonesia. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
        break;
      case 'furina':
        chatContext = `Kamu adalah Furina (フリーナ), sang aktris teater dan mantan Hydro Archon yang dramatis, percaya diri tinggi, elegan, flamboyan, namun sebenarnya manis dan peduli dari Genshin Impact.
Bicaralah dengan gaya teatrikal, dramatis, percaya diri tinggi, anggun, dengan intonasi megah, namun ramah.
Ajarkan bahasa Jepang dengan bangga dan dramatis dalam Bahasa Indonesia. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
        break;
      case 'hutao':
        chatContext = `Kamu adalah Hu Tao (胡桃), Direktur Wangsheng Funeral Parlor yang jahil, hiperaktif, nakal, menyukai hal seram, ceria, dan suka berpantun dari Genshin Impact.
Bicaralah dengan gaya yang lincah, berenergi tinggi, sedikit seram-ceria, penuh pantun, jahil, dan sangat riang.
Ajarkan bahasa Jepang dengan seru dan penuh canda tawa dalam Bahasa Indonesia. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
        break;
      case 'columbina':
        chatContext = `Kamu adalah Columbina (コロンビーナ), sang Damselette dari Fatui Harbingers yang bersuara sangat lembut, tenang bagai malaikat misterius, penuh kedamaian, misterius, agak dingin namun lembut.
Bicaralah sangat pelan, misterius, puitis, dan penuh ketenangan yang anggun.
Jelaskan bahasa Jepang secara misterius and sangat lembut dalam Bahasa Indonesia. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
        break;
      case 'kyoko':
        chatContext = `Kamu adalah Kyoko Hori (堀京子), siswi SMA yang mandiri, pintar, blak-blakan, penuh semangat, tegas, namun sangat hangat dan peduli dari Horimiya.
Bicaralah dengan jujur, tegas, berenergi tinggi, blak-blakan, ramah, dan bersahabat.
Jelaskan bahasa Jepang secara to-the-point dan cerdas dalam Bahasa Indonesia. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
        break;
    }

    // Process formats for @google/genai SDK (messages should be in the correct parts structure)
    // Map roles 'user' and 'ai'/'model' to 'user' and 'model'
    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const client = getGenAI();
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: formattedContents,
      config: {
        systemInstruction: chatContext,
        temperature: 0.75,
      }
    });

    res.json({ status: 'success', reply: response.text || 'Maaf, Sensei kurang paham. Coba ulangi pertanyaannya ya!' });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ status: 'error', message: 'Maaf, Sensei sedang istirahat sejenak.' });
  }
});

// secure character speech generation (TTS AI acting) endpoint
function convertPcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const subChunk2Size = pcmBuffer.length;
  const chunkSize = 36 + subChunk2Size;

  const header = Buffer.alloc(44);

  // RIFF identifier
  header.write('RIFF', 0);
  // file length
  header.writeUInt32LE(chunkSize, 4);
  // WAVE identifier
  header.write('WAVE', 8);
  // Fmt subchunk identifier
  header.write('fmt ', 12);
  // format chunk length
  header.writeUInt32LE(16, 16);
  // sample format (raw PCM)
  header.writeUInt16LE(1, 20);
  // channel count
  header.writeUInt16LE(numChannels, 22);
  // sample rate
  header.writeUInt32LE(sampleRate, 24);
  // byte rate (sample rate * block align)
  header.writeUInt32LE(byteRate, 28);
  // block align (channel count * bytes per sample)
  header.writeUInt16LE(blockAlign, 32);
  // bits per sample
  header.writeUInt16LE(bitsPerSample, 34);
  // data subchunk identifier
  header.write('data', 36);
  // data chunk length
  header.writeUInt32LE(subChunk2Size, 40);

  return Buffer.concat([header, pcmBuffer]);
}

interface TtsCacheEntry {
  audio: string;
  mimeType: string;
  timestamp: number;
}
const ttsCache = new Map<string, TtsCacheEntry>();
const MAX_CACHE_SIZE = 1000;

app.post('/api/gemini/tts', async (req: Request, res: Response) => {
  try {
    const { text, character } = req.body;
    if (!text) {
      res.status(400).json({ status: 'error', message: 'Teks bahasa Jepang wajib diisi.' });
      return;
    }

    const charId = character || 'default';
    const cacheKey = `${charId}:${text.trim()}`;
    
    // Serve from server-side memory cache if exists to preserve precious API quota!
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      res.json({ status: 'success', audio: cached.audio, mimeType: cached.mimeType, cached: true });
      return;
    }

    let systemInstruction = "Speak the following phrase in Japanese with a clear, natural, and highly expressive human assistant voice. Avoid flat, robotic, or synthetic speech.";
    let voiceName = "Kore"; // Prebuilt high-quality expressive female voice

    switch (charId) {
      case 'mahiru':
        systemInstruction = "You are acting as Shina Mahiru (椎名真昼) from 'The Angel Next Door Spoils Me Rotten', voiced by Iwami Manaka. Speak the Japanese phrase in an extremely quiet, sweet, serene, whispery, airy, delicate, and gentle Japanese female voice. Speak slowly with a highly expressive, human, warm, comforting, and highly polite tone of a mature yet sweet girl. Absolutely avoid any robotic, flat, or synthetic pacing. Keep your pitch in the sweet low-to-medium range.";
        voiceName = "Kore";
        break;
      case 'umi':
        systemInstruction = "You are acting as Asanagi Umi (朝凪海). Speak the following Japanese phrase in a highly energetic, cheerful, tomboyish, active, friendly, and spirited young schoolgirl voice. Sound lively, emotional, and 100% natural, avoiding any flat or synthetic robotic cadence.";
        voiceName = "Aoede";
        break;
      case 'nagisa':
        systemInstruction = "You are acting as Kubo Nagisa (久保渚咲). Speak the following Japanese phrase in a sweet, extremely cute, affectionate, gently whispering, teasing, and playful female voice. Sound completely endearing, lively, expressive, and human, avoiding any robotic tones.";
        voiceName = "Kore";
        break;
      case 'furina':
        systemInstruction = "You are acting as Furina (フリーナ). Speak the following Japanese phrase in an enthusiastic, theatrical, grandly dramatic, cute, elegant princess-like, and highly confident stage voice! Speak with full dramatic expressions, human timing, and royal elegance.";
        voiceName = "Aoede";
        break;
      case 'hutao':
        systemInstruction = "You are acting as Hu Tao (胡桃). Speak the following Japanese phrase in a highly energetic, fast-paced, mischievous, spooky-cheerful, and playful childish voice. Speak with full emotional expressiveness, playful laughter, and lively human pacing.";
        voiceName = "Aoede";
        break;
      case 'columbina':
        systemInstruction = "You are acting as Columbina (コロンビーナ). Speak the following Japanese phrase in an extremely soft, quiet, whispery, airy, dreamy, and highly peaceful angelic voice. Speak very slowly, with a deeply soothing, calm, puitc, and completely natural human voice.";
        voiceName = "Kore";
        break;
      case 'kyoko':
        systemInstruction = "You are acting as Kyoko Hori (堀京子). Speak the following Japanese phrase in an active, bright, and assertive teenage girl voice. Sound warm, direct, smart, fully energetic, emotional, and natural.";
        voiceName = "Aoede";
        break;
    }

    const client = getGenAI();
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: `${systemInstruction}\n\nPhrase to speak:\n"${text}"` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    let base64Audio: string | undefined;
    let returnedMimeType = 'audio/mp3';

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        base64Audio = part.inlineData.data;
        returnedMimeType = part.inlineData.mimeType || 'audio/mp3';
        break;
      }
    }

    if (!base64Audio) {
      throw new Error("Gagal mengambil respon audio dari Gemini.");
    }

    // Convert raw PCM to clean playable WAV if necessary so standard desktop and mobile browsers can play it natively
    if (returnedMimeType.toLowerCase().includes('pcm') || returnedMimeType.toLowerCase().includes('l16')) {
      try {
        const rawPcmBuffer = Buffer.from(base64Audio, 'base64');
        const match = returnedMimeType.match(/rate=(\d+)/i);
        const sampleRate = match ? parseInt(match[1], 10) : 24000;
        const wavBuffer = convertPcmToWav(rawPcmBuffer, sampleRate);
        base64Audio = wavBuffer.toString('base64');
        returnedMimeType = 'audio/wav';
        console.log(`[TTS SUCCESS] Successfully converted raw PCM (${sampleRate}Hz) to clean playable WAV for: "${text}"`);
      } catch (e) {
        console.error('Error converting PCM to WAV:', e);
      }
    }

    // Save to cache
    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey !== undefined) {
        ttsCache.delete(firstKey);
      }
    }
    ttsCache.set(cacheKey, { audio: base64Audio, mimeType: returnedMimeType, timestamp: Date.now() });

    res.json({ status: 'success', audio: base64Audio, mimeType: returnedMimeType });
  } catch (error: any) {
    const errString = String(error?.message || error?.stack || error || '');
    const isQuotaError = errString.includes('429') || 
                         errString.toLowerCase().includes('quota') || 
                         errString.includes('RESOURCE_EXHAUSTED') ||
                         error?.status === 429 ||
                         error?.statusCode === 429 ||
                         error?.code === 429 ||
                         (error?.error && (error.error.code === 429 || String(error.error.message).toLowerCase().includes('quota')));
                         
    if (isQuotaError) {
      console.warn('[TTS] Gemini 429 Quota Exceeded. Client will safely redirect to local voice fallback.');
      res.status(429).json({ 
        status: 'quota_exceeded', 
        message: 'Batas limit harian gratis AI Gemini tercapai. Beralih otomatis ke Suara Cloud!' 
      });
      return;
    }
    console.error('Gemini TTS unexpected error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal membuat suara karakter AI.' });
  }
});

// GET endpoint to directly stream WAV audio to the client for instant, native playing inside Capacitor APK
app.get('/api/gemini/tts-play', async (req: Request, res: Response) => {
  const text = req.query.text as string;
  const character = req.query.character as string || 'default';
  
  try {
    if (!text) {
      res.status(400).send('Teks wajib diisi.');
      return;
    }

    const charId = character;
    const cacheKey = `${charId}:${text.trim()}`;

    // 1. Check server-side cache first to avoid API lag
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      const audioBuffer = Buffer.from(cached.audio, 'base64');
      res.setHeader('Content-Type', cached.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache in browser for 1 year!
      res.send(audioBuffer);
      return;
    }

    let systemInstruction = "Speak the following phrase in Japanese with a clear, natural, and highly expressive human assistant voice. Avoid flat, robotic, or synthetic speech.";
    let voiceName = "Kore"; // Prebuilt high-quality expressive female voice

    switch (charId) {
      case 'mahiru':
        systemInstruction = "You are acting as Shina Mahiru (椎名真昼) from 'The Angel Next Door Spoils Me Rotten', voiced by Iwami Manaka. Speak the Japanese phrase in an extremely quiet, sweet, serene, whispery, airy, delicate, and gentle Japanese female voice. Speak slowly with a highly expressive, human, warm, comforting, and highly polite tone of a mature yet sweet girl. Absolutely avoid any robotic, flat, or synthetic pacing. Keep your pitch in the sweet low-to-medium range.";
        voiceName = "Kore";
        break;
      case 'umi':
        systemInstruction = "You are acting as Asanagi Umi (朝凪海). Speak the following Japanese phrase in a highly energetic, cheerful, tomboyish, active, friendly, and spirited young schoolgirl voice. Sound lively, emotional, and 100% natural, avoiding any flat or synthetic robotic cadence.";
        voiceName = "Aoede";
        break;
      case 'nagisa':
        systemInstruction = "You are acting as Kubo Nagisa (久保渚咲). Speak the following Japanese phrase in a sweet, extremely cute, affectionate, gently whispering, teasing, and playful female voice. Sound completely endearing, lively, expressive, and human, avoiding any robotic tones.";
        voiceName = "Kore";
        break;
      case 'furina':
        systemInstruction = "You are acting as Furina (フリーナ). Speak the following Japanese phrase in an enthusiastic, theatrical, grandly dramatic, cute, elegant princess-like, and highly confident stage voice! Speak with full dramatic expressions, human timing, and royal elegance.";
        voiceName = "Aoede";
        break;
      case 'hutao':
        systemInstruction = "You are acting as Hu Tao (胡桃). Speak the following Japanese phrase in a highly energetic, fast-paced, mischievous, spooky-cheerful, and playful childish voice. Speak with full emotional expressiveness, playful laughter, and lively human pacing.";
        voiceName = "Aoede";
        break;
      case 'columbina':
        systemInstruction = "You are acting as Columbina (コロンビーナ). Speak the following Japanese phrase in an extremely soft, quiet, whispery, airy, dreamy, and highly peaceful angelic voice. Speak very slowly, with a deeply soothing, calm, puitc, and completely natural human voice.";
        voiceName = "Kore";
        break;
      case 'kyoko':
        systemInstruction = "You are acting as Kyoko Hori (堀京子). Speak the following Japanese phrase in an active, bright, and assertive teenage girl voice. Sound warm, direct, smart, fully energetic, emotional, and natural.";
        voiceName = "Aoede";
        break;
    }

    const client = getGenAI();
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: `${systemInstruction}\n\nPhrase to speak:\n"${text}"` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    let base64Audio: string | undefined;
    let returnedMimeType = 'audio/mp3';

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        base64Audio = part.inlineData.data;
        returnedMimeType = part.inlineData.mimeType || 'audio/mp3';
        break;
      }
    }

    if (!base64Audio) {
      throw new Error("Gagal mengambil respon audio dari Gemini.");
    }

    let audioBuffer = Buffer.from(base64Audio, 'base64');
    if (returnedMimeType.toLowerCase().includes('pcm') || returnedMimeType.toLowerCase().includes('l16')) {
      try {
        const rawPcmBuffer = Buffer.from(base64Audio, 'base64');
        const match = returnedMimeType.match(/rate=(\d+)/i);
        const sampleRate = match ? parseInt(match[1], 10) : 24000;
        audioBuffer = convertPcmToWav(rawPcmBuffer, sampleRate);
        base64Audio = audioBuffer.toString('base64');
        returnedMimeType = 'audio/wav';
      } catch (e) {
        console.error('Error converting PCM to WAV:', e);
      }
    }

    // Save to cache
    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey !== undefined) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, { audio: base64Audio, mimeType: returnedMimeType, timestamp: Date.now() });

    res.setHeader('Content-Type', returnedMimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(audioBuffer);

  } catch (error: any) {
    console.warn('[TTS Play Fallback] Gemini TTS error, returning 429 status code for client SpeechSynthesis fallback:', error?.message || error);
    res.status(429).send('Gemini TTS error or quota exceeded. Falling back to client-side premium SpeechSynthesis.');
  }
});

// ==========================================
// VITE DEV SERVER / STATIC ASSETS PIPELINE
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Integrate Vite in development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    // Resolve distPath relative to directory structure safely
    let distPath = path.join(__dirname, 'dist');
    if (!fs.existsSync(distPath)) {
      // If run from inside 'dist' folder (bundled CJS mode)
      distPath = __dirname;
      if (!fs.existsSync(path.join(distPath, 'index.html'))) {
        // Fallback to process.cwd()
        distPath = path.join(process.cwd(), 'dist');
      }
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start periodic database sync with peer every 30 seconds if configured
  if (process.env.SYNC_PEER_URL) {
    console.log(`[SYNC] Initializing background peer sync with: ${process.env.SYNC_PEER_URL}`);
    // Run initial sync after 5 seconds to catch up
    setTimeout(() => {
      syncWithPeer().catch(console.error);
    }, 5000);

    setInterval(() => {
      syncWithPeer().catch(console.error);
    }, 30000);
  }

  const isSocket = isNaN(Number(PORT));
  if (isSocket) {
    app.listen(PORT, () => {
      console.log(`[INF] Nihongo Master Server booting on socket ${PORT}`);
    });
  } else {
    const portNum = parseInt(PORT as string, 10);
    app.listen(portNum, '0.0.0.0', () => {
      console.log(`[INF] Nihongo Master Server booting on port ${portNum}`);
    });
  }
}

startServer();
