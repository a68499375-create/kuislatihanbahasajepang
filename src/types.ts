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

declare global {
  interface Window {
    Capacitor?: {
      isNative?: boolean;
    };
    _activeUtterances?: any[];
    webkitAudioContext?: typeof AudioContext;
    _fallbackAudioPlayer?: HTMLAudioElement;
    _onTtsPlayed?: () => void;
    _triggerToast?: (msg: string, type: string) => void;
    handleGoogleLoginResponse?: (res: any) => void;
    google?: any;
    turnstile?: any;
  }
}
