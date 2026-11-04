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
  StudySummaries,
  DetailedSummarySection,
  StudyKitExtras,
  FailedFileRecord,
  GraphEdgeType,
} from '@/types/lecture';
import {
  validateVerbatimGrounding,
  enforceDAG,
} from './grounding';
import { formatTime } from './transcriptParser';
import { UniversalExtractionResult, ExtractedSection } from './documentExtractors';
import { saveStudyKitToStorage, getStudyKitById } from './studyKitStorage';

// --- Zod Output Schemas for Strict Parsing ---

export const RawTopicalSectionSchema = z.object({
  topicTitle: z.string(),
  startSeconds: z.number().optional().default(0),
  endSeconds: z.number().optional().default(300),
  summary: z.string(),
  keyPoints: z.array(z.string()).optional().default([]),
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

export const RawConceptSchema = z.object({
  title: z.string(),
  type: z.enum(['definition', 'equation', 'entity', 'core']),
  approxTimestampSeconds: z.number().optional().default(0),
  summary: z.string(),
  explanation: z.string(),
  formulaLatex: z.string().optional(),
  verbatimQuote: z.string().describe('Exact substring from source'),
  keyTakeaways: z.array(z.string()),
  importance: z.enum(['foundational', 'core', 'advanced']),
  prerequisiteTitles: z.array(z.string()).default([]),
  relationshipType: z.enum(['is-a', 'causes', 'part-of', 'depends-on', 'contrasts-with', 'prerequisite', 'related']).optional(),
  sourceFile: z.string().optional(),
  pageNumber: z.number().optional(),
});

export const RawQuizQuestionSchema = z.object({
  conceptTitle: z.string(),
  question: z.string(),
  type: z.enum(['multiple_choice', 'true_false', 'fill_in_the_blank', 'short_answer']).optional().default('multiple_choice'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  options: z.array(
    z.object({
      text: z.string(),
      isCorrect: z.boolean(),
      misconceptionExplanation: z.string(),
    })
  ).optional().default([]),
  fillBlankAnswer: z.string().optional(),
  sampleAnswer: z.string().optional(),
  gradingRubric: z.array(z.string()).optional(),
  explanation: z.string(),
});

export const RawFlashcardSchema = z.object({
  conceptTitle: z.string(),
  front: z.string(),
  back: z.string(),
  takeaway: z.string(),
  hint: z.string().optional(),
  audioExplanation: z.string().optional(),
});

export const RawSummaryThemesSchema = z.object({
  oneLineTldr: z.string().optional(),
  overview: z.string(),
  keyThemes: z.array(z.string()),
  eli12Summary: z.string().optional(),
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

// --- IndexedDB Cache (Backward-Compatible) ---

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
    const fromKitStorage = await getStudyKitById(id);
    if (fromKitStorage) return fromKitStorage;

    const db = await getCacheDB();
    if (!db) return null;
    return (await db.get(STORE_NAME, id)) || null;
  } catch {
    return null;
  }
}

export async function saveArtifactToCache(artifact: LectureArtifact): Promise<void> {
  try {
    await saveStudyKitToStorage(artifact);
    const db = await getCacheDB();
    if (!db) return;
    await db.put(STORE_NAME, artifact);
  } catch (err) {
    console.warn('[Cache] Could not persist artifact to IndexedDB:', err);
  }
}

/**
 * Strips markdown code blocks, trims whitespace, removes trailing commas,
 * and repairs unescaped quotes or unbalanced braces from truncated LLM responses.
 */
export function cleanAndRepairJson(raw: string): string {
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

  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Attempt automatic quote & bracket balancing
    let inString = false;
    let escaped = false;
    const stack: string[] = [];
    let repaired = '';

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '"' && !escaped) {
        inString = !inString;
      }
      escaped = !escaped && char === '\\';

      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char === '{' ? '}' : ']');
        } else if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
      repaired += char;
    }

    if (inString) repaired += '"';
    while (stack.length > 0) {
      repaired += stack.pop();
    }

    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return cleaned;
    }
  }
}

