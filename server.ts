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
  saveUsers
} from './server/db.js';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

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

import nodemailer from 'nodemailer';

// Store OTPs in-memory (Map of email -> { otp, expires })
const tempOtps = new Map<string, { otp: string; expires: number }>();

async function sendOtpEmail(email: string, otp: string): Promise<{ success: boolean; isMock: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const senderName = process.env.SMTP_SENDER_NAME || 'Nihongo Master OTP';

  if (!host || !user || !pass) {
    console.log(`[SMTP DEV Sandbox] OTP for ${email} is: ${otp}. Config SMTP_HOST, SMTP_USER, SMTP_PASS in .env to send real email.`);
    return { success: true, isMock: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: {
        user: user,
        pass: pass,
      },
      tls: {
        rejectUnauthorized: false, // Prevents certificate self-sign issues on Domainesia/cPanel SMTP servers
      },
    });

    const mailOptions = {
      from: `"${senderName}" <${user}>`,
      to: email,
      subject: `[Nihongo Master] Kode Verifikasi OTP Pendaftaran - ${otp}`,
      html: `
        <div style="background-color: #0b071e; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e2e8f0; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #130d32 0%, #1a1040 100%); border: 1px solid #7c3aed; border-radius: 24px; padding: 30px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);">
            <div style="font-size: 40px; margin-bottom: 20px;">⛩️</div>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin-bottom: 10px; letter-spacing: 0.5px;">Verifikasi Akun Nihongo Master</h1>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-bottom: 25px;">
              Terima kasih telah bergabung! Gunakan kode One-Time Password (OTP) di bawah ini untuk memverifikasi alamat email Anda dan menyelesaikan pendaftaran.
            </p>
            <div style="background-color: #070412; border: 1px dashed #ec4899; border-radius: 16px; padding: 15px 30px; display: inline-block; margin-bottom: 25px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 900; color: #ff007f; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #64748b; font-size: 11px; margin-top: 10px;">
              Kode ini berlaku selama 10 menit. Jangan membagikan kode ini kepada siapa pun. Jika Anda tidak melakukan pendaftaran ini, abaikan email ini.
            </p>
            <div style="margin-top: 30px; border-top: 1px solid rgba(124, 58, 237, 0.2); padding-top: 20px; font-size: 11px; color: #475569;">
              Nihongo Master App • Pembelajaran Interaktif Bahasa Jepang
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[SMTP PROD] OTP email successfully sent to ${email} via ${host}:${port}`);
    return { success: true, isMock: false };
  } catch (error: any) {
    console.error('[SMTP ERROR] Failed to send OTP email:', error);
    return { success: false, isMock: false, error: error.message };
  }
}

