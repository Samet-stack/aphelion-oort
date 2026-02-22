import { Navigate, Route, Routes } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Hero } from './components/Hero';
import { CameraView } from './components/CameraView';
import { ReportView } from './components/ReportView';
import { HistoryView } from './components/HistoryView';
import { PlanView } from './components/PlanView';
import { PlanSelector } from './components/PlanSelector';
import { VerifyEmail } from './components/VerifyEmail';
import { RegisterSuccess } from './components/RegisterSuccess';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Hero />} />
              <Route path="/select-plan" element={<PlanSelector />} />
              <Route path="/camera" element={<CameraView />} />
              <Route path="/report" element={<ReportView />} />
              <Route path="/history" element={<HistoryView />} />
              <Route path="/plans" element={<PlanView />} />
            </Route>

            {/* Public routes */}
            <Route path="/register-success" element={<RegisterSuccess />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </AuthProvider>
  );
}

export default App;
