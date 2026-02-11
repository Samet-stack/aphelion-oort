// IndexedDB storage pour le mode hors-ligne
// Remplace localStorage (limité à 5-10MB) par IndexedDB (50MB+)
import type { ApiReportCreateInput } from './api';

const DB_NAME = 'SiteFlowOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingReports';
const DEFAULT_MAX_SYNC_ATTEMPTS = 8;

type PendingSyncStatus = 'pending' | 'retry' | 'failed';

interface PendingReport {
  id: string;
  localId: string;
  data: ApiReportCreateInput;
  createdAtLocal: string;
  syncAttempts: number;
  maxSyncAttempts: number;
  syncStatus: PendingSyncStatus;
  nextRetryAt: string | null;
  lastAttemptAt?: string;
  lastError?: string;
}

const isPendingSyncStatus = (value: unknown): value is PendingSyncStatus =>
  value === 'pending' || value === 'retry' || value === 'failed';

const normalizePendingReport = (raw: unknown): PendingReport | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const localId = typeof candidate.localId === 'string' ? candidate.localId : null;
  if (!localId) return null;
  const data = candidate.data as ApiReportCreateInput | undefined;
  if (!data || typeof data !== 'object') return null;
  const createdAtLocal =
    typeof candidate.createdAtLocal === 'string'
      ? candidate.createdAtLocal
      : new Date().toISOString();
  const syncAttempts =
    typeof candidate.syncAttempts === 'number' && Number.isFinite(candidate.syncAttempts)
      ? Math.max(0, Math.floor(candidate.syncAttempts))
      : 0;
  const maxSyncAttempts =
    typeof candidate.maxSyncAttempts === 'number' && Number.isFinite(candidate.maxSyncAttempts)
      ? Math.max(1, Math.floor(candidate.maxSyncAttempts))
      : DEFAULT_MAX_SYNC_ATTEMPTS;
  const syncStatus = isPendingSyncStatus(candidate.syncStatus) ? candidate.syncStatus : 'pending';
  const nextRetryAt = typeof candidate.nextRetryAt === 'string' ? candidate.nextRetryAt : null;
  const lastError = typeof candidate.lastError === 'string' ? candidate.lastError : undefined;
  const lastAttemptAt =
    typeof candidate.lastAttemptAt === 'string' ? candidate.lastAttemptAt : undefined;

  return {
    id: typeof candidate.id === 'string' ? candidate.id : localId,
    localId,
    data,
    createdAtLocal,
    syncAttempts,
    maxSyncAttempts,
    syncStatus,
    nextRetryAt,
    lastError,
    lastAttemptAt,
  };
};

class OfflineDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private doInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        }
      };
    });
  }

  async getAll(): Promise<PendingReport[]> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const normalized = (request.result || [])
          .map(normalizePendingReport)
          .filter((item): item is PendingReport => item !== null);
        resolve(normalized);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async add(report: PendingReport): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');
    const normalized = normalizePendingReport(report);
    if (!normalized) throw new Error('Invalid pending report');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(normalized);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async update(report: PendingReport): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');
    const normalized = normalizePendingReport(report);
    if (!normalized) throw new Error('Invalid pending report');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(normalized);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(localId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(localId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Fallback sur localStorage si IndexedDB échoue
  async getAllFallback(): Promise<PendingReport[]> {
    try {
      const raw = localStorage.getItem('siteflow_offline_pending');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizePendingReport)
        .filter((item): item is PendingReport => item !== null);
    } catch {
      return [];
    }
  }

  async addFallback(report: PendingReport): Promise<void> {
    const normalized = normalizePendingReport(report);
    if (!normalized) throw new Error('Invalid pending report');
    const reports = await this.getAllFallback();
    reports.push(normalized);
    localStorage.setItem('siteflow_offline_pending', JSON.stringify(reports));
  }

  async deleteFallback(localId: string): Promise<void> {
    const reports = (await this.getAllFallback()).filter((report) => report.localId !== localId);
    localStorage.setItem('siteflow_offline_pending', JSON.stringify(reports));
  }

  async updateFallback(report: PendingReport): Promise<void> {
    const normalized = normalizePendingReport(report);
    if (!normalized) throw new Error('Invalid pending report');
    const reports = await this.getAllFallback();
    const index = reports.findIndex((item) => item.localId === normalized.localId);
    if (index >= 0) {
      reports[index] = normalized;
    } else {
      reports.push(normalized);
    }
    localStorage.setItem('siteflow_offline_pending', JSON.stringify(reports));
  }
}

export const offlineDB = new OfflineDB();
export type { PendingReport, PendingSyncStatus };
