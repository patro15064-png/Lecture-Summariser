import { TranscriptSegment, Transcript } from '@/types/lecture';

/**
 * Converts seconds to "MM:SS" or "H:MM:SS" format.
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats a clean single range like "02:20-02:50" without confusing parenthetical pills.
 */
export function formatTimeRange(startSeconds: number, endSeconds: number): string {
  return `${formatTime(startSeconds)}-${formatTime(endSeconds)}`;
}

/**
 * Parses timestamp strings from SRT (00:01:23,456) or VTT (00:01:23.456 or 01:23.456) into seconds.
 */
export function parseTimestampToSeconds(ts: string): number {
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Parses WebVTT (.vtt) file content into structured segments.
 */
export function parseVTT(content: string): TranscriptSegment[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const segments: TranscriptSegment[] = [];
  let i = 0;

  // Skip WEBVTT header and metadata
  while (i < lines.length && (lines[i].startsWith('WEBVTT') || lines[i].startsWith('NOTE') || lines[i].trim() === '')) {
    i++;
  }

  let segmentIdCounter = 1;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Check if line is an identifier before the timestamp line
    let timeLine = line;
    if (!line.includes('-->') && i + 1 < lines.length && lines[i + 1].includes('-->')) {
      i++;
      timeLine = lines[i].trim();
    }

    if (timeLine.includes('-->')) {
      const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim().split(' ')[0]);
      const start = parseTimestampToSeconds(startStr);
      const end = parseTimestampToSeconds(endStr);

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        // Strip out cue tags like <c.color> or <b>
        const cleanedText = lines[i].replace(/<\/?[^>]+(>|$)/g, '').trim();
        if (cleanedText) {
          textLines.push(cleanedText);
        }
        i++;
      }

      const text = textLines.join(' ');
      if (text) {
        segments.push({
          id: `seg-${segmentIdCounter++}`,
          start: Math.round(start * 100) / 100,
          end: Math.round(end * 100) / 100,
          text,
        });
      }
    } else {
      i++;
    }
  }

  return segments;
}

/**
 * Parses SubRip (.srt) file content into structured segments.
 */
export function parseSRT(content: string): TranscriptSegment[] {
  const blocks = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n\s*\n/);
  const segments: TranscriptSegment[] = [];
  let segmentIdCounter = 1;

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLineIndex = lines[0].includes('-->') ? 0 : 1;
    if (timeLineIndex >= lines.length) continue;

    const timeLine = lines[timeLineIndex];
    if (timeLine.includes('-->')) {
      const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim().split(' ')[0]);
      const start = parseTimestampToSeconds(startStr);
      const end = parseTimestampToSeconds(endStr);
      const text = lines.slice(timeLineIndex + 1).join(' ').trim();

      if (text) {
        segments.push({
          id: `seg-${segmentIdCounter++}`,
          start: Math.round(start * 100) / 100,
          end: Math.round(end * 100) / 100,
          text,
        });
      }
    }
  }

  return segments;
}

/**
 * Parses JSON transcript formats (e.g., Whisper verbose_json, custom segments).
 */
export function parseJSONTranscript(jsonText: string): TranscriptSegment[] {
  try {
    const data = JSON.parse(jsonText);
    const rawSegments = data.segments || (Array.isArray(data) ? data : []);
    let segmentIdCounter = 1;

    return rawSegments.map((item: { start?: number; end?: number; text?: string; words?: Array<{ word: string; start: number; end: number }> }) => ({
      id: `seg-${segmentIdCounter++}`,
      start: typeof item.start === 'number' ? Math.round(item.start * 100) / 100 : 0,
      end: typeof item.end === 'number' ? Math.round(item.end * 100) / 100 : 0,
      text: (item.text || '').trim(),
      words: item.words,
    }));
  } catch {
    return [];
  }
}

/**
 * Universal transcript parser handling .vtt, .srt, .json, and plain .txt.
 * Accepts either (content) or (filename, content).
 */
