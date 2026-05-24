export interface KanaItem {
  char: string;
  ro: string;
  mean?: string;
  ex?: { jp: string; rom: string; id: string }[];
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  avatar: string;
  poin: number;
  xp: number;
  deskripsi?: string;
  ttl?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type QuizMode = 'mc4' | 'essay' | 'terbalik' | 'flashcard' | 'ai';

export interface AIQuestion {
  soal: string;
  tipe: string;
  jawaban_benar: string;
  pilihan: string[];
  penjelasan: string;
}
