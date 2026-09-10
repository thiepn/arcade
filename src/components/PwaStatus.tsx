import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { getStorageStatus, retryStoragePersistence, STORAGE_STATUS_EVENT } from '../lib/storage';

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
  const [storageStatus, setStorageStatus] = useState(getStorageStatus);
  const [dismissedStorageWarning, setDismissedStorageWarning] = useState(false);
  const [reloadReady, setReloadReady] = useState(false);
  const updateRequested = useRef(false);
  const controlledAtMount = useRef(Boolean(navigator.serviceWorker?.controller));
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activateUpdate = (worker = waitingWorker) => {
    if (!worker || updating) return;
    setUpdating(true);
    updateRequested.current = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
    updateTimer.current = setTimeout(() => setUpdating(false), 8000);
  };

  useEffect(() => {
    const syncStorage = () => {
      const next = getStorageStatus();
      setStorageStatus(next);
      if (next.mode === 'persistent') setDismissedStorageWarning(false);
    };
    const retryStorage = () => {
      if (getStorageStatus().mode !== 'persistent') retryStoragePersistence();
      syncStorage();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') retryStorage();
    };
    const onController = () => {
      const replacingExistingController = controlledAtMount.current;
      controlledAtMount.current = true;
      if (!replacingExistingController && !updateRequested.current) return;
      if (updateTimer.current) clearTimeout(updateTimer.current);
      setReloadReady(true);
    };

    window.addEventListener(STORAGE_STATUS_EVENT, syncStorage);
    window.addEventListener('focus', retryStorage);
    window.addEventListener('pageshow', retryStorage);
    document.addEventListener('visibilitychange', onVisibility);
    navigator.serviceWorker?.addEventListener('controllerchange', onController);
    const retryTimer = window.setTimeout(retryStorage, 2500);

    return () => {
      window.removeEventListener(STORAGE_STATUS_EVENT, syncStorage);
      window.removeEventListener('focus', retryStorage);
      window.removeEventListener('pageshow', retryStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      navigator.serviceWorker?.removeEventListener('controllerchange', onController);
      window.clearTimeout(retryTimer);
      if (updateTimer.current) clearTimeout(updateTimer.current);
    };
  }, []);

  useEffect(() => {
    if (reloadReady && !activeGame) window.location.reload();
  }, [reloadReady, activeGame]);

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
    const cleanups: Array<() => void> = [];

    const inspectWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onState = () => {
        if (cancelled) return;
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      };
      worker.addEventListener('statechange', onState);
      cleanups.push(() => worker.removeEventListener('statechange', onState));
      onState();
    };

    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      .then((nextRegistration) => {
        if (cancelled) return;
        registration = nextRegistration;
        if (registration.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting);
        inspectWorker(registration.installing);
        const onUpdate = () => inspectWorker(nextRegistration.installing);
        registration.addEventListener('updatefound', onUpdate);
        cleanups.push(() => nextRegistration.removeEventListener('updatefound', onUpdate));
        void registration.update().catch(() => {});
      })
      .catch((error) => {
        console.warn('Micro Arcade service worker registration failed:', error);
      });

    return () => {
      cancelled = true;
      cleanups.forEach(cleanup => cleanup());
      registration = null;
    };
  }, [canRegister]);

  useEffect(() => {
    if (!waitingWorker || activeGame || updating) return;
    const timer = setTimeout(() => activateUpdate(waitingWorker), 150);
    return () => clearTimeout(timer);
  }, [waitingWorker, activeGame, updating]);

  const install = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
    } finally {
      setInstallPrompt(null);
    }
  };

  if (storageStatus.warning && !dismissedStorageWarning) {
    const detail = storageStatus.lastFailure === 'quota'
      ? 'Browser storage is full. Progress is temporarily kept for this tab while Micro Arcade retries automatically.'
      : storageStatus.lastFailure === 'denied'
        ? 'Browser storage is blocked. Progress is temporarily kept for this tab while Micro Arcade retries automatically.'
        : 'Persistent browser storage is unavailable. Progress is temporarily kept for this tab while Micro Arcade retries automatically.';
    return (
      <div role="status" aria-live="polite" className="pwa-status-safe fixed inset-x-3 sm:left-auto sm:right-5 sm:w-[420px] z-[90] rounded-xl border border-amber-500/40 bg-[#111114]/98 px-3 py-2 text-xs text-amber-200 shadow-xl backdrop-blur">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">{detail}</span>
          <button
            type="button"
            onClick={() => setDismissedStorageWarning(true)}
            className="-mr-1 -mt-1 min-h-8 min-w-8 rounded-lg text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-100"
            aria-label="Dismiss storage warning"
          >
            <X className="mx-auto h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

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
              <div className="text-xs font-black text-white">Updating Micro Arcade</div>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                The new build will activate automatically. Active game sessions are never force-reloaded.
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
            onClick={() => void install().catch(() => {})}
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
