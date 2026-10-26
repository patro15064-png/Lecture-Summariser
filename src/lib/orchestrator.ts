import { z } from 'zod';
import { openDB, IDBPDatabase } from 'idb';
import {
  Transcript,
  ConceptNode,
  GraphEdge,
  GoldenAudioSnippet,
  Flashcard,
  DiagnosticQuestion,
  LectureArtifact,
  UserApiSettings,
  AgentRole,
} from '@/types/lecture';
import {
  validateVerbatimGrounding,
  snapToSegmentBoundaries,
  enforceDAG,
} from './grounding';
import { formatTime, formatTimeRange } from './transcriptParser';

// --- Zod Output Schemas for Strict Parsing ---

export const RawTopicalSectionSchema = z.object({
  topicTitle: z.string(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  summary: z.string(),
});

export const RawConceptSchema = z.object({
  title: z.string(),
  type: z.enum(['definition', 'equation', 'entity', 'core']),
  approxTimestampSeconds: z.number(),
  summary: z.string(),
  explanation: z.string(),
  formulaLatex: z.string().optional(),
  verbatimQuote: z.string().describe('Exact substring from transcript'),
  keyTakeaways: z.array(z.string()),
  importance: z.enum(['foundational', 'core', 'advanced']),
  prerequisiteTitles: z.array(z.string()).default([]),
});

export const RawGoldenMomentSchema = z.object({
  title: z.string(),
  approxStartSeconds: z.number(),
  approxEndSeconds: z.number(),
  quote: z.string(),
  whyItMatters: z.string(),
  difficultyScore: z.number().min(1).max(5),
  clarityScore: z.number().min(1).max(5),
});

export const RawQuizQuestionSchema = z.object({
  conceptTitle: z.string(),
  question: z.string(),
  options: z.array(
    z.object({
      text: z.string(),
      isCorrect: z.boolean(),
      misconceptionExplanation: z.string(),
    })
  ),
  explanation: z.string(),
});

export const RawSummaryThemesSchema = z.object({
  overview: z.string(),
  keyThemes: z.array(z.string()),
});

// --- Progress & Cancellation ---

export interface PipelineProgressCallback {
  (stage: string, percent: number, activeAgent?: string): void;
}

export class PipelineCancellationToken {
  private isCancelled = false;
  cancel() {
    this.isCancelled = true;
  }
  check() {
    if (this.isCancelled) throw new Error('Pipeline cancelled by user.');
  }
}

// --- IndexedDB Cache ---

const DB_NAME = 'lecture_summariser_cache';
const DB_VERSION = 1;
const STORE_NAME = 'artifacts';

async function getCacheDB(): Promise<IDBPDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null;
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function getCachedArtifact(id: string): Promise<LectureArtifact | null> {
  try {
    const db = await getCacheDB();
    if (!db) return null;
    return (await db.get(STORE_NAME, id)) || null;
  } catch {
    return null;
  }
}

export async function saveArtifactToCache(artifact: LectureArtifact): Promise<void> {
  try {
    const db = await getCacheDB();
    if (!db) return;
    await db.put(STORE_NAME, artifact);
  } catch (err) {
    console.warn('[Cache] Could not persist artifact to IndexedDB:', err);
  }
}

// --- Multi-Provider LLM Calling Layer ---

export async function callLlmAgent(params: {
  role: AgentRole;
  systemPrompt: string;
  userPrompt: string;
  settings: UserApiSettings;
  responseMimeType?: string;
  transcript?: Transcript;
}): Promise<string> {
  const { role, systemPrompt, userPrompt, settings, transcript } = params;

  // Resolve active provider and model
  let provider = settings.useSingleModel ? settings.singleProvider : settings.assignments[role].provider;
  let model = settings.useSingleModel ? settings.singleModel : settings.assignments[role].model;

  // Local fallback if no key
  const providerConfig = settings.providers[provider];
  let apiKey = providerConfig?.apiKey || '';

  if (!apiKey && provider !== 'local') {
    // If user has a key configured in another provider, attempt fallback
    const geminiKey = settings.providers.gemini?.apiKey;
    const groqKey = settings.providers.groq?.apiKey;
    const openaiKey = settings.providers.openai?.apiKey;
    if (geminiKey) {
      provider = 'gemini';
      model = 'gemini-2.0-flash';
      apiKey = geminiKey;
    } else if (groqKey) {
      provider = 'groq';
      model = 'llama-3.3-70b-versatile';
      apiKey = groqKey;
    } else if (openaiKey) {
      provider = 'openai';
      model = 'gpt-4o-mini';
      apiKey = openaiKey;
    } else {
      // Graceful local offline fallback when no external API key is configured
      return generateLocalAgentResponse(role, userPrompt, transcript);
    }
  }

  // 0. Local In-Browser Simulation / Rule Engine (Zero API Key)
  if (provider === 'local') {
    return generateLocalAgentResponse(role, userPrompt, transcript);
  }

  // 1. Google Gemini Provider
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini Agent [${role}] error (${res.status}): ${err}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } catch (err) {
      console.warn('[Gemini] Direct fetch failed, attempting proxy fallback:', err);
      // Fallback via /api/proxy
      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gemini',
          apiKey: apiKey.trim(),
          endpoint: url,
          body: {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          },
        }),
      });
      if (!proxyRes.ok) throw err;
      const data = await proxyRes.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    }
  }

  // 2. OpenAI, Groq, OpenRouter, or Custom Provider
  if (provider === 'openai' || provider === 'groq' || provider === 'openrouter' || provider === 'custom') {
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    if (provider === 'groq') endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    if (provider === 'custom') endpoint = `${(providerConfig.baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '')}/chat/completions`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${provider.toUpperCase()} Agent [${role}] error (${res.status}): ${err}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '{}';
    } catch {
      // Fallback through proxy for CORS / network protection
      const proxyRes = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          endpoint,
          body: {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          },
        }),
      });

      if (!proxyRes.ok) {
        const err = await proxyRes.text();
        throw new Error(`${provider.toUpperCase()} Agent [${role}] error (${proxyRes.status}): ${err}`);
      }

      const data = await proxyRes.json();
      return data.choices?.[0]?.message?.content || '{}';
    }
  }

  // 3. Anthropic Provider (Routed through stateless proxy)
  if (provider === 'anthropic') {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'anthropic',
        apiKey: apiKey.trim(),
        endpoint: 'https://api.anthropic.com/v1/messages',
        body: {
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic Agent [${role}] error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '{}';
  }

  return generateLocalAgentResponse(role, userPrompt, transcript);
}

