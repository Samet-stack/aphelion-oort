// Service AI - Analyse d'images de chantier avec OpenAI Vision API
// Archive - Utiliser gemini.ts pour Google Gemini (gratuit)

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

// Clé API depuis les variables d'environnement
const getApiKey = (): string | null => {
    return import.meta.env.VITE_OPENAI_API_KEY || null;
};

// Vérifier si l'AI est configurée
export const isAIConfigured = (): boolean => {
    return !!getApiKey();
};

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
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Prompt système optimisé pour l'analyse de chantier
const getSystemPrompt = (language: 'fr' | 'en' = 'fr'): string => {
    if (language === 'fr') {
        return `Tu es un expert en inspection de chantier et construction BTP. 
Analyse cette photo de chantier et fournis une description professionnelle détaillée.

STRUCTURE DE TA RÉPONSE (JSON uniquement):
{
  "description": "Description détaillée de ce qui est visible sur le chantier (matériaux, équipements, travaux en cours, état des lieux)",
  "category": "safety|progress|anomaly|other",
  "priority": "low|medium|high",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "issues": [
    {
      "type": "sécurité|qualité|planning|matériaux",
      "description": "Description du problème",
      "severity": "low|medium|high"
    }
  ]
}

CATÉGORIES:
- safety: Problèmes de sécurité (EPI, signalisation, risques)
- progress: Avancement des travaux, état d'avancement
- anomaly: Anomalies, défauts, non-conformités
- other: Autres observations

PRIORITÉS:
- high: Danger immédiat, risque d'accident, non-conformité critique
- medium: Problème à traiter rapidement, amélioration nécessaire
- low: Observation mineure, point d'attention

Sois précis, technique et professionnel. Identifie les équipements de protection individuelle, les matériaux, les zones de travail.`;
    }

    return `You are an expert in construction site inspection and building works.
Analyze this construction site photo and provide a detailed professional description.

RESPONSE STRUCTURE (JSON only):
{
  "description": "Detailed description of what is visible on the site (materials, equipment, ongoing work, site condition)",
  "category": "safety|progress|anomaly|other",
  "priority": "low|medium|high",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "issues": [
    {
      "type": "safety|quality|scheduling|materials",
      "description": "Description of the issue",
      "severity": "low|medium|high"
    }
  ]
}

CATEGORIES:
- safety: Safety issues (PPE, signage, hazards)
- progress: Work progress, advancement status
- anomaly: Anomalies, defects, non-compliance
- other: Other observations

PRIORITIES:
- high: Immediate danger, accident risk, critical non-compliance
- medium: Issue to be addressed quickly, improvement needed
- low: Minor observation, point of attention

Be precise, technical and professional.`;
};

// Analyser une image avec OpenAI Vision
export const analyzeImage = async (
    file: File,
    options: AIAnalysisOptions = {}
): Promise<AIAnalysisResult> => {
    const { language = 'fr', detail = 'auto', maxTokens = 1000 } = options;

    const apiKey = getApiKey();
    if (!apiKey) {
        return generateFallbackResult(language);
    }

    const cacheKey = generateCacheKey(file, options);
    const cached = analysisCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const base64Image = await fileToBase64(file);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: getSystemPrompt(language),
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                    detail: detail,
                                },
                            },
                        ],
                    },
                ],
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error('Empty response from AI');
        }

        let result: AIAnalysisResult;
        try {
            result = JSON.parse(content);
        } catch (parseError) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Invalid JSON response');
            }
        }

        const normalizedResult: AIAnalysisResult = {
            description: result.description || generateFallbackDescription(language),
            category: ['safety', 'progress', 'anomaly', 'other'].includes(result.category)
                ? result.category
                : 'other',
            priority: ['low', 'medium', 'high'].includes(result.priority)
                ? result.priority
                : 'medium',
            tags: Array.isArray(result.tags) ? result.tags.slice(0, 10) : [],
            confidence: typeof result.confidence === 'number'
                ? Math.min(1, Math.max(0, result.confidence))
                : 0.8,
            issues: Array.isArray(result.issues)
                ? result.issues.filter(i => i.type && i.description)
                : [],
        };

        analysisCache.set(cacheKey, normalizedResult);
        setTimeout(() => {
            analysisCache.delete(cacheKey);
        }, CACHE_DURATION);

        return normalizedResult;

    } catch (error) {
        console.error('[OpenAI] Analysis failed:', error);
        return generateFallbackResult(language);
    }
};

const generateFallbackDescription = (language: 'fr' | 'en'): string => {
    if (language === 'fr') {
        return `Inspection de chantier réalisée. État des lieux photographié pour documentation.

Note: L'analyse automatique n'a pas pu être effectuée. Veuillez compléter manuellement la description des observations.`;
    }
    return `Site inspection completed. Site condition photographed for documentation.

Note: Automatic analysis could not be performed. Please manually complete the observation description.`;
};

const generateFallbackResult = (language: 'fr' | 'en'): AIAnalysisResult => ({
    description: generateFallbackDescription(language),
    category: 'other',
    priority: 'medium',
    tags: ['inspection', 'documentation'],
    confidence: 0.5,
    issues: [],
});

export const generateDescription = async (file: File): Promise<string> => {
    const result = await analyzeImage(file, { language: 'fr' });
    return result.description;
};

export const analyzeImages = async (
    files: File[],
    options: AIAnalysisOptions = {}
): Promise<AIAnalysisResult[]> => {
    const BATCH_SIZE = 5;
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

export const compareImages = async (
    _beforeFile: File,
    _afterFile: File,
    _language: 'fr' | 'en' = 'fr'
): Promise<{
    comparison: string;
    changes: string[];
    progress: 'started' | 'in_progress' | 'completed';
}> => {
    // Implementation similaire à gemini.ts
    return {
        comparison: 'Not implemented',
        changes: [],
        progress: 'in_progress',
    };
};

export const clearAICache = (): void => {
    analysisCache.clear();
};

export const getCacheStats = (): { size: number; entries: string[] } => ({
    size: analysisCache.size,
    entries: Array.from(analysisCache.keys()),
});
