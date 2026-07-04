import React, { Suspense, lazy, useEffect } from 'react';
import { AppProviders } from '@/context';
import { ToastContainer } from '@/components/ui';
import { BottomNav, Sidebar, TopBar } from '@/components/layout';
import { useAuth, useUI, useTheme, useQuiz } from '@/context';

const QuizTab = lazy(() => import('@/components/quiz/QuizTab').then(m => ({ default: m.QuizTab })));
const KamusTab = lazy(() => import('@/components/kamus/KamusTab').then(m => ({ default: m.KamusTab })));
const PracticeTab = lazy(() => import('@/components/practice/PracticeTab').then(m => ({ default: m.PracticeTab })));
const ChatTab = lazy(() => import('@/components/chat/ChatTab').then(m => ({ default: m.ChatTab })));
const RankingTab = lazy(() => import('@/components/ranking/RankingTab').then(m => ({ default: m.RankingTab })));
const PencapaianTab = lazy(() => import('@/components/pencapaian/PencapaianTab').then(m => ({ default: m.PencapaianTab })));
const ProfilTab = lazy(() => import('@/components/profile/ProfilTab').then(m => ({ default: m.ProfilTab })));
const RiwayatTab = lazy(() => import('@/components/riwayat/RiwayatTab').then(m => ({ default: m.RiwayatTab })));
const SettingTab = lazy(() => import('@/components/setting/SettingTab').then(m => ({ default: m.SettingTab })));

const TAB_COMPONENTS = {
  kuis: QuizTab,
  kamus: KamusTab,
  practice: PracticeTab,
  chat: ChatTab,
  ranking: RankingTab,
  pencapaian: PencapaianTab,
  profil: ProfilTab,
  riwayat: RiwayatTab,
  setting: SettingTab,
};

function AppContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { state: uiState, addToast } = useUI();
  const { applyTheme } = useTheme();
  const { currentDay } = useQuiz();

  const activeTab = uiState.activeTab;

  useEffect(() => {
    applyTheme('sakura');
  }, [applyTheme]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      // Store for later use
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt as EventListener);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 animate-pulse" />
          <p className="text-slate-400">Memuat Zenith Nihongo...</p>
        </div>
      </div>
    );
  }

  const ActiveComponent = TAB_COMPONENTS[activeTab as keyof typeof TAB_COMPONENTS] || QuizTab;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-x-hidden">
      <TopBar />
      <Sidebar />
      <main className="lg:pl-64 pt-16 lg:pt-0 pb-24 md:pb-32 min-h-screen">
        <Suspense fallback={
          <div className="p-6 space-y-4">
            <div className="h-8 bg-slate-800/50 rounded-xl animate-pulse w-1/4" />
            <div className="h-4 bg-slate-800/50 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-slate-800/50 rounded animate-pulse w-1/3" />
          </div>
        }>
          <ActiveComponent />
        </Suspense>
      </main>
      <BottomNav />
      <ToastContainer toasts={uiState.toasts} onClose={addToast} position="bottom-right" />
      <div id="app-preloader" className="hidden" />
    </div>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}