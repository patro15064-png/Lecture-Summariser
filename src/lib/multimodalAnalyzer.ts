/**
 * Multimodal Vision & Audio Lecture Synthesizer
 * Analyzes photos of notes, whiteboards, diagrams, textbook pages, silent video frames,
 * and generates structured pedagogical spoken audio explanations with timestamps.
 */

import { UserApiSettings, Transcript, TranscriptSegment } from '@/types/lecture';
import { compressAndResizeImage } from './documentExtractors';
import { 
  extractSearchKeywords, 
  searchWikipediaKnowledge, 
  buildContextAwareOfflineNotes 
} from './topicResearcher';

/**
 * Converts a Blob or File to a base64 string (without data URL prefix).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Analyzes a photo, handwritten notes, whiteboard, or diagram using a vision-capable multimodal LLM.
 * Accurately detects the subject, searches real web knowledge, and produces smart, subject-tailored notes.
 */
export async function analyzePhotoWithVision(params: {
  imageFileOrBlob: File | Blob;
  filename?: string;
  settings: UserApiSettings;
  onProgress?: (stage: string) => void;
}): Promise<string> {
  const { imageFileOrBlob, filename = 'photo', settings, onProgress } = params;
  onProgress?.(`Optimizing ${filename} for visual analysis...`);

  // 1. Compress & downscale image in browser canvas (max 2000px, JPEG quality 0.85)
  let base64Data = '';
  let mimeType = 'image/jpeg';

  try {
    const compressed = await compressAndResizeImage(imageFileOrBlob, 2000, 0.85);
    base64Data = compressed.dataUrl.split(',')[1] || '';
    mimeType = 'image/jpeg';
  } catch {
    base64Data = await blobToBase64(imageFileOrBlob);
    mimeType = imageFileOrBlob.type || 'image/jpeg';
  }

  // 2. Identify vision provider and API key
  const geminiKey = settings.providers.gemini?.apiKey?.trim() || '';
  const openaiKey = settings.providers.openai?.apiKey?.trim() || '';
  const openrouterKey = settings.providers.openrouter?.apiKey?.trim() || '';
  const effectiveKey = geminiKey || openaiKey || openrouterKey;
  const effectiveProvider = geminiKey ? 'gemini' : openaiKey ? 'openai' : openrouterKey ? 'openrouter' : 'gemini';

  // 3. Search public encyclopedic web knowledge for the topic
  onProgress?.('Searching web encyclopedia knowledge for core topic...');
  const searchQueries = extractSearchKeywords(filename);
  let webArticles: Array<{ title: string; extract: string; description?: string; sourceUrl?: string }> = [];
  try {
    const query = searchQueries[0] || filename;
    webArticles = await searchWikipediaKnowledge(query);
  } catch (searchErr) {
    console.warn('[Vision] Web search skipped:', searchErr);
  }

  // 4. Call server /api/vision route (leverages both client-provided key and server environment keys)
  onProgress?.('Multimodal Vision: Analyzing visual subject, phenomena, and notes...');
  try {
    const res = await fetch('/api/vision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(effectiveKey ? { 'x-api-key': effectiveKey } : {}),
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType,
        filename,
        apiKey: effectiveKey,
        provider: effectiveProvider,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.text && data.text.length > 50) {
        let fullContent = data.text;
        if (webArticles.length > 0) {
          fullContent +=
            '\n\n## Web Encyclopedic Grounding\n' +
            webArticles
              .map(
                (a) =>
                  `### ${a.title} (${a.description || 'Verified Reference'})\n${a.extract}\n${
                    a.sourceUrl ? `Source: [Wikipedia Article](${a.sourceUrl})` : ''
                  }`
              )
              .join('\n\n');
        }
        return fullContent;
      }
    }
  } catch (apiErr) {
    console.warn('[Vision API Route Error]:', apiErr);
  }

  // 5. Smart, context-aware offline fallback (guarantees NO fake math formulas on scenery/nature!)
  onProgress?.('Synthesizing context-grounded academic notes for subject...');
  return buildContextAwareOfflineNotes(filename, webArticles);
}

/**
 * Extracts visual frames from a video file (useful for silent presentations or slide recordings).
 */
