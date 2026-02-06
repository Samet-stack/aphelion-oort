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
    isBillable?: boolean;
    estimatedCost?: string;
}

const palette: Record<string, [number, number, number]> = {
    charcoal: [11, 14, 17],
    slate: [30, 41, 59],
    gold: [255, 183, 3],
    ink: [25, 25, 25],
    muted: [120, 120, 120],
    line: [220, 223, 228],
    surface: [248, 248, 250],
    billable: [180, 83, 9], // Dark orange/red for Billable Extras
};

type ImageSource = {
    dataUrl: string;
    format: 'PNG' | 'JPEG';
};

const getImageFormat = (dataUrl: string): ImageSource['format'] | null => {
    if (dataUrl.startsWith('data:image/png')) {
        return 'PNG';
    }
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
        return 'JPEG';
    }
    return null;
};

const toDataUrl = async (url: string) => {
    if (typeof fetch === 'undefined') {
        return null;
    }
    const response = await fetch(url);
    if (!response.ok) {
        return null;
    }
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Image load failed'));
        reader.readAsDataURL(blob);
    });
};

const resolveImageSource = async (value?: string | null): Promise<ImageSource | null> => {
    if (!value) {
        return null;
    }
    if (value.startsWith('data:image/')) {
        const format = getImageFormat(value);
        return format ? { dataUrl: value, format } : null;
    }
    try {
        const dataUrl = await toDataUrl(value);
        if (!dataUrl) {
            return null;
        }
        const format = getImageFormat(dataUrl);
        return format ? { dataUrl, format } : null;
    } catch (err) {
        return null;
    }
};

const cardStyle = {
    minHeight: 58,
    paddingX: 12,
    labelY: 18,
    bottomPadding: 14,
};

const cardFontSizes = [10, 9, 8];

const getCardMetrics = (fontSize: number) => {
    const lineHeight = Math.round(fontSize * 1.2);
    const valueY = 34 + (fontSize - 8);
    return { lineHeight, valueY };
};

const measureInfoCard = (doc: jsPDF, value: string, width: number, maxHeight: number) => {
    for (const fontSize of cardFontSizes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        const { lineHeight, valueY } = getCardMetrics(fontSize);
        const lines = doc.splitTextToSize(value, width - cardStyle.paddingX * 2);
        const contentHeight =
            valueY + Math.max(0, lines.length - 1) * lineHeight + cardStyle.bottomPadding;
        const height = Math.max(cardStyle.minHeight, contentHeight);
        if (height <= maxHeight) {
            return { lines, height, fontSize, lineHeight, valueY };
        }
    }

    const fontSize = cardFontSizes[cardFontSizes.length - 1];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const { lineHeight, valueY } = getCardMetrics(fontSize);
    const lines = doc.splitTextToSize(value, width - cardStyle.paddingX * 2);
    const contentHeight =
        valueY + Math.max(0, lines.length - 1) * lineHeight + cardStyle.bottomPadding;
    const height = Math.max(cardStyle.minHeight, contentHeight);
    return { lines, height, fontSize, lineHeight, valueY };
};

const drawInfoCard = (
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    lines: string[],
    fontSize: number,
    valueY: number
) => {
    doc.setFillColor(...palette.surface);
    doc.setDrawColor(...palette.line);
    doc.roundedRect(x, y, width, height, 10, 10, 'FD');

    doc.setTextColor(...palette.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + cardStyle.paddingX, y + cardStyle.labelY);

    doc.setTextColor(...palette.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.text(lines, x + cardStyle.paddingX, y + valueY);
};

const formatAccuracy = (value?: number | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
        return 'non disponible';
    }
    return `± ${Math.round(value)} m`;
};

const formatLocationSource = (source?: ReportPDFData['locationSource']) => {
    if (source === 'gps') {
        return 'GPS OK';
    }
    if (source === 'demo') {
        return 'Mode demo';
    }
    return 'GPS indisponible';
};