export function parseTranscriptContent(contentOrFilename: string, maybeContent?: string): Transcript {
  const content = maybeContent !== undefined ? maybeContent : contentOrFilename;
  const filename = maybeContent !== undefined ? contentOrFilename : (
    content.startsWith('WEBVTT') ? 'transcript.vtt' : content.includes('-->') ? 'transcript.srt' : 'transcript.txt'
  );
  const ext = filename.toLowerCase().split('.').pop() || '';
  let segments: TranscriptSegment[] = [];
  let hasTimestamps = false;

  if (ext === 'vtt' || content.startsWith('WEBVTT')) {
    segments = parseVTT(content);
    hasTimestamps = segments.length > 0;
  } else if (ext === 'srt' || content.includes('-->')) {
    segments = parseSRT(content);
    hasTimestamps = segments.length > 0;
  } else if (ext === 'json') {
    segments = parseJSONTranscript(content);
    hasTimestamps = segments.length > 0 && segments.some((s) => s.end > 0);
  }

  // Fallback for un-timestamped plain text (.txt or raw notes)
  if (segments.length === 0) {
    const rawBlocks = content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const sentenceList: string[] = [];
    for (const block of rawBlocks) {
      const sentences = block
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      if (sentences.length > 0) {
        sentenceList.push(...sentences);
      } else if (block.length > 0) {
        sentenceList.push(block);
      }
    }

    const finalUnits = sentenceList.length > 0 ? sentenceList : [content.trim()];
    let accumulatedTime = 0;

    segments = finalUnits.map((text, idx) => {
      // Estimate realistic speech/reading pacing (~2.5 words/sec, min 10s, max 60s)
      const wordCount = text.split(/\s+/).length;
      const duration = Math.max(10, Math.min(60, Math.round(wordCount / 2.5)));
      const start = accumulatedTime;
      const end = start + duration;
      accumulatedTime = end;

      return {
        id: `text-seg-${idx + 1}`,
        start,
        end,
        text,
      };
    });

    hasTimestamps = true;
  }

  const rawText = segments.map((s) => s.text).join(' ');

  return {
    segments,
    rawText,
    hasTimestamps,
  };
}

/**
 * Stitches multi-chunk audio transcript segments (e.g. 10-minute chunks with 5s overlap)
 * back into a single global continuous timeline with overlap deduplication.
 */
export function stitchOverlappingChunks(
  chunks: Array<{ offsetSeconds: number; segments: TranscriptSegment[] }>
): TranscriptSegment[] {
  if (chunks.length === 0) return [];

  const stitched: TranscriptSegment[] = [];
  let globalIdCounter = 1;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const offset = chunk.offsetSeconds;

    for (const seg of chunk.segments) {
      const adjustedStart = Math.round((seg.start + offset) * 100) / 100;
      const adjustedEnd = Math.round((seg.end + offset) * 100) / 100;

      // Check for overlap duplicate with existing stitched segments
      const isDuplicate = stitched.some((existing) => {
        const timeOverlap = Math.abs(existing.start - adjustedStart) < 3.0;
        const textSimilarity =
          existing.text.toLowerCase() === seg.text.toLowerCase() ||
          existing.text.toLowerCase().includes(seg.text.toLowerCase().slice(0, 20));
        return timeOverlap && textSimilarity;
      });

      if (!isDuplicate) {
        stitched.push({
          id: `seg-${globalIdCounter++}`,
          start: adjustedStart,
          end: adjustedEnd,
          text: seg.text,
          words: seg.words?.map((w) => ({
            word: w.word,
            start: Math.round((w.start + offset) * 100) / 100,
            end: Math.round((w.end + offset) * 100) / 100,
          })),
        });
      }
    }
  }

  // Sort strictly chronologically
  stitched.sort((a, b) => a.start - b.start);
  return stitched;
}

/**
 * Converts structured segments into WebVTT text for export.
 */
export function exportToVTT(segments: TranscriptSegment[]): string {
  let vtt = 'WEBVTT - Exported by Lecture-Summariser\n\n';

  segments.forEach((seg, idx) => {
    const startFormatted = formatVTTTimestamp(seg.start);
    const endFormatted = formatVTTTimestamp(seg.end);
    vtt += `${idx + 1}\n${startFormatted} --> ${endFormatted}\n${seg.text}\n\n`;
  });

  return vtt;
}

function formatVTTTimestamp(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = (totalSeconds % 60).toFixed(3);

  const paddedSecs = secs.padStart(6, '0');
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${paddedSecs}`;
}
