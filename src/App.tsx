import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';

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

export function App(): JSX.Element {
  const showDevRoutes = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  return (
    <Layout>
      <Suspense fallback={<p className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200">Loading screen...</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/handover" element={<Handover />} />
          <Route path="/help" element={<Help />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/tags" element={<TagsList />} />
          <Route path="/tags/new" element={<NewTag />} />
          <Route path="/tags/:tagNumber" element={<TagDetail />} />
          <Route path="/jobs/:jobId" element={<JobRunner />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          {showDevRoutes ? <Route path="/dev/db-test" element={<DevDbTest />} /> : null}
        </Routes>
      </Suspense>
    </Layout>
  );
}