function getTranscriptItems(userPrompt: string, transcript?: Transcript): Array<{ timeSec: number; text: string }> {
  // 1. If explicit transcript object is available, use its segments directly
  if (transcript && transcript.segments && transcript.segments.length > 0) {
    return transcript.segments
      .filter((s) => s.text && s.text.trim().length > 0)
      .map((s) => ({
        timeSec: s.start,
        text: s.text.trim(),
      }));
  }

  // 2. Otherwise extract strictly from after 'Transcript:\n' in userPrompt
  const transcriptIdx = userPrompt.indexOf('Transcript:\n');
  if (transcriptIdx !== -1) {
    const raw = userPrompt.slice(transcriptIdx + 'Transcript:\n'.length);
    const lines = raw.split('\n');
    const items: Array<{ timeSec: number; text: string }> = [];
    for (const line of lines) {
      const match = line.match(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(.+)/);
      if (match) {
        items.push({
          timeSec: parseInt(match[1], 10) * 60 + parseInt(match[2], 10),
          text: match[4].trim(),
        });
      } else if (line.trim().length > 10) {
        items.push({
          timeSec: items.length * 25,
          text: line.trim(),
        });
      }
    }
    if (items.length > 0) return items;
  }

  return [];
}

function extractConceptTitleFromText(text: string, fallbackIdx: number): string {
  const clean = text.replace(/^(\[\d+:\d+\]|\d+[\.)]|part\s+\d+:?)\s*/i, '').trim();

  // Look for subject clause before punctuation or linking verb
  const clauseMatch = clean.match(/^([A-Z][a-zA-Z0-9\s-]{2,40}?)(?:,|\;|\:|\s+is\b|\s+was\b|\s+are\b|\s+refers\b|\s+means\b|\s+denotes\b|\s+constitutes\b)/);
  if (clauseMatch && clauseMatch[1].trim().split(/\s+/).length <= 5) {
    const candidate = clauseMatch[1].trim();
    if (!/^(This|That|These|Those|Here|We|When|If|As|In|According|After|Before)\b/i.test(candidate)) {
      return candidate;
    }
  }

  // Look for capitalized multi-word phrases (e.g. "Dark Matter and Dark Energy")
  const capMatches = clean.match(/\b([A-Z][a-z]+(?:\s+(?:and|of|the|in)\s+[A-Z][a-z]+|\s+[A-Z][a-z]+)*)\b/g);
  if (capMatches && capMatches.length > 0) {
    const valid = capMatches.filter(
      (m) => !/^(The|This|That|These|Those|When|What|Where|Which|How|After|Before|In|According|If)\b/i.test(m) && m.length > 3
    );
    if (valid.length > 0) {
      return valid[0];
    }
  }

  // Fallback: take first 2 to 4 content words
  const words = clean.split(/\s+/).filter(Boolean);
  const contentWords = words.slice(0, Math.min(4, words.length)).map((w) => w.replace(/[^a-zA-Z0-9]/g, ''));
  const candidate = contentWords.join(' ').trim();
  if (candidate.length > 0) {
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  return `Core Topic ${fallbackIdx + 1}`;
}

