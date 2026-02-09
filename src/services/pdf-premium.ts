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

const palette = {
  primary: [26, 54, 93],
  secondary: [201, 162, 99],
  accent: [220, 53, 69],
  success: [40, 167, 69],
  warning: [255, 193, 7],
  dark: [33, 37, 41],
  gray: [108, 117, 125],
  line: [220, 223, 228],
  surface: [248, 249, 251],
  surfaceAlt: [242, 244, 248],
  white: [255, 255, 255],
} as const;

const setFill = (doc: jsPDF, c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

type ImageSource = {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
};

const getImageFormat = (dataUrl: string): ImageSource['format'] | null => {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return null;
};

const toDataUrl = async (url: string): Promise<string | null> => {
  if (typeof fetch === 'undefined') return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Image load failed'));
    reader.readAsDataURL(blob);
  });
};

const resolveImageSource = async (value?: string | null): Promise<ImageSource | null> => {
  if (!value) return null;
  if (value.startsWith('data:image/')) {
    const format = getImageFormat(value);
    return format ? { dataUrl: value, format } : null;
  }
  try {
    const dataUrl = await toDataUrl(value);
    if (!dataUrl) return null;
    const format = getImageFormat(dataUrl);
    return format ? { dataUrl, format } : null;
  } catch {
    return null;
  }
};

const formatAccuracy = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return 'non disponible';
  return `± ${Math.round(value)} m`;
};

const formatLocationSource = (source?: ReportPDFData['locationSource']) => {
  if (source === 'gps') return 'GPS OK';
  if (source === 'demo') return 'Mode démo';
  return 'GPS indisponible';
};

const priorityMeta = (priority?: ReportPDFData['priority']) => {
  if (priority === 'high') return { label: 'PRIORITÉ HAUTE', color: palette.accent };
  if (priority === 'medium') return { label: 'PRIORITÉ MOYENNE', color: palette.warning };
  if (priority === 'low') return { label: 'PRIORITÉ FAIBLE', color: palette.success };
  return null;
};

const categoryLabel = (category?: string) => {
  if (!category) return null;
  const map: Record<string, string> = {
    safety: 'Sécurité',
    progress: 'Avancement',
    anomaly: 'Anomalie',
    other: 'Autre',
  };
  return map[category] || category;
};

const cardStyle = {
  minHeight: 58,
  paddingX: 12,
  labelY: 18,
  bottomPadding: 14,
};

const cardFontSizes = [10, 9, 8] as const;

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
    const contentHeight = valueY + Math.max(0, lines.length - 1) * lineHeight + cardStyle.bottomPadding;
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
  const contentHeight = valueY + Math.max(0, lines.length - 1) * lineHeight + cardStyle.bottomPadding;
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
  setFill(doc, palette.surface);
  setDraw(doc, palette.line);
  doc.roundedRect(x, y, width, height, 10, 10, 'FD');

  setText(doc, palette.gray);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), x + cardStyle.paddingX, y + cardStyle.labelY);

  setText(doc, palette.dark);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.text(lines, x + cardStyle.paddingX, y + valueY);
};

const drawChip = (
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  opts: { fill: readonly number[]; textColor?: readonly number[] }
) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  const paddingX = 10;
  const paddingY = 6;
  const width = doc.getTextWidth(text) + paddingX * 2;
  const height = paddingY * 2 + 8;

  setFill(doc, opts.fill);
  doc.roundedRect(x, y, width, height, height / 2, height / 2, 'F');

  setText(doc, opts.textColor ?? palette.white);
  doc.text(text, x + width / 2, y + height / 2 + 3, { align: 'center' });

  return width;
};

const drawSectionTitle = (doc: jsPDF, x: number, y: number, title: string) => {
  setText(doc, palette.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, x, y);

  setDraw(doc, palette.secondary);
  doc.setLineWidth(2);
  doc.line(x, y + 6, x + 72, y + 6);
};

const stripAppendedSections = (value: string) => {
  // Legacy cleanup: older versions used to append TS/certification blocks inside description.
  // Those are now rendered via dedicated fields in the PDF.
  const markers = [
    '\n\n--- TRAVAUX SUPPLEMENTAIRES ---\n',
    '\n\n--- TRAVAUX SUPPLÉMENTAIRES ---\n',
    '\n\n--- CERTIFICATION ---\n',
  ];

  let cutIndex = -1;
  for (const marker of markers) {
    const idx = value.indexOf(marker);
    if (idx >= 0 && (cutIndex === -1 || idx < cutIndex)) {
      cutIndex = idx;
    }
  }

  return (cutIndex >= 0 ? value.slice(0, cutIndex) : value).trim();
};

