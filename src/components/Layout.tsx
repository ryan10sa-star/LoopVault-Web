import { Link } from 'react-router-dom';

interface LayoutProps {
  children?: unknown;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 p-4">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-safety">LoopVault Web</h1>
          <nav className="flex gap-2">
            <Link className="rounded-lg bg-slate-800 px-3 py-2 text-sm" to="/">
              Home
            </Link>
            <Link className="rounded-lg bg-slate-800 px-3 py-2 text-sm" to="/tags">
              Tags
            </Link>
            <Link className="rounded-lg bg-slate-800 px-3 py-2 text-sm" to="/diagnostics">
              Diagnostics
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