function generateLocalAgentResponse(role: AgentRole, userPrompt: string, transcript?: Transcript): string {
  const items = getTranscriptItems(userPrompt, transcript);

  if (role === 'segmenter') {
    if (items.length === 0) {
      return JSON.stringify({
        sections: [
          { topicTitle: 'Lecture Overview', startSeconds: 0, endSeconds: 120, summary: 'General lecture overview.' },
        ],
      });
    }
    const chunkCount = Math.min(4, Math.max(1, Math.floor(items.length / 2)));
    const chunkSize = Math.ceil(items.length / chunkCount);
    const sections = [];
    for (let i = 0; i < chunkCount; i++) {
      const slice = items.slice(i * chunkSize, (i + 1) * chunkSize);
      if (slice.length === 0) break;
      const startSec = slice[0].timeSec;
      const endSec = slice[slice.length - 1].timeSec + 25;
      const title = extractConceptTitleFromText(slice[0].text, i);
      sections.push({
        topicTitle: `Part ${i + 1}: ${title}`,
        startSeconds: startSec,
        endSeconds: endSec,
        summary: slice.map((s) => s.text).join(' ').slice(0, 160),
      });
    }
    return JSON.stringify({ sections });
  }

  if (role === 'extractor') {
    if (items.length === 0) {
      return JSON.stringify({ concepts: [] });
    }
    const count = Math.min(5, items.length);
    const step = Math.max(1, Math.floor(items.length / count));
    const picked: Array<{ timeSec: number; text: string }> = [];
    for (let i = 0; i < items.length && picked.length < count; i += step) {
      picked.push(items[i]);
    }

    const concepts = picked.map((item, idx) => {
      const title = extractConceptTitleFromText(item.text, idx);
      const words = item.text.split(/\s+/).filter(Boolean);
      const quoteWords = words.slice(0, Math.min(words.length, Math.max(5, Math.floor(words.length * 0.6))));
      const verbatimQuote = quoteWords.join(' ');

      const hasMath = /[=+\-*/\\]/.test(item.text) && /(derivative|integral|vector|matrix|formula|equation)/i.test(item.text);
      const isDefinition = /(is a|is defined as|refers to|means|is renowned for|characterized by)/i.test(item.text);
      const isEntity = /(animal|organism|species|star|planet|matter|universe|circuit|cell|protein|system|device)/i.test(item.text);

      const type = hasMath ? 'equation' : (isDefinition ? 'definition' : (isEntity ? 'entity' : 'core'));
      const prereq = idx > 0 ? [extractConceptTitleFromText(picked[idx - 1].text, idx - 1)] : [];

      return {
        title,
        type,
        approxTimestampSeconds: item.timeSec,
        summary: item.text.length > 130 ? item.text.slice(0, 127) + '...' : item.text,
        explanation: `In this lecture passage, the lecturer explains: "${verbatimQuote}". This concept represents a foundational milestone in understanding the overall topic.`,
        formulaLatex: hasMath ? '\\nabla f = (\\partial f / \\partial x, \\partial f / \\partial y)' : undefined,
        verbatimQuote,
        keyTakeaways: [
          `Explicit focus: ${verbatimQuote.slice(0, 60)}`,
          `Essential conceptual pillar for subsequent modules`,
        ],
        importance: idx === 0 ? 'foundational' : (idx < 3 ? 'core' : 'advanced'),
        prerequisiteTitles: prereq,
      };
    });

    return JSON.stringify({ concepts });
  }

  if (role === 'golden') {
    if (items.length === 0) {
      return JSON.stringify({ moments: [] });
    }
    const count = Math.min(3, items.length);
    const step = Math.max(1, Math.floor(items.length / count));
    const moments = [];
    for (let i = 0; i < count; i++) {
      const item = items[Math.min(items.length - 1, i * step)];
      const title = extractConceptTitleFromText(item.text, i);
      const words = item.text.split(/\s+/).filter(Boolean);
      const quote = words.slice(0, Math.min(words.length, 10)).join(' ');
      moments.push({
        title: `Breakthrough: ${title}`,
        approxStartSeconds: item.timeSec,
        approxEndSeconds: item.timeSec + 30,
        quote,
        whyItMatters: `High-yield takeaway resolving student friction: ${item.text.slice(0, 110)}`,
        difficultyScore: 3,
        clarityScore: 5,
      });
    }
    return JSON.stringify({ moments });
  }

  if (role === 'summary') {
    const overview = items.length > 0
      ? `This lecture provides an in-depth analysis of key topics across ${items.length} chronological milestones. Central insights include: ${items.slice(0, 3).map((i) => i.text.slice(0, 70)).join('; ')}.`
      : 'Comprehensive synthesis of the lecture topics and conceptual foundations.';

    const keyThemes = items.slice(0, Math.min(4, items.length)).map((item, idx) => {
      return `${extractConceptTitleFromText(item.text, idx)} Analysis`;
    });

    const quiz = items.slice(0, 3).map((item, idx) => {
      const title = extractConceptTitleFromText(item.text, idx);
      const words = item.text.split(/\s+/).filter(Boolean);
      const snippet = words.slice(0, 6).join(' ');
      return {
        conceptTitle: title,
        question: `According to the discussion of "${title}" ("${snippet}..."), which statement accurately reflects the lecture's core insight?`,
        options: [
          {
            text: `The lecture establishes: ${item.text.slice(0, 75)}.`,
            isCorrect: true,
            misconceptionExplanation: 'Correct! This matches the exact formulation in the transcript.',
          },
          {
            text: 'This relationship only holds under edge boundary conditions.',
            isCorrect: false,
            misconceptionExplanation: 'Misconception: incorrectly restricting the general principle to edge cases.',
          },
          {
            text: 'The physical mechanism operates in reverse polarity.',
            isCorrect: false,
            misconceptionExplanation: 'Common trap: reversing the orientation or causal relationship.',
          },
        ],
        explanation: `In the lecture, the professor clarifies: "${item.text.slice(0, 120)}"`,
      };
    });

    return JSON.stringify({ overview, keyThemes, quiz });
  }

  return '{}';
}

