const MAX_EDGE = 1920;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.86;
const MIN_FILE_SIZE_TO_OPTIMIZE = 900 * 1024;

const supportsWebP = (): boolean => {
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire l’image'));
    };
    image.src = url;
  });

const blobToFile = (blob: Blob, original: File): File => {
  const baseName = original.name.replace(/\.[^.]+$/, '');
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${baseName}.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
};

export async function optimizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size < MIN_FILE_SIZE_TO_OPTIMIZE) return file;

  const image = await loadImage(file);
  const ratio = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * ratio));
  const targetHeight = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) return file;

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const mimeType = supportsWebP() ? 'image/webp' : 'image/jpeg';
  const quality = mimeType === 'image/webp' ? WEBP_QUALITY : JPEG_QUALITY;

  const optimizedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });

  if (!optimizedBlob) return file;
  if (optimizedBlob.size >= file.size * 0.95) return file;

  return blobToFile(optimizedBlob, file);
}
