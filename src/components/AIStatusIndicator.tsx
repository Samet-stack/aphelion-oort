import React from 'react';
import { Sparkles, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { isAIConfiguredSync } from '../services/gemini';

interface AIStatusIndicatorProps {
    isAnalyzing: boolean;
    hasResult: boolean;
    error?: string | null;
    confidence?: number;
}

export const AIStatusIndicator: React.FC<AIStatusIndicatorProps> = ({
    isAnalyzing,
    hasResult,
    error,
    confidence,
}) => {
    const isConfigured = isAIConfiguredSync();

    if (isAnalyzing) {
        return (
            <div 
                className="ai-status ai-status--analyzing"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'rgba(255, 183, 3, 0.15)',
                    border: '1px solid rgba(255, 183, 3, 0.4)',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    color: 'var(--primary)',
                }}
            >
                <Loader2 size={16} className="spin" />
                <span>Analyse IA en cours...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div 
                className="ai-status ai-status--error"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    color: 'var(--danger)',
                }}
                title={error}
            >
                <AlertCircle size={16} />
                <span>Analyse IA indisponible</span>
            </div>
        );
    }

    if (hasResult && isConfigured) {
        const confidencePercent = Math.round((confidence || 0.8) * 100);
        return (
            <div 
                className="ai-status ai-status--success"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'rgba(124, 252, 138, 0.15)',
                    border: '1px solid rgba(124, 252, 138, 0.4)',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    color: 'var(--success)',
                }}
                title={`Confiance de l'analyse: ${confidencePercent}%`}
            >
                <CheckCircle2 size={16} />
                <span>Analysé par IA ({confidencePercent}%)</span>
            </div>
        );
    }

    if (!isConfigured) {
        return (
            <div 
                className="ai-status ai-status--unconfigured"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'rgba(148, 163, 184, 0.15)',
                    border: '1px solid rgba(148, 163, 184, 0.4)',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                }}
                title="Configurez VITE_OPENAI_API_KEY dans .env pour activer l'IA"
            >
                <Sparkles size={16} />
                <span>Analyse IA non configurée</span>
            </div>
        );
    }

    return null;
};

export default AIStatusIndicator;
