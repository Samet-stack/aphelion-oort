// Service de gestion du mode hors-ligne
// Stockage local des rapports + synchro auto

import { reportsApi, type ApiReport } from './api';
import { offlineDB, type PendingReport } from './offline-db';

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSync: string | null;
}

const SYNC_INTERVAL = 30000; // 30 secondes
const MAX_SYNC_ATTEMPTS = 5;

class OfflineService {
  private listeners: Set<(state: OfflineState) => void> = new Set();
  private syncInterval: number | null = null;
  private currentState: OfflineState = {
    isOnline: navigator.onLine,
    pendingCount: 0,
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
      this.currentState.pendingCount = reports.length;
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

  // Synchroniser les rapports en attente
  async sync(): Promise<{ success: number; failed: number }> {
    if (this.currentState.isSyncing || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    const pending = await this.getPendingReports();
    if (pending.length === 0) {
      return { success: 0, failed: 0 };
    }

    this.currentState.isSyncing = true;
    this.notifyListeners();

    let success = 0;
    let failed = 0;

    // Ne synchroniser que les rapports avec moins de MAX_SYNC_ATTEMPTS tentatives
    const reportsToSync = pending.filter(r => r.syncAttempts < MAX_SYNC_ATTEMPTS);

    for (const report of reportsToSync) {
      try {
        await reportsApi.create(report.data);
        await this.removePendingReport(report.localId);
        success++;
      } catch (error: any) {
        // Incrémenter le compteur d'échecs
        report.syncAttempts++;
        report.lastError = error.message || 'Erreur inconnue';
        failed++;

        // Sauvegarder le compteur d'échecs mis à jour
        await this.updatePendingReport(report);

        if (report.syncAttempts >= MAX_SYNC_ATTEMPTS) {
          console.warn(`Rapport ${report.localId} a échoué ${MAX_SYNC_ATTEMPTS} fois, abandon temporaire`);
        }
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
      } else {
        try {
          await offlineDB.clear();
        } catch (error) {
          localStorage.removeItem('siteflow_offline_pending');
        }
      }
      await this.updatePendingCount();
    } catch (error) {
      console.error('Failed to clear pending reports:', error);
    }
  }
}

// Singleton
export const offlineService = new OfflineService();
export type { OfflineState };
