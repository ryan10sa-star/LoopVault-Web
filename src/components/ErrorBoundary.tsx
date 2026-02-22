import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      window.localStorage.setItem('loopvault:lastRuntimeError', `${error.stack ?? error.message}\n\n${errorInfo.componentStack ?? ''}`);
    } catch {
      // ignore storage failures
    }
    console.error('Unhandled application error:', error, errorInfo);
  }

  private readonly onGoHome = (): void => {
    window.location.assign('/');
  };

  private readonly onRecoverData = (): void => {
    window.location.assign('/diagnostics');
  };

  private readonly onReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 bg-slate-900 p-4 text-white">
        <section className="rounded-xl border border-amber-400 bg-slate-800 p-4">
          <h1 className="text-xl font-bold text-amber-300">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-100">Your local data is still on this device. Choose a safe recovery action below.</p>
          <div className="mt-4 grid gap-3">
            <button className="min-h-[44px] rounded-lg bg-safety px-4 py-3 font-bold text-black" onClick={this.onRecoverData} type="button">
              Recover Data
            </button>
            <button className="min-h-[44px] rounded-lg bg-slate-100 px-4 py-3 font-bold text-slate-900" onClick={this.onGoHome} type="button">
              Go Home
            </button>
            <button className="min-h-[44px] rounded-lg border border-slate-400 bg-slate-100 px-4 py-3 font-bold text-slate-900" onClick={this.onReload} type="button">
              Reload App
            </button>
          </div>
        </section>
      </main>
    );
  }
}
