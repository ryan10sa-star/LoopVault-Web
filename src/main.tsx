import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import './styles.css';

let hasMountedReactTree = false;
const LAST_RUNTIME_ERROR_KEY = 'loopvault:lastRuntimeError';
const CHUNK_RECOVERY_RELOAD_KEY = 'loopvault:chunkRecoveryReloaded';
const SW_RECOVERY_ONCE_KEY = 'loopvault:swRecoveryRan.v2';

function rememberRuntimeError(message: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LAST_RUNTIME_ERROR_KEY, message);
  } catch {
    // ignore storage failures
  }
}

function renderBootError(message: string): void {
  rememberRuntimeError(message);
  if (hasMountedReactTree) {
    console.error('Post-mount runtime error:', message);
    return;
  }
  const root = document.getElementById('root');
  if (!root) {
    return;
  }
  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;color:#f8fafc;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <section style="max-width:700px;width:100%;border:1px solid #fbbf24;border-radius:12px;background:#1e293b;padding:16px;">
        <h1 style="margin:0;font-size:20px;font-weight:700;color:#fbbf24;">Startup Error</h1>
        <p style="margin:8px 0 0;font-size:14px;line-height:1.4;color:#e2e8f0;">${escapeHtml(message)}</p>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.4;color:#cbd5e1;">Use Reload and send this error text for a direct fix.</p>
      </section>
    </main>
  `;
}

function isChunkLoadFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('chunkloaderror') ||
    normalized.includes('loading chunk') ||
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('importing a module script failed') ||
    normalized.includes('dynamically imported module')
  );
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? value.message;
  }
  return String(value);
}

function tryRecoverChunkLoadFailure(rawError: unknown): boolean {
  const message = toErrorMessage(rawError);
  if (!isChunkLoadFailureMessage(message)) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(CHUNK_RECOVERY_RELOAD_KEY) === '1') {
      return false;
    }
    window.sessionStorage.setItem(CHUNK_RECOVERY_RELOAD_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.addEventListener('error', (event) => {
  if (tryRecoverChunkLoadFailure(event.error ?? event.message)) {
    return;
  }
  const message = event.error instanceof Error ? event.error.stack ?? event.error.message : String(event.message ?? 'Unknown startup error');
  renderBootError(message);
});

window.addEventListener('unhandledrejection', (event) => {
  if (tryRecoverChunkLoadFailure(event.reason)) {
    return;
  }
  const reason = event.reason;
  if (reason instanceof Error) {
    renderBootError(reason.stack ?? reason.message);
    return;
  }
  renderBootError(String(reason));
});

function shouldRunServiceWorkerRecovery(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.location.hostname === 'localhost') {
    return false;
  }
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  try {
    return window.sessionStorage.getItem(SW_RECOVERY_ONCE_KEY) !== '1';
  } catch {
    return true;
  }
}

function markServiceWorkerRecoveryRan(): void {
  try {
    window.sessionStorage.setItem(SW_RECOVERY_ONCE_KEY, '1');
  } catch {
    // ignore storage failures
  }
}

async function runOneTimeServiceWorkerRecovery(): Promise<void> {
  if (!shouldRunServiceWorkerRecovery()) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      markServiceWorkerRecoveryRan();
      return;
    }

    markServiceWorkerRecoveryRan();
    await Promise.all(registrations.map(async (registration) => await registration.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(async (key) => await caches.delete(key)));
    }

    window.location.reload();
  } catch {
    markServiceWorkerRecoveryRan();
  }
}

void runOneTimeServiceWorkerRecovery();

if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  }
  if ('caches' in window) {
    void caches.keys().then((keys) => {
      keys.forEach((key) => {
        void caches.delete(key);
      });
    });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found.');
}

try {
  hasMountedReactTree = true;
  ReactDOM.createRoot(rootElement).render(
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
} catch (error) {
  hasMountedReactTree = false;
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  renderBootError(message);
}
