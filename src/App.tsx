import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DevDbTest } from './pages/DevDbTest';
import { Diagnostics } from './pages/Diagnostics';
import { Home } from './pages/Home';
import { JobRunner } from './pages/JobRunner';
import { NewTag } from './pages/NewTag';
import { Scanner } from './pages/Scanner';
import { TagDetail } from './pages/TagDetail';
import { TagsList } from './pages/TagsList';

export function App(): JSX.Element {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/tags" element={<TagsList />} />
        <Route path="/tags/new" element={<NewTag />} />
        <Route path="/tags/:tagNumber" element={<TagDetail />} />
        <Route path="/jobs/:jobId" element={<JobRunner />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
        <Route path="/dev/db-test" element={<DevDbTest />} />
      </Routes>
    </Layout>
  );
}
