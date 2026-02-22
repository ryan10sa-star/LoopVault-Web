import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { loadSitePreferences, SITE_PREFERENCES_UPDATED_EVENT } from '../config/sitePreferences';

const KONAMI_SEQUENCE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const MAGIC_WORD = 'loopvault';
const NAV_SECRET_PATTERN = ['/', '/help', '/settings', '/handover'];

interface LayoutProps {
  children?: ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const isOffline = useOfflineStatus();
  const isHomeRoute = typeof window !== 'undefined' ? window.location.pathname === '/' : false;
  const [celebrationEnabled, setCelebrationEnabled] = useState<boolean>(true);
  const [eggToast, setEggToast] = useState<string>('');
  const [titleTapCount, setTitleTapCount] = useState<number>(0);
  const [offlineTapCount, setOfflineTapCount] = useState<number>(0);
  const [navTrail, setNavTrail] = useState<string[]>([]);
  const [keyHistory, setKeyHistory] = useState<string[]>([]);
  const [typedHistory, setTypedHistory] = useState<string>('');

  useEffect(() => {
    const syncCelebrationMode = (): void => {
      setCelebrationEnabled(loadSitePreferences().celebrationModeEnabled);
    };
    syncCelebrationMode();

    const onStorage = (event: StorageEvent): void => {
      if (event.key === null || event.key === 'loopvault.sitePreferences.v1') {
        syncCelebrationMode();
      }
    };

    window.addEventListener(SITE_PREFERENCES_UPDATED_EVENT, syncCelebrationMode as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(SITE_PREFERENCES_UPDATED_EVENT, syncCelebrationMode as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!eggToast) {
      return;
    }
    const timeoutId = window.setTimeout(() => setEggToast(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [eggToast]);

  useEffect(() => {
    if (!celebrationEnabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      setKeyHistory((current) => [...current, key].slice(-KONAMI_SEQUENCE.length));
      setTypedHistory((current) => `${current}${key.length === 1 ? key : ''}`.slice(-MAGIC_WORD.length));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [celebrationEnabled]);

  useEffect(() => {
    if (!celebrationEnabled) {
      return;
    }
    if (keyHistory.length === KONAMI_SEQUENCE.length && keyHistory.every((value, index) => value === KONAMI_SEQUENCE[index])) {
      setEggToast('Easter Egg: Konami handshake accepted. Field legend mode unlocked.');
      setKeyHistory([]);
    }
  }, [celebrationEnabled, keyHistory]);

  useEffect(() => {
    if (!celebrationEnabled) {
      return;
    }
    if (typedHistory.endsWith(MAGIC_WORD)) {
      setEggToast('Easter Egg: You typed the vault spell. Offline wizardry approved.');
      setTypedHistory('');
    }
  }, [celebrationEnabled, typedHistory]);

  useEffect(() => {
    if (!celebrationEnabled) {
      return;
    }
    if (titleTapCount >= 7) {
      setEggToast('Easter Egg: Hidden panel tapped. The calibration gremlin salutes you.');
      setTitleTapCount(0);
    }
  }, [celebrationEnabled, titleTapCount]);

  useEffect(() => {
    if (!celebrationEnabled) {
      return;
    }
    if (offlineTapCount >= 3) {
      setEggToast('Easter Egg: Triple-tap offline banner. Signal? Never heard of it.');
      setOfflineTapCount(0);
    }
  }, [celebrationEnabled, offlineTapCount]);

  useEffect(() => {
    if (!celebrationEnabled) {
      return;
    }
    if (navTrail.length < NAV_SECRET_PATTERN.length) {
      return;
    }
    const recent = navTrail.slice(-NAV_SECRET_PATTERN.length);
    const matched = recent.every((value, index) => value === NAV_SECRET_PATTERN[index]);
    if (matched) {
      setEggToast('Easter Egg: Secret route chain complete. Planner-level teleport unlocked.');
      setNavTrail([]);
    }
  }, [celebrationEnabled, navTrail]);

  const headerTitleClassName = useMemo(
    () => `lv-title ${celebrationEnabled ? 'cursor-pointer select-none' : ''}`,
    [celebrationEnabled]
  );

  return (
    <div className="lv-shell">
      {isOffline ? (
        <div className="bg-amber-300 px-4 py-2 text-center text-sm font-bold text-slate-900" onClick={() => setOfflineTapCount((current) => current + 1)}>
          Offline Mode Active • All data saved locally
        </div>
      ) : null}
      <header className="lv-header p-4">
        <div className={`mx-auto max-w-md ${isHomeRoute ? 'text-center' : 'flex items-center justify-between gap-2'}`}>
          <h1 className={headerTitleClassName} onClick={() => setTitleTapCount((current) => current + 1)}>
            LoopVault Web
          </h1>
          {!isHomeRoute ? (
            <nav className="flex flex-wrap justify-end gap-2">
              <Link className="lv-btn-secondary" onClick={() => setNavTrail((current) => [...current, '/'].slice(-10))} to="/">
                Home
              </Link>
              <Link className="lv-btn-secondary" onClick={() => setNavTrail((current) => [...current, '/help'].slice(-10))} to="/help">
                Help
              </Link>
              <Link className="lv-btn-secondary" onClick={() => setNavTrail((current) => [...current, '/settings'].slice(-10))} to="/settings">
                Settings
              </Link>
              <Link className="lv-btn-secondary" onClick={() => setNavTrail((current) => [...current, '/handover'].slice(-10))} to="/handover">
                Handover
              </Link>
              <Link className="lv-btn-secondary" onClick={() => setNavTrail((current) => [...current, '/tags'].slice(-10))} to="/tags">
                Tags
              </Link>
              <Link className="lv-btn-secondary" onClick={() => setNavTrail((current) => [...current, '/exceptions'].slice(-10))} to="/exceptions">
                Exceptions
              </Link>
            </nav>
          ) : null}
        </div>
      </header>
      {celebrationEnabled && eggToast ? (
        <div className="pointer-events-none fixed left-1/2 top-3 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-xl border border-violet-300 bg-violet-900/95 px-3 py-2 text-center text-xs font-semibold text-violet-100 shadow-lg shadow-slate-950/60">
          {eggToast}
        </div>
      ) : null}
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
