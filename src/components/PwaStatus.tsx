import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaStatusProps {
  activeGame: boolean;
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const PwaStatus: React.FC<PwaStatusProps> = ({ activeGame }) => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [updating, setUpdating] = useState(false);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  const canRegister = useMemo(
    () => import.meta.env.PROD && 'serviceWorker' in navigator,
    [],
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDismissedInstall(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  useEffect(() => {
    if (!canRegister) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const inspectWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onState = () => {
        if (cancelled) return;
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      };
      worker.addEventListener('statechange', onState);
      onState();
    };

    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((nextRegistration) => {
        if (cancelled) return;
        registration = nextRegistration;
        if (registration.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting);
        inspectWorker(registration.installing);
        registration.addEventListener('updatefound', () => inspectWorker(registration?.installing ?? null));
        void registration.update().catch(() => {});
      })
      .catch((error) => {
        console.warn('Micro Arcade service worker registration failed:', error);
      });

    return () => {
      cancelled = true;
      registration = null;
    };
  }, [canRegister]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setInstallPrompt(null);
    }
  };

  const activateUpdate = () => {
    if (!waitingWorker || updating) return;
    setUpdating(true);
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(reload, 4000);
  };

  if (!online) {
    return (
      <div className="pwa-status-safe fixed left-3 sm:left-5 z-[90] pointer-events-none" aria-live="polite">
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-[#111114]/95 px-3 py-2 text-[11px] font-mono-arcade text-amber-200 shadow-xl backdrop-blur">
          <WifiOff className="h-3.5 w-3.5" />
          <span>{activeGame ? 'OFFLINE • LOCAL PLAY CONTINUES' : 'OFFLINE • CACHED ARCADE AVAILABLE'}</span>
        </div>
      </div>
    );
  }

  if (waitingWorker && !activeGame) {
    return (
      <div className="pwa-status-safe fixed inset-x-3 sm:left-auto sm:right-5 sm:w-[360px] z-[90]" aria-live="polite">
        <div className="rounded-2xl border border-cyan-500/30 bg-[#111114]/98 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300">
              <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-white">Arcade update ready</div>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                Activate it when you are ready. Active game sessions are never force-reloaded.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWaitingWorker(null)}
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
              aria-label="Dismiss update notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={activateUpdate}
            disabled={updating}
            className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
            {updating ? 'UPDATING…' : 'UPDATE NOW'}
          </button>
        </div>
      </div>
    );
  }

  if (installPrompt && !installed && !dismissedInstall && !activeGame) {
    return (
      <div className="pwa-status-safe fixed right-3 sm:right-5 z-[80]" aria-live="polite">
        <div className="flex items-center gap-2 rounded-xl border border-[#3F3F46] bg-[#111114]/95 p-2 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={() => void install()}
            className="flex min-h-10 items-center gap-2 rounded-lg bg-[#F43F5E] px-3 py-2 text-[10px] font-mono-arcade font-black text-white hover:bg-rose-500"
          >
            <Download className="h-3.5 w-3.5" /> INSTALL ARCADE
          </button>
          <button
            type="button"
            onClick={() => setDismissedInstall(true)}
            className="min-h-10 min-w-10 rounded-lg text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Dismiss install prompt"
          >
            <X className="mx-auto h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (installed && !activeGame && !navigator.serviceWorker?.controller && canRegister) {
    return (
      <div className="pwa-status-safe fixed right-3 z-[70] pointer-events-none opacity-0" aria-hidden="true">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }

  return null;
};
