export type SupportedFileSource = 'image' | 'pdf';

type FileConversionErrorCode =
  | 'unsupported_format'
  | 'pdf_protected'
  | 'pdf_invalid'
  | 'pdf_too_large'
  | 'conversion_failed';

export class FileConversionError extends Error {
  code: FileConversionErrorCode;

  constructor(code: FileConversionErrorCode, message: string) {
    super(message);
    this.name = 'FileConversionError';
    this.code = code;
  }
}

export const getFileConversionErrorMessage = (error: unknown) => {
  if (error instanceof FileConversionError) {
    return error.message;
  }
  return 'Impossible de traiter ce fichier. Essayez un autre PDF/image.';
};

const hasPdfSignature = (bytes: Uint8Array) => {
  if (bytes.length < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
};

const hasImageSignature = (bytes: Uint8Array) => {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a;
  const isWebp = bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
  return isJpeg || isPng || isWebp;
};

const detectSupportedSource = async (file: File): Promise<SupportedFileSource | null> => {
  const lowerName = file.name.toLowerCase();
  if (
    file.type === 'application/pdf'
    || file.type === 'application/x-pdf'
    || file.type === 'application/acrobat'
    || file.type === 'application/vnd.pdf'
    || file.type === 'text/pdf'
    || lowerName.endsWith('.pdf')
  ) {
    return 'pdf';
  }
  if (file.type.startsWith('image/')) return 'image';

  try {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (hasPdfSignature(bytes)) return 'pdf';
    if (hasImageSignature(bytes)) return 'image';
  } catch {
    return null;
  }

  return null;
};

const imageFileToDataUrl = (file: File, maxW = 2000, maxH = 2000, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Impossible de lire l\'image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image'));
    reader.readAsDataURL(file);
  });
};

const renderPdfWithEngine = async (
  pdfjs: { getDocument: any; GlobalWorkerOptions: any },
  workerUrl: string,
  data: Uint8Array,
  maxW: number,
  maxH: number,
  quality: number
) => {
  const { getDocument, GlobalWorkerOptions } = pdfjs;

  const loadPdf = async (useWorker: boolean) => {
    if (useWorker && GlobalWorkerOptions.workerSrc !== workerUrl) {
      GlobalWorkerOptions.workerSrc = workerUrl;
    }
    const loadingTask = getDocument({
      data,
      disableWorker: !useWorker,
    } as any);
    return loadingTask.promise;
  };

  let pdf: any;
  try {
    pdf = await loadPdf(true);
  } catch (error: any) {
    const errName = String(error?.name || '');
    if (errName.includes('Password')) {
      throw new FileConversionError('pdf_protected', 'Ce PDF est protege par mot de passe. Utilisez un PDF non protege.');
    }
    try {
      pdf = await loadPdf(false);
    } catch {
      throw new FileConversionError('pdf_invalid', 'PDF invalide ou illisible. Essayez un autre fichier.');
    }
  }

  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });

    const viewportWidth = Math.max(1, baseViewport.width || 1);
    const viewportHeight = Math.max(1, baseViewport.height || 1);
    const maxPixels = 6_000_000;
    const pixelScale = Math.sqrt(maxPixels / (viewportWidth * viewportHeight));
    const rawScale = Math.min(maxW / viewportWidth, maxH / viewportHeight, pixelScale, 2.5);
    const initialScale = Math.max(0.01, Number.isFinite(rawScale) ? rawScale : 1);
    const renderScales = [
      initialScale,
      initialScale * 0.75,
      initialScale * 0.55,
      initialScale * 0.4,
      initialScale * 0.28,
    ].map((s) => Math.max(0.01, s));

    for (const scale of renderScales) {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }

      try {
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        return canvas.toDataURL('image/jpeg', quality);
      } catch (renderError: any) {
        const msg = String(renderError?.message || '').toLowerCase();
        const looksLikeMemoryIssue =
          msg.includes('canvas')
          || msg.includes('memory')
          || msg.includes('allocate')
          || msg.includes('size');

        if (!looksLikeMemoryIssue) {
          throw renderError;
        }
      }
    }

    throw new FileConversionError('pdf_too_large', 'PDF trop lourd. Essayez un PDF plus leger ou exportez la page en image.');
  } catch (error: any) {
    if (error instanceof FileConversionError) {
      throw error;
    }

    const message = String(error?.message || '').toLowerCase();
    if (message.includes('canvas') || message.includes('memory') || message.includes('size')) {
      throw new FileConversionError('pdf_too_large', 'PDF trop lourd. Essayez un PDF plus leger ou exportez la page en image.');
    }
    throw new FileConversionError('conversion_failed', 'Impossible de convertir ce PDF. Essayez un autre fichier.');
  } finally {
    pdf.cleanup();
    pdf.destroy();
  }
};

const pdfFileToDataUrl = async (file: File, maxW = 2200, maxH = 2200, quality = 0.85): Promise<string> => {
  const data = new Uint8Array(await file.arrayBuffer());

  try {
    const [pdfjs, workerModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);
    return await renderPdfWithEngine(pdfjs as any, workerModule.default, data, maxW, maxH, quality);
  } catch (primaryError) {
    if (primaryError instanceof FileConversionError && primaryError.code === 'pdf_protected') {
      throw primaryError;
    }

    try {
      const [legacyPdfjs, legacyWorkerModule] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
      ]);
      return await renderPdfWithEngine(legacyPdfjs as any, legacyWorkerModule.default, data, maxW, maxH, quality);
    } catch (legacyError) {
      if (legacyError instanceof FileConversionError) {
        throw legacyError;
      }
      throw new FileConversionError('conversion_failed', 'Impossible de convertir ce PDF. Essayez un autre fichier ou exportez la page en image.');
    }
  }
};

export const normalizeFileToImageDataUrl = async (
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<{ dataUrl: string; sourceType: SupportedFileSource }> => {
  const sourceType = await detectSupportedSource(file);
  if (!sourceType) {
    throw new FileConversionError('unsupported_format', 'Format non supporte. Importez une image (JPG/PNG) ou un PDF.');
  }

  const dataUrl = sourceType === 'pdf'
    ? await pdfFileToDataUrl(file, options?.maxWidth, options?.maxHeight, options?.quality)
    : await imageFileToDataUrl(file, options?.maxWidth, options?.maxHeight, options?.quality);

  return { dataUrl, sourceType };
};

export const normalizeFileToImageFile = async (
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<{ file: File; sourceType: SupportedFileSource }> => {
  const sourceType = await detectSupportedSource(file);
  if (!sourceType) {
    throw new FileConversionError('unsupported_format', 'Format non supporte. Importez une image (JPG/PNG) ou un PDF.');
  }

  if (sourceType === 'image') {
    return { file, sourceType };
  }

  const { dataUrl } = await normalizeFileToImageDataUrl(file, options);
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const outputName = file.name.replace(/\.pdf$/i, '') || 'plan';
  const converted = new File([blob], `${outputName}.webp`, { type: 'image/webp' });

  return { file: converted, sourceType: 'pdf' };
};
