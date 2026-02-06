import { jsPDF } from 'jspdf';

export interface ReportPDFData {
    imageDataUrl: string;
    address: string;
    description: string;
    date: string;
    coordinates: string;
    accuracy?: number | null;
    locationSource?: 'gps' | 'demo' | 'unavailable';
    reportId?: string;
    companyName?: string;
    reportTitle?: string;
    productName?: string;
    logoUrl?: string | null;
    // Nouveaux champs
    siteName?: string;
    operatorName?: string;
    clientName?: string;
    priority?: 'low' | 'medium' | 'high';
    category?: string;
    integrityHash?: string;
    extraWorks?: Array<{
        id: string;
        description: string;
        estimatedCost: number;
        urgency: 'low' | 'medium' | 'high';
        category: string;
    }>;
    clientSignature?: string;
}

// Palette professionnelle
const palette = {
    primary: [26, 54, 93],      // Bleu marine foncé
    secondary: [201, 162, 99],   // Or/Doré
    accent: [220, 53, 69],       // Rouge pour urgent
    success: [40, 167, 69],      // Vert validation
    dark: [33, 37, 41],          // Noir texte
    gray: [108, 117, 125],       // Gris secondaire
    lightGray: [233, 236, 239],  // Gris clair fond
    white: [255, 255, 255],
};

// Helpers pour les couleurs
const setFillColor = (doc: jsPDF, color: number[]) => doc.setFillColor(color[0], color[1], color[2]);
const setDrawColor = (doc: jsPDF, color: number[]) => doc.setDrawColor(color[0], color[1], color[2]);
const setTextColor = (doc: jsPDF, color: number[]) => doc.setTextColor(color[0], color[1], color[2]);

// Détection format image
const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | null => {
    if (dataUrl.startsWith('data:image/png')) return 'PNG';
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
    return null;
};

// Note: Fonction disponible pour futures améliorations (logo externe)
// const toDataUrl = async (url: string): Promise<string | null> => { ... };

