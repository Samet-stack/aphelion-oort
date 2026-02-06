// Service de partage et liens uniques (Pilier 4: Coordination Ultra-Rapide)

export interface SharedReport {
    id: string;
    reportId: string;
    sharedAt: string;
    expiresAt: string;
    viewCount: number;
    lastViewedAt?: string;
    recipient?: string;
}

// Génère un ID unique pour le lien de partage
export const generateShareId = (): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SF-${timestamp}-${random}`;
};

// Crée un lien de partage temporaire (7 jours par défaut)
export const createShareLink = (shareId: string, baseUrl: string = window.location.origin): string => {
    return `${baseUrl}/view/${shareId}`;
};

// Partage natif (Web Share API)
export const shareNative = async (data: {
    title: string;
    text: string;
    url: string;
    files?: File[];
}): Promise<boolean> => {
    if (!navigator.share) return false;
    
    try {
        await navigator.share(data);
        return true;
    } catch (err) {
        // User cancelled or error
        return false;
    }
};

// Ouvre WhatsApp avec le message pré-rempli
export const shareViaWhatsApp = (phone: string, message: string): void => {
    const encodedMessage = encodeURIComponent(message);
    // Format international sans le +
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(url, '_blank');
};

// Génère le message de partage
export const generateShareMessage = (reportId: string, link: string, siteName?: string): string => {
    const site = siteName ? `*${siteName}*` : 'le chantier';
    return `📝 *Rapport de chantier*\n\nBonjour,\nVoici le rapport pour ${site}.\n\nID: ${reportId}\n\n📎 Consulter le rapport:\n${link}\n\nCe lien est valable 7 jours.`;
};

// Génère un QR Code en data URL (utilise une API externe simple)
export const generateQRCode = (url: string, size: number = 200): string => {
    // Utilise l'API de QRCode Monkey (gratuite) ou qrserver
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
};

// Vérifie si un lien est encore valide
export const isLinkValid = (sharedReport: SharedReport): boolean => {
    return new Date(sharedReport.expiresAt) > new Date();
};

// Email pré-rempli
export const shareViaEmail = (to: string, subject: string, body: string): void => {
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
};

// SMS (fonctionne sur mobile)
export const shareViaSMS = (phone: string, message: string): void => {
    const sms = `sms:${phone}?body=${encodeURIComponent(message)}`;
    window.location.href = sms;
};

// Génère un PDF léger pour prévisualisation (sans images haute rés)
export const generatePreviewPDF = async (
    reportData: Record<string, string>,
    _imageDataUrl?: string
): Promise<Blob> => {
    // Version simplifiée - retourne un JSON formaté pour l'instant
    // Dans la vraie implémentation, utiliser jsPDF comme dans pdf.ts
    // _imageDataUrl: réservé pour future utilisation dans le PDF
    const content = `
RAPPORT DE CHANTIER - APERCU
============================

ID: ${reportData.reportId || 'N/A'}
Date: ${reportData.date || new Date().toLocaleString('fr-FR')}
Chantier: ${reportData.siteName || 'Non spécifié'}

LOCALISATION
${reportData.address || 'N/A'}
${reportData.coordinates || ''}

OBSERVATIONS
${reportData.description || 'Aucune observation'}

---
Document généré par SiteFlow Pro
Ce lien expirera dans 7 jours.
    `.trim();
    
    return new Blob([content], { type: 'text/plain' });
};

// Tracking des vues (stocké en local pour l'instant)
export const trackView = (shareId: string): void => {
    const key = `siteflow_share_${shareId}`;
    const data = localStorage.getItem(key);
    
    if (data) {
        const shared: SharedReport = JSON.parse(data);
        shared.viewCount++;
        shared.lastViewedAt = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify(shared));
    }
};

// Récupère les stats de partage d'un rapport
export const getShareStats = (shareId: string): SharedReport | null => {
    const key = `siteflow_share_${shareId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};
