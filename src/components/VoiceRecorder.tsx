import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Check, AlertCircle, Volume2 } from 'lucide-react';
import { VoiceRecorder as VoiceService, VoiceTranscription, createVoiceRecorder } from '../services/voice';

interface VoiceRecorderProps {
    onTranscription: (text: string) => void;
    existingText?: string;
}

export const VoiceRecorderComponent: React.FC<VoiceRecorderProps> = ({ onTranscription, existingText = '' }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcriptions, setTranscriptions] = useState<VoiceTranscription[]>([]);
    const [currentText, setCurrentText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [supported, setSupported] = useState(true);
    
    const recorderRef = useRef<VoiceService | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        recorderRef.current = createVoiceRecorder();
        setSupported(recorderRef.current?.isSupported() ?? false);
        
        return () => {
            recorderRef.current?.stop();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const startRecording = () => {
        if (!recorderRef.current) return;
        
        setError(null);
        setCurrentText('');
        
        const success = recorderRef.current.start(
            (transcription) => {
                setTranscriptions(prev => [...prev, transcription]);
                setCurrentText('');
            },
            (err) => {
                setError('Erreur de reconnaissance: ' + err);
                setIsRecording(false);
            }
        );
        
        if (success) {
            setIsRecording(true);
            // Simuler un texte temporaire pour montrer l'activité
            intervalRef.current = setInterval(() => {
                setCurrentText(prev => prev + '.');
            }, 500);
        } else {
            setError('Impossible de démarrer l\'enregistrement');
        }
    };

    const stopRecording = () => {
        recorderRef.current?.stop();
        setIsRecording(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setCurrentText('');
    };

    const clearTranscriptions = () => {
        setTranscriptions([]);
    };

    const applyTranscriptions = () => {
        const formatted = VoiceService.formatForReport(transcriptions);
        const newText = existingText 
            ? existingText + '\n\n[Dictaphone]\n' + formatted
            : formatted;
        onTranscription(newText);
        setTranscriptions([]);
    };

    const getCategoryIcon = (cat?: string) => {
        switch (cat) {
            case 'safety': return '🛡️';
            case 'peinture': return '🎨';
            case 'electricite': return '⚡';
            case 'plomberie': return '🔧';
            case 'maconnerie': return '🧱';
            case 'menuiserie': return '🚪';
            case 'urgent': return '🔴';
            case 'anomalie': return '⚠️';
            default: return '📝';
        }
    };

    if (!supported) {
        return (
            <div className="voice-recorder voice-recorder--unsupported">
                <AlertCircle size={20} />
                <span>Votre navigateur ne supporte pas la reconnaissance vocale.</span>
                <small>Essayez Chrome ou Safari.</small>
            </div>
        );
    }

    return (
        <div className="voice-recorder">
            {error && (
                <div className="voice-error">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="voice-controls">
                {!isRecording ? (
                    <button 
                        className="voice-btn voice-btn--record"
                        onClick={startRecording}
                        title="Démarrer l'enregistrement"
                    >
                        <Mic size={24} />
                        <span>Parler pour dicter</span>
                    </button>
                ) : (
                    <button 
                        className="voice-btn voice-btn--stop"
                        onClick={stopRecording}
                        title="Arrêter"
                    >
                        <Square size={24} fill="currentColor" />
                        <span>Arrêter ({currentText})</span>
                    </button>
                )}

                {transcriptions.length > 0 && !isRecording && (
                    <>
                        <button 
                            className="voice-btn voice-btn--apply"
                            onClick={applyTranscriptions}
                        >
                            <Check size={20} />
                            <span>Insérer ({transcriptions.length})</span>
                        </button>
                        <button 
                            className="voice-btn voice-btn--clear"
                            onClick={clearTranscriptions}
                        >
                            <Trash2 size={20} />
                        </button>
                    </>
                )}
            </div>

            {isRecording && (
                <div className="voice-recording-indicator">
                    <span className="voice-pulse" />
                    <span>Enregistrement en cours...</span>
                    <small>Parlez clairement, l'IA catégorise automatiquement</small>
                </div>
            )}

            {transcriptions.length > 0 && (
                <div className="voice-transcriptions">
                    <h4>Transcriptions ({transcriptions.length})</h4>
                    <div className="voice-list">
                        {transcriptions.map((t, i) => (
                            <div key={i} className={`voice-item voice-item--${t.category || 'general'}`}>
                                <span className="voice-icon">{getCategoryIcon(t.category)}</span>
                                <div className="voice-content">
                                    <p>{t.text}</p>
                                    {t.lot && <span className="voice-lot">LOT: {t.lot}</span>}
                                </div>
                                <span className="voice-confidence">
                                    {Math.round(t.confidence * 100)}%
                                </span>
                            </div>
                        ))}
                    </div>
                    
                    <div className="voice-preview">
                        <label>Aperçu:</label>
                        <pre>{VoiceService.formatForReport(transcriptions)}</pre>
                    </div>
                </div>
            )}

            <div className="voice-hints">
                <small>
                    <Volume2 size={12} /> 
                    Essayez: "Peinture écaillée dans le couloir sud" ou 
                    "Anomalie électrique lot 5 à vérifier avant mardi"
                </small>
            </div>
        </div>
    );
};