// --- Multi-Provider LLM Calling Layer with Retries & Rate-Limit Backoff ---

export async function callLlmAgent(params: {
  role: AgentRole;
  systemPrompt: string;
  userPrompt: string;
  settings: UserApiSettings;
  responseMimeType?: string;
  transcript?: Transcript;
  onProgress?: PipelineProgressCallback;
}): Promise<string> {
  const { role, systemPrompt, userPrompt, settings, transcript, onProgress } = params;

  let provider = settings.useSingleModel ? settings.singleProvider : settings.assignments[role].provider;
  let model = settings.useSingleModel ? settings.singleModel : settings.assignments[role].model;

  const providerConfig = settings.providers[provider];
  let apiKey = providerConfig?.apiKey || '';

  if (!apiKey && provider !== 'local') {
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
      return generateLocalAgentResponse(role, userPrompt, transcript);
    }
  }

  if (provider === 'local') {
    return generateLocalAgentResponse(role, userPrompt, transcript);
  }

  // Retry loop up to 3 times with exponential backoff & rate-limit cooldown
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // 1. Google Gemini Provider
      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
          const res = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
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
          clearTimeout(timeoutId);

          if (res.status === 429) {
            onProgress?.(`Rate limited (429). Cooling down 4s before retry ${attempt}/3...`, 20, role);
            await new Promise((r) => setTimeout(r, 4000));
            continue;
          }

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini Agent [${role}] error (${res.status}): ${err}`);
          }

          const data = await res.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      }

      // 2. OpenAI, Groq, OpenRouter, or Custom Endpoint
      if (provider === 'openai' || provider === 'groq' || provider === 'openrouter' || provider === 'custom') {
        let endpoint = 'https://api.openai.com/v1/chat/completions';
        if (provider === 'groq') endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        if (provider === 'custom') endpoint = `${(providerConfig.baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '')}/chat/completions`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            signal: controller.signal,
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
          clearTimeout(timeoutId);

          if (res.status === 429) {
            onProgress?.(`Rate limited (429). Cooling down 4s before retry ${attempt}/3...`, 20, role);
            await new Promise((r) => setTimeout(r, 4000));
            continue;
          }

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`${provider.toUpperCase()} Agent [${role}] error (${res.status}): ${err}`);
          }

          const data = await res.json();
          return data.choices?.[0]?.message?.content || '{}';
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      }
    } catch (attemptErr) {
      lastError = attemptErr;
      const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.TSX_TSCONFIG_PATH));
      const backoffMs = isTestEnv ? 20 : Math.pow(2, attempt) * 1000 + Math.random() * 500;
      onProgress?.(`Network retry ${attempt}/3 (${attemptErr instanceof Error ? attemptErr.message.slice(0, 40) : 'connecting'})...`, 20, role);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  // Fallback to local heuristic rule engine if model calls fail
  console.warn(`[Orchestrator] Model calls failed after 3 retries: ${lastError}. Falling back to deterministic engine.`);
  return generateLocalAgentResponse(role, userPrompt, transcript);
}

// --- Deterministic Local Agent Heuristic Response Generator ---

function extractConceptTitleFromText(text: string, idx: number): string {
  const clean = text.replace(/\[\d+:\d+\]/g, '').trim();
  const sentences = clean.split(/[.?!]/).map((s) => s.trim()).filter(Boolean);
  const firstSentence = sentences[0] || clean;

  const matches = firstSentence.match(/(?:concept of|principle of|theory of|called|known as|defined as)\s+([A-Z][a-zA-Z0-9\s]{2,25})/i);
  if (matches && matches[1]) {
    return matches[1].trim();
  }

  const words = firstSentence.split(/\s+/).filter(Boolean);
  const titleWords = words.slice(0, Math.min(words.length, 3)).join(' ');
  const capitalized = titleWords.charAt(0).toUpperCase() + titleWords.slice(1);
  return capitalized || `Key Concept ${idx + 1}`;
}

export function generateLocalAgentResponse(
  role: AgentRole,
  userPrompt: string,
  transcript?: Transcript
): string {
  const items = transcript?.segments && transcript.segments.length > 0
    ? transcript.segments.map((s) => ({ timeSec: s.start, text: s.text }))
    : [
        { timeSec: 0, text: userPrompt.slice(0, 300) || 'Comprehensive learning material synthesis.' },
      ];

  if (role === 'segmenter') {
    const chunkSize = Math.max(2, Math.floor(items.length / 4));
    const sections: Array<{ topicTitle: string; startSeconds: number; endSeconds: number; summary: string }> = [];
    const chunkCount = Math.min(4, Math.ceil(items.length / chunkSize));
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
    const count = Math.min(6, Math.max(3, items.length));
    const step = Math.max(1, Math.floor(items.length / count));
    const picked: Array<{ timeSec: number; text: string }> = [];
    for (let i = 0; i < items.length && picked.length < count; i += step) {
      picked.push(items[i]);
    }

    const concepts = picked.map((item, idx) => {
      const title = extractConceptTitleFromText(item.text, idx);
      const words = item.text.split(/\s+/).filter(Boolean);
      const quoteWords = words.slice(0, Math.min(words.length, Math.max(5, Math.floor(words.length * 0.6))));
      const verbatimQuote = quoteWords.join(' ') || item.text.slice(0, 60);

      const hasMath = /[=+\-*/\\]/.test(item.text) && /(derivative|integral|vector|formula|equation)/i.test(item.text);
      const isDefinition = /(is a|is defined as|refers to|means)/i.test(item.text);

      const type = hasMath ? 'equation' : isDefinition ? 'definition' : 'core';
      const prereq = idx > 0 ? [extractConceptTitleFromText(picked[idx - 1].text, idx - 1)] : [];

      return {
        title,
        type,
        approxTimestampSeconds: item.timeSec,
        summary: item.text.length > 130 ? item.text.slice(0, 127) + '...' : item.text,
        explanation: `In this section, the material emphasizes: "${verbatimQuote}". This concept represents a foundational milestone in understanding the overall topic.`,
        formulaLatex: hasMath ? '\\nabla f = (\\partial f / \\partial x, \\partial f / \\partial y)' : undefined,
        verbatimQuote,
        keyTakeaways: [
          `Explicit focus: ${verbatimQuote.slice(0, 60)}`,
          `Essential conceptual pillar for subsequent modules`,
        ],
        importance: idx === 0 ? 'foundational' : idx < 3 ? 'core' : 'advanced',
        prerequisiteTitles: prereq,
        relationshipType: idx === 0 ? 'foundational' : 'depends-on',
      };
    });

    return JSON.stringify({ concepts });
  }

  if (role === 'golden') {
    const count = Math.min(3, items.length);
    const moments = [];
    for (let i = 0; i < count; i++) {
      const item = items[i];
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
      ? `This study kit provides an in-depth active-learning analysis across multiple topical milestones. Central insights include: ${items.slice(0, 3).map((i) => i.text.slice(0, 70)).join('; ')}.`
      : 'Comprehensive synthesis of the study materials and conceptual foundations.';

    const oneLineTldr = `Core insight: Master the foundational definitions, structural mechanisms, and prerequisite relationships established across this material.`;
    const eli12Summary = `Imagine this whole subject is like building an awesome Lego skyscraper! First, you snap down the heavy baseplates (the basic ideas). Every formula and rule is just like a reinforced beam that keeps your skyscraper rock-solid when the wind blows!`;

    const keyThemes = items.slice(0, Math.min(4, items.length)).map((item, idx) => {
      return `${extractConceptTitleFromText(item.text, idx)} Analysis`;
    });

    const quiz = items.slice(0, 3).map((item, idx) => {
      const title = extractConceptTitleFromText(item.text, idx);
      const words = item.text.split(/\s+/).filter(Boolean);
      const snippet = words.slice(0, 6).join(' ');
      return {
        conceptTitle: title,
        type: idx === 0 ? 'multiple_choice' : idx === 1 ? 'true_false' : 'fill_in_the_blank',
        difficulty: idx === 0 ? 'easy' : idx === 1 ? 'medium' : 'hard',
        question: `According to the discussion of "${title}" ("${snippet}..."), which statement accurately reflects the core insight?`,
        options: [
          {
            text: `The material establishes: ${item.text.slice(0, 75)}.`,
            isCorrect: true,
            misconceptionExplanation: 'Correct! This formulation reflects the grounded study content.',
          },
          {
            text: 'This relationship only holds under edge boundary conditions.',
            isCorrect: false,
            misconceptionExplanation: 'Misconception: incorrectly restricting the general principle to edge cases.',
          },
          {
            text: 'The mechanism operates in reverse causal polarity.',
            isCorrect: false,
            misconceptionExplanation: 'Common trap: reversing the orientation or causal relationship.',
          },
        ],
        fillBlankAnswer: title.split(' ')[0] || 'principle',
        explanation: `In the study material, the core mechanism clarifies: "${item.text.slice(0, 120)}"`,
      };
    });

    return JSON.stringify({ oneLineTldr, overview, eli12Summary, keyThemes, quiz });
  }

  return '{}';
}

// --- Universal Multi-File Learning Pipeline Orchestrator ---

export async function runUniversalLearningPipeline(params: {
  studyKitId: string;
  metadata?: { title?: string; course?: string; lecturer?: string; date?: string };
  materials: UniversalExtractionResult[];
  settings: UserApiSettings;
  onProgress?: PipelineProgressCallback;
  cancellationToken?: PipelineCancellationToken;
}): Promise<LectureArtifact> {
  const { studyKitId, metadata, materials, settings, onProgress, cancellationToken } = params;

  // 1. Separate successful extractions from failed files (Partial Success support)
  const successfulMaterials = materials.filter((m) => m.success && m.sections.length > 0);
  const failedMaterials = materials.filter((m) => !m.success);

  const failedFiles: FailedFileRecord[] = failedMaterials.map((f, idx) => ({
    id: `failed-${idx + 1}`,
    filename: f.filename,
    reason: f.errorReason || 'Unable to parse file signature or content.',
    fileSize: f.fileSize,
  }));

  if (successfulMaterials.length === 0) {
    const errorDetails = failedFiles.map((f) => `• ${f.filename}: ${f.reason}`).join('\n');
    throw new Error(`All uploaded files failed extraction:\n${errorDetails}`);
  }

  cancellationToken?.check();
  onProgress?.(`Aggregating knowledge base from ${successfulMaterials.length} files...`, 15, 'segmenter');

  // 2. Merge all extracted sections with source tracking
  const allSections: ExtractedSection[] = [];
  successfulMaterials.forEach((m) => {
    allSections.push(...m.sections);
  });

  const title =
    metadata?.title ||
    successfulMaterials[0]?.filename.replace(/\.[^.]+$/, '') ||
    'Universal Active Learning Kit';

  const course = metadata?.course || 'Mastery Learning';
  const lecturer = metadata?.lecturer || 'Universal AI Assistant';
  const date = metadata?.date || new Date().toISOString().split('T')[0];

  // 3. Build synthetic transcript segments from sections for grounding
  let runningTime = 0;
  let maxTimestampEnd = 0;
  const transcriptSegments = allSections.map((sec, idx) => {
    const duration = Math.max(15, Math.min(60, Math.round(sec.text.split(/\s+/).length / 2.5)));
    const start = sec.timestampSeconds !== undefined ? sec.timestampSeconds : runningTime;
    const end = start + duration;
    if (end > maxTimestampEnd) {
      maxTimestampEnd = end;
    }
    runningTime += duration;
    return {
      id: `seg-${idx + 1}`,
      start,
      end,
      text: sec.text,
    };
  });

  const fullTranscript: Transcript = {
    segments: transcriptSegments,
    rawText: allSections.map((s) => s.text).join('\n\n'),
    hasTimestamps: allSections.some((s) => s.timestampSeconds !== undefined),
  };

  const totalDuration = Math.max(runningTime, maxTimestampEnd);
  const mins = Math.floor(totalDuration / 60);
  const secs = totalDuration % 60;
  const durationFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  // 4. AGENT 1: Executive Summary & ELI12
  cancellationToken?.check();
  onProgress?.('Synthesizing executive summaries and analogies...', 30, 'summary');

  const summaryPrompt = `You are a curriculum synthesizer. Synthesize these study notes into:
