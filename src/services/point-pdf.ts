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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const renderPlanZoomWithInset = (
  plan: ApiPlan,
  point: ApiPlanPoint,
  opts: { aspect: number }
): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const aspect = clamp(opts.aspect || 1.6, 0.8, 2.6);
      const outW = 1600;
      const outH = Math.max(800, Math.round(outW / aspect));

      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      const centerX = (point.positionX / 100) * img.width;
      const centerY = (point.positionY / 100) * img.height;

      // White base
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);

      // Full-plan render (no crop/zoom): keep the entire plan visible and place marker in context.
      const planRatio = img.width / img.height;
      const boxRatio = outW / outH;

      let drawW = outW;
      let drawH = outH;
      let drawX = 0;
      let drawY = 0;
      if (planRatio > boxRatio) {
        drawH = outW / planRatio;
        drawY = (outH - drawH) / 2;
      } else {
        drawW = outH * planRatio;
        drawX = (outW - drawW) / 2;
      }

      ctx.drawImage(img, 0, 0, img.width, img.height, drawX, drawY, drawW, drawH);

      const mx = drawX + (centerX / img.width) * drawW;
      const my = drawY + (centerY / img.height) * drawH;
      const r = Math.max(18, Math.round(Math.min(drawW, drawH) * 0.032));

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = r * 0.75;
      ctx.shadowOffsetX = r * 0.12;
      ctx.shadowOffsetY = r * 0.2;

      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,183,3,0.95)';
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.lineWidth = Math.max(4, Math.round(r * 0.18));
      ctx.strokeStyle = 'rgba(26,54,93,0.95)';
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(4, Math.round(r * 0.22)), 0, Math.PI * 2);
      ctx.fillStyle = '#111827';
      ctx.fill();

      // Number
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.max(18, Math.round(r * 0.9))}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(point.pointNumber), mx, my + 1);
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
  setText(doc, palette.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Description', margin, y);
  y += 18;

  const descText = (point.description || '').trim() || 'Aucune description.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, palette.dark);
  const descLines = doc.splitTextToSize(descText, pageWidth - margin * 2);
  const footerReserve = 70;
  const lineH = 12;

  const drawTopBar = (title: string) => {
    setFill(doc, palette.primary);
    doc.rect(0, 0, pageWidth, 64, 'F');
    setText(doc, palette.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, margin, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, [210, 214, 220]);
    doc.text(`${plan.siteName}  •  Point #${point.pointNumber}`, margin, 56);
  };

  // Paginate description if needed (avoid overflowing a single page)
  let remaining = [...descLines];
  while (remaining.length > 0) {
    const available = Math.max(24, pageHeight - y - footerReserve);
    const linesFit = Math.max(1, Math.floor(available / lineH));
    const chunk = remaining.slice(0, linesFit);
    doc.text(chunk, margin, y);
    remaining = remaining.slice(linesFit);
    y += chunk.length * lineH + 18;

    if (remaining.length > 0) {
      doc.addPage();
      drawTopBar('Description (suite)');
      setText(doc, palette.dark);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y = 92;
    }
  }

  // Localisation on plan: render a zoomed view (plus inset overview) so it’s readable on mobile.
  const planBoxW = pageWidth - margin * 2;
  const minPlanH = 180;
  const maxPlanH = 260;

  // If we don't have enough room on this page, move to a dedicated page.
  const spaceForTitleAndGap = 26;
  const availableForPlan = pageHeight - y - footerReserve;
  const needsNewPage = availableForPlan < minPlanH + spaceForTitleAndGap;
  if (needsNewPage) {
    doc.addPage();
    drawTopBar('Localisation sur le plan');
    y = 92;
  } else {
    y += 6;
  }

  setText(doc, palette.gray);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Localisation sur le plan', margin, y);
  y += 12;

  const planAvailableH = pageHeight - y - footerReserve;
  const planBoxH = Math.max(minPlanH, Math.min(maxPlanH, planAvailableH));
  const aspect = planBoxW / planBoxH;
  const planZoom = await renderPlanZoomWithInset(plan, point, { aspect });

  setFill(doc, palette.surfaceAlt);
  doc.rect(margin, y, planBoxW, planBoxH, 'F');
  setDraw(doc, palette.line);
  doc.rect(margin, y, planBoxW, planBoxH, 'S');

  if (planZoom) {
    try {
      doc.addImage(planZoom, 'JPEG', margin, y, planBoxW, planBoxH);
    } catch {
      // ignore
    }
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
