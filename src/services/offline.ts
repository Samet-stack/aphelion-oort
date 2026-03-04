// Service de gestion du mode hors-ligne
// Stockage local des rapports + synchro auto

import { reportsApi, plansApi, type ApiReport, type ApiPlanPoint } from './api';
import { offlineDB, type PendingReport, type PendingPlanPoint, type CachedPlan } from './offline-db';

interface OfflineState {
  isOnline: boolean;
  pendingCount: number; // For reports
  pendingPointsCount: number; // For plan points
  isSyncing: boolean;
  lastSync: string | null;
}

const SYNC_INTERVAL = 30000; // 30 secondes
const MAX_SYNC_ATTEMPTS = 5;
const FALLBACK_PLAN_POINTS_KEY = 'siteflow_offline_pending_plan_points';

class OfflineService {
  private listeners: Set<(state: OfflineState) => void> = new Set();
  private syncInterval: number | null = null;
  private currentState: OfflineState = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    pendingPointsCount: 0,
    isSyncing: false,
    lastSync: null
  };
  private useFallback = false; // Fallback sur localStorage si IndexedDB échoue

  constructor() {
    this.init();
  }

  private async init() {
    // Initialiser IndexedDB
    try {
      await offlineDB.init();
      this.useFallback = false;
    } catch (error) {
      console.warn('IndexedDB indisponible, fallback sur localStorage');
      this.useFallback = true;
    }

    // Écouter les changements de connexion
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Charger les rapports en attente
    await this.updatePendingCount();

    // Démarrer la synchro périodique
    this.startPeriodicSync();

    // Synchro immédiate si online
    if (navigator.onLine) {
      this.sync();
    }
  }

  private handleOnline = () => {
    this.currentState.isOnline = true;
    this.notifyListeners();
    // Synchro immédiate quand on revient online
    this.sync();
  };

  private handleOffline = () => {
    this.currentState.isOnline = false;
    this.notifyListeners();
  };

  private startPeriodicSync() {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && this.currentState.pendingCount > 0) {
        this.sync();
      }
    }, SYNC_INTERVAL);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    // Nettoyer les listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  // Récupérer le statut actuel
  getState(): OfflineState {
    return { ...this.currentState };
  }

  // Vérifier si on est online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // S'abonner aux changements
  subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    // Envoyer l'état actuel immédiatement
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  private async updatePendingCount() {
    try {
      const reports = await this.getPendingReports();
      const points = await this.getPendingPlanPoints();
      this.currentState.pendingCount = reports.length;
      this.currentState.pendingPointsCount = points.length;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  }

  // Récupérer tous les rapports en attente
  async getPendingReports(): Promise<PendingReport[]> {
    if (this.useFallback) {
      return offlineDB.getAllFallback();
    }
    try {
      return await offlineDB.getAll();
    } catch (error) {
      console.warn('IndexedDB failed, using fallback');
      this.useFallback = true;
      return offlineDB.getAllFallback();
    }
  }

  // Récupérer tous les points de plan en attente
  async getPendingPlanPoints(): Promise<PendingPlanPoint[]> {
    if (this.useFallback) {
      return this.getPendingPlanPointsFallback();
    }
    try {
      return await offlineDB.getAllPlanPoints();
    } catch (error) {
      return this.getPendingPlanPointsFallback();
    }
  }

  private async getPendingPlanPointsFallback(): Promise<PendingPlanPoint[]> {
    try {
      const raw = localStorage.getItem(FALLBACK_PLAN_POINTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private async savePendingPlanPointsFallback(points: PendingPlanPoint[]): Promise<void> {
    localStorage.setItem(FALLBACK_PLAN_POINTS_KEY, JSON.stringify(points));
  }

  // Sauvegarder un rapport en local (hors-ligne)
  async saveReportLocal(reportData: any): Promise<string> {
    const localId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newReport: PendingReport = {
      id: localId,
      localId,
      data: reportData,
      createdAtLocal: new Date().toISOString(),
      syncAttempts: 0
    };

    try {
      if (this.useFallback) {
        await offlineDB.addFallback(newReport);
      } else {
        try {
          await offlineDB.add(newReport);
        } catch (error) {
          // Si IndexedDB échoue (quota exceeded), fallback sur localStorage
          console.warn('IndexedDB add failed, using fallback');
          await offlineDB.addFallback(newReport);
          this.useFallback = true;
        }
      }

      await this.updatePendingCount();

      // Essayer de synchroniser immédiatement si online
      if (navigator.onLine) {
        this.sync();
      }

      return localId;
    } catch (error) {
      console.error('Failed to save report locally:', error);
      throw new Error('Impossible de sauvegarder le rapport localement');
    }
  }

  // Supprimer un rapport en attente
  private async removePendingReport(localId: string) {
    try {
      if (this.useFallback) {
        await offlineDB.deleteFallback(localId);
      } else {
        try {
          await offlineDB.delete(localId);
        } catch (error) {
          await offlineDB.deleteFallback(localId);
        }
      }
      await this.updatePendingCount();
    } catch (error) {
      console.error('Failed to remove pending report:', error);
    }
  }

  // == Plan Points Offline ==
  async savePlanPointLocal(planId: string, pointData: any): Promise<string> {
    const localId = `local-point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newPoint: PendingPlanPoint = {
      id: localId,
      localId,
      planId,
      data: pointData,
      createdAtLocal: new Date().toISOString(),
      syncAttempts: 0
    };

    if (this.useFallback) {
      const points = await this.getPendingPlanPointsFallback();
      points.push(newPoint);
      await this.savePendingPlanPointsFallback(points);
      await this.updatePendingCount();
      if (navigator.onLine) this.sync();
      return localId;
    }

    try {
      await offlineDB.addPlanPoint(newPoint);
      await this.updatePendingCount();
      if (navigator.onLine) this.sync();
      return localId;
    } catch (error) {
      console.error('Failed to save plan point locally:', error);
      throw new Error('Impossible de sauvegarder le point de plan localement');
    }
  }

  private async removePendingPlanPoint(localId: string) {
    if (this.useFallback) {
      const points = await this.getPendingPlanPointsFallback();
      const filtered = points.filter(p => p.localId !== localId);
      await this.savePendingPlanPointsFallback(filtered);
      await this.updatePendingCount();
      return;
    }
    try {
      await offlineDB.deletePlanPoint(localId);
      await this.updatePendingCount();
    } catch (error) {
      console.error('Failed to remove pending plan point:', error);
    }
  }

  // Mettre à jour un rapport (pour les tentatives de synchro)
  private async updatePendingReport(report: PendingReport) {
    try {
      if (this.useFallback) {
        const reports = await offlineDB.getAllFallback();
        const index = reports.findIndex(r => r.localId === report.localId);
        if (index !== -1) {
          reports[index] = report;
          localStorage.setItem('siteflow_offline_pending', JSON.stringify(reports));
        }
      } else {
        try {
          await offlineDB.update(report);
        } catch (error) {
          // Fallback
          const reports = await offlineDB.getAllFallback();
          const index = reports.findIndex(r => r.localId === report.localId);
          if (index !== -1) {
            reports[index] = report;
            localStorage.setItem('siteflow_offline_pending', JSON.stringify(reports));
          }
        }
      }
    } catch (error) {
      console.error('Failed to update pending report:', error);
    }
  }

  // Mettre à jour un point de plan (pour les tentatives de synchro)
  private async updatePendingPlanPoint(point: PendingPlanPoint) {
    if (this.useFallback) {
      const points = await this.getPendingPlanPointsFallback();
      const index = points.findIndex(p => p.localId === point.localId);
      if (index !== -1) {
        points[index] = point;
        await this.savePendingPlanPointsFallback(points);
      }
      return;
    }
    try {
      await offlineDB.updatePlanPoint(point);
    } catch (error) {
      console.error('Failed to update pending plan point:', error);
    }
  }

  // Synchroniser les rapports et points de plans en attente
  async sync(): Promise<{ success: number; failed: number }> {
    if (this.currentState.isSyncing || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    const pendingReports = await this.getPendingReports();
    const pendingPoints = await this.getPendingPlanPoints();

    if (pendingReports.length === 0 && pendingPoints.length === 0) {
      return { success: 0, failed: 0 };
    }

    this.currentState.isSyncing = true;
    this.notifyListeners();

    let success = 0;
    let failed = 0;

    const now = Date.now();

    // 1. Synchro des rapports
    const reportsToSync = pendingReports.filter(r =>
      r.syncAttempts < MAX_SYNC_ATTEMPTS &&
      (!r.nextSyncTime || r.nextSyncTime <= now)
    );
    for (const report of reportsToSync) {
      try {
        await reportsApi.create(report.data);
        await this.removePendingReport(report.localId);
        success++;
      } catch (error: any) {
        report.syncAttempts++;
        report.lastError = error.message || 'Erreur inconnue';

        // Exponential backoff: Base 1 min, then 2, 4, 8, 16 mins
        const minutesToWait = Math.pow(2, report.syncAttempts - 1);
        report.nextSyncTime = now + minutesToWait * 60 * 1000;

        failed++;
        await this.updatePendingReport(report);
      }
    }

    // 2. Synchro des points de plan
    const pointsToSync = pendingPoints.filter(p =>
      p.syncAttempts < MAX_SYNC_ATTEMPTS &&
      (!p.nextSyncTime || p.nextSyncTime <= now)
    );
    for (const point of pointsToSync) {
      try {
        await plansApi.addPoint(point.planId, point.data);
        await this.removePendingPlanPoint(point.localId);
        success++;
      } catch (error: any) {
        point.syncAttempts++;
        point.lastError = error.message || 'Erreur inconnue';

        // Exponential backoff
        const minutesToWait = Math.pow(2, point.syncAttempts - 1);
        point.nextSyncTime = now + minutesToWait * 60 * 1000;

        failed++;
        await this.updatePendingPlanPoint(point);
      }
    }

    this.currentState.isSyncing = false;
    this.currentState.lastSync = new Date().toISOString();
    await this.updatePendingCount();

    return { success, failed };
  }

  // Forcer une synchro manuelle
  async forceSync(): Promise<{ success: number; failed: number }> {
    return this.sync();
  }

  // Récupérer tous les rapports (locaux + serveur si online)
  async getAllReports(serverReports: ApiReport[]): Promise<ApiReport[]> {
    const pending = await this.getPendingReports();

    // Convertir les rapports locaux en format ApiReport
    const localReports: ApiReport[] = pending.map(p => ({
      ...p.data,
      id: p.localId,
      createdAt: p.createdAtLocal,
      extraWorks: p.data.extraWorks || []
    })) as ApiReport[];

    // Fusionner et trier par date (plus récent d'abord)
    return [...serverReports, ...localReports].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  // Supprimer un rapport local
  async cancelLocalReport(localId: string): Promise<boolean> {
    const pending = await this.getPendingReports();
    const exists = pending.some(r => r.localId === localId);

    if (exists) {
      await this.removePendingReport(localId);
      return true;
    }
    return false;
  }

  // Nettoyer tous les rapports en attente
  async clearAllPending(): Promise<void> {
    try {
      if (this.useFallback) {
        localStorage.removeItem('siteflow_offline_pending');
        localStorage.removeItem(FALLBACK_PLAN_POINTS_KEY);
      } else {
        try {
          await offlineDB.clear();
        } catch (error) {
          localStorage.removeItem('siteflow_offline_pending');
          localStorage.removeItem(FALLBACK_PLAN_POINTS_KEY);
        }
      }
      await this.updatePendingCount();
    } catch (error) {
      console.error('Failed to clear pending reports:', error);
    }
  }

  // == Plans Mis en Cache ==
  async getCachedPlans(): Promise<CachedPlan[]> {
    if (this.useFallback) return [];
    try {
      return await offlineDB.getAllCachedPlans();
    } catch {
      return [];
    }
  }

  async saveCachedPlan(plan: CachedPlan) {
    if (this.useFallback) return;
    try {
      await offlineDB.saveCachedPlan(plan);
    } catch (error) {
      console.error('Failed to cache plan:', error);
    }
  }

  // Récupérer tous les points d'un plan (locaux + serveur si online)
  async getAllPlanPointsForPlan(planId: string, serverPoints: ApiPlanPoint[]): Promise<ApiPlanPoint[]> {
    const pendingPoints = await this.getPendingPlanPoints();
    const localPointsForPlan = pendingPoints.filter(p => p.planId === planId);

    // Convertir les points locaux en format ApiPlanPoint
    const mappedLocalPoints: ApiPlanPoint[] = localPointsForPlan.map(p => ({
      ...p.data,
      id: p.localId,
      planId: p.planId,
      createdAt: p.createdAtLocal,
      updatedAt: p.createdAtLocal, // Utilisé pour le tri
    })) as ApiPlanPoint[];

    // Fusionner et trier par date
    return [...serverPoints, ...mappedLocalPoints].sort((a, b) => {
      // Si disponible, on peut trier par pointNumber
      const aNum = (a as any).pointNumber || 0;
      const bNum = (b as any).pointNumber || 0;
      if (aNum !== bNum) return aNum - bNum;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
}

// Singleton
export const offlineService = new OfflineService();
export type { OfflineState };
