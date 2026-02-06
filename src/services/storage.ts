// Re-export from db.ts for backwards compatibility
// All storage now uses IndexedDB via Dexie
export type { Report, Report as StoredReport } from './db';
export { 
    loadReports, 
    saveReport, 
    removeReport,
    exportReports,
    importReports,
    migrateFromLocalStorage,
    getStats
} from './db';
