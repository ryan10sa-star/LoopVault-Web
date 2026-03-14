import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Login(): JSX.Element {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const onSubmit = async (event: { preventDefault(): void }): Promise<void> => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const { error: authError } = await signIn(email.trim(), password);
    setBusy(false);
    if (authError) {
      setError(authError);
      return;
    }
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <h1 className="lv-title mb-1 text-center text-2xl">LoopVault</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Field Calibration Assistant</p>

        <form className="lv-panel space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="text-base font-bold text-slate-100">Sign In</h2>

          {error ? (
            <div className="rounded border border-red-500 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-300">
              {error}
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className={`lv-input${error ? ' border-red-500' : ''}`}
              disabled={busy}
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className={`lv-input${error ? ' border-red-500' : ''}`}
              disabled={busy}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          <button className="lv-btn-primary w-full" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex items-center justify-between gap-2 text-sm">
            <Link className="text-slate-400 hover:text-safety" to="/forgot-password">
              Forgot password?
            </Link>
            <Link className="text-slate-400 hover:text-safety" to="/register">
              Create account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
