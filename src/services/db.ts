import Dexie, { Table } from 'dexie';
import type { LocationSource } from './geo';

export interface Report {
    id: string;
    createdAt: string;
    dateLabel: string;
    address: string;
    coordinates: string;
    accuracy: number | null;
    locationSource: LocationSource;
    description: string;
    imageDataUrl: string;
    // Champs métier
    siteName?: string;
    operatorName?: string;
    clientName?: string;
    priority?: 'low' | 'medium' | 'high';
    category?: 'safety' | 'progress' | 'anomaly' | 'other';
    // Revenue Features
    isBillable?: boolean;
    estimatedCost?: string;
}

class SiteFlowDB extends Dexie {
    reports!: Table<Report>;

    constructor() {
        super('SiteFlowDB');
        this.version(1).stores({
            reports: 'id, createdAt, siteName, priority, category'
        });
    }
}

export const db = new SiteFlowDB();

// Migration depuis localStorage (one-time)
export const migrateFromLocalStorage = async (): Promise<void> => {
    const STORAGE_KEY = 'siteflow_reports_v1';
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
        const oldReports = JSON.parse(raw) as Report[];
        if (Array.isArray(oldReports) && oldReports.length > 0) {
            // Check if already migrated
            const existingCount = await db.reports.count();
            if (existingCount === 0) {
                await db.reports.bulkAdd(oldReports);
                console.log(`Migrated ${oldReports.length} reports from localStorage`);
            }
        }
        // Clear old storage after migration
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        console.error('Migration failed:', err);
    }
};

export const loadReports = async (): Promise<Report[]> => {
    return await db.reports.orderBy('createdAt').reverse().toArray();
};

export const saveReport = async (report: Report): Promise<Report[]> => {
    await db.reports.put(report);
    return await loadReports();
};

export const removeReport = async (id: string): Promise<Report[]> => {
    await db.reports.delete(id);
    return await loadReports();
};

// Export/Import
export const exportReports = async (): Promise<string> => {
    const reports = await db.reports.toArray();
    return JSON.stringify({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        reports
    }, null, 2);
};

export const importReports = async (jsonString: string): Promise<{ success: number; errors: number }> => {
    try {
        const data = JSON.parse(jsonString);
        const reports = data.reports as Report[];

        if (!Array.isArray(reports)) {
            throw new Error('Invalid format: reports must be an array');
        }

        let success = 0;
        let errors = 0;

        for (const report of reports) {
            try {
                await db.reports.put(report);
                success++;
            } catch {
                errors++;
            }
        }

        return { success, errors };
    } catch (err) {
        throw new Error('Invalid JSON file');
    }
};

// Stats
export const getStats = async () => {
    const total = await db.reports.count();
    const byCategory = await db.reports.toArray().then(reports => {
        return reports.reduce((acc, r) => {
            const cat = r.category || 'other';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    });
    const byPriority = await db.reports.toArray().then(reports => {
        return reports.reduce((acc, r) => {
            const pri = r.priority || 'medium';
            acc[pri] = (acc[pri] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    });

    return { total, byCategory, byPriority };
};
