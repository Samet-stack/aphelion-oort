import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, reportsApi, type ApiReport, type User } from '../services/api';
import { offlineService, type OfflineState } from '../services/offline';

interface AuthStats {
  totalReports: number;
  totalExtraWorks: number;
  totalExtraValue: number;
}

const EMPTY_STATS: AuthStats = {
  totalReports: 0,
  totalExtraWorks: 0,
  totalExtraValue: 0,
};

interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

interface RegisterResult {
  userId: string;
  emailSent: boolean;
  preview?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  reports: ApiReport[];
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<RegisterResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshReports: () => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  stats: AuthStats;
  // Offline
  offlineState: OfflineState;
  saveReportOffline: (reportData: Parameters<typeof offlineService.saveReportLocal>[0]) => Promise<string>;
  forceSync: () => Promise<{ success: number; failed: number }>;
  cancelLocalReport: (localId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;
const REPORTS_QUERY_KEY = ['reports', 'merged'] as const;
const REPORTS_STATS_QUERY_KEY = ['reports', 'stats'] as const;

const readOfflineExtraStats = async () => {
  const localReports = await offlineService.getPendingReports();
  const localExtraWorks = localReports.reduce((sum, report) => {
    return sum + (report.data.extraWorks?.length || 0);
  }, 0);
  const localExtraValue = localReports.reduce((sum, report) => {
    return (
      sum +
      (report.data.extraWorks?.reduce((extraSum, work) => {
        return extraSum + (work.estimatedCost || 0);
      }, 0) || 0)
    );
  }, 0);

  return {
    localReportsCount: localReports.length,
    localExtraWorks,
    localExtraValue,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState<boolean>(() => authApi.isAuthenticated());
  const [offlineState, setOfflineState] = useState<OfflineState>(offlineService.getState());

  const userQuery = useQuery({
    queryKey: [...AUTH_ME_QUERY_KEY, hasToken] as const,
    queryFn: authApi.getMe,
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!hasToken || !userQuery.isError) return;
    authApi.logout();
    setHasToken(false);
    queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
  }, [hasToken, queryClient, userQuery.isError]);

  const user = hasToken ? userQuery.data || null : null;

  const reportsQuery = useQuery({
    queryKey: [
      ...REPORTS_QUERY_KEY,
      user?.id ?? 'anonymous',
      offlineState.pendingCount,
      offlineState.lastSync,
      offlineState.isOnline,
    ] as const,
    enabled: !!user,
    queryFn: async (): Promise<ApiReport[]> => {
      let serverReports: ApiReport[] = [];
      if (offlineService.isOnline()) {
        try {
          serverReports = await reportsApi.getAll();
        } catch (error) {
          console.error('Failed to fetch server reports:', error);
        }
      }
      return offlineService.getAllReports(serverReports);
    },
    placeholderData: (previousData) => previousData ?? [],
  });

  const statsQuery = useQuery({
    queryKey: [
      ...REPORTS_STATS_QUERY_KEY,
      user?.id ?? 'anonymous',
      offlineState.pendingCount,
      offlineState.lastSync,
      offlineState.isOnline,
    ] as const,
    enabled: !!user,
    queryFn: async (): Promise<AuthStats> => {
      let serverStats = EMPTY_STATS;
      if (offlineService.isOnline()) {
        try {
          const data = await reportsApi.getStats();
          serverStats = {
            totalReports: data.totalReports || 0,
            totalExtraWorks: data.totalExtraWorks || 0,
            totalExtraValue: data.totalExtraValue || 0,
          };
        } catch (error) {
          console.error('Failed to fetch server stats:', error);
        }
      }

      const offlineStats = await readOfflineExtraStats();
      return {
        totalReports: serverStats.totalReports + offlineStats.localReportsCount,
        totalExtraWorks: serverStats.totalExtraWorks + offlineStats.localExtraWorks,
        totalExtraValue: serverStats.totalExtraValue + offlineStats.localExtraValue,
      };
    },
    placeholderData: (previousData) => previousData ?? EMPTY_STATS,
  });

  useEffect(() => {
    const unsubscribe = offlineService.subscribe((state) => {
      setOfflineState(state);
    });
    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async () => {
    if (!hasToken) return;
    await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    await userQuery.refetch();
  }, [hasToken, queryClient, userQuery]);

  const refreshReports = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: REPORTS_STATS_QUERY_KEY }),
    ]);
    await Promise.all([reportsQuery.refetch(), statsQuery.refetch()]);
  }, [queryClient, reportsQuery, statsQuery, user]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      setHasToken(true);
      queryClient.setQueryData([...AUTH_ME_QUERY_KEY, true], data.user);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: REPORTS_STATS_QUERY_KEY }),
      ]);
    },
    [queryClient],
  );

  const register = useCallback(async (data: RegisterPayload) => {
    return authApi.register(data);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setHasToken(false);
    queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
    queryClient.removeQueries({ queryKey: REPORTS_QUERY_KEY });
    queryClient.removeQueries({ queryKey: REPORTS_STATS_QUERY_KEY });
  }, [queryClient]);

  const deleteReport = useCallback(
    async (id: string) => {
      if (id.startsWith('local-')) {
        await offlineService.cancelLocalReport(id);
        await refreshReports();
        return;
      }

      const previousReportsData = queryClient.getQueriesData<ApiReport[]>({
        queryKey: REPORTS_QUERY_KEY,
      });
      queryClient.setQueriesData<ApiReport[]>({ queryKey: REPORTS_QUERY_KEY }, (previous) => {
        if (!previous) return previous;
        return previous.filter((report) => report.id !== id);
      });

      try {
        await reportsApi.delete(id);
        await queryClient.invalidateQueries({ queryKey: REPORTS_STATS_QUERY_KEY });
      } catch (error) {
        previousReportsData.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
        throw error;
      }
    },
    [queryClient, refreshReports],
  );

  const saveReportOffline = useCallback(
    async (reportData: Parameters<typeof offlineService.saveReportLocal>[0]) => {
      const localId = await offlineService.saveReportLocal(reportData);
      await refreshReports();
      return localId;
    },
    [refreshReports],
  );

  const forceSync = useCallback(async () => {
    const result = await offlineService.forceSync();
    await refreshReports();
    return result;
  }, [refreshReports]);

  const cancelLocalReport = useCallback(
    async (localId: string) => {
      const result = await offlineService.cancelLocalReport(localId);
      if (result) {
        await refreshReports();
      }
      return result;
    },
    [refreshReports],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: hasToken ? userQuery.isPending : false,
      reports: reportsQuery.data ?? [],
      login,
      register,
      logout,
      refreshUser,
      refreshReports,
      deleteReport,
      stats: statsQuery.data ?? EMPTY_STATS,
      offlineState,
      saveReportOffline,
      forceSync,
      cancelLocalReport,
    }),
    [
      user,
      hasToken,
      userQuery.isPending,
      reportsQuery.data,
      login,
      register,
      logout,
      refreshUser,
      refreshReports,
      deleteReport,
      statsQuery.data,
      offlineState,
      saveReportOffline,
      forceSync,
      cancelLocalReport,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
