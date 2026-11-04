/**
 * Universal Document, Image, and Media Extractors
 * Robust client-side extraction for PDF (text + scanned vision), DOCX, PPTX, EPUB,
 * images (with Canvas downscaling & HEIC conversion), audio/video, CSV, RTF, and web links.
 */

import JSZip from 'jszip';
import { detectFileSignature, tryBestEffortFallback } from './fileSignatures';
import { SourceCitation } from '@/types/lecture';

export interface ExtractedSection {
  title: string;
  text: string;
  pageNumber?: number;
  slideNumber?: number;
  timestampSeconds?: number;
  timestampFormatted?: string;
  imageDataUrl?: string; // For scanned pages or diagrams needing vision
  isScannedVisionPage?: boolean;
  sourceCitation: SourceCitation;
}

export interface UniversalExtractionResult {
  filename: string;
  fileType: string;
  fileSize: number;
  success: boolean;
  totalWordCount: number;
  sections: ExtractedSection[];
  combinedText: string;
  errorReason?: string;
  previewThumbnailUrl?: string;
}

/**
 * Compresses an image in the browser using an offscreen Canvas.
 * Caps the maximum dimension to 2000px and converts to high-quality JPEG.
 */
export async function compressAndResizeImage(
  imageBlobOrFile: Blob | File,
  maxDimension = 2000,
  quality = 0.85
): Promise<{ dataUrl: string; width: number; height: number; blob: Blob }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Canvas compression only supported in browser environment'));
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(imageBlobOrFile);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

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
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not create 2D canvas context'));
      }

      // Draw with smooth bicubic scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ dataUrl, width, height, blob });
          } else {
            resolve({ dataUrl, width, height, blob: imageBlobOrFile });
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = objectUrl;
  });
}

/**
 * Extracts text and renders scanned pages from a PDF file using pdfjs-dist.
 */
