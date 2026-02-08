import { jsPDF } from 'jspdf';
import { ApiPlan } from './api';
import { branding } from '../config/branding';

// ========================================
// PALETTE & CONFIG
// ========================================
const PALETTE = {
  primary: [26, 54, 93],
  secondary: [201, 162, 99],
  accent: [220, 53, 69],
  success: [40, 167, 69],
  warning: [255, 193, 7],
  info: [23, 162, 184],
  dark: [33, 37, 41],
  gray: [108, 117, 125],
  lightGray: [233, 236, 239],
  lighterGray: [248, 249, 250],
  white: [255, 255, 255],
  shadow: [180, 180, 180],
} as const;

const STATUS = {
  a_faire: { label: 'À faire', color: [220, 53, 69] },
  en_cours: { label: 'En cours', color: [255, 193, 7] },
  termine: { label: 'Terminé', color: [40, 167, 69] },
} as const;

const CATEGORIES: Record<string, { label: string; color: number[] }> = {
  radiateur: { label: 'Radiateur', color: [220, 53, 69] },
  electricite: { label: 'Électricité', color: [255, 193, 7] },
  defaut: { label: 'Défaut', color: [220, 53, 69] },
  validation: { label: 'Validation', color: [40, 167, 69] },
  plomberie: { label: 'Plomberie', color: [23, 162, 184] },
  maconnerie: { label: 'Maçonnerie', color: [108, 117, 125] },
  menuiserie: { label: 'Menuiserie', color: [201, 162, 99] },
  autre: { label: 'Autre', color: [108, 117, 125] },
};

// Helpers
const setFill = (doc: jsPDF, c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | null => {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return null;
};

// ========================================
// CANVAS: RENDU DU PLAN AVEC MARQUEURS
// ========================================
const renderPlanWithMarkers = (plan: ApiPlan): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxWidth = 2400;
      const scale = Math.min(1, maxWidth / img.width);
      
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      
      const ctx = canvas.getContext('2d')!;
      
      // Fond blanc
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Plan
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Marqueurs
      const baseSize = Math.max(20, canvas.width * 0.02);
      const sortedPoints = [...plan.points].sort((a, b) => a.pointNumber - b.pointNumber);
      
      for (const point of sortedPoints) {
        const x = (point.positionX / 100) * canvas.width;
        const y = (point.positionY / 100) * canvas.height;
        const color = STATUS[point.status as keyof typeof STATUS]?.color || STATUS.a_faire.color;
        const colorStr = `rgb(${color[0]},${color[1]},${color[2]})`;
        
        drawPremiumMarker(ctx, x, y, point.pointNumber, colorStr, baseSize);
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    
    img.onerror = () => resolve('');
    img.src = plan.imageDataUrl;
  });
};

const drawPremiumMarker = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  number: number,
  color: string,
  size: number
) => {
  const w = size * 1.5;
  const h = size * 2;
  
  ctx.save();
  
  // Ombre
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.4;
  ctx.shadowOffsetX = size * 0.15;
  ctx.shadowOffsetY = size * 0.2;
  
  // Forme goutte (pin)
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.45);
  ctx.bezierCurveTo(x + w * 0.5, y - h * 0.45, x + w * 0.55, y + h * 0.15, x, y + h * 0.55);
  ctx.bezierCurveTo(x - w * 0.55, y + h * 0.15, x - w * 0.5, y - h * 0.45, x, y - h * 0.45);
  ctx.closePath();
  
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  
  // Bordure blanche
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.12;
  ctx.stroke();
  
  // Cercle blanc intérieur
  ctx.beginPath();
  ctx.arc(x, y - h * 0.1, size * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  
  // Numéro
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size * 0.5)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), x, y - h * 0.1);
};

// ========================================
// COMPOSANTS PDF RÉUTILISABLES
// ========================================

interface LayoutContext {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
}

const drawHeader = (ctx: LayoutContext, subtitle?: string) => {
  const { doc, pageWidth, margin } = ctx;
  
  // Bandeau
  setFill(doc, PALETTE.primary);
  doc.rect(0, 0, pageWidth, 28, 'F');
  
  // Ligne dorée
  setFill(doc, PALETTE.secondary);
  doc.rect(0, 28, pageWidth, 1.5, 'F');
  
  // Logo
  setText(doc, PALETTE.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('SITEFLOW', margin, 18);
  
  // Sous-titre
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle, margin, 24);
  }
  
  // Date
  setText(doc, PALETTE.secondary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    pageWidth - margin,
    18,
    { align: 'right' }
  );
  
  return 40; // Y de départ après header
};

