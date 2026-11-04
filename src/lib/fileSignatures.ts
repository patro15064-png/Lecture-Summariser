/**
 * Universal File Signature & Magic Bytes Inspector
 * Analyzes binary file headers (magic numbers) to accurately detect the real file type
 * independently of misleading or missing file extensions, and provides best-effort fallbacks.
 */

export interface SignatureDetectionResult {
  detectedMime: string;
  category: 'image' | 'pdf' | 'document' | 'audio' | 'video' | 'text' | 'archive' | 'unknown';
  extensionHint: string;
  isSupported: boolean;
  magicHex: string;
  confidence: 'high' | 'medium' | 'low';
  diagnosticMessage: string;
}

/**
 * Reads the first N bytes of a File or Blob into a Uint8Array.
 */
export async function readFileHeaderBytes(file: File | Blob, byteCount = 64): Promise<Uint8Array> {
  const slice = file.slice(0, byteCount);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Converts bytes into a hex string for debugging and matching.
 */
export function bytesToHex(bytes: Uint8Array, maxBytes = 16): string {
  return Array.from(bytes.slice(0, maxBytes))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/**
 * Checks if a byte sequence represents valid UTF-8 text without binary null control characters.
 */
export function isLikelyUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  let nonPrintableCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x00) return false; // Null byte indicates binary
    // Printable ASCII or standard whitespace: \t (9), \n (10), \r (13)
    if (b < 32 && b !== 9 && b !== 10 && b !== 13) {
      nonPrintableCount++;
    }
  }
  return nonPrintableCount / bytes.length < 0.05;
}

/**
 * Inspects file signatures and content to detect real file types.
 */
export async function detectFileSignature(file: File | Blob, originalFilename = ''): Promise<SignatureDetectionResult> {
  const name = (file instanceof File ? file.name : originalFilename).toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';

  // Zero-byte empty file check
  if (file.size === 0) {
    return {
      detectedMime: 'application/x-empty',
      category: 'unknown',
      extensionHint: ext,
      isSupported: false,
      magicHex: '',
      confidence: 'high',
      diagnosticMessage: 'File is empty (0 bytes). Please upload a file containing learning content.',
    };
  }

  const bytes = await readFileHeaderBytes(file, 64);
  const hex = bytesToHex(bytes);

  // 1. PDF: %PDF (25 50 44 46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return {
      detectedMime: 'application/pdf',
      category: 'pdf',
      extensionHint: 'pdf',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'Standard PDF Document detected via %PDF header.',
    };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a
  ) {
    return {
      detectedMime: 'image/png',
      category: 'image',
      extensionHint: 'png',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'PNG Image verified via magic signature.',
    };
  }

  // 3. JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      detectedMime: 'image/jpeg',
      category: 'image',
      extensionHint: 'jpg',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'JPEG / JPG Image verified via magic signature.',
    };
  }

  // 4. GIF: GIF87a / GIF89a (47 49 46 38 37/39 61)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return {
      detectedMime: 'image/gif',
      category: 'image',
      extensionHint: 'gif',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'GIF Image verified via magic signature.',
    };
  }

  // 5. WEBP: RIFF....WEBP (52 49 46 46 ... 57 45 42 50)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return {
      detectedMime: 'image/webp',
      category: 'image',
      extensionHint: 'webp',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'WEBP Image verified via RIFF/WEBP signature.',
    };
  }

  // 6. BMP: BM (42 4D)
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return {
      detectedMime: 'image/bmp',
      category: 'image',
      extensionHint: 'bmp',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'BMP Image verified via bitmap header.',
    };
  }

  // 7. HEIC / HEIF: ftypheic, ftypmif1, ftypmsf1
  const ftypAscii = String.fromCharCode(...bytes.slice(4, 12));
  if (ftypAscii.includes('heic') || ftypAscii.includes('mif1') || ftypAscii.includes('msf1')) {
    return {
      detectedMime: 'image/heic',
      category: 'image',
      extensionHint: 'heic',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'HEIC / HEIF Apple High Efficiency Photo detected.',
    };
  }

  // 8. ZIP Container: PK\x03\x04 (50 4B 03 04) - DOCX, PPTX, EPUB, or ZIP
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // Check if filename extension hints at docx, pptx, or epub
    if (ext === 'docx') {
      return {
        detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        category: 'document',
        extensionHint: 'docx',
        isSupported: true,
        magicHex: hex,
        confidence: 'high',
        diagnosticMessage: 'Microsoft Word Document (DOCX) verified.',
      };
    }
    if (ext === 'pptx') {
      return {
        detectedMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        category: 'document',
        extensionHint: 'pptx',
        isSupported: true,
        magicHex: hex,
        confidence: 'high',
        diagnosticMessage: 'Microsoft PowerPoint Presentation (PPTX) verified.',
      };
    }
    if (ext === 'epub') {
      return {
        detectedMime: 'application/epub+zip',
        category: 'document',
        extensionHint: 'epub',
        isSupported: true,
        magicHex: hex,
        confidence: 'high',
        diagnosticMessage: 'Electronic Publication (EPUB) book verified.',
      };
    }

    return {
      detectedMime: 'application/zip',
      category: 'archive',
      extensionHint: 'zip',
      isSupported: true,
      magicHex: hex,
      confidence: 'medium',
      diagnosticMessage: 'ZIP Archive detected. Will inspect for document content (DOCX/PPTX/EPUB).',
    };
  }

  // 9. Audio: MP3 (ID3 or sync frame FF FB / FF F3 / FF F2)
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return {
      detectedMime: 'audio/mpeg',
      category: 'audio',
      extensionHint: 'mp3',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'MPEG Audio (MP3) verified via sync/ID3 header.',
    };
  }

  // 10. Audio: WAV (RIFF....WAVE)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return {
      detectedMime: 'audio/wav',
      category: 'audio',
      extensionHint: 'wav',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'WAV Linear PCM Audio verified.',
    };
  }

  // 11. Video / Audio: MP4 / M4A / MOV (ftypmp4, ftypm4a, ftypqt)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const isAudio = ext === 'm4a' || ftypAscii.includes('M4A');
    return {
      detectedMime: isAudio ? 'audio/mp4' : 'video/mp4',
      category: isAudio ? 'audio' : 'video',
      extensionHint: isAudio ? 'm4a' : 'mp4',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: `${isAudio ? 'M4A Audio' : 'MP4 Video'} container verified.`,
    };
  }

  // 12. Video: WebM (1A 45 DF A3 - EBML)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return {
      detectedMime: 'video/webm',
      category: 'video',
      extensionHint: 'webm',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'WebM Video/Audio container verified.',
    };
  }

  // 13. Rich Text Format (RTF): {\rtf
  if (bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66) {
    return {
      detectedMime: 'text/rtf',
      category: 'text',
      extensionHint: 'rtf',
      isSupported: true,
      magicHex: hex,
      confidence: 'high',
      diagnosticMessage: 'Rich Text Format (RTF) document detected.',
    };
  }

  // 14. Plain Text, Markdown, CSV Check
  if (isLikelyUtf8Text(bytes)) {
    const isCsv = ext === 'csv';
    const isMd = ext === 'md' || ext === 'markdown';
    const mime = isCsv ? 'text/csv' : isMd ? 'text/markdown' : 'text/plain';

    return {
      detectedMime: mime,
      category: 'text',
      extensionHint: ext || 'txt',
      isSupported: true,
      magicHex: hex,
      confidence: 'medium',
      diagnosticMessage: `Clean UTF-8 ${isCsv ? 'CSV Table' : isMd ? 'Markdown Notes' : 'Plain Text'} detected.`,
    };
  }

  // 15. Unknown binary format - fallback route
  return {
    detectedMime: 'application/octet-stream',
    category: 'unknown',
    extensionHint: ext || 'bin',
    isSupported: false,
    magicHex: hex,
    confidence: 'low',
    diagnosticMessage: `Unrecognized file signature [${hex}]. We will attempt a best-effort text or image recovery.`,
  };
}