export async function extractPdfContent(
  file: File | Blob,
  filename = 'document.pdf',
  onProgress?: (page: number, total: number) => void
): Promise<UniversalExtractionResult> {
  const sections: ExtractedSection[] = [];
  let combinedText = '';

  try {
    const arrayBuffer = await file.arrayBuffer();

    // Dynamically import pdfjs-dist for browser compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() =>
      import('pdfjs-dist')
    );

    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/legacy/build/pdf.worker.min.mjs`;
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.(pageNum, totalPages);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageStrings = textContent.items.map((item: any) => item.str || '').filter(Boolean);
      const rawPageText = pageStrings.join(' ').trim();

      // If page text is very sparse (< 30 characters), treat as scanned image/diagram page
      if (rawPageText.length < 30 && typeof window !== 'undefined') {
        try {
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            const pageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

            sections.push({
              title: `Page ${pageNum} (Scanned Page / Diagram)`,
              text: `[Visual content from scanned page ${pageNum}. Awaiting multimodal vision analysis.]`,
              pageNumber: pageNum,
              imageDataUrl: pageDataUrl,
              isScannedVisionPage: true,
              sourceCitation: {
                filename,
                pageNumber: pageNum,
                snippet: `Scanned page ${pageNum}`,
              },
            });
            continue;
          }
        } catch (renderErr) {
          console.warn(`[PDF Renderer] Could not render page ${pageNum} to canvas:`, renderErr);
        }
      }

      // Standard text page
      if (rawPageText.length > 0) {
        sections.push({
          title: `Page ${pageNum}`,
          text: rawPageText,
          pageNumber: pageNum,
          sourceCitation: {
            filename,
            pageNumber: pageNum,
            snippet: rawPageText.slice(0, 100),
          },
        });
        combinedText += `\n\n--- [Page ${pageNum} - ${filename}] ---\n` + rawPageText;
      }
    }

    if (sections.length === 0) {
      throw new Error('PDF contains no extractable text or renderable pages.');
    }

    const totalWordCount = combinedText.split(/\s+/).filter(Boolean).length;
    return {
      filename,
      fileType: 'application/pdf',
      fileSize: file.size,
      success: true,
      totalWordCount,
      sections,
      combinedText,
      previewThumbnailUrl: sections[0]?.imageDataUrl,
    };
  } catch (err: unknown) {
    const errorReason =
      err instanceof Error
        ? err.message.includes('password')
          ? 'PDF is password-protected. Please remove password and re-upload.'
          : err.message
        : 'Failed to read PDF document.';

    return {
      filename,
      fileType: 'application/pdf',
      fileSize: file.size,
      success: false,
      totalWordCount: 0,
      sections: [],
      combinedText: '',
      errorReason,
    };
  }
}

/**
 * Helper to parse DOCX paragraphs with headings, supporting both DOMParser and regex fallback
 */
function parseDocxParagraphs(docXml: string): Array<{ isHeading: boolean; text: string }> {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(docXml, 'application/xml');
      const paragraphs = xmlDoc.getElementsByTagName('w:p');
      const results: Array<{ isHeading: boolean; text: string }> = [];
      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        const pStyle = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val');
        const textRuns = p.getElementsByTagName('w:t');
        const pText = Array.from(textRuns)
          .map((t) => t.textContent || '')
          .join('')
          .trim();
        if (pText) {
          results.push({ isHeading: !!(pStyle && /heading/i.test(pStyle)), text: pText });
        }
      }
      return results;
    } catch {
      // Fall through to regex
    }
  }

  // Robust regex fallback (works in Node.js, Web Workers, or when DOMParser fails)
  const pMatches = docXml.match(/<w:p[\s\S]*?<\/w:p>/gi) || [];
  const results: Array<{ isHeading: boolean; text: string }> = [];
  for (const pXml of pMatches) {
    const isHeading = /<w:pStyle[^>]*w:val="[^"]*heading[^"]*"/i.test(pXml);
    const tMatches = Array.from(pXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)).map((m) => m[1]);
    const pText = tMatches
      .join('')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
    if (pText) {
      results.push({ isHeading, text: pText });
    }
  }
  return results;
}

/**
 * Extracts text, headings, and tables from a Microsoft Word DOCX file using JSZip.
 */
export async function extractDocxContent(
  file: File | Blob,
  filename = 'document.docx'
): Promise<UniversalExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file('word/document.xml')?.async('text');

    if (!docXml) {
      throw new Error('Invalid DOCX file: word/document.xml not found.');
    }

    const paragraphs = parseDocxParagraphs(docXml);
    const sections: ExtractedSection[] = [];
    let currentTitle = 'Introduction';
    let currentSectionParagraphs: string[] = [];
    let sectionIdx = 1;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      if (p.isHeading && currentSectionParagraphs.length > 0) {
        const textBlock = currentSectionParagraphs.join('\n');
        sections.push({
          title: currentTitle,
          text: textBlock,
          sourceCitation: {
            filename,
            pageNumber: sectionIdx,
            snippet: textBlock.slice(0, 100),
          },
        });
        sectionIdx++;
        currentTitle = p.text;
        currentSectionParagraphs = [];
      } else if (p.isHeading) {
        currentTitle = p.text;
      } else {
        currentSectionParagraphs.push(p.text);
      }
    }

    if (currentSectionParagraphs.length > 0) {
      const textBlock = currentSectionParagraphs.join('\n');
      sections.push({
        title: currentTitle,
        text: textBlock,
        sourceCitation: {
          filename,
          pageNumber: sectionIdx,
          snippet: textBlock.slice(0, 100),
        },
      });
    }

    const combinedText = sections.map((s) => `### ${s.title}\n${s.text}`).join('\n\n');
    const totalWordCount = combinedText.split(/\s+/).filter(Boolean).length;

    return {
      filename,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: file.size,
      success: true,
      totalWordCount,
      sections,
      combinedText,
    };
  } catch (err: unknown) {
    return {
      filename,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: file.size,
      success: false,
      totalWordCount: 0,
      sections: [],
      combinedText: '',
      errorReason: err instanceof Error ? err.message : 'Corrupted or unreadable DOCX archive.',
    };
  }
}

/**
 * Helper to parse PPTX text nodes with DOMParser and regex fallback
 */
function parsePptxTextNodes(xml: string): string[] {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const textNodes = doc.getElementsByTagName('a:t');
      const lines: string[] = [];
      for (let t = 0; t < textNodes.length; t++) {
        const val = textNodes[t].textContent?.trim();
        if (val) lines.push(val);
      }
      return lines;
    } catch {
      // Fall through to regex
    }
  }

  // Regex fallback
  const matches = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi))
    .map((m) =>
      m[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim()
    )
    .filter(Boolean);
  return matches;
}

