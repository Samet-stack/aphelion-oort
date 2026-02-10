// Service AI - Analyse d'images via le backend
// La clé API n'est jamais exposée côté client

import { API_URL } from './api';

// Types exportés
export interface AIAnalysisResult {
    description: string;
    category: 'safety' | 'progress' | 'anomaly' | 'other';
    priority: 'low' | 'medium' | 'high';
    tags: string[];
    confidence: number;
    issues: Array<{
        type: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
    }>;
}

export interface AIAnalysisOptions {
    language?: 'fr' | 'en';
    detail?: 'low' | 'high' | 'auto';
    maxTokens?: number;
}

// Cache pour éviter les appels répétés
const analysisCache = new Map<string, AIAnalysisResult>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 heure

// Générer une clé de cache
const generateCacheKey = (file: File, options: AIAnalysisOptions): string => {
    return `${file.name}-${file.size}-${file.lastModified}-${options.language}-${options.detail}`;
};

// Convertir File en base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Enlever le prefix "data:image/jpeg;base64,"
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Token storage (même logique que api.ts)
const getToken = () => localStorage.getItem('siteflow_token');

// Vérifier si l'AI est configurée (appel au backend)
export const isAIConfigured = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${API_URL}/ai/status`);
        if (response.ok) {
            const data = await response.json();
            return data.configured;
        }
        return false;
    } catch {
        return false;
    }
};

// Version synchrone (pour l'UI initiale - vérifie le cache local)
export const isAIConfiguredSync = (): boolean => {
    // On suppose configuré, le backend gérera l'erreur si ce n'est pas le cas
    return true;
};

// Analyser une image via le backend
export const analyzeImage = async (
    file: File,
    options: AIAnalysisOptions = {}
): Promise<AIAnalysisResult> => {
    const { language = 'fr' } = options;

    // Vérifier le cache
    const cacheKey = generateCacheKey(file, options);
    const cached = analysisCache.get(cacheKey);
    if (cached) {
        console.log('[AI] Using cached result');
        return cached;
    }

    const token = getToken();
    if (!token) {
        console.warn('[AI] No auth token, using fallback');
        return generateFallbackResult(language);
    }

    try {
        console.log('[AI] Starting image analysis via backend...');
        const base64Image = await fileToBase64(file);

        const response = await fetch(`${API_URL}/ai/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                imageBase64: base64Image,
                mimeType: file.type || 'image/jpeg',
                language,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Gérer les erreurs spécifiques
            if (response.status === 429) {
                console.warn('[AI] Quota exceeded');
            } else if (response.status === 503) {
                console.warn('[AI] Service not configured');
            }
            
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.data) {
            throw new Error('Invalid response from server');
        }

        const result: AIAnalysisResult = data.data;

        // Mettre en cache
        analysisCache.set(cacheKey, result);
        
        // Nettoyer le cache après la durée définie
        setTimeout(() => {
            analysisCache.delete(cacheKey);
        }, CACHE_DURATION);

        console.log('[AI] Analysis completed successfully');
        return result;

    } catch (error) {
        console.error('[AI] Analysis failed:', error);
        // Fallback silencieux
        return generateFallbackResult(language);
    }
};

// Générer une description fallback
const generateFallbackDescription = (language: 'fr' | 'en'): string => {
    if (language === 'fr') {
        return `Inspection de chantier réalisée. État des lieux photographié pour documentation.

Note: L'analyse automatique n'a pas pu être effectuée. Veuillez compléter manuellement la description des observations.`;
    }
    return `Site inspection completed. Site condition photographed for documentation.

Note: Automatic analysis could not be performed. Please manually complete the observation description.`;
};

// Résultat fallback complet
const generateFallbackResult = (language: 'fr' | 'en'): AIAnalysisResult => ({
    description: generateFallbackDescription(language),
    category: 'other',
    priority: 'medium',
    tags: ['inspection', 'documentation'],
    confidence: 0.5,
    issues: [],
});

// Fonction legacy pour compatibilité
export const generateDescription = async (file: File): Promise<string> => {
    const result = await analyzeImage(file, { language: 'fr' });
    return result.description;
};

// Analyse batch
export const analyzeImages = async (
    files: File[],
    options: AIAnalysisOptions = {}
): Promise<AIAnalysisResult[]> => {
    // Limiter à 3 images simultanées
    const BATCH_SIZE = 3;
    const results: AIAnalysisResult[] = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(file => analyzeImage(file, options))
        );
        results.push(...batchResults);
    }

    return results;
};

// Comparer deux images
export const compareImages = async (
    beforeFile: File,
    afterFile: File,
    language: 'fr' | 'en' = 'fr'
): Promise<{
    comparison: string;
    changes: string[];
    progress: 'started' | 'in_progress' | 'completed';
}> => {
    const token = getToken();
    if (!token) {
        return {
            comparison: language === 'fr' 
                ? 'Comparaison non disponible'
                : 'Comparison not available',
            changes: [],
            progress: 'in_progress',
        };
    }

    try {
        const [beforeBase64, afterBase64] = await Promise.all([
            fileToBase64(beforeFile),
            fileToBase64(afterFile),
        ]);

        const response = await fetch(`${API_URL}/ai/compare`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                beforeBase64,
                afterBase64,
                mimeType: beforeFile.type || 'image/jpeg',
                language,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.data || {
            comparison: '',
            changes: [],
            progress: 'in_progress',
        };

    } catch (error) {
        console.error('[AI] Comparison failed:', error);
        return {
            comparison: language === 'fr' 
                ? 'Erreur lors de la comparaison'
                : 'Error during comparison',
            changes: [],
            progress: 'in_progress',
        };
    }
};

// Vider le cache
export const clearAICache = (): void => {
    analysisCache.clear();
    console.log('[AI] Cache cleared');
};

// Obtenir les stats du cache
export const getCacheStats = (): { size: number; entries: string[] } => ({
    size: analysisCache.size,
    entries: Array.from(analysisCache.keys()),
});
