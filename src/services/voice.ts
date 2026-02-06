// Service de reconnaissance vocale (Pilier 3: Dictaphone Magique)

export interface VoiceTranscription {
    text: string;
    confidence: number;
    timestamp: number;
    category?: string;
    lot?: string;
}

// Types pour Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

// Mots-clés pour catégorisation automatique
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'safety': ['securite', 'danger', 'risque', 'casque', 'harnais', 'protection', 'accident'],
    'peinture': ['peinture', 'enduit', 'laque', 'vernis', 'couche', 'teinte'],
    'electricite': ['elec', 'cable', 'prise', 'tableau', 'courant', 'circuit', 'fil'],
    'plomberie': ['plomberie', 'robinet', 'tuyau', 'evacuation', 'arrivee', 'eau'],
    'maconnerie': ['maconnerie', 'mur', 'parpaing', 'brique', 'beton', 'ciment'],
    'menuiserie': ['menuiserie', 'porte', 'fenetre', 'volet', 'placard', 'bois'],
    'urgent': ['urgent', 'immediat', 'critique', 'bloquant', 'empecher'],
    'anomalie': ['anomalie', 'defaut', 'non conforme', 'nc', 'erreur', 'probleme']
};

// Détecte la catégorie/lot à partir du texte
export const detectCategory = (text: string): { category?: string; lot?: string } => {
    const lowerText = text.toLowerCase();
    
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => lowerText.includes(kw))) {
            return { category: cat, lot: cat.toUpperCase() };
        }
    }
    
    return {};
};

// Classe pour gérer la reconnaissance vocale
export class VoiceRecorder {
    private recognition: SpeechRecognition | null = null;
    private isRecording = false;
    private onResultCallback: ((transcription: VoiceTranscription) => void) | null = null;
    private onErrorCallback: ((error: string) => void) | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                this.recognition = new SpeechRecognition();
                this.setupRecognition();
            }
        }
    }

    private setupRecognition() {
        if (!this.recognition) return;

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'fr-FR';
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
            const results = event.results;
            const lastResult = results[results.length - 1];
            
            if (lastResult.isFinal && this.onResultCallback) {
                const alternative = lastResult[0];
                const detected = detectCategory(alternative.transcript);
                
                this.onResultCallback({
                    text: alternative.transcript,
                    confidence: alternative.confidence,
                    timestamp: Date.now(),
                    ...detected
                });
            }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (this.onErrorCallback) {
                this.onErrorCallback(event.error);
            }
        };
    }

    isSupported(): boolean {
        return this.recognition !== null;
    }

    isRecordingState(): boolean {
        return this.isRecording;
    }

    start(
        onResult: (transcription: VoiceTranscription) => void,
        onError?: (error: string) => void
    ): boolean {
        if (!this.recognition) return false;
        
        this.onResultCallback = onResult;
        this.onErrorCallback = onError || null;
        
        try {
            this.recognition.start();
            this.isRecording = true;
            return true;
        } catch (err) {
            return false;
        }
    }

    stop(): void {
        if (!this.recognition) return;
        
        try {
            this.recognition.stop();
            this.isRecording = false;
        } catch (err) {
            // Ignore
        }
    }

    // Formate le texte transcrit pour un rapport structuré
    static formatForReport(transcriptions: VoiceTranscription[]): string {
        if (transcriptions.length === 0) return '';
        
        const grouped = transcriptions.reduce((acc, t) => {
            const key = t.lot || 'GENERAL';
            if (!acc[key]) acc[key] = [];
            acc[key].push(t.text);
            return acc;
        }, {} as Record<string, string[]>);

        return Object.entries(grouped)
            .map(([lot, texts]) => {
                if (lot === 'GENERAL') {
                    return texts.map(t => `• ${t}`).join('\n');
                }
                return `[LOT ${lot}]\n${texts.map(t => `  • ${t}`).join('\n')}`;
            })
            .join('\n\n');
    }
}

// Hook React-friendly
export const createVoiceRecorder = () => new VoiceRecorder();