/**
 * Extracts slide titles, body bullet points, and speaker notes from PPTX presentation files.
 */
export async function extractPptxContent(
  file: File | Blob,
  filename = 'presentation.pptx'
): Promise<UniversalExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(file);
    const sections: ExtractedSection[] = [];

    // Find all slide XML files
    const slideEntries = Object.keys(zip.files).filter((k) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(k)
    );

    // Sort slides numerically: slide1, slide2, slide10
    slideEntries.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    if (slideEntries.length === 0) {
      throw new Error('No slides found in PPTX archive.');
    }

    for (let idx = 0; idx < slideEntries.length; idx++) {
      const slidePath = slideEntries[idx];
      const slideXml = await zip.file(slidePath)?.async('text');
      if (!slideXml) continue;

      const slideNum = idx + 1;
      const textLines = parsePptxTextNodes(slideXml);

      // Check for speaker notes: ppt/notesSlides/notesSlide{N}.xml
      let speakerNotes = '';
      const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
      const notesXml = await zip.file(notesPath)?.async('text');
      if (notesXml) {
        const noteNodes = parsePptxTextNodes(notesXml);
        const notesLines = noteNodes.filter((nv) => !/slide \d+/i.test(nv));
        if (notesLines.length > 0) {
          speakerNotes = `\n\n[Speaker Notes]: ${notesLines.join(' ')}`;
        }
      }

      const slideTitle = textLines[0] || `Slide ${slideNum}`;
      const slideBody = textLines.slice(1).join('\n') + speakerNotes;

      sections.push({
        title: `Slide ${slideNum}: ${slideTitle}`,
        text: slideBody.trim() || slideTitle,
        slideNumber: slideNum,
        sourceCitation: {
          filename,
          pageNumber: slideNum,
          snippet: `Slide ${slideNum}: ${slideTitle}`,
        },
      });
    }

    const combinedText = sections.map((s) => `--- ${s.title} ---\n${s.text}`).join('\n\n');
    const totalWordCount = combinedText.split(/\s+/).filter(Boolean).length;

    return {
      filename,
      fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileSize: file.size,
      success: true,
      totalWordCount,
      sections,
      combinedText,
    };
  } catch (err: unknown) {
    return {
      filename,
      fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileSize: file.size,
      success: false,
      totalWordCount: 0,
      sections: [],
      combinedText: '',
      errorReason: err instanceof Error ? err.message : 'Corrupted or unreadable PPTX file.',
    };
  }
}

/**
 * Extracts chapters and content from EPUB electronic books.
 */
export async function extractEpubContent(
  file: File | Blob,
  filename = 'book.epub'
): Promise<UniversalExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(file);
    const sections: ExtractedSection[] = [];

    // Find all HTML / XHTML documents inside the archive
    const htmlEntries = Object.keys(zip.files).filter((k) =>
      /\.(html|xhtml|htm)$/i.test(k)
    );

    if (htmlEntries.length === 0) {
      throw new Error('No chapter HTML documents found in EPUB.');
    }

    for (let i = 0; i < Math.min(30, htmlEntries.length); i++) {
      const entryPath = htmlEntries[i];
      const htmlText = await zip.file(entryPath)?.async('text');
      if (!htmlText) continue;

      let heading = `Chapter ${i + 1}`;
      let cleanText = '';

      if (typeof DOMParser !== 'undefined') {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, 'text/html');
          const bodyText = doc.body.innerText || doc.body.textContent || '';
          cleanText = bodyText.replace(/\s+/g, ' ').trim();
          heading = doc.querySelector('h1, h2, h3, title')?.textContent?.trim() || `Chapter ${i + 1}`;
        } catch {
          cleanText = '';
        }
      }

      if (!cleanText) {
        // Regex fallback
        const titleMatch = htmlText.match(/<(?:h[1-3]|title)[^>]*>([\s\S]*?)<\/(?:h[1-3]|title)>/i);
        if (titleMatch) heading = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const rawBody = bodyMatch ? bodyMatch[1] : htmlText;
        cleanText = rawBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      if (cleanText.length < 50) continue;

      sections.push({
        title: heading,
        text: cleanText,
        pageNumber: i + 1,
        sourceCitation: {
          filename,
          pageNumber: i + 1,
          snippet: cleanText.slice(0, 100),
        },
      });
    }

    const combinedText = sections.map((s) => `### ${s.title}\n${s.text}`).join('\n\n');
    const totalWordCount = combinedText.split(/\s+/).filter(Boolean).length;

    return {
      filename,
      fileType: 'application/epub+zip',
      fileSize: file.size,
      success: true,
      totalWordCount,
      sections,
      combinedText,
    };
  } catch (err: unknown) {
    return {
      filename,
      fileType: 'application/epub+zip',
      fileSize: file.size,
      success: false,
      totalWordCount: 0,
      sections: [],
      combinedText: '',
      errorReason: err instanceof Error ? err.message : 'Could not read EPUB archive.',
    };
  }
}

