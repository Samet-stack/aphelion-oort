// Service API pour communiquer avec le backend
// Default to relative `/api` so:
// - prod: same-origin (backend serves both frontend + API)
// - dev: Vite can proxy `/api` to the backend (see `vite.config.ts`)
export const API_URL = import.meta.env.VITE_API_URL || '/api';

// Type pour les réponses API
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

interface ApiError extends Error {
  status?: number;
  data?: ApiResponse;
  needsVerification?: boolean;
}

// Type pour l'utilisateur
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

// Type pour le rapport API
export interface ApiReport {
  id: string;
  reportId: string;
  createdAt: string;
  dateLabel: string;
  address: string;
  coordinates: string;
  accuracy: number | null;
  locationSource: string;
  description: string;
  imageDataUrl: string;
  siteName?: string;
  operatorName?: string;
  clientName?: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  integrityHash?: string;
  clientSignature?: string;
  extraWorks: Array<{
    id: string;
    description: string;
    estimatedCost: number;
    urgency: 'low' | 'medium' | 'high';
    category: string;
  }>;
}

// Token storage
const getToken = () => localStorage.getItem('siteflow_token');
const setToken = (token: string) => localStorage.setItem('siteflow_token', token);
const removeToken = () => localStorage.removeItem('siteflow_token');

const createApiError = (status: number, data: ApiResponse): ApiError => {
  const error = new Error(data.message || `HTTP ${status}`) as ApiError;
  error.status = status;
  error.data = data;
  return error;
};

// Fetch avec auth
const fetchWithAuth = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse> => {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  let data: ApiResponse;
  try {
    data = await response.json();
  } catch {
    throw createApiError(response.status, {
      success: false,
      message: `Le serveur ne répond pas (HTTP ${response.status || 0})`
    });
  }

  if (!response.ok) {
    throw createApiError(response.status, data);
  }

  return data;
};

// Auth API
export const authApi = {
  register: async (userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  }): Promise<{ userId: string; emailSent: boolean; preview?: boolean }> => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    
    if (data.success && data.data) {
      return data.data;
    }
    throw new Error(data.message || 'Erreur lors de l\'inscription');
  },
  
  login: async (email: string, password: string): Promise<{ user: User; token: string; needsVerification?: boolean }> => {
    try {
      const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response.success && response.data) {
        setToken(response.data.token);
        return response.data;
      }
      throw new Error(response.message || 'Erreur lors de la connexion');
    } catch (err) {
      const error = err as ApiError;
      const needsVerification = error.status === 403 && error.data?.data?.needsVerification;
      if (needsVerification) {
        error.needsVerification = true;
      }
      throw error;
    }
  },
  
  resendVerification: async (email: string) => {
    const response = await fetchWithAuth('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    if (!response.success) {
      throw new Error(response.message || 'Erreur');
    }
    return response.data;
  },
  
  logout: () => {
    removeToken();
  },
  
  getMe: async (): Promise<User> => {
    const response = await fetchWithAuth('/auth/me');
    if (response.success && response.data) {
      return response.data.user;
    }
    throw new Error('Non authentifié');
  },
  
  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await fetchWithAuth('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (response.success && response.data) {
      return response.data.user;
    }
    throw new Error(response.message || 'Erreur');
  },
  
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const response = await fetchWithAuth('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!response.success) {
      throw new Error(response.message || 'Erreur');
    }
  },
  
  isAuthenticated: () => !!getToken()
};

// Reports API
export const reportsApi = {
  getAll: async (): Promise<ApiReport[]> => {
    const response = await fetchWithAuth('/reports');
    if (response.success && response.data) {
      return response.data.reports;
    }
    return [];
  },
  
  getById: async (id: string): Promise<ApiReport> => {
    const response = await fetchWithAuth(`/reports/${id}`);
    if (response.success && response.data) {
      return response.data.report;
    }
    throw new Error('Rapport non trouvé');
  },
  
  create: async (reportData: Omit<ApiReport, 'id' | 'createdAt' | 'extraWorks'> & { extraWorks?: any[] }): Promise<ApiReport> => {
    const response = await fetchWithAuth('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
    if (response.success && response.data) {
      return response.data.report;
    }
    throw new Error(response.message || 'Erreur lors de la création');
  },
  
  delete: async (id: string): Promise<void> => {
    const response = await fetchWithAuth(`/reports/${id}`, {
      method: 'DELETE'
    });
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors de la suppression');
    }
  },
  
  getStats: async () => {
    const response = await fetchWithAuth('/reports/stats/summary');
    if (response.success && response.data) {
      return response.data;
    }
    return {
      totalReports: 0,
      totalExtraWorks: 0,
      totalExtraValue: 0,
      byCategory: []
    };
  }
};