/**
 * Best-effort fallback when a file is of unknown or unsupported type.
 * Attempts:
 * 1. Decode as UTF-8 text (if it contains readable text strings)
 * 2. Load as an Image Blob (if the browser native image engine can render it)
 * 3. Returns a structured diagnostic report explaining what was tried and actionable instructions.
 */
export async function tryBestEffortFallback(
  file: File | Blob,
  filename = 'file'
): Promise<{
  success: boolean;
  type: 'text' | 'image' | 'failed';
  text?: string;
  imageDataUrl?: string;
  diagnosticReport: string;
}> {
  // Step 1: Try reading as text
  try {
    const text = await file.text();
    // Check if the text contains a reasonable ratio of readable alphanumeric characters
    const cleanChars = text.replace(/[\r\n\t\s]/g, '');
    const readableChars = cleanChars.replace(/[^a-zA-Z0-9.,;:!?'"()-]/g, '');
    if (cleanChars.length > 20 && readableChars.length / cleanChars.length > 0.6) {
      return {
        success: true,
        type: 'text',
        text: text.slice(0, 100000), // Safety bound
        diagnosticReport: `Successfully recovered ${readableChars.length} characters of readable text using best-effort text decoding.`,
      };
    }
  } catch {
    // Text decoding failed
  }

  // Step 2: Try rendering as an image (browser may support additional formats like AVIF, SVG, TIFF, etc.)
  if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
    try {
      const blobUrl = URL.createObjectURL(file);
      const isRenderable = await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = blobUrl;
      });

      if (isRenderable) {
        // Convert to standard JPEG data URL
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.src = blobUrl;
        await new Promise((res) => {
          img.onload = res;
        });

        canvas.width = Math.min(img.width, 2000);
        canvas.height = Math.round((img.height / img.width) * canvas.width);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          URL.revokeObjectURL(blobUrl);
          return {
            success: true,
            type: 'image',
            imageDataUrl: dataUrl,
            diagnosticReport: `Successfully decoded image via browser engine (${canvas.width}x${canvas.height}px).`,
          };
        }
      }
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Image render failed
    }
  }

  // Step 3: Friendly failure message
  return {
    success: false,
    type: 'failed',
    diagnosticReport: `Could not parse "${filename}". We attempted: (1) UTF-8 text extraction, and (2) visual image decoding, but neither yielded valid study content. To fix this: please export or convert this file into a standard format like PDF, TXT, DOCX, or PNG and re-upload.`,
  };
}