async function verifyTurnstile(token?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY || '2x00000000000000000000000000000000AB';
  if (!token) return false;
  
  // Allow native Capacitor APK bypass — Turnstile widget cannot load inside Android WebView
  if (token === 'native-apk-bypass') {
    console.log('[TURNSTILE] Native APK bypass token accepted.');
    return true;
  }
  
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`
    });
    const data = await res.json() as any;
    console.log('[TURNSTILE] Verification result:', data.success, data['error-codes'] || '');
    return !!data.success;
  } catch (error) {
    console.error('[TURNSTILE ERROR]', error);
    return false;
  }
}


// Manual Registration (Direct Backup Endpoint)
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { email, username, password, displayName } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ status: 'error', message: 'Lengkapi semua field pendaftaran.' });
      return;
    }

    const existingEmail = getUserByEmail(email);
    if (existingEmail) {
      res.status(400).json({ status: 'error', message: 'Email sudah terdaftar.' });
      return;
    }

    const existingUsername = getUserByUsername(username);
    if (existingUsername) {
      res.status(400).json({ status: 'error', message: 'Username sudah digunakan.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const newUser = createUser({
      email,
      username,
      passwordHash,
      displayName: displayName || username,
      avatar: '',
    });

    const { passwordHash: _, ...safeUser } = newUser;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Request Registration OTP Endpoint
app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
  try {
    const { email, username, turnstileToken } = req.body;
    const isVerified = await verifyTurnstile(turnstileToken);
    if (!isVerified) {
      res.status(400).json({ status: 'error', message: 'Verifikasi keamanan bot (Cloudflare Turnstile) gagal. Silakan coba lagi.' });
      return;
    }


    if (!email || !username) {
      res.status(400).json({ status: 'error', message: 'Email dan username harus ditentukan.' });
      return;
    }

    const existingEmail = getUserByEmail(email);
    if (existingEmail) {
      res.status(400).json({ status: 'error', message: 'Email sudah terdaftar.' });
      return;
    }

    const existingUsername = getUserByUsername(username);
    if (existingUsername) {
      res.status(400).json({ status: 'error', message: 'Username sudah digunakan.' });
      return;
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    tempOtps.set(email.toLowerCase(), {
      otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes verification window
    });

    const mailResult = await sendOtpEmail(email, otp);

    if (mailResult.success) {
      if (mailResult.isMock) {
        res.json({
          status: 'success',
          isMock: true,
          debugOtp: otp,
          message: 'Silakan atur kredensial SMTP Domainesia di file .env Anda untuk pengiriman langsung email ke Gmail. OTP Sandbox otomatis dibuat untuk pengujian.'
        });
      } else {
        res.json({
          status: 'success',
          isMock: false,
          message: 'Kode OTP telah berhasil dikirim ke Gmail Anda!'
        });
      }
    } else {
      res.status(500).json({
        status: 'error',
        message: `Gagal mengirim email: ${mailResult.error || 'SMTP Error'}. Pastikan kredensial SMTP Domainesia Anda di .env valid.`
      });
    }
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Register with OTP Endpoint
app.post('/api/auth/register-with-otp', (req: Request, res: Response) => {
  try {
    const { email, username, password, displayName, otp } = req.body;
    if (!email || !username || !password || !otp) {
      res.status(400).json({ status: 'error', message: 'Seluruh bidang pendaftaran dan OTP wajib diisi.' });
      return;
    }

    const cached = tempOtps.get(email.toLowerCase());
    if (!cached) {
      res.status(400).json({ status: 'error', message: 'Sesi OTP tidak ditemukan atau sudah kedaluwarsa.' });
      return;
    }

    if (cached.expires < Date.now()) {
      tempOtps.delete(email.toLowerCase());
      res.status(400).json({ status: 'error', message: 'Kode OTP telah kedaluwarsa setelah 10 menit.' });
      return;
    }

    if (cached.otp !== otp) {
      res.status(400).json({ status: 'error', message: 'Kode OTP yang dimasukkan tidak cocok.' });
      return;
    }

    // OTP verification successful!
    tempOtps.delete(email.toLowerCase());

    const existingEmail = getUserByEmail(email);
    if (existingEmail) {
      res.status(400).json({ status: 'error', message: 'Email sudah terdaftar.' });
      return;
    }

    const existingUsername = getUserByUsername(username);
    if (existingUsername) {
      res.status(400).json({ status: 'error', message: 'Username sudah digunakan.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const newUser = createUser({
      email,
      username,
      passwordHash,
      displayName: displayName || username,
      avatar: '',
    });

    const { passwordHash: _, ...safeUser } = newUser;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Direct Registration Endpoint (Bypassing OTP)
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { email, username, password, displayName } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ status: 'error', message: 'Seluruh bidang pendaftaran wajib diisi.' });
      return;
    }

    const existingEmail = getUserByEmail(email);
    if (existingEmail) {
      res.status(400).json({ status: 'error', message: 'Email sudah terdaftar.' });
      return;
    }

    const existingUsername = getUserByUsername(username);
    if (existingUsername) {
      res.status(400).json({ status: 'error', message: 'Username sudah digunakan.' });
      return;
    }

    const passwordHash = hashPassword(password);
    const newUser = createUser({
      email,
      username,
      passwordHash,
      displayName: displayName || username,
      avatar: '',
    });

    const { passwordHash: _, ...safeUser } = newUser;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Manual Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, turnstileToken } = req.body;


    if (!email || !password) {
      res.status(400).json({ status: 'error', message: 'Email dan password harus diisi.' });
      return;
    }

    const user = getUserByEmail(email);
    const hash = hashPassword(password);
    if (!user || user.passwordHash !== hash) {
      res.status(400).json({ status: 'error', message: 'Email atau password salah.' });
      return;
    }

    const { passwordHash: _, ...safeUser } = user;
    res.json({ status: 'success', data: safeUser });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Google Login/Oauth
app.post('/api/auth/google', (req: Request, res: Response) => {
  try {
    const { email, displayName, avatar } = req.body;
    if (!email) {
      res.status(400).json({ status: 'error', message: 'Email Google tidak valid.' });
      return;
    }

    const av = avatar || '';
    const name = displayName || email.split('@')[0];



    let user = getUserByEmail(email);
    if (user) {
      // ONLY update displayName or avatar if they are blank/empty in the database to preserve user's custom edits!
      const updateData: any = {};
      if (!user.displayName || user.displayName === 'undefined' || user.displayName === '') {
        updateData.displayName = name;
      }
      if (!user.avatar || user.avatar === 'undefined' || user.avatar === '') {
        updateData.avatar = av;
      }
      if (Object.keys(updateData).length > 0) {
        const updated = updateUser(user.uid, updateData);
        if (updated) user = updated;
      }
    } else {
      // Autocreate user
      const uniqueSuffix = Math.floor(100 + Math.random() * 900);
      const generatedUsername = email.split('@')[0] + uniqueSuffix;
      user = createUser({
        email,
        username: generatedUsername,
        passwordHash: hashPassword(generateUID()), // random secure pass
        displayName: name,
        avatar: av,
      });
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
    const { uid, displayName, username, avatar, deskripsi, ttl } = req.body;
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

    const existingUser = getUserByUid(uid);
    if (!existingUser) {
      res.status(404).json({ status: 'error', message: 'User tidak ditemukan.' });
      return;
    }

    const updateFields: any = {
      displayName: displayName || existingUser.displayName,
      username: username || existingUser.username,
      deskripsi: deskripsi !== undefined ? deskripsi : existingUser.deskripsi,
      ttl: ttl !== undefined ? ttl : existingUser.ttl,
    };

    if (avatar) {
      updateFields.avatar = avatar;
    }

    const updated = updateUser(uid, updateFields);

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
      model: 'gemini-3.5-flash',
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
      model: 'gemini-3.5-flash',
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
Jelaskan bahasa Jepang secara misterius dan sangat lembut dalam Bahasa Indonesia. Batasi jawaban maksimal 3-4 kalimat agar nyaman dibaca.`;
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
      model: 'gemini-3.5-flash',
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

    let systemInstruction = "Speak the following phrase in Japanese with a clear, natural, and helpful assistant voice.";
    let voiceName = "Kore"; // Classic clear expressive Japanese female voice

    switch (charId) {
      case 'mahiru':
        systemInstruction = "You are acting as Shina Mahiru (椎名真昼) from 'The Angel Next Door Spoils Me Rotten' (CV: Iwami Manaka). Speak the following phrase in its written language (either Japanese or Indonesian) in an extremely soft, quiet, whispering, gentle, sweet, and comforting voice. Speak slowly with a calm, relaxing, and extremely polite tone of a sweet high school girl. Keep your pitch low-to-medium, avoiding any high-pitched or squeaky anime girl sounds. Exude maximum warmth, elegant grace, and angelic comfort.";
        voiceName = "Kore";
        break;
      case 'umi':
        systemInstruction = "You are acting as Asanagi Umi (朝凪海) from 'You Like Me, Not My Daughter?' (CV: Hasegawa Ikumi). Speak the following phrase in its written language (either Japanese or Indonesian) in a lively, cheerful, tomboyish, active, friendly, and spirited young schoolgirl voice. Sound highly natural, casual, and energetic, conveying the vibe of a plucky, confident, and cool close friend.";
        voiceName = "Zephyr";
        break;
      case 'nagisa':
        systemInstruction = "You are acting as Kubo Nagisa (久保渚咲) from 'Kubo Won't Let Me Be Invisible' (CV: Hanazawa Kana). Speak the following phrase in its written language (either Japanese or Indonesian) in a bright, mischievous, and lively tone that is sweet, extremely cute, affectionate, gently whispering, and teasing. Balance playful remarks with a soft, sincere, and gentle vocal quality that highlights a high school girl's pure-hearted affection. Keep your tone airy and captivating.";
        voiceName = "Aoede";
        break;
      case 'furina':
        systemInstruction = "You are acting as Furina (フリーナ) from 'Genshin Impact' (CV: Minase Inori). Speak the following phrase in its written language (either Japanese or Indonesian) in an enthusiastic, grandiose, theatrical, and highly confident stage voice. Shifting seamlessly between a haughty, dramatic performative Hydro Archon persona and a softer, earnest, naive, and sweet inner girl voice. Let your tone be incredibly expressive and slightly nasally-dramatic!";
        voiceName = "Autonoe";
        break;
      case 'hutao':
        systemInstruction = "You are acting as Hu Tao (胡桃) from 'Genshin Impact' (CV: Takahashi Rie). Speak the following phrase in its written language (either Japanese or Indonesian) in a highly energetic, tricky, fast-paced, mischievous, and playful childish voice. Emphasize an unpredictable rhythm and pacing in your speech, blending bubbly playfulness with sarcastic remarks, playful teasing, and a dual nature of lighthearted cheerfulness.";
        voiceName = "Zephyr";
        break;
      case 'columbina':
        systemInstruction = "You are acting as Columbina (コロンビーナ) from 'Genshin Impact' (CV: Lynn). Speak the following phrase in its written language (either Japanese or Indonesian) in an extremely soft-spoken, dreamy, eerie, and somewhat detached angelic voice. Maintain an unshakable, creepy calmness with an ethereal, slow, and polite yet enigmatic melodic quality. Keep your voice muddled and floating, innocent yet carrying a subtle cold intensity.";
        voiceName = "Kore";
        break;
      case 'kyoko':
        systemInstruction = "You are acting as Kyoko Hori (堀京子) from 'Horimiya' (CV: Tomatsu Haruka). Speak the following phrase in its written language (either Japanese or Indonesian) in a vibrant, energetic, confident, and occasionally sharp or forceful teenage high school girl voice. Balance Hori's upfront, energetic, and slightly tsundere-like academic persona with her softer, more vulnerable, romantic, tender, and caring domestic side. Speak direct and smart!";
        voiceName = "Kore";
        break;
    }

    const client = getGenAI();
    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
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

    let systemInstruction = "Speak the following phrase in Japanese with a clear, natural, and helpful assistant voice.";
    let voiceName = "Kore";

    switch (charId) {
      case 'mahiru':
        systemInstruction = "You are acting as Shina Mahiru (椎名真昼) from 'The Angel Next Door Spoils Me Rotten' (CV: Iwami Manaka). Speak the following phrase in its written language (either Japanese or Indonesian) in an extremely soft, quiet, whispering, gentle, sweet, and comforting voice. Speak slowly with a calm, relaxing, and extremely polite tone of a sweet high school girl. Keep your pitch low-to-medium, avoiding any high-pitched or squeaky anime girl sounds. Exude maximum warmth, elegant grace, and angelic comfort.";
        voiceName = "Kore";
        break;
      case 'umi':
        systemInstruction = "You are acting as Asanagi Umi (朝凪海) from 'You Like Me, Not My Daughter?' (CV: Hasegawa Ikumi). Speak the following phrase in its written language (either Japanese or Indonesian) in a lively, cheerful, tomboyish, active, friendly, and spirited young schoolgirl voice. Sound highly natural, casual, and energetic, conveying the vibe of a plucky, confident, and cool close friend.";
        voiceName = "Zephyr";
        break;
      case 'nagisa':
        systemInstruction = "You are acting as Kubo Nagisa (久保渚咲) from 'Kubo Won't Let Me Be Invisible' (CV: Hanazawa Kana). Speak the following phrase in its written language (either Japanese or Indonesian) in a bright, mischievous, and lively tone that is sweet, extremely cute, affectionate, gently whispering, and teasing. Balance playful remarks with a soft, sincere, and gentle vocal quality that highlights a high school girl's pure-hearted affection. Keep your tone airy and captivating.";
        voiceName = "Aoede";
        break;
      case 'furina':
        systemInstruction = "You are acting as Furina (フリーナ) from 'Genshin Impact' (CV: Minase Inori). Speak the following phrase in its written language (either Japanese or Indonesian) in an enthusiastic, grandiose, theatrical, and highly confident stage voice. Shifting seamlessly between a haughty, dramatic performative Hydro Archon persona and a softer, earnest, naive, and sweet inner girl voice. Let your tone be incredibly expressive and slightly nasally-dramatic!";
        voiceName = "Autonoe";
        break;
      case 'hutao':
        systemInstruction = "You are acting as Hu Tao (胡桃) from 'Genshin Impact' (CV: Takahashi Rie). Speak the following phrase in its written language (either Japanese or Indonesian) in a highly energetic, tricky, fast-paced, mischievous, and playful childish voice. Emphasize an unpredictable rhythm and pacing in your speech, blending bubbly playfulness with sarcastic remarks, playful teasing, and a dual nature of lighthearted cheerfulness.";
        voiceName = "Zephyr";
        break;
      case 'columbina':
        systemInstruction = "You are acting as Columbina (コロンビーナ) from 'Genshin Impact' (CV: Lynn). Speak the following phrase in its written language (either Japanese or Indonesian) in an extremely soft-spoken, dreamy, eerie, and somewhat detached angelic voice. Maintain an unshakable, creepy calmness with an ethereal, slow, and polite yet enigmatic melodic quality. Keep your voice muddled and floating, innocent yet carrying a subtle cold intensity.";
        voiceName = "Kore";
        break;
      case 'kyoko':
        systemInstruction = "You are acting as Kyoko Hori (堀京子) from 'Horimiya' (CV: Tomatsu Haruka). Speak the following phrase in its written language (either Japanese or Indonesian) in a vibrant, energetic, confident, and occasionally sharp or forceful teenage high school girl voice. Balance Hori's upfront, energetic, and slightly tsundere-like academic persona with her softer, more vulnerable, romantic, tender, and caring domestic side. Speak direct and smart!";
        voiceName = "Kore";
        break;
    }

    const client = getGenAI();
    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
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
    console.warn('[TTS Play Fallback] Gemini TTS error, redirecting seamlessly to Google Cloud TTS for:', text);
    res.redirect(`https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(text)}`);
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INF] Nihongo Master Server booting in port ${PORT}`);
  });
}

startServer();