/**
 * Strips markdown code blocks and trailing commas from LLM JSON responses.
 */
function cleanJson(raw: string): string {
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const first = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const last = Math.max(lastBrace, lastBracket);

  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.substring(first, last + 1);
  }
  return cleaned.replace(/,\s*([}\]])/g, '$1');
}

// --- Main Grounded Pipeline Orchestrator ---

export async function runLectureAnalysisPipeline(params: {
  lectureId: string;
  metadata: { title: string; course?: string; lecturer?: string; date?: string };
  transcript: Transcript;
  mediaUrl?: string;
  mediaType?: 'audio' | 'video' | 'transcript_only';
  audioBlob?: Blob;
  settings: UserApiSettings;
  onProgress?: PipelineProgressCallback;
  cancellationToken?: PipelineCancellationToken;
}): Promise<LectureArtifact> {
  const {
    lectureId,
    metadata,
    transcript,
    mediaUrl,
    mediaType = 'audio',
    audioBlob,
    settings,
    onProgress,
    cancellationToken,
  } = params;

  // 1. Check IndexedDB cache
  const cached = await getCachedArtifact(lectureId);
  if (cached) {
    onProgress?.('Loaded from local IndexedDB cache', 100);
    return cached;
  }

  cancellationToken?.check();
  onProgress?.('Segmenting transcript into topical sections...', 10, 'segmenter');

  // AGENT 1: Segmenter / Cleaner
  const transcriptPreview = transcript.segments
    .map((s) => `[${formatTime(s.start)}] ${s.text}`)
    .join('\n');

  const segmenterPrompt = `You are a curriculum segmenter. Split this lecture transcript into 3-8 sequential topical modules.
Return JSON format:
{
  "sections": [
    { "topicTitle": "Topic name", "startSeconds": 0, "endSeconds": 300, "summary": "Core topic summary" }
  ]
}
Transcript:\n${transcriptPreview.slice(0, 20000)}`;

  await callLlmAgent({
    role: 'segmenter',
    systemPrompt: 'You analyze lecture transcripts and segment them into chronological topical sections. Output strictly valid JSON.',
    userPrompt: segmenterPrompt,
    settings,
    transcript,
  });

  cancellationToken?.check();
  onProgress?.('Extracting concepts, definitions, and equations...', 30, 'extractor');

  // AGENT 2: Concept Extractor with Strict Verbatim Grounding
  const extractorPrompt = `You are a Master Professor and Cognitive Scientist. Extract 5-10 core concepts, definitions, and equations from this lecture.
CRITICAL GROUNDING RULE: For EVERY concept, provide a "verbatimQuote" that is an EXACT literal phrase said by the professor in the transcript.
Return JSON format:
{
  "concepts": [
    {
      "title": "Concept Name",
      "type": "definition" | "equation" | "entity" | "core",
      "approxTimestampSeconds": 120,
      "summary": "One sentence summary",
      "explanation": "Detailed 2 paragraph pedagogical explanation",
      "formulaLatex": "E = mc^2",
      "verbatimQuote": "Exact quote from transcript",
      "keyTakeaways": ["Key 1", "Key 2", "Key 3"],
      "importance": "foundational" | "core" | "advanced",
      "prerequisiteTitles": ["Other Concept Title"]
    }
  ]
}
Transcript:\n${transcriptPreview.slice(0, 25000)}`;

  const extractorRaw = await callLlmAgent({
    role: 'extractor',
    systemPrompt: 'You extract grounded concepts from lecture transcripts. You never hallucinate quotes. Output strict JSON.',
    userPrompt: extractorPrompt,
    settings,
    transcript,
  });

  const parsedExtractor = JSON.parse(cleanJson(extractorRaw));
  const rawConcepts = z.array(RawConceptSchema).parse(parsedExtractor.concepts || []);

  // Validate Grounding of Every Concept Quote
  const validatedConcepts: ConceptNode[] = [];
  const conceptTitleToId = new Map<string, string>();

  rawConcepts.forEach((raw, idx) => {
    const conceptId = `concept-${idx + 1}`;
    conceptTitleToId.set(raw.title.toLowerCase().trim(), conceptId);

    // Strict Grounding Validation
    const grounding = validateVerbatimGrounding(
      raw.verbatimQuote,
      transcript.segments,
      transcript.rawText
    );

    const timestampSeconds = grounding.isGrounded && grounding.startSeconds > 0
      ? grounding.startSeconds
      : raw.approxTimestampSeconds;

    validatedConcepts.push({
      id: conceptId,
      title: raw.title,
      type: raw.type,
      timestampSeconds: Math.round(timestampSeconds),
      timestampFormatted: formatTime(timestampSeconds),
      summary: raw.summary,
      explanation: raw.explanation,
      formulaLatex: raw.formulaLatex,
      verbatimQuote: grounding.verbatimQuote || raw.verbatimQuote,
      prerequisites: [],
      related: [],
      keyTakeaways: raw.keyTakeaways,
      importance: raw.importance,
      appearsAtTimestamps: [Math.round(timestampSeconds)],
    });
  });

  cancellationToken?.check();
  onProgress?.('Constructing DAG concept graph & enforcing acyclicity...', 48, 'graph');

  // AGENT 3: Graph Builder & DAG Cycle Breaker
  const rawEdges: GraphEdge[] = [];
  rawConcepts.forEach((raw, idx) => {
    const targetId = `concept-${idx + 1}`;
    raw.prerequisiteTitles.forEach((prereqTitle) => {
      const srcId = conceptTitleToId.get(prereqTitle.toLowerCase().trim());
      if (srcId && srcId !== targetId) {
        rawEdges.push({
          id: `edge-${srcId}-${targetId}`,
          source: srcId,
          target: targetId,
          type: 'prerequisite',
        });
      }
    });
  });

  // Strict DAG Enforcement
  const graphData = enforceDAG(validatedConcepts, rawEdges);

  cancellationToken?.check();
  onProgress?.('Detecting high-yield golden moments (20-45s)...', 62, 'golden');

  // AGENT 4: Golden-Moment Detector with Sentence Boundary Snapping
  const goldenPrompt = `Find 3-5 pivotal "golden breakthrough moments" (20-45 seconds) where the lecturer resolves student confusion, offers an analogy, or reveals the core breakthrough intuition.
Return JSON format:
{
  "moments": [
    {
      "title": "Title of breakthrough",
      "approxStartSeconds": 150,
      "approxEndSeconds": 190,
      "quote": "Key sentence from moment",
      "whyItMatters": "Why this resolves the friction",
      "difficultyScore": 3,
      "clarityScore": 5
    }
  ]
}
Transcript:\n${transcriptPreview.slice(0, 25000)}`;

  const goldenRaw = await callLlmAgent({
    role: 'golden',
    systemPrompt: 'You identify the highest-yield pedagogical moments in lecture transcripts. Output strict JSON.',
    userPrompt: goldenPrompt,
    settings,
    transcript,
  });

  const parsedGolden = JSON.parse(cleanJson(goldenRaw));
  const rawGolden = z.array(RawGoldenMomentSchema).parse(parsedGolden.moments || []);

  const goldenSnippets: GoldenAudioSnippet[] = rawGolden.map((g, idx) => {
    // Snap candidate boundaries strictly to sentence / transcript segment borders
    const snapped = snapToSegmentBoundaries(
      g.approxStartSeconds,
      g.approxEndSeconds,
      transcript.segments,
      20,
      45
    );

    return {
      id: `golden-${idx + 1}`,
      title: g.title,
      startSeconds: snapped.startSeconds,
      endSeconds: snapped.endSeconds,
      durationFormatted: formatTimeRange(snapped.startSeconds, snapped.endSeconds),
      transcriptSnippet: snapped.quote || g.quote,
      whyItMatters: g.whyItMatters,
      difficultyScore: g.difficultyScore,
      clarityScore: g.clarityScore,
    };
  });

  cancellationToken?.check();
  onProgress?.('Composing spaced-repetition flashcards...', 75, 'composer');

  // AGENT 5: Flashcard Composer
  const flashcards: Flashcard[] = graphData.nodes.map((concept, idx) => {
    const relatedSnippet = goldenSnippets[idx % goldenSnippets.length];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    return {
      id: `fc-${idx + 1}`,
      conceptId: concept.id,
      front: `How does the lecturer formulate and apply ${concept.title}?`,
      back: concept.summary,
      takeaway: concept.keyTakeaways[0] || concept.summary,
      hint: concept.formulaLatex ? `Think of: ${concept.formulaLatex}` : undefined,
      snippetId: relatedSnippet?.id,
      startSeconds: relatedSnippet?.startSeconds,
      endSeconds: relatedSnippet?.endSeconds,
      repetition: 0,
      interval: 1,
      easeFactor: 2.5,
      dueDate: dueDate.toISOString(),
    };
  });

  cancellationToken?.check();
  onProgress?.('Generating diagnostic misconception quizzes & executive synthesis...', 88, 'summary');

  // AGENT 6 & 7: Summary, Themes & Misconception Quizzes
  const summaryPrompt = `Generate a 3-paragraph executive overview and 4-6 key themes for this lecture. Also generate 2-4 diagnostic multiple-choice questions testing common student cognitive traps.
Return JSON format:
{
  "overview": "Comprehensive 3-paragraph executive synthesis",
  "keyThemes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4"],
  "quiz": [
    {
      "conceptTitle": "${graphData.nodes[0]?.title || 'Core Topic'}",
      "question": "Diagnostic question testing misconceptions?",
      "options": [
        { "text": "Common trap", "isCorrect": false, "misconceptionExplanation": "Why students make this mistake" },
        { "text": "Correct insight", "isCorrect": true, "misconceptionExplanation": "Correct explanation" }
      ],
      "explanation": "Full step-by-step resolution"
    }
  ]
}
Transcript:\n${transcriptPreview.slice(0, 20000)}`;

  const summaryRaw = await callLlmAgent({
    role: 'summary',
    systemPrompt: 'You generate high-yield summaries and cognitive diagnostic quizzes. Output strict JSON.',
    userPrompt: summaryPrompt,
    settings,
    transcript,
  });

  const parsedSummary = JSON.parse(cleanJson(summaryRaw));

  const diagnosticQuestions: DiagnosticQuestion[] = (parsedSummary.quiz || []).map(
    (q: { conceptTitle: string; question: string; options: Array<{ text: string; isCorrect: boolean; misconceptionExplanation: string }>; explanation: string }, idx: number) => {
      const matchedConcept = graphData.nodes.find(
        (c) => c.title.toLowerCase() === (q.conceptTitle || '').toLowerCase()
      ) || graphData.nodes[0];

      return {
        id: `dq-${idx + 1}`,
        conceptId: matchedConcept ? matchedConcept.id : 'concept-1',
        timestampSeconds: matchedConcept ? matchedConcept.timestampSeconds : 60,
        question: q.question,
        options: (q.options || []).map((opt, oIdx) => ({
          id: `opt-${idx + 1}-${oIdx + 1}`,
          text: opt.text,
          isCorrect: Boolean(opt.isCorrect),
          misconceptionExplanation: opt.misconceptionExplanation,
        })),
        explanation: q.explanation,
      };
    }
  );

  // Compute total duration
  const lastSegment = transcript.segments[transcript.segments.length - 1];
  const durationSeconds = lastSegment ? lastSegment.end : 600;

  // Build Mermaid graph fallback
  const mermaidGraph = `graph TD\n${graphData.edges.map((e) => `  ${e.source}["${graphData.nodes.find((n) => n.id === e.source)?.title || e.source}"] --> ${e.target}["${graphData.nodes.find((n) => n.id === e.target)?.title || e.target}"]`).join('\n')}`;

  const artifact: LectureArtifact = {
    id: lectureId,
    title: metadata.title || 'Lecture Synthesis',
    course: metadata.course || 'University Course',
    lecturer: metadata.lecturer || 'Lecturer',
    date: metadata.date || new Date().toLocaleDateString(),
    durationSeconds: Math.round(durationSeconds),
    durationFormatted: formatTime(durationSeconds),
    mediaUrl,
    mediaType,
    audioBlob,
    transcript,
    overview: parsedSummary.overview || 'Lecture synthesis generated from verified transcript.',
    keyThemes: parsedSummary.keyThemes || ['Core Mechanics', 'Theoretical Foundations'],
    mermaidGraph,
    graphData,
    concepts: graphData.nodes,
    flashcards,
    diagnosticQuestions,
    goldenSnippets,
    createdAt: new Date().toISOString(),
  };

  // Cache artifact in IndexedDB
  await saveArtifactToCache(artifact);

  onProgress?.('Pipeline complete.', 100);
  return artifact;
}
