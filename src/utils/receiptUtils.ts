import { ReceiptAttachment } from '../types';

/**
 * Generates a unique attachment identifier
 */
export function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Formats file size in bytes to a human-readable string (KB, MB)
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Normalizes an item's attachments array, handling legacy receiptImage / receiptImageName fields seamlessly.
 */
export function normalizeAttachments(item: {
  attachments?: ReceiptAttachment[];
  receiptImage?: string;
  receiptImageName?: string;
}): ReceiptAttachment[] {
  if (Array.isArray(item.attachments) && item.attachments.length > 0) {
    return item.attachments;
  }
  if (item.receiptImage) {
    return [
      {
        id: generateAttachmentId(),
        url: item.receiptImage,
        name: item.receiptImageName || 'Receipt Image',
        uploadedAt: new Date().toISOString(),
      },
    ];
  }
  return [];
}

/**
 * Optimizes an uploaded receipt/invoice image to keep storage efficient
 * while preserving high readability for invoice numbers, dates, and amounts.
 */
export async function processReceiptImage(
  file: File,
  maxDimension = 1400,
  quality = 0.8
): Promise<ReceiptAttachment> {
  return new Promise((resolve, reject) => {
    // If SVG or small vector, read directly
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: generateAttachmentId(),
          url: reader.result as string,
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale down if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original data URL if canvas context unavailable
          resolve({
            id: generateAttachmentId(),
            url: e.target?.result as string,
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          });
          return;
        }

        // Draw image with smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to jpeg
        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({
            id: generateAttachmentId(),
            url: compressedDataUrl,
            name: file.name,
            size: Math.round((compressedDataUrl.length * 3) / 4), // Approximate bytes from base64
            uploadedAt: new Date().toISOString(),
          });
        } catch {
          resolve({
            id: generateAttachmentId(),
            url: e.target?.result as string,
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          });
        }
      };

      img.onerror = () => reject(new Error('Failed to parse image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Processes multiple files in parallel and returns an array of ReceiptAttachments
 */
export async function processReceiptImages(
  files: File[] | FileList,
  maxDimension = 1400,
  quality = 0.8
): Promise<ReceiptAttachment[]> {
  const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (fileArray.length === 0) return [];
  const results = await Promise.all(
    fileArray.map((file) => processReceiptImage(file, maxDimension, quality))
  );
  return results;
}
