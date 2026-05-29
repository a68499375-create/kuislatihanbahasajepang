import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  Award, 
  Trophy, 
  User, 
  Home, 
  Volume2, 
  LogOut, 
  Search, 
  Send, 
  X, 
  Settings, 
  RefreshCw, 
  Play, 
  Sparkles, 
  Eraser, 
  PenTool, 
  Lock, 
  Clock, 
  ChevronRight,
  UserPlus,
  Compass,
  History,
  ChevronLeft,
  CheckSquare,
  Square,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { kanaData, KanaItem } from './data';
import { UserProfile, ChatMessage, QuizMode, AIQuestion } from './types';

// Speech synthesis function
let globalVoiceCharacter = 'default';
const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    if (
      hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      protocol.startsWith('capacitor') || 
      protocol.startsWith('http-capacitor') ||
      (window as any).Capacitor?.isNative
    ) {
      return 'https://kuislatihanbahasajepang.web.id';
    }
  }
  return (import.meta as any).env?.VITE_API_BASE || '';
};
const API_BASE = getApiBase();

// iOS / Android Garbage collection prevention, auto-unlock audio context, and voice pre-warming
if (typeof window !== 'undefined') {
  (window as any)._activeUtterances = (window as any)._activeUtterances || [];
  if (window.speechSynthesis) {
    try {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    } catch (e) {
      console.log('Speech synthesis pre-warm error:', e);
    }
  }

  // Auto-unlock Web Audio & SpeechSynthesis on first user touch/click/drag
  const unlockAudio = () => {
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      }
    } catch (e) {}
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
}

function getJapaneseSystemVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  try {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => 
      v.lang.toLowerCase().replace('_', '-').startsWith('ja') || 
      v.lang.toLowerCase().includes('jp') ||
      v.name.toLowerCase().includes('japanese')
    );
  } catch (e) {
    return undefined;
  }
}

async function playGeminiTts(textToSpeak: string, character: string) {
  try {
    if (typeof window === 'undefined') return;
    
    // Stop any previous media play
    if ((window as any)._fallbackAudioPlayer) {
      try {
        (window as any)._fallbackAudioPlayer.pause();
      } catch (e) {}
    }

    const audioUrl = `${API_BASE}/api/gemini/tts-play?text=${encodeURIComponent(textToSpeak)}&character=${character}`;
    const audio = new Audio(audioUrl);
    (window as any)._fallbackAudioPlayer = audio;
    
    audio.play().catch(e => {
      console.log('Gemini TTS audio.play failed, falling back to traditional TTS:', e);
      playCloudTts(textToSpeak, 1.0, 1.0);
    });
  } catch (error) {
    console.error('Gemini TTS player error, falling back:', error);
    playCloudTts(textToSpeak, 1.0, 1.0);
  }
}

function playCloudTts(textToSpeak: string, rate: number = 1.0, pitch: number = 1.0) {
  try {
    if (typeof window === 'undefined') return;
    
    // Stop any previous media play
    if ((window as any)._fallbackAudioPlayer) {
      try {
        (window as any)._fallbackAudioPlayer.pause();
      } catch (e) {}
    }

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(textToSpeak)}`;
    
    // Fresh instantiation ensures absolute consistency for playbackRate and preservesPitch on iOS and Android
    const audio = new Audio(url);
    (window as any)._fallbackAudioPlayer = audio;
    
    try {
      // Disable pitch preservation so that speed changes directly modulate the pitch.
      // This produces beautiful, responsive high/low pitches mimicking specific Japanese anime characters.
      if ('preservesPitch' in audio) {
        audio.preservesPitch = false;
      } else if ('webkitPreservesPitch' in audio) {
        (audio as any).webkitPreservesPitch = false;
      } else if ('mozPreservesPitch' in audio) {
        (audio as any).mozPreservesPitch = false;
      }
      
      // In cloud mode, pitch configurations map directly to playback rate for a perfect pitch shift
      const targetRate = pitch !== 1.0 ? pitch : rate;
      audio.defaultPlaybackRate = targetRate;
      audio.playbackRate = targetRate;
    } catch (e) {
      console.log('Error setting playbackRate or preservesPitch:', e);
    }
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Playback prevented by browser autoplay policy, fallback to system voices:', error);
        // Fallback to Web Speech API safely, ensuring pitch and rate are completely intact
        playSystemTtsDirect(textToSpeak, rate, pitch);
      });
    }
  } catch (e) {
    console.log('Cloud TTS player error:', e);
  }
}

function playSystemTtsDirect(textToSpeak: string, rate: number = 1.0, pitch: number = 1.0) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.resume();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ja-JP';
    utterance.volume = 1.0;
    utterance.rate = rate;
    utterance.pitch = pitch;

    const jaVoice = getJapaneseSystemVoice();
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    if (window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    const activeArr = (window as any)._activeUtterances || [];
    activeArr.push(utterance);
    utterance.onend = () => {
      (window as any)._activeUtterances = ((window as any)._activeUtterances || []).filter((u: any) => u !== utterance);
    };
    utterance.onerror = () => {
      (window as any)._activeUtterances = ((window as any)._activeUtterances || []).filter((u: any) => u !== utterance);
    };

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.log('playSystemTtsDirect error:', e);
  }
}

function playAudio(text: string, isChatReply: boolean = false) {
  if (typeof window !== 'undefined' && (window as any)._onTtsPlayed) {
    try {
      (window as any)._onTtsPlayed();
    } catch (e) {}
  }
  // If it's a chat reply, do NOT split by comma to read the whole reply!
  const cleaned = isChatReply 
    ? text.replace(/（.*?）|\(.*?\)/g, '').trim()
    : text.split(',')[0].replace(/（.*?）|\(.*?\)/g, '').trim();
  
  let prefix = '';
  let rate = 0.95; // slightly slower for better comprehensibility
  let pitch = 1.0;

  switch (globalVoiceCharacter) {
    case 'mahiru':
      prefix = 'あの、'; 
      pitch = 1.15;
      rate = 0.92;
      break;
    case 'umi':
      prefix = 'じゃあ、いくよ！'; 
      pitch = 1.15;
      rate = 1.15;
      break;
    case 'nagisa':
      prefix = 'ふふ、'; 
      pitch = 1.25;
      rate = 0.95;
      break;
    case 'furina':
      prefix = 'さあ！'; 
      pitch = 1.45;
      rate = 1.1;
      break;
    case 'hutao':
      prefix = 'それっ！'; 
      pitch = 1.55;
      rate = 1.2;
      break;
    case 'columbina':
      prefix = 'ふふ、静かに、聴いてね…'; 
      pitch = 1.35;
      rate = 0.8;
      break;
    case 'kyoko':
      prefix = 'ほら、いくよ！'; 
      pitch = 1.25;
      rate = 1.15;
      break;
    default:
      rate = 0.95;
      pitch = 1.0;
  }

  // If it's a long chat reply, don't prepend the character welcome prefix to avoid repetitiveness!
  const textToSpeak = (prefix && !isChatReply) ? `${prefix} ${cleaned}` : cleaned;
  
  // Choose voice engine mode
  const savedMode = typeof window !== 'undefined' ? (localStorage.getItem('nik_voice_engine') || 'gemini') : 'gemini';

  if (savedMode === 'gemini') {
    playGeminiTts(textToSpeak, globalVoiceCharacter);
    return;
  }

  if (savedMode === 'cloud') {
    playCloudTts(textToSpeak, rate, pitch);
    return;
  }

  // System SpeechSynthesis mode (Default to gemini if speechSynthesis doesn't exist)
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    playGeminiTts(textToSpeak, globalVoiceCharacter);
    return;
  }

  try {
    window.speechSynthesis.resume();
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  } catch (e) {
    console.log('Error adjusting speech synthesis state:', e);
  }

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = 'ja-JP';
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = 1.0;

  const jaSystemVoice = getJapaneseSystemVoice();
  if (jaSystemVoice) {
    utterance.voice = jaSystemVoice;
  }

  if (typeof window !== 'undefined') {
    const activeArr = (window as any)._activeUtterances || [];
    activeArr.push(utterance);
    
    utterance.onend = () => {
      (window as any)._activeUtterances = ((window as any)._activeUtterances || []).filter((u: any) => u !== utterance);
    };
    utterance.onerror = (evt) => {
      console.log('Speech synthesis error, falling back to Cloud TTS:', evt);
      (window as any)._activeUtterances = ((window as any)._activeUtterances || []).filter((u: any) => u !== utterance);
      playCloudTts(textToSpeak, rate, pitch);
    };
  }

  // Speak immediately synchronously
  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.log('SpeechSynthesis speak failed, falling back to Cloud TTS:', err);
    playCloudTts(textToSpeak, rate, pitch);
  }
}

// Rich sentence builder for dynamic JLPT exams
function generateSentenceForItem(item: KanaItem, level: string) {
  const char = item.char;
  const mean = item.mean || 'Hal';
  const ro = item.ro ? item.ro.split(',')[0].trim() : '';

  // Customized dictionary of natural hand-crafted sentences for core level words
  const database: Record<string, { jp: string; rom: string; id: string }> = {
    // N5
    '一': { jp: '公園のベンチに犬が「一」匹だけ座っています。', rom: 'Kouen no benchi ni inu ga ippi ki dake suatte imasu.', id: 'Di bangku taman hanya ada satu ekor anjing yang duduk.' },
    '二': { jp: '私は毎日「二」杯の温かい牛乳を飲みます。', rom: 'Watashi wa mainichi nihai no atatakai gyuunyuu o nomimasu.', id: 'Saya minum dua gelas susu hangat setiap hari.' },
    '三': { jp: '明日になれば、彼らは「三」人目の子供に会えます。', rom: 'Ashita ni nareba, karera wa sannin-me no kodomo ni aemasu.', id: 'Besok, mereka akan bertemu dengan anak yang ketiga.' },
    '四': { jp: '私の家族は「四」人家族で、とても幸せです。', rom: 'Watashi no kazoku wa yonin kazoku de, totemo shiawase desu.', id: 'Keluarga saya adalah keluarga yang beranggotakan empat orang dan sangat bahagia.' },
    '五': { jp: 'この本を読み終えるのに「五」時間もかかりました。', rom: 'Kono hon o yomioeru noni go-jikan mo kakarimashita.', id: 'Saya menghabiskan waktu lima jam untuk menyelesaikan membaca buku ini.' },
    '六': { jp: '朝の「六」時に起きて、近所を散歩します。', rom: 'Asa no roku-ji ni okite, kinjo o sanpo shimasu.', id: 'Bangun tidur jam enam pagi, lalu berjalan-jalan di sekitar lingkungan.' },
    '七': { jp: '一週間は「七」日あり、毎日日本語を勉強します。', rom: 'Isshuukan wa nanaka ari, mainichi nihongo o benkyou shimasu.', id: 'Satu minggu ada tujuh hari, saya belajar bahasa Jepang setiap hari.' },
    '八': { jp: 'デパートの「八」階で新しい服を買いました。', rom: 'Depaato no hachikai de atarashii fuku o kaimashita.', id: 'Membeli pakaian baru di lantai delapan pusat perbelanjaan.' },
    '九': { jp: '私の祖父は、今年で「九」十歳になります。', rom: 'Watashi no sofu wa, kotoshi de kyuujussai ni narimasu.', id: 'Kakek saya akan berusia sembilan puluh tahun pada tahun ini.' },
    '十': { jp: '財布の中に「十」円玉がいくつか入っています。', rom: 'Saifu no naka ni juuen-dama ga ikutsuka haitte imasu.', id: 'Di dalam dompet ada beberapa koin sepuluh yen.' },
    '百': { jp: 'この学校には「百」人以上の留学生が学んでいます。', rom: 'Kono gakkou ni wa hyakunin ijou no ryuugakusei ga manande imasu.', id: 'Ada lebih dari seratus siswa asing yang belajar di sekolah ini.' },
    '千': { jp: 'この辞書は「千」円で買ったので非常に安いです。', rom: 'Kono jisho wa sen-en de katta node hijou ni yasui desu.', id: 'Kamus ini sangat murah karena saya membelinya dengan harga seribu yen.' },
    '万': { jp: 'あの有名な歌手のライブに一「万」人が来ました。', rom: 'Ano yuumeina kashu no raibu ni ichiman-nin ga kimashita.', id: 'Sepuluh ribu orang mendatangi konser langsung penyanyi terkenal itu.' },
    '円': { jp: '今、私の手元に五千「円」のお札が一枚あります。', rom: 'Ima, watashi no temoto ni gosen-en no osatsu ga ichimai arimasu.', id: 'Sekarang, ada satu lembar uang kertas pecahan lima ribu yen di tangan saya.' },
    '日': { jp: '今日はとても日差しが強くて暖かい「日」ですね。', rom: 'Kyou wa totemo hizashi ga tyokute atatakai hi desu ne.', id: 'Hari ini adalah hari yang hangat dengan sinar matahari yang sangat terik.' },
    '月': { jp: '美しい「月」が静かな夜空に浮かんでいます。', rom: 'Utsukushii tsuki ga shizukana yozora ni ukande imasu.', id: 'Bulan yang indah melayang di langit malam yang sunyi.' },
    '火': { jp: '私たちはキャンプ場で「火」を見つめながら話した。', rom: 'Watashitachi wa kyanpujou de hi o mitsumenagara hanashita.', id: 'Kami mengobrol sambil menatap api di area perkemahan.' },
    '水': { jp: '暑い夏には冷たい「水」をたくさん飲むべきです。', rom: 'Atsui natsu ni wa tsumetai mizu o takusan nomu beki desu.', id: 'Di musim panas yang terik, Anda harus minum banyak air dingin.' },
    '木': { jp: '公園の大きな「木」の下で心地よく昼寝をした。', rom: 'Kouen no ookina ki no shita de kokochiyo ku hirune o shita.', id: 'Tidur siang dengan nyaman di bawah pohon besar di taman.' },
    '金': { jp: '銀行でたくさんのお「金」をおろしてきました。', rom: 'Ginkou de takusan no okane o oroshite kimashita.', id: 'Saya baru saja menarik banyak uang di bank.' },
    '土': { jp: 'プランターの「土」を新しくして新しい種を蒔いた。', rom: 'Purantaa no tsuchi o atarashiku shite atarashii tane o maita.', id: 'Mengganti tanah di pot tanaman untuk menebarkan benih yang baru.' },
    '年': { jp: '「年」に一度の大事なフェスティバルが明日始まる。', rom: 'Nen ni ichido no daijina fesutibaru ga ashita hajamaru.', id: 'Festival penting setahun sekali akan dimulai besok.' },
    '休': { jp: '疲れたので、あのカフェで少し「休」みましょう。', rom: 'Tsukareta node, ano kafe de sukoshi yasumimashou.', id: 'Karena lelah, mari beristirahat sejenak di kafe itu.' },
    '上': { jp: '机の「上」に教科書と筆箱が置いてあります。', rom: 'Tsukue no ue ni kyoukasho to fudebako ga oite arimasu.', id: 'Di atas meja diletakkan buku pelajaran dan tempat pensil.' },
    '下': { jp: '猫がテーブルの「下」で丸くなって眠っています。', rom: 'Neko ga teeburu no shita de maruku natte nemutte imasu.', id: 'Kucing sedang tidur melingkar di bawah meja.' },
    '左': { jp: '信号を「左」へ曲がると、右手に郵便局があります。', rom: 'Shingou o hidari e magaru to, migite ni yuubinkyoku ga arimasu.', id: 'Bila berbelok ku kiri di lampu lalu lintas, ada kantor pos di sebelah kanan Anda.' },
    '右': { jp: '「右」のポケットに家のカギを入れています。', rom: 'Migi no poketto ni ie no kagi o irete imasu.', id: 'Saya menaruh kunci rumah di dalam kantong sebelah kanan.' },
    '中': { jp: 'カバンの「中」に大切な書類が入っています。', rom: 'Kaban no naka ni taisetsuna shorui ga haitte imasu.', id: 'Dokumen penting berada di dalam tas.' },
    '大': { jp: '社長はとても「大」きな声でみんなに挨拶した。', rom: 'Shachou wa totemo ookina koe de minna ni aisatsushita.', id: 'Presiden direktur menyapa semua orang dengan suara yang sangat besar.' },
    '小': { jp: '川できれいな「小」さい石をいくつか拾いました。', rom: 'Kawa de kireina chiisai ishi o ikutsuka hiroimashita.', id: 'Mengambil beberapa batuan kecil yang indah di sungai.' },
    '本': { jp: '私は毎週日曜日に図書館で新しい「本」を読みます。', rom: 'Watashi wa maishuu nichiyoubi ni toshokan de atarashii hon o yomimasu.', id: 'Saya membaca buku baru di perpustakaan setiap hari Minggu.' },
    '分': { jp: '約束の時間まであと十「分」しか残っていません。', rom: 'Yakusoku no jikan made ato juppun shika nokotte imasen.', id: 'Hanya tersisa sepuluh menit lagi menuju waktu pertemuan yang dijanjikan.' },
    '何': { jp: 'あなたの国の美味しい料理は「何」が一番ですか。', rom: 'Anata no kuni no oishii ryouri wa nani ga ichiban desu ka.', id: 'Apakah masakan lezat di negara Anda yang paling nomor satu?' },
    '今': { jp: '「今」から友達と駅前の映画館で映画を見ます。', rom: 'Ima kara tomodachi to ekimae no eigakan de eiga o mimasu.', id: 'Mulai sekarang, saya akan menonton film bersama teman di bioskop depan stasiun.' },
    '行': { jp: '明日、私は両親と一緒にデパートへ買い「行」きます。', rom: 'Ashita, watashi wa ryoushin to isshon ni depaato e kai ikimasu.', id: 'Besok, saya akan pergi berbelanja ke pusat perbelanjaan bersama orang tua.' },
    '来': { jp: '「来」週の土曜日に友達を私の家に招待します。', rom: 'Raishuu no doyoubi ni tomodachi o watashi no ie ni shoutai shimasu.', id: 'Saya akan mengundang teman ke rumah saya pada hari Sabtu minggu depan.' },
    '帰': { jp: '仕事が終わったらすぐに自分の家へ「帰」りたいです。', rom: 'Shigoto ga owattara sugu ni jibun no ie e kaeritai desu.', id: 'Saya ingin segera pulang ke rumah saya setelah pekerjaan selesai.' },
    '食': { jp: 'レストランで美味しいハンバーグ "「食」" べました。', rom: 'Resutoran de oishii hanbaagu o tabemashita.', id: 'Makan daging hamburger yang lezat di restoran.' },
    '飲': { jp: '喉が乾いたのでジュースを冷たくして「飲」みました。', rom: 'Nodo ga kawaita node juusu o tsumetaku shite nomimashita.', id: 'Karena tenggorokan kering, saya meminum jus setelah mendinginkannya.' },
    '見': { jp: 'テレビで日本の素晴らしい映画を「見」て感動した。', rom: 'Terebi de nihon no subarashii eiga o mite kandoushita.', id: 'Terharu setelah menonton film Jepang yang luar biasa di televisi.' },
    '聞': { jp: '毎朝静かな音楽を「聞」きながらコーヒーをいれます。', rom: 'Maiasa shizukana ongaku o kikinagara koohii o iremasu.', id: 'Menyeduh kopi setiap pagi sambil mendengarkan musik yang tenang.' },
    '読': { jp: '夜遅くに布団に入ってから「読」書をするのが好きです。', rom: 'Yoru osoku ni futon ni haitte kara dokusho o suru no ga suki desu.', id: 'Saya suka membaca buku setelah masuk ke kasur di larut malam.' },
    '書': { jp: '来年の目標をノートにきれいに「書」き出しました。', rom: 'Rainen no mokuhyou o nooto ni kirei ni kakidashimashita.', id: 'Saya menuliskan tujuan tahun depan dengan rapi di buku catatan.' },
    '話': { jp: '昨日お母さんと電話で長い時間「話」をしました。', rom: 'Kinou okaasan to denwa de nagai jikan hanashi o shimashita.', id: 'Kemarin saya berbicara dengan ibu di telepon dalam waktu lama.' },
    '買': { jp: '週末にショッピングモールで新しい靴を「買」います。', rom: 'Shuumatsu ni shoppingu mooru de atarashii kutsu o kaimasu.', id: 'Membeli sepatu baru di mal perbelanjaan pada akhir pekan.' },
    '人': { jp: '日本の「人」たちはみんなとても親切で優しいですね。', rom: 'Nihon no hito-tachi wa minna totemo shinsetsu de yasashii desu ne.', id: 'Orang-orang Jepang semuanya sangat baik dan ramah ya.' },
    '新': { jp: '新しい「新」車で日本中をドライブして回りたいです。', rom: 'Atarashii shinsha de nihonjuu o doraibu shite mawaritai desu.', id: 'Saya ingin berkeliling berkendara di seluruh Jepang menggunakan mobil baru.' },
    '駅': { jp: '電車の「駅」の窓口で定期券を新しく購入した。', rom: 'Densha no eki no madoguchi de teikiken o atarashiku kounyuu shita.', id: 'Membeli tiket terusan mingguan/bulanan baru di loket stasiun kereta.' },

    // N4 examples
    '悪': { jp: '彼を責めるなんて「悪」い状況をさらに悪化させるだけだ。', rom: 'Kare o semeru nante warui joukyou o sara ni akkasaseru dake da.', id: 'Menyalahkan dia hanya akan membuat situasi buruk menjadi semakin parah.' },
    '医': { jp: '病気が治らないので腕の良い「医」者を訪ねてみる。', rom: 'Byouki ga naoranai node ude no yoi isha o tazunete miru.', id: 'Karena penyakit saya belum sembuh, saya mencoba mengunjungi dokter yang andal.' },
    '暗': { jp: '暗い「暗」室で写真を現像する体験をしてきました。', rom: 'Kurai anshitsu de shashin o genzou suru taiken o shite kimashita.', id: 'Saya telah mencoba pengalaman mencetak foto di kamar gelap yang gelap.' },
    '意': { jp: '彼の言葉の本当の「意」図が私には理解できない。', rom: 'Kare no kotoba no hontou no ito ga watashi ni wa rikai dekinai.', id: 'Saya tidak bisa memahami niat/maksud sebenarnya dari kata-katanya.' },
    '家': { jp: '田舎には庭のついた美しく大きな「家」があります。', rom: 'Inaka ni wa niwa no tsuita utsukushiku ookina ie ga arimasu.', id: 'Di pedesaan ada sebuah rumah yang indah dan besar dengan pekarangan.' },
    
    // N3 examples
    '政': { jp: '国政選挙に向けて、各「政」当が熱い討論を行っています。', rom: 'Kokusei senkyo ni mukete, kaku seitou ga atsui touron o okonatte imasu.', id: 'Menjelang pemilu nasional, masing-masing partai politik mengadakan debat sengit.' },
    '民': { jp: '「民」衆のために働く素晴らしい政治家に投票します。', rom: 'Minshuu no tame ni hataraku subarashii seijika ni touhyou shimasu.', id: 'Memilih politikus hebat yang bekerja demi rakyat jelata.' },
    
    // N2 examples
    '設': { jp: '新しい会社を「設」立して事業を広げる決意をしました。', rom: 'Atarashii kaisha o setsuritsu shite jigyou o hirogeru ketsui o shimashita.', id: 'Saya telah memutuskan untuk mendirikan perusahaan baru dan memperluas bisnis.' },
    '領': { jp: '日本の近くの「領」海を守るために警備が強化されている。', rom: 'Nihon no chikaku no ryoukai o mamoru tame ni keibi ga kyouka sarete imasu.', id: 'Penjagaan diperketat untuk melindungi wilayah laut dekat Jepang.' },

    // N1 examples
    '党': { jp: '連盟の「党」首たちが一堂に会して平和宣言を採択した。', rom: 'Renmei no toushu-tachi ga ichidou ni kaishite heiwa sengen o saitakushita.', id: 'Para ketua partai federasi berkumpul bersama untuk mengesahkan deklarasi perdamaian.' }
  };

  if (database[char]) {
    return database[char];
  }

  // Synthesizer fallback for intermediate words
  const isVerb = /pergi|datang|pulang|makan|minum|melihat|mendengar|membaca|menulis|berbicara|membeli|mengajar|menunggu|berenang|membuat|mengukur|melakukan|belajar|bekerja|tidur|lari|jalan|lepas/i.test(mean);
  const isAdj = /baru|lama|banyak|sedikit|tinggi|mahal|panjang|pendek|buruk|gelap|kuning|biru|merah|putih|hitam|kuat|lemah|cepat|panas|dingin|indah|bersih|kotor|muda|sulit|mudah|aktif|tenang/i.test(mean);

  if (isVerb) {
    return {
      jp: `毎日、日本語の語彙として「${char}」という行動をしっかり練習しています。`,
      rom: `Mainichi, nihongo no goi toshite ${ro} to iu koudou o shikkari renshuu shite imasu.`,
      id: `Setiap hari, melatih dengan tekun tindakan untuk 「${mean}」 sebagai perbendaharaan kata bahasa Jepang.`
    };
  } else if (isAdj) {
    return {
      jp: `あそこにある看板は非常に「${char}」い印象を人々に与えています。`,
      rom: `Asoko ni aru kanban wa hijou ni ${ro}i inshou o hitobito ni ataete imasu.`,
      id: `Papan nama di belokan sana memberikan kesan yang sangat 「${mean}」 kepada masyarakat.`
    };
  } else {
    return {
      jp: `日本の学校の教科書には「${char}」に関する説明が多く記載されている。`,
      rom: `Nihon no gakkou no kyoukasho ni wa ${ro} ni kansuru setsumei ga ooku kisai sarete iru.`,
      id: `Di dalam buku pelajaran sekolah Jepang terdapat banyak penjelasan yang berkaitan dengan 「${mean}」.`
    };
  }
}

// Word Categories for daily sequential widget selection
const getWordCategory = (mean: string): string | null => {
  const m = mean.toLowerCase();
  if (/^(melihat|mendengar|membaca|menulis|berbicara|membeli|mengajar|pergi|datang|pulang|makan|minum|istirahat|menunggu|berenang|membuat|mengukur|lah|menj|memb|meng|meny|men|latih|belajar|bekerja|tidur|lari|jalan|lepas|panggil|bantu|kejar|bawa|tukar|hadap|ikut|tangkap|sambut|bunuh|pukul|dorong|tarik|apung|jepit|gali|buang|mandi|ganti|bakar|oles|mandi)/i.test(m)) {
    return 'Kata Kerja (動詞)';
  }
  if (/^(baru|lama|besar|kecil|terang|tinggi|mahal|panjang|buruk|gelap|jauh|kuat|dekat|gemuk|lemah|cepat|panas|dingin|indah|bersih|kotor|muda|sulit|mudah|aktif|tenang|sejuk|merah|biru|putih|hitam|marah|malu|lelah|sibuk|baik|pedas|pahit|kasar|sempit|luas|bagus|kacau|keras|lembut|lentur|kaku)/i.test(m)) {
    return 'Kata Sifat (形容詞)';
  }
  return null;
};

// Return all matched words sequentially across N5 to N1
const getAllKarakterHariIni = () => {
  const result: { item: KanaItem; category: string; level: string }[] = [];
  ['n5', 'n4', 'n3', 'n2', 'n1'].forEach(lvl => {
    const list = kanaData[lvl] || [];
    list.forEach(item => {
      const cat = getWordCategory(item.mean || '');
      if (cat) {
        result.push({ item, category: cat, level: lvl.toUpperCase() });
      }
    });
  });
  return result;
};

// Deterministic single sequence based on elapsed days starting from a fixed date
const dailyWordsList = getAllKarakterHariIni();
const getDailyIndex = (length: number) => {
  if (length === 0) return 0;
  const now = new Date();
  const start = new Date(2026, 0, 1); // fixed start date
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayIndex = Math.floor(diff / oneDay);
  return Math.abs(dayIndex) % length;
};

// Aesthetic Premium Japanese Themes Configuration & Color Overrides
const themeDetails = {
  sakura: {
    sunColor: '#e11d48',
    sunGlow: '#f43f5e',
    sunGlowOpacity: '0.32',
    sunOpacity: '0.45',
    floatingChars: ['🌸', '💮', '🍁', '🌸', '💮', '桜', '春', '風', '月', '雪', '空', '心', '和'],
    bgGradient: 'from-[#060412] via-[#0b081e] to-[#1a0c20]',
    gridOpacity: 'opacity-[0.05]',
    gridColor: 'rgba(244,63,94,0.06)',
    styleOverrides: `
      :root {
        --color-violet-500: #f43f5e;
        --color-violet-600: #e11d48;
        --color-violet-700: #be123c;
        --color-violet-850: rgb(76, 5, 25);
        --color-violet-900: #4c0519;
        --color-violet-950: #27020c;
        --color-pink-400: #fb7185;
        --color-pink-500: #f43f5e;
      }
    `
  },
  aqua: {
    sunColor: '#0891b2',
    sunGlow: '#06b6d4',
    sunGlowOpacity: '0.35',
    sunOpacity: '0.48',
    floatingChars: ['💧', '🌊', '🫧', '海', '水', '魚', '夏', '月', '風', '空', '静', '🪼'],
    bgGradient: 'from-[#020813] via-[#041126] to-[#04243a]',
    gridOpacity: 'opacity-[0.07]',
    gridColor: 'rgba(6,182,212,0.06)',
    styleOverrides: `
      :root {
        --color-violet-500: #06b6d4;
        --color-violet-600: #0891b2;
        --color-violet-700: #0e7490;
        --color-violet-850: rgb(8, 51, 68);
        --color-violet-900: #164e63;
        --color-violet-950: #083344;
        --color-pink-400: #22d3ee;
        --color-pink-500: #06b6d4;
      }
    `
  },
  rose: {
    sunColor: '#c026d3',
    sunGlow: '#db2777',
    sunGlowOpacity: '0.35',
    sunOpacity: '0.50',
    floatingChars: ['🌹', '🌷', '💖', '華', '愛', '美', '香', '夢', '和', '恋', '心', '🎀'],
    bgGradient: 'from-[#0b030d] via-[#1a061a] to-[#2b0820]',
    gridOpacity: 'opacity-[0.06]',
    gridColor: 'rgba(219,39,119,0.06)',
    styleOverrides: `
      :root {
        --color-violet-500: #db2777;
        --color-violet-600: #c026d3;
        --color-violet-700: #9d174d;
        --color-violet-850: rgb(80, 7, 36);
        --color-violet-900: #500724;
        --color-violet-950: #2d0015;
        --color-pink-400: #f472b6;
        --color-pink-500: #db2777;
      }
    `
  },
  biru_langit: {
    sunColor: '#1d4ed8',
    sunGlow: '#0ea5e9',
    sunGlowOpacity: '0.35',
    sunOpacity: '0.45',
    floatingChars: ['☁️', '⭐', '❄️', '天', '空', '星', '雨', '雪', '風', '静', '和', '🐳'],
    bgGradient: 'from-[#02050f] via-[#050f24] to-[#0a1b3d]',
    gridOpacity: 'opacity-[0.05]',
    gridColor: 'rgba(14,165,233,0.06)',
    styleOverrides: `
      :root {
        --color-violet-500: #0ea5e9;
        --color-violet-600: #2563eb;
        --color-violet-700: #1d4ed8;
        --color-violet-850: rgb(15, 32, 67);
        --color-violet-900: #0f172a;
        --color-violet-950: #020617;
        --color-pink-400: #38bdf8;
        --color-pink-500: #0ea5e9;
      }
    `
  }
};


const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const KANA_GRID = [
  { h: 'あ', k: 'ア', r: 'a' }, { h: 'い', k: 'イ', r: 'i' }, { h: 'う', k: 'ウ', r: 'u' }, { h: 'え', k: 'エ', r: 'e' }, { h: 'お', k: 'オ', r: 'o' },
  { h: 'か', k: 'カ', r: 'ka' }, { h: 'き', k: 'キ', r: 'ki' }, { h: 'く', k: 'ク', r: 'ku' }, { h: 'け', k: 'ケ', r: 'ke' }, { h: 'こ', k: 'コ', r: 'ko' },
  { h: 'さ', k: 'サ', r: 'sa' }, { h: 'し', k: 'シ', r: 'shi' }, { h: 'す', k: 'ス', r: 'su' }, { h: 'せ', k: 'セ', r: 'se' }, { h: 'そ', k: 'ソ', r: 'so' },
  { h: 'た', k: 'タ', r: 'ta' }, { h: 'ち', k: 'チ', r: 'chi' }, { h: 'つ', k: 'ツ', r: 'tsu' }, { h: 'て', k: 'テ', r: 'te' }, { h: 'と', k: 'ト', r: 'to' },
  { h: 'な', k: 'ナ', r: 'na' }, { h: 'に', k: 'ニ', r: 'ni' }, { h: 'ぬ', k: 'ヌ', r: 'nu' }, { h: 'ね', k: 'ネ', r: 'ne' }, { h: 'の', k: 'ノ', r: 'no' },
  { h: 'は', k: 'ハ', r: 'ha' }, { h: 'ひ', k: 'ヒ', r: 'hi' }, { h: 'ふ', k: 'フ', r: 'fu' }, { h: 'へ', k: 'ヘ', r: 'he' }, { h: 'ほ', k: 'ホ', r: 'ho' },
  { h: 'ま', k: 'マ', r: 'ma' }, { h: 'み', k: 'ミ', r: 'mi' }, { h: 'む', k: 'ム', r: 'mu' }, { h: 'め', k: 'メ', r: 'me' }, { h: 'も', k: 'モ', r: 'mo' },
  { h: 'や', k: 'ヤ', r: 'ya' }, { h: '', k: '', r: '' }, { h: 'ゆ', k: 'ユ', r: 'yu' }, { h: '', k: '', r: '' }, { h: 'よ', k: 'ヨ', r: 'yo' },
  { h: 'ら', k: 'ラ', r: 'ra' }, { h: 'り', k: 'リ', r: 'ri' }, { h: 'る', k: 'ル', r: 'ru' }, { h: 'れ', k: 'レ', r: 're' }, { h: 'ろ', k: 'ロ', r: 'ro' },
  { h: 'わ', k: 'ワ', r: 'wa' }, { h: '', k: '', r: '' }, { h: '', k: '', r: '' }, { h: '', k: '', r: '' }, { h: 'を', k: 'ヲ', r: 'wo' },
  { h: 'ん', k: 'ン', r: 'n' }
];

const KOTOWAZA_LIST = [
  {
    jp: '七転び八起き',
    rom: 'Nanakorobi yaoki',
    id: 'Jatuh tujuh kali, bangkit delapan kali.',
    desc: 'Semangat pantang menyerah. Walaupun mengalami kegagalan berkali-kali, harus selalu bangkit berdiri kembali.',
    grammar: '七 (tujuh) + 転び (jatuh) + 八 (delapan) + 起き (bangkit).'
  },
  {
    jp: '一期一会',
    rom: 'Ichigo ichie',
    id: 'Satu pertemuan, satu kesempatan seumur hidup.',
    desc: 'Menghargai setiap pertemuan dengan orang lain karena pertemuan tersebut mungkin tidak akan pernah terulang lagi.',
    grammar: '一期 (seumur hidup) + 一会 (satu pertemuan).'
  },
  {
    jp: '猿も木から落ちる',
    rom: 'Saru mo ki kara ochiru',
    id: 'Bahkan monyet pun bisa jatuh dari pohon.',
    desc: 'Semua orang, bahkan yang paling ahli dalam bidangnya sekalipun, pasti pernah melakukan kesalahan atau kegagalan.',
    grammar: '猿 (monyet) + も (pun) + 木から (dari pohon) + 落ちる (jatuh).'
  },
  {
    jp: '塵も積もれば山となる',
    rom: 'Chiri mo tsumoreba yama to naru',
    id: 'Jika debu menumpuk, ia akan menjadi gunung.',
    desc: 'Usaha kecil yang terus dilakukan secara konsisten setiap hari pada akhirnya akan menghasilkan pencapaian yang besar.',
    grammar: '塵 (debu) + も (pun) + 積もれば (jika menumpuk) + 山 (gunung) + となる (menjadi).'
  },
  {
    jp: '初心忘るべかなず',
    rom: 'Shoshin wasuru bekarazu',
    id: 'Jangan pernah melupakan niat awal kita.',
    desc: 'Pentingnya menjaga kerendahan hati dan semangat belajar yang membara seperti saat pertama kali memulai sesuatu.',
    grammar: '初心 (niat awal/pemula) + 忘るべからず (tidak boleh dilupakan).'
  },
  {
    jp: '石の上にも三年',
    rom: 'Ishi no ue ni mo sannen',
    id: 'Tiga tahun di atas batu.',
    desc: 'Ketekunan mendatangkan hasil. Bahkan duduk di atas batu yang dingin sekalipun selama tiga tahun akan membuatnya hangat.',
    grammar: '石の上 (di atas batu) + にmo (pun) + 三年 (tiga tahun).'
  },
  {
    jp: '継続は力なり',
    rom: 'Keizoku wa chikara nari',
    id: 'Keberlanjutan adalah kekuatan.',
    desc: 'Konsistensi dan kontinuitas dalam melakukan sesuatu adalah kunci utama untuk memperoleh kekuatan dan kesuksesan.',
    grammar: '継続 (konsistensi/kontinuitas) + は (adalah) + 力 (kekuatan) + なり (merupakan).'
  }
];

const getChibiGreeting = (charId: string, hour: number) => {
  if (hour >= 5 && hour < 11) {
    if (charId === 'mahiru') {
      return {
        jp: 'おはようございます。今日も一緒に頑張りましょうね。',
        rom: 'Ohayou gozaimasu. Kyou mo issho ni gambarimashou ne.',
        id: 'Selamat pagi. Hari ini mari berjuang bersama-sama lagi ya.',
      };
    } else if (charId === 'umi') {
      return {
        jp: 'おはよー！ほら、今日もシャキッと勉強いくよー！',
        rom: 'Ohayou! Hora, kyou mo shakitto benkyou iku yo!',
        id: 'Pagi! Ayo, hari ini juga belajar dengan penuh semangat!',
      };
    } else if (charId === 'nagisa') {
      return {
        jp: 'おはよ、ふふっ。まだ眠そうな顔してるね。可愛い。',
        rom: 'Ohayo, fufu. Mada nemurasou na kao shiteru ne. Kawaii.',
        id: 'Pagi, fufu. Wajahmu masih kelihatan mengantuk ya. Lucunya.',
      };
    } else {
      return {
        jp: 'おはようございます！日本語の勉強を始めましょう。',
        rom: 'Ohayou gozaimasu! Nihongo no benkyou wo hajimemashou.',
        id: 'Selamat pagi! Mari kita mulai belajar bahasa Jepang.',
      };
    }
  } else if (hour >= 11 && hour < 18) {
    if (charId === 'mahiru') {
      return {
        jp: 'こんにちは。お昼休みはちゃんと休めましたか？',
        rom: 'Konnichiwa. Ohiruyasumi wa chanto yasumemasita ka?',
        id: 'Selamat siang. Apakah Anda beristirahat dengan baik saat istirahat siang?',
      };
    } else if (charId === 'umi') {
      return {
        jp: 'ちーっす！昼過ぎも気合入れて突っ走るよー！',
        rom: 'Chiissu! Hirusugi mo kiai irete tsutsupashiru yo!',
        id: 'Halo! Siang ini juga mari kita tancap gas dengan penuh energi!',
      };
    } else if (charId === 'nagisa') {
      return {
        jp: 'こんにちはー。ちょっと休憩して、私とお話しよ？',
        rom: 'Konnichiwa. Chotto kyuukei shite, watashi to ohanashi yo?',
        id: 'Selamat siang. Istirahat sebentar yuk, lalu mengobrol denganku?',
      };
    } else {
      return {
        jp: 'こんにちは！学習は順調ですか？',
        rom: 'Konnichiwa! Gakushuu wa junchou desu ka?',
        id: 'Selamat siang! Bagaimana perkembangan belajar Anda?',
      };
    }
  } else {
    if (charId === 'mahiru') {
      return {
        jp: 'こんばんは。今日も一日、本当にお疲れ様でした。',
        rom: 'Konbanwa. Kyou mo ichinichi, hontou ni otsukaresama deshita.',
        id: 'Selamat malam. Terima kasih banyak atas kerja keras Anda hari ini.',
      };
    } else if (charId === 'umi') {
      return {
        jp: 'おつかれー！夜の勉強も付き合うから、さくっとやろ！',
        rom: 'Otsukare! Yoru no benkyou mo tsukiaku kara, sakutto yaro!',
        id: 'Malam! Aku akan menemani belajar malammu, ayo lakukan dengan santai!',
      };
    } else if (charId === 'nagisa') {
      return {
        jp: 'こんばんは、ふふっ。夜更かししすぎちゃダメだよ？',
        rom: 'Konbanwa, fufu. Yofukashi sugichara dame da yo?',
        id: 'Selamat malam, fufu. Jangan begadang terlalu larut malam ya?',
      };
    } else {
      return {
        jp: 'こんばんは！夜の学習はとても効果的ですよ。',
        rom: 'Konbanwa! Yoru no gakushuu wa totemo koukateki desu yo.',
        id: 'Selamat malam! Belajar di malam hari sangat efektif lho.',
      };
    }
  }
};

export default function App() {
  const isNativeAPK = typeof window !== 'undefined' && (
    (window as any).Capacitor ||
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    !window.location.hostname.includes('.')
  );

  // Authentication & Profile States
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [googleRendered, setGoogleRendered] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfPassword, setAuthConfPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [soundboardMode, setSoundboardMode] = useState<'hiragana' | 'katakana'>('hiragana');
  const [showChibiGreeting, setShowChibiGreeting] = useState(true);
  const [grammarExpanded, setGrammarExpanded] = useState(false);
  const [greetingPlayed, setGreetingPlayed] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authCaptchaAnswer, setAuthCaptchaAnswer] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaProblem, setCaptchaProblem] = useState({ q: '', a: 0 });
  const [guestName, setGuestName] = useState('');

  // Modals & Popups
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  
  // New State Variables for Features V2
  const [announcementText, setAnnouncementText] = useState('BANGGGG KOK DOWNLOAD HARUS VIP ? BANTUIN PATUNGAN YOK SINI BARU FREE,,, GAK ADA YANG GRATIS DI DUNIA INI.');
  const [isAnnouncementExpanded, setIsAnnouncementExpanded] = useState(false);
  const [chatAttachedImage, setChatAttachedImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeHelpView, setActiveHelpView] = useState<'list' | 'chat' | null>(null);
  const [helpTickets, setHelpTickets] = useState<any[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [ticketQueryText, setTicketQueryText] = useState('');
  const [ticketChatInput, setTicketChatInput] = useState('');
  const [showNetworkDiagnostics, setShowNetworkDiagnostics] = useState(false);
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [networkJitter, setNetworkJitter] = useState<number | null>(null);
  const [networkSpeed, setNetworkSpeed] = useState<string | null>(null);
  const [diagnosingNetwork, setDiagnosingNetwork] = useState(false);
  const [showCreditApp, setShowCreditApp] = useState(false);
  const [showDmcaDisclaimer, setShowDmcaDisclaimer] = useState(false);
  const [showDevPortal, setShowDevPortal] = useState(false);
  const [devPortalTab, setDevPortalTab] = useState<'stats' | 'users' | 'tickets' | 'reports' | 'announcements'>('stats');
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [devUserSearch, setDevUserSearch] = useState('');
  
  // State for Customizable Profile Background
  const [selectedBgPreset, setSelectedBgPreset] = useState('bg-gradient-to-tr from-indigo-900/60 to-slate-900/90');
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [showJlptModal, setShowJlptModal] = useState(false);
  const [showGoogleAPKSheet, setShowGoogleAPKSheet] = useState(false);
  const [googleAPKCustomEmail, setGoogleAPKCustomEmail] = useState('');
  const [showGoogleAPKInput, setShowGoogleAPKInput] = useState(false);
  const [googleAPKLoading, setGoogleAPKLoading] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  
  // Profile Edits
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarBase64, setEditAvatarBase64] = useState<string | null>(null);
  const [editDeskripsi, setEditDeskripsi] = useState('');
  const [editTtl, setEditTtl] = useState('');

  // App Routing (Tabs)
  const [activeTab, setActiveTab] = useState<'kuis' | 'kamus' | 'practice' | 'chat' | 'ranking' | 'pencapaian' | 'profil' | 'riwayat' | 'setting'>('kuis');

  // Customizable settings: vocal character and visually stunning Japanese themes
  const [voiceCharacter, setVoiceCharacter] = useState<string>(() => {
    return localStorage.getItem('nik_voice_character') || 'default';
  });
  const [voiceEngine, setVoiceEngine] = useState<'gemini' | 'cloud' | 'system'>(() => {
    return (localStorage.getItem('nik_voice_engine') as 'gemini' | 'cloud' | 'system') || 'gemini';
  });
  const [currentTheme, setCurrentTheme] = useState<'sakura' | 'aqua' | 'rose' | 'biru_langit'>(() => {
    return (localStorage.getItem('nik_theme') as any) || 'sakura';
  });

  const [visitedKamus, setVisitedKamus] = useState<boolean>(() => {
    return localStorage.getItem('nik_visited_kamus') === 'true';
  });

  const [pencapaianSubTab, setPencapaianSubTab] = useState<'lencana' | 'level'>('lencana');

  // Email verification OTP States
  const [otpStep, setOtpStep] = useState(false);
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [sentOtpDebug, setSentOtpDebug] = useState<string | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);

  const particlesCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: any[] = [];

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      x: number = 0;
      y: number = 0;
      size: number = 0;
      speedX: number = 0;
      speedY: number = 0;
      opacity: number = 0;
      blinkSpeed: number = 0;
      angle: number = 0;
      spin: number = 0;

      constructor() {
        this.reset();
      }

      reset() {
        if (!canvas) return;
        this.x = Math.random() * canvas.width;
        this.y = currentTheme === 'sakura' ? -10 : (currentTheme === 'aqua' ? canvas.height + 10 : Math.random() * canvas.height);
        this.size = currentTheme === 'sakura' ? Math.random() * 4 + 2.5 : (currentTheme === 'aqua' ? Math.random() * 3 + 1.5 : Math.random() * 1.5 + 0.2);
        
        if (currentTheme === 'sakura') {
          // Falling cherry blossoms
          this.speedX = (Math.random() - 0.2) * 0.25; // slight sway to the right
          this.speedY = Math.random() * 0.45 + 0.25; // always falling
        } else if (currentTheme === 'aqua') {
          // Rising bubbles
          this.speedX = (Math.random() - 0.5) * 0.15;
          this.speedY = -(Math.random() * 0.4 + 0.2); // always rising
        } else {
          // Normal glowing stars
          this.speedX = (Math.random() - 0.5) * 0.12;
          this.speedY = (Math.random() - 0.5) * 0.12;
        }

        this.opacity = Math.random();
        this.blinkSpeed = Math.random() * 0.008 + 0.002;
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.015;
      }

      update() {
        if (!canvas) return;
        this.x += this.speedX;
        this.y += this.speedY;
        this.opacity += this.blinkSpeed;
        if (this.opacity > 1 || this.opacity < 0) this.blinkSpeed *= -1;
        this.angle += this.spin;

        // Boundaries check
        if (currentTheme === 'sakura') {
          if (this.y > canvas.height + 10 || this.x < -10 || this.x > canvas.width + 10) {
            this.reset();
            this.y = -10;
          }
        } else if (currentTheme === 'aqua') {
          if (this.y < -10 || this.x < -10 || this.x > canvas.width + 10) {
            this.reset();
            this.y = canvas.height + 10;
          }
        } else {
          if (this.x < 0) this.x = canvas.width;
          if (this.x > canvas.width) this.x = 0;
          if (this.y < 0) this.y = canvas.height;
          if (this.y > canvas.height) this.y = 0;
        }
      }

      draw() {
        if (!ctx) return;
        
        if (currentTheme === 'sakura') {
          // Gorgeous falling pink sakura petal
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(this.angle);
          ctx.fillStyle = `rgba(244, 63, 94, ${Math.max(0, this.opacity * 0.65)})`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-this.size * 1.5, -this.size * 1.5, -this.size * 1.5, this.size * 1.5, 0, this.size * 2);
          ctx.bezierCurveTo(this.size * 1.5, this.size * 1.5, this.size * 1.5, -this.size * 1.5, 0, 0);
          ctx.fill();
          ctx.restore();
        } else if (currentTheme === 'aqua') {
          // Translucent slowly rising water bubbles
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, this.opacity * 0.4)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0, this.opacity * 0.15)})`;
          ctx.fill();
        } else if (currentTheme === 'rose') {
          // Elegant rose gold blinking stars
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate(this.angle);
          ctx.fillStyle = `rgba(251, 191, 36, ${Math.max(0, this.opacity * 0.7)})`;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.lineTo(0, -this.size * 2);
            ctx.lineTo(this.size * 0.5, -this.size * 0.5);
            ctx.rotate(Math.PI / 2);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Classic beautiful sky-blue clouds/dots
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(14, 165, 233, ${Math.max(0, this.opacity * 0.55)})`;
          ctx.fill();
        }
      }
    }

    const particleCount = window.innerWidth < 768 ? 45 : 110;
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [currentTheme]);

  useEffect(() => {
    if (activeTab === 'kamus') {
      setVisitedKamus(true);
      localStorage.setItem('nik_visited_kamus', 'true');
    }
  }, [activeTab]);

  useEffect(() => {
    globalVoiceCharacter = voiceCharacter;
    localStorage.setItem('nik_voice_character', voiceCharacter);
  }, [voiceCharacter]);

  // Reset chat history to character-specific welcoming message when voice character/model changes
  useEffect(() => {
    let welcomeText = 'Konnichiwa! 👋 Saya Sensei AI. Tanya apa saja seputar bahasa Jepang yang membingungkanmu!';
    
    switch (voiceCharacter) {
      case 'mahiru':
        welcomeText = 'あの、こんにちは。椎名真昼です。一緒に日本語を勉強しましょうね。私でお役に立てることがあれば、何でも聞いてください。';
        break;
      case 'umi':
        welcomeText = 'じゃあ、お疲れ！朝凪海だよ。日本語の勉強、調子はどう？わからないことがあったら、アタシに何でも気軽に聞いてね！';
        break;
      case 'nagisa':
        welcomeText = 'ふふ、こんにちは！久保渚咲だよ。ねえ、日本語の勉強で行き詰まってない？渚咲がなんでも教えてあげるから、遠慮しないで聞いてね？';
        break;
      case 'furina':
        welcomeText = 'さあ！ボクの名はフリーナ！世界一美しく偉大な元 Hydro Archon さ！フッ、君の日本語の疑問など、このボクが劇的に解決してあげよう！何でも尋ねたまえ！';
        break;
      case 'hutao':
        welcomeText = 'それっ！往生堂の堂主、胡桃とはアタシのこと！おやおや、日本語のことで頭を悩ませてるのかい？アタシが楽しい謎解きみたいに教えてあげるよ！何でも聞いて！';
        break;
      case 'columbina':
        welcomeText = 'ふふ、こんにちは…少女、コロンビーナよ。静かに、あなたの声を聞かせて…日本語について知りたいことがあるの？私にそっと教えてね…';
        break;
      case 'kyoko':
        welcomeText = 'ほら、こんにちは！堀京子だよ。日本語の勉強、頑張ってる？ちょっと難しいところがあったら、あたしがスパッと教えてあげるから！なんでも言ってね！';
        break;
    }

    setSenseiChat([
      { role: 'model', text: welcomeText }
    ]);
  }, [voiceCharacter]);

  useEffect(() => {
    localStorage.setItem('nik_voice_engine', voiceEngine);
  }, [voiceEngine]);

  useEffect(() => {
    localStorage.setItem('nik_theme', currentTheme);
  }, [currentTheme]);

  // Trigger Time-of-Day Chibi Voice Greeting on first load of Dashboard
  useEffect(() => {
    if (activeTab === 'kuis' && currentUser && !greetingPlayed) {
      const hour = new Date().getHours();
      const greet = getChibiGreeting(voiceCharacter, hour);
      
      const timer = setTimeout(() => {
        playAudio(greet.jp);
        setGreetingPlayed(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [activeTab, currentUser, voiceCharacter, greetingPlayed]);

  // Quiz States
  const [levelFilter, setLevelFilter] = useState<string>('hiragana');
  const [quizMode, setQuizMode] = useState<QuizMode>('mc4');
  const [practiceActive, setPracticeActive] = useState(false);
  const [quizPool, setQuizPool] = useState<KanaItem[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [scoreBenar, setScoreBenar] = useState(0);
  const [streakKuis, setStreakKuis] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [essayInput, setEssayInput] = useState('');
  const [essayStatus, setEssayStatus] = useState<'correct' | 'wrong' | null>(null);
  const [essayCorrectAns, setEssayCorrectAns] = useState('');
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [optionStates, setOptionStates] = useState<Record<string, 'correct' | 'wrong' | 'neutral'>>({});
  const [currentOptions, setCurrentOptions] = useState<KanaItem[]>([]);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);

  // AI Quiz States
  const [aiQuestion, setAiQuestion] = useState<AIQuestion | null>(null);
  const [aiQuizLoading, setAiQuizLoading] = useState(false);
  const [aiQuizAnswered, setAiQuizAnswered] = useState(false);
  const [aiQuizFeedback, setAiQuizFeedback] = useState('');

  // JLPT Exam States
  const [jlptActive, setJlptActive] = useState(false);
  const [jlptTimeLeft, setJlptTimeLeft] = useState(0); // in seconds
  const [jlptLevel, setJlptLevel] = useState<string>('');
  const [jlptQuestions, setJlptQuestions] = useState<any[]>([]);
  const [jlptIndex, setJlptIndex] = useState<number>(0);
  const [showJlptListModal, setShowJlptListModal] = useState<boolean>(false);
  const [showJlptConfirmModal1, setShowJlptConfirmModal1] = useState<boolean>(false);
  const [showJlptConfirmModal2, setShowJlptConfirmModal2] = useState<boolean>(false);
  const [jlptCheckedConfirm, setJlptCheckedConfirm] = useState<boolean>(false);
  const [jlptExamHistory, setJlptExamHistory] = useState<any[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Daily Bento Box States
  const [bentoClaimDate, setBentoClaimDate] = useState<string>(() => {
    return localStorage.getItem('nik_bento_claim_date') || '';
  });
  const getTodayDateString = () => {
    const today = new Date();
    const YYYY = today.getFullYear();
    const MM = String(today.getMonth() + 1).padStart(2, '0');
    const DD = String(today.getDate()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}`;
  };
  const todayStr = getTodayDateString();
  const isBentoClaimedToday = bentoClaimDate === todayStr;

  // Syarat Ketentuan Modal States
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  // Live Chat States
  const [liveChatMessages, setLiveChatMessages] = useState<any[]>([]);
  const [liveChatInput, setLiveChatInput] = useState<string>('');
  const [liveChatSending, setLiveChatSending] = useState<boolean>(false);
  const [liveChatLoading, setLiveChatLoading] = useState<boolean>(false);
  const [appInitialized, setAppInitialized] = useState<boolean>(false);

  const fetchLiveChatMessages = async (silent = false) => {
    if (!silent) setLiveChatLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/chat/messages');
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === 'success') {
        setLiveChatMessages(d.data || []);
      }
    } catch (err) {
      console.warn('Gagal memuat pesan live chat:', err);
    } finally {
      if (!silent) setLiveChatLoading(false);
    }
  };

  const handleSendLiveChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      triggerToast('Kamu harus login terlebih dahulu untuk mengirim pesan!', 'error');
      return;
    }
    if (!liveChatInput.trim()) return;
    if (liveChatInput.length > 250) {
      triggerToast('Pesan maksimal 250 karakter!', 'error');
      return;
    }

    setLiveChatSending(true);
    try {
      const res = await fetch(API_BASE + '/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          text: liveChatInput.trim(),
          image: chatAttachedImage
        })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === 'success') {
        setLiveChatInput('');
        setChatAttachedImage(null);
        setLiveChatMessages(prev => {
          // Avoid duplicate appends if polling caught it
          if (prev.some(m => m.id === d.data.id)) return prev;
          return [...prev, d.data];
        });
        
        // Auto scroll to bottom of chatbox
        setTimeout(() => {
          const el = document.getElementById('live-chat-scrollbox');
          if (el) el.scrollTop = el.scrollHeight;
        }, 100);
      } else {
        triggerToast(d.message || 'Gagal mengirim pesan.', 'error');
      }
    } catch (err) {
      triggerToast('Koneksi terganggu. Gagal mengirim pesan.', 'error');
    } finally {
      setLiveChatSending(false);
    }
  };

  // V2: Announcement & Notification Permission Setup (with active live polling and desktop notifications)
  useEffect(() => {
    let active = true;
    let lastText = '';

    const fetchAnnouncement = async () => {
      try {
        const res = await fetch('/api/announcement');
        if (res.ok) {
          const d = await res.json();
          if (d.status === 'success' && d.data && active) {
            // Trigger push notification if it changes and is not first load
            if (lastText && d.data !== lastText) {
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification("📢 Pengumuman Baru Zenith Nihongo", {
                    body: d.data,
                    icon: "/store_icon.png"
                  });
                } catch (e) {
                  console.error('Failed to trigger native notification:', e);
                }
              }
            }
            lastText = d.data;
            setAnnouncementText(d.data);
          }
        }
      } catch (e) {
        console.error('Failed to fetch announcement:', e);
      }
    };

    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 8000); // Polling every 8s

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  // V2: Support Tickets Polling Loop
  useEffect(() => {
    if (!currentUser) return;
    const fetchTickets = async () => {
      try {
        const res = await fetch(API_BASE + `/api/tickets/list?uid=${currentUser.uid}`);
        if (res.ok) {
          const d = await res.json();
          if (d.status === 'success' && d.data) {
            setHelpTickets(d.data);
          }
        }
      } catch (e) {
        console.error('Failed to fetch tickets:', e);
      }
    };

    fetchTickets();
    const interval = setInterval(fetchTickets, 6000);
    return () => clearInterval(interval);
  }, [currentUser, showDevPortal]);

  // V2: Auto network diagnostics trigger
  useEffect(() => {
    if (showNetworkDiagnostics) {
      startNetworkDiagnostics();
    }
  }, [showNetworkDiagnostics]);

  // V2: Dev & Network Diagnostics functions
  const startNetworkDiagnostics = async () => {
    if (diagnosingNetwork) return;
    setDiagnosingNetwork(true);
    setNetworkLatency(null);
    setNetworkJitter(null);
    setNetworkSpeed(null);

    const pings: number[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await fetch('/api/announcement' + `?nocache=${Date.now()}`);
        const end = performance.now();
        pings.push(end - start);
        await new Promise(r => setTimeout(r, 200));
      }

      const avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
      let diffSum = 0;
      for (let i = 1; i < pings.length; i++) {
        diffSum += Math.abs(pings[i] - pings[i - 1]);
      }
      const jitter = Math.round(diffSum / (pings.length - 1));

      const speedStart = performance.now();
      const speedRes = await fetch('/api/announcement');
      await speedRes.text();
      const speedEnd = performance.now();
      
      let simulatedSpeed = "24.5 Mbps";
      if (avgPing < 50) {
        simulatedSpeed = (90 + Math.random() * 20).toFixed(1) + " Mbps";
      } else if (avgPing < 150) {
        simulatedSpeed = (30 + Math.random() * 15).toFixed(1) + " Mbps";
      } else {
        simulatedSpeed = (4 + Math.random() * 5).toFixed(1) + " Mbps";
      }

      setNetworkLatency(avgPing);
      setNetworkJitter(jitter);
      setNetworkSpeed(simulatedSpeed);
    } catch (e) {
      console.error(e);
      triggerToast('Gagal melakukan diagnosa jaringan.', 'error');
    } finally {
      setDiagnosingNetwork(false);
    }
  };

  const handleUpdateUserRole = async (targetUid: string, newRole: string) => {
    try {
      const res = await fetch(API_BASE + '/api/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser?.uid, targetUid, newRole })
      });
      const d = await res.json();
      if (res.ok && d.status === 'success') {
        triggerToast('Role pengguna berhasil diperbarui!', 'success');
        fetchDevUsersList();
      } else {
        triggerToast(d.message || 'Gagal memperbarui role.', 'error');
      }
    } catch (e) {
      triggerToast('Gagal terhubung ke server.', 'error');
    }
  };

  const handleResetUserScore = async (targetUid: string) => {
    try {
      const res = await fetch(API_BASE + '/api/users/reset-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser?.uid, targetUid })
      });
      const d = await res.json();
      if (res.ok && d.status === 'success') {
        triggerToast('Skor & XP pengguna berhasil direset!', 'success');
        fetchDevUsersList();
      } else {
        triggerToast(d.message || 'Gagal mereset skor.', 'error');
      }
    } catch (e) {
      triggerToast('Gagal terhubung ke server.', 'error');
    }
  };

  const handleUpdateAnnouncementDev = async (newText: string) => {
    try {
      const res = await fetch(API_BASE + '/api/announcement/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser?.uid, text: newText })
      });
      const d = await res.json();
      if (res.ok && d.status === 'success') {
        setAnnouncementText(newText);
        triggerToast('Pengumuman resmi berhasil diperbarui!', 'success');
      } else {
        triggerToast(d.message || 'Gagal memperbarui pengumuman.', 'error');
      }
    } catch (e) {
      triggerToast('Gagal terhubung ke server.', 'error');
    }
  };

  const fetchDevUsersList = async () => {
    try {
      const res = await fetch(API_BASE + `/api/users/list?uid=${currentUser?.uid}`);
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'success') {
          setAllUsersList(d.data || []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateHelpTicket = async () => {
    if (!currentUser) return;
    if (!ticketQueryText.trim()) {
      triggerToast('Harap deskripsikan kendala Anda terlebih dahulu!', 'error');
      return;
    }

    try {
      const res = await fetch(API_BASE + '/api/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          username: currentUser.username,
          message: ticketQueryText.trim()
        })
      });
      const d = await res.json();
      if (res.ok && d.status === 'success') {
        setTicketQueryText('');
        setActiveTicketId(d.data.id);
        setActiveHelpView('chat');
        triggerToast('Tiket obrolan berhasil dibuka!', 'success');
      } else {
        triggerToast(d.message || 'Gagal membuka tiket.', 'error');
      }
    } catch (e) {
      triggerToast('Koneksi terganggu. Gagal membuka tiket.', 'error');
    }
  };

  const handleSendTicketMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeTicketId || !ticketChatInput.trim()) return;

    try {
      const res = await fetch(API_BASE + '/api/tickets/message/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          ticketId: activeTicketId,
          text: ticketChatInput.trim()
        })
      });
      const d = await res.json();
      if (res.ok && d.status === 'success') {
        setTicketChatInput('');
        setHelpTickets(prev => prev.map(t => {
          if (t.id === activeTicketId) {
            return {
              ...t,
              messages: [...t.messages, {
                id: 'tmp-' + Math.random(),
                senderUid: currentUser.uid,
                senderName: currentUser.displayName,
                text: ticketChatInput.trim(),
                createdAt: new Date().toISOString()
              }]
            };
          }
          return t;
        }));
        setTimeout(() => {
          const el = document.getElementById('ticket-chat-scrollbox');
          if (el) el.scrollTop = el.scrollHeight;
        }, 100);
      } else {
        triggerToast(d.message || 'Gagal mengirim pesan bantuan.', 'error');
      }
    } catch (e) {
      triggerToast('Gagal terhubung ke server.', 'error');
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      const res = await fetch(API_BASE + `/api/tickets/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      const d = await res.json();
      if (res.ok && d.status === 'success') {
        triggerToast('Tiket bantuan berhasil ditutup.', 'success');
        if (activeTicketId === ticketId) {
          setActiveHelpView('list');
        }
      }
    } catch (e) {
      triggerToast('Gagal menutup tiket.', 'error');
    }
  };

  // Poll live chat messages when on dashboard
  useEffect(() => {
    if (activeTab === 'kuis') {
      fetchLiveChatMessages(true);
      const timer = setInterval(() => {
        fetchLiveChatMessages(true);
      }, 3500);
      return () => clearInterval(timer);
    }
  }, [activeTab]);

  // User Report States
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportCategory, setReportCategory] = useState<'bug' | 'fitur' | 'audio' | 'lainnya'>('bug');
  const [reportMessage, setReportMessage] = useState<string>('');
  const [reportSending, setReportSending] = useState<boolean>(false);

  // Developer Dashboard / Portal States
  const [devReports, setDevReports] = useState<any[]>([]);
  const [devReportsLoading, setDevReportsLoading] = useState<boolean>(false);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);

  // Acceptance modal dynamic checker
  const checkTermsAcceptance = (userData: UserProfile) => {
    if (!localStorage.getItem('nik_terms_accepted')) {
      setTimeout(() => setShowTermsModal(true), 1200);
    }
  };

  // Reusable Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya',
    cancelText: 'Tidak',
    onConfirm: () => {}
  });

  // Dictionary States
  const [dictionaryFilter, setDictionaryFilter] = useState<string>('all');
  const [dictionarySearch, setDictionarySearch] = useState('');
  const [dictionaryDetailEntry, setDictionaryDetailEntry] = useState<KanaItem & { type: string; level: string } | null>(null);
  const [dictionaryLimit, setDictionaryLimit] = useState<number>(48);

  // Reset dictionary limit when filters are updated to maintain performance
  useEffect(() => {
    setDictionaryLimit(48);
  }, [dictionaryFilter, dictionarySearch]);

  // Canvas Drawing States
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [completedStrokes, setCompletedStrokes] = useState<number>(0);

  // System Settings
  const [autoSound, setAutoSound] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sensei AI Chat Bot States
  const [senseiOpen, setSenseiOpen] = useState(false);
  const [senseiChat, setSenseiChat] = useState<ChatMessage[]>([
    { role: 'model', text: 'Konnichiwa! 👋 Saya Sensei AI. Tanya apa saja seputar bahasa Jepang yang membingungkanmu!' }
  ]);
  const [senseiInput, setSenseiInput] = useState('');
  const [senseiLoading, setSenseiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Stats Counters
  const [localPoin, setLocalPoin] = useState(0);
  const [localXp, setLocalXp] = useState(0);

  // STATS RESET & DAILY MISSION RESET at 6:00 AM (24H Reset)
  const getCurrentMissionDay = React.useCallback(() => {
    const now = new Date();
    const reset = new Date(now);
    reset.setHours(6, 0, 0, 0);
    if (now < reset) {
      reset.setDate(reset.getDate() - 1);
    }
    return reset.toISOString().split('T')[0];
  }, []);

  const [currentDay, setCurrentDay] = useState<string>(() => {
    return getCurrentMissionDay();
  });

  const [dailyQuestProgress, setDailyQuestProgress] = useState<Record<string, number>>(() => {
    const savedDay = localStorage.getItem('nik_daily_quest_day');
    const targetDay = getCurrentMissionDay();
    if (savedDay === targetDay) {
      const savedProg = localStorage.getItem('nik_daily_quest_progress');
      if (savedProg) {
        try { return JSON.parse(savedProg); } catch (_) {}
      }
    }
    return {
      daily_q_1: 0, daily_q_2: 0, daily_q_3: 0, daily_q_4: 0, daily_q_5: 0,
      daily_q_6: 0, daily_q_7: 0, daily_q_8: 0, daily_q_9: 0, daily_q_10: 0
    };
  });

  const [dailyQuestClaimed, setDailyQuestClaimed] = useState<Record<string, boolean>>(() => {
    const savedDay = localStorage.getItem('nik_daily_quest_day');
    const targetDay = getCurrentMissionDay();
    if (savedDay === targetDay) {
      const savedClaimed = localStorage.getItem('nik_daily_quest_claimed');
      if (savedClaimed) {
        try { return JSON.parse(savedClaimed); } catch (_) {}
      }
    }
    return {
      daily_q_1: false, daily_q_2: false, daily_q_3: false, daily_q_4: false, daily_q_5: false,
      daily_q_6: false, daily_q_7: false, daily_q_8: false, daily_q_9: false, daily_q_10: false
    };
  });

  useEffect(() => {
    localStorage.setItem('nik_daily_quest_day', currentDay);
    localStorage.setItem('nik_daily_quest_progress', JSON.stringify(dailyQuestProgress));
  }, [dailyQuestProgress, currentDay]);

  useEffect(() => {
    localStorage.setItem('nik_daily_quest_claimed', JSON.stringify(dailyQuestClaimed));
  }, [dailyQuestClaimed]);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [holdState, setHoldState] = useState<{ id: string | null; progress: number }>({ id: null, progress: 0 });
  const holdIntervalRef = useRef<any>(null);

  const startHolding = (item: any) => {
    if (dailyQuestClaimed[item.id]) return;
    const progress = dailyQuestProgress[item.id] || 0;
    if (progress < item.target) {
      triggerToast("Selesaikan misi ini terlebih dahulu sebelum klaim hadiah!", "error");
      return;
    }
    
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    
    setHoldState({ id: item.id, progress: 0 });
    
    const intervalTime = 16; // ~60fps
    const duration = 1200; // 1.2s to fill
    const step = (intervalTime / duration) * 100;
    
    holdIntervalRef.current = setInterval(() => {
      setHoldState(prev => {
        if (prev.id !== item.id) {
          clearInterval(holdIntervalRef.current);
          return prev;
        }
        const nextProgress = prev.progress + step;
        if (nextProgress >= 100) {
          clearInterval(holdIntervalRef.current);
          setTimeout(() => {
            handleClaimDailyQuest(item);
          }, 20);
          return { id: null, progress: 0 };
        }
        return { ...prev, progress: nextProgress };
      });
    }, intervalTime);
  };

  const stopHolding = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldState(prev => {
      if (prev.id && prev.progress > 0 && prev.progress < 95) {
        triggerToast("Tekan & tahan tombol untuk mengklaim hadiah! 🎯", 'error');
      }
      return { id: null, progress: 0 };
    });
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const activeDailyQuests = React.useMemo(() => {
    // Generate deterministic 10 tiers of daily quests for the given day
    let sum = 0;
    for (let i = 0; i < currentDay.length; i++) {
      sum += currentDay.charCodeAt(i);
    }
    const list: any[] = [];

    // T1: Easiest
    const t1_val = sum % 2 === 0;
    list.push({
      id: 'daily_q_1',
      tier: 1,
      title: t1_val ? 'Penjelajah Kamus Harian (📖)' : 'Langkah Awal Belajar (🔰)',
      desc: t1_val ? 'Buka fitur Kamus Kanji Interaktif minimal 1 kali hari ini.' : 'Masuk ke menu Belajar Kuis untuk memulai latihan kosakata hari ini.',
      type: 'open_kamus',
      target: 1,
      xpReward: 50000,
      poinReward: 25000,
      icon: t1_val ? '📖' : '🔰'
    });

    // T2: Easiest -> Very Easy
    const t2_val = sum % 2 === 0;
    list.push({
      id: 'daily_q_2',
      tier: 2,
      title: t2_val ? 'Suara Sensei (🗣️)' : 'Aksen Anime Sejati (🔊)',
      desc: t2_val ? 'Dengarkan Text-to-Speech (audio lafal) kosakata sebanyak 5 kali.' : 'Sentuh tombol speaker untuk melafalkan suara Jepang sebanyak 4 kali.',
      type: 'anime_tts',
      target: t2_val ? 5 : 4,
      xpReward: 150000,
      poinReward: 75000,
      icon: t2_val ? '🗣️' : '🔊'
    });

    // T3: Easy
    const t3_val = sum % 3;
    const t3_targets = [8, 10, 12];
    const t3_target = t3_targets[t3_val];
    list.push({
      id: 'daily_q_3',
      tier: 3,
      title: 'Penembak Jitu Kosakata (🎯)',
      desc: `Jawab kuis latihan dengan benar sebanyak ${t3_target} kali hari ini.`,
      type: 'answer_correct',
      target: t3_target,
      xpReward: 350000,
      poinReward: 175000,
      icon: '🎯'
    });

    // T4: Easy -> Medium
    const t4_val = sum % 2 === 0;
    list.push({
      id: 'daily_q_4',
      tier: 4,
      title: t4_val ? 'Peserta Kuis Disiplin (📝)' : 'Ksatria Lembar Jawaban (✍️)',
      desc: t4_val ? 'Selesaikan 2 sesi kuis latihan jenis apa saja.' : 'Selesaikan 3 sesi kuis latihan sampai selesai.',
      type: 'take_quiz',
      target: t4_val ? 2 : 3,
      xpReward: 750000,
      poinReward: 375000,
      icon: t4_val ? '📝' : '✍️'
    });

    // T5: Medium
    const t5_val = sum % 2 === 0;
    list.push({
      id: 'daily_q_5',
      tier: 5,
      title: t5_val ? 'Pembuat Catatan Rajin (📜)' : 'Pembaca Teori Sempurna (📚)',
      desc: t5_val ? 'Buka penjelasan materi kosakata/tata bahasa sebanyak 5 kali hari ini.' : 'Pelajari pembahasan soal kuis latihan sebanyak 6 kali hari ini.',
      type: 'read_materi',
      target: t5_val ? 5 : 6,
      xpReward: 1500000,
      poinReward: 750000,
      icon: t5_val ? '📜' : '📚'
    });

    // T6: Medium -> Hard
    const t6_val = sum % 3;
    const t6_targets = [6, 8, 10];
    const t6_target = t6_targets[t6_val];
    list.push({
      id: 'daily_q_6',
      tier: 6,
      title: 'Streak Berapi-api (🔥)',
      desc: `Raih streak (jawaban benar beruntun) sebanyak ${t6_target} kali dalam kuis harian.`,
      type: 'score_match',
      target: t6_target,
      xpReward: 3000000,
      poinReward: 1500000,
      icon: '🔥'
    });

    // T7: Hard
    list.push({
      id: 'daily_q_7',
      tier: 7,
      title: 'Presisi Absolute Tanpa Celah (💯)',
      desc: 'Selesaikan setidaknya 1 sesi kuis latihan apa saja dengan akurasi 100% sempurna hari ini.',
      type: 'perfect_quiz',
      target: 1,
      xpReward: 4500000,
      poinReward: 2250000,
      icon: '💯'
    });

    // T8: Hard -> Very Hard
    const t8_val = sum % 2 === 0;
    list.push({
      id: 'daily_q_8',
      tier: 8,
      title: t8_val ? 'Pemuja Koin Emas (🪙)' : 'Kolektor Khazanah Belajar (💎)',
      desc: t8_val ? 'Dapatkan minimal 50 poin tambahan dari latihan kuis aktif hari ini.' : 'Dapatkan minimal 75 poin pembelajaran baru dari latihan kuis hari ini.',
      type: 'points_earned',
      target: t8_val ? 50 : 75,
      xpReward: 6000000,
      poinReward: 3000000,
      icon: t8_val ? '🪙' : '💎'
    });

    // T9: Very Hard -> Master
    list.push({
      id: 'daily_q_9',
      tier: 9,
      title: 'Penantang Ujian JLPT Resmi (🏫)',
      desc: 'Selesaikan 1 kali simulasi mini ujian resmi JLPT di sub-tab ujian.',
      type: 'jlpt_exam',
      target: 1,
      xpReward: 8000000,
      poinReward: 4000000,
      icon: '🏫'
    });

    // T10: LEGENDARY / THE ULTIMATE QUEST
    list.push({
      id: 'daily_q_10',
      tier: 10,
      title: 'Dewa Nihongo Kuno Abadi (⚡)',
      desc: 'Cetak total 50 jawaban kuis dengan benar hari ini untuk membuktikan kemampuan linguistik luar biasamu!',
      type: 'master_quest',
      target: 50,
      xpReward: 10000000,
      poinReward: 5000000,
      icon: '⚡'
    });

    return list;
  }, [currentDay]);

  const updateDailyQuestProgress = React.useCallback((type: string, valueOrUpdater: number | ((curr: number) => number), isSetDirect: boolean = false) => {
    setDailyQuestProgress(prev => {
      const targetQuests = activeDailyQuests.filter(q => q.type === type);
      if (targetQuests.length === 0) return prev;

      const nextProg = { ...prev };
      let changed = false;

      targetQuests.forEach(q => {
        const currentVal = nextProg[q.id] || 0;
        let newVal = 0;
        if (typeof valueOrUpdater === 'function') {
          newVal = valueOrUpdater(currentVal);
        } else if (isSetDirect) {
          newVal = valueOrUpdater;
        } else {
          newVal = currentVal + valueOrUpdater;
        }

        newVal = Math.min(q.target, Math.max(0, newVal));
        if (newVal !== currentVal) {
          nextProg[q.id] = newVal;
          changed = true;

          if (newVal === q.target && currentVal < q.target) {
            setTimeout(() => {
              triggerToast(`Misi Selesai: "${q.title}"! Silakan klaim hadiahmu! 🏆`, 'success');
            }, 300);
          }
        }
      });

      return changed ? nextProg : prev;
    });
  }, [activeDailyQuests]);

  useEffect(() => {
    if (activeTab === 'kamus') {
      updateDailyQuestProgress('open_kamus', 1);
    }
  }, [activeTab, updateDailyQuestProgress]);

  const handleClaimDailyQuest = (q: any) => {
    if (dailyQuestClaimed[q.id]) return;
    const progress = dailyQuestProgress[q.id] || 0;
    if (progress < q.target) {
      triggerToast("Selesaikan misi ini terlebih dahulu sebelum klaim hadiah!", "error");
      return;
    }

    setDailyQuestClaimed(prev => ({
      ...prev,
      [q.id]: true
    }));

    const nextPoin = localPoin + q.poinReward;
    const nextXp = localXp + q.xpReward;
    setLocalPoin(nextPoin);
    setLocalXp(nextXp);

    if (currentUser) {
      const updatedUser = { ...currentUser, poin: nextPoin, xp: nextXp };
      setCurrentUser(updatedUser);
      localStorage.setItem('nik_guest_profile', JSON.stringify(updatedUser));

      fetch(API_BASE + '/api/score/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          poin: nextPoin,
          xp: nextXp
        })
      });
    }

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 }
    });

    triggerToast(`Klaim Sukses! +${q.poinReward.toLocaleString()} Poin & +${q.xpReward.toLocaleString()} XP ditambahkan! 🏆`, 'success');
  };

  const triggerClaimWithAnimation = (q: any) => {
    if (claimingId) return;
    setClaimingId(q.id);
    
    setTimeout(() => {
      handleClaimDailyQuest(q);
      setClaimingId(null);
    }, 1200);
  };

  useEffect(() => {
    const checkDayInterval = setInterval(() => {
      const computedDay = getCurrentMissionDay();
      if (computedDay !== currentDay) {
        setCurrentDay(computedDay);
        const initialProg = {
          daily_q_1: 0, daily_q_2: 0, daily_q_3: 0, daily_q_4: 0, daily_q_5: 0,
          daily_q_6: 0, daily_q_7: 0, daily_q_8: 0, daily_q_9: 0, daily_q_10: 0
        };
        const initialClaimed = {
          daily_q_1: false, daily_q_2: false, daily_q_3: false, daily_q_4: false, daily_q_5: false,
          daily_q_6: false, daily_q_7: false, daily_q_8: false, daily_q_9: false, daily_q_10: false
        };
        setDailyQuestProgress(initialProg);
        setDailyQuestClaimed(initialClaimed);
        localStorage.setItem('nik_daily_quest_day', computedDay);
        localStorage.setItem('nik_daily_quest_progress', JSON.stringify(initialProg));
        localStorage.setItem('nik_daily_quest_claimed', JSON.stringify(initialClaimed));
        triggerToast("Hari baru telah tiba! Misi harianmu telah di-reset pada jam 06:00 AM.", "success");
      }
    }, 15000);
    return () => clearInterval(checkDayInterval);
  }, [currentDay, getCurrentMissionDay]);

  useEffect(() => {
    (window as any)._onTtsPlayed = () => {
      updateDailyQuestProgress('anime_tts', 1);
    };
    return () => {
      delete (window as any)._onTtsPlayed;
    };
  }, [updateDailyQuestProgress]);

  // Background floating kanji list
  const [floatingIcons, setFloatingIcons] = useState<{ id: number; char: string; left: number; size: number; duration: number }[]>([]);

  // Show customized floating toasts
  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any)._triggerToast = triggerToast;
    }
  }, [triggerToast]);

  // Generate math captcha to bypass turnstile flawlessly inside sandboxed iframe
  const generateNewCaptcha = () => {
    const num1 = Math.floor(1 + Math.random() * 9);
    const num2 = Math.floor(1 + Math.random() * 9);
    setCaptchaProblem({
      q: `${num1} + ${num2}`,
      a: num1 + num2
    });
    setAuthCaptchaAnswer('');
  };

  // Synchronize JLPT Exam History
  useEffect(() => {
    const historical = localStorage.getItem('nik_jlpt_history');
    if (historical) {
      try {
        setJlptExamHistory(JSON.parse(historical));
      } catch (e) {
        console.error("Failed to load JLPT history", e);
      }
    }
  }, []);

  // Gesture-unblocking mechanism for Speech Synthesis (especially iOS / Android browsers)
  useEffect(() => {
    const unlockSpeechEngine = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          // Play a silent, empty utterance inside the user tap context.
          const u = new SpeechSynthesisUtterance('');
          u.lang = 'ja-JP';
          u.volume = 0; // completely silent
          window.speechSynthesis.resume();
          window.speechSynthesis.speak(u);
          console.log('Mobile Speech Synthesis Unlocked via gesture.');
        } catch (e) {
          console.log('Speech unlock sweep failed:', e);
        }
        // Remove listeners once unlocked
        window.removeEventListener('click', unlockSpeechEngine);
        window.removeEventListener('touchstart', unlockSpeechEngine);
      }
    };
    window.addEventListener('click', unlockSpeechEngine);
    window.addEventListener('touchstart', unlockSpeechEngine);
    return () => {
      window.removeEventListener('click', unlockSpeechEngine);
      window.removeEventListener('touchstart', unlockSpeechEngine);
    };
  }, []);

  useEffect(() => {
    if (jlptExamHistory.length > 0) {
      localStorage.setItem('nik_jlpt_history', JSON.stringify(jlptExamHistory));
    }
  }, [jlptExamHistory]);

  // Listen for Cloudflare Turnstile token from both direct widget and iframe postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        const { type, token } = event.data;
        if (type === 'turnstile-token' && token) {
          console.log('🔒 Cloudflare Turnstile token received via postMessage:', token);
          setTurnstileToken(token);
        } else if (type === 'turnstile-expired' || type === 'turnstile-error') {
          console.warn('⚠️ Cloudflare Turnstile verification expired/errored.');
          setTurnstileToken(null);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Smoothly fade out and remove the premium Zenith preloader splash screen once App is fully initialized
  useEffect(() => {
    if (appInitialized && typeof document !== 'undefined') {
      const preloader = document.getElementById('app-preloader');
      if (preloader) {
        // Let it display for a tiny buffer (300ms) to ensure smooth transitions
        setTimeout(() => {
          preloader.style.opacity = '0';
          setTimeout(() => {
            preloader.remove();
          }, 800);
        }, 300);
      }
    }
  }, [appInitialized]);

  // On native APK, auto-set a bypass token since Turnstile can't load in Capacitor WebView
  useEffect(() => {
    if (isNativeAPK && showAuthModal) {
      console.log('📱 Native APK detected — auto-bypassing Turnstile for Capacitor environment.');
      setTurnstileToken('native-apk-bypass');
    }
  }, [isNativeAPK, showAuthModal, authMode]);

  // Check login on mount
  useEffect(() => {
    // Dynamically inject Google Client Script if not loaded
    if (typeof window !== 'undefined' && !(window as any).google) {
      console.log('🏁 Dynamically injecting Google GIS SDK client script...');
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const searchParams = typeof window !== 'undefined' ? window.location.search : '';
    if (searchParams.includes('auth_callback_uid=')) {
      console.log('🏁 auth_callback_uid detected, skipping standard check login on mount');
      return;
    }

    const savedUid = localStorage.getItem('nik_auth_uid');
    if (savedUid) {
      fetch(API_BASE + '/api/auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: savedUid })
      })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'success') {
          setCurrentUser(res.data);
          setLocalPoin(res.data.poin);
          setLocalXp(res.data.xp);
          triggerToast(`Selamat datang kembali, ${res.data.displayName}!`);
          checkTermsAcceptance(res.data);
        } else {
          localStorage.removeItem('nik_auth_uid');
          setShowAuthModal(true);
        }
      })
      .catch(() => {
        // Fallback offline registered user or guest user if server is disconnected
        const localAccounts = JSON.parse(localStorage.getItem('nik_local_accounts') || '{}');
        const foundLocalObj = Object.values(localAccounts).find((acc: any) => acc.profile?.uid === savedUid) as any;
        
        if (foundLocalObj && foundLocalObj.profile) {
          setCurrentUser(foundLocalObj.profile);
          setLocalPoin(foundLocalObj.profile.poin);
          setLocalXp(foundLocalObj.profile.xp);
          triggerToast(`Selamat datang kembali di mode Mandiri, ${foundLocalObj.profile.displayName}!`);
        } else {
          const guest = localStorage.getItem('nik_guest_profile');
          if (guest) {
            const parsed = JSON.parse(guest);
            setCurrentUser(parsed);
            setLocalPoin(parsed.poin);
            setLocalXp(parsed.xp);
          } else {
            setShowAuthModal(true);
          }
        }
      })
      .finally(() => {
        // Mark app as initialized once authentication check concludes
        setAppInitialized(true);
      });
    } else {
      setShowAuthModal(true);
      setAppInitialized(true);
    }

  }, []);

  // Synchronization of points & XP to profile storages when offline
  useEffect(() => {
    if (!currentUser) return;
    
    // Check if points or XP did actually change from the current state to avoid loops
    if (currentUser.poin !== localPoin || currentUser.xp !== localXp) {
      const updatedUser = { ...currentUser, poin: localPoin, xp: localXp };
      setCurrentUser(updatedUser);
      
      // Save to guest profile just as fallback
      localStorage.setItem('nik_guest_profile', JSON.stringify(updatedUser));
      
      // Save to local registered accounts if it is a local registered account
      const userAccounts = JSON.parse(localStorage.getItem('nik_local_accounts') || '{}');
      let foundEmailKey = null;
      for (const email of Object.keys(userAccounts)) {
        if (userAccounts[email].profile?.uid === currentUser.uid) {
          foundEmailKey = email;
          break;
        }
      }
      
      if (foundEmailKey) {
        userAccounts[foundEmailKey].profile = updatedUser;
        localStorage.setItem('nik_local_accounts', JSON.stringify(userAccounts));
      }
    }
  }, [localPoin, localXp, currentUser]);

  // Theme-reactive background floating kanji/emojis generator
  useEffect(() => {
    const kanjis = [
      '語','字','学','日','本','習','練','書','読','知','漢','仮','名','文','法',
      ...(themeDetails[currentTheme]?.floatingChars || ['🌸', '💮', '🍁'])
    ];
    const interval = setInterval(() => {
      setFloatingIcons(prev => {
        const id = Date.now() + Math.random();
        const char = kanjis[Math.floor(Math.random() * kanjis.length)];
        const left = Math.random() * 95;
        const size = Math.floor(Math.random() * 28) + 14;
        const duration = Math.random() * 9 + 13;
        return [...prev.slice(-25), { id, char, left, size, duration }];
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [currentTheme]);

  // Sync canvas drawing brush automatically
  useEffect(() => {
    if (activeTab === 'kamus') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#ffffff';
        }
      }
    }
  }, [activeTab]);

  // Auto-pronounce sentence on JLPT question transitions
  useEffect(() => {
    if (jlptActive && jlptQuestions[jlptIndex]) {
      playAudio(jlptQuestions[jlptIndex].sentence);
    }
  }, [jlptIndex, jlptActive, jlptQuestions]);

  // Handle active question updates
  useEffect(() => {
    if (quizPool.length > 0 && quizIndex < quizPool.length) {
      setFlashcardFlipped(false);
      setEssayInput('');
      setEssayStatus(null);
      setSelectedOption(null);
      setOptionStates({});
      setIsAnswerLocked(false);

      const correctAns = quizPool[quizIndex];
      if (autoSound) {
        playAudio(correctAns.char);
      }

      // Generate options for Multiple Choice (MC4) / Terbalik modes
      if (quizMode === 'mc4' || quizMode === 'terbalik') {
        const list = [correctAns];
        const allItems = kanaData[levelFilter] || [];
        while (list.length < Math.min(4, allItems.length)) {
          const rand = allItems[Math.floor(Math.random() * allItems.length)];
          if (!list.some(x => x.char === rand.char)) {
            list.push(rand);
          }
        }
        // Shuffle
        setCurrentOptions(list.sort(() => Math.random() - 0.5));
      }
    }
  }, [quizIndex, quizPool, quizMode, levelFilter]);

  // Ujian JLPT Core Engine
  const runJlptExam = (lvl: string) => {
    setJlptLevel(lvl);
    
    // Choose unique words from this level
    const allWords = kanaData[lvl] || [];
    if (allWords.length === 0) {
      triggerToast('Gagal memuat bank soal untuk level ini.', 'error');
      return;
    }

    // Set official JLPT vocabulary section question counts: N5 (25), N4 (25), N3 (30), N2 (30), N1 (30)
    const officialCount = lvl === 'n5' ? 25 : lvl === 'n4' ? 25 : lvl === 'n3' ? 30 : lvl === 'n2' ? 30 : 30;
    const actualLength = Math.min(officialCount, allWords.length);

    // Shuffle and pick words matching original layout proportion
    const pickedWords = [...allWords].sort(() => Math.random() - 0.5).slice(0, actualLength);
    
    // Create detailed JLPT exam questions
    const examQuestions = pickedWords.map((item) => {
      const sentenceObj = generateSentenceForItem(item, lvl);
      
      // Generate incorrect options from translations of other words in the same level
      const otherWords = allWords.filter(w => w.char !== item.char);
      const shuffledOthers = otherWords.sort(() => Math.random() - 0.5);
      const incorrectTranslations: string[] = [];
      
      for (let i = 0; i < shuffledOthers.length; i++) {
        if (incorrectTranslations.length >= 3) break;
        const otherSentence = generateSentenceForItem(shuffledOthers[i], lvl);
        if (otherSentence.id !== sentenceObj.id && !incorrectTranslations.includes(otherSentence.id)) {
          incorrectTranslations.push(otherSentence.id);
        }
      }

      // Safe fallback
      while (incorrectTranslations.length < 3) {
        incorrectTranslations.push(`Mempelajari lebih dalam makna kalimat kuis kata ${item.char} dalam bahasa Jepang.`);
      }

      // Shuffle options
      const options = [sentenceObj.id, ...incorrectTranslations].sort(() => Math.random() - 0.5);

      return {
        item,
        sentence: sentenceObj.jp,
        romaji: sentenceObj.rom,
        correctAnswer: sentenceObj.id,
        options,
        userAnswer: '',
        explanation: `Kalimat ini menguji pemahaman kosakata kanji 「${item.char}」 (${item.ro}) yang berarti "${item.mean}". Kalimat lengkapnya: "${sentenceObj.jp}" dibaca "${sentenceObj.rom}" yang diterjemahkan menjadi "${sentenceObj.id}".`
      };
    });

    setJlptQuestions(examQuestions);
    setJlptIndex(0);
    // Timing in seconds matching physical official JLPT durations: N5 (60 mins), N4 (80 mins), N3 (100 mins), N2 (105 mins), N1 (110 mins)
    const mockMins = lvl === 'n5' ? 60 : lvl === 'n4' ? 80 : lvl === 'n3' ? 100 : lvl === 'n2' ? 105 : 110;
    setJlptTimeLeft(mockMins * 60);
    setJlptActive(true);
    setShowJlptModal(false);

    // Try request fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.log('Fullscreen failed or blocked inside iframe, continuing with DOM fullscreen overlay');
    }

    // Play welcome sound and toast
    playAudio(`JLPT ${lvl.toUpperCase()} simulasi ujian dimulai.`);
    triggerToast(`Ujian simulasi JLPT ${lvl.toUpperCase()} dimulai!`);
  };

  const cancelJlptExam = () => {
    setJlptActive(false);
    setJlptTimeLeft(0);
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch(e) {}
    triggerToast('Kamu meninggalkan sesi ujian JLPT.', 'error');
  };

  const finishJlptExam = () => {
    let correctCount = 0;
    jlptQuestions.forEach(q => {
      if (q.userAnswer === q.correctAnswer) {
        correctCount++;
      }
    });

    const scorePct = Math.round((correctCount / jlptQuestions.length) * 100);
    
    // Rewards berdasarkan level ujian JLPT
    const lvlKey = (jlptLevel || 'n5').toLowerCase();
    const levelRates: Record<string, { xp: number; poin: number; trap: number }> = {
      hiragana: { xp: 3000, poin: 1500, trap: 150 },
      katakana: { xp: 3000, poin: 1500, trap: 150 },
      n5: { xp: 6000, poin: 3000, trap: 300 },
      n4: { xp: 10000, poin: 5000, trap: 500 },
      n3: { xp: 15000, poin: 10000, trap: 1000 },
      n2: { xp: 25000, poin: 20000, trap: 2000 },
      n1: { xp: 50000, poin: 40000, trap: 4000 }
    };
    const rates = levelRates[lvlKey] || { xp: 6000, poin: 3000, trap: 300 };

    const wrongCount = jlptQuestions.length - correctCount;
    const earnedXp = correctCount * rates.xp;
    const totalGainedPoin = correctCount * rates.poin;
    const totalPenaltyPoin = wrongCount * (rates.trap * 2);
    const earnedPoin = Math.max(0, totalGainedPoin - totalPenaltyPoin);

    const nextPoin = localPoin + earnedPoin;
    const nextXp = localXp + earnedXp;

    setLocalPoin(nextPoin);
    setLocalXp(nextXp);

    if (currentUser) {
      const updatedUser = { ...currentUser, poin: nextPoin, xp: nextXp };
      setCurrentUser(updatedUser);
      localStorage.setItem('nik_guest_profile', JSON.stringify(updatedUser));

      fetch(API_BASE + '/api/score/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          poin: nextPoin,
          xp: nextXp
        })
      }).catch(e => console.error("Score sync failed", e));
    }

    // Create history entry
    const historyEntry = {
      id: 'JLPT-' + Date.now(),
      level: jlptLevel.toUpperCase(),
      date: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      score: correctCount,
      total: jlptQuestions.length,
      percent: scorePct,
      pointsEarned: earnedPoin,
      xpEarned: earnedXp,
      questions: jlptQuestions.map(q => ({
        char: q.item.char,
        romaji: q.item.ro,
        mean: q.item.mean,
        sentence: q.sentence,
        sentenceRomaji: q.romaji,
        correctAnswer: q.correctAnswer,
        userAnswer: q.userAnswer,
        isCorrect: q.userAnswer === q.correctAnswer,
        explanation: q.explanation
      }))
    };

    setJlptExamHistory(prev => [historyEntry, ...prev]);
    updateDailyQuestProgress('jlpt_exam', 1);

    // Cleanup exam states
    setJlptActive(false);
    setJlptTimeLeft(0);
    setShowJlptConfirmModal1(false);
    setShowJlptConfirmModal2(false);
    setJlptCheckedConfirm(false);

    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch(e) {}

    triggerToast(`Selamat! Ujian Selesai. Skor: ${correctCount}/${jlptQuestions.length} (${scorePct}%)`);
    setActiveTab('riwayat');
    confetti();
  };

  // Sensei Chat Scroll Down Handler
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [senseiChat]);

  // JLPT timer countdown handler
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jlptActive && jlptTimeLeft > 0) {
      interval = setInterval(() => {
        setJlptTimeLeft(prev => {
          if (prev <= 1) {
            setJlptActive(false);
            triggerToast('Waktu Ujian JLPT telah habis!', 'error');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [jlptActive, jlptTimeLeft]);

  // Tab focus detection for JLPT cheating penalty
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && jlptActive && currentUser) {
        // Leave screen penalty (500 points)
        const penalti = 500;
        const nextPoin = Math.max(0, localPoin - penalti);
        setLocalPoin(nextPoin);
        triggerToast(`Kamu terdeteksi meninggalkan layar ujian! Penalti -${penalti} Poin!`, 'error');
        
        // Sync score with backend
        fetch(API_BASE + '/api/score/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: currentUser.uid, poin: nextPoin, xp: localXp })
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [jlptActive, currentUser, localPoin, localXp]);

  // Calculate Levels dynamically
  const getXPNeededForLevel = (lvl: number): number => {
    if (lvl <= 1) return 0;
    if (lvl <= 50000) {
      return 50 * lvl * (lvl - 1);
    } else {
      return 500 * lvl * (lvl - 1) - 1124977500000;
    }
  };

  const getLevelInfo = (xp: number) => {
    let level = 1;
    if (xp < 124997500000) {
      level = Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
    } else {
      level = Math.floor((1 + Math.sqrt(1 + (1124977500000 + xp) / 125)) / 2);
    }
    if (level < 1) level = 1;
    
    const currentLevelXp = getXPNeededForLevel(level);
    const nextLevelXp = getXPNeededForLevel(level + 1);
    
    const neededToNext = nextLevelXp - currentLevelXp;
    const progressToNext = xp - currentLevelXp;
    
    let rank = 'Pemula';
    if (level >= 51) rank = 'Kami-sama ⛩️';
    else if (level >= 31) rank = 'Sensei 🎓';
    else if (level >= 16) rank = 'Ksatria ⚔️';
    else if (level >= 6) rank = 'Prajurit 🥋';
    
    return { level, progressToNext, neededToNext, rank };
  };

  const levelDetails = getLevelInfo(localXp);


  const handleGoogleLoginResponse = (response: any) => {
    const credential = response.credential;
    const profile = decodeJwt(credential);
    if (profile) {
      const name = profile.name;
      const email = profile.email;
      const avatar = profile.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`;

      fetch(API_BASE + '/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName: name, avatar })
      })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'success') {
          setCurrentUser(res.data);
          localStorage.setItem('nik_auth_uid', res.data.uid);
          setLocalPoin(res.data.poin);
          setLocalXp(res.data.xp);
          setShowAuthModal(false);
          triggerToast(`Berhasil masuk sebagai ${res.data.displayName}!`, 'success');
          checkTermsAcceptance(res.data);
        } else {
          triggerToast(res.message || 'Gagal masuk dengan Google.', 'error');
        }
      })
      .catch(err => {
        console.error(err);
        triggerToast('Gagal terhubung ke server.', 'error');
      });
    } else {
      triggerToast('Autentikasi Google tidak valid.', 'error');
    }
  };

  // Expose Google Callback globally to window for Google GIS SDK binding
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).handleGoogleLoginResponse = handleGoogleLoginResponse;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).handleGoogleLoginResponse;
      }
    };
  }, [handleGoogleLoginResponse]);

  // Capture Google OAuth redirect token on client boot (web browser callback flow)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    let accessToken = '';
    
    if (hash.includes('access_token=')) {
      const match = hash.match(/access_token=([^&]+)/);
      if (match) accessToken = match[1];
    } else if (search.includes('access_token=')) {
      const match = search.match(/access_token=([^&]+)/);
      if (match) accessToken = match[1];
    }
    
    let state = '';
    const stateMatch = hash.match(/state=([^&]+)/) || search.match(/state=([^&]+)/);
    if (stateMatch) {
      state = decodeURIComponent(stateMatch[1]);
    }
    
    if (accessToken) {
      console.log('🔑 Intercepted Google OAuth access_token! Fetching profile...');
      triggerToast('Memproses masuk dengan Google...', 'success');
      
      fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`)
        .then(r => {
          if (!r.ok) throw new Error('Gagal mengambil data profil Google.');
          return r.json();
        })
        .then(profile => {
          if (profile && profile.email) {
            const name = profile.name || profile.given_name || 'User Google';
            const email = profile.email;
            const avatar = profile.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`;
            
            return fetch(API_BASE + '/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, displayName: name, avatar })
            });
          } else {
            throw new Error('Data profil tidak lengkap.');
          }
        })
        .then(r => {
          if (!r) return;
          return r.json();
        })
        .then(res => {
          if (res && res.status === 'success') {
            if (state && state.startsWith('apk|')) {
              const targetOrigin = state.split('|')[1] || 'http://localhost';
              console.log('Redirecting remote WebView back to local APK origin:', targetOrigin);
              window.location.href = `${targetOrigin}/?auth_callback_uid=${res.data.uid}`;
              return;
            }
            
            setCurrentUser(res.data);
            localStorage.setItem('nik_auth_uid', res.data.uid);
            setLocalPoin(res.data.poin);
            setLocalXp(res.data.xp);
            setShowAuthModal(false);
            triggerToast(`Selamat datang kembali, ${res.data.displayName}!`, 'success');
            
            window.location.hash = '';
            if (window.history.pushState) {
              window.history.pushState('', document.title, window.location.pathname);
            }
          } else if (res) {
            triggerToast(res.message || 'Gagal sinkronisasi akun Google.', 'error');
          }
        })
        .catch(err => {
          console.error('[Google OAuth Interceptor Error]:', err);
          triggerToast('Gagal memproses autentikasi Google.', 'error');
        });
    }
  }, []);

  // Capture local APK Google OAuth callback (when redirected from remote web back to local origin)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search || '';
    if (search.includes('auth_callback_uid=')) {
      const match = search.match(/auth_callback_uid=([^&]+)/);
      if (match) {
        const uid = match[1];
        console.log('🔑 Intercepted local APK auth_callback_uid:', uid);
        triggerToast('Menghubungkan akun Google...', 'success');
        
        // Save to local storage
        localStorage.setItem('nik_auth_uid', uid);
        
        // Fetch full profile from the server to log the user in
        fetch(API_BASE + '/api/auth/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid })
        })
        .then(r => r.json())
        .then(res => {
          if (res && res.status === 'success') {
            setCurrentUser(res.data);
            setLocalPoin(res.data.poin);
            setLocalXp(res.data.xp);
            setShowAuthModal(false);
            triggerToast(`Selamat datang kembali, ${res.data.displayName}!`, 'success');
            checkTermsAcceptance(res.data);
            
            // Clean up the URL parameters so it doesn't log in again on refresh/reload
            if (window.history.pushState) {
              window.history.pushState('', document.title, window.location.pathname);
            }
          } else {
            triggerToast(res.message || 'Gagal masuk dengan Google.', 'error');
          }
        })
        .catch(err => {
          console.error('[APK Google Callback Error]:', err);
          triggerToast('Gagal memproses autentikasi Google.', 'error');
        })
        .finally(() => {
          setAppInitialized(true);
        });
      } else {
        setAppInitialized(true);
      }
    }
  }, []);

  // Redirect to Google OAuth if path is /auth/google/login (secure HTTPS bridge page for APK Google login)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path === '/auth/google/login') {
      const search = window.location.search || '';
      const match = search.match(/origin=([^&]+)/);
      const appOrigin = match ? decodeURIComponent(match[1]) : 'http://localhost';
      
      const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '843035088451-irpb18dkkosr3bm0rilffh20r1shhmq9.apps.googleusercontent.com';
      const redirectUri = 'https://kuislatihanbahasajepang.web.id/auth/google/callback';
      const scope = 'openid email profile';
      const state = `apk|${appOrigin}`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=select_account&state=${encodeURIComponent(state)}`;
      
      console.log('🔗 Remote Bridge: Initiating secure Google OAuth from HTTPS origin:', authUrl);
      window.location.href = authUrl;
    }
  }, []);

  // Responsive Google Login handler - native Google Account Picker on APK, official OAuth popup on web
  const handleResponsiveGoogleLogin = async () => {
    if (isNativeAPK) {
      // In native APK: Use @capawesome/capacitor-google-sign-in which leverages
      // the Android Credential Manager API to show the official native Google
      // account picker sheet. No WebView, no email/password input needed!
      try {
        console.log('Initiating native Google Sign-in via Credential Manager...');
        triggerToast('Membuka pilihan akun Google...', 'success');
        
        // @ts-ignore
        const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
        
        // Initialize with Web Client ID (MUST be Web type, NOT Android type!)
        await GoogleSignIn.initialize({
          clientId: '843035088451-irpb18dkkosr3bm0rilffh20r1shhmq9.apps.googleusercontent.com',
          scopes: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
        });
        
        // This triggers the native Android account picker popup!
        const result = await GoogleSignIn.signIn();
        console.log('Native Google Login result:', JSON.stringify(result));
        
        if (result) {
          // Extract user info - try Capawesome result.user first, then direct root fields,
          // then fallback to decoding idToken JWT
          let email = (result as any).user?.email || (result as any).email || '';
          let name = (result as any).user?.displayName || (result as any).user?.givenName || (result as any).displayName || (result as any).givenName || '';
          let avatar = (result as any).user?.imageUrl || (result as any).imageUrl || (result as any).photoUrl || '';
          
          // If direct fields are empty, try decoding the idToken JWT
          if ((!email || !name) && result.idToken) {
            console.log('Decoding idToken JWT for user info...');
            const decoded = decodeJwt(result.idToken);
            console.log('Decoded JWT:', JSON.stringify(decoded));
            if (decoded) {
              if (!email) email = decoded.email || '';
              if (!name) name = decoded.name || decoded.given_name || '';
              if (!avatar) avatar = decoded.picture || '';
            }
          }
          
          console.log('Extracted user info:', { email, name, avatar: avatar ? 'has avatar' : 'no avatar' });
          
          if (!email) {
            triggerToast('Tidak bisa mendapatkan email dari akun Google. Coba lagi.', 'error');
            return;
          }
          
          if (!name) name = email.split('@')[0];
          if (!avatar) avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ec4899&color=fff`;
          
          triggerToast('Menghubungkan akun Google...', 'success');
          
          fetch(API_BASE + '/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, displayName: name, avatar })
          })
          .then(r => r.json())
          .then(res => {
            console.log('Server auth response:', JSON.stringify(res));
            if (res && res.status === 'success') {
              setCurrentUser(res.data);
              localStorage.setItem('nik_auth_uid', res.data.uid);
              setLocalPoin(res.data.poin);
              setLocalXp(res.data.xp);
              setShowAuthModal(false);
              triggerToast(`Berhasil masuk sebagai ${res.data.displayName}!`, 'success');
              checkTermsAcceptance(res.data);
            } else {
              triggerToast(res.message || 'Gagal masuk dengan Google.', 'error');
            }
          })
          .catch(err => {
            console.error('[Native Google Sign-In Server Sync Error]:', err);
            triggerToast('Gagal sinkronisasi data akun Google.', 'error');
          });
        } else {
          console.warn('Google SignIn returned null/empty result');
          triggerToast('Tidak ada data dari akun Google. Coba lagi.', 'error');
        }
      } catch (err: any) {
        console.error('[Native Google Sign-In Error]:', err);
        const errMsg = String(err?.message || err || '').toLowerCase();
        if (errMsg.includes('cancel') || errMsg.includes('dismissed') || errMsg.includes('closed')) {
          triggerToast('Masuk dengan Google dibatalkan.', 'error');
          return;
        }
        
        // If native sign-in fails (e.g. Google Play Services not available or SHA-1 mismatch), fall back to custom account selector sheet
        console.log('Native Credential Manager failed, showing custom Google Account selector sheet...');
        triggerToast('Membuka pilihan akun alternatif...', 'success');
        setShowGoogleAPKSheet(true);
      }
      return;
    }
    
    // Try native GIS SDK first (works on web browser)
    if ((window as any).google && (window as any).google.accounts) {
      try {
        (window as any).google.accounts.id.prompt((notification: any) => {
          console.log('Google One Tap prompt result:', notification);
          if (notification.isNotDisplayed && notification.isNotDisplayed()) {
            console.warn('Google One Tap blocked, reason:', notification.getNotDisplayedReason());
            openGoogleOAuthPopup();
          }
        });
        return;
      } catch (e) {
        console.warn('Google GIS SDK prompt failed:', e);
      }
    }
    openGoogleOAuthPopup();
  };

  const openGoogleOAuthPopup = () => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '843035088451-irpb18dkkosr3bm0rilffh20r1shhmq9.apps.googleusercontent.com';
    const redirectUri = isNativeAPK
      ? 'https://kuislatihanbahasajepang.web.id/auth/google/callback'
      : `${window.location.origin}/auth/google/callback`;
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=select_account`;
    
    if (isNativeAPK) {
      // On APK, open in system browser
      window.open(authUrl, '_system');
    } else {
      // On web, open a centered popup
      const w = 500, h = 600;
      const left = (screen.width - w) / 2;
      const top = (screen.height - h) / 2;
      window.open(authUrl, 'GoogleLogin', `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`);
    }
  };

  // Initialize Google OAuth & One Tap (auto-prompt account chooser)
  const triggerGoogleAuth = (showPrompt = false) => {
    const initGoogleSDK = () => {
      if ((window as any).google && (window as any).google.accounts) {
        try {
          console.log('🔑 Initializing Google Identity Services SDK...');
          (window as any).google.accounts.id.initialize({
            client_id: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '843035088451-irpb18dkkosr3bm0rilffh20r1shhmq9.apps.googleusercontent.com',
            callback: handleGoogleLoginResponse,
            auto_select: false,
            cancel_on_tap_outside: false
          });

          // Trigger One Tap prompt (native pop-up on mobile/PWA/TWA)
          if (showPrompt) {
            console.log('📱 Triggering Google One Tap account chooser popup...');
            (window as any).google.accounts.id.prompt((notification: any) => {
              console.log('Google One Tap status:', notification);
              if (notification.isNotDisplayed()) {
                console.warn('Google One Tap not displayed:', notification.getNotDisplayedReason());
              }
              if (notification.isSkippedMoment()) {
                console.warn('Google One Tap skipped:', notification.getSkippedReason());
              }
            });
          }
        } catch (e) {
          console.error('Google Sign-in initialization error:', e);
        }
      } else {
        console.error('❌ Google GIS SDK was not found on window object.');
      }
    };

    if ((window as any).google && (window as any).google.accounts) {
      initGoogleSDK();
    } else {
      console.log('⏳ Google GIS SDK not ready yet, polling...');
      // Poll if script is not fully loaded yet (from index.html preloading)
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if ((window as any).google && (window as any).google.accounts) {
          clearInterval(interval);
          console.log('🚀 Google GIS SDK is loaded!');
          initGoogleSDK();
        } else if (attempts > 100) { // Poll for up to 10 seconds
          clearInterval(interval);
          console.error('❌ Google GIS SDK failed to load after 10 seconds.');
        }
      }, 100);
    }
  };

  // Trigger programmatic Google sign-in setup on modal show
  useEffect(() => {
    if (showAuthModal) {
      triggerGoogleAuth(false); // Don't auto-prompt, let user click
    }
  }, [showAuthModal]);

  // Handle Cloudflare Turnstile: direct rendering on web, auto-bypass on native APK  
  useEffect(() => {
    if (!showAuthModal) return;
    
    // Native APK: auto-bypass (set above in the isNativeAPK effect)
    if (isNativeAPK) return;

    // Web: render Turnstile widget directly
    setTurnstileToken(null);
    let attempts = 0;
    
    const renderWidget = () => {
      const containerId = authMode === 'login' ? 'cf-turnstile-widget-login' : 'cf-turnstile-widget-register';
      const element = document.getElementById(containerId);
      if (element && (window as any).turnstile) {
        element.innerHTML = '';
        try {
          const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAADQ9eRCCxyqsHsW_';
          (window as any).turnstile.render(`#${containerId}`, {
            sitekey: siteKey,
            theme: 'dark',
            callback: (token: string) => {
              console.log('✅ Turnstile token received directly:', token.substring(0, 20) + '...');
              setTurnstileToken(token);
            },
            'expired-callback': () => {
              setTurnstileToken(null);
            },
            'error-callback': () => {
              setTurnstileToken(null);
            }
          });
          return true;
        } catch (e) {
          console.error('Turnstile render error:', e);
          return false;
        }
      }
      return false;
    };

    const runRender = () => {
      const success = renderWidget();
      if (!success && attempts < 40) {
        attempts++;
        setTimeout(runRender, 200);
      }
    };

    // Small delay to let React paint the DOM container first
    setTimeout(runRender, 300);
  }, [showAuthModal, authMode, isNativeAPK]);

  const requestRegistrationOtp = async () => {
    if (!authEmail || !authUsername || !authPassword) {
      triggerToast('Tolong isi semua bidang formulir pendaftaran.', 'error');
      return;
    }
    if (authPassword !== authConfPassword) {
      triggerToast('Konfirmasi password tidak cocok!', 'error');
      return;
    }
    if (!turnstileToken) {
      triggerToast('Harap selesaikan verifikasi Cloudflare Turnstile!', 'error');
      return;
    }


    setRequestingOtp(true);
    try {
      const res = await fetch(API_BASE + '/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, username: authUsername, turnstileToken })
      });
      
      if (!res.ok) {
        throw new Error('Static/offline mode');
      }
      
      const d = await res.json();
      setRequestingOtp(false);
      
      if (d.status === 'success') {
        setOtpStep(true);
        if (d.isMock && d.debugOtp) {
          setSentOtpDebug(d.debugOtp);
          triggerToast('Sesi Demo: OTP bypass berhasil dibuat!', 'success');
        } else {
          setSentOtpDebug(null);
          triggerToast('Kode OTP berhasil dikirim ke Gmail Anda!', 'success');
        }
      } else {
        triggerToast(d.message || 'Gagal mengirim kode OTP.', 'error');
      }
    } catch (err) {
      setRequestingOtp(false);
      // OFFLINE / STATIC HOSTING FALLBACK
      // Generate a client-side OTP code bypass instantly
      const offlineOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setSentOtpDebug(offlineOtp);
      setOtpStep(true);
      triggerToast('Mode Website Tanpa Server Aktif! Gunakan kode OTP bypass di bawah untuk mendaftar.', 'success');
    }
  };

  const handleRegisterDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authUsername || !authPassword) {
      triggerToast('Tolong isi semua bidang formulir pendaftaran.', 'error');
      return;
    }
    if (authPassword !== authConfPassword) {
      triggerToast('Konfirmasi password tidak cocok!', 'error');
      return;
    }

    try {
      const res = await fetch(API_BASE + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          username: authUsername,
          password: authPassword,
          displayName: authUsername
        })
      });
      
      if (!res.ok) {
        throw new Error('Static/offline mode');
      }
      
      const d = await res.json();
      if (d.status === 'success') {
        setCurrentUser(d.data);
        localStorage.setItem('nik_auth_uid', d.data.uid);
        setLocalPoin(d.data.poin);
        setLocalXp(d.data.xp);
        setShowAuthModal(false);
        triggerToast('Akun Anda berhasil didaftarkan! Selamat belajar!', 'success');
      } else {
        triggerToast(d.message || 'Pendaftaran gagal.', 'error');
      }
    } catch (err) {
      // OFFLINE / STATIC HOSTING FALLBACK
      const localAccounts = JSON.parse(localStorage.getItem('nik_local_accounts') || '{}');
      if (localAccounts[authEmail]) {
        triggerToast('Email ini sudah pernah didaftarkan. Silakan login langsung!', 'error');
        return;
      }

      // Generate local offline profile
      const newLocalProfile: UserProfile = {
        uid: 'usr_local_' + Date.now(),
        email: authEmail,
        username: authUsername,
        displayName: authUsername,
        poin: 100, // Starter bonus poin!
        xp: 200,   // Starter bonus xp!
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(authUsername)}&background=7c3aed&color=fff`,
        deskripsi: 'Pelajar Mandiri Bahasa Jepang',
        ttl: ''
      };

      // Save user to local accounts registry
      localAccounts[authEmail] = {
        password: authPassword,
        profile: newLocalProfile
      };
      localStorage.setItem('nik_local_accounts', JSON.stringify(localAccounts));

      // Set user session in browser
      setCurrentUser(newLocalProfile);
      localStorage.setItem('nik_auth_uid', newLocalProfile.uid);
      setLocalPoin(newLocalProfile.poin);
      setLocalXp(newLocalProfile.xp);
      setShowAuthModal(false);
      triggerToast('Pendaftaran Berhasil secara Lokal! Progres belajar Anda akan disimpan di browser ini.', 'success');
    }
  };

  // Authentication Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'register') {
      await handleRegisterDirect(e);
    } else {
      if (!turnstileToken) {
        triggerToast('Harap selesaikan verifikasi Cloudflare Turnstile!', 'error');
        return;
      }

      if (!authEmail || !authPassword) {
        triggerToast('Silakan isi email dan password.', 'error');
        return;
      }

      try {
        const res = await fetch(API_BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, password: authPassword, turnstileToken })
        });
        
        if (!res.ok) {
          throw new Error('Static/offline mode');
        }
        
        const d = await res.json();
        if (d.status === 'success') {
          setCurrentUser(d.data);
          localStorage.setItem('nik_auth_uid', d.data.uid);
          setLocalPoin(d.data.poin);
          setLocalXp(d.data.xp);
          setShowAuthModal(false);
          triggerToast(`Berhasil masuk! Selamat datang, ${d.data.displayName}.`);
        } else {
          triggerToast(d.message || 'Email atau password salah.', 'error');
        }
      } catch (err) {
        // OFFLINE / STATIC HOSTING FALLBACK LOGIN
        const localAccounts = JSON.parse(localStorage.getItem('nik_local_accounts') || '{}');
        const matchedAccount = localAccounts[authEmail];
        
        if (matchedAccount && matchedAccount.password === authPassword) {
          const userProf = matchedAccount.profile;
          setCurrentUser(userProf);
          localStorage.setItem('nik_auth_uid', userProf.uid);
          setLocalPoin(userProf.poin);
          setLocalXp(userProf.xp);
          setShowAuthModal(false);
          triggerToast(`Berhasil Masuk secara Offline! Selamat datang kembali, ${userProf.displayName}.`, 'success');
        } else {
          triggerToast('Email atau password salah, atau belum terdaftar secara lokal.', 'error');
        }
      }
    }
  };

  const handleGuestEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      triggerToast('Ketik nama panggilanmu terlebih dahulu!', 'error');
      return;
    }

    const mockProfile: UserProfile = {
      uid: 'GUEST-' + Math.floor(1000 + Math.random() * 9000),
      username: guestName.toLowerCase().replace(/\s+/g, ''),
      displayName: guestName,
      email: 'guest@nihongomaster.local',
      avatar: '',
      poin: 0,
      xp: 0
    };

    setCurrentUser(mockProfile);
    localStorage.setItem('nik_auth_uid', mockProfile.uid);
    localStorage.setItem('nik_guest_profile', JSON.stringify(mockProfile));
    setLocalPoin(0);
    setLocalXp(0);
    setShowAuthModal(false);
    triggerToast(`Selamat belajar di mode Tamu Offline, ${mockProfile.displayName}!`);
  };


  const logoutUser = () => {
    localStorage.removeItem('nik_auth_uid');
    localStorage.removeItem('nik_guest_profile');
    localStorage.removeItem('nik_terms_accepted'); // Hapus persetujuan terms saat keluar sesi
    setCurrentUser(null);
    setLocalPoin(0);
    setLocalXp(0);
    setShowAuthModal(true);
    triggerToast('Kamu telah keluar dari akun.');
  };

  const handleDeleteAccountDirectly = async () => {
    if (!currentUser) return;
    
    try {
      const res = await fetch(API_BASE + '/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid })
      });
      
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status === 'success') {
        console.log('Account successfully purged from server:', d.message);
      } else {
        console.warn('Backend delete failed or offline.');
      }
    } catch (err) {
      console.warn('Network error during account deletion:', err);
    }
    
    // Purge local storage
    const localAccounts = JSON.parse(localStorage.getItem('nik_local_accounts') || '{}');
    if (currentUser.email) {
      delete localAccounts[currentUser.email];
      localStorage.setItem('nik_local_accounts', JSON.stringify(localAccounts));
    }
    
    localStorage.removeItem('nik_auth_uid');
    localStorage.removeItem('nik_guest_profile');
    localStorage.removeItem('nik_terms_accepted'); // Hapus persetujuan terms saat hapus akun
    setCurrentUser(null);
    setLocalPoin(0);
    setLocalXp(0);
    setShowDeleteAccountModal(false);
    setDeleteConfirmChecked(false);
    setShowAuthModal(true);
    triggerToast('Akun Anda telah dihapus secara permanen dari server & HP.', 'success');
  };

  // Profile Update Handler
  const saveProfileSettings = async () => {
    if (!currentUser) return;
    const name = editDisplayName.trim() || currentUser.displayName;
    const user = editUsername.trim() || currentUser.username;
    const ava = editAvatarBase64 || currentUser.avatar;
    const desc = editDeskripsi.trim();
    const dob = editTtl.trim();

    try {
      const res = await fetch(API_BASE + '/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          displayName: name,
          username: user,
          avatar: ava,
          deskripsi: desc,
          ttl: dob,
          profileBackground: customBgUrl || selectedBgPreset
        })
      });
      const d = await res.json();
      if (d.status === 'success') {
        setCurrentUser(d.data);
        setShowEditProfileModal(false);
        triggerToast('Profil Kamu berhasil diperbarui!');
        if (currentUser.uid.startsWith('GUEST')) {
          localStorage.setItem('nik_guest_profile', JSON.stringify(d.data));
        }
      } else {
        triggerToast(d.message || 'Gagal mengubah profil', 'error');
      }
    } catch (err) {
      // Offline edit for Guests
      const updated = { 
        ...currentUser, 
        displayName: name, 
        username: user, 
        avatar: ava,
        deskripsi: desc,
        ttl: dob,
        profileBackground: customBgUrl || selectedBgPreset
      };
      setCurrentUser(updated);
      localStorage.setItem('nik_guest_profile', JSON.stringify(updated));
      setShowEditProfileModal(false);
      triggerToast('Profil offline diperbarui!');
    }
  };

  // Convert custom uploaded items to base64 preview
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setEditAvatarBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert custom uploaded background (image or video) to base64 preview
  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (!isVideo && !isImage) {
        triggerToast('Hanya mendukung format gambar atau video!', 'error');
        return;
      }

      // Check file size (recommend limit under 8MB to prevent local db issues)
      if (file.size > 8 * 1024 * 1024) {
        triggerToast('Ukuran file terlalu besar! Disarankan kurang dari 8MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setCustomBgUrl(reader.result as string);
        triggerToast(isVideo ? 'Video latar belakang berhasil dimuat!' : 'Gambar latar belakang berhasil dimuat!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Quiz Engine Logic
  const initQuizSession = (levelKey: string = levelFilter, modeKey: QuizMode = quizMode) => {
    setLevelFilter(levelKey);
    setQuizMode(modeKey);
    setScoreBenar(0);
    setQuizIndex(0);
    setWrongStreak(0);

    if (modeKey === 'ai') {
      triggerAiQuestion(levelKey);
      return;
    }

    const items = [...(kanaData[levelKey] || [])];
    if (items.length === 0) {
      triggerToast('Maaf, level ini belum memiliki data kosa kata!', 'error');
      return;
    }

    // Shuffled questions containing all available data as requested (if 100 then 100, if 1000 then 1000)
    const shuffled = items.sort(() => Math.random() - 0.5);
    setQuizPool(shuffled);
  };

  // Get Mnemonic tips from Sensei AI securely
  const getAiTip = async (item: KanaItem) => {
    try {
      const res = await fetch(API_BASE + '/api/gemini/tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          char: item.char,
          romaji: item.ro,
          mean: item.mean
        })
      });
      const d = await res.json();
      if (d.status === 'success') {
        setAiQuizFeedback(d.tip);
      }
    } catch {
      setAiQuizFeedback('Terus hafal bentuknya, asah matamu di menu latihan menulis!');
    }
  };

  // Handle standard option submission
  const registerAnswer = (item: KanaItem, clickedRo: string) => {
    if (isAnswerLocked) return;
    setIsAnswerLocked(true);

    const isCorrect = item.ro === clickedRo || item.char === clickedRo;
    setSelectedOption(clickedRo);

    const updateMap: Record<string, 'correct' | 'wrong' | 'neutral'> = {};
    updateMap[clickedRo] = isCorrect ? 'correct' : 'wrong';
    updateMap[item.char] = 'correct';
    updateMap[item.ro] = 'correct';
    setOptionStates(updateMap);

    processSessionScore(isCorrect, item);
  };

  const submitEssayAnswer = () => {
    if (isAnswerLocked || !quizPool[quizIndex]) return;
    const item = quizPool[quizIndex];
    setIsAnswerLocked(true);

    const ans = essayInput.trim().toLowerCase();
    const isCorrect = 
      item.ro.toLowerCase().split(',').map(s => s.trim()).includes(ans) || 
      (item.mean?.toLowerCase().split(',').map(s => s.trim()).some(m => m === ans || m.includes(ans)));

    setEssayStatus(isCorrect ? 'correct' : 'wrong');
    setEssayCorrectAns(`${item.ro.split(',')[0]} (Arti: ${item.mean || 'Dasar'})`);

    processSessionScore(isCorrect, item);
  };

  const submitFlashcardScore = (isKnown: boolean) => {
    if (isAnswerLocked || !quizPool[quizIndex]) return;
    setIsAnswerLocked(true);
    const item = quizPool[quizIndex];
    processSessionScore(isKnown, item);
  };

  const processSessionScore = (isCorrect: boolean, item: KanaItem) => {
    let gainedXP = 0;
    let gainedPoints = 0;
    let penaltyPoints = 0;

    const levelRates: Record<string, { xp: number; poin: number; trap: number }> = {
      hiragana: { xp: 3000, poin: 1500, trap: 150 },
      katakana: { xp: 3000, poin: 1500, trap: 150 },
      n5: { xp: 6000, poin: 3000, trap: 300 },
      n4: { xp: 10000, poin: 5000, trap: 500 },
      n3: { xp: 15000, poin: 10000, trap: 1000 },
      n2: { xp: 25000, poin: 20000, trap: 2000 },
      n1: { xp: 50000, poin: 40000, trap: 4000 }
    };

    const rates = levelRates[levelFilter] || { xp: 3000, poin: 1500, trap: 150 };

    if (isCorrect) {
      gainedXP = rates.xp;
      gainedPoints = rates.poin;
      setScoreBenar(prev => prev + 1);
      setStreakKuis(prev => {
        const next = prev + 1;
        updateDailyQuestProgress('score_match', next, true);
        return next;
      });
      setWrongStreak(0);
      updateDailyQuestProgress('answer_correct', 1);
      updateDailyQuestProgress('master_quest', 1);
      updateDailyQuestProgress('points_earned', rates.poin);
      confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.8 },
        colors: ['#7c3aed', '#ff6b9d', '#10b981']
      });
      triggerToast('Benar! Bagus sekali ✨', 'success');
    } else {
      penaltyPoints = rates.trap * 2;
      setStreakKuis(0);
      setWrongStreak(prev => {
        const next = prev + 1;
        if (next >= 3) {
          getAiTip(item);
        }
        return next;
      });
      triggerToast(`Kurang tepat! Kunci: ${item.ro.split(',')[0]}`, 'error');
    }

    const nextPoin = Math.max(0, localPoin + gainedPoints - penaltyPoints);
    const nextXp = localXp + gainedXP;

    setLocalPoin(nextPoin);
    setLocalXp(nextXp);

    // Save and sync score to backend
    if (currentUser) {
      fetch(API_BASE + '/api/score/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          poin: nextPoin,
          xp: nextXp
        })
      });
    }

    // Advance question after delay
    setTimeout(() => {
      setQuizIndex(prev => {
        const next = prev + 1;
        if (next === quizPool.length) {
          updateDailyQuestProgress('take_quiz', 1);
          setScoreBenar(currentScore => {
            if (currentScore === quizPool.length) {
              updateDailyQuestProgress('perfect_quiz', 1);
            }
            return currentScore;
          });
        }
        return next;
      });
    }, 2000);
  };

  // AI Quiz Engine powered by Gemini responseMimeType schema validation
  const triggerAiQuestion = async (levelName: string) => {
    setAiQuizLoading(true);
    setAiQuizAnswered(false);
    setAiQuizFeedback('');
    try {
      const res = await fetch(API_BASE + '/api/gemini/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelName })
      });
      const d = await res.json();
      if (d.status === 'success') {
        setAiQuestion(d.data);
      } else {
        triggerToast('Gagal memuat kuis AI. Mencoba kuis biasa...', 'error');
        initQuizSession(levelName, 'mc4');
      }
    } catch {
      triggerToast('Gagal memproses AI. Mencoba kuis biasa...', 'error');
      initQuizSession(levelName, 'mc4');
    } finally {
      setAiQuizLoading(false);
    }
  };

  const handleAiQuizAnswer = (selectedAns: string) => {
    if (!aiQuestion || aiQuizAnswered) return;
    setAiQuizAnswered(true);

    const isCorrect = selectedAns === aiQuestion.jawaban_benar;

    const levelRates: Record<string, { xp: number; poin: number; trap: number }> = {
      hiragana: { xp: 3000, poin: 1500, trap: 150 },
      katakana: { xp: 3000, poin: 1500, trap: 150 },
      n5: { xp: 6000, poin: 3000, trap: 300 },
      n4: { xp: 10000, poin: 5000, trap: 500 },
      n3: { xp: 15000, poin: 10000, trap: 1000 },
      n2: { xp: 25000, poin: 20000, trap: 2000 },
      n1: { xp: 50000, poin: 40000, trap: 4000 }
    };
    const activeRates = levelRates[levelFilter] || { xp: 3000, poin: 1500, trap: 150 };
    const rates = { xp: activeRates.xp, poin: activeRates.poin, penalty: activeRates.trap };

    let nextPoin = localPoin;
    let nextXp = localXp;

    if (isCorrect) {
      nextPoin += rates.poin;
      nextXp += rates.xp;
      confetti({ particleCount: 30, spread: 60 });
      triggerToast('Benar! Sempurna! 🎉');
    } else {
      nextPoin = Math.max(0, nextPoin - (rates.penalty * 2));
      triggerToast(`Kurang beruntung! Jawabannya adalah: ${aiQuestion.jawaban_benar}`, 'error');
    }

    setLocalPoin(nextPoin);
    setLocalXp(nextXp);

    if (currentUser) {
      fetch(API_BASE + '/api/score/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, poin: nextPoin, xp: nextXp })
      });
    }

    setAiQuizFeedback(aiQuestion.penjelasan || 'Semangat belajar!');
  };

  // Drawing Canvas Core Logics & Stroke Mapping helper
  const getStrokeCount = (char: string): number => {
    if (!char) return 1;
    
    // Take the first character if it's long, or strip non-kanji/non-kana
    const mainChar = char[0];
    
    // Deconstruct voiced or semi-voiced kana
    const voicedMap: Record<string, string> = {
      'g': 'k', 'z': 's', 'd': 't', 'b': 'h', 'p': 'h',
      'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
      'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
      'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
      'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
      'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ',
      'ガ': 'カ', 'ギ': 'キ', 'グ': 'ク', 'ゲ': 'ケ', 'ゴ': 'コ',
      'ザ': 'サ', 'ジ': 'シ', 'ズ': 'ス', 'ゼ': 'セ', 'ゾ': 'ソ',
      'ダ': 'タ', 'ヂ': 'チ', 'ヅ': 'ツ', 'デ': 'テ', 'ド': 'ト',
      'バ': 'ハ', 'ビ': 'ヒ', 'ブ': 'フ', 'ベ': 'ヘ', 'ボ': 'ホ',
      'パ': 'ハ', 'ピ': 'ヒ', 'プ': 'フ', 'ペ': 'ヘ', 'ポ': 'ホ',
    };
    
    let baseChar = mainChar;
    let extra = 0;
    
    if (voicedMap[mainChar]) {
      baseChar = voicedMap[mainChar];
      if ('ぱぴぷぺぽパピプペポ'.includes(mainChar)) {
        extra = 1; // Handakuten has 1 circular stroke
      } else {
        extra = 2; // Dakuten has 2 small diagonal strokes
      }
    }
    
    const hiraganaStrokes: Record<string, number> = {
      'あ': 3, 'い': 2, 'う': 2, 'え': 2, 'お': 3,
      'か': 3, 'き': 4, 'く': 1, 'け': 3, 'こ': 2,
      'さ': 3, 'し': 1, 'す': 2, 'せ': 3, 'そ': 1,
      'た': 4, 'ち': 2, 'つ': 1, 'て': 1, 'と': 2,
      'na': 4, 'な': 4, 'に': 3, 'ぬ': 2, 'ね': 2, 'の': 1,
      'は': 3, 'ひ': 1, 'ふ': 4, 'へ': 1, 'ほ': 4,
      'ま': 3, 'み': 2, 'む': 3, 'め': 2, 'も': 3,
      'ya': 3, 'や': 3, 'ゆ': 2, 'よ': 2,
      'ら': 2, 'り': 2, 'る': 1, 'れ': 2, 'ろ': 1,
      'わ': 2, 'を': 3, 'ん': 1,
      'っ': 1, 'ゃ': 3, 'ゅ': 2, 'ょ': 2,
      'ぁ': 3, 'ぃ': 2, 'ぅ': 2, 'ぇ': 2, 'ぉ': 3,
    };

    const katakanaStrokes: Record<string, number> = {
      'ア': 2, 'イ': 2, 'ウ': 3, 'エ': 3, 'オ': 3,
      'カ': 2, 'キ': 3, 'ク': 2, 'ケ': 3, 'コ': 2,
      'サ': 3, 'シ': 3, 'ス': 2, 'セ': 2, 'ソ': 2,
      'タ': 3, 'チ': 3, 'ツ': 3, 'テ': 3, 'ト': 2,
      'ナ': 2, 'ニ': 2, 'ヌ': 2, 'ネ': 4, 'ノ': 1,
      'ハ': 2, 'ヒ': 2, 'フ': 1, 'へ': 1, 'ホ': 4,
      'マ': 2, 'ミ': 3, 'ム': 2, 'メ': 2, 'モ': 3,
      'ヤ': 2, 'ユ': 2, 'ヨ': 3,
      'ラ': 2, 'リ': 2, 'ル': 2, 'レ': 1, 'ロ': 3,
      'ワ': 2, 'ヲ': 3, 'ン': 2,
      'ッ': 1, 'ャ': 2, 'ュ': 2, 'ョ': 3,
      'ィ': 2, 'ェ': 2, 'ォ': 3,
    };

    const kanjiStrokes: Record<string, number> = {
      // Numbers (一 to 十, etc.)
      '一': 1, '二': 2, '三': 3, '四': 5, '五': 4,
      '六': 4, '七': 2, '八': 2, '九': 2, '十': 2,
      '百': 6, '千': 3, '万': 3, '円': 4,
      // Days/Nature
      '日': 4, '月': 4, '火': 4, '水': 4, '木': 4, '金': 8, '土': 3,
      '年': 6, '休': 6, '上': 3, '下': 3, '左': 5, '右': 5, '中': 4,
      '大': 3, '小': 3, '本': 5, '半': 5, '分': 4, '力': 2, '何': 7,
      '明': 8, '今': 4, '行': 6, '来': 7, '帰': 10, '食': 9, '飲': 12,
      '見': 7, '聞': 14, '読': 14, '書': 10, '話': 13, '買': 12, '教': 11,
      '朝': 12, '昼': 9, '夜': 8, '晩': 12, '夕': 3, '方': 4, '午': 4,
      '前': 9, '後': 9, '毎': 6, '週': 11, '曜': 18, '作': 7, '泳': 8,
      '油': 8, '海': 9, '酒': 10, '待': 9, '校': 10, '時': 10, '言': 7,
      '計': 9, '語': 14, '飯': 12, '男': 7, '女': 3, '目': 5, '口': 3,
      '耳': 6, '手': 4, '足': 7, '体': 7, '山': 3, '川': 3, '空': 8,
      '天': 4, '雨': 8, '花': 7, '草': 9, '虫': 6, '犬': 4, '人': 2,
      '名': 6, '生': 5, '学': 8, '先': 6, '白': 5, '黒': 11, '赤': 7,
      '青': 8, '新': 13, '古': 5, '多': 6, '少': 4, '外': 5, '気': 6,
      '国': 8, '高': 10, '長': 8, '立': 5, '車': 7, '電': 13, '駅': 14,
    };

    const allStrokes = {
      ...hiraganaStrokes,
      ...katakanaStrokes,
      ...kanjiStrokes,
    };

    if (allStrokes[baseChar]) {
      return allStrokes[baseChar] + extra;
    }

    // Kanji Unicode point falling back to reasonable median (8 strokes)
    const code = baseChar.charCodeAt(0);
    if (code >= 0x4e00 && code <= 0x9faf) {
      return 8;
    }

    return 3; // basic default fallback
  };

  const clearHandwritingCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setCompletedStrokes(0);
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleCanvasStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPosRef.current = coords;
  };

  const handleCanvasDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPosRef.current = coords;
  };

  const handleCanvasEnd = () => {
    if (isDrawingRef.current) {
      setCompletedStrokes(prev => prev + 1);
    }
    isDrawingRef.current = false;
  };

  // Auto clean/reset handwriting canvas when practicing character changes
  useEffect(() => {
    clearHandwritingCanvas();
  }, [dictionaryDetailEntry, quizIndex, activeTab]);

  // Dictionary lookup Filter
  const allDictionaryEntries: (KanaItem & { type: string; level: string })[] = [];
  Object.entries(kanaData).forEach(([type, items]) => {
    items.forEach(item => {
      allDictionaryEntries.push({
        ...item,
        type,
        level: type.toUpperCase(),
      });
    });
  });

  const filteredDictionary = allDictionaryEntries.filter(entry => {
    const matchesFilter = dictionaryFilter === 'all' || entry.type === dictionaryFilter;
    const matchesSearch = 
      entry.char.toLowerCase().includes(dictionarySearch.toLowerCase()) ||
      entry.ro.toLowerCase().includes(dictionarySearch.toLowerCase()) ||
      (entry.mean && entry.mean.toLowerCase().includes(dictionarySearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Leaderboard fetchers
  const [leaderboardList, setLeaderboardList] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const fetchScoresAndLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(API_BASE + '/api/leaderboard');
      
      if (!res.ok) {
        throw new Error('Static/offline mode');
      }
      
      const d = await res.json();
      if (d.status === 'success') {
        setLeaderboardList(d.data);
      }
    } catch {
      // Offline fallback: Generate simulated competitors along with the current user's actual live points!
      const userProfileEntry = {
        uid: currentUser?.uid || 'usr_current',
        displayName: currentUser?.displayName ? `${currentUser.displayName} (Anda)` : 'Anda (Belajar)',
        username: currentUser?.username || 'anda',
        poin: localPoin,
        xp: localXp,
        avatar: currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || 'Anda')}&background=4c1d95&color=fff`
      };

      const mockCompetitors = [
        { uid: 'comp_1', displayName: 'Kenji Suzuki', username: 'kenji_nihon', poin: 1550, xp: 3200, avatar: 'https://ui-avatars.com/api/?name=Kenji+Suzuki&background=f59e0b&color=ff6b9d' },
        { uid: 'comp_2', displayName: 'Sakura Tanaka', username: 'sakura_chan', poin: 1200, xp: 2400, avatar: 'https://ui-avatars.com/api/?name=Sakura+Tanaka&background=ec4899&color=fff' },
        { uid: 'comp_3', displayName: 'Hiroshi Sato', username: 'hiro_nihongo', poin: 950, xp: 1900, avatar: 'https://ui-avatars.com/api/?name=Hiroshi+Sato&background=06b6d4&color=fff' },
        { uid: 'comp_4', displayName: 'Takashi Shiro', username: 'taka_jp', poin: 650, xp: 1300, avatar: 'https://ui-avatars.com/api/?name=Takashi+Shiro&background=8b5cf6&color=fff' },
        { uid: 'comp_5', displayName: 'Yuki Watanabe', username: 'yuki_smart', poin: 400, xp: 800, avatar: 'https://ui-avatars.com/api/?name=Yuki+Watanabe&background=10b981&color=fff' },
        { uid: 'comp_6', displayName: 'Mei Kawakami', username: 'mei_kawa', poin: 200, xp: 400, avatar: 'https://ui-avatars.com/api/?name=Mei+Kawakami&background=f43f5e&color=fff' },
      ];

      // Blend current user in, making sorting automatic based on live points
      const blendedList = [...mockCompetitors];
      const matchIndex = blendedList.findIndex(c => c.uid === userProfileEntry.uid);
      if (matchIndex !== -1) {
        blendedList[matchIndex] = userProfileEntry;
      } else {
        blendedList.push(userProfileEntry);
      }

      blendedList.sort((a, b) => b.poin - a.poin);
      setLeaderboardList(blendedList);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ranking') {
      fetchScoresAndLeaderboard();
    }
  }, [activeTab]);

  // Achievements milestones (handpicked and realistic ranges up to Level 100,000!)
  const milestones = React.useMemo(() => {
    const list: { level: number; title: string; desc: string; icon: string }[] = [];
    
    // Low level milestones
    const baseMilestones = [
      { level: 1, title: 'Junior Gakusei Pemula (初心者)', desc: 'Tingkat dasar memahami aksara dasar bahasa Jepang.', icon: '🔰' },
      { level: 10, title: 'Kohai Berbakat (後輩)', desc: 'Mulai memahami kosa kata umum di level sepuluh.', icon: '🎓' },
      { level: 25, title: 'Ronin Pengembara (浪人)', desc: 'Berjalan menyusuri lembah kosakata dasar tanpa rasa takut.', icon: '🌾' },
      { level: 50, title: 'Ninja Bayangan (忍)', desc: 'Menembus batasan kegelapan tata bahasa berkecepatan tinggi.', icon: '🥷' },
      { level: 75, title: 'Bushi Prajurit Gagah (武士)', desc: 'Menghunus pedang pemahaman hiragana, katakana, dan kanji.', icon: '⚔️' },
      { level: 100, title: 'Senpai Penjelajah (先輩)', desc: 'Kemampuan membaca & menulis kosa kata tingkat menengah.', icon: '📖' },
    ];
    list.push(...baseMilestones);

    // Multiples of 100 up to 1000
    const titles100: Record<number, { title: string; desc: string; icon: string }> = {
      200: { title: 'Oni Penghancur Rintangan (鬼)', desc: 'Menghancurkan setiap soal tes dengan kekuatan luar biasa.', icon: '👹' },
      300: { title: 'Samurai Goresan Presisi (侍)', desc: 'Setiap jawaban ditarik layaknya tebasan katana yang tajam.', icon: '🗡️' },
      400: { title: 'Kitsune Cerdik Serba Tahu (狐)', desc: 'Menggunakan kecerdasan rubah legendaris untuk menebak tata bahasa Jepun.', icon: '🦊' },
      500: { title: 'Yakuza Kosakata Terlarang (極道)', desc: 'Menguasai kosa kata jalanan dan formal dengan kendali mutlak.', icon: '🕶️' },
      600: { title: 'Biksu Zen Ketenangan Jiwa (禅僧)', desc: 'Menjawab soal tersulit pun dengan kepala dingin dan fokus mutlak.', icon: '🧘' },
      700: { title: 'Kaisar Kaligrafi Indah (書道帝)', desc: 'Menulis kanji dengan estetika sempurna yang menakjubkan.', icon: '🖌️' },
      800: { title: 'Tengu Penguasa Badai (天狗)', desc: 'Terbang tinggi melewati badai kanji dan kosakata rumit.', icon: '👺' },
      900: { title: 'Shogun Penakluk Wilayah (将軍)', desc: 'Menaklukan hampir seluruh tataran bahasa Jepang dasar s/d menengah.', icon: '🏯' },
      1000: { title: 'Chunin Kosakata Mandiri (中忍)', desc: 'Menghafal ribuan kosa kata dasar s/d menengah dengan andal.', icon: '🏹' },
    };
    for (let l = 200; l <= 1000; l += 100) {
      if (titles100[l] && !list.some(x => x.level === l)) {
        list.push({ level: l, ...titles100[l] });
      }
    }

    // Multiples of 1000 up to 10000
    const titles1000: Record<number, { title: string; desc: string; icon: string }> = {
      2000: { title: 'Daimyo Penguasa Kastil (大名)', desc: 'Memiliki kastil pengetahuan kosakata yang sangat kukuh.', icon: '🏰' },
      3000: { title: 'Ryu Naga Langit (竜)', desc: 'Terbang membelah awan dengan hembusan nafas api kanji.', icon: '🐉' },
      4000: { title: 'Kaisar Shogun Agung (将軍公)', desc: 'Memimpin seluruh divisi pembelajaran dengan strategi terkuat.', icon: '🎖️' },
      5000: { title: 'Shinobi Elit Konoha (上忍)', desc: 'Misi level tinggi diselesaikan dalam hitungan detik semata.', icon: '🍃' },
      6000: { title: 'Master Kaligrafi Kekaisaran (至高筆)', desc: 'Seni menulis aksara kuno yang tiada tandingannya di dunia.', icon: '📜' },
      7000: { title: 'Phoenix Api Abadi (不死鳥)', desc: 'Kembali bangkit lebih kuat setelah setiap kesalahan kuis.', icon: '🔥' },
      8000: { title: 'Senshi Pelindung Agung (戦士)', desc: 'Perisai pengetahuan yang tidak tergoyahkan oleh jebakan soal.', icon: '🛡️' },
      9000: { title: 'Sosok Sage Legendaris (仙人)', desc: 'Memahami makna di balik struktur kalimat tersirat.', icon: '🎋' },
      10000: { title: 'Samurai Kanji Ulung (漢字侍)', desc: 'Mencapai Level 10.000 dengan keyakinan laskar ninja sejati.', icon: '👘' },
    };
    for (let l = 2000; l <= 10000; l += 1000) {
      if (titles1000[l]) {
        list.push({ level: l, ...titles1000[l] });
      }
    }

    // Multiples of 10000 up to 100000
    const titles10000: Record<number, { title: string; desc: string; icon: string }> = {
      20000: { title: 'Overlord Kegelapan (覇王)', desc: 'Kekuatan linguistik mutlak yang menundukkan musuh tanpa kata.', icon: '🖤' },
      30000: { title: 'Kaisar Bintang Galaksi (銀河帝)', desc: 'Pengetahuan seluas hamparan alam semesta tanpa batas.', icon: '🌌' },
      40000: { title: 'Penunggang Badai Amaterasu (天照)', desc: 'Mengendalikan api suci dewi matahari dalam batin bahasa.', icon: '☀️' },
      50000: { title: 'Daimyo Kaisar Lancar (大名)', desc: 'Menghafal puluhan ribu kosakata dasar & tata bahasa canggih.', icon: '👑' },
      60000: { title: 'Dewa Petir Susanoo (素戔嗚尊)', desc: 'Guntur kebenaran menerangi sela-sela kanji terumit.', icon: '⛈️' },
      70000: { title: 'Penjaga Gerbang Ryujin (龍神)', desc: 'Menguasai samudra kosakata terdalam di seluruh samudera raya.', icon: '🌊' },
      80000: { title: 'Entitas Astral Kuno (古の存在)', desc: 'Melebihi nalar manusia fana dalam menerjemahkan dialek kuno.', icon: '🔮' },
      90000: { title: 'Ksatria Kehancuran Kosmos (終焉)', desc: 'Satu langkah lagi menuju puncak kesempurnaan tertinggi alam semesta.', icon: '☄️' },
      100000: { title: 'Nihongo Shin Dewa Bahasa (神)', desc: 'Tingkat keabadian tertinggi mencapai Level 100.000 dambaan seluruh master.', icon: '⚡' },
    };
    for (let l = 20000; l <= 100000; l += 10000) {
      if (titles10000[l]) {
        list.push({ level: l, ...titles10000[l] });
      }
    }

    return list.sort((a, b) => a.level - b.level);
  }, []);

  // Sensei Chat sending mechanism
  const submitSenseiMsg = async (customText?: string) => {
    const textVal = customText || senseiInput;
    if (!textVal.trim() || senseiLoading) return;
    const text = textVal.trim();
    if (!customText) setSenseiInput('');
    setSenseiLoading(true);

    const userMsg: ChatMessage = { role: 'user', text };
    const nextChat = [...senseiChat, userMsg];
    setSenseiChat(nextChat);

    try {
      const res = await fetch(API_BASE + '/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextChat, character: voiceCharacter })
      });
      
      if (!res.ok) {
        throw new Error('Static/offline mode');
      }
      
      const d = await res.json();
      if (d.status === 'success') {
        setSenseiChat(prev => [...prev, { role: 'model', text: d.reply }]);
        playAudio(d.reply, true);
      } else {
        const busyText = 'Sensei sedang sibuk istirahat. Silakan tanya kembali sejenak!';
        setSenseiChat(prev => [...prev, { role: 'model', text: busyText }]);
        playAudio(busyText, true);
      }
    } catch {
      // OFFLINE SENSEI CONVERSATION FALLBACK ENGINE
      const cleanInput = text.toLowerCase();
      let replyText = 'Mata mimiku membesar karena semangatmu! 🦊 Sebagai AI Sensei, mari terus berlatih hiragana, katakana, dan kanji bersama. Cobalah tanyakan hal spesifik seperti "tips belajar" atau aksara Jepang!';

      if (cleanInput.includes('halo') || cleanInput.includes('konnichiwa') || cleanInput.includes('hi ') || cleanInput.includes('pagi') || cleanInput.includes('siang') || cleanInput.includes('sore') || cleanInput.includes('malam') || cleanInput.includes('ohayou') || cleanInput.includes('konbanwa')) {
        replyText = 'Konnichiwa! 🌸 Selamat datang di bimbingan Sensei pribadi Anda. Ada materi atau kosakata bahasa Jepang yang ingin kamu diskusikan hari ini? Ketik saja "hiragana", "katakana", "kanji", atau minta "tips belajar"!';
      } else if (cleanInput.includes('siapa') || cleanInput.includes('kamu') || cleanInput.includes('sensei') || cleanInput.includes('nama')) {
        replyText = 'Saya adalah AI Sensei pribadimu! 🎓 Dirancang untuk membantumu bersenang-senang menghafal Hiragana, Katakana, melafalkan bunyi audio, melacak pencapaian, dan menemanimu latihan kuis kapan pun saja!';
      } else if (cleanInput.includes('hiragana')) {
        replyText = 'Hiragana (平仮名) adalah aksara dasar pertama Jepang dengan total 46 karakter dasar. Tips Sensei: Manfaatkan menu "Menulis" di aplikasi untuk mencoret urutan garis stroke kanji/kana agar memori otot tanganmu terbentuk dengan sempurna! ✨';
      } else if (cleanInput.includes('katakana')) {
        replyText = 'Katakana (片仮名) cenderung memiliki garis lurus dan sudut tajam. Khusus dipakai untuk menulis kata serapan asing (contoh: "Kamera" -> カメラ). Cobalah tebak bunyinya di menu audio atau latih coretannya di menu Menulis!';
      } else if (cleanInput.includes('kanji') || cleanInput.includes('tips kanji')) {
        replyText = 'Kanji (漢字) melambangkan ide atau makna utuh. Strategi menghafal Kanji yang asyik: fokuslah memahami radikal pembentuknya dan latih kuis kosakata bertema N5 atau N4 secara teratur!';
      } else if (cleanInput.includes('terima kasih') || cleanInput.includes('arigatou') || cleanInput.includes('makasih') || cleanInput.includes('thank')) {
        replyText = 'Arigatou gozaimasu! 😊 (どういたしまして - Douitashimashite!). Konsistensi harian adalah kunci utama keberhasilanmu. Ganbatte kudasai! (Semangat terus!) 🌟';
      } else if (cleanInput.includes('tips') || cleanInput.includes('belajar') || cleanInput.includes('saran')) {
        replyText = '🎓 Tips Belajar Efektif dari Sensei:\n\n1. **Belajar 10 Menit Sehari**: Sangat jauh lebih efektif dibanding begadang 4 jam sekali seminggu.\n2. **Gunakan Hand-Writing Canvas**: Menulis langsung melatih daya ingat visual motorik aksara Jepang.\n3. **Jangan Takut Gagal**: Tenang saja, kuis salah tidak mengurangi status akun aslimu, jadikan sarana belajar!\n4. **Menyimak dengan Melafalkan**: Dengar suara audio di menu, lalu ucapkan lantang agar lidahmu terbiasa.';
      }

      setSenseiChat(prev => [...prev, { role: 'model', text: replyText }]);
      playAudio(replyText, true);
    } finally {
      setSenseiLoading(false);
    }
  };

  // Accept Terms Handler
  const handleAcceptTerms = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(API_BASE + '/api/profile/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid })
      });
      const d = await res.json();
      if (d.status === 'success') {
        setCurrentUser(d.data);
        localStorage.setItem('nik_terms_accepted', 'true');
        setShowTermsModal(false);
        triggerToast('Syarat & Ketentuan disetujui! Selamat belajar!', 'success');
      } else {
        triggerToast(d.message || 'Gagal menyetujui ketentuan.', 'error');
      }
    } catch (e) {
      // Offline fallback
      localStorage.setItem('nik_terms_accepted', 'true');
      setShowTermsModal(false);
      triggerToast('Syarat & Ketentuan disetujui secara mandiri!', 'success');
    }
  };

  // Claim Daily Bento Box Handler
  const handleClaimDailyBento = async () => {
    if (isBentoClaimedToday) {
      triggerToast('Kamu sudah mengambil Bento Box hari ini. Kembali lagi besok ya!', 'error');
      return;
    }
    
    // Play character audio voice line thanking the user
    let claimLine = 'お弁当をどうぞ！美味しく召し上がってくださいね！';
    if (voiceCharacter === 'mahiru') claimLine = 'あの、お弁当を作ってきました。お気に召すと嬉しいです。';
    else if (voiceCharacter === 'umi') claimLine = 'ほら、アタシ特製のお弁当！モリモリ食べて勉強しよ！';
    else if (voiceCharacter === 'nagisa') claimLine = 'ふふっ、渚咲の手作りお弁当だよ。あーん、してあげる？';
    else if (voiceCharacter === 'furina') claimLine = 'ボクの特製宮廷ディナーだ！感謝して完食するがいい！';
    else if (voiceCharacter === 'hutao') claimLine = 'お弁当の時間だよー！これを食べれば元気もりもり！';
    else if (voiceCharacter === 'columbina') claimLine = '美味しいお弁当はいかが…？心を込めて用意したの…';
    else if (voiceCharacter === 'kyoko') claimLine = 'ほら、お弁当作ってきたよ！好き嫌いしないで全部食べてね！';
    
    playAudio(claimLine);
    
    // Confetti blast!
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#fbbf24', '#f59e0b', '#ec4899', '#3b82f6', '#10b981']
    });

    const newPoin = localPoin + 50;
    const newXp = localXp + 75;
    
    setLocalPoin(newPoin);
    setLocalXp(newXp);
    setBentoClaimDate(todayStr);
    localStorage.setItem('nik_bento_claim_date', todayStr);

    triggerToast('Selamat! Bento Box berhasil diklaim: +50 Poin & +75 XP!', 'success');

    // Sync to server if logged in
    if (currentUser) {
      try {
        await fetch(API_BASE + '/api/score/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: currentUser.uid,
            poin: newPoin,
            xp: newXp
          })
        });
      } catch (e) {
        console.error('Bento reward server sync failed:', e);
      }
    }
  };

  // Submit User Bug Report / Feedback Handler
  const submitUserReport = async () => {
    if (!reportMessage.trim()) {
      triggerToast('Pesan laporan tidak boleh kosong.', 'error');
      return;
    }
    setReportSending(true);
    try {
      const res = await fetch(API_BASE + '/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser?.uid || 'GUEST',
          category: reportCategory,
          message: reportMessage
        })
      });
      const d = await res.json();
      if (d.status === 'success') {
        triggerToast('Laporan berhasil dikirim! Terima kasih atas bantuanmu.', 'success');
        setReportMessage('');
        setShowReportModal(false);
      } else {
        triggerToast(d.message || 'Gagal mengirim laporan.', 'error');
      }
    } catch (e) {
      triggerToast('Gagal terhubung ke server untuk mengirim laporan.', 'error');
    } finally {
      setReportSending(false);
    }
  };

  // Load Developer Portal Reports
  const fetchDevReports = async () => {
    if (!currentUser) return;
    setDevReportsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reports/list?uid=${currentUser.uid}`);
      const d = await res.json();
      if (d.status === 'success') {
        setDevReports(d.data || []);
      } else {
        triggerToast(d.message || 'Gagal memuat laporan.', 'error');
      }
    } catch (e) {
      triggerToast('Gagal terhubung ke server portal developer.', 'error');
    } finally {
      setDevReportsLoading(false);
    }
  };

  // Update report status
  const updateReportStatus = async (reportId: string, status: 'resolved' | 'rejected') => {
    if (!currentUser) return;
    setUpdatingReportId(reportId);
    try {
      const res = await fetch(`${API_BASE}/api/reports/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          reportId,
          status
        })
      });
      const d = await res.json();
      if (d.status === 'success') {
        triggerToast(`Status laporan berhasil diubah ke ${status}!`, 'success');
        // Refresh local reports list
        setDevReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
      } else {
        triggerToast(d.message || 'Gagal mengubah status.', 'error');
      }
    } catch (e) {
      triggerToast('Gagal terhubung ke server.', 'error');
    } finally {
      setUpdatingReportId(null);
    }
  };

  // Reset local state memory
  const resetStoryMemory = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Memori Latihan (リセット)',
      message: 'Yakin ingin mereset riwayat dan memori latihan kuis soal kamu? Status pendaftaran akun asli tidak akan terhapus, tetapi progres lokal Anda akan disinkronisasi kembali ke 0.',
      confirmText: 'Ya, Reset',
      cancelText: 'Batal',
      onConfirm: () => {
        setLocalPoin(0);
        setLocalXp(0);
        setStreakKuis(0);
        setQuizIndex(0);
        setJlptExamHistory([]);
        localStorage.removeItem('nik_jlpt_history');
        if (currentUser) {
          const updatedUser = { ...currentUser, poin: 0, xp: 0 };
          setCurrentUser(updatedUser);
          localStorage.setItem('nik_guest_profile', JSON.stringify(updatedUser));
          fetch(API_BASE + '/api/score/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: currentUser.uid, poin: 0, xp: 0 })
          }).catch(err => console.log('Score reset sync failed:', err));
        }
        triggerToast('Memori soal kuis lokal berhasil direset!', 'success');
      }
    });
  };

  // Run automatically when level filter mounts or changes
  useEffect(() => {
    initQuizSession(levelFilter, quizMode);
  }, [levelFilter, quizMode]);

  return (
    <div className="min-h-screen bg-mesh text-slate-100 font-sans pb-28 relative overflow-x-hidden">
      {/* Background Star field particles */}
      <canvas ref={particlesCanvasRef} id="particles-canvas" className="fixed inset-0 pointer-events-none z-0" />
      {/* Immersive Full-Screen JLPT Exam Overlay */}
      {jlptActive && jlptQuestions.length > 0 && (() => {
        const currentQ = jlptQuestions[jlptIndex];
        const answeredCount = jlptQuestions.filter(q => q.userAnswer).length;
        if (!currentQ) return null;

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#090518] text-slate-100 flex flex-col justify-between font-sans selection:bg-pink-500/30 selection:text-white">
            {/* TOP HEADER STATUS PANEL */}
            <header className="sticky top-0 bg-[#0d0a21]/90 backdrop-blur-md border-b border-violet-900/40 py-4 px-6 flex justify-between items-center z-20">
              <div className="space-y-0.5">
                <h1 className="text-xs md:text-sm font-black text-white flex items-center gap-2 tracking-wider">
                  <span className="animate-pulse w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/50"></span>
                  SIMULASI UJIAN JLPT {jlptLevel.toUpperCase()}
                </h1>
                <p className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400">
                  Soal {jlptIndex + 1} dari {jlptQuestions.length}
                </p>
              </div>

              {/* TIMER HUD */}
              <div className="flex items-center gap-2 bg-slate-950/60 border border-violet-850 px-4 py-1.5 rounded-2xl shadow-inner font-mono">
                <Clock size={14} className="text-pink-500 animate-spin-slow" />
                <span className={`text-md font-extrabold tracking-wider ${jlptTimeLeft < 120 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
                  {Math.floor(jlptTimeLeft / 60)}:{(jlptTimeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* QUIT ACTION BUTTON */}
              <button
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'Keluar dari Ujian (退出)',
                    message: 'Apakah Anda yakin ingin menyerah dan meninggalkan sesi ujian JLPT? Semua progres jawaban Anda pada simulasi sesi ini akan hilang.',
                    confirmText: 'Ya, Keluar',
                    cancelText: 'Batal',
                    onConfirm: () => {
                      cancelJlptExam();
                    }
                  });
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-red-500/30 bg-red-950/40 hover:bg-red-950/80 text-red-300 text-xs font-bold cursor-pointer transition duration-150 active:scale-95 min-h-[40px] select-none"
              >
                <X size={13} />
                Keluar
              </button>
            </header>

            {/* COMPREHENSIVE QUESTION EXAM BOARD */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col justify-center items-center gap-8">
              <div className="w-full bg-[#120f2b]/40 border border-violet-900/30 rounded-3xl p-6 md:p-8 flex flex-col items-center gap-6 relative overflow-hidden shadow-2xl">
                <div className="absolute top-4 left-4 text-[10px] font-extrabold tracking-widest text-slate-500 select-none">
                  LISTENING COMPREHENSION MODEL
                </div>

                {/* AUDIO PLAYBACK BUTTON */}
                <button
                  onClick={() => playAudio(currentQ.sentence)}
                  className="mt-2 text-xs bg-gradient-to-r from-violet-600 to-pink-500 text-white font-black uppercase tracking-wider py-2 px-5 rounded-full flex items-center gap-1.5 shadow-lg shadow-pink-500/20 cursor-pointer hover:opacity-90 active:scale-95 transition"
                >
                  <Volume2 size={13} className="animate-bounce" />
                  Dengarkan Kalimat
                </button>

                {/* THE JAPANESE SENTENCE BOARD */}
                <div className="w-full space-y-4 text-center">
                  <div className="text-2xl md:text-3xl font-black text-white leading-relaxed tracking-widest font-jp select-all bg-slate-950/40 border border-violet-950/60 p-6 rounded-2xl">
                    {currentQ.sentence}
                  </div>
                  <div className="text-xs md:text-sm text-violet-400 font-bold italic tracking-wide">
                    Cara baca: <span className="font-mono text-slate-300">{currentQ.romaji}</span>
                  </div>
                </div>

                {/* CHOOSE LABELS */}
                <div className="w-full border-t border-violet-950 pt-4 text-center space-y-1">
                  <p className="text-xs font-extrabold text-slate-400 tracking-wider">
                    PILIH TERJEMAHAN KALIMAT DI ATAS DENGAN BENAR:
                  </p>
                </div>

                {/* MULTIPLE CHOICE IN HORIZONTAL FORM (abc-an mendatar ke kanan dengan isinya arti kalimat) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                  {currentQ.options.map((option: string, oIdx: number) => {
                    const letters = ['A', 'B', 'C', 'D'];
                    const isSelected = currentQ.userAnswer === option;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => {
                          const updatedQuestions = [...jlptQuestions];
                          updatedQuestions[jlptIndex].userAnswer = option;
                          setJlptQuestions(updatedQuestions);
                        }}
                        className={`p-4 rounded-2xl border text-xs font-bold transition duration-200 cursor-pointer flex items-center gap-4 text-left ${
                          isSelected
                            ? 'bg-gradient-to-r from-violet-900/30 to-pink-900/30 border-pink-500 text-white shadow-lg shadow-pink-500/10'
                            : 'bg-slate-900/30 border-violet-900/20 hover:border-violet-500/40 text-slate-300'
                        }`}
                      >
                        <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-bold text-xs transition duration-155 ${
                          isSelected ? 'bg-pink-500 text-white shadow-md' : 'bg-violet-950/50 text-pink-400'
                        }`}>
                          {letters[oIdx]}
                        </span>
                        <span className="text-[11px] leading-relaxed font-semibold">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </main>

            {/* BOTTOM HUD ACTION SYSTEM */}
            <footer className="sticky bottom-0 bg-[#0c091f]/90 backdrop-blur-md border-t border-violet-900/30 p-4 flex justify-between items-center z-20">
              {/* PREVIOUS QUESTION ACTION */}
              <div>
                {jlptIndex > 0 ? (
                  <button
                    onClick={() => setJlptIndex(idx => idx - 1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-violet-800 text-pink-400 text-xs font-bold bg-violet-950/20 hover:bg-violet-900/20 transition cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                    Soal Sebelumnya
                  </button>
                ) : (
                  <div className="w-[125px]"></div>
                )}
              </div>

              {/* LIST NAV INDEX */}
              <button
                onClick={() => setShowJlptListModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-violet-800 text-slate-200 text-xs font-bold bg-slate-950/60 hover:bg-slate-950/90 transition cursor-pointer"
              >
                ☰ Daftar Soal ({answeredCount}/{jlptQuestions.length})
              </button>

              {/* NEXT QUESTION OR SUBMIT SCREEN */}
              <div>
                {jlptIndex < jlptQuestions.length - 1 ? (
                  <button
                    onClick={() => setJlptIndex(idx => idx + 1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-black tracking-wide hover:bg-violet-500 transition cursor-pointer shadow-md shadow-violet-600/20"
                  >
                    Soal Berikutnya
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setJlptCheckedConfirm(false);
                      setShowJlptConfirmModal1(true);
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-xs font-black tracking-wide hover:opacity-90 transition cursor-pointer shadow-lg shadow-pink-500/20"
                  >
                    🏁 Selesai Ujian JLPT
                  </button>
                )}
              </div>
            </footer>

            {/* MODAL 1: QUESTION SELECT LIST */}
            {showJlptListModal && (
              <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-40">
                <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative">
                  <button 
                    onClick={() => setShowJlptListModal(false)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
                  >
                    <X size={16} />
                  </button>
                  <div className="text-center space-y-1 mb-5">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Map Soal Simulasi Ujian</h2>
                    <p className="text-[10px] text-slate-400">Ketuk nomor mana saja untuk langsung merevisi jawabanmu</p>
                  </div>

                  <div className="grid grid-cols-5 gap-3.5 mb-6">
                    {jlptQuestions.map((q, idx) => {
                      const isCurrent = idx === jlptIndex;
                      const isAnswered = !!q.userAnswer;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setJlptIndex(idx);
                            setShowJlptListModal(false);
                          }}
                          className={`w-11 h-11 rounded-2xl font-bold font-mono text-xs cursor-pointer flex items-center justify-center transition border ${
                            isCurrent
                              ? 'bg-pink-500 border-pink-400 text-white shadow-lg'
                              : isAnswered
                              ? 'bg-violet-950/50 border-violet-850 text-slate-100'
                              : 'bg-slate-950/30 border-slate-800/40 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowJlptListModal(false)}
                    className="w-full py-2 bg-slate-950 border border-violet-900 text-xs font-bold text-slate-300 rounded-xl hover:bg-slate-900 cursor-pointer"
                  >
                    Kembali ke Soal
                  </button>
                </div>
              </div>
            )}

            {/* POP-UP CONFIRMATION 1: VERIFIKASI SELESAI */}
            {showJlptConfirmModal1 && (
              <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-40">
                <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-5">
                  <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center text-xl text-pink-400 mx-auto border border-pink-500/20">
                    ❓
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-md font-extrabold text-white">SELESAIKAN SIMULASI UJIAN?</h2>
                    <p className="text-[11px] text-slate-400">
                      Kamu telah mengisi <span className="font-bold text-pink-400">{answeredCount} dari {jlptQuestions.length}</span> soal. Apakah kamu yakin ingin menyudahi simulasi sekarang?
                    </p>
                  </div>

                  {/* CHECKBOX REQUIREMENT */}
                  <label className="flex items-start gap-2.5 text-left bg-slate-950/60 border border-violet-900/30 p-3 rounded-2xl cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={jlptCheckedConfirm}
                      onChange={(e) => setJlptCheckedConfirm(e.target.checked)}
                      className="mt-0.5 rounded border-violet-850 text-pink-500 focus:ring-pink-500/50 h-3 w-3 bg-slate-900"
                    />
                    <span className="text-[10px] text-slate-300 leading-tight">
                      Saya menyatakan bahwa saya telah mengisi seluruh jawaban dengan jujur, teliti, dan siap melihat keputusan skor saya.
                    </span>
                  </label>

                  <div className="flex gap-2 font-bold select-none pt-2">
                    <button
                      onClick={() => setShowJlptConfirmModal1(false)}
                      className="flex-1 py-2.5 rounded-xl border border-violet-800 text-slate-400 hover:text-slate-200 text-xs cursor-pointer transition"
                    >
                      Belum Yakin
                    </button>
                    <button
                      disabled={!jlptCheckedConfirm}
                      onClick={() => {
                        setShowJlptConfirmModal1(false);
                        setShowJlptConfirmModal2(true);
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-xs flex justify-center items-center gap-1 transition ${
                        jlptCheckedConfirm
                          ? 'bg-pink-500 hover:bg-pink-400 text-white cursor-pointer shadow-md'
                          : 'bg-slate-950 border border-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* POP-UP CONFIRMATION 2: VERIFIKASI AKHIR / DOUBLE SURE */}
            {showJlptConfirmModal2 && (
              <div className="fixed inset-0 bg-slate-950/98 flex items-center justify-center p-4 z-50 animate-fadeIn">
                <div className="bg-slate-900 border-2 border-red-900/60 shadow-red-500/5 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-5">
                  <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-xl text-red-400 mx-auto border border-red-500/20">
                    ⚠️
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-sm font-extrabold text-red-400 uppercase tracking-wider">🚨 VERIFIKASI AKHIR GANDA!</h2>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Apakah kamu benar-benar <strong className="text-red-400">100% YAKIN</strong> dengan semua jawabanmu? Jawaban tidak akan pernah bisa diubah lagi setelah dikirim untuk diuji oleh Sensei.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 font-bold select-none pt-2">
                    <button
                      onClick={() => {
                        setShowJlptConfirmModal2(false);
                        setShowJlptConfirmModal1(true);
                      }}
                      className="w-full py-2.5 rounded-xl border border-violet-800 text-slate-400 hover:text-slate-200 text-xs cursor-pointer transition"
                    >
                      Ragu-Ragu (Periksa Kembali)
                    </button>
                    <button
                      onClick={finishJlptExam}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-650 to-pink-600 text-white text-xs cursor-pointer shadow-lg hover:brightness-110 active:scale-[98%] transition"
                    >
                      SAYA YAKIN, KUMPULKAN SEKARANG!
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Immersive Japanese Theme Background (Crimson & Indigo Night / Turquoise / Rose / Sky Blue) */}
      <style>{themeDetails[currentTheme]?.styleOverrides || ''}</style>
      <div className={`fixed inset-0 pointer-events-none z-[-2] bg-gradient-to-b ${themeDetails[currentTheme]?.bgGradient || 'from-[#060412] via-[#0b081e] to-[#1a0c20]'}`}></div>
      
      {/* Japan Traditional Seigaiha / Grid Matrix Overlay */}
      <div 
        className={`fixed inset-0 pointer-events-none z-[-1] ${themeDetails[currentTheme]?.gridOpacity || 'opacity-[0.05]'}`}
        style={{
          backgroundImage: `linear-gradient(${themeDetails[currentTheme]?.gridColor || 'rgba(244,63,94,0.06)'} 1px, transparent 1px), linear-gradient(90deg, ${themeDetails[currentTheme]?.gridColor || 'rgba(244,63,94,0.06)'} 1px, transparent 1px)`,
          backgroundSize: '44px 44px'
        }}
      ></div>
      
      {/* Gorgeous Mount Fuji & Glowing Hinomaru Sunrise Landscape silhouette */}
      <div className="fixed bottom-0 left-0 right-0 h-44 pointer-events-none z-[-1] overflow-hidden select-none opacity-20">
        <svg className="w-full h-full text-slate-100" viewBox="0 0 1000 220" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Subtle Sun Glow reflection */}
          <circle cx="500" cy="180" r="90" fill={themeDetails[currentTheme]?.sunGlow || '#f43f5e'} opacity={themeDetails[currentTheme]?.sunGlowOpacity || '0.32'} filter="blur(16px)" />
          {/* Hinomaru Sun */}
          <circle cx="500" cy="170" r="66" fill={themeDetails[currentTheme]?.sunColor || '#e11d48'} opacity={themeDetails[currentTheme]?.sunOpacity || '0.45'} />
          {/* Mount Fuji Outer Base */}
          <path d="M220 220 L440 90 L480 72 L500 68 L520 72 L560 90 L780 220 Z" fill="#0c0a2b" />
          {/* Snow Cap Detail on Mount Fuji */}
          <path d="M440 90 L480 72 L500 68 L520 72 L560 90 C530 84 520 92 500 86 C480 92 470 84 440 90 Z" fill="#ffffff" opacity="0.85" />
          {/* Left & Right side supportive mountains */}
          <path d="M0 220 L150 160 L320 220 Z" fill="#09071f" opacity="0.7" />
          <path d="M680 220 L850 150 L1000 220 Z" fill="#09071f" opacity="0.7" />
        </svg>
      </div>

      {/* Floating background Kanji shapes & Cherry Blossoms */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        {floatingIcons.map(icon => {
          const isEmoji = themeDetails[currentTheme]?.floatingChars.includes(icon.char) || ['🌸', '💮', '🍁'].includes(icon.char);
          return (
            <div
              key={icon.id}
              className={`absolute font-bold opacity-0 select-none floating-kanji ${
                isEmoji ? 'text-pink-400/60 drop-shadow-md' : 'text-rose-400/25 font-jp'
              }`}
              style={{
                left: `${icon.left}%`,
                fontSize: `${icon.size}px`,
                animationDuration: `${icon.duration}s`,
                bottom: '-50px',
              }}
            >
              {icon.char}
            </div>
          );
        })}
      </div>

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/5 py-3.5 px-4 flex items-center justify-between rounded-b-2xl">
        {/* Left Side: Avatar Pill Header (WhatsApp Video Style matching frame_001.png exactly) */}
        <div className="flex flex-col gap-1.5 text-left">
          {currentUser ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {/* Circular Avatar */}
                <button
                  onClick={() => setActiveTab('profil')}
                  className="w-10 h-10 rounded-full bg-slate-900 border border-violet-900/30 overflow-hidden ring-1 ring-violet-500/20 active:scale-95 duration-200 cursor-pointer"
                >
                  <img 
                    src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=0b1120&color=e5c57f`} 
                    alt="profile" 
                    className="w-full h-full object-cover"
                  />
                </button>

                {/* Greeting & Name */}
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {(() => {
                      const hr = new Date().getHours();
                      if (hr < 11) return 'Selamat pagi';
                      if (hr < 15) return 'Selamat siang';
                      if (hr < 18) return 'Selamat sore';
                      return 'Selamat malam';
                    })()}
                  </span>
                  <span className="text-xs font-black text-white leading-tight tracking-wide">
                    {currentUser.displayName}
                  </span>
                </div>
              </div>

              {/* Pill Badges underneath */}
              <div className="flex items-center gap-2 pl-0.5">
                {/* Diamond/VIP Badge */}
                <span className="bg-purple-950/20 border border-purple-800/30 text-purple-400 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 tracking-wider shadow-sm">
                  <span>💎</span> DIAMOND
                </span>

                {/* Level Badge with Shield Icon */}
                <span className="bg-slate-900 border border-white/10 text-slate-300 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 tracking-wider shadow-sm">
                  <span>🛡️</span> LV {Math.floor((currentUser.xp || 0) / 1000) + 1}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center font-bold text-xs text-white shadow-lg">語</div>
              <div>
                <h1 className="text-xs font-black text-white tracking-wide">Zenith</h1>
                <p className="text-[8px] text-slate-450 font-bold uppercase tracking-widest">Nihongo</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-1.5">
          {currentUser && currentUser.role === 'dev' && (
            <button
              onClick={() => {
                setDevPortalTab('stats');
                setShowDevPortal(true);
              }}
              className="dev-rgb-badge px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest cursor-pointer select-none active:scale-95 duration-100 flex items-center gap-1 text-white"
            >
              💻 DEV Portal
            </button>
          )}

          {currentUser ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('riwayat')}
                className={`flex items-center justify-center w-8 h-8 rounded-xl border transition cursor-pointer active:scale-90 ${
                  activeTab === 'riwayat'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-400 shadow-md'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
                title="Riwayat Simulasi JLPT"
              >
                <History size={15} />
              </button>
              
              <button
                onClick={() => setActiveTab('setting')}
                className={`flex items-center justify-center w-8 h-8 rounded-xl border transition cursor-pointer active:scale-90 ${
                  activeTab === 'setting'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-400 shadow-md'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
                title="Pengaturan"
              >
                <Settings size={15} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                generateNewCaptcha();
                setShowAuthModal(true);
              }}
              className="bg-gradient-to-r from-amber-400 to-amber-600 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-1 hover:brightness-110 transition active:scale-95 duration-150"
            >
              <Lock size={12} />
              Buka Sesi
            </button>
          )}
        </div>
      </header>

      {/* JLPT Sticky Exam Banner */}
      {jlptActive && (
        <div className="sticky top-[69px] z-30 bg-pink-950/90 border-b border-pink-500/30 px-4 py-2 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5 text-pink-400">
            <Clock size={14} className="animate-pulse" />
            <span>EXAM: JLPT {jlptLevel.toUpperCase()}</span>
          </div>
          <div className="text-amber-400 font-mono text-sm tracking-widest">
            {Math.floor(jlptTimeLeft / 60)}:{(jlptTimeLeft % 60).toString().padStart(2, '0')}
          </div>
          <button 
            onClick={() => {
              setConfirmDialog({
                isOpen: true,
                title: 'Keluar dari Ujian (退出)',
                message: 'Apakah Anda yakin ingin menyerah dan meninggalkan sesi ujian JLPT? Semua progres jawaban Anda pada simulasi sesi ini akan hilang.',
                confirmText: 'Ya, Keluar',
                cancelText: 'Batal',
                onConfirm: () => {
                  cancelJlptExam();
                }
              });
            }}
            className="bg-red-950/80 hover:bg-red-900/90 text-red-300 border border-red-550/40 font-extrabold px-3.5 py-2 rounded-xl transition text-[11px] cursor-pointer min-h-[36px] flex items-center justify-center select-none active:scale-95"
          >
            🚪 Keluar Ujian
          </button>
        </div>
      )}

      {/* Interactive Toasts Layer */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 border border-violet-800/60 px-5 py-3 rounded-full shadow-2xl text-xs font-bold animate-bounce">
          <div className={`w-2 h-2 rounded-full ${toastMessage.type === 'success' ? 'bg-emerald-400 shadow-emerald-400' : 'bg-rose-500 shadow-rose-500'} shadow-sm`}></div>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Primary Container Layout */}
      <main className="max-w-md mx-auto px-4 pt-6">
        
        {/* ==========================================
            VIEW: HOME / DASHBOARD
        ========================================== */}
        {activeTab === 'kuis' && (
          <div className="space-y-6 animate-fadeIn pb-36 z-10 relative">

            {/* 📣 AUTOMATED CPANEL/WHATSAPP VIDEO STYLE ANNOUNCEMENT BOARD */}
            <div className="bg-[#0c051a]/95 border border-purple-900/30 rounded-3xl p-5 relative space-y-3.5 shadow-2xl animate-slideDown">
              <div className="flex justify-between items-center border-b border-violet-950/40 pb-2">
                <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider">
                  <span>📣</span> Pengumuman
                </div>
                <span className="bg-violet-900/40 border border-violet-750/30 text-[9px] font-black text-violet-400 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                  Info
                </span>
              </div>
              
              <div className="text-left space-y-2.5">
                <p className="text-[11px] font-semibold text-slate-300 leading-relaxed font-sans">
                  {announcementText}
                </p>
                
                {isAnnouncementExpanded && (
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-violet-950/30 text-[10px] font-bold text-slate-450 leading-relaxed animate-fadeIn">
                    ℹ️ Seluruh aktivitas pemeliharaan server, jadwal simulasi kuis JLPT baru, serta rilis fitur premium akan diumumkan di papan pengumuman resmi ini oleh pihak developer.
                  </div>
                )}
              </div>

              <div className="text-left shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementExpanded(!isAnnouncementExpanded)}
                  className="text-[10px] font-black text-violet-400 hover:text-violet-300 flex items-center gap-1 cursor-pointer select-none active:scale-95 duration-100"
                >
                  <span>{isAnnouncementExpanded ? 'Sembunyikan' : 'Selengkapnya'}</span>
                  <span>{isAnnouncementExpanded ? '▲' : '▼'}</span>
                </button>
              </div>
            </div>

            {/* 🌸 ZENITH TIME-OF-DAY CHIBI GREETING */}
            {showChibiGreeting && currentUser && (
              <div className="glass-card rounded-3xl p-5 border border-amber-500/10 relative overflow-hidden flex gap-4 items-center animate-slideDown select-none">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setShowChibiGreeting(false)}
                  className="absolute top-3.5 right-3.5 text-slate-500 hover:text-slate-355 transition w-6 h-6 rounded-full bg-slate-950/40 border border-white/5 flex items-center justify-center cursor-pointer"
                >
                  <X size={12} />
                </button>

                {/* Avatar / Chibi character face */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 p-[1.5px] shrink-0 relative animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <span className="text-3xl">
                      {voiceCharacter === 'mahiru' ? '🌸' : voiceCharacter === 'umi' ? '🌊' : voiceCharacter === 'nagisa' ? '🦊' : '🎓'}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 border-2 border-slate-950 w-4 h-4 rounded-full animate-pulse" />
                </div>

                <div className="flex-1 space-y-1 pr-6 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-300 font-extrabold uppercase tracking-widest">
                      {voiceCharacter === 'mahiru' ? 'Shina Mahiru' : voiceCharacter === 'umi' ? 'Asanagi Umi' : voiceCharacter === 'nagisa' ? 'Kubo Nagisa' : 'Sensei AI'}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">Aktif</span>
                  </div>
                  
                  {(() => {
                    const hour = new Date().getHours();
                    const greet = getChibiGreeting(voiceCharacter, hour);
                    return (
                      <>
                        <h4 className="text-sm font-black text-white font-serif leading-tight mt-1">{greet.jp}</h4>
                        <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{greet.rom}</p>
                        <p className="text-[10.5px] font-semibold text-slate-350 leading-relaxed mt-1.5 italic bg-white/5 border border-white/5 rounded-xl px-3 py-1.5">{greet.id}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 📜 DAILY KOTOWAZA (JAPANESE PROVERB) */}
            {(() => {
              const dailyIndex = new Date().getDate() % KOTOWAZA_LIST.length;
              const item = KOTOWAZA_LIST[dailyIndex];
              
              return (
                <div className="glass-card rounded-3xl p-5 border border-amber-500/10 flex flex-col justify-between min-h-[170px] relative overflow-hidden group">
                  <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none text-8xl font-serif text-amber-500 font-bold select-none">
                    語
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest mb-0.5">Peribahasa Hari Ini (ことわざ)</p>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">Diperbarui Harian</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          playAudio(item.jp);
                          triggerToast('Memutar audio peribahasa...', 'success');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[9px] uppercase tracking-wider hover:brightness-110 active:scale-95 duration-150 cursor-pointer shadow-md select-none"
                      >
                        <span>🔊</span> Dengar Sensei
                      </button>
                    </div>

                    <div className="space-y-2.5 text-left">
                      <h3 className="text-2xl font-serif font-black text-white tracking-wide">{item.jp}</h3>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 font-mono">{item.rom}</p>
                        <p className="text-[11px] font-semibold text-slate-200 italic leading-relaxed">"{item.id}"</p>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">{item.desc}</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/5 pt-3">
                    <button
                      type="button"
                      onClick={() => setGrammarExpanded(!grammarExpanded)}
                      className="text-[9px] font-black text-amber-400 uppercase tracking-wider hover:text-amber-300 transition duration-150 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{grammarExpanded ? '▼' : '▶'}</span> Bedah Tata Bahasa
                    </button>
                    
                    {grammarExpanded && (
                      <div className="mt-2.5 bg-slate-950/60 border border-violet-950 rounded-2xl p-3 text-[10px] font-bold text-slate-350 leading-relaxed animate-fadeIn">
                        {item.grammar}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* Bento Mastery Progress Glass Card */}
            <div className="glass-card rounded-3xl p-5 flex flex-col justify-between min-h-[200px] relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Mastery Progress</p>
                    <h2 className="text-xl font-extrabold gold-gradient-text">Level {levelDetails.level} ({levelDetails.rank})</h2>
                  </div>
                  <div className="bg-white/10 px-3.5 py-1 rounded-full border border-white/20 backdrop-blur-sm">
                    <span className="text-[10px] text-amber-300 font-extrabold">JLPT Target</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between text-xs font-bold text-slate-300">
                    <span>Target Kelulusan</span>
                    <span className="gold-gradient-text font-mono">{Math.min(100, Math.round((levelDetails.progressToNext / levelDetails.neededToNext) * 100))}%</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-[1px] border border-white/10">
                    <div 
                      className="h-full progress-gradient rounded-full shadow-[0_0_12px_rgba(217,119,6,0.4)] transition-all duration-1000" 
                      style={{ width: `${(levelDetails.progressToNext / levelDetails.neededToNext) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 font-mono text-right">{levelDetails.progressToNext} / {levelDetails.neededToNext} XP</p>
                </div>
              </div>
              <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Daily & Streak Bento Column */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-4 flex items-center gap-3.5 transition hover:bg-white/5 select-none duration-250 cursor-default">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                  <span className="text-lg">🔥</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Streak Hari</p>
                  <p className="text-sm font-black gold-gradient-text flex items-center gap-1">
                    {streakKuis} Hari
                  </p>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-4 flex items-center gap-3.5 transition hover:bg-white/5 select-none duration-250 cursor-default">
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500">
                  <span className="text-lg">⭐</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total XP</p>
                  <p className="text-sm font-black text-slate-100 font-mono">{localXp.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Hadiah Bento Box Card */}
            <div className={`glass-card rounded-3xl p-5 relative overflow-hidden transition-all duration-300 ${isBentoClaimedToday ? 'border-white/5 bg-white/[0.02]' : 'border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/10 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer'}`}
              onClick={handleClaimDailyBento}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-pink-500/0 pointer-events-none"></div>
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-xl transition-transform duration-500 ${isBentoClaimedToday ? 'bg-slate-900 border border-slate-800 opacity-60 scale-95' : 'bg-gradient-to-tr from-amber-400 to-amber-600 border border-amber-300/40 animate-pulse scale-100 hover:rotate-6'}`}>
                    🍱
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400 block mb-1">Hadiah Harian Bento</span>
                    <h4 className="text-sm font-black text-white leading-tight">
                      {isBentoClaimedToday ? 'Daily Bento Sudah Diambil!' : 'Daily Bento Box Siap Diklaim!'}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      {isBentoClaimedToday ? 'Kembali lagi besok untuk bento lezat berikutnya!' : 'Dapatkan +50 Poin & +75 XP gratis dari Sensei!'}
                    </p>
                  </div>
                </div>
                <div>
                  {isBentoClaimedToday ? (
                    <div className="bg-slate-900/60 border border-slate-850 px-3.5 py-2 rounded-2xl flex items-center gap-1">
                      <span className="text-xs">✅</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Sudah</span>
                    </div>
                  ) : (
                    <button type="button" className="bg-gradient-to-r from-amber-400 to-amber-600 border border-amber-300 text-slate-950 font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-2xl hover:brightness-110 active:scale-95 transition duration-150 cursor-pointer shadow-lg shadow-amber-500/20">
                      Buka Bento 🍱
                    </button>
                  )}
                </div>
              </div>
              {!isBentoClaimedToday && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
              )}
            </div>

            {/* Jalur Belajar Section */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>⛩️</span>
                Jalur Belajar
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                {/* Path 1: Vocabulary & Kana Practice */}
                <div 
                  onClick={() => {
                    setLevelFilter('hiragana');
                    setQuizMode('mc4');
                    setPracticeActive(false);
                    setActiveTab('practice');
                  }}
                  className="group glass-card rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition duration-250 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 font-jp text-xl font-bold">
                      あ
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Latihan Aksara Kana</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Hiragana & Katakana Dasar</p>
                    </div>
                  </div>
                  <span className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition duration-200">➔</span>
                </div>

                {/* Path 2: JLPT Preparation */}
                <div 
                  onClick={() => {
                    setLevelFilter('n5');
                    setQuizMode('ai');
                    setPracticeActive(false);
                    setActiveTab('practice');
                  }}
                  className="group glass-card rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition duration-250 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 font-jp text-xl font-bold">
                      学
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Persiapan JLPT N5 - N1</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Soal Pintar AI & Kuis Mandiri</p>
                    </div>
                  </div>
                  <span className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition duration-200">➔</span>
                </div>
              </div>
            </div>

            {/* Word of the Day (WOTD) */}
            {(() => {
              const dailyIdx = getDailyIndex(dailyWordsList.length);
              const dailyEntry = dailyWordsList[dailyIdx];
              if (!dailyEntry) return null;
              const { item, category, level } = dailyEntry;
              return (
                <div className="space-y-3.5">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>每天 (Karakter Hari Ini)</span>
                    <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase">
                      {level} • {category}
                    </span>
                  </h3>
                  <div 
                    onClick={() => playAudio(item.char)}
                    className="glass-card rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.06] transition duration-250 shadow-lg group relative overflow-hidden active:scale-[0.98]"
                  >
                    <div className="w-14 h-14 bg-gradient-to-tr from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-2xl font-black text-slate-950 shadow-xl group-hover:scale-105 transition duration-300 font-jp shrink-0">
                      {item.char}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black gold-gradient-text uppercase tracking-wider">{item.ro}</h3>
                      <p className="text-xs text-slate-300 font-medium truncate">{item.mean}</p>
                      <p className="text-[9px] font-bold text-amber-400 mt-1 flex items-center gap-1 animate-pulse">
                        🔊 KETUK UNTUK AUDIO SENSEI
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 💬 ZENITH HOMEPAGE LIVE CHAT ROOM */}
            <div className="glass-card rounded-3xl p-5 border border-amber-500/10 flex flex-col gap-4 relative overflow-hidden select-none">
              <div className="absolute right-4 top-4 opacity-5 pointer-events-none text-7xl font-serif text-amber-500 font-bold select-none">
                信
              </div>
              
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute shrink-0" />
                  <div className="ml-1">
                    <p className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest mb-0.5">Zenith Live Chat</p>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">Obrolan Antar Pelajar</span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    fetchLiveChatMessages(false);
                    triggerToast('Memperbarui obrolan...', 'success');
                  }}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition duration-150 cursor-pointer active:scale-95 flex items-center justify-center"
                  title="Refresh Chat"
                >
                  <RefreshCw size={12} className={liveChatLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Scrollable Message Box */}
              <div 
                id="live-chat-scrollbox"
                className="max-h-[250px] overflow-y-auto space-y-3 pr-1.5 scrollbar-hide py-1 text-left"
                style={{ scrollBehavior: 'smooth' }}
              >
                {liveChatMessages.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <span className="text-3xl animate-bounce block">🌸</span>
                    <p className="text-[10.5px] font-bold text-slate-450 max-w-[220px] mx-auto leading-relaxed">
                      Belum ada obrolan di sini. Yuk, sapa teman-teman pelajarmu sekarang!
                    </p>
                  </div>
                ) : (
                  liveChatMessages.map((msg) => {
                    const isMsgDev = msg.role === 'dev' || 
                                     (msg.username || '').toLowerCase() === 'admin baik' || 
                                     (msg.username || '').toLowerCase().includes('adminbaik');
                    const isOwnMsg = msg.uid === currentUser?.uid;

                    return (
                      <div 
                        key={msg.id} 
                        className={`flex items-start gap-2.5 p-2 rounded-2xl transition-all border ${
                          isMsgDev 
                            ? 'bg-amber-500/[0.03] border-amber-500/10' 
                            : isOwnMsg 
                              ? 'bg-blue-600/[0.04] border-blue-500/10' 
                              : 'bg-white/[0.01] border-white/5'
                        }`}
                      >
                        <img 
                          src={msg.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.displayName || msg.username)}&background=7c3aed&color=fff`} 
                          alt="user avatar"
                          className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0 bg-slate-900"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-black tracking-wide truncate max-w-[120px] ${
                              isMsgDev ? 'gold-gradient-text' : isOwnMsg ? 'text-blue-400' : 'text-slate-200'
                            }`}>
                              {msg.displayName || msg.username}
                            </span>
                            
                            {isMsgDev && (
                              <span className="dev-rgb-badge px-1 py-0.2 rounded text-[6px] font-extrabold uppercase text-slate-950 scale-90 tracking-wide animate-pulse">DEV</span>
                            )}
                            
                            <span className="text-[7.5px] font-bold text-slate-500 font-mono ml-auto shrink-0">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <p className="text-[10.5px] font-semibold text-slate-350 leading-relaxed break-words whitespace-pre-wrap mt-0.5 pr-2">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendLiveChatMessage} className="flex gap-2 items-center border-t border-white/5 pt-3 relative">
                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div className="absolute bottom-16 left-4 z-50 bg-slate-950 border border-white/10 rounded-2xl p-3 shadow-2xl grid grid-cols-7 gap-2 max-w-[260px] animate-fadeIn">
                    {['🌸', '🌊', '🎓', '🦊', '👍', '❤️', '😂', '🎉', '👏', '🔥', '✨', '🎌', '🇯🇵', '😢'].map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => {
                          setLiveChatInput(prev => prev + em);
                          setShowEmojiPicker(false);
                        }}
                        className="text-lg hover:scale-125 transition duration-150 cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                {/* Hidden File Input for Base64 Compress upload */}
                <input 
                  type="file"
                  id="chat-photo-input"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const MAX_WIDTH = 400;
                          let width = img.width;
                          let height = img.height;
                          
                          if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                          }
                          
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx?.drawImage(img, 0, 0, width, height);
                          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                          setChatAttachedImage(compressedBase64);
                          triggerToast('Foto berhasil ditambahkan!', 'success');
                        };
                        img.src = event.target?.result as string;
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />

                {/* Photo attachment preview */}
                {chatAttachedImage && (
                  <div className="absolute bottom-16 left-4 right-4 z-50 bg-slate-950/90 border border-amber-500/20 rounded-2xl p-2.5 flex items-center justify-between shadow-2xl animate-slideUp">
                    <div className="flex items-center gap-3">
                      <img src={chatAttachedImage} alt="preview" className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10" />
                      <span className="text-[10px] font-bold text-slate-400">Lampiran foto siap dikirim</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setChatAttachedImage(null)}
                      className="text-xs font-black text-rose-400 hover:text-rose-300 pr-1.5 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!currentUser}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-10 h-10 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center text-sm cursor-pointer hover:bg-white/5 active:scale-95 duration-100 disabled:opacity-40 shrink-0"
                  title="Pilih Emoji"
                >
                  🌸
                </button>

                <button
                  type="button"
                  disabled={!currentUser}
                  onClick={() => document.getElementById('chat-photo-input')?.click()}
                  className="w-10 h-10 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center text-sm cursor-pointer hover:bg-white/5 active:scale-95 duration-100 disabled:opacity-40 shrink-0"
                  title="Kirim Foto"
                >
                  📷
                </button>

                <input
                  type="text"
                  value={liveChatInput}
                  onChange={e => setLiveChatInput(e.target.value)}
                  placeholder={currentUser ? "Tulis sesuatu di sini..." : "Silakan login untuk mengobrol..."}
                  disabled={!currentUser || liveChatSending}
                  maxLength={250}
                  className="flex-1 bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/40 font-semibold"
                />
                
                <button
                  type="submit"
                  disabled={!currentUser || (!liveChatInput.trim() && !chatAttachedImage) || liveChatSending}
                  className="w-10 h-10 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 border border-amber-300/40 text-slate-950 flex items-center justify-center text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 duration-150 cursor-pointer disabled:opacity-40 disabled:scale-100 disabled:shadow-none shrink-0"
                >
                  {liveChatSending ? '⏳' : '✈️'}
                </button>
              </form>
              
              {currentUser && (
                <div className="flex justify-between items-center px-1 text-[8.5px] font-bold text-slate-500 font-mono">
                  <span>Maks 250 Karakter</span>
                  <span className={liveChatInput.length > 220 ? 'text-amber-500 font-black' : ''}>
                    {liveChatInput.length}/250
                  </span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ==========================================
            VIEW: PRACTICE MODES HUB
        ========================================== */}
        {activeTab === 'practice' && (
          <div className="space-y-6 animate-fadeIn pb-36 z-10 relative">
            
            {!practiceActive ? (
              // Practice menu grid
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-white mb-2">Mode Latihan</h2>
                  <p className="text-slate-400 text-xs">Pilih cara belajarmu hari ini untuk mencapai puncak kefasihan.</p>
                </div>

                <div className="flex flex-col gap-4">
                  {/* flashcard */}
                  <div 
                    onClick={() => {
                      setQuizMode('flashcard');
                      initQuizSession(levelFilter, 'flashcard');
                      setPracticeActive(true);
                    }}
                    className="group glass-card rounded-2xl p-5 hover:bg-white/[0.06] hover:border-amber-400/40 transition duration-300 cursor-pointer active:scale-[0.98] flex gap-4 items-start"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <span className="text-lg">🃏</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-black text-white">Flashcards</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Review kosakata harian dengan sistem kartu hafalan cepat.</p>
                      <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                        <span>Mode: Flashcard</span>
                        <span className="text-amber-400 group-hover:translate-x-1 transition duration-200">➔</span>
                      </div>
                    </div>
                  </div>

                  {/* listening / AI Quiz */}
                  <div 
                    onClick={() => {
                      setQuizMode('ai');
                      initQuizSession(levelFilter, 'ai');
                      setPracticeActive(true);
                      triggerAiQuestion(levelFilter);
                    }}
                    className="group glass-card rounded-2xl p-5 hover:bg-white/[0.06] hover:border-pink-500/40 transition duration-300 cursor-pointer active:scale-[0.98] flex gap-4 items-start"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                      <span className="text-lg">🤖</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-black text-white">Sensei AI Smart Quiz</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Kuis dinamis berbasis kecerdasan buatan Gemini AI dengan penjelasan instan.</p>
                      <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                        <span>Mode: AI Generator</span>
                        <span className="text-pink-400 group-hover:translate-x-1 transition duration-200">➔</span>
                      </div>
                    </div>
                  </div>

                  {/* traditional quiz */}
                  <div 
                    onClick={() => {
                      setQuizMode('mc4');
                      initQuizSession(levelFilter, 'mc4');
                      setPracticeActive(true);
                    }}
                    className="group glass-card rounded-2xl p-5 hover:bg-white/[0.06] hover:border-blue-500/40 transition duration-300 cursor-pointer active:scale-[0.98] flex gap-4 items-start"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <span className="text-lg">🎯</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-black text-white">Kuis Pilihan Ganda</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Latihan kuis mandiri dengan opsi pilihan ganda interaktif.</p>
                      <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                        <span>Mode: Multiple Choice</span>
                        <span className="text-blue-400 group-hover:translate-x-1 transition duration-200">➔</span>
                      </div>
                    </div>
                  </div>

                  {/* mock test / JLPT */}
                  <div 
                    onClick={() => setShowJlptModal(true)}
                    className="group glass-card rounded-2xl p-5 hover:bg-white/[0.06] hover:border-violet-500/40 transition duration-300 cursor-pointer active:scale-[0.98] flex gap-4 items-start"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                      <span className="text-lg">🎓</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-black text-white">Simulasi Ujian JLPT</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Simulasi ujian resmi JLPT (N5 - N1) berbatas waktu dengan deteksi deduksi nilai.</p>
                      <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                        <span>Mode: Official Exam</span>
                        <span className="text-violet-400 group-hover:translate-x-1 transition duration-200">➔</span>
                      </div>
                    </div>
                  </div>

                  {/* writing practice */}
                  <div 
                    onClick={() => {
                      setActiveTab('kamus'); // Switches directly to the learn grid with the Papan Tulis Tangan open at the top!
                      triggerToast('Gunakan Papan Tulis Jari di bagian atas untuk menulis!', 'success');
                    }}
                    className="group glass-card rounded-2xl p-5 hover:bg-white/[0.06] hover:border-emerald-500/40 transition duration-300 cursor-pointer active:scale-[0.98] flex gap-4 items-start"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <span className="text-lg">✍️</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-black text-white">Latihan Menulis Kanji</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">Kuasai urutan goresan (stroke order) Hiragana & Katakana di Papan Tulis Jari.</p>
                      <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                        <span>Mode: Handwriting Grid</span>
                        <span className="text-emerald-400 group-hover:translate-x-1 transition duration-200">➔</span>
                      </div>
                    </div>
                  </div>

                  {/* 🇯🇵 INTERACTIVE AUDIO KANA SOUNDBOARD */}
                  <div className="glass-card rounded-3xl p-5 space-y-4 border border-amber-500/10">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                          <span>⛩️</span> Interactive Kana Soundboard
                        </h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Latihan Pelafalan Huruf Jepang</p>
                      </div>
                      
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setSoundboardMode('hiragana')}
                          className={`px-3 py-1 text-[9px] font-black rounded-lg transition duration-200 cursor-pointer ${soundboardMode === 'hiragana' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                          Hiragana
                        </button>
                        <button
                          type="button"
                          onClick={() => setSoundboardMode('katakana')}
                          className={`px-3 py-1 text-[9px] font-black rounded-lg transition duration-200 cursor-pointer ${soundboardMode === 'katakana' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                          Katakana
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {KANA_GRID.map((item, idx) => {
                        if (!item.r) {
                          return <div key={`empty-${idx}`} className="opacity-0 pointer-events-none" />;
                        }
                        
                        const char = soundboardMode === 'hiragana' ? item.h : item.k;
                        
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              playAudio(char);
                              triggerToast(`Melafalkan: ${char} (${item.r})`, 'success');
                            }}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/40 border border-violet-950/60 hover:border-amber-500/40 hover:bg-violet-950/10 active:scale-90 transition duration-200 cursor-pointer select-none group min-h-[58px]"
                          >
                            <span className="text-base font-black text-white group-hover:text-amber-300 font-serif duration-200">{char}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-mono">{item.r}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              // Quiz Active Card Board View
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => setPracticeActive(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-xs font-bold cursor-pointer hover:bg-white/10 transition active:scale-95 duration-150"
                  >
                    🚪 Keluar Latihan
                  </button>

                  <div className="flex gap-2">
                    {/* Allow toggling modes directly in training */}
                    {['mc4', 'essay', 'terbalik', 'flashcard'].map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          setQuizMode(m as any);
                          initQuizSession(levelFilter, m as any);
                        }}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase transition duration-150 ${
                          quizMode === m
                            ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-md'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        {m === 'mc4' ? 'Pili' : m === 'terbalik' ? 'Balik' : m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level Filter Tabs inside active quiz */}
                <div className="space-y-2">
                  <h2 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Tingkatan Materi</h2>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 font-bold scrollbar-none">
                    {['hiragana', 'katakana', 'n5', 'n4', 'n3', 'n2', 'n1'].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => {
                          setLevelFilter(lvl);
                          initQuizSession(lvl, quizMode);
                          if (quizMode === 'ai') {
                            triggerAiQuestion(lvl);
                          }
                        }}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-[10px] transition duration-200 border uppercase ${
                          levelFilter === lvl
                            ? 'bg-[#d97706] border-[#fde68a] text-white shadow-lg'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Quiz Card Board Container */}
                <div className="glass-card border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center">
                  
                  {/* Card Watermark */}
                  <div className="absolute top-4 left-4 text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10 select-none">
                    {quizMode === 'ai' ? 'AI Smart Question' : `${quizIndex + 1} / ${quizPool.length}`}
                  </div>

                  <div className="absolute top-4 right-4 text-[10px] font-bold text-emerald-400">
                    Correct: {scoreBenar}
                  </div>

                  {/* Dynamic Sound Action trigger */}
                  {quizMode !== 'ai' && quizPool[quizIndex] && (
                    <button 
                      onClick={() => playAudio(quizPool[quizIndex].char)}
                      className="absolute bottom-4 right-4 text-xs bg-white/10 hover:bg-white/20 border border-white/10 text-amber-300 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition active:scale-90"
                    >
                      🔊
                    </button>
                  )}

                  {/* Character display area */}
                  <div className="py-8 flex flex-col items-center justify-center min-h-[160px] w-full text-center">
                    {quizMode === 'ai' ? (
                      aiQuizLoading ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                          <RefreshCw size={24} className="animate-spin text-amber-400" />
                          <p className="text-xs font-bold text-slate-400">Sensei AI sedang men-generate soal kuis...</p>
                        </div>
                      ) : aiQuestion ? (
                        <div className="text-center space-y-4">
                          <div className="font-jp text-5xl font-black mb-1 text-white tracking-widest leading-normal">{aiQuestion.soal}</div>
                          <div className="text-xs font-bold text-amber-300 tracking-wider bg-amber-500/10 py-1 px-3.5 rounded-full border border-amber-500/20 inline-block">
                            {aiQuestion.tipe}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-bold">Tekan tombol di bawah untuk meminta soal AI.</p>
                      )
                    ) : (
                      quizIndex < quizPool.length && quizPool[quizIndex] ? (
                        <div className="text-center">
                          <div className="font-jp text-6xl font-black text-white leading-tight">
                            {quizMode === 'terbalik' ? quizPool[quizIndex].ro.split(',')[0] : quizPool[quizIndex].char}
                          </div>
                          {['n5','n4','n3','n2','n1'].includes(levelFilter) && quizMode !== 'terbalik' && (
                            <div className="text-xs font-bold text-amber-300 mt-2 font-mono">
                              Cara membaca: {quizPool[quizIndex].ro.split(',')[0]}
                            </div>
                          )}
                          {quizPool[quizIndex].mean && quizMode === 'terbalik' && (
                            <div className="text-[11px] font-bold text-amber-300 uppercase mt-2">{quizPool[quizIndex].mean}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center space-y-3 py-4">
                          <div className="text-4xl animate-bounce">🏆</div>
                          <h3 className="text-sm font-black gold-gradient-text">Kuis Selesai! (お疲れ様)</h3>
                          <p className="text-xs text-slate-300 font-bold">Jawaban benar: {scoreBenar} dari {quizPool.length} soal ({Math.round((scoreBenar / (quizPool.length || 1)) * 100)}%)</p>
                          <button 
                            onClick={() => initQuizSession(levelFilter, quizMode)}
                            className="gold-btn py-2 px-5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 mx-auto active:scale-95 duration-150 shadow-lg mt-4 text-slate-950"
                          >
                            🔄 Latihan Lagi
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {/* AI Mnemonics tip layer */}
                  {aiQuizFeedback && (
                    <div className="w-full mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed font-bold animate-fadeIn">
                      💡 Sensei AI: {aiQuizFeedback}
                    </div>
                  )}

                  {/* Navigation Action Buttons Grid depending on Modes */}
                  <div className="w-full mt-6">
                    
                    {/* 1. Multiple Choice (MC4) / Reverse Option rendering */}
                    {quizMode === 'mc4' && quizIndex < quizPool.length && (
                      <div className="grid grid-cols-2 gap-3.5 w-full">
                        {currentOptions.map((opt, oIdx) => {
                          const correctAns = quizPool[quizIndex];
                          const displayField = levelFilter.startsWith('n') ? (opt.mean || opt.ro) : opt.ro.split(',')[0];
                          const isSelected = selectedOption === opt.ro;
                          const hasSubmitted = isAnswerLocked;
                          const isCorrect = opt.ro === correctAns.ro;

                          let btnStyle = 'bg-white/5 border-white/10 hover:border-amber-400/40 text-slate-200';
                          if (hasSubmitted) {
                            if (isCorrect) {
                              btnStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-extrabold';
                            } else if (isSelected) {
                              btnStyle = 'bg-rose-500/10 border-rose-500 text-rose-400 font-extrabold';
                            } else {
                              btnStyle = 'bg-slate-900 border-white/5 opacity-40 text-slate-500';
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              disabled={isAnswerLocked}
                              onClick={() => registerAnswer(correctAns, opt.ro)}
                              className={`px-4 py-4 rounded-2xl text-[14px] font-bold text-center border capitalize transition duration-200 select-none cursor-pointer active:scale-95 ${btnStyle}`}
                            >
                              {displayField}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 2. Terbalik Option rendering */}
                    {quizMode === 'terbalik' && quizIndex < quizPool.length && (
                      <div className="grid grid-cols-2 gap-3.5 w-full">
                        {currentOptions.map((opt, oIdx) => {
                          const correctAns = quizPool[quizIndex];
                          const isSelected = selectedOption === opt.char;
                          const hasSubmitted = isAnswerLocked;
                          const isCorrect = opt.char === correctAns.char;

                          let btnStyle = 'bg-white/5 border-white/10 hover:border-amber-400/40 text-slate-200';
                          if (hasSubmitted) {
                            if (isCorrect) {
                              btnStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-extrabold';
                            } else if (isSelected) {
                              btnStyle = 'bg-rose-500/10 border-rose-500 text-rose-400 font-extrabold';
                            } else {
                              btnStyle = 'bg-slate-900 border-white/5 opacity-40 text-slate-500';
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              disabled={isAnswerLocked}
                              onClick={() => registerAnswer(correctAns, opt.char)}
                              className={`px-4 py-5 rounded-2xl text-lg font-black text-center border font-jp transition duration-200 select-none cursor-pointer active:scale-95 ${btnStyle}`}
                            >
                              {opt.char}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 3. Essay Interactive mode */}
                    {quizMode === 'essay' && quizIndex < quizPool.length && (
                      <div className="space-y-4 w-full">
                        <input
                          type="text"
                          disabled={isAnswerLocked}
                          value={essayInput}
                          onChange={e => setEssayInput(e.target.value)}
                          placeholder="Ketik Romaji atau arti bahasa Indonesia..."
                          onKeyDown={e => e.key === 'Enter' && submitEssayAnswer()}
                          className="w-full bg-slate-950/60 border border-white/10 px-4 py-3 rounded-2xl text-center font-bold text-xs outline-none focus:border-amber-400 transition shadow-inner text-slate-100 placeholder:text-slate-500"
                        />
                        
                        {essayStatus && (
                          <div className={`text-center py-2 px-4 rounded-xl text-xs font-bold ${essayStatus === 'correct' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {essayStatus === 'correct' ? '✓ Jawaban Tepat!' : `✗ Kurang Pas! Jawaban: ${essayCorrectAns}`}
                          </div>
                        )}

                        <button
                          disabled={isAnswerLocked || !essayInput}
                          onClick={submitEssayAnswer}
                          className="w-full gold-btn py-3 rounded-2xl text-xs font-extrabold text-slate-950 cursor-pointer shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50 min-h-[44px]"
                        >
                          Kirim Jawaban
                        </button>
                      </div>
                    )}

                    {/* 4. Flashcard Flipping mode */}
                    {quizMode === 'flashcard' && quizIndex < quizPool.length && quizPool[quizIndex] && (
                      <div className="space-y-4 w-full">
                        <div 
                          onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                          className="w-full h-36 bg-slate-900 rounded-2xl border border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-amber-400/20 transition relative p-4"
                        >
                          {!flashcardFlipped ? (
                            <div className="text-center">
                              <div className="font-jp text-4xl font-black text-white">{quizPool[quizIndex].char}</div>
                              <span className="text-[9px] text-slate-500 font-bold mt-2 inline-block">KETUK UNTUK MEMBALIK</span>
                            </div>
                          ) : (
                            <div className="text-center font-bold">
                              <div className="text-lg text-amber-300 uppercase">{quizPool[quizIndex].ro}</div>
                              {quizPool[quizIndex].mean && (
                                <div className="text-xs text-slate-300 mt-1 capitalize">{quizPool[quizIndex].mean}</div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full">
                          <button
                            onClick={() => submitFlashcardScore(false)}
                            className="bg-rose-500/10 border border-rose-500/30 text-rose-400 py-2.5 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition cursor-pointer select-none active:scale-95"
                          >
                            ✗ Ulang Nanti
                          </button>
                          <button
                            onClick={() => submitFlashcardScore(true)}
                            className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition cursor-pointer select-none active:scale-95"
                          >
                            ✓ Sudah Hafal!
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 5. Gemini AI Quiz Options rendering */}
                    {quizMode === 'ai' && aiQuestion && !aiQuizLoading && (
                      <div className="space-y-4 w-full">
                        <div className="grid grid-cols-2 gap-3">
                          {aiQuestion.pilihan.map((opt, oIdx) => {
                            let btnStyle = "bg-white/5 border-white/10 hover:border-amber-400/40 text-slate-200";
                            if (aiQuizAnswered) {
                              if (opt === aiQuestion.jawaban_benar) {
                                btnStyle = "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-extrabold";
                              } else {
                                btnStyle = "bg-slate-900 border-white/5 opacity-30 text-slate-500";
                              }
                            }

                            return (
                              <button
                                key={oIdx}
                                disabled={aiQuizAnswered}
                                onClick={() => handleAiQuizAnswer(opt)}
                                className={`px-3 py-3 rounded-xl border text-xs font-bold text-center transition active:scale-95 ${btnStyle}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {aiQuizAnswered && (
                          <button
                            onClick={() => triggerAiQuestion(levelFilter)}
                            className="w-full gold-btn py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 mt-2.5 cursor-pointer shadow-lg active:scale-95 duration-150 text-slate-950"
                          >
                            <Sparkles size={12} />
                            Generate Soal AI Selanjutnya
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ==========================================
            VIEW: KAMUS / DICTIONARY & CANVAS
        ========================================== */}
        {activeTab === 'kamus' && (
          <div className="space-y-6 animate-fadeIn pb-36">
            
            {/* Handwriting practice section */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">Papan Tulis Jari (練習)</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Target: {dictionaryDetailEntry?.char || quizPool[quizIndex]?.char || 'あ'}</span>
                  <button 
                    onClick={clearHandwritingCanvas}
                    className="flex items-center gap-0.5 text-slate-400 hover:text-slate-200 text-[10px] font-bold bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-violet-900/20"
                  >
                    <Eraser size={11} />
                    Hapus
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-violet-900/40 rounded-3xl p-4 flex flex-col items-center shadow-lg">
                <div className="text-[10px] font-semibold text-slate-500 mb-2.5">Gunakan jari/kursor Anda untuk menulis karakter Jepang di bawah:</div>
                
                {(() => {
                  const targetChar = dictionaryDetailEntry?.char || quizPool[quizIndex]?.char || 'あ';
                  const targetStrokes = getStrokeCount(targetChar);
                  const progressPercentage = Math.min((completedStrokes / targetStrokes) * 100, 100);
                  
                  return (
                    <div className="relative w-[310px] h-[220px] select-none overflow-hidden rounded-2xl border border-dashed border-violet-900/60 shadow-[0_4px_24px_rgba(124,58,237,0.02)]">
                      {/* Interactive Canvas */}
                      <canvas
                        ref={canvasRef}
                        width={310}
                        height={220}
                        onMouseDown={handleCanvasStart}
                        onMouseMove={handleCanvasDraw}
                        onMouseUp={handleCanvasEnd}
                        onMouseLeave={handleCanvasEnd}
                        onTouchStart={handleCanvasStart}
                        onTouchMove={handleCanvasDraw}
                        onTouchEnd={handleCanvasEnd}
                        className="bg-slate-900 cursor-crosshair touch-none w-full h-full relative z-10"
                      />

                      {/* Stroke Counter Overlay */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 pointer-events-none z-20 flex flex-col gap-1.5 select-none">
                        <div className="flex justify-between items-center bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-xl border border-violet-500/20 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black tracking-wider text-violet-300 font-mono uppercase">LATIHAN STROKE</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black font-mono transition-all duration-300 ${
                              completedStrokes === targetStrokes 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                                : completedStrokes > targetStrokes 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                            }`}>
                              {completedStrokes} / {targetStrokes}
                            </span>
                          </div>
                          
                          <div className="flex items-center">
                            {completedStrokes === targetStrokes ? (
                              <span className="text-[9px] font-extrabold text-emerald-400 flex items-center gap-1 animate-pulse">
                                ✨ Sempurna! (Perfect)
                              </span>
                            ) : completedStrokes > targetStrokes ? (
                              <span className="text-[9px] font-extrabold text-amber-400 flex items-center gap-1">
                                ⚠️ Berlebih ({completedStrokes - targetStrokes}) Coretan
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold text-slate-400">
                                Kurang {targetStrokes - completedStrokes} coretan
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Animated Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-950/90 rounded-full overflow-hidden border border-violet-950/20 shadow-inner">
                          <motion.div
                            className={`h-full rounded-full ${
                              completedStrokes === targetStrokes
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                : completedStrokes > targetStrokes
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                : 'bg-gradient-to-r from-violet-600 via-pink-500 to-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.5)]'
                            }`}
                            animate={{
                              width: `${progressPercentage}%`
                            }}
                            transition={{ type: "spring", stiffness: 120, damping: 15 }}
                          />
                        </div>
                      </div>

                      {/* Character Watermark Guide */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                        <span className="text-[120px] font-black text-slate-400/[0.05] font-sans transition-all duration-300">
                          {targetChar}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Dictionary section */}
            <div className="space-y-4">
              <h2 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">Kamus Bahasa Jepang (辞書)</h2>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input
                    type="text"
                    value={dictionarySearch}
                    onChange={e => {
                      setDictionarySearch(e.target.value);
                      setDictionaryDetailEntry(null);
                    }}
                    placeholder="Cari romaji, arti, kanji..."
                    className="w-full bg-slate-950/60 border border-violet-900/40 pl-9.5 pr-4 py-3 rounded-2xl text-xs font-bold outline-none focus:border-violet-500 transition"
                  />
                </div>
              </div>

              {/* Dictionary categories tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 font-bold scrollbar-none">
                <button
                  onClick={() => {
                    setDictionaryFilter('all');
                    setDictionaryDetailEntry(null);
                  }}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[10px] border cursor-pointer hover:bg-slate-900 transition-all ${
                    dictionaryFilter === 'all'
                      ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white border-transparent'
                      : 'bg-slate-950/40 border-violet-900/20 text-slate-400'
                  }`}
                >
                  Semua
                </button>
                {['hiragana', 'katakana', 'n5', 'n4', 'n3', 'n2', 'n1'].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setDictionaryFilter(lvl);
                      setDictionaryDetailEntry(null);
                    }}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[10px] border cursor-pointer hover:bg-slate-900 transition-all ${
                      dictionaryFilter === lvl
                        ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white border-transparent'
                        : 'bg-slate-950/40 border-violet-900/20 text-slate-400'
                    }`}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Character Details view */}
              {dictionaryDetailEntry ? (
                <div className="bg-gradient-to-br from-slate-950/80 to-violet-950/40 border border-violet-900/40 rounded-3xl p-5 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-3.5 py-1 rounded-full uppercase">
                      {dictionaryDetailEntry.level}
                    </span>
                    <button 
                      onClick={() => setDictionaryDetailEntry(null)}
                      className="text-slate-500 hover:text-slate-300 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="text-center py-4">
                    <div className="font-jp text-6xl font-black text-white">{dictionaryDetailEntry.char}</div>
                    <div className="text-lg font-bold text-violet-400 mt-2 uppercase">{dictionaryDetailEntry.ro}</div>
                    {dictionaryDetailEntry.mean && (
                      <div className="text-xs bg-slate-900/80 text-slate-300 py-1.5 px-4 rounded-xl inline-block mt-2 border border-violet-950 capitalize font-medium">
                        {dictionaryDetailEntry.mean}
                      </div>
                    )}
                  </div>

                  {/* Examples Sentence List */}
                  {dictionaryDetailEntry.ex && dictionaryDetailEntry.ex.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Contoh Kalimat:</span>
                      {dictionaryDetailEntry.ex.map((e, idx) => (
                        <div key={idx} className="bg-slate-950/40 border border-violet-950 p-3 rounded-xl space-y-1">
                          <p className="font-jp text-sm text-white font-semibold">{e.jp}</p>
                          <p className="text-[11px] font-semibold text-pink-400 tracking-wide">{e.rom}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{e.id}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3.5 mt-2">
                    <button
                      onClick={() => playAudio(dictionaryDetailEntry.char)}
                      className="bg-violet-950 text-violet-300 border border-violet-800/40 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-900 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Volume2 size={12} />
                      Dengar Suara
                    </button>
                    <button
                      onClick={() => {
                        setDictionaryDetailEntry(null);
                      }}
                      className="bg-slate-900 border border-violet-900/30 text-slate-400 py-2.5 rounded-xl text-xs font-bold hover:text-slate-200 transition"
                    >
                      Kembali
                    </button>
                  </div>
                </div>
              ) : (
                <motion.div
                  key={`${dictionaryFilter}-${dictionarySearch}`}
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.02
                      }
                    }
                  }}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1"
                >
                  {filteredDictionary.length > 0 ? (
                    filteredDictionary.slice(0, dictionaryLimit).map((entry, idx) => (
                      <motion.div
                        key={`${entry.char}-${entry.type}-${idx}`}
                        variants={{
                          hidden: { opacity: 0, y: 10, scale: 0.95 },
                          show: { 
                            opacity: 1, 
                            y: 0, 
                            scale: 1,
                            transition: { type: "spring", stiffness: 200, damping: 15 } 
                          }
                        }}
                        whileHover={{ scale: 1.04, borderColor: "rgba(139, 92, 246, 0.4)" }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setDictionaryDetailEntry(entry);
                          updateDailyQuestProgress('read_materi', 1);
                        }}
                        className="bg-slate-950/40 border border-violet-900/30 p-3 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer select-none shadow-md"
                      >
                        <div className="font-jp text-2xl font-black text-white">{entry.char}</div>
                        <div className="text-[10px] font-black tracking-wide text-pink-400 uppercase mt-1 truncate max-w-full">
                          {entry.ro.split(',')[0]}
                        </div>
                        <div className="text-[9px] font-semibold text-slate-400 mt-1 truncate max-w-full leading-tight">
                          {entry.mean || (entry.type.startsWith('hira') ? 'Hiragana' : 'Katakana')}
                        </div>
                        <div className="text-[8px] font-extrabold text-violet-500/80 uppercase tracking-widest mt-0.5">
                          {entry.level}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-8 text-xs font-semibold text-slate-500">
                      Kosa kata tidak ditemukan 🔍
                    </div>
                  )}

                  {filteredDictionary.length > dictionaryLimit && (
                    <div className="col-span-3 pt-2">
                      <button
                        onClick={() => setDictionaryLimit(prev => prev + 48)}
                        className="w-full bg-violet-900/20 text-pink-400 hover:bg-violet-900/40 border border-violet-900/30 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        Tampilkan Lebih Banyak (+48)
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

          </div>
        )}

        {/* ==========================================
            VIEW: RANKING / LEADERBOARD PODIUM
        ========================================== */}
        {activeTab === 'ranking' && (
          <div className="space-y-6 animate-fadeIn pb-36">
            <h2 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">Papan Peringkat (RANKING TOP 50)</h2>

            {/* Simulated 3D Podium Graphic */}
            <div className="flex items-end justify-center gap-2 mt-4 select-none">
              
              {/* Rank 2 (Left) */}
              {leaderboardList[1] && (
                <div className="flex flex-col items-center w-28 text-center">
                  <img
                    src={leaderboardList[1].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboardList[1].displayName)}&background=1e293b&color=94a3b8`}
                    alt="rank2"
                    className="w-10 h-10 rounded-full border border-slate-400 object-cover shadow-lg bg-slate-950 font-jp"
                  />
                  <span className="text-[10px] font-extrabold text-slate-200 mt-1.5 truncate max-w-[90px] flex items-center justify-center gap-1">
                    {leaderboardList[1].displayName}
                    {(leaderboardList[1].role === 'dev' || leaderboardList[1].username.toLowerCase() === 'admin baik' || leaderboardList[1].username.toLowerCase().includes('adminbaik')) && (
                      <span className="dev-rgb-badge px-1 py-0.2 rounded text-[6px] font-extrabold text-slate-950 scale-90 tracking-wide">DEV</span>
                    )}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 truncate max-w-[90px]">@{leaderboardList[1].username}</span>
                  <span className="text-[8px] font-black text-violet-400 mt-0.5">Lvl {getLevelInfo(leaderboardList[1].xp || 0).level}</span>
                  <span className="text-[10px] font-extrabold font-mono text-slate-300">{leaderboardList[1].poin.toLocaleString()} PTS</span>
                  <div className="w-full h-14 bg-slate-900/50 border border-slate-700/40 rounded-t-xl mt-1.5 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-xl font-black text-slate-400 font-mono">2</span>
                  </div>
                </div>
              )}

              {/* Rank 1 (Center) */}
              {leaderboardList[0] && (
                <div className="flex flex-col items-center w-32 text-center">
                  <img
                    src={leaderboardList[0].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboardList[0].displayName)}&background=f59e0b&color=ff6b9d`}
                    alt="rank1"
                    className="w-13 h-13 rounded-full border-2 border-amber-400 object-cover shadow-xl shadow-amber-500/10 transform -translate-y-1 bg-slate-950 font-jp"
                  />
                  <span className="text-xs font-black text-white mt-1.5 truncate max-w-[110px] flex items-center justify-center gap-1">
                    {leaderboardList[0].displayName}
                    {(leaderboardList[0].role === 'dev' || leaderboardList[0].username.toLowerCase() === 'admin baik' || leaderboardList[0].username.toLowerCase().includes('adminbaik')) && (
                      <span className="dev-rgb-badge px-1 py-0.2 rounded text-[6px] font-extrabold text-slate-950 scale-90 tracking-wide">DEV</span>
                    )}
                  </span>
                  <span className="text-[9px] font-extrabold text-amber-500 truncate max-w-[110px]">@{leaderboardList[0].username}</span>
                  <span className="text-[9px] font-black text-violet-400 mt-0.5 animate-pulse">Lvl {getLevelInfo(leaderboardList[0].xp || 0).level}</span>
                  <span className="text-[10px] font-black font-mono text-amber-400">{leaderboardList[0].poin.toLocaleString()} PTS</span>
                  <div className="w-full h-18 bg-amber-500/10 border border-amber-500/30 rounded-t-2xl mt-1.5 flex flex-col items-center justify-center shadow-2xl relative">
                    <span className="absolute -top-3 text-sm animate-bounce">👑</span>
                    <span className="text-2xl font-black text-amber-400 font-mono">1</span>
                  </div>
                </div>
              )}

              {/* Rank 3 (Right) */}
              {leaderboardList[2] && (
                <div className="flex flex-col items-center w-28 text-center">
                  <img
                    src={leaderboardList[2].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(leaderboardList[2].displayName)}&background=7c2d12&color=b45309`}
                    alt="rank3"
                    className="w-10 h-10 rounded-full border border-orange-700 object-cover shadow-lg bg-slate-950 font-jp"
                  />
                  <span className="text-[10px] font-extrabold text-slate-200 mt-1.5 truncate max-w-[90px] flex items-center justify-center gap-1">
                    {leaderboardList[2].displayName}
                    {(leaderboardList[2].role === 'dev' || leaderboardList[2].username.toLowerCase() === 'admin baik' || leaderboardList[2].username.toLowerCase().includes('adminbaik')) && (
                      <span className="dev-rgb-badge px-1 py-0.2 rounded text-[6px] font-extrabold text-slate-950 scale-90 tracking-wide">DEV</span>
                    )}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 truncate max-w-[90px]">@{leaderboardList[2].username}</span>
                  <span className="text-[8px] font-black text-violet-400 mt-0.5">Lvl {getLevelInfo(leaderboardList[2].xp || 0).level}</span>
                  <span className="text-[10px] font-extrabold font-mono text-slate-300">{leaderboardList[2].poin.toLocaleString()} PTS</span>
                  <div className="w-full h-11 bg-slate-900/50 border border-orange-900/40 rounded-t-xl mt-1.5 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-lg font-black text-orange-600 font-mono">3</span>
                  </div>
                </div>
              )}

            </div>

            {/* Scrollable Leaderboard rows list */}
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {leaderboardLoading ? (
                <div className="flex justify-center items-center py-10 gap-2">
                  <RefreshCw size={16} className="animate-spin text-violet-400" />
                  <span className="text-xs text-slate-400 font-bold">Sinkronisasi skor klan...</span>
                </div>
              ) : leaderboardList.length > 0 ? (
                leaderboardList.slice(3).map((user, idx) => {
                  const rank = idx + 4;
                  const isMe = currentUser && currentUser.uid === user.uid;
                  return (
                    <div
                      key={user.uid}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition ${
                        isMe
                          ? 'bg-violet-900/30 border-violet-500 shadow-md'
                          : 'bg-slate-950/20 border-violet-900/20 hover:border-violet-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-5 text-center font-mono text-xs font-black text-slate-500">{rank}</span>
                        <img
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=020617&color=6d28d9`}
                          alt="avatar"
                          className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-950 font-jp"
                        />
                        <div className="truncate min-w-0">
                          <p className="text-xs font-black text-slate-200 truncate flex items-center gap-1.5">
                            {user.displayName}
                            {(user.role === 'dev' || user.username.toLowerCase() === 'admin baik' || user.username.toLowerCase().includes('adminbaik')) && (
                              <span className="dev-rgb-badge px-1.5 py-0.5 rounded text-[7px] font-extrabold uppercase text-slate-950 scale-90 tracking-wide animate-pulse">DEV</span>
                            )}
                          </p>
                          <p className="text-[9px] font-semibold text-slate-400 truncate">@{user.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 font-bold">
                        <div className="text-right">
                          <p className="text-[10px] font-extrabold text-violet-400 font-mono">Lvl {getLevelInfo(user.xp || 0).level}</p>
                          <p className="text-[8px] font-medium text-pink-400 font-mono">{(user.xp || 0).toLocaleString()} XP</p>
                        </div>
                        <div className="text-right min-w-[75px]">
                          <span className="font-mono text-xs font-black text-emerald-450">{(user.poin || 0).toLocaleString()}</span>
                          <span className="text-[8px] font-extrabold text-slate-500 uppercase ml-1">PTS</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 font-extrabold uppercase">Tidak ada peringkat yang terdeteksi secara offline.</div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            VIEW: PENCAPAIAN / ACHIEVEMENT
        ========================================== */}
        {activeTab === 'pencapaian' && (() => {
          const completedTodayQuestsCount = activeDailyQuests.filter(q => (dailyQuestProgress[q.id] || 0) >= q.target).length;
          const overallDailyPercentage = activeDailyQuests.length > 0 ? Math.round((completedTodayQuestsCount / activeDailyQuests.length) * 100) : 0;

          const startedQuestsCount = activeDailyQuests.filter(q => (dailyQuestProgress[q.id] || 0) > 0).length;
          const startedDailyPercentage = activeDailyQuests.length > 0 ? Math.round((startedQuestsCount / activeDailyQuests.length) * 100) : 0;

          return (
            <div className="space-y-4 animate-fadeIn pb-36 font-sans">
              <div>
                <h2 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">Misi & Statistik Belajar (任務)</h2>
                <p className="text-[11px] font-medium text-slate-500">Reset harian pada jam 06:00 AM. Selesaikan untuk hadiah Poin & XP fantastis!</p>
              </div>

              {/* Dual sub-tab switch */}
              <div className="flex bg-slate-950 p-1 rounded-2xl text-xs font-bold border border-violet-950/40">
                <button
                  onClick={() => setPencapaianSubTab('lencana')}
                  className={`flex-1 py-1.5 text-center rounded-xl transition-all duration-200 cursor-pointer ${pencapaianSubTab === 'lencana' ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  📅 Misi Harian ({completedTodayQuestsCount}/10 Selesai)
                </button>
                <button
                  onClick={() => setPencapaianSubTab('level')}
                  className={`flex-1 py-1.5 text-center rounded-xl transition-all duration-200 cursor-pointer ${pencapaianSubTab === 'level' ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  🎓 Tingkatan Level ({milestones.filter(m => levelDetails.level >= m.level).length}/{milestones.length})
                </button>
              </div>

              <div className="max-h-[460px] overflow-y-auto pr-1">
                {pencapaianSubTab === 'lencana' ? (
                  <div className="space-y-3.5 animate-fadeIn">
                    {/* Daily Overall Progress Board */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-violet-950/30 border border-violet-900/30 p-4 rounded-2xl space-y-3.5 shadow-[0_4px_24px_rgba(124,58,237,0.05)]">
                      <div>
                        <span className="text-[9px] uppercase font-extrabold tracking-widest text-violet-400 font-mono">DASHBOARD MISI HARIAN</span>
                        <h3 className="text-xs font-black text-white mt-0.5">Analisis Aktivitas 24 Jam</h3>
                      </div>

                      {/* Bar 1: Fully Completed Quests */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-300">✅ MISI HARIAN SELESAI ({completedTodayQuestsCount}/10)</span>
                          <span className="text-xs font-mono font-black text-emerald-450">{overallDailyPercentage}%</span>
                        </div>
                        <div className="relative w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-emerald-905/20 shadow-inner">
                          <motion.div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${overallDailyPercentage}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      {/* Bar 2: Quests in Progress / Started */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-300">🚀 MISI SEDANG/SUDAH DIJALANKAN ({startedQuestsCount}/10)</span>
                          <span className="text-xs font-mono font-black text-pink-400">{startedDailyPercentage}%</span>
                        </div>
                        <div className="relative w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-pink-905/20 shadow-inner">
                          <motion.div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-pink-500 to-violet-600 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${startedDailyPercentage}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 border-t border-violet-950/10 pt-2">
                        <span>Reset setiap jam 06:00 AM (WIB)</span>
                        <span>Siklus: 24 Jam</span>
                      </div>
                    </div>

                    {/* Quests Listing T1 - T10 */}
                    <div className="space-y-2.5">
                      {activeDailyQuests.map((item, idx) => {
                        const currentProgress = dailyQuestProgress[item.id] || 0;
                        const isCompleted = currentProgress >= item.target;
                        const isClaimed = dailyQuestClaimed[item.id] || false;
                        const percent = (currentProgress / item.target) * 100;

                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 transition-all duration-155 relative overflow-hidden ${
                              isClaimed
                                ? 'bg-emerald-950/10 border-emerald-900/20'
                                : isCompleted
                                  ? 'bg-rose-500/10 border-rose-500/30'
                                  : 'bg-slate-950/25 border-violet-900/10'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`text-xl shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center relative overflow-hidden transition-all duration-300 ${
                                isClaimed 
                                  ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                                  : isCompleted 
                                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 ring-1 ring-emerald-500/10' 
                                    : 'bg-slate-950/40 border-violet-950/30 text-slate-400'
                              }`}>
                                {isCompleted ? (
                                  <div className="relative w-full h-full flex items-center justify-center">
                                    <span className="opacity-25 transform scale-75 filter blur-[0.5px] transition-all duration-350">
                                      {item.icon}
                                    </span>
                                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/5">
                                      <svg className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                                        <motion.path
                                          initial={{ pathLength: 0, opacity: 0 }}
                                          animate={{ pathLength: 1, opacity: 1 }}
                                          transition={{ duration: 0.6, ease: "easeOut" }}
                                          d="M20 6L9 17l-5-5"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                ) : (
                                  item.icon
                                )}
                              </div>
                              <div className="space-y-0.5 pr-2 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[7.5px] font-black tracking-widest text-violet-400 font-mono bg-violet-500/10 px-1.5 py-0.5 rounded uppercase">Tingkat {item.tier}</span>
                                  {isClaimed && <span className="text-[7.5px] font-black tracking-widest text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase font-bold text-[7px]">✓ KLAIMED</span>}
                                </div>
                                <h4 className="text-[11.5px] font-black text-white leading-tight mt-0.5">{item.title}</h4>
                                <p className="text-[9.5px] text-slate-400 font-semibold leading-relaxed">{item.desc}</p>
                                
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[8.5px] font-extrabold text-emerald-400 font-mono bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/15">💰 +{item.poinReward.toLocaleString()} PTS</span>
                                  <span className="text-[8.5px] font-extrabold text-pink-400 font-mono bg-pink-500/5 px-1.5 py-0.5 rounded border border-pink-500/15">🎓 +{item.xpReward.toLocaleString()} XP</span>
                                </div>
                              </div>
                            </div>

                            <div className="w-full sm:w-auto flex flex-col sm:items-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t border-violet-950/10 sm:border-t-0 border-dashed">
                              <div className="space-y-1 w-full sm:min-w-[125px]">
                                <div className="flex justify-between items-center text-[8px] font-black text-slate-400 font-mono">
                                  <span>PROGRES</span>
                                  <span className={isCompleted ? 'text-emerald-400 font-bold' : 'text-pink-400 font-bold'}>
                                    {currentProgress} / {item.target} ({Math.round(percent)}%)
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-violet-900/15 shadow-inner">
                                  <motion.div
                                    className={`h-full rounded-full ${
                                      isCompleted 
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_4px_rgba(16,185,129,0.3)]' 
                                        : 'bg-gradient-to-r from-pink-500 to-violet-600 shadow-[0_0_4px_rgba(244,63,94,0.3)]'
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percent}%` }}
                                    transition={{ duration: 0.3 }}
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end pt-0.5">
                                {isClaimed ? (
                                  <div className="flex items-center gap-1.5 text-emerald-400 text-[8.5px] font-black tracking-widest bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-1.5 rounded-lg uppercase font-sans select-none shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                                    <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                                      <motion.path
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        d="M20 6L9 17l-5-5"
                                      />
                                    </svg>
                                    ✓ KLAIMED
                                  </div>
                                ) : isCompleted ? (
                                  <motion.button
                                    onMouseDown={() => startHolding(item)}
                                    onMouseUp={stopHolding}
                                    onMouseLeave={stopHolding}
                                    onTouchStart={() => startHolding(item)}
                                    onTouchEnd={stopHolding}
                                    animate={holdState.id === item.id ? {
                                      scale: 1 + (holdState.progress / 100) * 0.15,
                                      boxShadow: `0 0 ${10 + (holdState.progress / 100) * 20}px rgba(244,63,94,${0.35 + (holdState.progress / 100) * 0.45})`
                                    } : {}}
                                    transition={{ duration: 0.1 }}
                                    className={`relative bg-gradient-to-r from-violet-600 via-pink-500 to-pink-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)] hover:shadow-[0_0_16px_rgba(244,63,94,0.45)] px-4 py-2 rounded-xl text-[8.5px] font-black uppercase tracking-widest cursor-pointer font-sans transition-all duration-150 select-none overflow-hidden flex items-center justify-center gap-1 focus:outline-none ${holdState.id !== null && holdState.id !== item.id ? 'opacity-30 pointer-events-none' : ''}`}
                                    style={{ transformOrigin: 'center' }}
                                  >
                                    {/* Filled progress overlay behind text */}
                                    {holdState.id === item.id && (
                                      <div 
                                        className="absolute inset-y-0 left-0 bg-emerald-500/60 pointer-events-none transition-all duration-75"
                                        style={{ width: `${holdState.progress}%` }}
                                      />
                                    )}
                                    
                                    <span className="relative z-10 flex items-center gap-1">
                                      {holdState.id === item.id ? (
                                        <>⌛ PILING ({100 - Math.round(holdState.progress)}%)</>
                                      ) : (
                                        <>🎁 KLAIM (TAHAN)</>
                                      )}
                                    </span>
                                  </motion.button>
                                ) : (
                                  <div className="bg-slate-900 border border-violet-950/10 text-slate-500 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider select-none font-mono">
                                    Aktif
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-fadeIn">
                    {milestones.map((m, idx) => {
                      const isUnlocked = levelDetails.level >= m.level;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border flex items-center gap-3.5 transition-all duration-150 relative overflow-hidden ${
                            isUnlocked
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-slate-950/20 border-violet-900/10 opacity-55'
                          }`}
                        >
                          <div className="text-2xl filter-none shrink-0 w-10 h-10 rounded-xl bg-[#0b0821]/40 border border-violet-950/30 flex items-center justify-center">
                            {isUnlocked ? m.icon : '🔒'}
                          </div>
                          <div className="flex-1 min-w-0 pr-8">
                            <h4 className={`text-[11px] font-black leading-tight ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>{m.title}</h4>
                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5 leading-relaxed">{m.desc}</p>
                          </div>
                          <div className="shrink-0 text-right z-20">
                            {isUnlocked ? (
                              <span className="text-[8px] font-black text-emerald-450 border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Unlocked</span>
                            ) : (
                              <span className="text-[8px] font-black text-slate-500 border border-slate-500/10 bg-slate-950/45 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Locked</span>
                            )}
                          </div>

                          {/* Beautiful Stamper/Badge overlay with active pulse */}
                          {isUnlocked && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none select-none z-10 overflow-hidden">
                              <motion.div
                                initial={{ scale: 2.3, opacity: 0, rotate: 35 }}
                                animate={{ 
                                  scale: 1, 
                                  opacity: 0.75, 
                                  rotate: 15 
                                }}
                                transition={{ 
                                  type: 'spring',
                                  stiffness: 140,
                                  damping: 12,
                                  delay: idx * 0.05 
                                }}
                              >
                                <motion.div
                                  animate={{
                                    scale: [1, 1.04, 1],
                                    opacity: [0.65, 0.9, 0.65],
                                  }}
                                  transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                  className="w-[48px] h-[48px] rounded-full border-2 border-dashed border-emerald-500 text-emerald-500 text-[8px] font-black tracking-widest uppercase flex flex-col items-center justify-center bg-emerald-500/5 shadow-[0_0_10px_rgba(16,185,129,0.1)] font-mono"
                                >
                                  <span className="text-[7px] leading-none mb-0.5">UNLOCKED</span>
                                  <div className="border-t border-emerald-500/40 w-7 my-0.5"></div>
                                  <span className="text-[6px] tracking-normal font-sans font-medium text-emerald-450">ACHIEVED</span>
                                </motion.div>
                              </motion.div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ==========================================
            VIEW: RIWAYAT SIMULASI UJIAN (HISTORY)
        ========================================== */}
        {activeTab === 'riwayat' && (
          <div className="space-y-6 animate-fadeIn pb-36">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">Riwayat Simulasi (履歴)</h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-sans font-medium">Hasil ujian simulasi JLPT lengkap dengan lembar jawaban & pembahasan</p>
              </div>
              <span className="px-3 py-1 bg-violet-905 border border-pink-500/20 rounded-full font-bold text-[10px] text-pink-400 font-mono tracking-wider">
                {jlptExamHistory.length} Ujian Terdaftar
              </span>
            </div>

            {jlptExamHistory.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-950/60 to-violet-950/20 border border-violet-900/30 rounded-3xl p-12 text-center space-y-4 shadow-xl">
                <div className="text-5xl">静态</div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-300">Belum Ada Riwayat Ujian</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Uji pemahaman bahasa Jepang kamu dengan simulasi ujian JLPT yang sesungguhnya di tab Kuis!
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('kuis')}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-pink-500 hover:opacity-90 transition text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer select-none"
                >
                  Mulai Ujian Pertama
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jlptExamHistory.map((historyItem) => {
                  const isExpanded = expandedHistoryId === historyItem.id;
                  const passed = historyItem.percent >= 60; // 60% passing mark standard

                  return (
                    <div 
                      key={historyItem.id} 
                      className="bg-gradient-to-br from-[#120e2e]/70 to-[#0b0821]/90 border border-violet-900/40 rounded-3xl overflow-hidden shadow-xl"
                    >
                      {/* CARD COMPACT HEADER */}
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          {/* Level stamp */}
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm tracking-wider shadow-inner shrink-0 ${
                            passed 
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                          }`}>
                            {historyItem.level}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-white">Simulasi JLPT {historyItem.level}</span>
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-450'
                              }`}>
                                {passed ? 'LULUS' : 'GAGAL'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold tracking-wide font-mono">{historyItem.date}</p>
                          </div>
                        </div>

                        {/* Scores HUD */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-slate-900 sm:border-0 pt-3 sm:pt-0">
                          <div className="text-left sm:text-right space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Skor Akhir</p>
                            <p className="text-xs font-black text-pink-400 font-mono">
                              {historyItem.score} / {historyItem.total} ({historyItem.percent}%)
                            </p>
                          </div>

                          <button
                            onClick={() => setExpandedHistoryId(isExpanded ? null : historyItem.id)}
                            className="px-4 py-2 bg-violet-950/40 border border-violet-900 hover:bg-violet-900/30 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                          >
                            {isExpanded ? 'Tutup Detail' : 'Buka Pembahasan'}
                          </button>
                        </div>
                      </div>

                      {/* DETAILED ANSWER SHEETS */}
                      {isExpanded && (
                        <div className="border-t border-violet-950 bg-slate-950/50 p-5 space-y-6">
                          <div className="space-y-1">
                            <h4 className="text-[11px] font-black tracking-widest text-violet-400 uppercase">LEMBAR JAWABAN & TINJAUAN PEMBAHASAN SENSEI</h4>
                            <p className="text-[10px] text-slate-500">Tinjau kembali kesalahan dan pelajari struktur tata bahasa berikut penjelasan</p>
                          </div>

                          {/* REWARDS BADGE SUMMARY */}
                          <div className="flex items-center gap-3.5 bg-violet-950/20 border border-violet-900/20 p-3 rounded-2xl max-w-sm">
                            <div className="text-xl">🎁</div>
                            <div className="text-[10px]">
                              <p className="text-slate-300 font-bold">Rewards Diperoleh:</p>
                              <p className="text-pink-400 font-extrabold font-mono text-xs">
                                +{historyItem.pointsEarned} Poin / +{historyItem.xpEarned} XP
                              </p>
                            </div>
                          </div>

                          {/* QUESTIONS LIST */}
                          <div className="space-y-4">
                            {historyItem.questions.map((q: any, qIdx: number) => {
                              const correct = q.isCorrect;
                              return (
                                <div 
                                  key={qIdx}
                                  className={`p-4 rounded-2xl border ${
                                    correct 
                                      ? 'bg-emerald-950/5 border-emerald-900/20' 
                                      : 'bg-rose-950/5 border-rose-900/20'
                                  }`}
                                >
                                  {/* Header number and status */}
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-extrabold text-violet-400 font-mono">SOAL #{qIdx + 1}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${
                                      correct ? 'text-emerald-400' : 'text-rose-405'
                                    }`}>
                                      {correct ? '✓ Benar' : '✗ Salah'}
                                    </span>
                                  </div>

                                  {/* Detailed prompt */}
                                  <div className="space-y-3">
                                    <div className="bg-slate-950/40 p-3.5 rounded-xl space-y-1 text-center font-jp border border-violet-950">
                                      <p className="text-lg md:text-xl font-black text-white tracking-wider">{q.sentence}</p>
                                      <p className="text-xs text-violet-400 font-mono italic">Cara Baca: {q.sentenceRomaji}</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                      <div className="p-2 rounded-lg bg-slate-900/40 border border-violet-900/20">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Jawaban Kamu:</p>
                                        <p className={`font-semibold mt-0.5 ${correct ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {q.userAnswer || '(Tidak Dijawab)'}
                                        </p>
                                      </div>
                                      <div className="p-2 rounded-lg bg-slate-900/40 border border-violet-900/20">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Jawaban yang Benar:</p>
                                        <p className="text-emerald-400 font-semibold mt-0.5">
                                          {q.correctAnswer}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Explanation / Pembahasan */}
                                    <div className="p-3 bg-violet-950/20 border border-violet-900/20 rounded-xl space-y-1 text-left">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        🎓 Pembahasan Sensei:
                                      </p>
                                      <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                                        {q.explanation}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            VIEW: AI SENSEI CHAT (FULL SCREEN TAB)
        ========================================== */}
        {activeTab === 'chat' && (
          <div className="space-y-6 animate-fadeIn pb-36 z-10 relative">
            <h2 className="text-xs font-extrabold text-slate-400 tracking-wider uppercase">AI Sensei Tutor (チャット)</h2>

            {/* Character Selection Slider */}
            <div className="py-2 overflow-x-auto scrollbar-hide shrink-0 -mx-4 px-4">
              <div className="flex gap-4 w-max py-1 select-none">
                {[
                  { id: 'default', name: 'Default Assistant', rom: 'Asisten Default', desc: 'Default Japanese AI Voice.', icon: '🤖', avatar: null },
                  { id: 'mahiru', name: 'Shina Mahiru', rom: '椎名真昼 (CV: Iwami Manaka)', desc: 'Lembut, hangat, bagai malaikat.', icon: '🌸', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBxLpM_m4c_Bo7jZ7eeyDmJpphrqOxvLRnOzn6PyeRJDmH_9ekHA_qrnD9M9F4SbJP1dbBWxxLY5mSxkBl04bB6KcR-mX56WAZSkkg2FT1PimnDw6Q8e4ssMsR690cYQIEHVP8X8VWmhxGp2fWD4ZhRtAylZcjYorRWv3pIHgWaGos-CmEJT7M-xLn3OzUSJH96jSP6D3Fi0LytUwMZeIewEILzGiSVdGam7wP0YPmlbN0HOJ9NAnQghxsWJX16zSLcn5nESEl1hDc' },
                  { id: 'umi', name: 'Asanagi Umi', rom: '朝凪海 (CV: Tomobito)', desc: 'Lincah, ceria, tomboi bersahabat.', icon: '🌊', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDICmUgfVfel--RioKXALJPzBUixgljHqtZa9CLmYj0klZ30pgLEzDm7hQATiEyIoHR78qMBerwtK6n8p80CF1qaX7_KIkM5DER1m-L3wH4M_MvO-Pq8HZidrDsqe2Dwq5slynfi9V17SKYSmu96nBlKoW51u_KNG78ska7NKpi6xhXQgdjpH_RZcVEXBKOPB6x6Zu01z4otD5AOk6E4RmOPRXw7G8WV7K6jYYQHomoMFH-NpfCqnYFbPKfYDvJBYoLJfbpNF94HUQ' },
                  { id: 'nagisa', name: 'Kubo Nagisa', rom: '久保渚咲 (CV: Hanazawa Kana)', desc: 'Menggemaskan, mengoda lembut.', icon: '🦊', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBibreGxTJqKA0gmkQmQ93zjS2BrfWwGCbTK8wOfUqxJ6liFuWizBm4q4WympsQvXPWRBVl1gvijaQev03_n8v5fgATNsNWh2gD6xQZBCEITLyK159do3bQB6CmASM_CIEH6UsYEGZhifYky5o_z-BFFeRUdSupxd218R_tpQlNI2-hAppDEv4v6uuHVogK2YR1ggQfR4MDJbvPl5zhTekVkW-UQ7NBbGKfcjOUJaXurOXW1FFunLFbw163YzRPHP-mRmR3wzSFwYk' },
                  { id: 'furina', name: 'Furina', rom: 'フリーナ (CV: Minase Inori)', desc: 'Dramatis, teatrikal, imut.', icon: '🎭', avatar: null },
                  { id: 'hutao', name: 'Hu Tao', rom: '胡桃 (CV: Takahashi Rie)', desc: 'Sangat lincah, usil, ceria.', icon: '👻', avatar: null },
                  { id: 'columbina', name: 'Columbina', rom: 'コロンビーナ (CV: Toyosaki Aki)', desc: 'Lembut berbisik misterius, kalem.', icon: '🕊️', avatar: null },
                  { id: 'kyoko', name: 'Horimiya Kyoko', rom: '堀京子 (CV: Tomatsu Haruka)', desc: 'Tegas, energik, bersemangat.', icon: '⚡', avatar: null }
                ].map(char => {
                  const isActive = voiceCharacter === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => {
                        setVoiceCharacter(char.id);
                        localStorage.setItem('nik_voice_character', char.id);
                        
                        // Teaser play
                        let teaser = 'こんにちは！本日の日本語トレーニングを一緒に行いましょう。';
                        if (char.id === 'mahiru') teaser = 'あの、よろしくお願いします。一緒に、頑張りましょうね。';
                        else if (char.id === 'umi') teaser = 'よっ！今日も張り切って、一緒にお勉強しよ！';
                        else if (char.id === 'nagisa') teaser = 'ふふっ、聞こえる？お勉強頑張ってて、のんびりいこうね。';
                        else if (char.id === 'furina') teaser = '素晴らしいステージの幕開けだ！僕と共に行こう！';
                        else if (char.id === 'hutao') teaser = 'フータオが来たぞー！それそれ、お勉強の時間だよ！';
                        else if (char.id === 'columbina') teaser = 'ふふ、美しい響き。静かに、私の声を聴いていてね。';
                        else if (char.id === 'kyoko') teaser = 'いくよ！サボってちゃダメなんだから、しっかり聞いてね！';
                        playAudio(teaser);

                        // Add greeting from active character
                        let greeting = 'Konnichiwa! 🌸 Aku adalah AI Sensei pribadimu. Ada materi bahasa Jepang yang ingin kamu tanyakan hari ini?';
                        if (char.id === 'mahiru') greeting = "Kon'nichiwa! 👋 Saya Shina Mahiru. Sudah siap untuk latihan percakapan bahasa Jepang hari ini? Mari kita lakukan yang terbaik!";
                        else if (char.id === 'umi') greeting = "Yo! 🌊 Aku Asanagi Umi. Latihan santai bersamaku ya! Mau belajar hiragana, katakana, atau ada kosakata yang bikin kamu penasaran?";
                        else if (char.id === 'nagisa') greeting = "Fufu, halo! 🦊 Aku Kubo Nagisa. Senang bisa menemanimu belajar hari ini. Jangan sungkan bertanya ya, mari santai saja.";
                        else if (char.id === 'furina') greeting = "Bonjour! 🎭 Furina di sini! Hari ini kita akan menaklukkan panggung Bahasa Jepang bersama. Apa pertunjukan pertama kita?";
                        else if (char.id === 'hutao') greeting = "Ayaaa! 👻 Hu Tao telah tiba! Belajar Bahasa Jepang itu menyenangkan, kan? Yuk, langsung tanyakan apa saja padaku!";
                        else if (char.id === 'columbina') greeting = "Fufu... 🕊️ Aku Columbina. Apakah kamu suka keindahan aksara Jepang? Katakan padaku apa yang ingin kamu ketahui...";
                        else if (char.id === 'kyoko') greeting = "Oi! ⚡ Aku Horimiya Kyoko. Jangan bermalas-malasan ya! Ayo kita sikat habis pelajaran Bahasa Jepang hari ini!";

                        setSenseiChat(prev => [...prev, { role: 'model', text: greeting }]);
                        triggerToast(`Karakter ${char.name} Aktif!`);
                      }}
                      className={`flex flex-col items-center gap-2.5 transition duration-200 cursor-pointer min-w-[76px] relative group ${
                        isActive ? 'opacity-100 scale-105' : 'opacity-55 hover:opacity-90 active:scale-95'
                      }`}
                    >
                      <div className={`w-16 h-16 rounded-full p-[2px] transition ${
                        isActive ? 'bg-gradient-to-tr from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20' : 'bg-slate-800'
                      }`}>
                        <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden border-2 border-slate-900 text-2xl font-bold">
                          {char.avatar ? (
                            <img src={char.avatar} alt={char.name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            char.icon
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold text-center w-20 truncate ${isActive ? 'text-amber-300 font-extrabold' : 'text-slate-400'}`}>
                        {char.name.split(' ')[0]}
                      </span>
                      {isActive && (
                        <div className="absolute top-0 right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-950 shadow-sm animate-pulse"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Chat Window */}
            <div className="bg-gradient-to-br from-slate-950/80 to-slate-900/40 rounded-3xl border border-white/5 shadow-2xl flex flex-col min-h-[480px] max-h-[580px] overflow-hidden relative">
              
              {/* Chat Header */}
              <div className="px-5 py-4 flex items-center justify-between bg-slate-950/60 backdrop-blur-md border-b border-white/5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-slate-900 flex items-center justify-center border border-amber-500/30 overflow-hidden shadow-inner text-xl">
                      {(() => {
                        const activeChar = [
                          { id: 'default', icon: '🤖', avatar: null },
                          { id: 'mahiru', icon: '🌸', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBxLpM_m4c_Bo7jZ7eeyDmJpphrqOxvLRnOzn6PyeRJDmH_9ekHA_qrnD9M9F4SbJP1dbBWxxLY5mSxkBl04bB6KcR-mX56WAZSkkg2FT1PimnDw6Q8e4ssMsR690cYQIEHVP8X8VWmhxGp2fWD4ZhRtAylZcjYorRWv3pIHgWaGos-CmEJT7M-xLn3OzUSJH96jSP6D3Fi0LytUwMZeIewEILzGiSVdGam7wP0YPmlbN0HOJ9NAnQghxsWJX16zSLcn5nESEl1hDc' },
                          { id: 'umi', icon: '🌊', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDICmUgfVfel--RioKXALJPzBUixgljHqtZa9CLmYj0klZ30pgLEzDm7hQATiEyIoHR78qMBerwtK6n8p80CF1qaX7_KIkM5DER1m-L3wH4M_MvO-Pq8HZiddDsqe2Dwq5slynfi9V17SKYSmu96nBlKoW51u_KNG78ska7NKpi6xhXQgdjpH_RZcVEXBKOPB6x6Zu01z4otD5AOk6E4RmOPRXw7G8WV7K6jYYQHomoMFH-NpfCqnYFbPKfYDvJBYoLJfbpNF94HUQ' },
                          { id: 'nagisa', icon: '🦊', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBibreGxTJqKA0gmkQmQ93zjS2BrfWwGCbTK8wOfUqxJ6liFuWizBm4q4WympsQvXPWRBVl1gvijaQev03_n8v5fgATNsNWh2gD6xQZBCEITLyK159do3bQB6CmASM_CIEH6UsYEGZhifYky5o_z-BFFeRUdSupxd218R_tpQlNI2-hAppDEv4v6uuHVogK2YR1ggQfR4MDJbvPl5zhTekVkW-UQ7NBbGKfcjOUJaXurOXW1FFunLFbw163YzRPHP-mRmR3wzSFwYk' },
                          { id: 'furina', icon: '🎭', avatar: null },
                          { id: 'hutao', icon: '👻', avatar: null },
                          { id: 'columbina', icon: '🕊️', avatar: null },
                          { id: 'kyoko', icon: '⚡', avatar: null }
                        ].find(c => c.id === voiceCharacter);
                        
                        if (activeChar?.avatar) {
                          return <img src={activeChar.avatar} alt="avatar" className="w-full h-full object-cover" />;
                        }
                        return activeChar?.icon || '🤖';
                      })()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-950 rounded-full"></span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs leading-tight">
                      {(() => {
                        const names: Record<string, string> = {
                          default: 'Default AI Assistant',
                          mahiru: 'Shina Mahiru (椎名真昼)',
                          umi: 'Asanagi Umi (朝凪海)',
                          nagisa: 'Kubo Nagisa (久保渚咲)',
                          furina: 'Furina (フリーナ)',
                          hutao: 'Hu Tao (胡桃)',
                          columbina: 'Columbina (コロンビーナ)',
                          kyoko: 'Horimiya Kyoko (堀京子)'
                        };
                        return names[voiceCharacter] || 'Sensei AI';
                      })()}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">AI Voice Aktif</span>
                    </div>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => setActiveTab('setting')}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition cursor-pointer select-none active:scale-95"
                  title="Buka Pengaturan Suara & Tema"
                >
                  <Settings size={15} />
                </button>
              </div>

              {/* Chat Messages container */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 chat-container bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:20px_20px] flex flex-col">
                {senseiChat.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`max-w-[85%] text-xs leading-relaxed px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'glass-bubble-user text-white self-end rounded-tr-none shadow-md'
                        : 'glass-bubble-ai text-slate-200 self-start rounded-tl-none border border-white/5'
                    }`}
                  >
                    <p className="font-semibold">{msg.text}</p>
                    {msg.role === 'model' && (msg.text.includes('ね') || msg.text.includes('よ') || msg.text.includes('こんにちは') || msg.text.includes('どういたしまして')) && (
                      <p className="text-[9.5px] text-slate-400 font-semibold italic mt-1.5 border-l border-amber-500/30 pl-2">
                        *Latihan aksara aktif - Sentuh audio untuk mendengar pelafalan seiyuu.
                      </p>
                    )}
                  </div>
                ))}
                {senseiLoading && (
                  <div className="glass-bubble-ai text-slate-450 text-[10px] self-start px-4 py-3.5 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-1.5 animate-pulse font-bold">
                    <RefreshCw size={10} className="animate-spin text-amber-400" />
                    Sensei sedang mengetik respon...
                  </div>
                )}
                <div ref={chatEndRef}></div>
              </div>

              {/* Typing entry footer */}
              <div className="bg-slate-950/40 backdrop-blur-xl border-t border-white/5 p-3 flex flex-col gap-3 relative z-10">
                {/* Suggestions chips */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
                  {[
                    'Bagaimana kabar Anda?',
                    'Ajarkan kosa kata baru',
                    'Latihan JLPT N5',
                    'Berikan tips belajar efektif'
                  ].map((sug, sugIdx) => (
                    <button
                      key={sugIdx}
                      type="button"
                      onClick={() => submitSenseiMsg(sug)}
                      className="shrink-0 px-3.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-amber-500/10 rounded-full transition cursor-pointer select-none active:scale-95 whitespace-nowrap"
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 items-center bg-slate-950/80 rounded-2xl px-3 py-1.5 border border-white/5 focus-within:border-amber-500/30 transition">
                  <input
                    type="text"
                    value={senseiInput}
                    onChange={e => setSenseiInput(e.target.value)}
                    placeholder="Tanya Sensei seputar kosa kata..."
                    onKeyDown={e => e.key === 'Enter' && submitSenseiMsg()}
                    className="flex-1 bg-transparent border-none text-white text-xs font-bold py-2 focus:ring-0 outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => submitSenseiMsg()}
                    className="w-9 h-9 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center cursor-pointer hover:brightness-110 active:scale-90 transition shrink-0 shadow-lg shadow-amber-500/10"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==========================================
            VIEW: PROFIL
        ========================================== */}
        {activeTab === 'profil' && currentUser && (
          <div className="space-y-6 animate-fadeIn pb-36 relative z-10">
            
            {/* Profile Header Block with Customizable Background (V2 Premium) */}
            <div className="rounded-3xl border border-white/10 overflow-hidden shadow-2xl bg-slate-950/40 relative">
              <div 
                className={`h-28 w-full relative overflow-hidden ${(currentUser.profileBackground && !currentUser.profileBackground.startsWith('http') && !currentUser.profileBackground.startsWith('data:image') && !currentUser.profileBackground.startsWith('data:video')) ? currentUser.profileBackground : 'bg-gradient-to-tr from-indigo-900/60 to-slate-900/90'}`}
              >
                {currentUser.profileBackground && (
                  (currentUser.profileBackground.startsWith('data:video/') || 
                   currentUser.profileBackground.endsWith('.mp4') || 
                   currentUser.profileBackground.endsWith('.webm') ||
                   currentUser.profileBackground.endsWith('.ogg') ||
                   currentUser.profileBackground.includes('/videos/')) ? (
                    <video
                      src={currentUser.profileBackground}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    (currentUser.profileBackground.startsWith('http') || currentUser.profileBackground.startsWith('data:image')) ? (
                      <div 
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${currentUser.profileBackground})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                    ) : null
                  )
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
              </div>

              <div className="px-6 pb-6 flex flex-col items-center -mt-14 relative z-10">
                <div className="relative mb-3">
                  <div className="w-24 h-24 rounded-full border-4 border-slate-950 overflow-hidden shadow-[0_0_20px_rgba(217,119,6,0.3)] bg-slate-900 shrink-0 animate-bounce" style={{ animationDuration: '4s' }}>
                    <img
                      src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=0b1120&color=fff`}
                      alt="profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-3.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg border-2 border-slate-950 whitespace-nowrap">
                    Level N{levelDetails.level || '5'}
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-black text-white flex items-center justify-center gap-1.5">
                    {currentUser.displayName}
                    {(currentUser.role === 'dev' || currentUser.username.toLowerCase() === 'admin baik' || currentUser.username.toLowerCase().includes('adminbaik')) && (
                      <span className="dev-rgb-badge px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase text-slate-950 scale-95 tracking-wide animate-pulse">Developer</span>
                    )}
                  </h2>
                  <p className="text-[10px] text-amber-300 font-bold uppercase tracking-wider mt-1">@{currentUser.username}</p>
                </div>
              </div>
            </div>

            {/* 📜 CHILL BOXED DESCRIPTION CARD (V2 Premium) */}
            <div className="chill-profile-box p-6 space-y-3.5 text-left border border-white/10 shadow-2xl relative overflow-hidden">
              <span className="text-[9px] text-amber-400 font-extrabold uppercase tracking-widest block">Deskripsi Belajar (Status)</span>
              <p className="text-xs font-semibold text-slate-200 leading-relaxed font-sans">{currentUser.deskripsi || 'Halo! Saya sedang belajar Bahasa Jepang.'}</p>
              
              <div className="pt-3 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-slate-400 font-mono">
                <span>📅 BIO / TANGGAL LAHIR</span>
                <span className="text-slate-200">{currentUser.ttl || '-'}</span>
              </div>
            </div>

            {/* Stats Bento Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel p-5 rounded-3xl flex flex-col items-center justify-center col-span-2 py-6">
                <span className="text-amber-400 text-3xl mb-1">⭐</span>
                <span className="text-2xl font-black text-white tracking-tight">{localXp.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mt-0.5">Total XP Terkumpul</span>
              </div>
              
              <div className="glass-panel p-4.5 rounded-3xl flex flex-col items-center justify-center py-5">
                <span className="text-rose-500 text-2xl mb-1">📚</span>
                <span className="text-lg font-black text-white">
                  {localXp > 8000 ? '420+' : localXp > 3000 ? '165' : '45'}
                </span>
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-0.5">Kosakata Dikuasai</span>
              </div>
              
              <div className="glass-panel p-4.5 rounded-3xl flex flex-col items-center justify-center py-5">
                <span className="text-orange-400 text-2xl mb-1">🔥</span>
                <span className="text-lg font-black text-white">{streakKuis} Hari</span>
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-0.5">Streak Belajar</span>
              </div>
            </div>

            {/* Achievements Section */}
            <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-5 space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>🏆</span> PENCAPAIAN TERBARU (実績)
              </h3>
              
              <div className="flex gap-4 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4 select-none">
                <div className="min-w-[130px] glass-panel p-4 rounded-2xl flex flex-col items-center text-center gap-3 border border-emerald-500/20">
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/40 flex items-center justify-center border border-emerald-500/30 text-xl shadow-inner">
                    ⚡
                  </div>
                  <span className="text-[10px] font-bold text-white/90">Kilat Hiragana</span>
                  <span className="text-[8px] font-bold text-emerald-400 uppercase">Aktif</span>
                </div>
                
                <div className="min-w-[130px] glass-panel p-4 rounded-2xl flex flex-col items-center text-center gap-3 border border-amber-500/20">
                  <div className="w-12 h-12 rounded-xl bg-amber-950/40 flex items-center justify-center border border-amber-500/30 text-xl shadow-inner">
                    💮
                  </div>
                  <span className="text-[10px] font-bold text-white/90">Penjelajah Kanji</span>
                  <span className="text-[8px] font-bold text-amber-400 uppercase">Aktif</span>
                </div>
                
                <div className="min-w-[130px] glass-panel p-4 rounded-2xl flex flex-col items-center text-center gap-3 opacity-40 border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 text-xl shadow-inner">
                    🔒
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Master JLPT N3</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Terkunci</span>
                </div>
              </div>
            </div>

            {/* Quick Switches */}
            <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-5 space-y-3.5">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">⚙️ PENGATURAN BELAJAR</h3>
              
              <div className="flex justify-between items-center py-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">🔔 Pengingat Harian</span>
                  <span className="text-[9px] text-slate-500 font-semibold mt-0.5">Notifikasi belajar otomatis jam 19:00</span>
                </div>
                <button
                  type="button"
                  onClick={() => triggerToast('Pengingat belajar harian diaktifkan!')}
                  className="w-10 h-5.5 rounded-full p-0.5 bg-emerald-500 cursor-pointer transition"
                >
                  <div className="bg-white w-4.5 h-4.5 rounded-full shadow-md transform translate-x-4.5 transition"></div>
                </button>
              </div>

              <div className="flex justify-between items-center py-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">✨ Mode AI Chat Proaktif</span>
                  <span className="text-[9px] text-slate-500 font-semibold mt-0.5">Sensei AI lebih responsif membimbing percakapan</span>
                </div>
                <button
                  type="button"
                  onClick={() => triggerToast('Mode AI Chat Proaktif diaktifkan!')}
                  className="w-10 h-5.5 rounded-full p-0.5 bg-emerald-500 cursor-pointer transition"
                >
                  <div className="bg-white w-4.5 h-4.5 rounded-full shadow-md transform translate-x-4.5 transition"></div>
                </button>
              </div>

              {/* Shortcut to detailed settings tab */}
              <button
                type="button"
                onClick={() => setActiveTab('setting')}
                className="w-full flex items-center justify-between p-3.5 bg-slate-950/80 hover:bg-slate-900 border border-white/5 rounded-2xl transition cursor-pointer select-none active:scale-[0.99] mt-3"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="text-amber-400" size={14} />
                  <span className="text-[11px] font-black text-white">Sesuaikan Suara, Karakter & Tema Visual</span>
                </div>
                <ChevronRight className="text-slate-500" size={14} />
              </button>
            </div>

            {/* Account Management section */}
            <div className="bg-slate-950/40 border border-white/5 rounded-3xl p-5 space-y-4">
              <h3 className="text-[10px] font-black text-slate-450 uppercase tracking-widest">🔒 AKUN & KEAMANAN</h3>
              
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-white/5 rounded-2xl text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📧</span>
                    <span className="font-bold text-slate-300">{currentUser.email || 'guest@nihongo.id'}</span>
                  </div>
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                    Terverifikasi
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setEditDisplayName(currentUser.displayName);
                      setEditUsername(currentUser.username);
                      setEditAvatarBase64(currentUser.avatar);
                      setEditDeskripsi(currentUser.deskripsi || 'Halo! Saya sedang belajar Bahasa Jepang.');
                      setEditTtl(currentUser.ttl || '-');
                      const isUrl = currentUser.profileBackground && (currentUser.profileBackground.startsWith('http') || currentUser.profileBackground.startsWith('data:image') || currentUser.profileBackground.startsWith('data:video'));
                      setCustomBgUrl(isUrl ? currentUser.profileBackground : '');
                      setSelectedBgPreset(isUrl ? 'bg-gradient-to-tr from-indigo-900/60 to-slate-900/90' : (currentUser.profileBackground || 'bg-gradient-to-tr from-indigo-900/60 to-slate-900/90'));
                      setShowEditProfileModal(true);
                    }}
                    className="py-3 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[11px] rounded-xl hover:brightness-110 transition cursor-pointer text-center select-none active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    ✏️ Edit Profil
                  </button>

                  <button
                    type="button"
                    onClick={logoutUser}
                    className="py-3 bg-slate-900 border border-white/10 text-white font-black text-[11px] rounded-xl hover:bg-slate-800 transition cursor-pointer text-center select-none active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    🚪 Keluar Sesi
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReportCategory('bug');
                    setReportMessage('');
                    setShowReportModal(true);
                  }}
                  className="w-full py-3 bg-slate-950 border border-violet-500/20 text-violet-400 hover:bg-violet-500/10 font-bold text-[11px] rounded-2xl transition cursor-pointer select-none active:scale-95 flex items-center justify-center gap-2"
                >
                  📢 Laporkan Kendala / Usulan Fitur
                </button>

                {(currentUser.role === 'dev' || currentUser.username.toLowerCase() === 'admin baik' || currentUser.username.toLowerCase().includes('adminbaik')) && (
                  <button
                    type="button"
                    onClick={() => {
                      fetchDevReports();
                      fetchDevUsersList();
                      setShowDevPortal(true);
                    }}
                    className="w-full py-3 bg-slate-950 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 font-bold text-[11px] rounded-2xl transition cursor-pointer select-none active:scale-95 flex items-center justify-center gap-2"
                  >
                    ⛩️ Portal Developer Eksklusif
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetStoryMemory}
                  className="w-full py-3 bg-slate-950 border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 font-bold text-[11px] rounded-2xl transition cursor-pointer select-none active:scale-95 flex items-center justify-center gap-2"
                >
                  🔄 Reset Riwayat & Progres Latihan
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmChecked(false);
                    setShowDeleteAccountModal(true);
                  }}
                  className="w-full py-3 bg-red-950/20 border border-red-500/30 text-red-400 hover:bg-red-950/40 font-black text-[11px] rounded-2xl transition cursor-pointer select-none active:scale-95 flex items-center justify-center gap-2"
                >
                  🗑️ Hapus Akun Secara Permanen
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            VIEW: SETTINGS (Isolated standalone section)
        ========================================== */}
        {activeTab === 'setting' && currentUser && (
          <div className="space-y-6 animate-fadeIn pb-36">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-lg font-jp select-none">設</div>
              <div>
                <h2 className="text-sm font-black text-white tracking-wide">Pengaturan</h2>
                <p className="text-[9px] font-bold text-amber-400/70 uppercase tracking-widest">Premium Settings · 設定</p>
              </div>
            </div>

            {/* CARD 1: CHARACTER VOICE SELECTION */}
            <div className="glass-card rounded-3xl p-6 shadow-xl space-y-4 border border-amber-500/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-violet-900/30 pb-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="text-pink-400" size={18} />
                  <h3 className="text-sm font-black text-white">Suara Karakter Bahasa Jepang (CV)</h3>
                </div>
                <button
                  onClick={() => {
                    let greeting = 'あの、私の声、ちゃんと聞こえていますか？応援しています！';
                    if (voiceCharacter === 'umi') greeting = 'おーい！私の声、聞こえる？バッチリ届いてるかな？';
                    else if (voiceCharacter === 'nagisa') greeting = 'ふふっ、私の声聞こえてる？。一緒にお勉強できて嬉しいな。';
                    else if (voiceCharacter === 'furina') greeting = '素晴らしい！僕の美声が君のスマートフォンから響いているかい？';
                    else if (voiceCharacter === 'hutao') greeting = 'ねえねえ！フータオの声が聞こえてる？聞こえてるなら大成功！';
                    else if (voiceCharacter === 'columbina') greeting = 'ふふ、私の歌声のように…優しく聴こえているでしょうか。';
                    else if (voiceCharacter === 'kyoko') greeting = 'おーい！声聞こえてる？しっかり集中するんだよ。';
                    playAudio(greeting);
                    triggerToast("Memutar Uji Coba Suara...");
                  }}
                  className="px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20 text-pink-300 font-bold text-[10px] transition cursor-pointer self-start"
                >
                  🔊 Tes Paksa Suara (HP)
                </button>
              </div>
              <p className="text-[11px] text-slate-450 leading-relaxed font-semibold">
                Pilih karakter anime favoritmu! Jika suara di HP tidak keluar, pastikan **saklar Hening/Mute tidak aktif**, **volume media dinaikkan**, dan sentuh tombol "Tes Paksa Suara" di atas untuk membuka izin audio browser.
              </p>

              <div className="grid grid-cols-1 gap-2.5 mt-2">
                {[
                  { id: 'default', name: 'Standard Assistant Voice', rom: 'Karakter Default', desc: 'Suara asisten robotik standar Jepang.', avatar: '🤖' },
                  { id: 'mahiru', name: 'Shina Mahiru', rom: '椎名真昼 (CV: Iwami Manaka)', desc: 'Lembut, bernada tinggi, sopan, dan hangat bagai malaikat.', avatar: '🌸' },
                  { id: 'umi', name: 'Asanagi Umi', rom: '朝凪海 (CV: Rina Satou / Tomobito)', desc: 'Lincah, ceria, tomboi bersahabat, penuh energi remaja.', avatar: '🌊' },
                  { id: 'nagisa', name: 'Kubo Nagisa', rom: '久保渚咲 (CV: Hanazawa Kana)', desc: 'Menggemaskan, mengoda lembut dengan intonasi santai lambat.', avatar: '🦊' },
                  { id: 'furina', name: 'Furina (Genshin Jp)', rom: 'フリーナ (CV: Minase Inori)', desc: 'Dramatis, teatrikal, vokal panggung megah yang imut.', avatar: '🎭' },
                  { id: 'hutao', name: 'Hu Tao (Genshin Jp)', rom: '胡桃 (CV: Takahashi Rie)', desc: 'Sangat lincah, usil, bertema hantu dengan nada bicara sangat cepat.', avatar: '👻' },
                  { id: 'columbina', name: 'Columbina (Genshin Jp)', rom: 'コロンビーナ (CV: Toyosaki Aki)', desc: 'Lembut berbisik misterius, kalem menenangkan layaknya serafim.', avatar: '🕊️' },
                  { id: 'kyoko', name: 'Horimiya Kyoko', rom: '堀京子 (CV: Tomatsu Haruka)', desc: 'Tegas, energik, bersemangat membara khas gadis SMA teladan.', avatar: '⚡' }
                ].map(char => {
                  const isActive = voiceCharacter === char.id;
                  return (
                    <button
                      key={char.id}
                      onClick={() => {
                        setVoiceCharacter(char.id);
                        globalVoiceCharacter = char.id;
                        let audioDemo = 'こんにちは！本日の日本語トレーニングを一緒に行いましょう。';
                        if (char.id === 'mahiru') audioDemo = 'あの、よろしくお願いします。一緒に、頑張りましょうね。';
                        else if (char.id === 'umi') audioDemo = 'よっ！今日も張り切って、一緒にお勉強しよ！';
                        else if (char.id === 'nagisa') audioDemo = 'ふふっ、聞こえる？お勉強頑張ってて、のんびりいこうね。';
                        else if (char.id === 'furina') audioDemo = '素晴らしいステージの幕開けだ！僕と共に行こう！';
                        else if (char.id === 'hutao') audioDemo = 'フータオが来たぞー！それそれ、お勉強の時間だよ！';
                        else if (char.id === 'columbina') audioDemo = 'ふふ、美しい響き。静かに、私の声を聴いていてね。';
                        else if (char.id === 'kyoko') audioDemo = 'いくよ！サボってちゃダメなんだから、しっかり聞いてね！';
                        playAudio(audioDemo);
                        triggerToast(`Karakter ${char.name} Aktif! Teaser suara diputar.`);
                      }}
                      className={`text-left p-3.5 rounded-2xl border transition duration-200 cursor-pointer flex items-start gap-3 relative overflow-hidden group ${
                        isActive 
                          ? 'bg-violet-950/40 border-pink-500/80 shadow-md shadow-pink-900/10' 
                          : 'bg-slate-900/35 border-violet-950/60 hover:border-violet-900/50 hover:bg-violet-950/10'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-violet-900/30 flex items-center justify-center text-sm border border-violet-800/40 shrink-0">
                        {char.avatar || '🤖'}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-white">{char.name}</span>
                          <span className="text-[9px] font-bold text-pink-400 font-jp">{char.rom}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">{char.desc}</p>
                      </div>

                      <div className={`absolute top-3.5 right-3.5 w-4 h-4 rounded-full flex items-center justify-center border transition ${
                        isActive ? 'bg-pink-500 border-pink-500 text-white' : 'border-slate-800 group-hover:border-slate-700'
                      }`}>
                        {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CARD 1B: VOCAL TTS AUDIO TECHNOLOGY SELECTION */}
            <div className="glass-card rounded-3xl p-6 shadow-xl space-y-4 border border-amber-500/10">
              <div className="flex items-center gap-2 border-b border-violet-900/30 pb-3">
                <Sparkles className="text-pink-400" size={18} />
                <h3 className="text-sm font-black text-white">Teknologi Audio & Suara Jepang (TTS)</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                Silakan pilih teknologi suara yang Anda inginkan. Mode <b>Aktor Suara AI (Gemini)</b> menghasilkan ekspresi suara anime-girl yang sangat mirip, emosional, dan teatrikal!
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mt-2 select-none">
                {[
                  { id: 'gemini', name: 'Aktor Suara AI (Gemini)', desc: 'Ekspresi penuh, sangat menyerupai seiyuu anime asli sesuai karakter pilihan Anda!', icon: '✨' },
                  { id: 'cloud', name: 'Streaming Suara HD Cloud', desc: 'Penutur asli sangat alami, stabil, didukung penuh di semua browser (Safari, Pawxy, Chrome).', icon: '🌐' },
                  { id: 'system', name: 'Sistem Speech Browser', desc: 'Menggunakan robot voice bawaan mesin HP/Komputer Anda.', icon: '📱' },
                ].map(item => {
                  const isActive = voiceEngine === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setVoiceEngine(item.id as any);
                        localStorage.setItem('nik_voice_engine', item.id);
                        triggerToast(`Engine Audio diubah ke ${item.name}!`);
                      }}
                      className={`text-left p-3.5 rounded-2xl border transition duration-200 cursor-pointer flex items-start gap-3 relative overflow-hidden group ${
                        isActive 
                          ? 'bg-violet-950/40 border-pink-500/80 shadow-md shadow-pink-900/10' 
                          : 'bg-slate-900/35 border-violet-950/60 hover:border-violet-900/50 hover:bg-violet-950/10'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-violet-900/30 flex items-center justify-center text-sm border border-violet-800/40 shrink-0">
                        {item.icon}
                      </div>
                      <div className="space-y-0.5 pr-4">
                        <span className="text-xs font-black text-white block">{item.name}</span>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">{item.desc}</p>
                      </div>

                      <div className={`absolute top-3.5 right-3.5 w-4 h-4 rounded-full flex items-center justify-center border transition ${
                        isActive ? 'bg-pink-500 border-pink-500 text-white' : 'border-slate-800 group-hover:border-slate-700'
                      }`}>
                        {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CARD 2: THEME SELECTION */}
            <div className="glass-card rounded-3xl p-6 shadow-xl space-y-4 border border-amber-500/10">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-400" size={18} />
                <h3 className="text-sm font-black text-white">Visual & Warna Tema Aplikasi</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Sesuaikan warna aksen, warna gradien latar belakang, gambar siluet matahari terbit, serta jenis falling petals di layar sesuka hatimu!
              </p>

              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { id: 'sakura', name: 'Sakura Autumn', desc: 'Traditional Crimson Red & Sakura Pink vibes.', accent: '#f43f5e', sub: '#e11d48', particle: '🌸' },
                  { id: 'aqua', name: 'Marine Aqua', desc: 'Fresh deep cyber ocean, turquoise water vibes.', accent: '#06b6d4', sub: '#0891b2', particle: '💧' },
                  { id: 'rose', name: 'Royal Rose', desc: 'Mysterious plum magenta & brilliant rose elegance.', accent: '#db2777', sub: '#c026d3', particle: '🌹' },
                  { id: 'biru_langit', name: 'Sky Midnight', desc: 'Upper stratosphere stars & royal sky blue.', accent: '#3b82f6', sub: '#0ea5e9', particle: '☁️' }
                ].map(themeItem => {
                  const isThemeActive = currentTheme === themeItem.id;
                  return (
                    <button
                      key={themeItem.id}
                      onClick={() => {
                        setCurrentTheme(themeItem.id as any);
                        triggerToast(`Tema Berhasil Diubah ke ${themeItem.name}!`);
                      }}
                      className={`text-left p-3.5 rounded-2xl border transition duration-200 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group ${
                        isThemeActive 
                          ? 'bg-violet-950/40 border-pink-500/80 shadow-md shadow-pink-900/10' 
                          : 'bg-slate-900/35 border-violet-950/60 hover:border-violet-900/50 hover:bg-violet-950/10'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-black text-white">{themeItem.name}</span>
                          <span className="text-[10px]">{themeItem.particle}</span>
                        </div>
                        <p className="text-[9px] text-slate-450 font-semibold leading-tight">{themeItem.desc}</p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-5 h-5 rounded-full border border-slate-950 shadow-inner shrink-0" style={{ backgroundColor: themeItem.accent }}></div>
                        <div className="w-5 h-5 rounded-full border border-slate-950 shadow-inner shrink-0" style={{ backgroundColor: themeItem.sub }}></div>
                      </div>

                      <div className={`absolute bottom-3 right-3 w-4 h-4 rounded-full flex items-center justify-center border transition ${
                        isThemeActive ? 'bg-pink-500 border-pink-500 text-white' : 'border-slate-800'
                      }`}>
                        {isThemeActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CARD 2.5: ANDROID APP DOWNLOAD CARD */}
            <div className="glass-card rounded-3xl p-6 shadow-xl space-y-4 animate-fadeIn border border-emerald-500/10">
              <div className="flex items-center gap-2 border-b border-emerald-900/20 pb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-900/20 flex items-center justify-center border border-emerald-800/40">
                  <Download className="text-emerald-400" size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Aplikasi Android Resmi (APK)</h3>
                  <p className="text-[9px] font-bold text-emerald-405">Versi Mobile Standalone Premium</p>
                </div>
              </div>
              
              <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                Rasakan performa belajar Bahasa Jepang yang jauh lebih cepat, hemat kuota, notifikasi kuis harian instan, dan bebas dari batas navigasi browser biasa dengan menginstal aplikasi Android resmi!
              </p>

              <div className="pt-1">
                {typeof window !== 'undefined' && (window as any).Capacitor ? (
                  <div className="w-full bg-slate-950/80 border border-emerald-950 rounded-2xl py-3 px-4 text-center text-[11px] font-extrabold text-emerald-400 flex items-center justify-center gap-2 select-none">
                    ✨ Anda sedang menggunakan Aplikasi Android Resmi
                  </div>
                ) : (
                  <a
                    href="https://kuislatihanbahasajepang.web.id/nihongo-master.apk"
                    download="nihongo-master.apk"
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 py-3.5 rounded-2xl text-xs font-extrabold text-white transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95 text-center flex items-center justify-center gap-2"
                  >
                    🤖 Download APK Android Standalone (Gratis)
                  </a>
                )}
              </div>
            </div>

            {/* CARD 3: ADDITIONAL SYSTEM CONTROLS */}
            <div className="glass-card rounded-3xl p-5 space-y-4 border border-amber-500/10">
              <h3 className="text-[11px] font-black text-amber-400/60 uppercase tracking-widest">Konfigurasi Sistem</h3>
              
              <div className="flex justify-between items-center py-2.5 border-b border-violet-950/30">
                <div className="text-xs font-bold text-slate-300">🔊 Auto Putar Pengucapan</div>
                <button
                  onClick={() => setAutoSound(!autoSound)}
                  className={`w-11 h-6 rounded-full p-1 transition duration-300 cursor-pointer ${autoSound ? 'bg-emerald-500' : 'bg-slate-800'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${autoSound ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
              </div>



              <div className="pt-2 space-y-2">
                <button
                  onClick={resetStoryMemory}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-950 border border-amber-500/20 text-xs font-black text-amber-500 hover:bg-amber-500/10 hover:border-amber-550/40 transition cursor-pointer flex items-center gap-2 select-none active:scale-[0.98] min-h-[44px]"
                >
                  🔄 Hapus Memori Latihan Kuis
                </button>

                <button
                  onClick={logoutUser}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-950 border border-rose-500/20 text-xs font-black text-rose-500 hover:bg-rose-500/10 hover:border-rose-550/40 transition cursor-pointer flex items-center gap-2 select-none active:scale-[0.98] min-h-[44px]"
                >
                  🚪 Keluar dari Akun
                </button>

                <button
                  onClick={() => {
                    setDeleteConfirmChecked(false);
                    setShowDeleteAccountModal(true);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-950 border border-red-500/20 text-xs font-black text-red-500 hover:bg-red-500/10 hover:border-red-550/40 transition cursor-pointer flex items-center gap-2 select-none active:scale-[0.98] min-h-[44px]"
                >
                  🗑️ Hapus Akun Saya
                </button>
              </div>
            </div>

            {/* CARD 4: LIVE CHAT SUPPORT CENTER TICKETING */}
            <div className="glass-card rounded-3xl p-6 shadow-xl space-y-4 border border-amber-500/10">
              <div className="flex items-center gap-2 border-b border-violet-900/30 pb-3">
                <span className="text-lg">💁</span>
                <h3 className="text-sm font-black text-white">Live Support & Bantuan Tiket</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                Punya kendala, bug pembayaran kuis, atau pertanyaan belajar? Hubungi tim admin & developer Zenith secara langsung melalui tiket obrolan bantuan.
              </p>
              
              <button
                type="button"
                onClick={() => {
                  setActiveHelpView('list');
                }}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 py-3 rounded-2xl text-xs font-extrabold hover:brightness-110 active:scale-95 transition cursor-pointer shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
              >
                💬 Mulai Obrolan Live Chat Admin
              </button>
            </div>

            {/* CARD 5: LAINNYA SUB-MENU (WhatsApp Video Style) */}
            <div className="glass-card rounded-3xl p-6 shadow-xl space-y-4 border border-amber-500/10">
              <div className="flex items-center gap-2 border-b border-violet-900/30 pb-3">
                <span className="text-lg">⚙️</span>
                <h3 className="text-sm font-black text-white">Lainnya</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDiagnosingNetwork(false);
                    setNetworkLatency(null);
                    setNetworkJitter(null);
                    setNetworkSpeed(null);
                    setShowNetworkDiagnostics(true);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-950 border border-violet-900/10 text-xs font-black text-slate-350 hover:bg-white/5 transition flex items-center gap-2 select-none active:scale-[0.98] min-h-[44px]"
                >
                  📶 Diagnosa Kecepatan Jaringan
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreditApp(true)}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-950 border border-violet-900/10 text-xs font-black text-slate-350 hover:bg-white/5 transition flex items-center gap-2 select-none active:scale-[0.98] min-h-[44px]"
                >
                  ✨ Kredit Pembuat Aplikasi (Contributors)
                </button>

                <button
                  type="button"
                  onClick={() => setShowDmcaDisclaimer(true)}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-950 border border-violet-900/10 text-xs font-black text-slate-350 hover:bg-white/5 transition flex items-center gap-2 select-none active:scale-[0.98] min-h-[44px]"
                >
                  ⚖️ Policy - DMCA - Disclaimer
                </button>

                <button
                  type="button"
                  onClick={logoutUser}
                  className="w-full text-left p-3.5 rounded-2xl bg-red-950/20 border border-red-500/20 text-xs font-black text-red-400 hover:bg-red-950/40 transition flex items-center gap-2 select-none active:scale-[0.98] min-h-[44px]"
                >
                  🚪 Keluar Sesi Akun (Logout)
                </button>
              </div>
            </div>
          </div>
        )}

      </main>



      {/* Primary Bottom Navigation Bar layout */}
      <nav className="fixed bottom-0 left-0 w-full z-45 flex justify-between items-end px-1 pb-safe bg-black/60 backdrop-blur-3xl border-t border-white/10 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] h-20">
        <button
          onClick={() => setActiveTab('kuis')}
          className={`flex flex-col items-center justify-center flex-1 pb-2 transition duration-200 cursor-pointer select-none active:scale-90 ${
            activeTab === 'kuis' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home size={20} className={activeTab === 'kuis' ? 'scale-110' : ''} />
          <span className="text-[9px] uppercase tracking-tighter mt-1 font-bold">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('kamus')}
          className={`flex flex-col items-center justify-center flex-1 pb-2 transition duration-200 cursor-pointer select-none active:scale-90 ${
            activeTab === 'kamus' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen size={20} className={activeTab === 'kamus' ? 'scale-110' : ''} />
          <span className="text-[9px] uppercase tracking-tighter mt-1 font-bold">Learn</span>
        </button>

        <button
          onClick={() => setActiveTab('practice')}
          className={`flex flex-col items-center justify-center flex-1 pb-2 transition duration-200 cursor-pointer select-none active:scale-90 ${
            activeTab === 'practice' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PenTool size={20} className={activeTab === 'practice' ? 'scale-110' : ''} />
          <span className="text-[9px] uppercase tracking-tighter mt-1 font-bold">Practice</span>
        </button>

        {/* Central Floating AI Chat trigger button */}
        <div className="flex-1 flex justify-center mb-4 relative z-50">
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-850 text-white rounded-full shadow-[0_8px_25px_rgba(37,99,235,0.5)] border-4 border-[#0b1120] flex items-center justify-center cursor-pointer select-none active:scale-90 transition duration-250 relative ${
              activeTab === 'chat' ? 'ring-2 ring-amber-400' : ''
            }`}
          >
            <Sparkles size={22} className={activeTab === 'chat' ? 'animate-spin-slow' : 'animate-pulse'} />
            <span className="absolute -bottom-5.5 text-[8.5px] uppercase tracking-tighter font-black text-amber-300">AI Chat</span>
          </button>
        </div>

        <button
          onClick={() => setActiveTab('ranking')}
          className={`flex flex-col items-center justify-center flex-1 pb-2 transition duration-200 cursor-pointer select-none active:scale-90 ${
            activeTab === 'ranking' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy size={20} className={activeTab === 'ranking' ? 'scale-110' : ''} />
          <span className="text-[9px] uppercase tracking-tighter mt-1 font-bold">Ranks</span>
        </button>

        <button
          onClick={() => setActiveTab('pencapaian')}
          className={`flex flex-col items-center justify-center flex-1 pb-2 transition duration-200 cursor-pointer select-none active:scale-90 ${
            activeTab === 'pencapaian' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award size={20} className={activeTab === 'pencapaian' ? 'scale-110' : ''} />
          <span className="text-[9px] uppercase tracking-tighter mt-1 font-bold">Quest</span>
        </button>

        <button
          onClick={() => setActiveTab('profil')}
          className={`flex flex-col items-center justify-center flex-1 pb-2 transition duration-200 cursor-pointer select-none active:scale-90 ${
            activeTab === 'profil' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <User size={20} className={activeTab === 'profil' ? 'scale-110' : ''} />
          <span className="text-[9px] uppercase tracking-tighter mt-1 font-bold">Profile</span>
        </button>
      </nav>

      {/* ==========================================
          MODAL: PRIVACY POLICY & TERMS ACCEPTANCE
      ========================================== */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl p-7 relative max-h-[92vh] flex flex-col border border-amber-500/20">
            <div className="text-center space-y-2 mb-4 shrink-0 flex flex-col items-center pt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-3xl shadow-lg border border-amber-300/40 select-none">
                📜
              </div>
              <h2 className="text-lg font-black text-white tracking-wide">Syarat, Ketentuan & Privasi</h2>
              <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest">Zenith Nihongo Master</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-[11px] text-slate-350 leading-relaxed font-semibold pr-2 mb-6">
              <p className="text-justify">Selamat datang di **Zenith Nihongo**! Demi kenyamanan, keamanan, dan privasi Anda dalam belajar bahasa Jepang, mohon baca dan pahami seluruh Syarat, Ketentuan, dan Kebijakan Privasi profesional kami berikut:</p>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-3.5">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5 text-amber-450">
                    <span>⛩️</span> 1. LAYANAN & SISTEM GAMIFIKASI
                  </h4>
                  <p className="text-[10px] text-slate-400 pl-5 text-justify leading-normal font-medium">
                    Aplikasi ini menyediakan platform pembelajaran Bahasa Jepang interaktif yang dilengkapi fitur gamifikasi berupa perolehan Poin, XP (Experience Points), Leveling, dan Peringkat (Leaderboard). Seluruh metrik pembelajaran dirancang murni untuk meningkatkan motivasi belajar Anda dan tidak memiliki nilai komersial atau dapat ditukarkan dalam bentuk apa pun di luar aplikasi.
                  </p>
                </div>
                
                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5 text-amber-450">
                    <span>🔒</span> 2. PERLINDUNGAN PRIVASI & DATA PRIBADI
                  </h4>
                  <p className="text-[10px] text-slate-400 pl-5 text-justify leading-normal font-medium">
                    Kami berkomitmen penuh untuk melindungi privasi data pribadi Anda. Data autentikasi login (melalui Google OAuth maupun registrasi email), informasi profil, display name, deskripsi bio, dan file avatar kustom Anda akan disimpan dengan protokol pengamanan tinggi pada database internal kami. Kami menjamin tidak akan pernah menjual, membagikan, atau menyalahgunakan data pribadi Anda kepada pihak ketiga mana pun tanpa persetujuan eksplisit Anda.
                  </p>
                </div>
                
                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5 text-amber-455">
                    <span>🤖</span> 3. INTEGRASI AI, CHATBOT & SINTESIS TTS
                  </h4>
                  <p className="text-[10px] text-slate-400 pl-5 text-justify leading-normal font-medium">
                    Layanan interaktif Chatbot "AI Sensei" serta sistem pelafalan audio (Text-to-Speech) dalam aplikasi ini terintegrasi langsung dengan API Google Gemini. Interaksi obrolan, pertanyaan, dan percakapan yang Anda lakukan ditujukan sepenuhnya untuk sarana latihan dan edukasi Bahasa Jepang. Harap tidak menginput data yang bersifat sangat sensitif atau rahasia ke dalam fitur obrolan AI demi menjaga privasi penuh Anda.
                  </p>
                </div>
                
                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5 text-amber-455">
                    <span>⚙️</span> 4. SISTEM LAPORAN BUG & DUKUNGAN DEVELOPER
                  </h4>
                  <p className="text-[10px] text-slate-400 pl-5 text-justify leading-normal font-medium">
                    Demi menjaga keandalan dan stabilitas aplikasi, kami menyediakan fitur "Laporkan Kendala" di dalam tab Pengaturan. Setiap laporan bug, masukan suara AI, atau usulan fitur akan langsung dikirimkan ke basis data eksklusif Developer ("admin baik") untuk dievaluasi dan diperbaiki secepatnya guna mengoptimalkan kenyamanan belajar Anda.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5 text-amber-460">
                    <span>📜</span> 5. BATASAN TANGGUNG JAWAB & LISENSI
                  </h4>
                  <p className="text-[10px] text-slate-400 pl-5 text-justify leading-normal font-medium">
                    Seluruh konten edukasi, materi kosakata, modul tata bahasa, serta fitur audio latihan ditujukan untuk keperluan pembelajaran pribadi secara non-komersial. Meskipun kami berusaha menyajikan materi seakurat mungkin, developer tidak bertanggung jawab atas kerugian atau kesalahan interpretasi yang timbul dari materi ajar di dalam platform ini.
                  </p>
                </div>
              </div>
              
              <p className="text-[9px] text-slate-400 italic text-center font-bold px-2">
                Pernyataan Sesi: Demi kepatuhan regulasi privasi yang ketat, persetujuan Syarat & Ketentuan ini wajib dikonfirmasi ulang pada setiap sesi login baru untuk memastikan kesadaran privasi pengguna yang aktif.
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleAcceptTerms}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition duration-150 cursor-pointer shadow-lg shadow-amber-500/20 shrink-0"
            >
              Setuju & Lanjutkan ⛩️
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: LAPORKAN BUG / KENDALA
      ========================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-7 relative border border-amber-500/20">
            <button 
              type="button"
              onClick={() => setShowReportModal(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-350 transition w-7 h-7 rounded-full bg-slate-950/80 flex items-center justify-center border border-white/5 cursor-pointer"
            >
              <X size={14} />
            </button>

            <div className="text-center space-y-1 mb-5 flex flex-col items-center pt-2">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-2xl shadow-xl select-none mb-2">
                📢
              </div>
              <h2 className="text-md font-black text-white tracking-wide">Laporkan Kendala / Usulan</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Akan terkirim langsung ke Portal Dev</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-widest block">Kategori Laporan</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'bug', label: '🐛 Bug / Eror' },
                    { id: 'audio', label: '🔊 Suara / TTS' },
                    { id: 'fitur', label: '💡 Saran Fitur' },
                    { id: 'lainnya', label: '📦 Lainnya' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setReportCategory(cat.id as any)}
                      className={`py-2 px-3 rounded-xl border text-[10px] font-bold text-center cursor-pointer transition ${
                        reportCategory === cat.id 
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                          : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-450 uppercase tracking-widest block">Isi Detail Laporan</label>
                <textarea
                  value={reportMessage}
                  onChange={e => setReportMessage(e.target.value)}
                  placeholder="Tuliskan kekurangan, bug, atau usulan fitur baru Anda di sini secara lengkap agar langsung dibenahi oleh admin..."
                  className="w-full bg-slate-950 border border-slate-900 px-4 py-3 rounded-2xl text-[11px] font-semibold outline-none focus:border-amber-500 text-white min-h-[100px] max-h-[150px] transition"
                ></textarea>
              </div>

              <button
                type="button"
                onClick={submitUserReport}
                disabled={reportSending}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition duration-150 cursor-pointer shadow-lg shadow-pink-500/10 flex items-center justify-center gap-2"
              >
                {reportSending ? 'Mengirim...' : 'Kirim Ke Developer ⛩️'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: EXCLUSIVE DEVELOPER PORTAL
      ========================================== */}
      {showDevPortal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl p-6 relative max-h-[92vh] flex flex-col border border-violet-900/40">
            <button 
              type="button"
              onClick={() => setShowDevPortal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-350 transition w-7 h-7 rounded-full bg-slate-950/80 flex items-center justify-center border border-white/5 cursor-pointer z-10"
            >
              <X size={14} />
            </button>

            <div className="text-center space-y-1 mb-4 shrink-0 flex flex-col items-center pt-2">
              <div className="px-3.5 py-1 rounded-full dev-rgb-badge text-[9px] font-extrabold uppercase tracking-widest text-slate-950 mb-2 animate-pulse">
                Portal Developer
              </div>
              <h2 className="text-md font-black text-white tracking-wide flex items-center gap-1.5 justify-center">
                <span>⛩️</span> Zenith Dev Dashboard
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">Akses Eksklusif Akun <span className="dev-rgb-text font-black">admin baik</span></p>
            </div>

            {/* TAB BAR */}
            <div className="flex bg-slate-950/80 p-1 rounded-2xl mb-4 text-[10px] font-black text-center border border-white/5 shrink-0 overflow-x-auto scrollbar-hide gap-1">
              <button
                type="button"
                onClick={() => setDevPortalTab('stats')}
                className={`px-3 py-2 rounded-xl transition cursor-pointer select-none active:scale-95 duration-100 shrink-0 ${devPortalTab === 'stats' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
              >
                📊 Ringkasan
              </button>
              <button
                type="button"
                onClick={() => setDevPortalTab('users')}
                className={`px-3 py-2 rounded-xl transition cursor-pointer select-none active:scale-95 duration-100 shrink-0 ${devPortalTab === 'users' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
              >
                👥 Pengguna
              </button>
              <button
                type="button"
                onClick={() => setDevPortalTab('announcements')}
                className={`px-3 py-2 rounded-xl transition cursor-pointer select-none active:scale-95 duration-100 shrink-0 ${devPortalTab === 'announcements' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
              >
                📢 Pengumuman
              </button>
              <button
                type="button"
                onClick={() => setDevPortalTab('reports')}
                className={`px-3 py-2 rounded-xl transition cursor-pointer select-none active:scale-95 duration-100 shrink-0 ${devPortalTab === 'reports' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
              >
                🐛 Bug ({devReports.filter(r => r.status === 'pending').length})
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="flex-1 overflow-y-auto pr-1 mb-4 space-y-3 scrollbar-hide text-left">
              
              {/* TAB 1: STATS */}
              {devPortalTab === 'stats' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wider">Total Pengguna</span>
                      <span className="text-xl font-black text-white">{allUsersList.length} Akun</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wider">Laporan Bug</span>
                      <span className="text-xl font-black text-white">{devReports.length} Laporan</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wider">Tiket Obrolan</span>
                      <span className="text-xl font-black text-white">{helpTickets.length} Tiket</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wider">Database Node</span>
                      <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        Master-Master OK
                      </span>
                    </div>
                  </div>

                  <div className="bg-violet-950/10 border border-violet-900/20 rounded-2xl p-4 space-y-2">
                    <h3 className="text-[11px] font-black text-white uppercase tracking-wider">💡 Fitur Khusus Developer</h3>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                      Sebagai developer (<span className="dev-rgb-text font-black">admin baik</span>), Anda memiliki kekuasaan penuh untuk mengontrol seluruh konten pengumuman real-time, mereset perolehan XP dan skor kuis murid yang terindikasi curang, mengubah peran (role) user, serta menanggapi masukan & laporan bug langsung dari database.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: USER MANAGEMENT */}
              {devPortalTab === 'users' && (() => {
                const filteredUsers = allUsersList.filter(u => 
                  u.username.toLowerCase().includes(devUserSearch.toLowerCase()) || 
                  u.displayName.toLowerCase().includes(devUserSearch.toLowerCase())
                );
                return (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="bg-slate-950 border border-white/5 rounded-2xl px-3.5 py-1 flex items-center gap-2">
                      <span className="text-xs">🔍</span>
                      <input
                        type="text"
                        value={devUserSearch}
                        onChange={e => setDevUserSearch(e.target.value)}
                        placeholder="Cari berdasarkan username atau nama..."
                        className="w-full bg-transparent border-0 text-xs font-semibold text-white placeholder-slate-655 focus:ring-0 focus:outline-none py-2"
                      />
                    </div>

                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-0.5 scrollbar-hide">
                      {filteredUsers.length === 0 ? (
                        <p className="py-10 text-center text-xs font-bold text-slate-500">Tidak menemukan pengguna.</p>
                      ) : (
                        filteredUsers.map(u => (
                          <div key={u.uid} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-violet-900/30 border border-violet-850/40 flex items-center justify-center shrink-0 text-xs font-black text-violet-400">
                                  {u.avatarUrl ? (
                                    <img src={u.avatarUrl} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    u.displayName.slice(0, 1).toUpperCase()
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-extrabold text-white">@{u.username}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">{u.displayName}</span>
                                </div>
                              </div>
                              
                              <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md ${
                                u.role === 'dev' 
                                  ? 'dev-rgb-badge text-slate-950' 
                                  : 'bg-slate-900 border border-white/5 text-slate-400'
                              }`}>
                                {u.role}
                              </span>
                            </div>

                            <div className="flex justify-between items-center bg-slate-950/60 border border-white/[0.02] rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-400">
                              <span>🏆 XP: <span className="text-white font-extrabold">{u.xp || 0}</span></span>
                              <span>🔥 Poin: <span className="text-white font-extrabold">{u.poin || 0}</span></span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateUserRole(u.uid, u.role === 'dev' ? 'user' : 'dev')}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-[9.5px] uppercase tracking-wider py-2 rounded-xl cursor-pointer active:scale-95 duration-100 transition"
                              >
                                {u.role === 'dev' ? 'Set Jadi User 👤' : 'Set Jadi Dev ⛩️'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Apakah Anda yakin ingin mereset skor @${u.username} menjadi 0? Tindakan ini permanen.`)) {
                                    handleResetUserScore(u.uid);
                                  }
                                }}
                                className="px-3.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/20 text-rose-400 font-extrabold text-[9.5px] uppercase tracking-wider py-2 rounded-xl cursor-pointer active:scale-95 duration-100 transition"
                              >
                                Reset Skor ❌
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* TAB 3: REAL-TIME ANNOUNCEMENT BOARD EDITOR & PUSH */}
              {devPortalTab === 'announcements' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-slate-950/50 border border-violet-900/30 rounded-2xl p-4.5 space-y-3.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Edit Isi Papan Pengumuman:</span>
                      <span className="bg-violet-900/40 text-violet-400 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-violet-800/30">Live Sync</span>
                    </div>

                    <textarea
                      value={announcementText}
                      onChange={e => setAnnouncementText(e.target.value)}
                      placeholder="Tuliskan pengumuman baru untuk semua murid..."
                      rows={4}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-amber-500/40 font-semibold resize-none leading-relaxed"
                    />

                    <button
                      type="button"
                      onClick={() => handleUpdateAnnouncementDev(announcementText)}
                      className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[11px] uppercase tracking-wider py-3.5 rounded-2xl hover:brightness-110 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      📢 Kirim & Broadcast Notifikasi Push
                    </button>
                  </div>

                  <div className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">🚨 Simulasi Notifikasi Browser</span>
                    <p className="text-[9.5px] text-slate-450 font-semibold leading-relaxed">
                      Zenith Nihongo menggunakan standard Web Notification API. Saat Anda menekan tombol di atas, seluruh murid yang sedang membuka website ini akan langsung menerima notifikasi popup real-time di desktop/hp mereka.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && 'Notification' in window) {
                          Notification.requestPermission().then(perm => {
                            if (perm === 'granted') {
                              new Notification("📢 Pengumuman Baru Zenith Nihongo", {
                                body: announcementText,
                                icon: "/store_icon.png"
                              });
                            } else {
                              alert("Izin notifikasi ditolak/diblokir oleh browser Anda.");
                            }
                          });
                        }
                      }}
                      className="text-[9px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 mt-1 cursor-pointer select-none active:scale-95 duration-100"
                    >
                      🧪 Test Trigger Notifikasi Lokal Anda
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: BUG REPORTS */}
              {devPortalTab === 'reports' && (
                <div className="space-y-3 animate-fadeIn">
                  {devReportsLoading ? (
                    <div className="py-10 text-center text-xs font-bold text-slate-500">
                      Memuat laporan bug...
                    </div>
                  ) : devReports.length === 0 ? (
                    <div className="py-10 text-center text-xs font-bold text-slate-500">
                      Tidak ada laporan bug/kendala aktif saat ini.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-0.5 scrollbar-hide">
                      {devReports.map(rep => (
                        <div key={rep.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
                                {rep.category.toUpperCase()}
                              </span>
                              <span className="text-[8.5px] font-bold text-slate-500">{new Date(rep.createdAt).toLocaleString('id-ID')}</span>
                            </div>
                            <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md ${
                              rep.status === 'resolved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : rep.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            }`}>
                              {rep.status}
                            </span>
                          </div>

                          <p className="text-[10.5px] font-bold text-slate-200 leading-relaxed font-sans">{rep.message}</p>
                          
                          <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                            <span className="text-[8.5px] font-black text-slate-400">Oleh: @{rep.username}</span>
                            {rep.status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateReportStatus(rep.id, 'resolved')}
                                  disabled={updatingReportId === rep.id}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-xl cursor-pointer transition active:scale-95 duration-100"
                                >
                                  Selesai ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateReportStatus(rep.id, 'rejected')}
                                  disabled={updatingReportId === rep.id}
                                  className="bg-rose-600 hover:bg-rose-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-xl cursor-pointer transition active:scale-95 duration-100"
                                >
                                  Tolak ✗
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="flex gap-3 mt-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  fetchDevReports();
                  fetchDevUsersList();
                  triggerToast('Data berhasil disegarkan!', 'success');
                }}
                className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-extrabold text-[11px] uppercase tracking-wider hover:bg-white/10 active:scale-95 transition cursor-pointer"
              >
                Segarkan Data 🔄
              </button>
              <button
                type="button"
                onClick={() => setShowDevPortal(false)}
                className="flex-1 py-3.5 rounded-2xl bg-slate-950 border border-violet-900/40 text-slate-400 font-extrabold text-[11px] uppercase tracking-wider hover:text-white active:scale-95 transition cursor-pointer"
              >
                Tutup Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: AUTHENTICATION LOGIN / REGISTER
      ========================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto border border-amber-500/20 text-center">
            
            <button 
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-350 transition w-7 h-7 rounded-full bg-slate-950/80 flex items-center justify-center border border-white/5 cursor-pointer"
            >
              <X size={14} />
            </button>

            <div className="text-center space-y-1 mb-6 flex flex-col items-center pt-2">
              {/* Gorgeous, visually stunning Japanese Torii Gate Sunrise Emblem for Nihongo Master */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-600 via-pink-500 to-amber-400 flex items-center justify-center p-[2px] shadow-lg shadow-rose-950/40 relative mb-3 group drop-shadow-[0_0_15px_rgba(244,63,94,0.4)] select-none">
                <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-radial-gradient from-rose-600/20 to-transparent pointer-events-none"></div>
                  {/* Torii gate SVG */}
                  <svg className="w-9 h-9 text-rose-500 opacity-90 drop-shadow-[0_2px_5px_rgba(244,63,94,0.5)]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2,6 V4 H22 V6 H20 V19 H17 V6 H7 V19 H4 V6 H2 M5,3 H19 V1 H5 V3" />
                  </svg>
                  <span className="absolute text-[11px] font-black text-amber-300 font-jp tracking-normal bg-slate-950/85 px-1.5 py-0.5 rounded border border-amber-500/30 -bottom-1">
                    語
                  </span>
                </div>
              </div>
              <h2 className="text-lg font-black text-white tracking-wide">Zenith Nihongo</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Akses Penuh Akun Cloud Leaderboard</p>
            </div>

            <div className="flex gap-1.5 p-1 bg-slate-950/80 rounded-xl mb-6 text-xs font-bold text-center border border-white/5">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-lg transition ${authMode === 'login' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 rounded-lg transition ${authMode === 'register' ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
              >
                Daftar
              </button>
            </div>
            
            {/* Google sign-in — premium custom responsive button on both web and APK */}
            <div className="w-full mb-5">
              <button 
                type="button" 
                onClick={handleResponsiveGoogleLogin}
                className="w-full h-[54px] bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-2xl flex items-center justify-center gap-3 px-4 group shadow-lg active:scale-95 duration-200 select-none cursor-pointer"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.21 7.78 8.9 5.04 12 5.04z"/>
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.64z"/>
                  <path fill="#FBBC05" d="M5.28 14.78c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.39 7.2C.51 8.96 0 10.92 0 13s.51 4.04 1.39 5.8l3.89-3.02z"/>
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.09.73-2.5 1.16-4.2 1.16-3.1 0-5.79-2.74-6.72-5.54l-3.89 3.02C3.37 20.33 7.35 23 12 23z"/>
                </svg>
                <span className="font-extrabold text-[13px] tracking-wide text-slate-800">Lanjutkan dengan Google</span>
              </button>
            </div>

            <div className="relative mb-5 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <span className="relative bg-slate-900 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Atau Form manual</span>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleAuthSubmit} className="space-y-5">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full border-b border-t-0 border-l-0 border-r-0 border-white/10 focus:border-amber-500 bg-transparent rounded-none px-1 py-2 text-xs text-white focus:ring-0 placeholder:text-slate-600 transition outline-none"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border-b border-t-0 border-l-0 border-r-0 border-white/10 focus:border-amber-500 bg-transparent rounded-none px-1 py-2 text-xs text-white focus:ring-0 placeholder:text-slate-600 transition outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition select-none active:scale-[0.98] cursor-pointer"
                  >
                    Masuk Sekarang
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Nama Lengkap</label>
                  <input
                    type="text"
                    value={authDisplayName}
                    onChange={e => setAuthDisplayName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full border-b border-t-0 border-l-0 border-r-0 border-white/10 focus:border-amber-500 bg-transparent rounded-none px-1 py-2 text-xs text-white focus:ring-0 placeholder:text-slate-600 transition outline-none"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Username</label>
                  <input
                    type="text"
                    value={authUsername}
                    onChange={e => setAuthUsername(e.target.value)}
                    placeholder="username123"
                    className="w-full border-b border-t-0 border-l-0 border-r-0 border-white/10 focus:border-amber-500 bg-transparent rounded-none px-1 py-2 text-xs text-white focus:ring-0 placeholder:text-slate-600 transition outline-none"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full border-b border-t-0 border-l-0 border-r-0 border-white/10 focus:border-amber-500 bg-transparent rounded-none px-1 py-2 text-xs text-white focus:ring-0 placeholder:text-slate-600 transition outline-none"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border-b border-t-0 border-l-0 border-r-0 border-white/10 focus:border-amber-500 bg-transparent rounded-none px-1 py-2 text-xs text-white focus:ring-0 placeholder:text-slate-600 transition outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs rounded-2xl shadow-lg transition select-none active:scale-[0.98] cursor-pointer"
                  >
                    Daftar Akun Baru
                  </button>
                </div>
              </form>
            )}

            <div className="mt-5 space-y-4">
              {!isNativeAPK && (
                <div className="glass-panel p-3 rounded-2xl space-y-2 flex flex-col items-center">
                  <p className="text-[10px] text-slate-400 font-bold text-center">Verifikasi Keamanan (Cloudflare Turnstile):</p>
                  <div id={authMode === 'login' ? 'cf-turnstile-widget-login' : 'cf-turnstile-widget-register'} className="flex justify-center my-1 min-h-[65px] items-center"></div>
                  {turnstileToken && (
                    <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">✅ Verifikasi berhasil</p>
                  )}
                </div>
              )}
            </div>

            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <span className="relative bg-slate-900 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Atau Lanjut Tanpa Akun</span>
            </div>

            {/* Offline guest profile loader */}
            <form onSubmit={handleGuestEntry} className="space-y-3">
              <input
                type="text"
                placeholder="Tulis nama panggilan kamu..."
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                className="w-full border-b border-t-0 border-l-0 border-r-0 border-white/10 focus:border-amber-500 bg-transparent rounded-none px-1 py-2 text-xs text-white focus:ring-0 placeholder:text-slate-600 transition outline-none text-center font-bold"
              />
              <button
                type="submit"
                className="w-full py-3 bg-slate-950/80 hover:bg-slate-900 border border-white/5 text-amber-300 font-bold text-[11px] rounded-2xl transition cursor-pointer select-none active:scale-95"
              >
                📚 Masuk Sebagai Tamu Offline
              </button>
            </form>

          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: EDIT PROFILE SETTINGS
      ========================================== */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[92vh] flex flex-col">
            <button 
              onClick={() => setShowEditProfileModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-350 transition z-10"
            >
              <X size={16} />
            </button>

            <h2 className="text-center text-sm font-black mb-4 text-white shrink-0">Edit Profil</h2>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 custom-scrollbar">
             {/* Miniature Interactive Preview Card (V2 Premium Upgrade) */}
             <div className="w-full h-28 rounded-2xl border border-violet-800/35 relative overflow-hidden bg-slate-950/60 mb-3 flex items-center justify-center shrink-0">
               {/* Dynamically render preview background */}
               {customBgUrl || selectedBgPreset ? (
                 (customBgUrl.startsWith('data:video/') || customBgUrl.endsWith('.mp4') || customBgUrl.endsWith('.webm') || customBgUrl.endsWith('.ogg')) ? (
                   <video
                     src={customBgUrl}
                     key={customBgUrl} // Force reload video when source changes
                     autoPlay
                     loop
                     muted
                     playsInline
                     className="absolute inset-0 w-full h-full object-cover"
                   />
                 ) : (
                   <div 
                     className={`absolute inset-0 ${(!customBgUrl.startsWith('http') && !customBgUrl.startsWith('data:image')) ? selectedBgPreset : ''}`}
                     style={{
                       backgroundImage: (customBgUrl.startsWith('http') || customBgUrl.startsWith('data:image')) ? `url(${customBgUrl})` : 'none',
                       backgroundSize: 'cover',
                       backgroundPosition: 'center',
                     }}
                   />
                 )
               ) : null}
               <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[0.5px]" />
               
               {/* Floating Avatar & File Pickers */}
               <div className="relative z-10 flex flex-col items-center space-y-1.5">
                 <div className="relative group">
                   <img
                     src={editAvatarBase64 || `https://ui-avatars.com/api/?name=User&background=2e1065&color=fff`}
                     alt="preview"
                     className="w-14 h-14 rounded-full border-2 border-amber-500 object-cover shadow-lg bg-slate-950"
                   />
                   <input
                     type="file"
                     id="avatar-upload"
                     accept="image/*"
                     onChange={handleAvatarFile}
                     className="hidden"
                   />
                   <label 
                     htmlFor="avatar-upload"
                     className="absolute inset-0 bg-slate-950/75 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer text-[8px] font-black text-amber-400 border border-amber-500/50"
                   >
                     GANTI FOTO
                   </label>
                 </div>
                 
                 <div className="flex gap-2">
                   <label 
                     htmlFor="avatar-upload"
                     className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 py-1 px-3 rounded-full text-[9px] font-black text-amber-400 cursor-pointer shadow-sm transition active:scale-95"
                   >
                     📸 Ganti Foto Profil
                   </label>
                 </div>
               </div>
             </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Readonly UID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-pink-500 uppercase tracking-wider">ID Pengguna (UID) - Tidak Bisa Diubah</label>
                  <input
                    type="text"
                    value={currentUser ? currentUser.uid : ''}
                    disabled
                    className="w-full bg-slate-950/80 border border-violet-900/20 px-3 py-2.5 rounded-xl text-xs text-slate-500 font-mono select-all cursor-not-allowed outline-none font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nama Tampilan</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={e => setEditDisplayName(e.target.value)}
                    placeholder="Nama Anda"
                    className="w-full bg-slate-950/60 border border-violet-900/40 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-violet-500 text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Username (USN)</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    placeholder="username"
                    className="w-full bg-slate-950/60 border border-violet-900/40 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-violet-500 text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tempat, Tanggal Lahir (TTL)</label>
                  <input
                    type="text"
                    value={editTtl}
                    onChange={e => setEditTtl(e.target.value)}
                    placeholder="Contoh: Jakarta, 1 Januari 2000"
                    className="w-full bg-slate-950/60 border border-violet-900/40 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-violet-500 text-white font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Kustom Latar Belakang Profil</label>
                  
                  {/* Presets */}
                  <div className="grid grid-cols-6 gap-1.5">
                    <button type="button" onClick={() => { setSelectedBgPreset('bg-gradient-to-tr from-indigo-900/60 to-slate-900/90'); setCustomBgUrl(''); }} className="w-full h-7 rounded-lg bg-gradient-to-tr from-indigo-900/60 to-slate-900/90 border border-white/10 active:scale-95 transition" title="Sky Midnight" />
                    <button type="button" onClick={() => { setSelectedBgPreset('bg-gradient-preset-1'); setCustomBgUrl(''); }} className="w-full h-7 rounded-lg bg-gradient-preset-1 border border-white/10 active:scale-95 transition" title="Royal Purple" />
                    <button type="button" onClick={() => { setSelectedBgPreset('bg-gradient-preset-2'); setCustomBgUrl(''); }} className="w-full h-7 rounded-lg bg-gradient-preset-2 border border-white/10 active:scale-95 transition" title="Pink Blossom" />
                    <button type="button" onClick={() => { setSelectedBgPreset('bg-gradient-preset-3'); setCustomBgUrl(''); }} className="w-full h-7 rounded-lg bg-gradient-preset-3 border border-white/10 active:scale-95 transition" title="Mint Forest" />
                    <button type="button" onClick={() => { setSelectedBgPreset('bg-gradient-preset-4'); setCustomBgUrl(''); }} className="w-full h-7 rounded-lg bg-gradient-preset-4 border border-white/10 active:scale-95 transition" title="Sunset Crimson" />
                    <button type="button" onClick={() => { setSelectedBgPreset('bg-gradient-preset-5'); setCustomBgUrl(''); }} className="w-full h-7 rounded-lg bg-gradient-preset-5 border border-white/10 active:scale-95 transition" title="Deep Sea" />
                  </div>
                  
                  {/* File Pickers (Gallery Picker) */}
                  <div className="flex gap-2 items-center mt-2.5">
                    <input
                      type="file"
                      id="bg-upload"
                      accept="image/*,video/*"
                      onChange={handleBgFileUpload}
                      className="hidden"
                    />
                    <label 
                      htmlFor="bg-upload"
                      className="flex-1 text-center bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/45 py-2.5 px-3 rounded-xl text-[10px] font-black text-violet-300 cursor-pointer shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      🎥 Pilih Foto/Video Galeri
                    </label>
                    
                    {customBgUrl && (
                      <button
                        type="button"
                        onClick={() => { setCustomBgUrl(''); setSelectedBgPreset('bg-gradient-to-tr from-indigo-900/60 to-slate-900/90'); }}
                        className="bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-[10px] font-black transition active:scale-95"
                        title="Hapus Kustom Latar Belakang"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-1 mt-1">
                    <label className="text-[8px] font-bold text-slate-500 uppercase block">Atau Input URL Latar Belakang Kustom</label>
                    <input 
                      type="text" 
                      value={customBgUrl}
                      onChange={(e) => setCustomBgUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... atau data:image..."
                      className="w-full bg-slate-950/60 border border-violet-900/40 px-3 py-2 rounded-xl text-xs text-white placeholder-slate-605 focus:outline-none focus:border-violet-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Deskripsi Akun</label>
                  <textarea
                    value={editDeskripsi}
                    onChange={e => setEditDeskripsi(e.target.value)}
                    placeholder="Ceritakan tentang dirimu..."
                    rows={2}
                    className="w-full bg-slate-950/60 border border-violet-900/40 px-3 py-2 rounded-xl text-xs outline-none focus:border-violet-500 text-white font-bold resize-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={saveProfileSettings}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-500 py-3.5 rounded-xl text-xs font-extrabold text-white cursor-pointer shadow-lg hover:brightness-110 active:scale-95 transition shrink-0"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: DELETE ACCOUNT CONFIRMATION (DOUBLE VERIFICATION)
      ========================================== */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-850 rounded-3xl w-full max-w-sm p-6 relative text-center space-y-4">
            <button 
              onClick={() => {
                setShowDeleteAccountModal(false);
                setDeleteConfirmChecked(false);
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
            >
              <X size={16} />
            </button>

            <div className="w-12 h-12 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center mx-auto text-xl text-red-500 animate-pulse">
              🚨
            </div>

            <h2 className="text-sm font-black text-white">Konfirmasi Penghapusan Akun</h2>

            {/* Peringatan 1 */}
            <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-3 text-[10px] text-red-400 font-bold leading-relaxed">
              ⚠️ PERINGATAN KESATU: Tindakan ini akan menghapus akun Anda secara permanen beserta seluruh skor kuis, pencapaian JLPT, dan data profil dari server kami!
            </div>

            {/* Peringatan 2 (Peringatan berupa tulisan 2 kali) */}
            <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-3 text-[10px] text-red-400 font-bold leading-relaxed">
              ⚠️ PERINGATAN KEDUA: Data yang dihapus tidak dapat dipulihkan kembali dengan cara apa pun! Semua pencapaian Anda akan dilenyapkan secara instan dari database server.
            </div>

            {/* Centang Opsi Verifikasi */}
            <label className="flex items-start gap-2.5 bg-slate-950/60 p-3 rounded-2xl border border-violet-900/20 text-left cursor-pointer select-none active:scale-[0.99] transition">
              <input
                type="checkbox"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                className="mt-0.5 border border-slate-700 bg-slate-950 rounded text-red-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-[10px] text-slate-300 leading-relaxed font-bold">
                Saya memahami risiko dan setuju untuk menghapus akun saya selamanya dari server.
              </span>
            </label>

            {/* Tombol Iya / Tidak */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteConfirmChecked(false);
                }}
                className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 font-extrabold text-xs rounded-xl transition cursor-pointer select-none active:scale-95 text-center"
              >
                Tidak (Batal)
              </button>

              <button
                type="button"
                onClick={handleDeleteAccountDirectly}
                disabled={!deleteConfirmChecked}
                className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed font-extrabold text-xs text-white rounded-xl transition cursor-pointer shadow-lg shadow-red-900/10 select-none active:scale-95 text-center"
              >
                Iya (Hapus Akun)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V2: MODAL FOR NETWORK LATENCY DIAGNOSTICS */}
      {showNetworkDiagnostics && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm p-6 relative text-center space-y-4 shadow-2xl">
            <button 
              type="button"
              onClick={() => setShowNetworkDiagnostics(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-350 transition w-6 h-6 rounded-full bg-slate-950 flex items-center justify-center cursor-pointer"
            >
              <span className="text-xs">✕</span>
            </button>

            <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto text-xl speedometer-pulse select-none">
              📶
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-black text-white">Diagnosa Latensi & Jaringan</h2>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Zenith Nihongo Premium Speedtest</p>
            </div>

            <div className="bg-slate-950/80 border border-violet-900/30 rounded-2xl p-4.5 space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-450 uppercase block tracking-wider">Ping Latency</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-emerald-450">{networkLatency !== null ? `${networkLatency}` : (diagnosingNetwork ? '...' : '--')}</span>
                    <span className="text-[9px] font-bold text-slate-500">ms</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-455 uppercase block tracking-wider">Jitter</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-cyan-400">{networkJitter !== null ? `${networkJitter}` : (diagnosingNetwork ? '...' : '--')}</span>
                    <span className="text-[9px] font-bold text-slate-500">ms</span>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-white/5 space-y-1.5">
                <span className="text-[9px] font-black text-slate-455 uppercase block tracking-wider">Kecepatan Unduh Estimasi</span>
                <div className="flex items-center justify-between">
                  <span className="text-md font-black text-white">{networkSpeed !== null ? networkSpeed : (diagnosingNetwork ? 'Menguji Bandwidth...' : '--')}</span>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                    networkLatency !== null && networkLatency < 100 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : networkLatency !== null
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                        : 'bg-slate-950 text-slate-550 border border-white/5'
                  }`}>
                    {networkLatency !== null && networkLatency < 100 ? 'Sangat Bagus ✓' : networkLatency !== null ? 'Cukup Layak' : 'Idle'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={startNetworkDiagnostics}
                disabled={diagnosingNetwork}
                className="flex-1 bg-gradient-to-r from-violet-600 to-pink-500 text-white font-extrabold text-[11px] py-3 rounded-2xl hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {diagnosingNetwork ? 'Sedang Mendiagnosa...' : 'Ulangi Diagnosa 🔄'}
              </button>
              <button
                type="button"
                onClick={() => setShowNetworkDiagnostics(false)}
                className="px-5 bg-slate-950 border border-white/10 text-slate-400 font-extrabold text-[11px] py-3 rounded-2xl hover:text-white active:scale-95 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V2: MODAL FOR CREDIT APP */}
      {showCreditApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm p-6 relative text-center space-y-4 shadow-2xl">
            <button 
              type="button"
              onClick={() => setShowCreditApp(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-350 transition w-6 h-6 rounded-full bg-slate-950 flex items-center justify-center cursor-pointer"
            >
              <span className="text-xs">✕</span>
            </button>

            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-2xl select-none">
              ✨
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-black text-white">Kontributor & Pembuat Aplikasi</h2>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Zenith Nihongo Development Team</p>
            </div>

            <div className="bg-slate-950/80 border border-violet-900/30 rounded-2xl p-4.5 space-y-3.5 text-left max-h-[220px] overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white">KR</div>
                  <div>
                    <h4 className="text-xs font-black text-white">Kira</h4>
                    <p className="text-[9px] font-bold text-slate-500">Lead Fullstack Architect & AI Engineer</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-xs font-black text-white">ZR</div>
                  <div>
                    <h4 className="text-xs font-black text-white">Zrill</h4>
                    <p className="text-[9px] font-bold text-slate-500">UI/UX Designer & Frontend Lead</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-black text-white">DY</div>
                  <div>
                    <h4 className="text-xs font-black text-white">Dyoa</h4>
                    <p className="text-[9px] font-bold text-slate-500">Database Optimizer & Devops Architect</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-black text-white">MT</div>
                  <div>
                    <h4 className="text-xs font-black text-white">Mutia</h4>
                    <p className="text-[9px] font-bold text-slate-500">Content Creator & Japanese Language Expert</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-xs font-black text-white">PR</div>
                  <div>
                    <h4 className="text-xs font-black text-white">Pirra</h4>
                    <p className="text-[9px] font-bold text-slate-500">Quality Assurance & Tester</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCreditApp(false)}
              className="w-full bg-slate-950 border border-white/10 text-slate-400 font-extrabold text-[11px] py-3 rounded-2xl hover:text-white active:scale-95 transition cursor-pointer"
            >
              Kembali
            </button>
          </div>
        </div>
      )}

      {/* V2: MODAL FOR DMCA POLICY DISCLAIMER */}
      {showDmcaDisclaimer && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm p-6 relative text-center space-y-4 shadow-2xl">
            <button 
              type="button"
              onClick={() => setShowDmcaDisclaimer(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-350 transition w-6 h-6 rounded-full bg-slate-950 flex items-center justify-center cursor-pointer"
            >
              <span className="text-xs">✕</span>
            </button>

            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-2xl select-none">
              ⚖️
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-black text-white">Kebijakan DMCA & Disclaimer</h2>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Syarat Ketentuan Layanan Zenith Nihongo</p>
            </div>

            <div className="bg-slate-950/80 border border-violet-900/30 rounded-2xl p-4 text-left max-h-[220px] overflow-y-auto pr-1 text-[10px] text-slate-400 font-bold leading-relaxed space-y-3.5 scrollbar-hide">
              <p>
                <strong>1. Penafian Konten (Disclaimer):</strong> Seluruh konten pembelajaran, materi tata bahasa, audio pelafalan kuis, dan kamus di Zenith Nihongo ditujukan untuk tujuan edukasi interaktif. Kami berusaha menyajikan data seakurat mungkin, namun tidak menjamin 100% keselarasan mutlak tanpa kesalahan penulisan.
              </p>
              <p>
                <strong>2. Kebijakan DMCA:</strong> Zenith Nihongo sangat menghormati hak kekayaan intelektual orang lain. Jika Anda menemukan materi berhak cipta milik Anda yang dimuat di aplikasi ini tanpa persetujuan, silakan hubungi kami dengan melampirkan bukti kepemilikan sah melalui Live Chat Admin. Kami akan memproses penghapusan materi dalam waktu 1x24 jam kerja.
              </p>
              <p>
                <strong>3. Penggunaan AI:</strong> Layanan asisten AI Sensei didukung oleh model bahasa besar. Tanggapan AI bersifat membimbing dan melatih. Tanggung jawab atas kemajuan belajar sepenuhnya berada pada dedikasi masing-masing pengguna.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowDmcaDisclaimer(false)}
              className="w-full bg-slate-950 border border-white/10 text-slate-400 font-extrabold text-[11px] py-3 rounded-2xl hover:text-white active:scale-95 transition cursor-pointer"
            >
              Saya Mengerti & Setuju
            </button>
          </div>
        </div>
      )}

      {/* V2: MODAL FOR LIVE SUPPORT CHAT TICKETING SYSTEM */}
      {activeHelpView !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl p-6 relative max-h-[92vh] flex flex-col border border-amber-500/25">
            <button 
              type="button"
              onClick={() => {
                setActiveHelpView(null);
                setActiveTicketId(null);
              }}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-350 transition w-7 h-7 rounded-full bg-slate-950 flex items-center justify-center border border-white/5 cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1 mb-5 shrink-0 flex flex-col items-center pt-2">
              <span className="text-xl">💁</span>
              <h2 className="text-sm font-black text-white tracking-wide">Pusat Bantuan & Live Chat</h2>
              <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">Tiket Obrolan Dengan Admin Zenith</p>
            </div>

            {activeHelpView === 'list' && (
              <div className="flex-1 overflow-y-auto flex flex-col space-y-4 pr-1 min-h-[300px]">
                {/* Create Ticket Section */}
                <div className="bg-slate-950/60 border border-violet-900/30 rounded-2xl p-4.5 space-y-3 shrink-0">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Buka Tiket Kendala Baru:</span>
                  <textarea
                    value={ticketQueryText}
                    onChange={(e) => setTicketQueryText(e.target.value)}
                    placeholder="Tulis kendala Anda di sini secara detail (misal: Salah beli item kuis, bug simulasi, dll)..."
                    rows={2.5}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40 font-semibold resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateHelpTicket}
                    className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-extrabold text-[11px] py-3 rounded-2xl hover:brightness-110 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    💬 Buka Tiket Baru & Hubungi Admin
                  </button>
                </div>

                {/* My Tickets List */}
                <div className="flex-1 flex flex-col space-y-2 text-left">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Riwayat Tiket Bantuan Anda:</span>
                  
                  {helpTickets.length === 0 ? (
                    <div className="py-10 text-center text-[10.5px] font-bold text-slate-500 border border-white/[0.03] rounded-2xl bg-white/[0.01] flex-1 flex flex-col items-center justify-center min-h-[100px]">
                      Tidak ada riwayat tiket aktif.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-hide">
                      {helpTickets.map(t => {
                        return (
                          <div 
                            key={t.id}
                            className="p-3.5 rounded-2xl bg-slate-950 border border-white/5 flex flex-col gap-2 hover:border-violet-900/30 transition duration-150"
                          >
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-[8px] font-mono text-slate-500">ID: {t.id.slice(0, 8)}</span>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                t.status === 'closed' 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : t.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {t.status === 'open' ? 'Buka (Menunggu)' : t.status === 'active' ? 'Aktif (Sedang Chat)' : 'Ditutup'}
                              </span>
                            </div>
                            
                            <p className="text-[10px] font-bold text-slate-200 line-clamp-1 text-left">{t.message}</p>
                            
                            <div className="flex gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTicketId(t.id);
                                  setActiveHelpView('chat');
                                }}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-[9px] uppercase tracking-wider py-1.5 rounded-xl cursor-pointer text-center"
                              >
                                Masuk Ruang Chat 💬
                              </button>
                              {t.status !== 'closed' && (
                                <button
                                  type="button"
                                  onClick={() => handleCloseTicket(t.id)}
                                  className="px-3 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 font-extrabold text-[9px] uppercase tracking-wider py-1.5 rounded-xl cursor-pointer text-center"
                                >
                                  Tutup
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeHelpView === 'chat' && (() => {
              const ticket = helpTickets.find(t => t.id === activeTicketId);
              if (!ticket) return <p className="text-xs font-bold text-slate-500">Memuat detail chat...</p>;
              
              const isWaiting = ticket.status === 'open';

              return (
                <div className="flex-1 flex flex-col min-h-[350px] justify-between">
                  {isWaiting && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold p-2.5 rounded-2xl flex items-center justify-center gap-2 animate-pulse mb-3 shrink-0">
                      <span>⏳</span> Menunggu admin bergabung ke obrolan...
                    </div>
                  )}

                  <div 
                    id="ticket-chat-scrollbox" 
                    className="flex-1 overflow-y-auto space-y-3 bg-slate-950/60 border border-violet-900/35 rounded-2xl p-3 max-h-[240px] text-left"
                  >
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1 text-left">
                      <span className="text-[8px] font-black text-amber-400 block tracking-widest uppercase">Pesan Awal Keluhan:</span>
                      <p className="text-[10.5px] font-bold text-slate-200">{ticket.message}</p>
                    </div>

                    {ticket.messages.map((m: any) => {
                      const isOwn = m.senderUid === currentUser.uid;
                      return (
                        <div 
                          key={m.id} 
                          className={`flex flex-col max-w-[80%] rounded-2xl p-3 border ${
                            isOwn 
                              ? 'bg-blue-600/[0.04] border-blue-500/10 ml-auto text-right' 
                              : 'bg-amber-500/[0.03] border-amber-500/10 text-left'
                          }`}
                        >
                          <span className={`text-[7px] font-black uppercase ${isOwn ? 'text-blue-400' : 'text-amber-400'}`}>
                            {isOwn ? 'Saya' : m.senderName || 'Admin'}
                          </span>
                          <p className="text-[10px] font-semibold text-slate-200 mt-0.5 leading-relaxed break-words whitespace-pre-wrap">{m.text}</p>
                          <span className="text-[6.5px] font-bold text-slate-500 font-mono mt-1 block">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={handleSendTicketMessage} className="flex gap-2 items-center border-t border-white/5 pt-3 mt-3 shrink-0">
                    <input
                      type="text"
                      value={ticketChatInput}
                      onChange={e => setTicketChatInput(e.target.value)}
                      placeholder={ticket.status === 'closed' ? "Tiket ditutup" : "Tulis balasan pesan..."}
                      disabled={ticket.status === 'closed'}
                      className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40 font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={ticket.status === 'closed' || !ticketChatInput.trim()}
                      className="w-9 h-9 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 border border-amber-300/40 text-slate-950 flex items-center justify-center text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer disabled:opacity-40 disabled:scale-100"
                    >
                      ✈️
                    </button>
                  </form>
                  
                  <button
                    type="button"
                    onClick={() => setActiveHelpView('list')}
                    className="w-full mt-3 bg-white/5 hover:bg-white/10 text-white font-extrabold text-[10px] py-2 rounded-xl border border-white/5 transition"
                  >
                    ← Kembali ke Daftar Tiket
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: JLPT LEVEL SELECTOR EXAM MODE
      ========================================== */}
      {showJlptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm p-6 relative text-center space-y-4">
            <button 
              onClick={() => setShowJlptModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
            >
              <X size={16} />
            </button>

            <span className="text-3xl">🎓</span>
            <h2 className="text-sm font-black text-white">Simulasi Ujian JLPT Resmi</h2>
            <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
              Aturan Penting: Durasi waktu disesuaikan dengan proporsi ujian asli. Berpindah dari layar kuis kuis (seperti berpindah tab browser) akan dikenakan deduksi denda penalti skor secara masif!
            </p>

            <div className="grid grid-cols-1 gap-2.5 pt-2 font-bold text-xs select-none">
              <button 
                onClick={() => runJlptExam('n5')}
                className="w-full py-3.5 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-blue-600/20 to-violet-600/20 text-blue-300 cursor-pointer hover:scale-[1.01] duration-150"
              >
                N5 (Waktu Resmi: 60 Menit - 25 Soal)
              </button>
              <button 
                onClick={() => runJlptExam('n4')}
                className="w-full py-3.5 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-300 cursor-pointer hover:scale-[1.01] duration-150"
              >
                N4 (Waktu Resmi: 80 Menit - 25 Soal)
              </button>
              <button 
                onClick={() => runJlptExam('n3')}
                className="w-full py-3.5 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-amber-600/20 to-orange-600/20 text-amber-300 cursor-pointer hover:scale-[1.01] duration-150"
              >
                N3 (Waktu Resmi: 100 Menit - 30 Soal)
              </button>
              <button 
                onClick={() => runJlptExam('n2')}
                className="w-full py-3.5 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-red-600/20 to-pink-600/20 text-red-300 cursor-pointer hover:scale-[1.01] duration-150"
              >
                N2 (Waktu Resmi: 105 Menit - 30 Soal)
              </button>
              <button 
                onClick={() => runJlptExam('n1')}
                className="w-full py-3.5 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-purple-600/25 to-pink-600/25 text-purple-300 cursor-pointer hover:scale-[1.01] duration-150"
              >
                N1 (Waktu Resmi: 110 Menit - 30 Soal)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CUSTOM REUSABLE CONFIRM DIALOG
      ========================================== */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-violet-800 rounded-3xl w-full max-w-sm p-6 relative text-center space-y-4 shadow-2xl animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-violet-950 border border-violet-800 flex items-center justify-center mx-auto text-xl text-amber-400 font-bold select-none">
              ⚠️
            </div>
            <h2 className="text-sm font-black text-white">{confirmDialog.title}</h2>
            <p className="text-[11px] text-slate-300 leading-relaxed font-bold">
              {confirmDialog.message}
            </p>
            <div className="flex items-center gap-3 pt-2 font-bold text-xs select-none">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 rounded-xl border border-violet-800 bg-slate-900 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                {confirmDialog.cancelText || 'Batal'}
              </button>
              <button
                onClick={() => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  confirmDialog.onConfirm();
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                {confirmDialog.confirmText || 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL/BOTTOM SHEET: NATIVE APK GOOGLE ACCOUNT SELECTOR
          (Mimics the exact premium winking chibi and official accounts selector in NanimeID APK!)
      ========================================== */}
      {showGoogleAPKSheet && (
        <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div 
            className="w-full sm:max-w-md bg-slate-900 border-t sm:border border-violet-900/80 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-5 animate-slideUp relative max-h-[85vh] overflow-y-auto select-none"
          >
            {/* Close button */}
            <button 
              onClick={() => {
                setShowGoogleAPKSheet(false);
                setShowGoogleAPKInput(false);
                setGoogleAPKCustomEmail('');
              }}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 transition w-8 h-8 rounded-full bg-slate-950 border border-violet-900/30 flex items-center justify-center cursor-pointer"
            >
              <X size={15} />
            </button>

            {/* Header info */}
            <div className="flex items-center gap-3.5 border-b border-violet-950 pb-4">
              <div className="w-10 h-10 rounded-full bg-slate-950 border border-violet-850/60 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.21 7.78 8.9 5.04 12 5.04z"/>
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.64z"/>
                  <path fill="#FBBC05" d="M5.28 14.78c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28L1.39 7.2C.51 8.96 0 10.92 0 13s.51 4.04 1.39 5.8l3.89-3.02z"/>
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.09.73-2.5 1.16-4.2 1.16-3.1 0-5.79-2.74-6.72-5.54l-3.89 3.02C3.37 20.33 7.35 23 12 23z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Pilih akun Google Anda</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">untuk melanjutkan ke Nihongo Master</p>
              </div>
            </div>

            {/* Spinner loader state */}
            {googleAPKLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={24} className="animate-spin text-pink-500" />
                <span className="text-xs font-black text-slate-300">Menghubungkan ke Akun Google...</span>
              </div>
            ) : showGoogleAPKInput ? (
              /* Custom Email input form */
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Masukkan Email Google Anda</label>
                  <input
                    type="email"
                    value={googleAPKCustomEmail}
                    onChange={e => setGoogleAPKCustomEmail(e.target.value)}
                    placeholder="nama.kamu@gmail.com"
                    className="w-full bg-slate-950 border border-violet-900/60 px-4 py-3 rounded-2xl text-xs outline-none focus:border-pink-500 text-white font-bold transition"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2.5 pt-2 text-xs font-bold font-sans">
                  <button
                    onClick={() => setShowGoogleAPKInput(false)}
                    className="flex-1 py-3.5 rounded-2xl border border-violet-900/40 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={() => {
                      if (!googleAPKCustomEmail || !googleAPKCustomEmail.includes('@')) {
                        triggerToast('Harap masukkan alamat email Google yang valid.', 'error');
                        return;
                      }
                      setGoogleAPKLoading(true);
                      
                      const email = googleAPKCustomEmail.trim();
                      const name = email.split('@')[0];
                      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ec4899&color=fff`;
                      
                      fetch(API_BASE + '/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, displayName: name, avatar })
                      })
                      .then(r => r.json())
                      .then(res => {
                        setTimeout(() => {
                          setGoogleAPKLoading(false);
                          if (res.status === 'success') {
                            setCurrentUser(res.data);
                            localStorage.setItem('nik_auth_uid', res.data.uid);
                            setLocalPoin(res.data.poin);
                            setLocalXp(res.data.xp);
                            setShowGoogleAPKSheet(false);
                            setShowGoogleAPKInput(false);
                            setGoogleAPKCustomEmail('');
                            setShowAuthModal(false);
                            triggerToast(`Berhasil masuk sebagai ${res.data.displayName}!`, 'success');
                          } else {
                            triggerToast(res.message || 'Gagal autentikasi Google.', 'error');
                          }
                        }, 1000);
                      })
                      .catch(() => {
                        setGoogleAPKLoading(false);
                        triggerToast('Gagal terhubung ke server.', 'error');
                      });
                    }}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-500 text-white hover:brightness-110 active:scale-95 transition cursor-pointer"
                  >
                    Masuk Sekarang
                  </button>
                </div>
              </div>
            ) : (
              /* Account rows list selector */
              <div className="space-y-2.5 animate-fadeIn">
                {[
                  { name: 'Nihongo Student', email: 'student@gmail.com', avatar: '🎒' }
                ].map(acc => (
                  <button
                    key={acc.email}
                    onClick={() => {
                      setGoogleAPKLoading(true);
                      const email = acc.email;
                      const name = acc.name;
                      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ec4899&color=fff`;
                      
                      fetch(API_BASE + '/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, displayName: name, avatar })
                      })
                      .then(r => r.json())
                      .then(res => {
                        setTimeout(() => {
                          setGoogleAPKLoading(false);
                          if (res.status === 'success') {
                            setCurrentUser(res.data);
                            localStorage.setItem('nik_auth_uid', res.data.uid);
                            setLocalPoin(res.data.poin);
                            setLocalXp(res.data.xp);
                            setShowGoogleAPKSheet(false);
                            setShowAuthModal(false);
                            triggerToast(`Berhasil masuk sebagai ${res.data.displayName}!`, 'success');
                          } else {
                            triggerToast(res.message || 'Gagal masuk dengan Google.', 'error');
                          }
                        }, 1000);
                      })
                      .catch(() => {
                        setGoogleAPKLoading(false);
                        triggerToast('Gagal terhubung ke server.', 'error');
                      });
                    }}
                    className="w-full text-left p-3.5 rounded-2xl bg-slate-950/60 border border-violet-950 hover:border-pink-500/50 hover:bg-violet-950/10 transition cursor-pointer flex items-center gap-3 relative overflow-hidden group select-none active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-full bg-pink-500/10 flex items-center justify-center text-sm border border-pink-500/30 shrink-0">
                      {acc.avatar}
                    </div>
                    <div className="space-y-0.5 pr-4">
                      <span className="text-xs font-black text-white block leading-tight">{acc.name}</span>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">{acc.email}</p>
                    </div>
                  </button>
                ))}

                {/* Gunakan akun lain row */}
                <button
                  onClick={() => setShowGoogleAPKInput(true)}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-950 border border-violet-900/40 hover:bg-violet-950/10 text-xs font-extrabold text-slate-350 hover:text-pink-400 transition cursor-pointer flex items-center gap-2.5 active:scale-[0.98]"
                >
                  <span>➕</span> Gunakan akun Google lainnya
                </button>
              </div>
            )}

            {/* Bottom disclaimer */}
            <p className="text-[9px] text-slate-450 leading-relaxed font-semibold pt-1 select-none">
              Untuk melanjutkan pendaftaran, Google akan membagikan nama, alamat email, dan foto profil Anda kepada <b>Nihongo Master</b> secara aman dan terenkripsi.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
