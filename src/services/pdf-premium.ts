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
    primary: [26, 54, 93],
    secondary: [201, 162, 99],
    accent: [220, 53, 69],
    success: [40, 167, 69],
    dark: [33, 37, 41],
    gray: [108, 117, 125],
    lightGray: [233, 236, 239],
    white: [255, 255, 255],
};

const setFillColor = (doc: jsPDF, color: number[]) => doc.setFillColor(color[0], color[1], color[2]);
const setDrawColor = (doc: jsPDF, color: number[]) => doc.setDrawColor(color[0], color[1], color[2]);
const setTextColor = (doc: jsPDF, color: number[]) => doc.setTextColor(color[0], color[1], color[2]);

const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | null => {
    if (dataUrl.startsWith('data:image/png')) return 'PNG';
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
    return null;
};

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
    const footerHeight = 10;
    const maxY = pageHeight - footerHeight - 5; // safe bottom limit

    let currentY = margin;
    let _pageNumber = 1;
    let sectionNumber = 1;

    // --- Helper: check if we need a new page ---
    const ensureSpace = (needed: number) => {
        if (currentY + needed > maxY) {
            drawFooter();
            doc.addPage();
            _pageNumber++;
            currentY = margin;
        }
    };

    // --- Helper: draw section title ---
    const drawSectionTitle = (title: string, underlineWidth = 65) => {
        ensureSpace(20);
        setTextColor(doc, palette.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(`${sectionNumber}. ${title}`, margin, currentY);
        setDrawColor(doc, palette.secondary);
        doc.setLineWidth(0.8);
        doc.line(margin, currentY + 2, margin + underlineWidth, currentY + 2);
        sectionNumber++;
        currentY += 10;
    };

    // --- Helper: draw footer on current page ---
    const drawFooter = () => {
        setFillColor(doc, palette.primary);
        doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
        setTextColor(doc, palette.white);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(
            `Document genere par ${data.productName || 'SiteFlow Pro'} - Confidentialite strictement reservee`,
            margin, pageHeight - 4
        );
        doc.text(data.reportId || '', pageWidth - margin, pageHeight - 4, { align: 'right' });
    };

    // ========================================================
    // HEADER (bandeau bleu marine)
    // ========================================================
    setFillColor(doc, palette.primary);
    doc.rect(0, 0, pageWidth, 32, 'F');

    setTextColor(doc, palette.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('SITEFLOW', margin, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Rapport de Controle et d\'Inspection', margin, 20);

    // Badge de certification (coin droit)
    const badgeX = pageWidth - margin - 50;
    setTextColor(doc, palette.secondary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('CERTIFIE', badgeX + 10, 13);

    setTextColor(doc, palette.white);
    doc.setFontSize(8);
    doc.text(`REF: ${data.reportId || 'N/A'}`, badgeX, 21);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, badgeX, 26);

    currentY = 42;

    // ========================================================
    // 1. IDENTIFICATION DU CHANTIER
    // ========================================================
    drawSectionTitle('IDENTIFICATION DU CHANTIER', 65);

    const infoRows = [
        ['CHANTIER', data.siteName || 'Non specifie'],
        ['CLIENT', data.clientName || 'Non specifie'],
        ['OPERATEUR', data.operatorName || data.companyName || 'Non specifie'],
        ['ADRESSE', data.address],
        ['COORDONNEES GPS', data.coordinates],
        ['PRECISION', data.accuracy ? `+/-${Math.round(data.accuracy)}m` : 'Non disponible'],
        ['DATE / HEURE', data.date],
    ];

    const rowHeight = 7;
    const tableHeight = infoRows.length * rowHeight + 4;
    ensureSpace(tableHeight);

    // Fond gris clair pour le tableau
    setFillColor(doc, palette.lightGray);
    doc.rect(margin, currentY - 2, contentWidth, tableHeight, 'F');
    setDrawColor(doc, palette.lightGray);
    doc.rect(margin, currentY - 2, contentWidth, tableHeight, 'S');

    doc.setFontSize(9);

    infoRows.forEach(([label, value], index) => {
        const y = currentY + 3 + index * rowHeight;

        // Label en gras
        setTextColor(doc, palette.gray);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin + 4, y);

        // Valeur
        setTextColor(doc, palette.dark);
        doc.setFont('helvetica', 'normal');
        const labelW = doc.getTextWidth(`${label}:`) + 3;

        // Tronquer si trop long
        const maxValueWidth = contentWidth - labelW - 10;
        const valueLines = doc.splitTextToSize(value, maxValueWidth);
        doc.text(valueLines[0] || '', margin + 4 + labelW, y);
    });

    currentY += tableHeight + 10;

    // ========================================================
    // 2. DOCUMENTATION PHOTOGRAPHIQUE
    // ========================================================
    if (data.imageDataUrl && data.imageDataUrl.length > 10) {
        drawSectionTitle('DOCUMENTATION PHOTOGRAPHIQUE', 75);

        const imgBoxHeight = 80;
        ensureSpace(imgBoxHeight + 15);

        // Bordure
        setDrawColor(doc, palette.primary);
        doc.setLineWidth(0.4);
        doc.rect(margin, currentY, contentWidth, imgBoxHeight, 'S');

        try {
            const format = getImageFormat(data.imageDataUrl);
            if (format) {
                const imgProps = doc.getImageProperties(data.imageDataUrl);
                const ratio = imgProps.width / imgProps.height;
                let drawWidth = contentWidth - 4;
                let drawHeight = drawWidth / ratio;

                if (drawHeight > imgBoxHeight - 4) {
                    drawHeight = imgBoxHeight - 4;
                    drawWidth = drawHeight * ratio;
                }

                const x = margin + 2 + (contentWidth - 4 - drawWidth) / 2;
                const y = currentY + 2 + (imgBoxHeight - 4 - drawHeight) / 2;

                doc.addImage(data.imageDataUrl, format, x, y, drawWidth, drawHeight);
            }
        } catch {
            setTextColor(doc, palette.gray);
            doc.setFontSize(10);
            doc.text('Image non disponible', margin + contentWidth / 2 - 20, currentY + imgBoxHeight / 2);
        }

        currentY += imgBoxHeight + 3;

        // Legende
        setTextColor(doc, palette.gray);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`Photo n.1 - Prise le ${data.date} - Localisation: ${data.coordinates}`, margin, currentY);

        currentY += 12;
    }

    // ========================================================
    // 3. OBSERVATIONS ET ANALYSE
    // ========================================================
    drawSectionTitle('OBSERVATIONS ET ANALYSE', 65);

    // Strip any certification text that was appended to description
    let cleanDescription = data.description;
    const certIdx = cleanDescription.indexOf('--- CERTIFICATION ---');
    if (certIdx > -1) {
        cleanDescription = cleanDescription.substring(0, certIdx).trim();
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(cleanDescription, contentWidth - 8);
    const lineHeight = 4.5;
    const descBoxHeight = Math.max(20, descLines.length * lineHeight + 8);

    ensureSpace(descBoxHeight + 5);

    // Box de fond
    setFillColor(doc, [250, 250, 250]);
    doc.rect(margin, currentY, contentWidth, descBoxHeight, 'F');
    setDrawColor(doc, palette.lightGray);
    doc.setLineWidth(0.3);
    doc.rect(margin, currentY, contentWidth, descBoxHeight, 'S');

    setTextColor(doc, palette.dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Render each line manually with proper spacing
    descLines.forEach((line: string, i: number) => {
        const lineY = currentY + 5 + i * lineHeight;
        if (lineY < currentY + descBoxHeight - 2) {
            doc.text(line, margin + 4, lineY);
        }
    });

    currentY += descBoxHeight + 10;

    // ========================================================
    // 4. TRAVAUX SUPPLEMENTAIRES (si applicable)
    // ========================================================
    if (data.extraWorks && data.extraWorks.length > 0) {
        drawSectionTitle('TRAVAUX SUPPLEMENTAIRES', 65);

        const headers = ['Description', 'Categorie', 'Urgence', 'Estimation'];
        const colWidths = [contentWidth * 0.45, contentWidth * 0.20, contentWidth * 0.15, contentWidth * 0.20];

        ensureSpace(20 + data.extraWorks.length * 8);

        // Header tableau
        setFillColor(doc, palette.primary);
        doc.rect(margin, currentY, contentWidth, 7, 'F');
        setTextColor(doc, palette.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);

        let xPos = margin;
        headers.forEach((header, i) => {
            doc.text(header, xPos + 2, currentY + 5);
            xPos += colWidths[i];
        });

        currentY += 7;

        let total = 0;
        data.extraWorks.forEach((ts, index) => {
            ensureSpace(10);

            const isEven = index % 2 === 0;
            setFillColor(doc, isEven ? palette.white : [245, 245, 245]);
            doc.rect(margin, currentY, contentWidth, 7, 'F');
            setDrawColor(doc, palette.lightGray);
            doc.rect(margin, currentY, contentWidth, 7, 'S');

            setTextColor(doc, palette.dark);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);

            xPos = margin;

            const desc = ts.description.length > 35
                ? ts.description.substring(0, 35) + '...'
                : ts.description;
            doc.text(desc, xPos + 2, currentY + 5);
            xPos += colWidths[0];

            doc.text(ts.category.toUpperCase(), xPos + 2, currentY + 5);
            xPos += colWidths[1];

            const urgencyColors: Record<string, number[]> = {
                high: palette.accent,
                medium: [255, 193, 7],
                low: palette.success
            };
            const urgencyLabels: Record<string, string> = { high: 'HAUTE', medium: 'MOYENNE', low: 'FAIBLE' };
            setTextColor(doc, urgencyColors[ts.urgency] || palette.dark);
            doc.text(urgencyLabels[ts.urgency] || ts.urgency, xPos + 2, currentY + 5);
            setTextColor(doc, palette.dark);
            xPos += colWidths[2];

            doc.text(`${ts.estimatedCost.toLocaleString('fr-FR')} EUR`, xPos + 2, currentY + 5);

            total += ts.estimatedCost;
            currentY += 7;
        });

        // Total row
        ensureSpace(12);
        setFillColor(doc, [240, 240, 240]);
        doc.rect(margin, currentY, contentWidth, 8, 'F');
        setDrawColor(doc, palette.primary);
        doc.setLineWidth(0.4);
        doc.rect(margin, currentY, contentWidth, 8, 'S');

        setTextColor(doc, palette.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('TOTAL TRAVAUX SUPPLEMENTAIRES:', margin + 3, currentY + 5.5);
        doc.text(`${total.toLocaleString('fr-FR')} EUR HT`, pageWidth - margin - 3, currentY + 5.5, { align: 'right' });

        currentY += 15;
    }

    // ========================================================
    // CERTIFICATION (si integrityHash existe)
    // ========================================================
    if (data.integrityHash) {
        drawSectionTitle('CERTIFICATION', 40);

        const certHeight = 22;
        ensureSpace(certHeight + 5);

        setFillColor(doc, [240, 248, 240]);
        doc.roundedRect(margin, currentY, contentWidth, certHeight, 2, 2, 'F');
        setDrawColor(doc, palette.success);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, currentY, contentWidth, certHeight, 2, 2, 'S');

        // Check icon (use text instead of special char for font compat)
        setFillColor(doc, palette.success);
        doc.circle(margin + 7, currentY + 8, 3.5, 'F');
        setTextColor(doc, palette.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('OK', margin + 4.8, currentY + 9.5);

        setTextColor(doc, palette.dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Ce document est certifie authentique et inaltere.', margin + 14, currentY + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setTextColor(doc, palette.gray);
        doc.text(`Empreinte SHA-256: ${data.integrityHash.substring(0, 48)}...`, margin + 14, currentY + 12);
        const sourceLabel = data.locationSource === 'gps' ? 'GPS Certifie' : 'Mode Demo';
        const precLabel = data.accuracy ? `+/-${Math.round(data.accuracy)}m` : 'N/A';
        doc.text(`Source: ${sourceLabel}  |  Precision: ${precLabel}`, margin + 14, currentY + 17);

        currentY += certHeight + 10;
    }

    // ========================================================
    // SIGNATURES
    // ========================================================
    const sigBlockHeight = 40;
    ensureSpace(sigBlockHeight);

    setTextColor(doc, palette.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('SIGNATURES', margin, currentY);
    currentY += 6;

    const sigBoxWidth = (contentWidth - 10) / 2;

    // --- Box Chef de chantier ---
    setDrawColor(doc, palette.gray);
    doc.setLineWidth(0.3);
    doc.rect(margin, currentY, sigBoxWidth, 25, 'S');

    setTextColor(doc, palette.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Chef de Chantier / Operateur', margin + 3, currentY + 5);

    if (data.operatorName) {
        setTextColor(doc, palette.dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(data.operatorName, margin + 3, currentY + 22);
    }

    // --- Box Client ---
    const clientBoxX = margin + sigBoxWidth + 10;
    doc.setLineWidth(0.3);
    setDrawColor(doc, palette.gray);
    doc.rect(clientBoxX, currentY, sigBoxWidth, 25, 'S');

    setTextColor(doc, palette.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Client / Maitre d\'Ouvrage', clientBoxX + 3, currentY + 5);

    if (data.clientSignature) {
        try {
            doc.addImage(data.clientSignature, 'PNG', clientBoxX + 5, currentY + 7, 30, 15);
        } catch {
            setTextColor(doc, palette.success);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('Signe electroniquement', clientBoxX + 5, currentY + 17);
        }
    } else if (data.clientName) {
        setTextColor(doc, palette.dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(data.clientName, clientBoxX + 3, currentY + 22);
    }

    // ========================================================
    // FOOTER (on all pages)
    // ========================================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter();
    }

    // Sauvegarde
    const filename = `Rapport_${data.siteName?.replace(/\s+/g, '_') || 'Chantier'}_${data.reportId?.replace(/-/g, '_') || Date.now()}.pdf`;
    doc.save(filename);
};
