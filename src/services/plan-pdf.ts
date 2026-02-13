import { jsPDF } from 'jspdf';
import { ApiPlan } from './api';
import { branding } from '../config/branding';

// Palette professionnelle (meme que pdf-premium)
const palette = {
  primary: [26, 54, 93],
  secondary: [201, 162, 99],
  accent: [220, 53, 69],
  success: [40, 167, 69],
  warning: [255, 193, 7],
  dark: [33, 37, 41],
  gray: [108, 117, 125],
  lightGray: [233, 236, 239],
  white: [255, 255, 255],
};

const setFillColor = (doc: jsPDF, c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
const setDrawColor = (doc: jsPDF, c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);
const setTextColor = (doc: jsPDF, c: number[]) => doc.setTextColor(c[0], c[1], c[2]);

const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | null => {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return null;
};

const statusLabels: Record<string, string> = {
  a_faire: 'A faire',
  en_cours: 'En cours',
  termine: 'Termine',
};

const statusColors: Record<string, number[]> = {
  a_faire: [220, 53, 69],
  en_cours: [255, 193, 7],
  termine: [40, 167, 69],
};

const categoryLabels: Record<string, string> = {
  radiateur: 'Radiateur',
  electricite: 'Electricite',
  defaut: 'Defaut',
  validation: 'Validation',
  plomberie: 'Plomberie',
  maconnerie: 'Maconnerie',
  menuiserie: 'Menuiserie',
  autre: 'Autre',
};

// Rendre le plan avec les marqueurs numerotes sur un canvas
const renderPlanWithMarkers = (plan: ApiPlan): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxWidth = 2000;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const markerRadius = Math.max(14, canvas.width * 0.014);

      for (const point of plan.points) {
        const x = (point.positionX / 100) * canvas.width;
        const y = (point.positionY / 100) * canvas.height;

        // Ombre
        ctx.beginPath();
        ctx.arc(x + 1, y + 1, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Cercle colore
        const color = statusColors[point.status] || statusColors.a_faire;
        ctx.beginPath();
        ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Numero
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.round(markerRadius * 1.1)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(point.pointNumber), x, y);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve('');
    img.src = plan.imageDataUrl;
  });
};