const openEndedDescription = (description: string) => {
  const cleaned = stripAppendedSections(description || '');
  return cleaned || 'Aucune description fournie.';
};

export const generatePremiumPDF = async (
  data: ReportPDFData
): Promise<{ blob: Blob; filename: string }> => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 46;
  const headerHeight = 102;

  const reportTitle = data.reportTitle ?? 'Rapport de chantier';
  const companyName = data.companyName ?? 'Entreprise';
  const productName = data.productName ?? 'SiteFlow Pro';
  const reportId = data.reportId ?? 'RPT-0001';
  const siteName = data.siteName ?? '';
  const clientName = data.clientName ?? '';

  const priority = priorityMeta(data.priority);
  const category = categoryLabel(data.category);
  const logoData = await resolveImageSource(data.logoUrl);

  // ======================
  // PAGE 1: HEADER
  // ======================
  setFill(doc, palette.primary);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setText(doc, palette.white);
  doc.text(reportTitle, margin, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, [210, 214, 220]);
  const subtitleParts = [siteName, clientName].filter(Boolean);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join('  •  ') : `Généré via ${productName}`;
  doc.text(subtitle, margin, 72);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, [210, 214, 220]);
  doc.text(companyName, pageWidth - margin, 28, { align: 'right' });

  if (logoData) {
    try {
      const logoSize = 26;
      doc.addImage(logoData.dataUrl, logoData.format, pageWidth - margin - logoSize, 38, logoSize, logoSize);
    } catch {
      // Ignore logo rendering errors to keep export working.
    }
  }

  // Badges (Réf + date)
  const idBadgeText = reportId;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const idBadgeWidth = doc.getTextWidth(idBadgeText) + 18;
  const badgeX = pageWidth - margin - idBadgeWidth - (logoData ? 34 : 0);

  setFill(doc, palette.secondary);
  doc.roundedRect(badgeX, 66, idBadgeWidth, 20, 8, 8, 'F');
  setText(doc, [25, 25, 25]);
  doc.text(idBadgeText, badgeX + idBadgeWidth / 2, 80, { align: 'center' });

  // Chips (priorité + source localisation)
  let chipX = margin;
  const chipY = headerHeight - 26;
  if (priority) {
    chipX += drawChip(doc, chipX, chipY, priority.label, { fill: priority.color }) + 8;
  }
  chipX += drawChip(doc, chipX, chipY, formatLocationSource(data.locationSource), { fill: [54, 82, 125] }) + 8;
  if (category) {
    drawChip(doc, chipX, chipY, category.toUpperCase(), { fill: [40, 48, 58] });
  }

  // Accent line
  setDraw(doc, palette.secondary);
  doc.setLineWidth(2);
  doc.line(margin, headerHeight, margin + 86, headerHeight);

  // ======================
  // INFO CARDS
  // ======================
  const cardTop = headerHeight + 18;
  const gap = 12;
  const cardWidth = (pageWidth - margin * 2 - gap * 2) / 3;
  const cardMaxHeight = 92;

  const dateCard = measureInfoCard(doc, data.date, cardWidth, cardMaxHeight);
  const locationCard = measureInfoCard(doc, data.address, cardWidth, cardMaxHeight);
  const coordsLine = `${data.coordinates || 'Non capturées'}\nPrécision: ${formatAccuracy(data.accuracy)}`;
  const coordsCard = measureInfoCard(doc, coordsLine, cardWidth, cardMaxHeight);

  const cardHeight = Math.max(dateCard.height, locationCard.height, coordsCard.height);

  drawInfoCard(doc, margin, cardTop, cardWidth, cardHeight, 'Date', dateCard.lines, dateCard.fontSize, dateCard.valueY);
  drawInfoCard(
    doc,
    margin + cardWidth + gap,
    cardTop,
    cardWidth,
    cardHeight,
    'Adresse',
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
    'GPS',
    coordsCard.lines,
    coordsCard.fontSize,
    coordsCard.valueY
  );

  // ======================
  // PHOTO
  // ======================
  const imageTop = cardTop + cardHeight + 16;
  const baseImageHeight = 240;
  let imageHeight = baseImageHeight;
  const imageWidth = pageWidth - margin * 2;

  const mainImage = await resolveImageSource(data.imageDataUrl);
  if (mainImage) {
    try {
      const imageProps = doc.getImageProperties(mainImage.dataUrl);
      const imageRatio = imageProps.width / imageProps.height;
      if (imageRatio < 0.85) imageHeight = 320;
      else if (imageRatio < 1) imageHeight = 280;
    } catch {
      imageHeight = baseImageHeight;
    }
  }

  setFill(doc, palette.surfaceAlt);
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
    } catch {
      setText(doc, [220, 220, 220]);
      doc.setFontSize(11);
      doc.text('Image indisponible', margin + 16, imageTop + 32);
    }
  }

  setDraw(doc, palette.line);
  doc.rect(margin, imageTop, imageWidth, imageHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, palette.gray);
  doc.text(`Coordonnées: ${data.coordinates || 'Non capturées'}`, margin, imageTop + imageHeight + 16);
  doc.text(`Précision: ${formatAccuracy(data.accuracy)}`, pageWidth - margin, imageTop + imageHeight + 16, {
    align: 'right',
  });

  // ======================
  // OBSERVATION + SYNTHÈSE
  // ======================
  const sectionTop = imageTop + imageHeight + 30;
  const columnGap = 16;
  const leftWidth = (pageWidth - margin * 2 - columnGap) * 0.62;
  const rightWidth = (pageWidth - margin * 2 - columnGap) - leftWidth;
  const lineHeight = 12;

  const descriptionText = openEndedDescription(data.description);
  const descriptionLines = doc.splitTextToSize(descriptionText, leftWidth - 28);
  const footerReserve = 126;
  const maxDescriptionHeight = Math.max(90, pageHeight - sectionTop - footerReserve);
  const maxLines = Math.max(1, Math.floor((maxDescriptionHeight - 52) / lineHeight));
  const primaryLines = descriptionLines.slice(0, maxLines);
  const overflowLines = descriptionLines.slice(maxLines);
  const minDescriptionHeight = 110;

  const summaryLines = [
    siteName ? `Chantier: ${siteName}` : null,
    data.operatorName ? `Opérateur: ${data.operatorName}` : null,
    clientName ? `Client: ${clientName}` : null,
    `Source: ${formatLocationSource(data.locationSource)}`,
    `Précision: ${formatAccuracy(data.accuracy)}`,
    category ? `Catégorie: ${category}` : null,
    data.priority ? `Priorité: ${priority?.label.replace('PRIORITÉ ', '') || ''}` : null,
    `Réf: ${reportId}`,
    data.integrityHash ? 'Certification: OK (SHA-256)' : 'Certification: non disponible',
    data.integrityHash ? `Hash: ${data.integrityHash.substring(0, 24)}...` : null,
  ].filter(Boolean) as string[];

  const summaryMaxWidth = rightWidth - 28;
  const summarySizes = [9, 8, 7] as const;
  let summaryFontSize = summarySizes[summarySizes.length - 1];
  let summaryLineHeight = Math.round(summaryFontSize * 1.4);
  let summaryWrapped: string[] = [];
  let summaryHeightNeeded = 0;

  for (const size of summarySizes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const wrapped = summaryLines.flatMap((line) => doc.splitTextToSize(`- ${line}`, summaryMaxWidth));
    const lh = Math.round(size * 1.4);
    const height = wrapped.length * lh + 26;
    if (height <= maxDescriptionHeight) {
      summaryFontSize = size;
      summaryLineHeight = lh;
      summaryWrapped = wrapped;
      summaryHeightNeeded = height;
      break;
    }
  }

  if (summaryWrapped.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(summaryFontSize);
    summaryWrapped = summaryLines.flatMap((line) => doc.splitTextToSize(`- ${line}`, summaryMaxWidth));
    summaryHeightNeeded = summaryWrapped.length * summaryLineHeight + 26;
  }

  const descriptionHeight = Math.min(
    Math.max(minDescriptionHeight, primaryLines.length * lineHeight + 52, summaryHeightNeeded),
    maxDescriptionHeight
  );

  // Left: Observation
  setFill(doc, [250, 250, 252]);
  setDraw(doc, palette.line);
  doc.roundedRect(margin, sectionTop, leftWidth, descriptionHeight, 12, 12, 'FD');
  drawSectionTitle(doc, margin + 14, sectionTop + 22, 'Observation');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, palette.dark);
  doc.text(primaryLines, margin + 14, sectionTop + 40);

  // Right: Synthèse
  setFill(doc, [245, 245, 248]);
  setDraw(doc, palette.line);
  doc.roundedRect(margin + leftWidth + columnGap, sectionTop, rightWidth, descriptionHeight, 12, 12, 'FD');
  drawSectionTitle(doc, margin + leftWidth + columnGap + 14, sectionTop + 22, 'Synthèse');

  const summaryAvailableHeight = Math.max(30, descriptionHeight - 54);
  if (summaryWrapped.length * summaryLineHeight > summaryAvailableHeight) {
    const trimmedLines: string[] = [];
    let currentHeight = 0;
    for (const line of summaryWrapped) {
      if (currentHeight + summaryLineHeight > summaryAvailableHeight) break;
      trimmedLines.push(line);
      currentHeight += summaryLineHeight;
    }
    summaryWrapped = trimmedLines;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(summaryFontSize);
  setText(doc, palette.gray);
  summaryWrapped.forEach((line, index) => {
    doc.text(line, margin + leftWidth + columnGap + 14, sectionTop + 44 + index * summaryLineHeight);
  });

  // ======================
  // SIGNATURES
  // ======================
  const signatureTop = sectionTop + descriptionHeight + 26;
  const signatureWidth = (pageWidth - margin * 2 - 24) / 2;

  setDraw(doc, palette.line);
  doc.setLineWidth(1);
  doc.line(margin, signatureTop + 36, margin + signatureWidth, signatureTop + 36);
  doc.line(margin + signatureWidth + 24, signatureTop + 36, pageWidth - margin, signatureTop + 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, palette.gray);
  doc.text('Chef de chantier / Opérateur', margin, signatureTop + 52);
  doc.text('Client / Maître d’ouvrage', margin + signatureWidth + 24, signatureTop + 52);

  // Names (optional)
  const leftName = data.operatorName || '';
  const rightName = data.clientName || '';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, palette.dark);
  if (leftName) doc.text(leftName, margin, signatureTop + 30);
  if (rightName && !data.clientSignature) doc.text(rightName, margin + signatureWidth + 24, signatureTop + 30);

  // Client signature (optional)
  if (data.clientSignature) {
    const sigImage = await resolveImageSource(data.clientSignature);
    if (sigImage) {
      try {
        doc.addImage(sigImage.dataUrl, sigImage.format, margin + signatureWidth + 24, signatureTop + 10, 120, 24);
      } catch {
        // ignore
      }
    }
  }

  // ======================
  // OBSERVATION (SUITE)
  // ======================
  const continuationLineHeight = 12;
  const continuationTop = 92;
  const continuationHeight = pageHeight - continuationTop - 84;
  const continuationLinesPerPage = Math.max(10, Math.floor(continuationHeight / continuationLineHeight));
  const extraPages = Math.ceil(overflowLines.length / continuationLinesPerPage);

  if (overflowLines.length > 0) {
    for (let pageIndex = 0; pageIndex < extraPages; pageIndex += 1) {
      const chunk = overflowLines.slice(
        pageIndex * continuationLinesPerPage,
        (pageIndex + 1) * continuationLinesPerPage
      );
      doc.addPage();

      setFill(doc, palette.primary);
      doc.rect(0, 0, pageWidth, 64, 'F');
      setText(doc, palette.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Observation (suite)', margin, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(doc, [210, 214, 220]);
      doc.text(`${siteName || reportTitle}  •  ${reportId}`, margin, 56);

      setText(doc, palette.dark);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(chunk, margin, continuationTop);
    }
  }

  // ======================
  // ANNEXE: TRAVAUX SUPP.
  // ======================
  if (data.extraWorks && data.extraWorks.length > 0) {
    const items = data.extraWorks;
    let y = 92;

    const addExtraWorksPage = (pageTitle: string) => {
      doc.addPage();
      setFill(doc, palette.primary);
      doc.rect(0, 0, pageWidth, 64, 'F');
      setText(doc, palette.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(pageTitle, margin, 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(doc, [210, 214, 220]);
      doc.text(`${siteName || reportTitle}  •  ${reportId}`, margin, 56);
      y = 92;
    };

    addExtraWorksPage('Annexe A · Travaux supplémentaires');

    const tableX = margin;
    const tableW = pageWidth - margin * 2;
    const colW = {
      desc: tableW * 0.56,
      cat: tableW * 0.16,
      urg: tableW * 0.12,
      cost: tableW * 0.16,
    };

    const drawTableHeader = () => {
      setFill(doc, palette.primary);
      doc.rect(tableX, y, tableW, 24, 'F');
      setText(doc, palette.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Description', tableX + 10, y + 16);
      doc.text('Catégorie', tableX + colW.desc + 10, y + 16);
      doc.text('Urgence', tableX + colW.desc + colW.cat + 10, y + 16);
      doc.text('Estimation', tableX + tableW - 10, y + 16, { align: 'right' });
      y += 24;
    };

    drawTableHeader();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let total = 0;
    const rowH = 26;

    const urgencyLabel: Record<'low' | 'medium' | 'high', string> = {
      low: 'FAIBLE',
      medium: 'MOYENNE',
      high: 'HAUTE',
    };
    const urgencyColor: Record<'low' | 'medium' | 'high', readonly number[]> = {
      low: palette.success,
      medium: palette.warning,
      high: palette.accent,
    };

    items.forEach((ts, idx) => {
      if (y + rowH + 60 > pageHeight - margin) {
        addExtraWorksPage('Annexe A · Travaux supplémentaires (suite)');
        drawTableHeader();
      }

      const isEven = idx % 2 === 0;
      setFill(doc, isEven ? palette.white : palette.surfaceAlt);
      setDraw(doc, palette.line);
      doc.rect(tableX, y, tableW, rowH, 'FD');

      const desc = ts.description.length > 80 ? `${ts.description.slice(0, 80)}...` : ts.description;
      setText(doc, palette.dark);
      doc.text(desc, tableX + 10, y + 16);

      setText(doc, palette.gray);
      doc.text((ts.category || '').toUpperCase(), tableX + colW.desc + 10, y + 16);

      setText(doc, urgencyColor[ts.urgency]);
      doc.setFont('helvetica', 'bold');
      doc.text(urgencyLabel[ts.urgency], tableX + colW.desc + colW.cat + 10, y + 16);
      doc.setFont('helvetica', 'normal');

      setText(doc, palette.dark);
      doc.text(`${ts.estimatedCost.toLocaleString('fr-FR')} € HT`, tableX + tableW - 10, y + 16, {
        align: 'right',
      });

      total += ts.estimatedCost;
      y += rowH;
    });

    // Total row
    if (y + 48 > pageHeight - margin) {
      addExtraWorksPage('Annexe A · Travaux supplémentaires (suite)');
      drawTableHeader();
    }

    setFill(doc, [238, 240, 245]);
    setDraw(doc, palette.primary);
    doc.setLineWidth(1);
    doc.roundedRect(tableX, y + 10, tableW, 34, 10, 10, 'FD');
    setText(doc, palette.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL TRAVAUX SUPPLÉMENTAIRES', tableX + 12, y + 32);
    doc.text(`${total.toLocaleString('fr-FR')} € HT`, tableX + tableW - 12, y + 32, { align: 'right' });

    // Certification block (optional)
    if (data.integrityHash) {
      const cy = y + 56;
      if (cy + 54 < pageHeight - margin) {
        setFill(doc, [240, 248, 240]);
        setDraw(doc, palette.success);
        doc.setLineWidth(1);
        doc.roundedRect(tableX, cy, tableW, 44, 10, 10, 'FD');
        setText(doc, palette.success);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('CERTIFICATION', tableX + 12, cy + 18);
        setText(doc, palette.dark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`SHA-256: ${data.integrityHash.substring(0, 48)}...`, tableX + 12, cy + 34);
      }
    }
  }

  // ======================
  // FOOTERS (ALL PAGES)
  // ======================
  const totalPages = doc.getNumberOfPages();
  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(doc, palette.gray);
    doc.text('Document confidentiel - usage interne', margin, pageHeight - 24);
    doc.text(`${productName} • ${reportId}`, pageWidth - margin, pageHeight - 24, { align: 'right' });
    doc.text(`Page ${pageIndex}/${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
  }

  const filename = `Rapport_${(siteName || 'Chantier').replace(/\s+/g, '_')}_${reportId.replace(/-/g, '_')}.pdf`;
  return { blob: doc.output('blob'), filename };
};