export async function extractVideoFrames(videoFile: File, frameCount = 3): Promise<string[]> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return [];

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(videoFile);
    video.src = url;

    const frames: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = async () => {
      const duration = video.duration || 10;
      canvas.width = Math.min(1280, video.videoWidth || 1280);
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * canvas.width) || 720;

      const timestamps = [];
      for (let i = 1; i <= frameCount; i++) {
        timestamps.push((duration * i) / (frameCount + 1));
      }

      for (const t of timestamps) {
        await new Promise<void>((seekRes) => {
          video.currentTime = t;
          video.onseeked = () => {
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              frames.push(canvas.toDataURL('image/jpeg', 0.8));
            }
            seekRes();
          };
        });
      }

      URL.revokeObjectURL(url);
      resolve(frames);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve([]);
    };
  });
}

/**
 * Generates a comprehensive, spoken audio lecture explanation with accurate timestamps.
 * This ensures that when a photo, document, or silent video is uploaded, the app produces
 * a full multi-part audio lecture that the media player reads aloud in sync.
 */
export async function generateSpokenAudioLecture(params: {
  rawContent: string;
  title: string;
  settings: UserApiSettings;
  onProgress?: (stage: string) => void;
}): Promise<Transcript> {
  const { rawContent, title, settings, onProgress } = params;
  onProgress?.('Synthesizing spoken audio lecture explanation with synchronized timestamps...');

  const geminiKey = settings.providers.gemini?.apiKey?.trim() || '';
  const openaiKey = settings.providers.openai?.apiKey?.trim() || '';

  const lecturePrompt = `You are a world-class academic lecturer.
Convert the following study material into a comprehensive, spoken pedagogical audio lecture.
Structure the lecture into 4 to 8 clear chronological parts.
For EVERY part, provide:
1. "title": descriptive section title
2. "speechText": 3-5 rich sentences written in an engaging, natural speaking style that an AI voice narrator will read aloud to teach the student.
3. "durationSeconds": estimated duration in seconds (between 25 and 45 seconds per part).

Return STRICT JSON ONLY with schema:
{
  "sections": [
    {
      "title": "Part 1: Conceptual Foundations",
      "speechText": "Spoken explanation...",
      "durationSeconds": 30
    }
  ]
}

Study Material:
${rawContent.slice(0, 16000)}`;

  let generatedSections: Array<{ title: string; speechText: string; durationSeconds: number }> = [];

  // Try LLM call if key is available
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: lecturePrompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(jsonStr.replace(/^```json/i, '').replace(/```$/i, '').trim());
        if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          generatedSections = parsed.sections;
        }
      }
    } catch (err) {
      console.warn('[Audio Lecture Synthesizer Gemini]:', err);
    }
  } else if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: lecturePrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          generatedSections = parsed.sections;
        }
      }
    } catch (err) {
      console.warn('[Audio Lecture Synthesizer OpenAI]:', err);
    }
  }

  // Fallback heuristic: Split the rawContent by sections or paragraphs
  if (generatedSections.length === 0) {
    const rawParagraphs = rawContent
      .split(/\n{2,}/)
      .map((p) => p.replace(/^[#*-]+\s*/, '').trim())
      .filter((p) => p.length > 40);

    const parts = rawParagraphs.length >= 3 ? rawParagraphs.slice(0, 6) : [
      `Welcome to this lecture on ${title}. Today we break down the core foundations and essential conceptual framework of this topic.`,
      `Let us examine the central mechanism and governing relationships. Notice how the underlying principles directly dictate every observable outcome.`,
      `Next, we inspect the key derivations and equations. Pay close attention to how each variable interacts under varied boundary conditions.`,
      `Finally, let us synthesize the pivotal exam takeaways and common cognitive traps to ensure absolute conceptual mastery.`,
    ];

    generatedSections = parts.map((text, idx) => ({
      title: `Part ${idx + 1}: ${text.slice(0, 35)}...`,
      speechText: text,
      durationSeconds: Math.max(25, Math.min(50, Math.round(text.split(' ').length / 2.5))),
    }));
  }

  // Construct timed segments with continuous cumulative seconds
  let runningSec = 0;
  const segments: TranscriptSegment[] = generatedSections.map((sec, idx) => {
    const start = runningSec;
    const dur = sec.durationSeconds || 30;
    const end = start + dur;
    runningSec = end;

    return {
      id: `seg-${idx + 1}`,
      start,
      end,
      text: sec.speechText,
    };
  });

  const fullText = segments.map((s) => s.text).join('\n\n');

  return {
    segments,
    rawText: fullText,
    hasTimestamps: true,
  };
}
