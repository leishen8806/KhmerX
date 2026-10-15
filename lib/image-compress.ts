const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.8;
const IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const PDF_LIMIT_BYTES = 10 * 1024 * 1024;

export function isPdf(file: Blob): boolean {
  return file.type.toLowerCase() === 'application/pdf';
}

export function fileLimitBytes(file: Blob): number {
  return isPdf(file) ? PDF_LIMIT_BYTES : IMAGE_LIMIT_BYTES;
}

export function fileLimitLabel(file: Blob): string {
  return isPdf(file) ? '10 MB' : '5 MB';
}

export function fitWithinBounds(width: number, height: number, maxEdge = MAX_IMAGE_EDGE): {width: number; height: number} {
  if (width <= maxEdge && height <= maxEdge) return {width, height};
  const scale = maxEdge / Math.max(width, height);
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片无法读取，请重新选择')); };
    image.src = url;
  });
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, {imageOrientation: 'from-image'}); } catch { /* fallback below */ }
  }
  return loadImageElement(file);
}

/** Compresses browser images to an EXIF-orientation-aware JPEG; PDFs are returned unchanged. */
export async function prepareKycFile(file: File): Promise<File> {
  if (isPdf(file)) return file;
  const image = await loadImage(file);
  const dimensions = fitWithinBounds(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持图片处理，请稍后重试');
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  if ('close' in image && typeof image.close === 'function') image.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('图片压缩失败，请重新选择');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg', lastModified: file.lastModified});
}

export function retryAfterMs(error: unknown, attempt: number): number {
  const candidate = error as {retryAfter?: number; retryAfterSeconds?: number; response?: Response};
  const header = candidate.response?.headers.get('retry-after');
  const seconds = candidate.retryAfterSeconds ?? candidate.retryAfter ?? (header ? Number(header) : NaN);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(5000, seconds * 1000);
  return Math.min(5000, 500 * (2 ** attempt) + Math.floor(Math.random() * 250));
}

export const IMAGE_MAX_EDGE = MAX_IMAGE_EDGE;
export const JPEG_QUALITY_HINT = JPEG_QUALITY;
