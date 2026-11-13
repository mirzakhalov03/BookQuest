const DEFAULT_MAX_SIDE = 1000;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Shrinks a picked image to at most 1000px on its longest side, as WebP. Covers
 * show ~200px wide, so a phone photo would otherwise cost megabytes on Home.
 * Falls back to the original when the browser can't decode it; the server still validates.
 */
export async function downscaleImage(file: File, maxSide = DEFAULT_MAX_SIDE): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // Browsers that can't encode WebP silently return PNG, which is larger; use JPEG there (on white, it has no alpha).
  let blob = await encode(canvas, 'image/webp', WEBP_QUALITY);
  if (blob?.type !== 'image/webp') {
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    blob = await encode(canvas, 'image/jpeg', JPEG_QUALITY);
  }
  bitmap.close();

  // Never trade a small original for a bigger re-encode.
  if (!blob || (scale === 1 && blob.size >= file.size)) return file;
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type });
}