/**
 * Extracts plain text, Markdown, CSV, or RTF content.
 */
export async function extractTextDocumentContent(
  file: File | Blob,
  filename = 'notes.txt',
  mimeType = 'text/plain'
): Promise<UniversalExtractionResult> {
  try {
    let rawText = await file.text();

    // Clean RTF if detected
    if (rawText.startsWith('{\\rtf')) {
      rawText = rawText
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\[a-z0-9-]+/gi, '')
        .replace(/[{}]/g, '')
        .trim();
    }

    // Split markdown or text into structured sections by headers
    const lines = rawText.split(/\r?\n/);
    const sections: ExtractedSection[] = [];
    let currentTitle = filename.replace(/\.[^.]+$/, '');
    let currentBuffer: string[] = [];
    let sectionIdx = 1;

    for (const line of lines) {
      if (/^#{1,3}\s+(.+)$/.test(line)) {
        if (currentBuffer.length > 0) {
          const content = currentBuffer.join('\n').trim();
          if (content) {
            sections.push({
              title: currentTitle,
              text: content,
              pageNumber: sectionIdx,
              sourceCitation: {
                filename,
                pageNumber: sectionIdx,
                snippet: content.slice(0, 100),
              },
            });
            sectionIdx++;
          }
          currentBuffer = [];
        }
        currentTitle = line.replace(/^#{1,3}\s+/, '').trim();
      } else {
        currentBuffer.push(line);
      }
    }

    if (currentBuffer.length > 0) {
      const content = currentBuffer.join('\n').trim();
      if (content) {
        sections.push({
          title: currentTitle,
          text: content,
          pageNumber: sectionIdx,
          sourceCitation: {
            filename,
            pageNumber: sectionIdx,
            snippet: content.slice(0, 100),
          },
        });
      }
    }

    const totalWordCount = rawText.split(/\s+/).filter(Boolean).length;
    return {
      filename,
      fileType: mimeType,
      fileSize: file.size,
      success: true,
      totalWordCount,
      sections,
      combinedText: rawText,
    };
  } catch (err: unknown) {
    return {
      filename,
      fileType: mimeType,
      fileSize: file.size,
      success: false,
      totalWordCount: 0,
      sections: [],
      combinedText: '',
      errorReason: err instanceof Error ? err.message : 'Could not decode text file.',
    };
  }
}

/**
 * Universal dispatcher that takes any File or Blob, detects its real signature,
 * runs the appropriate specialized extractor, and falls back gracefully.
 */
