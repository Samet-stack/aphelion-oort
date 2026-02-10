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
import { Login } from './components/Login';
import { Register } from './components/Register';
import { VerifyEmail } from './components/VerifyEmail';
import { RegisterSuccess } from './components/RegisterSuccess';
import { PageTransition } from './components/PageTransition';
import { ApiPlan, ApiPlanPoint } from './services/api';


type ViewState = 'LANDING' | 'PLANS' | 'CAMERA' | 'REPORT' | 'HISTORY';

// Composant principal protégé par auth
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [view, setView] = useState<ViewState>('LANDING');
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ApiPlan | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ApiPlanPoint | null>(null);
  const [planViewInitialPlanId, setPlanViewInitialPlanId] = useState<string | null>(null);
  const [planViewInitialPointId, setPlanViewInitialPointId] = useState<string | null>(null);
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

  const openPlansView = (opts?: { planId?: string | null; pointId?: string | null }) => {
    setPlanViewInitialPlanId(opts?.planId ?? null);
    setPlanViewInitialPointId(opts?.pointId ?? null);
    setView('PLANS');
  };

  // Flux : Chantier -> Plans -> Points -> PDF
  const handleStart = () => openPlansView();
  const handleHistory = () => setView('HISTORY');
  const handleStartReportFromPlan = (plan: ApiPlan) => {
    setSelectedPlan(plan);
    setSelectedPoint(null);
    setCapturedImage(null);
    setPlanViewInitialPlanId(plan.id);
    setPlanViewInitialPointId(null);
    setView('CAMERA');
  };

  const handleCreateReportFromPoint = (plan: ApiPlan, point: ApiPlanPoint) => {
    // Convertir la photo du point en File pour ReportView
    // On va créer un faux File à partir du data URL
    const photoDataUrl = point.photoDataUrl;
    const byteString = atob(photoDataUrl.split(',')[1]);
    const mimeString = photoDataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const file = new File([blob], `point-${point.pointNumber}.jpg`, { type: mimeString });
    
    setSelectedPlan(plan);
    setSelectedPoint(point);
    setCapturedImage(file);
    setPlanViewInitialPlanId(plan.id);
    setPlanViewInitialPointId(point.id);
    setView('REPORT');
  };

  const handleCapture = (file: File) => {
    setCapturedImage(file);
    setView('REPORT');
  };

  const handleBackToPlan = (opts?: { focusPointId?: string | null }) => {
    if (selectedPlan) {
      openPlansView({ planId: selectedPlan.id, pointId: opts?.focusPointId ?? null });
      return;
    }
    openPlansView();
  };

  const handleReset = () => {
    setCapturedImage(null);
    setSelectedPlan(null);
    setSelectedPoint(null);
    setPlanViewInitialPlanId(null);
    setPlanViewInitialPointId(null);
    setView('LANDING');
  };

  // Note: La migration est maintenant gérée dans le AuthContext lors de l'inscription

  return (
    <Layout>
      <AnimatePresence mode="wait">
        {view === 'LANDING' && (
          <PageTransition key="landing">
            <Hero onStart={handleStart} onHistory={handleHistory} />
          </PageTransition>
        )}

        {view === 'PLANS' && (
          <PageTransition key="plans">
            <PlanView
              onBack={handleReset}
              onCreateReportFromPoint={handleCreateReportFromPoint}
              onStartReportFromPlan={handleStartReportFromPlan}
              initialPlanId={planViewInitialPlanId}
              initialPointId={planViewInitialPointId}
            />
          </PageTransition>
        )}

        {view === 'CAMERA' && selectedPlan && (
          <PageTransition key="camera">
            <CameraView
              onCapture={handleCapture}
              onBack={() => handleBackToPlan()}
              selectedPlan={selectedPlan}
            />
          </PageTransition>
        )}

        {view === 'REPORT' && capturedImage && selectedPlan && (
          <PageTransition key="report">
            <ReportView
              imageFile={capturedImage}
              selectedPlan={selectedPlan}
              selectedPoint={selectedPoint}
              onBack={() => {
                setCapturedImage(null);
                if (selectedPoint) {
                  handleBackToPlan({ focusPointId: selectedPoint.id });
                  return;
                }
                setView('CAMERA');
              }}
              onReset={() => {
                setCapturedImage(null);
                if (selectedPoint) {
                  handleBackToPlan({ focusPointId: selectedPoint.id });
                  return;
                }
                setView('CAMERA');
              }}
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