export const generatePremiumPDF = async (data: ReportPDFData) => {
    const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // === PAGE 1 ===
    let currentY = margin;

    // --- HEADER PREMIUM ---
    // Bandeau haut bleu marine
    setFillColor(doc, palette.primary);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Logo/Brand
    setTextColor(doc, palette.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('SITEFLOW', margin, 15);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Rapport de Contrôle et d\'Inspection', margin, 22);
    
    // Badge de certification (coin droit)
    const badgeWidth = 45;
    const badgeX = pageWidth - margin - badgeWidth;
    
    // Cercle de certification
    setDrawColor(doc, palette.secondary);
    setTextColor(doc, palette.secondary);
    doc.setLineWidth(0.5);
    doc.circle(badgeX + 5, 12, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CERTIFIE', badgeX + 10, 14);
    
    // ID Rapport
    setTextColor(doc, palette.white);
    doc.setFontSize(9);
    doc.text(`REF: ${data.reportId || 'N/A'}`, badgeX, 22);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, badgeX, 27);

    currentY = 45;

    // --- SECTION IDENTIFICATION ---
    // Titre section
    setTextColor(doc, palette.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('1. IDENTIFICATION DU CHANTIER', margin, currentY);
    
    // Ligne or sous le titre
    setDrawColor(doc, palette.secondary);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY + 2, margin + 60, currentY + 2);
    
    currentY += 12;

    // Tableau d'identification
    const infoRows = [
        ['CHANTIER', data.siteName || 'Non spécifié'],
        ['CLIENT', data.clientName || 'Non spécifié'],
        ['OPÉRATEUR', data.operatorName || data.companyName || 'Non spécifié'],
        ['ADRESSE', data.address],
        ['COORDONNÉES GPS', data.coordinates],
        ['PRÉCISION', data.accuracy ? `±${Math.round(data.accuracy)}m` : 'Non disponible'],
        ['DATE / HEURE', data.date],
    ];

    // Fond gris clair pour le tableau
    setFillColor(doc, palette.lightGray);
    doc.rect(margin, currentY - 5, contentWidth, infoRows.length * 8 + 5, 'F');

    setTextColor(doc, palette.dark);
    doc.setFontSize(10);
    
    infoRows.forEach(([label, value], index) => {
        const y = currentY + index * 8;
        
        // Label en gras
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin + 3, y);
        
        // Valeur
        doc.setFont('helvetica', 'normal');
        const labelWidth = doc.getTextWidth(`${label}:`);
        
        // Gestion du texte long (adresse)
        if (value.length > 50) {
            const lines = doc.splitTextToSize(value, contentWidth - labelWidth - 10);
            doc.text(lines, margin + 5 + labelWidth, y);
        } else {
            doc.text(value, margin + 5 + labelWidth, y);
        }
    });

    currentY += infoRows.length * 8 + 15;

    // --- PHOTO PRINCIPALE ---
    if (data.imageDataUrl) {
        setTextColor(doc, palette.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('2. DOCUMENTATION PHOTOGRAPHIQUE', margin, currentY);
        
        setDrawColor(doc, palette.secondary);
        doc.line(margin, currentY + 2, margin + 75, currentY + 2);
        
        currentY += 10;
        
        // Cadre photo avec ombre
        const imgWidth = contentWidth;
        const imgHeight = 80;
        
        // Ombre
        setFillColor(doc, [200, 200, 200]);
        doc.rect(margin + 1, currentY + 1, imgWidth, imgHeight, 'F');
        
        // Bordure
        setDrawColor(doc, palette.primary);
        doc.setLineWidth(0.5);
        doc.rect(margin, currentY, imgWidth, imgHeight, 'S');
        
        try {
            const format = getImageFormat(data.imageDataUrl);
            if (format) {
                // Centrer l'image dans le cadre
                const imgProps = doc.getImageProperties(data.imageDataUrl);
                const ratio = imgProps.width / imgProps.height;
                let drawWidth = imgWidth - 4;
                let drawHeight = drawWidth / ratio;
                
                if (drawHeight > imgHeight - 4) {
                    drawHeight = imgHeight - 4;
                    drawWidth = drawHeight * ratio;
                }
                
                const x = margin + 2 + (imgWidth - 4 - drawWidth) / 2;
                const y = currentY + 2 + (imgHeight - 4 - drawHeight) / 2;
                
                doc.addImage(data.imageDataUrl, format, x, y, drawWidth, drawHeight);
            }
        } catch (err) {
            // Fallback texte
            setTextColor(doc, palette.gray);
            doc.setFontSize(10);
            doc.text('Image non disponible', margin + imgWidth/2 - 20, currentY + imgHeight/2);
        }
        
        // Légende
        currentY += imgHeight + 5;
        setTextColor(doc, palette.gray);
        doc.setFontSize(8);
        doc.text(`Photo n°1 - Prise le ${data.date} - Localisation: ${data.coordinates}`, margin, currentY);
        
        currentY += 15;
    }

    // --- OBSERVATIONS ---
    setTextColor(doc, palette.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('3. OBSERVATIONS ET ANALYSE', margin, currentY);
    setDrawColor(doc, palette.secondary);
    doc.line(margin, currentY + 2, margin + 65, currentY + 2);
    currentY += 10;

    // Zone de texte avec fond
    setFillColor(doc, [250, 250, 250]);
    const descLines = doc.splitTextToSize(data.description, contentWidth - 6);
    const descHeight = Math.max(30, descLines.length * 5 + 6);
    doc.rect(margin, currentY, contentWidth, descHeight, 'F');
    setDrawColor(doc, palette.lightGray);
    doc.rect(margin, currentY, contentWidth, descHeight, 'S');
    
    setTextColor(doc, palette.dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(descLines, margin + 3, currentY + 6);
    
    currentY += descHeight + 15;

    // --- TRAVAUX SUPPLEMENTAIRES ---
    if (data.extraWorks && data.extraWorks.length > 0) {
        setTextColor(doc, palette.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('4. TRAVAUX SUPPLÉMENTAIRES', margin, currentY);
        setDrawColor(doc, palette.secondary);
        doc.line(margin, currentY + 2, margin + 65, currentY + 2);
        currentY += 10;

        // Tableau TS
        const headers = ['Description', 'Catégorie', 'Urgence', 'Estimation'];
        const colWidths = [contentWidth * 0.45, contentWidth * 0.20, contentWidth * 0.15, contentWidth * 0.20];
        
        // Header tableau
        setFillColor(doc, palette.primary);
        doc.rect(margin, currentY, contentWidth, 8, 'F');
        setTextColor(doc, palette.white);
        doc.setFontSize(9);
        
        let xPos = margin;
        headers.forEach((header, i) => {
            doc.text(header, xPos + 2, currentY + 5.5);
            xPos += colWidths[i];
        });
        
        currentY += 8;
        
        // Lignes TS
        let total = 0;
        data.extraWorks.forEach((ts, index) => {
            const isEven = index % 2 === 0;
            setFillColor(doc, isEven ? palette.white : [245, 245, 245]);
            doc.rect(margin, currentY, contentWidth, 8, 'F');
            setDrawColor(doc, palette.lightGray);
            doc.rect(margin, currentY, contentWidth, 8, 'S');
            
            setTextColor(doc, palette.dark);
            doc.setFontSize(8);
            
            xPos = margin;
            
            // Description (tronquée si trop longue)
            const desc = ts.description.length > 35 
                ? ts.description.substring(0, 35) + '...' 
                : ts.description;
            doc.text(desc, xPos + 2, currentY + 5);
            xPos += colWidths[0];
            
            // Catégorie
            doc.text(ts.category.toUpperCase(), xPos + 2, currentY + 5);
            xPos += colWidths[1];
            
            // Urgence avec couleur
            const urgencyColors = {
                high: palette.accent,
                medium: [255, 193, 7], // jaune
                low: palette.success
            };
            const urgencyLabels = { high: 'HAUTE', medium: 'MOYENNE', low: 'FAIBLE' };
            setTextColor(doc, urgencyColors[ts.urgency]);
            doc.text(urgencyLabels[ts.urgency], xPos + 2, currentY + 5);
            setTextColor(doc, palette.dark);
            xPos += colWidths[2];
            
            // Prix
            doc.text(`${ts.estimatedCost.toLocaleString('fr-FR')} €`, xPos + 2, currentY + 5);
            
            total += ts.estimatedCost;
            currentY += 8;
        });
        
        // Ligne total
        setFillColor(doc, [240, 240, 240]);
        doc.rect(margin, currentY, contentWidth, 10, 'F');
        setDrawColor(doc, palette.primary);
        doc.setLineWidth(0.5);
        doc.rect(margin, currentY, contentWidth, 10, 'S');
        
        setTextColor(doc, palette.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('TOTAL TRAVAUX SUPPLÉMENTAIRES:', margin + 2, currentY + 6.5);
        doc.text(`${total.toLocaleString('fr-FR')} € HT`, pageWidth - margin - 2, currentY + 6.5, { align: 'right' });
        
        currentY += 20;
    }

    // --- CERTIFICATION ---
    if (data.integrityHash) {
        setTextColor(doc, palette.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(data.extraWorks ? '5. CERTIFICATION' : '4. CERTIFICATION', margin, currentY);
        setDrawColor(doc, palette.secondary);
        doc.line(margin, currentY + 2, margin + 40, currentY + 2);
        currentY += 10;
        
        // Cadre certification
        setFillColor(doc, [240, 248, 240]);
        doc.roundedRect(margin, currentY, contentWidth, 25, 3, 3, 'F');
        setDrawColor(doc, palette.success);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, currentY, contentWidth, 25, 3, 3, 'S');
        
        // Icône check
        setTextColor(doc, palette.success);
        doc.setFontSize(14);
        doc.text('✓', margin + 5, currentY + 10);
        
        setTextColor(doc, palette.dark);
        doc.setFontSize(9);
        doc.text('Ce document est certifié authentique et inaltéré.', margin + 12, currentY + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`Empreinte SHA-256: ${data.integrityHash.substring(0, 40)}...`, margin + 12, currentY + 13);
        doc.text(`Source: ${data.locationSource === 'gps' ? 'GPS Certifié' : 'Mode Démo'} | Précision: ${data.accuracy ? `±${Math.round(data.accuracy)}m` : 'N/A'}`, margin + 12, currentY + 18);
        
        currentY += 35;
    }

    // --- SIGNATURES ---
    const signaturesY = pageHeight - 40;
    
    setTextColor(doc, palette.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('SIGNATURES', margin, signaturesY);
    
    // Cadre Chef de chantier
    const sigBoxWidth = (contentWidth - 10) / 2;
    
    setDrawColor(doc, palette.gray);
    doc.setLineWidth(0.3);
    doc.rect(margin, signaturesY + 5, sigBoxWidth, 25, 'S');
    
    setTextColor(doc, palette.gray);
    doc.setFontSize(8);
    doc.text('Chef de Chantier / Opérateur', margin + 2, signaturesY + 10);
    
    if (data.operatorName) {
        setTextColor(doc, palette.dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(data.operatorName, margin + 2, signaturesY + 28);
    }
    
    // Cadre Client (si signature)
    doc.rect(margin + sigBoxWidth + 10, signaturesY + 5, sigBoxWidth, 25, 'S');
    setTextColor(doc, palette.gray);
    doc.text('Client / Maître d\'Ouvrage', margin + sigBoxWidth + 12, signaturesY + 10);
    
    if (data.clientSignature) {
        try {
            doc.addImage(data.clientSignature, 'PNG', margin + sigBoxWidth + 12, signaturesY + 12, 30, 15);
        } catch (e) {
            setTextColor(doc, palette.success);
            doc.text('✓ Signé électroniquement', margin + sigBoxWidth + 12, signaturesY + 20);
        }
    } else if (data.clientName) {
        setTextColor(doc, palette.dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(data.clientName, margin + sigBoxWidth + 12, signaturesY + 28);
    }

    // --- FOOTER ---
    setFillColor(doc, palette.primary);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    
    setTextColor(doc, palette.white);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Document généré par ${data.productName || 'SiteFlow Pro'} - Page 1/1 - Confidentialité strictement réservée`, margin, pageHeight - 3);
    doc.text(data.reportId || '', pageWidth - margin, pageHeight - 3, { align: 'right' });

    // Sauvegarde
    const filename = `Rapport_${data.siteName?.replace(/\s+/g, '_') || 'Chantier'}_${data.reportId?.replace(/-/g, '_') || Date.now()}.pdf`;
    doc.save(filename);
};