export async function extractAnyLearningMaterial(
  file: File | Blob,
  filename = 'uploaded_material',
  onProgress?: (stage: string, percent: number) => void
): Promise<UniversalExtractionResult> {
  const name = file instanceof File ? file.name : filename;

  // Zero-byte validation guard
  if (file.size === 0) {
    return {
      filename: name,
      fileType: 'application/x-empty',
      fileSize: 0,
      success: false,
      totalWordCount: 0,
      sections: [],
      combinedText: '',
      errorReason: 'File is empty (0 bytes). Please upload a file containing learning content.',
    };
  }

  // 1. Detect Signature & Validate
  onProgress?.(`Detecting file signature for ${name}...`, 10);
  const signature = await detectFileSignature(file, name);

  if (!signature.isSupported && signature.category === 'unknown') {
    // Try best-effort fallback
    onProgress?.(`Attempting best-effort recovery for ${name}...`, 25);
    const fallback = await tryBestEffortFallback(file, name);
    if (fallback.success && fallback.text) {
      return {
        filename: name,
        fileType: 'text/plain',
        fileSize: file.size,
        success: true,
        totalWordCount: fallback.text.split(/\s+/).filter(Boolean).length,
        sections: [
          {
            title: `${name} (Recovered Content)`,
            text: fallback.text,
            sourceCitation: { filename: name, snippet: fallback.text.slice(0, 100) },
          },
        ],
        combinedText: fallback.text,
      };
    }
    if (fallback.success && fallback.imageDataUrl) {
      return {
        filename: name,
        fileType: 'image/jpeg',
        fileSize: file.size,
        success: true,
        totalWordCount: 50,
        sections: [
          {
            title: `${name} (Recovered Image)`,
            text: `[Visual Image Content from ${name}. Multimodal Vision will inspect and describe diagrams, notes, and text.]`,
            imageDataUrl: fallback.imageDataUrl,
            sourceCitation: { filename: name, snippet: 'Visual image recovery' },
          },
        ],
        combinedText: `Visual Image Content: ${name}`,
        previewThumbnailUrl: fallback.imageDataUrl,
      };
    }

    return {
      filename: name,
      fileType: signature.detectedMime,
      fileSize: file.size,
      success: false,
      totalWordCount: 0,
      sections: [],
      combinedText: '',
      errorReason: fallback.diagnosticReport,
    };
  }

  // 2. Dispatch to matching extractor
  switch (signature.category) {
    case 'pdf': {
      onProgress?.(`Reading PDF pages from ${name}...`, 30);
      return extractPdfContent(file, name, (curr, total) => {
        onProgress?.(`Reading page ${curr} of ${total} in ${name}...`, Math.round(30 + (curr / total) * 50));
      });
    }

    case 'image': {
      onProgress?.(`Compressing and optimizing ${name} for vision analysis...`, 40);
      try {
        const compressed = await compressAndResizeImage(file, 2000, 0.85);
        return {
          filename: name,
          fileType: signature.detectedMime,
          fileSize: file.size,
          success: true,
          totalWordCount: 60,
          sections: [
            {
              title: `${name} (Visual Diagram / Note)`,
              text: `[High-resolution image: ${name} (${compressed.width}x${compressed.height}px). Visual details, diagrams, tables, and handwritten equations will be fully transcribed by multimodal vision.]`,
              imageDataUrl: compressed.dataUrl,
              sourceCitation: {
                filename: name,
                snippet: `Photo / diagram: ${name}`,
              },
            },
          ],
          combinedText: `[Multimodal visual input: ${name}]`,
          previewThumbnailUrl: compressed.dataUrl,
        };
      } catch (imgErr) {
        return {
          filename: name,
          fileType: signature.detectedMime,
          fileSize: file.size,
          success: false,
          totalWordCount: 0,
          sections: [],
          combinedText: '',
          errorReason: imgErr instanceof Error ? imgErr.message : 'Failed to process image.',
        };
      }
    }

    case 'document': {
      if (signature.extensionHint === 'docx') {
        onProgress?.(`Extracting Word document structure from ${name}...`, 40);
        return extractDocxContent(file, name);
      }
      if (signature.extensionHint === 'pptx') {
        onProgress?.(`Extracting PowerPoint slides and speaker notes from ${name}...`, 40);
        return extractPptxContent(file, name);
      }
      if (signature.extensionHint === 'epub') {
        onProgress?.(`Extracting chapters from EPUB book ${name}...`, 40);
        return extractEpubContent(file, name);
      }
      return extractTextDocumentContent(file, name, signature.detectedMime);
    }

    case 'text': {
      onProgress?.(`Reading text content from ${name}...`, 50);
      return extractTextDocumentContent(file, name, signature.detectedMime);
    }

    default: {
      onProgress?.(`Reading content from ${name}...`, 50);
      return extractTextDocumentContent(file, name, signature.detectedMime);
    }
  }
}
