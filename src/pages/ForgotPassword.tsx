import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ForgotPassword(): JSX.Element {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const onSubmit = async (event: { preventDefault(): void }): Promise<void> => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    const { error: authError } = await resetPassword(email.trim());
    setBusy(false);
    if (authError) {
      setError(authError);
      return;
    }
    setSuccess('Password reset email sent. Check your inbox.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <h1 className="lv-title mb-1 text-center text-2xl">LoopVault</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Field Calibration Assistant</p>

        <form className="lv-panel space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="text-base font-bold text-slate-100">Reset Password</h2>
          <p className="text-sm text-slate-400">Enter your email and we'll send you a reset link.</p>

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

          <button className="lv-btn-primary w-full" disabled={busy} type="submit">
            {busy ? 'Sending…' : 'Send Reset Link'}
          </button>

          <div className="text-center text-sm">
            <Link className="text-slate-400 hover:text-safety" to="/login">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