export const generatePlanPDF = async (plan: ApiPlan): Promise<{ blob: Blob; filename: string }> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const productName = branding.productName || 'SiteFlow Pro';

  let currentY = 0;

  // === HEADER ===
  setFillColor(doc, palette.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');

  setTextColor(doc, palette.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SITEFLOW', margin, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Rapport de Plan - Points d\'Inspection', margin, 22);

  setTextColor(doc, palette.secondary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, 15, { align: 'right' });

  setTextColor(doc, palette.white);
  doc.setFontSize(9);
  doc.text(`${plan.points.length} point(s)`, pageWidth - margin, 22, { align: 'right' });

  currentY = 45;

  // === IDENTIFICATION DU CHANTIER ===
  setTextColor(doc, palette.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('1. IDENTIFICATION DU CHANTIER', margin, currentY);

  setDrawColor(doc, palette.secondary);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY + 2, margin + 60, currentY + 2);

  currentY += 12;

  // Compter les statuts
  const statusCounts = { a_faire: 0, en_cours: 0, termine: 0 };
  plan.points.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  const infoRows = [
    ['CHANTIER', plan.siteName || 'Non specifie'],
    ['ADRESSE', plan.address || 'Non specifiee'],
    ['DATE', new Date().toLocaleDateString('fr-FR')],
    ['TOTAL POINTS', String(plan.points.length)],
    ['STATUT', `A faire: ${statusCounts.a_faire} | En cours: ${statusCounts.en_cours} | Termine: ${statusCounts.termine}`],
  ];

  setFillColor(doc, palette.lightGray);
  doc.rect(margin, currentY - 5, contentWidth, infoRows.length * 8 + 5, 'F');

  setTextColor(doc, palette.dark);
  doc.setFontSize(10);

  infoRows.forEach(([label, value], index) => {
    const y = currentY + index * 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin + 3, y);
    doc.setFont('helvetica', 'normal');
    const labelWidth = doc.getTextWidth(`${label}:`);
    doc.text(value, margin + 5 + labelWidth, y);
  });

  currentY += infoRows.length * 8 + 15;

  // === VUE D'ENSEMBLE DU PLAN ===
  setTextColor(doc, palette.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('2. VUE D\'ENSEMBLE DU PLAN', margin, currentY);

  setDrawColor(doc, palette.secondary);
  doc.line(margin, currentY + 2, margin + 60, currentY + 2);

  currentY += 10;

  // Rendre le plan avec marqueurs
  let planImageWithMarkers = '';
  try {
    planImageWithMarkers = await renderPlanWithMarkers(plan);
  } catch {
    // ignore rendering failure
  }

  const planImgWidth = contentWidth;
  const planImgMaxHeight = pageHeight - currentY - 30;
  let planImgHeight = 100;

  try {
    const imgProps = doc.getImageProperties(planImageWithMarkers);
    const ratio = imgProps.width / imgProps.height;
    planImgHeight = planImgWidth / ratio;
    if (planImgHeight > planImgMaxHeight) {
      planImgHeight = planImgMaxHeight;
    }
  } catch {
    planImgHeight = 100;
  }

  // Ombre
  setFillColor(doc, [200, 200, 200]);
  doc.rect(margin + 1, currentY + 1, planImgWidth, planImgHeight, 'F');

  // Bordure
  setDrawColor(doc, palette.primary);
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY, planImgWidth, planImgHeight, 'S');

  if (planImageWithMarkers && planImageWithMarkers.length > 100) {
    try {
      doc.addImage(planImageWithMarkers, 'JPEG', margin + 1, currentY + 1, planImgWidth - 2, planImgHeight - 2);
    } catch {
      setTextColor(doc, palette.gray);
      doc.setFontSize(10);
      doc.text('Plan non disponible', margin + planImgWidth / 2 - 20, currentY + planImgHeight / 2);
    }
  } else {
    setTextColor(doc, palette.gray);
    doc.setFontSize(10);
    doc.text('Plan non disponible', margin + planImgWidth / 2 - 20, currentY + planImgHeight / 2);
  }

  // Legende
  currentY += planImgHeight + 5;
  setTextColor(doc, palette.gray);
  doc.setFontSize(8);

  const legendItems = [
    { color: statusColors.a_faire, label: 'A faire' },
    { color: statusColors.en_cours, label: 'En cours' },
    { color: statusColors.termine, label: 'Termine' },
  ];
  let legendX = margin;
  legendItems.forEach((item) => {
    setFillColor(doc, item.color);
    doc.circle(legendX + 3, currentY - 1, 2.5, 'F');
    setTextColor(doc, palette.dark);
    doc.text(item.label, legendX + 7, currentY);
    legendX += 35;
  });

  // === DETAIL DES POINTS (nouvelles pages) ===
  doc.addPage();
  currentY = margin;

  setTextColor(doc, palette.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('3. DETAIL DES POINTS D\'INSPECTION', margin, currentY);

  setDrawColor(doc, palette.secondary);
  doc.line(margin, currentY + 2, margin + 75, currentY + 2);

  currentY += 15;

  for (let i = 0; i < plan.points.length; i++) {
    const point = plan.points[i];
    const blockHeight = 75; // hauteur estimee d'un bloc point

    // Nouvelle page si necessaire
    if (currentY + blockHeight > pageHeight - 20) {
      doc.addPage();
      currentY = margin;
    }

    // Titre du point
    const pointStatusColor = statusColors[point.status] || palette.dark;
    setFillColor(doc, palette.primary);
    doc.rect(margin, currentY, contentWidth, 8, 'F');

    setTextColor(doc, palette.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Point #${point.pointNumber} — ${point.title}`, margin + 3, currentY + 5.5);

    // Badge statut dans le header
    const statusLabel = statusLabels[point.status] || point.status;
    const statusTextWidth = doc.getTextWidth(statusLabel) + 6;
    setFillColor(doc, pointStatusColor);
    doc.roundedRect(pageWidth - margin - statusTextWidth - 2, currentY + 1, statusTextWidth, 6, 1, 1, 'F');
    setTextColor(doc, point.status === 'en_cours' ? palette.dark : palette.white);
    doc.setFontSize(7);
    doc.text(statusLabel, pageWidth - margin - statusTextWidth + 1, currentY + 5);

    currentY += 12;

    // Photo + infos cote a cote
    const photoW = 55;
    const photoH = 42;
    const infoX = margin + photoW + 8;

    // Photo
    setDrawColor(doc, palette.lightGray);
    doc.setLineWidth(0.3);
    doc.rect(margin, currentY, photoW, photoH, 'S');

    try {
      const format = getImageFormat(point.photoDataUrl);
      if (format) {
        const imgProps = doc.getImageProperties(point.photoDataUrl);
        const ratio = imgProps.width / imgProps.height;
        let drawW = photoW - 2;
        let drawH = drawW / ratio;
        if (drawH > photoH - 2) {
          drawH = photoH - 2;
          drawW = drawH * ratio;
        }
        const px = margin + 1 + (photoW - 2 - drawW) / 2;
        const py = currentY + 1 + (photoH - 2 - drawH) / 2;
        doc.addImage(point.photoDataUrl, format, px, py, drawW, drawH);
      }
    } catch {
      setTextColor(doc, palette.gray);
      doc.setFontSize(8);
      doc.text('Photo N/A', margin + photoW / 2 - 8, currentY + photoH / 2);
    }

    // Infos a droite de la photo
    let infoY = currentY + 2;

    setTextColor(doc, palette.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Categorie:', infoX, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(categoryLabels[point.category] || point.category, infoX + doc.getTextWidth('Categorie: '), infoY);
    infoY += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', infoX, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(point.dateLabel, infoX + doc.getTextWidth('Date: '), infoY);
    infoY += 7;

    if (point.room) {
      doc.setFont('helvetica', 'bold');
      doc.text('Lieu:', infoX, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(point.room, infoX + doc.getTextWidth('Lieu: '), infoY);
      infoY += 7;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Statut:', infoX, infoY);
    setTextColor(doc, pointStatusColor);
    doc.text(statusLabel, infoX + doc.getTextWidth('Statut: '), infoY);
    infoY += 7;

    // Description sous la photo
    currentY += photoH + 4;

    if (point.description) {
      setFillColor(doc, [250, 250, 250]);
      const descLines = doc.splitTextToSize(point.description, contentWidth - 6);
      const descH = Math.max(8, descLines.length * 4.5 + 4);
      doc.rect(margin, currentY, contentWidth, descH, 'F');
      setDrawColor(doc, palette.lightGray);
      doc.rect(margin, currentY, contentWidth, descH, 'S');

      setTextColor(doc, palette.dark);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(descLines, margin + 3, currentY + 4);

      currentY += descH + 4;
    }

    // Separateur entre les points
    if (i < plan.points.length - 1) {
      setDrawColor(doc, palette.lightGray);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + 2, margin + contentWidth, currentY + 2);
      currentY += 8;
    }
  }

  // === RESUME ===
  currentY += 10;
  if (currentY + 50 > pageHeight - 20) {
    doc.addPage();
    currentY = margin;
  }

  setTextColor(doc, palette.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('4. RESUME', margin, currentY);

  setDrawColor(doc, palette.secondary);
  doc.line(margin, currentY + 2, margin + 30, currentY + 2);

  currentY += 12;

  setFillColor(doc, palette.lightGray);
  doc.rect(margin, currentY - 3, contentWidth, 35, 'F');

  setTextColor(doc, palette.dark);
  doc.setFontSize(10);

  doc.setFont('helvetica', 'bold');
  doc.text(`Total points: ${plan.points.length}`, margin + 5, currentY + 2);

  currentY += 8;

  const summaryItems = [
    { label: 'A faire', count: statusCounts.a_faire, color: statusColors.a_faire },
    { label: 'En cours', count: statusCounts.en_cours, color: statusColors.en_cours },
    { label: 'Termine', count: statusCounts.termine, color: statusColors.termine },
  ];

  doc.setFontSize(9);
  summaryItems.forEach((item) => {
    setFillColor(doc, item.color);
    doc.circle(margin + 7, currentY - 1, 2, 'F');
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, palette.dark);
    const pct = plan.points.length > 0 ? Math.round((item.count / plan.points.length) * 100) : 0;
    doc.text(`${item.label}: ${item.count} (${pct}%)`, margin + 12, currentY);
    currentY += 6;
  });

  // Repartition par categorie
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setTextColor(doc, palette.dark);
  doc.text('Par categorie:', margin + 5, currentY);
  currentY += 6;

  const categoryCounts: Record<string, number> = {};
  plan.points.forEach((p) => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    doc.text(`${categoryLabels[cat] || cat}: ${count}`, margin + 12, currentY);
    currentY += 5;
  });

  // === FOOTER SUR TOUTES LES PAGES ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setFillColor(doc, palette.primary);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');

    setTextColor(doc, palette.white);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `Document genere par ${productName} - Page ${i}/${totalPages} - Confidentialite strictement reservee`,
      margin,
      pageHeight - 3
    );
    doc.text(plan.siteName || '', pageWidth - margin, pageHeight - 3, { align: 'right' });
  }

  // Return blob instead of saving
  const filename = `Plan_${(plan.siteName || 'Chantier').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  const blob = doc.output('blob');
  return { blob, filename };
};
