// IndexedDB storage pour le mode hors-ligne
// Remplace localStorage (limité à 5-10MB) par IndexedDB (50MB+)

const DB_NAME = 'SiteFlowOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingReports';

interface PendingReport {
  id: string;
  localId: string;
  data: any;
  createdAtLocal: string;
  syncAttempts: number;
  lastError?: string;
}

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

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async add(report: PendingReport): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(report);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async update(report: PendingReport): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(report);

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
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async addFallback(report: PendingReport): Promise<void> {
    const reports = await this.getAllFallback();
    reports.push(report);
    localStorage.setItem('siteflow_offline_pending', JSON.stringify(reports));
  }

  async deleteFallback(localId: string): Promise<void> {
    const reports = (await this.getAllFallback()).filter(r => r.localId !== localId);
    localStorage.setItem('siteflow_offline_pending', JSON.stringify(reports));
  }
}

export const offlineDB = new OfflineDB();
export type { PendingReport };
