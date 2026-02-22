import { useEffect, useState } from 'react';

export function useOfflineStatus(): boolean {
  const initialOffline = typeof navigator === 'undefined' ? false : !navigator.onLine;
  const [isOffline, setIsOffline] = useState<boolean>(initialOffline);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const onOnline = (): void => setIsOffline(false);
    const onOffline = (): void => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOffline;
}
