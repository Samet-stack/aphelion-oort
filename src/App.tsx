import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { PageTransition } from './components/PageTransition';
import type { ApiPlan, ApiPlanPoint } from './services/api';
import { MobilePdfRequest, onMobilePdfRequested, revokePdfUrl } from './services/pdf-open';


type ViewState = 'LANDING' | 'PLANS' | 'CAMERA' | 'REPORT' | 'HISTORY' | 'PDF_VIEWER';

const Hero = lazy(() => import('./components/Hero').then((m) => ({ default: m.Hero })));
const CameraView = lazy(() => import('./components/CameraView').then((m) => ({ default: m.CameraView })));
const ReportView = lazy(() => import('./components/ReportView').then((m) => ({ default: m.ReportView })));
const HistoryView = lazy(() => import('./components/HistoryView').then((m) => ({ default: m.HistoryView })));
const PlanView = lazy(() => import('./components/PlanView').then((m) => ({ default: m.PlanView })));
const Login = lazy(() => import('./components/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./components/Register').then((m) => ({ default: m.Register })));
const RegisterSuccess = lazy(() =>
  import('./components/RegisterSuccess').then((m) => ({ default: m.RegisterSuccess })),
);
const MobilePdfView = lazy(() =>
  import('./components/MobilePdfView').then((m) => ({ default: m.MobilePdfView })),
);

function AppScreenFallback() {
  return (
    <div className="view view--centered">
      <div className="card surface-glass" style={{ width: 'min(420px, 100%)' }}>
        <div className="skeleton" style={{ height: 22, width: '56%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 12, width: '88%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '72%' }} />
      </div>
    </div>
  );
}

// Composant principal protégé par auth
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [view, setView] = useState<ViewState>('LANDING');
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ApiPlan | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ApiPlanPoint | null>(null);
  const [planViewInitialSiteId, setPlanViewInitialSiteId] = useState<string | null>(null);
  const [planViewInitialPlanId, setPlanViewInitialPlanId] = useState<string | null>(null);
  const [planViewInitialPointId, setPlanViewInitialPointId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [mobilePdf, setMobilePdf] = useState<MobilePdfRequest | null>(null);
  const [pdfReturnView, setPdfReturnView] = useState<ViewState>('LANDING');

  const clearMobilePdf = useCallback(() => {
    setMobilePdf((current) => {
      if (current?.blobUrl) {
        revokePdfUrl(current.blobUrl);
      }
      return null;
    });
  }, []);

  const closeMobilePdf = useCallback(() => {
    clearMobilePdf();
    setView(pdfReturnView);
  }, [clearMobilePdf, pdfReturnView]);

  useEffect(() => {
    const unsubscribe = onMobilePdfRequested((payload) => {
      setPdfReturnView((prevReturn) => (view === 'PDF_VIEWER' ? prevReturn : view));
      setMobilePdf((current) => {
        if (current?.blobUrl && current.blobUrl !== payload.blobUrl) {
          revokePdfUrl(current.blobUrl);
        }
        return payload;
      });
      setView('PDF_VIEWER');
    });

    return () => {
      unsubscribe();
    };
  }, [view]);

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
        <Suspense fallback={<AppScreenFallback />}>
          <Login onSwitchToRegister={() => setAuthMode('register')} />
        </Suspense>
      </PageTransition>
    ) : (
      <PageTransition key="register">
        <Suspense fallback={<AppScreenFallback />}>
          <Register onSwitchToLogin={() => setAuthMode('login')} />
        </Suspense>
      </PageTransition>
    );
  }

  const openPlansView = (opts?: { siteId?: string | null; planId?: string | null; pointId?: string | null }) => {
    setPlanViewInitialSiteId(opts?.siteId ?? null);
    setPlanViewInitialPlanId(opts?.planId ?? null);
    setPlanViewInitialPointId(opts?.pointId ?? null);
    setView('PLANS');
  };

  // Flux : Chantier -> Plans -> Points -> PDF
  const handleStart = (siteId?: string) => openPlansView({ siteId: siteId ?? null });
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
    clearMobilePdf();
    setCapturedImage(null);
    setSelectedPlan(null);
    setSelectedPoint(null);
    setPlanViewInitialSiteId(null);
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
            <Suspense fallback={<AppScreenFallback />}>
              <Hero onStart={handleStart} onHistory={handleHistory} />
            </Suspense>
          </PageTransition>
        )}

        {view === 'PLANS' && (
          <PageTransition key="plans">
            <Suspense fallback={<AppScreenFallback />}>
              <PlanView
                onBack={handleReset}
                onCreateReportFromPoint={handleCreateReportFromPoint}
                onStartReportFromPlan={handleStartReportFromPlan}
                initialSiteId={planViewInitialSiteId}
                initialPlanId={planViewInitialPlanId}
                initialPointId={planViewInitialPointId}
              />
            </Suspense>
          </PageTransition>
        )}

        {view === 'CAMERA' && selectedPlan && (
          <PageTransition key="camera">
            <Suspense fallback={<AppScreenFallback />}>
              <CameraView
                onCapture={handleCapture}
                onBack={() => handleBackToPlan()}
                selectedPlan={selectedPlan}
              />
            </Suspense>
          </PageTransition>
        )}

        {view === 'REPORT' && capturedImage && selectedPlan && (
          <PageTransition key="report">
            <Suspense fallback={<AppScreenFallback />}>
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
            </Suspense>
          </PageTransition>
        )}

        {view === 'HISTORY' && (
          <PageTransition key="history">
            <Suspense fallback={<AppScreenFallback />}>
              <HistoryView
                onBack={handleReset}
              />
            </Suspense>
          </PageTransition>
        )}

        {view === 'PDF_VIEWER' && mobilePdf && (
          <PageTransition key="pdf-viewer">
            <Suspense fallback={<AppScreenFallback />}>
              <MobilePdfView
                blobUrl={mobilePdf.blobUrl}
                filename={mobilePdf.filename}
                onBack={closeMobilePdf}
              />
            </Suspense>
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
          <Route
            path="/register-success"
            element={(
              <Suspense fallback={<AppScreenFallback />}>
                <RegisterSuccess />
              </Suspense>
            )}
          />
          <Route path="/verify-email" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
