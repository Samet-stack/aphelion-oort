import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, reportsApi, User, ApiReport } from '../services/api';
import { offlineService, type OfflineState } from '../services/offline';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  reports: ApiReport[];
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  }) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshReports: () => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  stats: {
    totalReports: number;
    totalExtraWorks: number;
    totalExtraValue: number;
  };
  // Offline
  offlineState: OfflineState;
  saveReportOffline: (reportData: Parameters<typeof offlineService.saveReportLocal>[0]) => Promise<string>;
  forceSync: () => Promise<{ success: number; failed: number }>;
  cancelLocalReport: (localId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [stats, setStats] = useState({
    totalReports: 0,
    totalExtraWorks: 0,
    totalExtraValue: 0
  });
  const [offlineState, setOfflineState] = useState<OfflineState>(offlineService.getState());

  // Vérifier si l'utilisateur est déjà connecté au chargement
  useEffect(() => {
    const init = async () => {
      if (authApi.isAuthenticated()) {
        try {
          const userData = await authApi.getMe();
          setUser(userData);
          await Promise.all([refreshReports(), loadStats()]);
        } catch (error) {
          // Token invalide
          authApi.logout();
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // S'abonner aux changements de l'état offline
  useEffect(() => {
    const unsubscribe = offlineService.subscribe((state) => {
      setOfflineState(state);
    });
    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  const refreshReports = useCallback(async () => {
    try {
      let serverReports: ApiReport[] = [];
      
      // Essayer de récupérer les rapports serveur si online
      if (offlineService.isOnline()) {
        try {
          serverReports = await reportsApi.getAll();
        } catch (error) {
          console.error('Failed to fetch server reports:', error);
        }
      }
      
      // Fusionner avec les rapports locaux
      const allReports = await offlineService.getAllReports(serverReports);
      setReports(allReports);
    } catch (error) {
      console.error('Failed to refresh reports:', error);
      // En cas d'erreur, afficher au moins les rapports locaux
      const localReports = await offlineService.getAllReports([]);
      setReports(localReports);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      // Essayer de récupérer les stats serveur si online
      let serverStats = { totalReports: 0, totalExtraWorks: 0, totalExtraValue: 0 };
      
      if (offlineService.isOnline()) {
        try {
          const data: any = await reportsApi.getStats();
          serverStats = {
            totalReports: data.totalReports || 0,
            totalExtraWorks: data.totalExtraWorks || 0,
            totalExtraValue: data.totalExtraValue || 0
          };
        } catch (error) {
          console.error('Failed to fetch server stats:', error);
        }
      }
      
      // Calculer les stats des rapports locaux
      const localReports = await offlineService.getPendingReports();
      const localExtraWorks = localReports.reduce((sum, r) => sum + (r.data.extraWorks?.length || 0), 0);
      const localExtraValue = localReports.reduce((sum, r) => {
        return sum + (r.data.extraWorks?.reduce((s: number, w: any) => s + (w.estimatedCost || 0), 0) || 0);
      }, 0);
      
      // Fusionner
      setStats({
        totalReports: serverStats.totalReports + localReports.length,
        totalExtraWorks: serverStats.totalExtraWorks + localExtraWorks,
        totalExtraValue: serverStats.totalExtraValue + localExtraValue
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    await Promise.all([refreshReports(), loadStats()]);
    setUser(data.user);
  }, [refreshReports, loadStats]);

  const register = useCallback(async (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  }) => {
    return authApi.register(data);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setReports([]);
    setStats({ totalReports: 0, totalExtraWorks: 0, totalExtraValue: 0 });
  }, []);

  const deleteReport = useCallback(async (id: string) => {
    // Si c'est un rapport local, le supprimer localement
    if (id.startsWith('local-')) {
      offlineService.cancelLocalReport(id);
      await refreshReports();
      await loadStats();
      return;
    }
    
    // Sinon supprimer sur le serveur
    await reportsApi.delete(id);
    setReports(prev => prev.filter(r => r.id !== id));
    await loadStats();
  }, [loadStats, refreshReports]);

  // Fonctions offline
  const saveReportOffline = useCallback(async (reportData: any) => {
    const localId = await offlineService.saveReportLocal(reportData);
    await refreshReports();
    await loadStats();
    return localId;
  }, [refreshReports, loadStats]);

  const forceSync = useCallback(async () => {
    const result = await offlineService.forceSync();
    await refreshReports();
    await loadStats();
    return result;
  }, [refreshReports, loadStats]);

  const cancelLocalReport = useCallback(async (localId: string) => {
    const result = await offlineService.cancelLocalReport(localId);
    if (result) {
      await refreshReports();
      await loadStats();
    }
    return result;
  }, [refreshReports, loadStats]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        reports,
        login,
        register,
        logout,
        refreshUser,
        refreshReports,
        deleteReport,
        stats,
        offlineState,
        saveReportOffline,
        forceSync,
        cancelLocalReport
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
