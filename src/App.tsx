import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Hero } from './components/Hero';
import { CameraView } from './components/CameraView';
import { ReportView } from './components/ReportView';
import { HistoryView } from './components/HistoryView';
import { PlanView } from './components/PlanView';
import { PlanSelector } from './components/PlanSelector';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { VerifyEmail } from './components/VerifyEmail';
import { RegisterSuccess } from './components/RegisterSuccess';
import { PageTransition } from './components/PageTransition';
import { ApiPlan } from './services/api';


type ViewState = 'LANDING' | 'SELECT_PLAN' | 'CAMERA' | 'REPORT' | 'HISTORY' | 'PLANS' | 'AUTH';

// Composant principal protégé par auth
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [view, setView] = useState<ViewState>('LANDING');
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ApiPlan | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (isLoading) {
    return (
      <div className="view view--centered">
        <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div className="spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            Chargement...
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Connexion au serveur et preparation de la session.
          </p>
        </div>
      </div>
    );
  }

  // Si pas authentifié, montrer l'écran de auth
  if (!isAuthenticated) {
    return authMode === 'login' ? (
      <PageTransition key="login">
        <Login onSwitchToRegister={() => setAuthMode('register')} />
      </PageTransition>
    ) : (
      <PageTransition key="register">
        <Register onSwitchToLogin={() => setAuthMode('login')} />
      </PageTransition>
    );
  }

  // Flux modifié : il faut d'abord sélectionner un plan
  const handleStart = () => setView('SELECT_PLAN');
  const handleHistory = () => setView('HISTORY');
  const handlePlans = () => setView('PLANS');

  const handleSelectPlan = (plan: ApiPlan) => {
    setSelectedPlan(plan);
    setView('CAMERA');
  };

  const handleCapture = (file: File) => {
    setCapturedImage(file);
    setView('REPORT');
  };

  const handleBackToCamera = () => {
    setCapturedImage(null);
    setView('CAMERA');
  };

  const handleBackToPlanSelection = () => {
    setSelectedPlan(null);
    setView('SELECT_PLAN');
  };

  const handleReset = () => {
    setCapturedImage(null);
    setSelectedPlan(null);
    setView('LANDING');
  };

  // Note: La migration est maintenant gérée dans le AuthContext lors de l'inscription

  return (
    <Layout>
      <AnimatePresence mode="wait">
        {view === 'LANDING' && (
          <PageTransition key="landing">
            <Hero onStart={handleStart} onHistory={handleHistory} onPlans={handlePlans} />
          </PageTransition>
        )}

        {view === 'SELECT_PLAN' && (
          <PageTransition key="select-plan">
            <PlanSelector
              onSelectPlan={handleSelectPlan}
              onBack={handleReset}
              onManagePlans={handlePlans}
            />
          </PageTransition>
        )}

        {view === 'CAMERA' && selectedPlan && (
          <PageTransition key="camera">
            <CameraView
              onCapture={handleCapture}
              onBack={handleBackToPlanSelection}
              selectedPlan={selectedPlan}
            />
          </PageTransition>
        )}

        {view === 'REPORT' && capturedImage && selectedPlan && (
          <PageTransition key="report">
            <ReportView
              imageFile={capturedImage}
              selectedPlan={selectedPlan}
              onBack={handleBackToCamera}
              onReset={handleReset}
            />
          </PageTransition>
        )}

        {view === 'HISTORY' && (
          <PageTransition key="history">
            <HistoryView
              onBack={handleReset}
            />
          </PageTransition>
        )}

        {view === 'PLANS' && (
          <PageTransition key="plans">
            <PlanView onBack={handleReset} />
          </PageTransition>
        )}
      </AnimatePresence>
    </Layout>
  );
}

// Wrapper avec Provider
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/login" element={<AppContent />} />
          <Route path="/register-success" element={<RegisterSuccess />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
