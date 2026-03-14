import { create } from 'zustand';
import { ApiPlan } from '../services/api';

const STORAGE_KEYS = {
    selectedPlan: 'siteflow_selected_plan',
    capturedImage: 'siteflow_captured_image',
};

type StoredCapturedImage = {
    dataUrl: string;
    name: string;
    type: string;
    lastModified: number;
};

const isBrowser = typeof window !== 'undefined';

const readStoredJson = <T,>(key: string): T | null => {
    if (!isBrowser) return null;
    try {
        const raw = window.sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : null;
    } catch {
        return null;
    }
};

const writeStoredJson = (key: string, value: unknown) => {
    if (!isBrowser) return;
    window.sessionStorage.setItem(key, JSON.stringify(value));
};

const clearStored = (key: string) => {
    if (!isBrowser) return;
    window.sessionStorage.removeItem(key);
};

const dataUrlToFile = async (stored: StoredCapturedImage): Promise<File> => {
    const response = await fetch(stored.dataUrl);
    const blob = await response.blob();
    return new File([blob], stored.name, {
        type: stored.type || blob.type || 'image/jpeg',
        lastModified: stored.lastModified || Date.now(),
    });
};

interface AppState {
    capturedImage: File | null;
    capturedImageAsset: StoredCapturedImage | null;
    selectedPlan: ApiPlan | null;
    setCapturedImage: (file: File | null, asset?: StoredCapturedImage | null) => void;
    setSelectedPlan: (plan: ApiPlan | null) => void;
    restoreCapturedImage: () => Promise<File | null>;
    resetApp: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    capturedImage: null,
    capturedImageAsset: readStoredJson<StoredCapturedImage>(STORAGE_KEYS.capturedImage),
    selectedPlan: readStoredJson<ApiPlan>(STORAGE_KEYS.selectedPlan),
    setCapturedImage: (file, asset = null) => {
        if (asset) {
            writeStoredJson(STORAGE_KEYS.capturedImage, asset);
        } else {
            clearStored(STORAGE_KEYS.capturedImage);
        }
        set({ capturedImage: file, capturedImageAsset: asset });
    },
    setSelectedPlan: (plan) => {
        if (plan) {
            writeStoredJson(STORAGE_KEYS.selectedPlan, plan);
        } else {
            clearStored(STORAGE_KEYS.selectedPlan);
        }
        set({ selectedPlan: plan });
    },
    restoreCapturedImage: async () => {
        const stored = readStoredJson<StoredCapturedImage>(STORAGE_KEYS.capturedImage);
        if (!stored) {
            set({ capturedImage: null, capturedImageAsset: null });
            return null;
        }

        const file = await dataUrlToFile(stored);
        set({ capturedImage: file, capturedImageAsset: stored });
        return file;
    },
    resetApp: () => {
        clearStored(STORAGE_KEYS.selectedPlan);
        clearStored(STORAGE_KEYS.capturedImage);
        set({ capturedImage: null, capturedImageAsset: null, selectedPlan: null });
    }
}));