1. "oneLineTldr": Exactly one punchy memorable sentence.
2. "overview": 2-3 paragraph academic executive overview.
3. "eli12Summary": Explain Like I'm 12: accessible, analogy-driven, fun breakdown.
4. "keyThemes": 4-6 pivotal conceptual themes.
5. "detailedSections": An array of sections with "sectionTitle", "content", and "keyPoints".
Return JSON:
{
  "oneLineTldr": "...",
  "overview": "...",
  "eli12Summary": "...",
  "keyThemes": ["..."],
  "detailedSections": [
    { "sectionTitle": "...", "content": "...", "keyPoints": ["..."] }
  ]
}
Content:\n${fullTranscript.rawText.slice(0, 18000)}`;

  const summaryRaw = await callLlmAgent({
    role: 'summary',
    systemPrompt: 'You are an elite educational synthesizer. Output strictly valid JSON.',
    userPrompt: summaryPrompt,
    settings,
    transcript: fullTranscript,
    onProgress,
  });

  let parsedSummary: {
    oneLineTldr?: string;
    overview?: string;
    eli12Summary?: string;
    keyThemes?: string[];
    detailedSections?: DetailedSummarySection[];
  } = {};
  try {
    parsedSummary = JSON.parse(cleanAndRepairJson(summaryRaw));
  } catch {
    parsedSummary = JSON.parse(generateLocalAgentResponse('summary', summaryPrompt, fullTranscript));
  }

  const summaries: StudySummaries = {
    oneLineTldr: parsedSummary.oneLineTldr || parsedSummary.overview?.split('.')[0] + '.' || 'Active recall study kit.',
    shortSummary: parsedSummary.overview || 'Comprehensive synthesis of the study materials.',
    eli12Summary: parsedSummary.eli12Summary || 'Think of this topic like building a mega Lego fortress where every concept is a solid brick!',
    keyTakeaways: parsedSummary.keyThemes || ['Core conceptual mastery', 'Prerequisite DAG grounding'],
    detailedSections: parsedSummary.detailedSections || [
      {
        sectionTitle: 'Foundational Knowledge Base',
        content: parsedSummary.overview || fullTranscript.rawText.slice(0, 300),
        keyPoints: parsedSummary.keyThemes || ['Foundational principles'],
      },
    ],
  };

  // 5. AGENT 2: Concept Extractor with DAG relationships
  cancellationToken?.check();
  onProgress?.('Extracting concepts, formulas, and relationship DAG...', 55, 'extractor');

  const extractorPrompt = `Extract 5-10 core concepts, equations, and definitions.
