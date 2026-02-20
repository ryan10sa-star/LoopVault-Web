import { useEffect, useState } from 'react';

export function useOfflineStatus(): boolean {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
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
