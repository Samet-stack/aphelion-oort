import React from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, Info, Shield, Clock, Tag } from 'lucide-react';
import type { AIAnalysisResult } from '../services/gemini';

interface AIAnalysisCardProps {
    result: AIAnalysisResult | null;
    isLoading: boolean;
}

const categoryLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    safety: { 
        label: 'Sécurité', 
        icon: <Shield size={14} />, 
        color: 'var(--danger)' 
    },
    progress: { 
        label: 'Avancement', 
        icon: <Clock size={14} />, 
        color: 'var(--info)' 
    },
    anomaly: { 
        label: 'Anomalie', 
        icon: <AlertTriangle size={14} />, 
        color: 'var(--warning)' 
    },
    other: { 
        label: 'Observation', 
        icon: <Info size={14} />, 
        color: 'var(--text-muted)' 
    },
};

const priorityLabels: Record<string, { label: string; color: string; bgColor: string }> = {
    high: { 
        label: 'Priorité haute', 
        color: 'var(--danger)',
        bgColor: 'rgba(239, 68, 68, 0.15)'
    },
    medium: { 
        label: 'Priorité moyenne', 
        color: 'var(--warning)',
        bgColor: 'rgba(255, 209, 102, 0.15)'
    },
    low: { 
        label: 'Priorité basse', 
        color: 'var(--success)',
        bgColor: 'rgba(124, 252, 138, 0.15)'
    },
};

const severityIcons: Record<string, React.ReactNode> = {
    high: <AlertTriangle size={12} style={{ color: 'var(--danger)' }} />,
    medium: <Info size={12} style={{ color: 'var(--warning)' }} />,
    low: <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />,
};

export const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({ result, isLoading }) => {
    if (isLoading) {
        return (
            <div className="detail-card detail-card--wide ai-analysis-card" style={{
                background: 'rgba(255, 183, 3, 0.05)',
                borderColor: 'rgba(255, 183, 3, 0.2)',
            }}>
                <div className="ai-analysis-loading" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px',
                }}>
                    <div className="ai-pulse" style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(255, 183, 3, 0.2)',
                        display: 'grid',
                        placeItems: 'center',
                        animation: 'pulse 2s infinite',
                    }}>
                        <Sparkles size={24} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                        <p style={{ 
                            fontWeight: 600, 
                            marginBottom: '4px',
                            color: 'var(--text-main)',
                        }}>
                            L'IA analyse votre photo...
                        </p>
                        <p style={{ 
                            fontSize: '0.85rem', 
                            color: 'var(--text-muted)',
                            margin: 0,
                        }}>
                            Détection des éléments de chantier, matériaux et équipements de sécurité
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!result) return null;

    const category = categoryLabels[result.category] || categoryLabels.other;
    const priority = priorityLabels[result.priority] || priorityLabels.medium;

    return (
        <div className="detail-card detail-card--wide ai-analysis-card" style={{
            background: 'rgba(255, 183, 3, 0.05)',
            borderColor: 'rgba(255, 183, 3, 0.2)',
        }}>
            {/* Header */}
            <div className="ai-analysis-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px',
            }}>
                <div className="detail-label" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                    Analyse IA du chantier
                </div>
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}>
                    {/* Badge Catégorie */}
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: `${category.color}20`,
                        color: category.color,
                        border: `1px solid ${category.color}40`,
                    }}>
                        {category.icon}
                        {category.label}
                    </span>
                    
                    {/* Badge Priorité */}
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: priority.bgColor,
                        color: priority.color,
                        border: `1px solid ${priority.color}40`,
                    }}>
                        {priority.label}
                    </span>
                </div>
            </div>

            {/* Tags */}
            {result.tags.length > 0 && (
                <div className="ai-analysis-tags" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '16px',
                }}>
                    {result.tags.map((tag: string, index: number) => (
                        <span 
                            key={index}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                background: 'rgba(15, 23, 42, 0.6)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--stroke)',
                            }}
                        >
                            <Tag size={10} />
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Issues détectées */}
            {result.issues.length > 0 && (
                <div className="ai-analysis-issues">
                    <p style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                        marginBottom: '10px',
                    }}>
                        Points d'attention détectés
                    </p>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}>
                        {result.issues.map((issue: { type: string; description: string; severity: string }, index: number) => (
                            <div 
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '10px 12px',
                                    background: 'rgba(15, 23, 42, 0.4)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--stroke)',
                                }}
                            >
                                {severityIcons[issue.severity]}
                                <div style={{ flex: 1 }}>
                                    <p style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        marginBottom: '2px',
                                        color: 'var(--text-main)',
                                    }}>
                                        {issue.type}
                                    </p>
                                    <p style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-muted)',
                                        margin: 0,
                                    }}>
                                        {issue.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Confiance */}
            <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--stroke)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                }}>
                    Confiance de l'analyse
                </span>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <div style={{
                        width: '60px',
                        height: '4px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${result.confidence * 100}%`,
                            height: '100%',
                            background: result.confidence > 0.8 
                                ? 'var(--success)' 
                                : result.confidence > 0.6 
                                    ? 'var(--warning)' 
                                    : 'var(--danger)',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: result.confidence > 0.8 
                            ? 'var(--success)' 
                            : result.confidence > 0.6 
                                ? 'var(--warning)' 
                                : 'var(--danger)',
                    }}>
                        {Math.round(result.confidence * 100)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AIAnalysisCard;
