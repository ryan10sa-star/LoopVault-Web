import { Suspense, lazy } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

const Home = lazy(async () => ({ default: (await import('./pages/Home')).Home }));
const Handover = lazy(async () => ({ default: (await import('./pages/Handover')).Handover }));
const Help = lazy(async () => ({ default: (await import('./pages/Help')).Help }));
const Settings = lazy(async () => ({ default: (await import('./pages/Settings')).Settings }));
const Scanner = lazy(async () => ({ default: (await import('./pages/Scanner')).Scanner }));
const TagsList = lazy(async () => ({ default: (await import('./pages/TagsList')).TagsList }));
const NewTag = lazy(async () => ({ default: (await import('./pages/NewTag')).NewTag }));
const TagDetail = lazy(async () => ({ default: (await import('./pages/TagDetail')).TagDetail }));
const JobRunner = lazy(async () => ({ default: (await import('./pages/JobRunner')).JobRunner }));
const Diagnostics = lazy(async () => ({ default: (await import('./pages/Diagnostics')).Diagnostics }));
const Exceptions = lazy(async () => ({ default: (await import('./pages/Exceptions')).Exceptions }));
const DevDbTest = lazy(async () => ({ default: (await import('./pages/DevDbTest')).DevDbTest }));
const Login = lazy(async () => ({ default: (await import('./pages/Login')).Login }));
const Register = lazy(async () => ({ default: (await import('./pages/Register')).Register }));
const ForgotPassword = lazy(async () => ({ default: (await import('./pages/ForgotPassword')).ForgotPassword }));
const Subscribe = lazy(async () => ({ default: (await import('./pages/Subscribe')).Subscribe }));

export function App(): JSX.Element {
  const showDevRoutes = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  return (
    <Suspense fallback={<p className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200">Loading screen...</p>}>
      <Routes>
        {/* Public auth routes — no layout wrapper */}
        <Route element={<Login />} path="/login" />
        <Route element={<Register />} path="/register" />
        <Route element={<ForgotPassword />} path="/forgot-password" />
        <Route element={<Subscribe />} path="/subscribe" />

        {/* Protected app routes — auth + subscription gate + layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout>
                <Outlet />
              </Layout>
            </ProtectedRoute>
          }
        >
          <Route element={<Home />} path="/" />
          <Route element={<Handover />} path="/handover" />
          <Route element={<Help />} path="/help" />
          <Route element={<Settings />} path="/settings" />
          <Route element={<Scanner />} path="/scanner" />
          <Route element={<TagsList />} path="/tags" />
          <Route element={<NewTag />} path="/tags/new" />
          <Route element={<TagDetail />} path="/tags/:tagNumber" />
          <Route element={<JobRunner />} path="/jobs/:jobId" />
          <Route element={<Exceptions />} path="/exceptions" />
          <Route element={<Diagnostics />} path="/diagnostics" />
          {showDevRoutes ? <Route element={<DevDbTest />} path="/dev/db-test" /> : null}
        </Route>
      </Routes>
    </Suspense>
  );
}
