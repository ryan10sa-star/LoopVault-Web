import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Register(): JSX.Element {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const onSubmit = async (event: { preventDefault(): void }): Promise<void> => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    const { error: authError } = await signUp(email.trim(), password);
    setBusy(false);

    if (authError) {
      setError(authError);
      return;
    }

    setSuccess('Account created. Check your email to confirm your address, then sign in.');
    setTimeout(() => navigate('/login'), 3000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <h1 className="lv-title mb-1 text-center text-2xl">LoopVault</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Field Calibration Assistant</p>

        <form className="lv-panel space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="text-base font-bold text-slate-100">Create Account</h2>

          {error ? (
            <div className="rounded border border-red-500 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-300">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded border border-green-500 bg-green-950/50 px-3 py-2 text-sm font-medium text-green-300">
              {success}
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
              autoComplete="new-password"
              className={`lv-input${error ? ' border-red-500' : ''}`}
              disabled={busy}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-300" htmlFor="confirm-password">
              Confirm Password
            </label>
            <input
              autoComplete="new-password"
              className={`lv-input${error && password !== confirmPassword ? ' border-red-500' : ''}`}
              disabled={busy}
              id="confirm-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </div>

          <button className="lv-btn-primary w-full" disabled={busy} type="submit">
            {busy ? 'Creating account…' : 'Create Account'}
          </button>

          <div className="text-center text-sm">
            <Link className="text-slate-400 hover:text-safety" to="/login">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
