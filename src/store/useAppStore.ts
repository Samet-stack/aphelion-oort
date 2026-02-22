import { create } from 'zustand';
import { ApiPlan } from '../services/api';

interface AppState {
    capturedImage: File | null;
    selectedPlan: ApiPlan | null;
    setCapturedImage: (file: File | null) => void;
    setSelectedPlan: (plan: ApiPlan | null) => void;
    resetApp: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    capturedImage: null,
    selectedPlan: null,
    setCapturedImage: (file) => set({ capturedImage: file }),
    setSelectedPlan: (plan) => set({ selectedPlan: plan }),
    resetApp: () => set({ capturedImage: null, selectedPlan: null })
}));