// Migration: transférer les rapports locaux vers le compte
export const migrateLocalReports = async (userId: string): Promise<number> => {
  const STORAGE_KEY = 'siteflow_reports_v1';
  const raw = localStorage.getItem(STORAGE_KEY);
  
  if (!raw) return 0;
  
  try {
    const localReports = JSON.parse(raw);
    if (!Array.isArray(localReports) || localReports.length === 0) return 0;
    
    let migrated = 0;
    for (const report of localReports) {
      try {
        await reportsApi.create({
          ...report,
          userId // Associer au nouvel utilisateur
        });
        migrated++;
      } catch (e) {
        console.error('Migration failed for report:', report.id);
      }
    }
    
    // Supprimer les données locales après migration
    localStorage.removeItem(STORAGE_KEY);
    console.log(`✅ ${migrated} rapports migrés vers le compte`);
    return migrated;
    
  } catch (e) {
    console.error('Migration error:', e);
    return 0;
  }
};

// Shares API (partage entre utilisateurs)
export const sharesApi = {
  shareReport: async (reportId: string, email: string, message?: string, permission = 'view') => {
    const response = await fetchWithAuth('/shares', {
      method: 'POST',
      body: JSON.stringify({ reportId, email, message, permission })
    });
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors du partage');
    }
    return response.data;
  },
  
  getReceived: async () => {
    const response = await fetchWithAuth('/shares/received');
    if (response.success && response.data) {
      return response.data.shares;
    }
    return [];
  },
  
  getSent: async () => {
    const response = await fetchWithAuth('/shares/sent');
    if (response.success && response.data) {
      return response.data.shares;
    }
    return [];
  },
  
  revoke: async (shareId: string) => {
    const response = await fetchWithAuth(`/shares/${shareId}`, {
      method: 'DELETE'
    });
    if (!response.success) {
      throw new Error(response.message || 'Erreur');
    }
  },
  
  accept: async (shareId: string) => {
    const response = await fetchWithAuth(`/shares/${shareId}/accept`, {
      method: 'PUT'
    });
    if (!response.success) {
      throw new Error(response.message || 'Erreur');
    }
  }
};

// Export API
export const exportApi = {
  downloadCSV: async (filters?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    
    const token = getToken();
    const response = await fetch(`${API_URL}/export/csv?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors du téléchargement CSV');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapports_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
  
  getExcelData: async (filters?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await fetchWithAuth(`/export/excel?${params}`);
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error('Erreur lors de la récupération des données');
  }
};

// Plan types
export interface ApiPlanPoint {
  id: string;
  planId: string;
  positionX: number;
  positionY: number;
  title: string;
  description?: string;
  category: string;
  photoDataUrl: string;
  dateLabel: string;
  room?: string;
  status: 'a_faire' | 'en_cours' | 'termine';
  pointNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPlan {
  id: string;
  siteName: string;
  address?: string;
  imageDataUrl: string;
  points: ApiPlanPoint[];
  pointsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPlanListItem {
  id: string;
  siteName: string;
  address?: string;
  pointsCount: number;
  createdAt: string;
  updatedAt: string;
}

// Plans API
export const plansApi = {
  getAll: async (): Promise<ApiPlanListItem[]> => {
    const response = await fetchWithAuth('/plans');
    if (response.success && response.data) {
      return response.data.plans;
    }
    return [];
  },

  getById: async (id: string): Promise<ApiPlan> => {
    const response = await fetchWithAuth(`/plans/${id}`);
    if (response.success && response.data) {
      return response.data.plan;
    }
    throw new Error('Plan non trouvé');
  },

  create: async (data: { siteName: string; address?: string; imageDataUrl: string }): Promise<ApiPlan> => {
    const response = await fetchWithAuth('/plans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (response.success && response.data) {
      return response.data.plan;
    }
    throw new Error(response.message || 'Erreur lors de la création');
  },

  deletePlan: async (id: string): Promise<void> => {
    const response = await fetchWithAuth(`/plans/${id}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors de la suppression');
    }
  },

  addPoint: async (planId: string, point: {
    positionX: number;
    positionY: number;
    title: string;
    description?: string;
    category: string;
    photoDataUrl: string;
    dateLabel: string;
    room?: string;
    status?: string;
  }): Promise<ApiPlanPoint> => {
    const response = await fetchWithAuth(`/plans/${planId}/points`, {
      method: 'POST',
      body: JSON.stringify(point)
    });
    if (response.success && response.data) {
      return response.data.point;
    }
    throw new Error(response.message || 'Erreur lors de l\'ajout du point');
  },

  updatePoint: async (planId: string, pointId: string, updates: Partial<{
    title: string;
    description: string;
    category: string;
    photoDataUrl: string;
    dateLabel: string;
    room: string;
    status: string;
  }>): Promise<ApiPlanPoint> => {
    const response = await fetchWithAuth(`/plans/${planId}/points/${pointId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    if (response.success && response.data) {
      return response.data.point;
    }
    throw new Error(response.message || 'Erreur lors de la mise à jour');
  },

  deletePoint: async (planId: string, pointId: string): Promise<void> => {
    const response = await fetchWithAuth(`/plans/${planId}/points/${pointId}`, { method: 'DELETE' });
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors de la suppression');
    }
  }
};