export const generatePDF = async (data: ReportPDFData) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 46;
    const headerHeight = 96;

    const reportTitle = data.reportTitle ?? 'Rapport de chantier';
    const companyName = data.companyName ?? 'Entreprise';
    const productName = data.productName ?? 'SiteFlow Pro';
    const reportId = data.reportId ?? 'RPT-0001';


    const logoData = await resolveImageSource(data.logoUrl ?? undefined);

    // Revenue Features: Change header color for billable reports
    if (data.isBillable) {
        doc.setFillColor(...palette.billable);
    } else {
        doc.setFillColor(...palette.charcoal);
    }
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    // Revenue Features: Change title for billable reports
    doc.text(data.isBillable ? 'DEMANDE DE TRAVAUX SUPP.' : reportTitle, margin, 54);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Genere via ${productName}`, margin, 74);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(210, 214, 220);
    doc.text(companyName, pageWidth - margin, 28, { align: 'right' });

    if (logoData) {
        try {
            const logoSize = 22;
            doc.addImage(
                logoData.dataUrl,
                logoData.format,
                pageWidth - margin - logoSize,
                38,
                logoSize,
                logoSize
            );
        } catch (err) {
            // Ignore logo rendering errors to keep PDF export working.
        }
    }

    // Revenue Features: Estimated Cost Badge
    if (data.isBillable && data.estimatedCost) {
        const costLabel = `PROVISION: ${data.estimatedCost}`;
        const badgeWidth = doc.getTextWidth(costLabel) + 24;
        const badgeX = pageWidth - margin - badgeWidth;

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(badgeX, 60, badgeWidth, 24, 6, 6, 'F');

        doc.setTextColor(...palette.billable);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(costLabel, badgeX + badgeWidth / 2, 76, { align: 'center' });
    } else {
        const badgeWidth = doc.getTextWidth(reportId) + 18;
        const badgeX = pageWidth - margin - badgeWidth;
        doc.setFillColor(...palette.gold);
        doc.roundedRect(badgeX, 60, badgeWidth, 20, 8, 8, 'F'); // Standard ID Badge
        doc.setTextColor(25, 25, 25);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(reportId, badgeX + badgeWidth / 2, 74, { align: 'center' });
    }

    doc.setDrawColor(...palette.gold);
    doc.setLineWidth(2);
    doc.line(margin, headerHeight, margin + 70, headerHeight);

    const cardTop = headerHeight + 18;
    const gap = 12;
    const cardWidth = (pageWidth - margin * 2 - gap * 2) / 3;
    const cardMaxHeight = 80;

    const dateCard = measureInfoCard(doc, data.date, cardWidth, cardMaxHeight);
    const locationCard = measureInfoCard(doc, data.address, cardWidth, cardMaxHeight);
    const coordsCard = measureInfoCard(doc, data.coordinates || 'Non capturees', cardWidth, cardMaxHeight);
    const cardHeight = Math.max(dateCard.height, locationCard.height, coordsCard.height);

    drawInfoCard(
        doc,
        margin,
        cardTop,
        cardWidth,
        cardHeight,
        'Date',
        dateCard.lines,
        dateCard.fontSize,
        dateCard.valueY
    );
    drawInfoCard(
        doc,
        margin + cardWidth + gap,
        cardTop,
        cardWidth,
        cardHeight,
        'Lieu',
        locationCard.lines,
        locationCard.fontSize,
        locationCard.valueY
    );
    drawInfoCard(
        doc,
        margin + (cardWidth + gap) * 2,
        cardTop,
        cardWidth,
        cardHeight,
        'Coordonnees',
        coordsCard.lines,
        coordsCard.fontSize,
        coordsCard.valueY
    );

    const imageTop = cardTop + cardHeight + 16;
    const baseImageHeight = 240;
    let imageHeight = baseImageHeight;
    const imageWidth = pageWidth - margin * 2;

    const mainImage = await resolveImageSource(data.imageDataUrl);
    if (mainImage) {
        try {
            const imageProps = doc.getImageProperties(mainImage.dataUrl);
            const imageRatio = imageProps.width / imageProps.height;
            if (imageRatio < 0.85) {
                imageHeight = 320;
            } else if (imageRatio < 1) {
                imageHeight = 280;
            }
        } catch (err) {
            imageHeight = baseImageHeight;
        }
    }

    doc.setFillColor(242, 244, 248);
    doc.rect(margin, imageTop, imageWidth, imageHeight, 'F');

    if (mainImage) {
        try {
            const imageProps = doc.getImageProperties(mainImage.dataUrl);
            const imageRatio = imageProps.width / imageProps.height;
            const boxRatio = imageWidth / imageHeight;

            let drawWidth = imageWidth;
            let drawHeight = imageHeight;
            let drawX = margin;
            let drawY = imageTop;

            if (imageRatio > boxRatio) {
                drawHeight = imageWidth / imageRatio;
                drawY = imageTop + (imageHeight - drawHeight) / 2;
            } else {
                drawWidth = imageHeight * imageRatio;
                drawX = margin + (imageWidth - drawWidth) / 2;
            }

            doc.addImage(mainImage.dataUrl, mainImage.format, drawX, drawY, drawWidth, drawHeight);
        } catch (err) {
            doc.setTextColor(220, 220, 220);
            doc.setFontSize(11);
            doc.text('Image indisponible', margin + 16, imageTop + 32);
        }
    }

    doc.setDrawColor(220, 223, 228);
    doc.rect(margin, imageTop, imageWidth, imageHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...palette.muted);
    doc.text(`Coordonnees: ${data.coordinates || 'Non capturees'}`, margin, imageTop + imageHeight + 16);
    doc.text(`Precision: ${formatAccuracy(data.accuracy)}`, pageWidth - margin, imageTop + imageHeight + 16, {
        align: 'right',
    });

    const sectionTop = imageTop + imageHeight + 30;
    const columnGap = 16;
    const leftWidth = (pageWidth - margin * 2 - columnGap) * 0.62;
    const rightWidth = (pageWidth - margin * 2 - columnGap) - leftWidth;
    const lineHeight = 12;

    const descriptionText = data.description || 'Aucune description fournie.';
    const descriptionLines = doc.splitTextToSize(descriptionText, leftWidth - 28);
    const footerReserve = 120;
    const maxDescriptionHeight = Math.max(90, pageHeight - sectionTop - footerReserve);
    const maxLines = Math.max(1, Math.floor((maxDescriptionHeight - 52) / lineHeight));
    const primaryLines = descriptionLines.slice(0, maxLines);
    const overflowLines = descriptionLines.slice(maxLines);
    const minDescriptionHeight = 110;

    const summaryLines = [
        `Source: ${formatLocationSource(data.locationSource)}`,
        `Precision: ${formatAccuracy(data.accuracy)}`,
        `Report ID: ${reportId}`,
        `Produit: ${productName}`,
    ];

    const summaryMaxWidth = rightWidth - 28;
    const summarySizes = [9, 8, 7];
    let summaryFontSize = summarySizes[summarySizes.length - 1];
    let summaryLineHeight = Math.round(summaryFontSize * 1.4);
    let summaryWrapped: string[] = [];
    let summaryHeightNeeded = 0;

    for (const size of summarySizes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(size);
        const wrapped = summaryLines.flatMap((line) =>
            doc.splitTextToSize(`- ${line}`, summaryMaxWidth)
        );
        const lineHeight = Math.round(size * 1.4);
        const height = wrapped.length * lineHeight + 26;
        if (height <= maxDescriptionHeight) {
            summaryFontSize = size;
            summaryLineHeight = lineHeight;
            summaryWrapped = wrapped;
            summaryHeightNeeded = height;
            break;
        }
    }

    if (summaryWrapped.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(summaryFontSize);
        summaryWrapped = summaryLines.flatMap((line) =>
            doc.splitTextToSize(`- ${line}`, summaryMaxWidth)
        );
        summaryHeightNeeded = summaryWrapped.length * summaryLineHeight + 26;
    }

    const descriptionHeight = Math.min(
        Math.max(minDescriptionHeight, primaryLines.length * lineHeight + 52, summaryHeightNeeded),
        maxDescriptionHeight
    );

    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(...palette.line);
    doc.roundedRect(margin, sectionTop, leftWidth, descriptionHeight, 12, 12, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...palette.ink);
    doc.text('Observation', margin + 14, sectionTop + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...palette.ink);
    doc.text(primaryLines, margin + 14, sectionTop + 40);

    doc.setFillColor(245, 245, 248);
    doc.setDrawColor(...palette.line);
    doc.roundedRect(margin + leftWidth + columnGap, sectionTop, rightWidth, descriptionHeight, 12, 12, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...palette.ink);
    doc.text('Synthese', margin + leftWidth + columnGap + 14, sectionTop + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...palette.muted);

    const summaryAvailableHeight = Math.max(30, descriptionHeight - 54);
    if (summaryWrapped.length * summaryLineHeight > summaryAvailableHeight) {
        const trimmedLines: string[] = [];
        let currentHeight = 0;
        for (const line of summaryWrapped) {
            if (currentHeight + summaryLineHeight > summaryAvailableHeight) {
                break;
            }
            trimmedLines.push(line);
            currentHeight += summaryLineHeight;
        }
        summaryWrapped = trimmedLines;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(summaryFontSize);
    summaryWrapped.forEach((line, index) => {
        doc.text(
            line,
            margin + leftWidth + columnGap + 14,
            sectionTop + 44 + index * summaryLineHeight
        );
    });

    const signatureTop = sectionTop + descriptionHeight + 26;
    const signatureWidth = (pageWidth - margin * 2 - 24) / 2;

    doc.setDrawColor(...palette.line);
    doc.line(margin, signatureTop + 36, margin + signatureWidth, signatureTop + 36);
    doc.line(margin + signatureWidth + 24, signatureTop + 36, pageWidth - margin, signatureTop + 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...palette.muted);
    doc.text('Chef de chantier', margin, signatureTop + 52);
    doc.text('Conducteur de travaux', margin + signatureWidth + 24, signatureTop + 52);

    const continuationLineHeight = 12;
    const continuationTop = 72;
    const continuationHeight = pageHeight - continuationTop - 70;
    const continuationLinesPerPage = Math.max(10, Math.floor(continuationHeight / continuationLineHeight));
    const extraPages = Math.ceil(overflowLines.length / continuationLinesPerPage);

    if (overflowLines.length > 0) {
        for (let pageIndex = 0; pageIndex < extraPages; pageIndex += 1) {
            const chunk = overflowLines.slice(
                pageIndex * continuationLinesPerPage,
                (pageIndex + 1) * continuationLinesPerPage
            );
            doc.addPage();

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(...palette.ink);
            doc.text('Observation (suite)', margin, 48);

            doc.setDrawColor(...palette.line);
            doc.line(margin, 56, pageWidth - margin, 56);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...palette.ink);
            doc.text(chunk, margin, continuationTop);
        }
    }

    const totalPages = doc.getNumberOfPages();
    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
        doc.setPage(pageIndex);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...palette.muted);
        doc.text('Document confidentiel - usage interne', margin, pageHeight - 24);
        doc.text(`Page ${pageIndex}/${totalPages}`, pageWidth - margin, pageHeight - 24, {
            align: 'right',
        });
    }

    doc.save('siteflow-report.pdf');
};
