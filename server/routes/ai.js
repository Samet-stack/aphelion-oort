// Routes pour l'analyse AI via Gemini
// La clé API est côté serveur, jamais exposée au client

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { validateAnalyzeImage, validateCompareImages } from '../middleware/validation.js';

const router = express.Router();

// Clé API Gemini côté serveur (sécurisée)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

// Vérifier si l'AI est configurée
router.get('/status', (req, res) => {
    res.json({
        configured: !!GEMINI_API_KEY,
        model: GEMINI_API_KEY ? GEMINI_MODEL : null,
    });
});

// Analyser une image
router.post('/analyze', authMiddleware, aiLimiter, validateAnalyzeImage, async (req, res) => {
    try {
        // Vérifier que l'AI est configurée
        if (!GEMINI_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'AI service not configured',
            });
        }

        const { imageBase64, mimeType = 'image/jpeg', language = 'fr' } = req.body;

        if (!imageBase64) {
            return res.status(400).json({
                success: false,
                message: 'imageBase64 is required',
            });
        }

        // Limiter la taille de l'image (10MB max base64)
        if (imageBase64.length > 14 * 1024 * 1024) { // ~10MB après décodage
            return res.status(413).json({
                success: false,
                message: 'Image too large (max 10MB)',
            });
        }

        // Appeler l'API Gemini
        const prompt = language === 'fr'
            ? `Tu es un expert en inspection de chantier BTP. Analyse cette photo et réponds UNIQUEMENT en JSON valide:
{
  "description": "Description professionnelle détaillée",
  "category": "safety|progress|anomaly|other",
  "priority": "low|medium|high", 
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "issues": [{"type": "type", "description": "desc", "severity": "low|medium|high"}]
}

Catégories: safety=danger, progress=avancement, anomaly=défaut, other=autre
Priorités: high=danger immédiat, medium=à traiter, low=mineur`
            : `You are a construction site inspection expert. Analyze this photo and respond ONLY in valid JSON:
{
  "description": "Detailed professional description",
  "category": "safety|progress|anomaly|other",
  "priority": "low|medium|high",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "issues": [{"type": "type", "description": "desc", "severity": "low|medium|high"}]
}`;

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: imageBase64,
                                    },
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 2048,
                    },
                }),
            }
        );

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json().catch(() => ({}));
            console.error('[AI Route] Gemini API error:', errorData);
            
            // Gérer les erreurs spécifiques
            if (geminiResponse.status === 429) {
                return res.status(429).json({
                    success: false,
                    message: 'AI quota exceeded. Please try again later.',
                    error: 'QUOTA_EXCEEDED',
                });
            }

            return res.status(502).json({
                success: false,
                message: 'AI analysis failed',
                error: errorData.error?.message || `HTTP ${geminiResponse.status}`,
            });
        }

        const data = await geminiResponse.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            return res.status(502).json({
                success: false,
                message: 'Empty response from AI',
            });
        }

        // Parser le JSON
        let result;
        try {
            // Nettoyer les balises markdown
            const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
            result = JSON.parse(cleaned);
        } catch (parseError) {
            // Essayer d'extraire avec regex
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    result = JSON.parse(match[0]);
                } catch {
                    throw new Error('Invalid JSON in AI response');
                }
            } else {
                throw new Error('No JSON found in AI response');
            }
        }

        // Normaliser le résultat
        const normalizedResult = {
            description: result.description || 'Analyse non disponible',
            category: ['safety', 'progress', 'anomaly', 'other'].includes(result.category)
                ? result.category
                : 'other',
            priority: ['low', 'medium', 'high'].includes(result.priority)
                ? result.priority
                : 'medium',
            tags: Array.isArray(result.tags) ? result.tags.slice(0, 10) : [],
            confidence: typeof result.confidence === 'number'
                ? Math.min(1, Math.max(0, result.confidence))
                : 0.85,
            issues: Array.isArray(result.issues)
                ? result.issues.filter(i => i.type && i.description).map(i => ({
                    type: i.type,
                    description: i.description,
                    severity: ['low', 'medium', 'high'].includes(i.severity)
                        ? i.severity
                        : 'medium',
                }))
                : [],
        };

        res.json({
            success: true,
            data: normalizedResult,
        });

    } catch (error) {
        console.error('[AI Route] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during AI analysis',
            error: error.message,
        });
    }
});

// Comparer deux images (avant/après)
router.post('/compare', authMiddleware, aiLimiter, validateCompareImages, async (req, res) => {
    try {
        if (!GEMINI_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'AI service not configured',
            });
        }

        const { beforeBase64, afterBase64, mimeType = 'image/jpeg', language = 'fr' } = req.body;

        if (!beforeBase64 || !afterBase64) {
            return res.status(400).json({
                success: false,
                message: 'Both before and after images are required',
            });
        }

        const prompt = language === 'fr'
            ? 'Compare ces deux photos de chantier (avant/après). Réponds en JSON: {"comparison": "description", "changes": ["liste"], "progress": "started|in_progress|completed"}'
            : 'Compare these two construction site photos. Respond in JSON: {"comparison": "description", "changes": ["list"], "progress": "started|in_progress|completed"}';

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: beforeBase64,
                                    },
                                },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: afterBase64,
                                    },
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API error: ${geminiResponse.status}`);
        }

        const data = await geminiResponse.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        let parsed;
        try {
            const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch {
            parsed = {};
        }

        res.json({
            success: true,
            data: {
                comparison: parsed.comparison || parsed.description || '',
                changes: parsed.changes || parsed.differences || [],
                progress: ['started', 'in_progress', 'completed'].includes(parsed.progress)
                    ? parsed.progress
                    : 'in_progress',
            },
        });

    } catch (error) {
        console.error('[AI Route] Compare error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compare images',
        });
    }
});

export default router;
