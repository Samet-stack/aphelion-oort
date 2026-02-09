import { jsPDF } from 'jspdf';
import type { ApiPlan, ApiPlanPoint } from './api';
import { branding } from '../config/branding';

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

const statusMeta = (status: ApiPlanPoint['status']) => {
  if (status === 'termine') return { label: 'Terminé', color: palette.success };
  if (status === 'en_cours') return { label: 'En cours', color: palette.warning };
  return { label: 'À faire', color: palette.accent };
};

const categoryLabel = (category: string) => {
  const map: Record<string, string> = {
    radiateur: 'Radiateur',
    electricite: 'Électricité',
    defaut: 'Défaut',
    validation: 'Validation',
    plomberie: 'Plomberie',
    maconnerie: 'Maçonnerie',
    menuiserie: 'Menuiserie',
    autre: 'Autre',
  };
  return map[category] || category;
};

const renderMiniPlan = (plan: ApiPlan, point: ApiPlanPoint): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxWidth = 1600;
      const scale = Math.min(1, maxWidth / img.width);

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      // White base
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Plan image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Marker
      const x = (point.positionX / 100) * canvas.width;
      const y = (point.positionY / 100) * canvas.height;
      const r = Math.max(12, Math.round(canvas.width * 0.014));

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = r * 0.6;
      ctx.shadowOffsetX = r * 0.12;
      ctx.shadowOffsetY = r * 0.2;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,183,3,0.92)';
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(26,54,93,0.95)';
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.font = `bold ${Math.max(14, Math.round(r * 1.05))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(point.pointNumber), x, y + 1);

      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };

    img.onerror = () => resolve(null);
    img.src = plan.imageDataUrl;
  });
};

export const generatePointPDF = async (
  plan: ApiPlan,
  point: ApiPlanPoint
): Promise<{ blob: Blob; filename: string }> => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 46;
  const headerHeight = 96;

  const productName = branding.productName || 'SiteFlow Pro';
  const companyName = branding.companyName || 'Entreprise';

  const status = statusMeta(point.status);

  // Header
  setFill(doc, palette.primary);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  setText(doc, palette.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FICHE POINT', margin, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, [210, 214, 220]);
  doc.text(plan.siteName, margin, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, [210, 214, 220]);
  doc.text(companyName, pageWidth - margin, 28, { align: 'right' });

  // Badge number
  const badgeText = `#${point.pointNumber}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const badgeW = doc.getTextWidth(badgeText) + 18;
  const badgeX = pageWidth - margin - badgeW;
  setFill(doc, palette.secondary);
  doc.roundedRect(badgeX, 56, badgeW, 26, 10, 10, 'F');
  setText(doc, [25, 25, 25]);
  doc.text(badgeText, badgeX + badgeW / 2, 74, { align: 'center' });

  // Status chip
  const chipText = status.label.toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const chipW = doc.getTextWidth(chipText) + 18;
  const chipX = margin;
  setFill(doc, status.color);
  doc.roundedRect(chipX, headerHeight - 26, chipW, 18, 9, 9, 'F');
  setText(doc, palette.white);
  doc.text(chipText, chipX + chipW / 2, headerHeight - 13, { align: 'center' });

  // Title
  const contentTop = headerHeight + 18;
  setText(doc, palette.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(point.title, pageWidth - margin * 2);
  doc.text(titleLines, margin, contentTop + 18);

  let y = contentTop + 34 + Math.max(0, titleLines.length - 1) * 16;

  // Meta row
  setText(doc, palette.gray);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const metaParts = [
    categoryLabel(point.category),
    point.room ? `Lieu: ${point.room}` : null,
    point.dateLabel ? `Date: ${point.dateLabel}` : null,
  ].filter(Boolean) as string[];
  if (metaParts.length > 0) {
    doc.text(metaParts.join('  •  '), margin, y);
    y += 18;
  } else {
    y += 8;
  }

  // Photo
  const photoBoxW = pageWidth - margin * 2;
  const photoBoxH = 260;
  setFill(doc, palette.surfaceAlt);
  doc.rect(margin, y, photoBoxW, photoBoxH, 'F');
  setDraw(doc, palette.line);
  doc.rect(margin, y, photoBoxW, photoBoxH, 'S');

  const photo = await resolveImageSource(point.photoDataUrl);
  if (photo) {
    try {
      const props = doc.getImageProperties(photo.dataUrl);
      const ratio = props.width / props.height;
      const boxRatio = photoBoxW / photoBoxH;

      let drawW = photoBoxW;
      let drawH = photoBoxH;
      let drawX = margin;
      let drawY = y;

      if (ratio > boxRatio) {
        drawH = photoBoxW / ratio;
        drawY = y + (photoBoxH - drawH) / 2;
      } else {
        drawW = photoBoxH * ratio;
        drawX = margin + (photoBoxW - drawW) / 2;
      }

      doc.addImage(photo.dataUrl, photo.format, drawX, drawY, drawW, drawH);
    } catch {
      // ignore
    }
  }

  y += photoBoxH + 18;

  // Description
  const descTitleY = y;
  setText(doc, palette.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Description', margin, descTitleY);
  y += 12;

  const descText = (point.description || '').trim() || 'Aucune description.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, palette.dark);
  const descLines = doc.splitTextToSize(descText, pageWidth - margin * 2);

  const footerReserve = 70;
  const available = Math.max(60, pageHeight - y - footerReserve);
  const lineH = 12;
  const maxLines = Math.max(1, Math.floor(available / lineH));
  const firstChunk = descLines.slice(0, maxLines);
  const rest = descLines.slice(maxLines);
  doc.text(firstChunk, margin, y + 10);
  y += Math.max(28, firstChunk.length * lineH + 12);

  // Mini plan (if fits)
  const miniPlan = await renderMiniPlan(plan, point);
  if (miniPlan && rest.length === 0) {
    const miniW = 190;
    const miniH = 130;
    const miniX = pageWidth - margin - miniW;
    const miniY = pageHeight - 220;
    if (miniY > y + 18) {
      setText(doc, palette.gray);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Localisation sur le plan', miniX, miniY - 8);
      setFill(doc, palette.surfaceAlt);
      doc.rect(miniX, miniY, miniW, miniH, 'F');
      setDraw(doc, palette.line);
      doc.rect(miniX, miniY, miniW, miniH, 'S');
      try {
        doc.addImage(miniPlan, 'JPEG', miniX, miniY, miniW, miniH);
      } catch {
        // ignore
      }
    }
  }

  // Continuation page if description overflow
  if (rest.length > 0) {
    doc.addPage();
    setFill(doc, palette.primary);
    doc.rect(0, 0, pageWidth, 64, 'F');
    setText(doc, palette.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Description (suite)', margin, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, [210, 214, 220]);
    doc.text(`${plan.siteName}  •  Point #${point.pointNumber}`, margin, 56);

    setText(doc, palette.dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(rest, margin, 92);
  }

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    doc.setPage(pageIndex);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(doc, palette.gray);
    doc.text(`${productName} • ${plan.siteName}`, margin, pageHeight - 24);
    doc.text(`Point #${point.pointNumber}`, pageWidth - margin, pageHeight - 24, { align: 'right' });
    doc.text(`Page ${pageIndex}/${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
  }

  const filename = `Point_${plan.siteName.replace(/\s+/g, '_')}_#${point.pointNumber}.pdf`;
  return { blob: doc.output('blob'), filename };
};

