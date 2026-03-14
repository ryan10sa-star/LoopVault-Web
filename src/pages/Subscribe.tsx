// NOTE (Ryan): Replace VITE_LEMONSQUEEZY_CHECKOUT_URL in your .env file with your real
// LemonSqueezy checkout link once you have created the product in your dashboard.
import { useAuth } from '../contexts/AuthContext';

const LEMONSQUEEZY_CHECKOUT_URL = import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_URL ?? '#';

export function Subscribe(): JSX.Element {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="lv-title mb-1 text-2xl">LoopVault</h1>
          <p className="text-sm text-slate-400">Field Calibration Assistant</p>
        </div>

        <div className="lv-panel space-y-4">
          <h2 className="text-base font-bold text-slate-100">Subscription Required</h2>
          <p className="text-sm text-slate-300">
            Your account does not have an active subscription. Subscribe to unlock the full LoopVault experience.
          </p>

          <div className="rounded border border-safety/30 bg-slate-900 p-4">
            <p className="text-sm font-bold text-safety">Founding Member Plan</p>
            <p className="mt-1 text-2xl font-extrabold text-white">
              $4<span className="text-base font-normal text-slate-400">/month</span>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              <li>✓ Unlimited calibration records</li>
              <li>✓ PDF certificate generation</li>
              <li>✓ Cloud sync across devices</li>
              <li>✓ Offline-first — works in the field</li>
            </ul>
          </div>

          <a
            className="lv-btn-primary block w-full text-center"
            href={LEMONSQUEEZY_CHECKOUT_URL}
            rel="noreferrer"
            target="_blank"
          >
            Subscribe Now
          </a>

          {user ? (
            <div className="flex items-center justify-between border-t border-slate-700 pt-3 text-sm">
              <span className="truncate text-slate-400">{user.email}</span>
              <button
                className="ml-2 shrink-0 text-slate-400 hover:text-red-400"
                onClick={() => void signOut()}
                type="button"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
