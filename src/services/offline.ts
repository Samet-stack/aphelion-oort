// Service de gestion du mode hors-ligne
// Stockage local des rapports + synchro auto (avec backoff progressif)

import { reportsApi, type ApiReport, type ApiReportCreateInput } from './api';
import { offlineDB, type PendingReport } from './offline-db';

interface OfflineQueueItem {
  localId: string;
  createdAtLocal: string;
  syncStatus: PendingReport['syncStatus'];
  syncAttempts: number;
  maxSyncAttempts: number;
  nextRetryAt: string | null;
  lastError?: string;
}

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  retryScheduledCount: number;
  failedCount: number;
  nextRetryAt: string | null;
  queuePreview: OfflineQueueItem[];
  isSyncing: boolean;
  lastSync: string | null;
}

interface SyncResult {
  success: number;
  failed: number;
}

type OfflineReportPayload = ApiReportCreateInput;

const SYNC_INTERVAL = 30_000; // 30 secondes
const MAX_SYNC_ATTEMPTS = 8;
const BASE_RETRY_DELAY_MS = 15_000; // 15s
const MAX_RETRY_DELAY_MS = 15 * 60_000; // 15min
const QUEUE_PREVIEW_LIMIT = 5;

class OfflineService {
  private listeners: Set<(state: OfflineState) => void> = new Set();
  private syncInterval: number | null = null;
  private currentState: OfflineState = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    retryScheduledCount: 0,
    failedCount: 0,
    nextRetryAt: null,
    queuePreview: [],
    isSyncing: false,
    lastSync: null,
  };
  private useFallback = false; // Fallback sur localStorage si IndexedDB échoue

  constructor() {
    void this.init();
  }

  private async init() {
    try {
      await offlineDB.init();
      this.useFallback = false;
    } catch (error) {
      console.warn('IndexedDB indisponible, fallback sur localStorage', error);
      this.useFallback = true;
    }

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    await this.updatePendingState();
    this.startPeriodicSync();

    if (navigator.onLine) {
      void this.sync();
    }
  }

  private handleOnline = () => {
    this.currentState.isOnline = true;
    this.notifyListeners();
    void this.sync();
  };

  private handleOffline = () => {
    this.currentState.isOnline = false;
    this.notifyListeners();
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine && this.currentState.pendingCount > 0) {
      void this.sync();
    }
  };

  private startPeriodicSync() {
    if (this.syncInterval) return;
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && this.currentState.pendingCount > 0) {
        void this.sync();
      }
    }, SYNC_INTERVAL);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  getState(): OfflineState {
    return { ...this.currentState, queuePreview: [...this.currentState.queuePreview] };
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private toQueueItem(report: PendingReport): OfflineQueueItem {
    return {
      localId: report.localId,
      createdAtLocal: report.createdAtLocal,
      syncStatus: report.syncStatus,
      syncAttempts: report.syncAttempts,
      maxSyncAttempts: report.maxSyncAttempts,
      nextRetryAt: report.nextRetryAt,
      lastError: report.lastError,
    };
  }

  private getNearestRetryAt(reports: PendingReport[]): string | null {
    const timestamps = reports
      .map((report) => report.nextRetryAt)
      .filter((value): value is string => Boolean(value))
      .map((value) => Date.parse(value))
      .filter((timestamp) => Number.isFinite(timestamp));
    if (timestamps.length === 0) return null;
    return new Date(Math.min(...timestamps)).toISOString();
  }

  private async updatePendingState() {
    try {
      const reports = await this.getPendingReports();
      const now = Date.now();
      this.currentState.pendingCount = reports.length;
      this.currentState.failedCount = reports.filter((report) => report.syncStatus === 'failed').length;
      this.currentState.retryScheduledCount = reports.filter((report) => {
        if (!report.nextRetryAt) return false;
        const retryAt = Date.parse(report.nextRetryAt);
        return Number.isFinite(retryAt) && retryAt > now;
      }).length;
      this.currentState.nextRetryAt = this.getNearestRetryAt(reports);
      this.currentState.queuePreview = [...reports]
        .sort((a, b) => Date.parse(b.createdAtLocal) - Date.parse(a.createdAtLocal))
        .slice(0, QUEUE_PREVIEW_LIMIT)
        .map((report) => this.toQueueItem(report));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to update pending state:', error);
    }
  }

  async getPendingReports(): Promise<PendingReport[]> {
    if (this.useFallback) {
      return offlineDB.getAllFallback();
    }
    try {
      return await offlineDB.getAll();
    } catch (error) {
      console.warn('IndexedDB failed, fallback to localStorage', error);
      this.useFallback = true;
      return offlineDB.getAllFallback();
    }
  }

  async saveReportLocal(reportData: OfflineReportPayload): Promise<string> {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const newReport: PendingReport = {
      id: localId,
      localId,
      data: reportData,
      createdAtLocal: new Date().toISOString(),
      syncAttempts: 0,
      maxSyncAttempts: MAX_SYNC_ATTEMPTS,
      syncStatus: 'pending',
      nextRetryAt: null,
    };

    try {
      if (this.useFallback) {
        await offlineDB.addFallback(newReport);
      } else {
        try {
          await offlineDB.add(newReport);
        } catch (error) {
          console.warn('IndexedDB add failed, fallback mode', error);
          await offlineDB.addFallback(newReport);
          this.useFallback = true;
        }
      }

      await this.updatePendingState();
      if (navigator.onLine) {
        void this.sync();
      }
      return localId;
    } catch (error) {
      console.error('Failed to save report locally:', error);
      throw new Error('Impossible de sauvegarder le rapport localement');
    }
  }

  private async removePendingReport(localId: string) {
    try {
      if (this.useFallback) {
        await offlineDB.deleteFallback(localId);
      } else {
        try {
          await offlineDB.delete(localId);
        } catch (error) {
          await offlineDB.deleteFallback(localId);
          this.useFallback = true;
        }
      }
      await this.updatePendingState();
    } catch (error) {
      console.error('Failed to remove pending report:', error);
    }
  }

  private async updatePendingReport(report: PendingReport) {
    try {
      if (this.useFallback) {
        await offlineDB.updateFallback(report);
      } else {
        try {
          await offlineDB.update(report);
        } catch (error) {
          await offlineDB.updateFallback(report);
          this.useFallback = true;
        }
      }
    } catch (error) {
      console.error('Failed to update pending report:', error);
    }
  }

  private computeRetryDelayMs(syncAttempts: number): number {
    const exponent = Math.max(0, syncAttempts - 1);
    const rawDelay = BASE_RETRY_DELAY_MS * 2 ** exponent;
    const cappedDelay = Math.min(rawDelay, MAX_RETRY_DELAY_MS);
    const jitter = Math.floor(cappedDelay * Math.random() * 0.25);
    return cappedDelay + jitter;
  }

  private isRetryReady(report: PendingReport, now: number): boolean {
    if (!report.nextRetryAt) return true;
    const retryAt = Date.parse(report.nextRetryAt);
    if (!Number.isFinite(retryAt)) return true;
    return retryAt <= now;
  }

  private canSyncReport(report: PendingReport, now: number, force: boolean): boolean {
    if (force) return true;
    if (report.syncStatus === 'failed') return false;
    return this.isRetryReady(report, now);
  }

  async sync(force = false): Promise<SyncResult> {
    if (this.currentState.isSyncing || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    const pendingReports = await this.getPendingReports();
    if (pendingReports.length === 0) {
      return { success: 0, failed: 0 };
    }

    const now = Date.now();
    const reportsToSync = pendingReports.filter((report) => this.canSyncReport(report, now, force));
    if (reportsToSync.length === 0) {
      await this.updatePendingState();
      return { success: 0, failed: 0 };
    }

    this.currentState.isSyncing = true;
    this.notifyListeners();

    let success = 0;
    let failed = 0;

    for (const report of reportsToSync) {
      try {
        await reportsApi.create(report.data);
        await this.removePendingReport(report.localId);
        success++;
      } catch (error: unknown) {
        report.syncAttempts += 1;
        report.lastAttemptAt = new Date().toISOString();
        report.lastError = error instanceof Error ? error.message : 'Erreur inconnue';

        if (report.syncAttempts >= report.maxSyncAttempts) {
          report.syncStatus = 'failed';
          report.nextRetryAt = null;
        } else {
          report.syncStatus = 'retry';
          const retryDelay = this.computeRetryDelayMs(report.syncAttempts);
          report.nextRetryAt = new Date(Date.now() + retryDelay).toISOString();
        }

        failed++;
        await this.updatePendingReport(report);
      }
    }

    this.currentState.isSyncing = false;
    this.currentState.lastSync = new Date().toISOString();
    await this.updatePendingState();

    return { success, failed };
  }

  async forceSync(): Promise<SyncResult> {
    return this.sync(true);
  }

  async getAllReports(serverReports: ApiReport[]): Promise<ApiReport[]> {
    const pending = await this.getPendingReports();
    const localReports: ApiReport[] = pending.map((pendingReport) => ({
      ...pendingReport.data,
      id: pendingReport.localId,
      createdAt: pendingReport.createdAtLocal,
      extraWorks: pendingReport.data.extraWorks || [],
    })) as ApiReport[];

    return [...serverReports, ...localReports].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }

  async cancelLocalReport(localId: string): Promise<boolean> {
    const pending = await this.getPendingReports();
    const exists = pending.some((report) => report.localId === localId);
    if (!exists) return false;
    await this.removePendingReport(localId);
    return true;
  }

  async clearAllPending(): Promise<void> {
    try {
      if (this.useFallback) {
        localStorage.removeItem('siteflow_offline_pending');
      } else {
        try {
          await offlineDB.clear();
        } catch (error) {
          localStorage.removeItem('siteflow_offline_pending');
          this.useFallback = true;
        }
      }
      await this.updatePendingState();
    } catch (error) {
      console.error('Failed to clear pending reports:', error);
    }
  }
}

// Singleton
export const offlineService = new OfflineService();
export type { OfflineState, OfflineReportPayload, OfflineQueueItem };