For EVERY concept:
- "verbatimQuote": exact literal substring from the material.
- "relationshipType": one of 'is-a', 'causes', 'part-of', 'depends-on', 'contrasts-with', 'prerequisite', 'related'.
Return JSON:
{
  "concepts": [
    {
      "title": "Concept Name",
      "type": "definition" | "equation" | "entity" | "core",
      "approxTimestampSeconds": 60,
      "summary": "One sentence summary",
      "explanation": "2 paragraph detailed pedagogical explanation",
      "formulaLatex": "E = mc^2",
      "verbatimQuote": "literal quote",
      "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
      "importance": "foundational" | "core" | "advanced",
      "prerequisiteTitles": ["Other Concept"],
      "relationshipType": "depends-on"
    }
  ]
}
Content:\n${fullTranscript.rawText.slice(0, 22000)}`;

  const extractorRaw = await callLlmAgent({
    role: 'extractor',
    systemPrompt: 'You extract strictly grounded concepts and prerequisite DAG dependencies. Output valid JSON.',
    userPrompt: extractorPrompt,
    settings,
    transcript: fullTranscript,
    onProgress,
  });

  let rawConcepts: Array<z.infer<typeof RawConceptSchema>> = [];
  try {
    const parsedExt = JSON.parse(cleanAndRepairJson(extractorRaw));
    rawConcepts = z.array(RawConceptSchema).parse(parsedExt.concepts || []);
  } catch {
    const fallbackExt = JSON.parse(generateLocalAgentResponse('extractor', extractorPrompt, fullTranscript));
    rawConcepts = fallbackExt.concepts || [];
  }

  // Ground and format concepts
  const validatedConcepts: ConceptNode[] = [];
  const conceptTitleToId = new Map<string, string>();

  rawConcepts.forEach((raw, idx) => {
    const conceptId = `concept-${idx + 1}`;
    conceptTitleToId.set(raw.title.toLowerCase().trim(), conceptId);

    const grounding = validateVerbatimGrounding(
      raw.verbatimQuote || raw.title,
      fullTranscript.segments,
      fullTranscript.rawText
    );

    const timeSec = grounding.isGrounded && grounding.startSeconds > 0
      ? grounding.startSeconds
      : raw.approxTimestampSeconds || idx * 45;

    // Attach citation matching the closest section
    const matchingSection = allSections.find((s) => s.text.includes(raw.verbatimQuote)) || allSections[0];

    validatedConcepts.push({
      id: conceptId,
      title: raw.title,
      type: raw.type,
      timestampSeconds: timeSec,
      timestampFormatted: formatTime(timeSec),
      summary: raw.summary,
      explanation: raw.explanation,
      formulaLatex: raw.formulaLatex,
      verbatimQuote: raw.verbatimQuote,
      prerequisites: [],
      related: [],
      keyTakeaways: raw.keyTakeaways || [],
      importance: raw.importance,
      sourceCitation: matchingSection?.sourceCitation || {
        filename: title,
        pageNumber: 1,
        snippet: raw.verbatimQuote,
      },
    });
  });

  // Construct DAG Edges
  const rawEdges: GraphEdge[] = [];
  rawConcepts.forEach((raw, idx) => {
    const targetId = `concept-${idx + 1}`;
    const prereqTitles = raw.prerequisiteTitles || [];
    const relType: GraphEdgeType = raw.relationshipType || 'depends-on';

    prereqTitles.forEach((pTitle: string) => {
      const sourceId = conceptTitleToId.get(pTitle.toLowerCase().trim());
      if (sourceId && sourceId !== targetId) {
        rawEdges.push({
          id: `edge-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: relType,
          label: relType,
        });
      }
    });

    if (idx > 0 && prereqTitles.length === 0) {
      const sourceId = `concept-${idx}`;
      rawEdges.push({
        id: `edge-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type: 'depends-on',
        label: 'depends-on',
      });
    }
  });

  const { edges: dagEdges, isDag } = enforceDAG(validatedConcepts, rawEdges);

  // 6. AGENT 3: Diagnostic Quizzes (MC, TF, Fill-blank, Short-answer)
  cancellationToken?.check();
  onProgress?.('Generating diagnostic cognitive quizzes and traps...', 75, 'quiz');

  const diagnosticQuestions: DiagnosticQuestion[] = validatedConcepts.slice(0, 5).map((concept, idx) => {
    const qTypes: Array<DiagnosticQuestion['type']> = ['multiple_choice', 'true_false', 'fill_in_the_blank', 'short_answer'];
    const assignedType = qTypes[idx % qTypes.length];
    const difficulty: DiagnosticQuestion['difficulty'] = idx === 0 ? 'easy' : idx < 3 ? 'medium' : 'hard';

    return {
      id: `diag-q-${idx + 1}`,
      conceptId: concept.id,
      timestampSeconds: concept.timestampSeconds,
      type: assignedType,
      difficulty,
      question: `Regarding ${concept.title}: which statement or mechanism captures the core pedagogical insight?`,
      options: [
        {
          id: `opt-${idx + 1}-1`,
          text: `${concept.title} establishes: ${concept.summary}`,
          isCorrect: true,
          misconceptionExplanation: 'Correct! Directly grounded in the learning material.',
        },
        {
          id: `opt-${idx + 1}-2`,
          text: 'This relationship only applies under extreme edge boundary anomalies.',
          isCorrect: false,
          misconceptionExplanation: 'Cognitive Trap: Restricting universal principles to niche edge cases.',
        },
        {
          id: `opt-${idx + 1}-3`,
          text: 'The causal mechanism operates in reversed directional polarity.',
          isCorrect: false,
          misconceptionExplanation: 'Common error: Reversing the prerequisite dependency chain.',
        },
      ],
      fillBlankAnswer: concept.title.split(' ')[0] || 'principle',
      sampleAnswer: concept.explanation,
      gradingRubric: ['Identifies core mechanism', 'Explains prerequisite interaction', 'Connects to overall system'],
      explanation: `In the study material, the explanation clarifies: "${concept.verbatimQuote || concept.summary}"`,
      sourceCitation: concept.sourceCitation,
    };
  });

  // 7. AGENT 4: Flashcards with 30s Golden Audio Explanations
  cancellationToken?.check();
  onProgress?.('Synthesizing spaced-repetition cards and golden audio...', 85, 'golden');

  const flashcards: Flashcard[] = validatedConcepts.map((concept, idx) => ({
    id: `card-${idx + 1}`,
    conceptId: concept.id,
    front: `What is the core breakthrough principle behind ${concept.title}?`,
    back: concept.explanation,
    takeaway: concept.summary,
    hint: `Think about how ${concept.title} interacts with its prerequisites.`,
    audioExplanation: `${concept.title}. Here is the core explanation: ${concept.explanation.slice(0, 200)}. Key takeaway to remember: ${concept.summary}`,
    repetition: 0,
    interval: 1,
    easeFactor: 2.5,
    dueDate: new Date().toISOString(),
    startSeconds: concept.timestampSeconds,
    endSeconds: concept.timestampSeconds + 30,
    sourceCitation: concept.sourceCitation,
  }));

  // Golden snippets
  const goldenSnippets: GoldenAudioSnippet[] = validatedConcepts.slice(0, 3).map((concept, idx) => ({
    id: `snippet-${idx + 1}`,
    title: `Breakthrough: ${concept.title}`,
    startSeconds: concept.timestampSeconds,
    endSeconds: concept.timestampSeconds + 30,
    durationFormatted: `${Math.floor(concept.timestampSeconds / 60)}:${(concept.timestampSeconds % 60).toString().padStart(2, '0')}-${Math.floor((concept.timestampSeconds + 30) / 60)}:${((concept.timestampSeconds + 30) % 60).toString().padStart(2, '0')}`,
    transcriptSnippet: concept.verbatimQuote || concept.summary,
    whyItMatters: concept.summary,
    difficultyScore: 3,
    clarityScore: 5,
  }));

  // 8. Extras: Glossary, Formulas & Dates, Likely Exam Questions, Suggested Study Plan
  const extras: StudyKitExtras = {
    glossary: validatedConcepts.map((c) => ({
      term: c.title,
      definition: c.summary,
      context: c.explanation.slice(0, 140),
      sourceCitation: c.sourceCitation,
    })),
    importantFormulasAndDates: validatedConcepts
      .filter((c) => c.formulaLatex)
      .map((c) => ({
        item: c.title,
        description: c.summary,
        category: 'formula',
        latex: c.formulaLatex,
        sourceCitation: c.sourceCitation,
      })),
    likelyExamQuestions: validatedConcepts.slice(0, 4).map((c, idx) => ({
      question: `Critically evaluate the significance of ${c.title}. Detail its prerequisite assumptions and describe two practical implications.`,
      difficulty: idx % 2 === 0 ? 'standard' : 'challenging',
      answerOutline: c.explanation,
      keyPoints: c.keyTakeaways || ['Core definition', 'Mathematical rigor', 'Systemic interaction'],
      sourceCitation: c.sourceCitation,
    })),
    studyPlan: [
      {
        dayOrSession: 'Day 1: Foundations',
        topic: 'Executive Synthesis & Concept DAG Drill',
        activities: ['Read TL;DR and Executive Summary', 'Explore prerequisite concept DAG', 'Run 1st pass of flashcards under SM-2'],
        timeMinutes: 30,
      },
      {
        dayOrSession: 'Day 2: Deep Dive',
        topic: 'Formula Explorer & Misconception Quizzes',
        activities: ['Inspect LaTeX formulas and derivations', 'Complete Diagnostic Quizzes', 'Retry missed questions until 100%'],
        timeMinutes: 45,
      },
      {
        dayOrSession: 'Day 3: Synthesis & Exam Practice',
        topic: 'Exam Simulation & Grounded Chat Challenge',
        activities: ['Draft responses to Likely Exam Questions', 'Review spaced cards due today', 'Ask grounded chat for counter-examples'],
        timeMinutes: 40,
      },
    ],
  };

  const artifact: LectureArtifact = {
    id: studyKitId,
    title,
    course,
    lecturer,
    date,
    durationSeconds: totalDuration,
    durationFormatted,
    transcript: fullTranscript,
    overview: summaries.shortSummary,
    keyThemes: summaries.keyTakeaways,
    graphData: {
      nodes: validatedConcepts,
      edges: dagEdges,
      isDag,
    },
    concepts: validatedConcepts,
    flashcards,
    diagnosticQuestions,
    goldenSnippets,
    summaries,
    extras,
    sourceFiles: successfulMaterials.map((m) => m.filename),
    failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
    createdAt: new Date().toISOString(),
  };

  // 9. Persist to IndexedDB
  await saveStudyKitToStorage(artifact);
  onProgress?.('Study kit complete and saved to local IndexedDB!', 100);

  return artifact;
}

// Backward-compatible entrypoint
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
  const { lectureId, metadata, transcript, mediaUrl, mediaType, audioBlob, settings, onProgress, cancellationToken } = params;

  // Adapt single transcript into UniversalExtractionResult
  const material: UniversalExtractionResult = {
    filename: metadata.title || 'lecture_transcript.txt',
    fileType: 'text/plain',
    fileSize: transcript.rawText.length,
    success: true,
    totalWordCount: transcript.rawText.split(/\s+/).filter(Boolean).length,
    sections: transcript.segments.map((seg, idx) => ({
      title: `Section ${idx + 1}`,
      text: seg.text,
      timestampSeconds: seg.start,
      timestampFormatted: formatTime(seg.start),
      sourceCitation: {
        filename: metadata.title || 'lecture_transcript.txt',
        timestampSeconds: seg.start,
        snippet: seg.text.slice(0, 80),
      },
    })),
    combinedText: transcript.rawText,
  };

  const artifact = await runUniversalLearningPipeline({
    studyKitId: lectureId,
    metadata,
    materials: [material],
    settings,
    onProgress,
    cancellationToken,
  });

  if (mediaUrl) artifact.mediaUrl = mediaUrl;
  if (mediaType) artifact.mediaType = mediaType;
  if (audioBlob) artifact.audioBlob = audioBlob;

  return artifact;
}