const drawFooter = (ctx: LayoutContext, currentPage: number, totalPages: number, _siteName: string) => {
  const { doc, pageWidth, pageHeight, margin } = ctx;
  
  const footerY = pageHeight - 10;
  
  // Bandeau
  setFill(doc, PALETTE.primary);
  doc.rect(0, footerY - 1, pageWidth, 11, 'F');
  
  // Ligne dorée
  setFill(doc, PALETTE.secondary);
  doc.rect(0, footerY - 1, pageWidth, 1, 'F');
  
  // Texte
  setText(doc, PALETTE.white);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `${branding.productName || 'SiteFlow Pro'} - Document confidentiel - Page ${currentPage}/${totalPages}`,
    margin,
    footerY + 5
  );
  doc.text(
    `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
    pageWidth - margin,
    footerY + 5,
    { align: 'right' }
  );
};

const drawCard = (
  ctx: LayoutContext,
  x: number,
  y: number,
  width: number,
  height: number,
  accentColor: readonly number[]
) => {
  const { doc } = ctx;
  
  // Ombre
  setFill(doc, PALETTE.shadow);
  doc.roundedRect(x + 0.5, y + 0.5, width, height, 3, 3, 'F');
  
  // Fond
  setFill(doc, PALETTE.white);
  setDraw(doc, PALETTE.lightGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 3, 3, 'FD');
  
  // Accent gauche
  setFill(doc, accentColor);
  doc.roundedRect(x, y, 3, height, 1.5, 1.5, 'F');
};

const drawBadge = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  bgColor: readonly number[],
  textColor: readonly number[] = PALETTE.white
) => {
  doc.setFontSize(8);
  const padding = 3;
  const textWidth = doc.getTextWidth(text);
  const width = textWidth + padding * 2;
  const height = 10;
  
  setFill(doc, bgColor);
  doc.roundedRect(x, y - height + 3, width, height, 2, 2, 'F');
  
  setText(doc, textColor);
  doc.text(text, x + padding, y);
  
  return width;
};

const drawProgressBar = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  value: number,
  color: readonly number[]
) => {
  const height = 6;
  
  // Fond
  setFill(doc, PALETTE.lightGray);
  doc.roundedRect(x, y, width, height, height / 2, height / 2, 'F');
  
  // Barre
  if (value > 0) {
    setFill(doc, color);
    const barWidth = Math.max(height, (value / 100) * width);
    doc.roundedRect(x, y, barWidth, height, height / 2, height / 2, 'F');
  }
};

const drawSectionTitle = (
  doc: jsPDF,
  x: number,
  y: number,
  title: string,
  lineWidth: number = 60
) => {
  setText(doc, PALETTE.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, x, y);
  
  setDraw(doc, PALETTE.secondary);
  doc.setLineWidth(0.8);
  doc.line(x, y + 2, x + lineWidth, y + 2);
  
  return y + 10;
};

// ========================================
// GÉNÉRATION PRINCIPALE
// ========================================

export const generatePlanPDFPremium = async (plan: ApiPlan): Promise<{ blob: Blob; filename: string }> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  
  const ctx: LayoutContext = {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin: 18,
    get contentWidth() { return this.pageWidth - this.margin * 2; }
  };
  
  // Stats
  const statusCounts = { a_faire: 0, en_cours: 0, termine: 0 };
  const categoryCounts: Record<string, number> = {};
  
  plan.points.forEach((p) => {
    statusCounts[p.status as keyof typeof statusCounts]++;
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });
  
  const completionRate = plan.points.length > 0 
    ? Math.round((statusCounts.termine / plan.points.length) * 100) 
    : 0;
  
  const siteName = plan.siteName || 'Chantier sans nom';
  
  // ========================================
  // PAGE 1: COUVERTURE
  // ========================================
  let y = drawHeader(ctx, "Rapport d'Inspection Professionnel");
  
  // Titre chantier
  setText(doc, PALETTE.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(siteName, ctx.margin, y);
  y += 8;
  
  // Adresse
  if (plan.address) {
    setText(doc, PALETTE.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(plan.address, ctx.margin, y);
    y += 10;
  } else {
    y += 4;
  }
  
  // Cartes stats
  const cardWidth = (ctx.contentWidth - 8) / 3;
  const cardHeight = 24;
  
  const stats = [
    { label: 'Points totals', value: plan.points.length, color: PALETTE.primary },
    { label: 'À faire', value: statusCounts.a_faire, color: STATUS.a_faire.color },
    { label: 'Terminés', value: statusCounts.termine, color: STATUS.termine.color },
  ];
  
  stats.forEach((stat, i) => {
    const x = ctx.margin + i * (cardWidth + 4);
    drawCard(ctx, x, y, cardWidth, cardHeight, stat.color);
    
    // Valeur
    setText(doc, stat.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(String(stat.value), x + 8, y + 15);
    
    // Label
    setText(doc, PALETTE.gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(stat.label, x + 8, y + 21);
  });
  
  y += cardHeight + 10;
  
  // Barre progression
  setText(doc, PALETTE.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Avancement global: ${completionRate}%`, ctx.margin, y);
  y += 5;
  
  drawProgressBar(doc, ctx.margin, y, ctx.contentWidth, completionRate, STATUS.termine.color);
  y += 14;
  
  // Section plan
  y = drawSectionTitle(doc, ctx.margin, y, "VUE D'ENSEMBLE DU PLAN", 65);
  
  // Image plan
  const planImage = await renderPlanWithMarkers(plan);
  
  if (planImage) {
    const maxHeight = ctx.pageHeight - y - ctx.margin - 12;
    let imgHeight = 100;
    let imgWidth = ctx.contentWidth;
    
    try {
      const props = doc.getImageProperties(planImage);
      const ratio = props.width / props.height;
      imgHeight = imgWidth / ratio;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight * ratio;
      }
    } catch {}
    
    // Centrer si plus petit
    const imgX = ctx.margin + (ctx.contentWidth - imgWidth) / 2;
    
    // Ombre
    setFill(doc, PALETTE.shadow);
    doc.roundedRect(imgX + 1, y + 1, imgWidth, imgHeight, 4, 4, 'F');
    
    // Bordure
    setDraw(doc, PALETTE.primary);
    doc.setLineWidth(0.8);
    doc.roundedRect(imgX, y, imgWidth, imgHeight, 4, 4, 'S');
    
    // Image
    doc.addImage(planImage, 'JPEG', imgX + 1, y + 1, imgWidth - 2, imgHeight - 2);
    
    // Légende
    const legendW = 50;
    const legendX = imgX + imgWidth - legendW - 6;
    const legendY = y + imgHeight - 14;
    
    setFill(doc, [...PALETTE.white, 0.95]);
    doc.roundedRect(legendX - 3, legendY - 3, legendW, 12, 2, 2, 'F');
    
    let lx = legendX;
    [
      { c: STATUS.a_faire.color, l: 'À faire' },
      { c: STATUS.en_cours.color, l: 'En cours' },
      { c: STATUS.termine.color, l: 'Terminé' },
    ].forEach((item) => {
      setFill(doc, item.c);
      doc.circle(lx + 2, legendY + 3, 2.5, 'F');
      setText(doc, PALETTE.dark);
      doc.setFontSize(7);
      doc.text(item.l, lx + 6, legendY + 4);
      lx += 16;
    });
    
    y += imgHeight + 5;
  }
  
  // ========================================
  // PAGE 2: STATISTIQUES
  // ========================================
  doc.addPage();
  y = ctx.margin + 4;
  
  // Header simple
  setFill(doc, PALETTE.primary);
  doc.rect(0, 0, ctx.pageWidth, 12, 'F');
  setText(doc, PALETTE.white);
  doc.setFontSize(8);
  doc.text(`${branding.productName || 'SiteFlow Pro'} - Rapport de Plan`, ctx.margin, 8);
  doc.text(siteName, ctx.pageWidth - ctx.margin, 8, { align: 'right' });
  
  y += 8;
  y = drawSectionTitle(doc, ctx.margin, y, 'STATISTIQUES DÉTAILLÉES', 55);
  
  // Deux colonnes
  const colW = (ctx.contentWidth - 10) / 2;
  
  // Colonne gauche: Statuts
  let leftY = y;
  setText(doc, PALETTE.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Par statut', ctx.margin, leftY);
  leftY += 8;
  
  // Barres statuts
  const statusData = [
    { key: 'a_faire', ...STATUS.a_faire },
    { key: 'en_cours', ...STATUS.en_cours },
    { key: 'termine', ...STATUS.termine },
  ];
  
  statusData.forEach((s) => {
    const count = statusCounts[s.key as keyof typeof statusCounts];
    
    // Label
    setText(doc, PALETTE.dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(s.label, ctx.margin, leftY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${count}`, ctx.margin + colW - 15, leftY, { align: 'right' });
    
    leftY += 4;
    
    // Barre
    setFill(doc, PALETTE.lightGray);
    doc.roundedRect(ctx.margin, leftY, colW - 2, 8, 4, 4, 'F');
    
    if (count > 0) {
      setFill(doc, s.color);
      const barW = ((colW - 2) * count) / Math.max(plan.points.length, 1);
      doc.roundedRect(ctx.margin, leftY, barW, 8, 4, 4, 'F');
    }
    
    leftY += 14;
  });
  
  // Colonne droite: Catégories
  let rightY = y;
  const rightX = ctx.margin + colW + 10;
  
  setText(doc, PALETTE.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Par catégorie', rightX, rightY);
  rightY += 10;
  
  Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => {
      if (rightY > ctx.pageHeight - ctx.margin - 20) return;
      
      const catInfo = CATEGORIES[cat] || { label: cat, color: PALETTE.gray };
      const pct = Math.round((count / plan.points.length) * 100);
      
      // Puce
      setFill(doc, catInfo.color);
      doc.circle(rightX + 3, rightY + 2, 2.5, 'F');
      
      // Label
      setText(doc, PALETTE.dark);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(catInfo.label, rightX + 8, rightY + 3);
      
      // Nombre
      doc.setFont('helvetica', 'bold');
      doc.text(`${count} (${pct}%)`, rightX + colW - 5, rightY + 3, { align: 'right' });
      
      rightY += 8;
    });
  
  // ========================================
  // PAGES POINTS
  // ========================================
  
  if (plan.points.length === 0) {
    doc.addPage();
    setText(doc, PALETTE.gray);
    doc.setFontSize(12);
    doc.text('Aucun point d\'inspection.', ctx.margin, ctx.margin + 20);
  } else {
    const sortedPoints = [...plan.points].sort((a, b) => a.pointNumber - b.pointNumber);
    const pointsPerPage = 2;
    const totalPointPages = Math.ceil(sortedPoints.length / pointsPerPage);
    
    for (let pageIdx = 0; pageIdx < totalPointPages; pageIdx++) {
      doc.addPage();
      
      // Header
      setFill(doc, PALETTE.primary);
      doc.rect(0, 0, ctx.pageWidth, 12, 'F');
      setText(doc, PALETTE.white);
      doc.setFontSize(8);
      doc.text(`${branding.productName || 'SiteFlow Pro'} - Détail des points`, ctx.margin, 8);
      doc.text(`Page ${pageIdx + 1}/${totalPointPages}`, ctx.pageWidth - ctx.margin, 8, { align: 'right' });
      
      y = 22;
      
      // Titre section (première page uniquement)
      if (pageIdx === 0) {
        y = drawSectionTitle(doc, ctx.margin, y, 'DÉTAIL DES POINTS', 45);
      }
      
      const pagePoints = sortedPoints.slice(pageIdx * pointsPerPage, (pageIdx + 1) * pointsPerPage);
      
      pagePoints.forEach((point, idx) => {
        const cardH = 108;
        
        // Vérifier espace
        if (y + cardH > ctx.pageHeight - ctx.margin - 10) {
          doc.addPage();
          y = 18;
        }
        
        // === CARTE ===
        
        // Ombre
        setFill(doc, PALETTE.shadow);
        doc.roundedRect(ctx.margin + 0.5, y + 0.5, ctx.contentWidth, cardH, 5, 5, 'F');
        
        // Fond
        setFill(doc, PALETTE.white);
        setDraw(doc, PALETTE.lightGray);
        doc.setLineWidth(0.3);
        doc.roundedRect(ctx.margin, y, ctx.contentWidth, cardH, 5, 5, 'FD');
        
        // Header coloré
        const statusInfo = STATUS[point.status as keyof typeof STATUS] || STATUS.a_faire;
        setFill(doc, statusInfo.color);
        doc.roundedRect(ctx.margin, y, ctx.contentWidth, 16, 5, 5, 'F');
        // Correction: masquer les coins du bas pour rectangle arrondi haut uniquement
        setFill(doc, statusInfo.color);
        doc.rect(ctx.margin, y + 10, ctx.contentWidth, 6, 'F');
        
        // Badge numéro
        setFill(doc, PALETTE.white);
        doc.circle(ctx.margin + 12, y + 9, 8, 'F');
        setText(doc, statusInfo.color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(String(point.pointNumber), ctx.margin + 12, y + 12, { align: 'center' });
        
        // Titre
        setText(doc, PALETTE.white);
        doc.setFontSize(11);
        const titleX = ctx.margin + 26;
        const maxTitleW = ctx.contentWidth - 70;
        const title = doc.splitTextToSize(point.title, maxTitleW)[0];
        doc.text(title, titleX, y + 10);
        
        // Badge statut
        const badgeW = doc.getTextWidth(statusInfo.label) + 10;
        setFill(doc, PALETTE.white);
        doc.roundedRect(ctx.margin + ctx.contentWidth - badgeW - 6, y + 3, badgeW, 11, 2, 2, 'F');
        setText(doc, point.status === 'en_cours' ? PALETTE.dark : statusInfo.color);
        doc.setFontSize(8);
        doc.text(statusInfo.label, ctx.margin + ctx.contentWidth - badgeW / 2 - 6, y + 10, { align: 'center' });
        
        let innerY = y + 22;
        
        // === PHOTO (gauche) ===
        const photoW = 70;
        const photoH = 58;
        
        setFill(doc, PALETTE.lighterGray);
        doc.roundedRect(ctx.margin + 4, innerY - 2, photoW + 4, photoH + 4, 3, 3, 'F');
        
        try {
          const format = getImageFormat(point.photoDataUrl);
          if (format) {
            const props = doc.getImageProperties(point.photoDataUrl);
            const ratio = props.width / props.height;
            
            let dw = photoW - 4;
            let dh = dw / ratio;
            if (dh > photoH - 4) {
              dh = photoH - 4;
              dw = dh * ratio;
            }
            
            const px = ctx.margin + 6 + (photoW - dw) / 2;
            const py = innerY + (photoH - dh) / 2;
            
            doc.addImage(point.photoDataUrl, format, px, py, dw, dh);
          }
        } catch {}
        
        // Bordure photo
        setDraw(doc, PALETTE.lightGray);
        doc.setLineWidth(0.5);
        doc.roundedRect(ctx.margin + 4, innerY - 2, photoW + 4, photoH + 4, 3, 3, 'S');
        
        // === INFOS (droite) ===
        const infoX = ctx.margin + photoW + 14;
        let infoY = innerY + 4;
        
        // Catégorie
        const catInfo = CATEGORIES[point.category] || { label: point.category, color: PALETTE.gray };
        drawBadge(doc, catInfo.label, infoX, infoY + 5, catInfo.color);
        infoY += 16;
        
        // Date
        setText(doc, PALETTE.gray);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('DATE', infoX, infoY);
        infoY += 5;
        setText(doc, PALETTE.dark);
        doc.setFontSize(9);
        doc.text(point.dateLabel, infoX, infoY);
        infoY += 12;
        
        // Emplacement
        if (point.room) {
          setText(doc, PALETTE.gray);
          doc.setFontSize(7);
          doc.text('EMPLACEMENT', infoX, infoY);
          infoY += 5;
          setText(doc, PALETTE.dark);
          doc.setFontSize(9);
          doc.text(point.room, infoX, infoY);
          infoY += 12;
        }
        
        // === DESCRIPTION (bas) ===
        innerY += photoH + 6;
        
        if (point.description) {
          setText(doc, PALETTE.gray);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text('DESCRIPTION', ctx.margin + 6, innerY);
          innerY += 5;
          
          const lines = doc.splitTextToSize(point.description, ctx.contentWidth - 14);
          const lineCount = Math.min(lines.length, 3);
          const descH = lineCount * 4 + 4;
          
          setFill(doc, PALETTE.lighterGray);
          doc.roundedRect(ctx.margin + 4, innerY - 3, ctx.contentWidth - 8, descH, 3, 3, 'F');
          
          setText(doc, PALETTE.dark);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(lines.slice(0, lineCount), ctx.margin + 7, innerY + 2);
        }
        
        // Séparateur
        if (idx < pagePoints.length - 1) {
          y += cardH + 8;
          setDraw(doc, PALETTE.lightGray);
          doc.setLineWidth(0.2);
          doc.setLineDashPattern([3, 3], 0);
          doc.line(ctx.margin + 20, y - 4, ctx.pageWidth - ctx.margin - 20, y - 4);
          doc.setLineDashPattern([], 0);
        } else {
          y += cardH + 8;
        }
      });
    }
  }
  
  // ========================================
  // FOOTERS
  // ========================================
  const totalPages = doc.getNumberOfPages();
  
  // Page 1 avec header spécial
  doc.setPage(1);
  drawFooter(ctx, 1, totalPages, siteName);
  
  // Autres pages
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(ctx, i, totalPages, siteName);
  }
  
  // Export
  const filename = `Plan_${siteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  return { blob: doc.output('blob'), filename };
};
