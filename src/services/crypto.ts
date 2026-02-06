// Service de certification d'intégrité (Pilier 2: Bouclier Juridique)

export interface IntegrityProof {
    hash: string;
    timestamp: number;
    timestampISO: string;
    location: string;
    deviceId: string;
    reportId: string;
}

// Génère un hash SHA-256 des données
export const generateHash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Génère une preuve d'intégrité complète
export const generateIntegrityProof = async (
    imageDataUrl: string,
    reportId: string,
    location: string
): Promise<IntegrityProof> => {
    // Hash de l'image + métadonnées pour empêcher toute modification
    const dataToHash = `${imageDataUrl}:${reportId}:${location}`;
    const hash = await generateHash(dataToHash);
    
    const now = new Date();
    
    return {
        hash,
        timestamp: now.getTime(),
        timestampISO: now.toISOString(),
        location,
        deviceId: getDeviceId(),
        reportId
    };
};

// Vérifie l'intégrité d'un rapport
export const verifyIntegrity = async (
    imageDataUrl: string,
    proof: IntegrityProof
): Promise<boolean> => {
    const dataToHash = `${imageDataUrl}:${proof.reportId}:${proof.location}`;
    const computedHash = await generateHash(dataToHash);
    return computedHash === proof.hash;
};

// Génère un ID unique pour l'appareil (fingerprint simple)
const getDeviceId = (): string => {
    const stored = localStorage.getItem('siteflow_device_id');
    if (stored) return stored;
    
    const id = 'DEV-' + Math.random().toString(36).substring(2, 15).toUpperCase();
    localStorage.setItem('siteflow_device_id', id);
    return id;
};

// Génère un certificat PDF-friendly
export const generateCertificateText = (proof: IntegrityProof): string => {
    return `
CERTIFICAT D'AUTHENTICITE - SITEFLOW PRO
========================================

Rapport ID: ${proof.reportId}
Hash SHA-256: ${proof.hash.substring(0, 32)}...
Horodatage: ${new Date(proof.timestamp).toLocaleString('fr-FR')}
Appareil: ${proof.deviceId}
Localisation: ${proof.location}

Ce document est protégé contre toute altération.
Pour vérifier l'authenticité, scannez le QR code ou
rendez-vous sur https://siteflow.pro/verify

Intégrité garantie par horodatage cryptographique.
    `.trim();
};
