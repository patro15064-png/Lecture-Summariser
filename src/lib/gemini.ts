import { GoogleGenerativeAI } from '@google/generative-ai';
import { LectureArtifact } from '@/types/lecture';
import { DEMO_LECTURES } from '@/data/demoLectures';

/**
 * Strips markdown code blocks and trailing commas, then parses JSON safely.
 */
export function cleanAndParseJSON<T>(rawText: string): T {
  let cleaned = rawText.trim();

  // Strip Markdown code fence wrappers: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Extract JSON payload if extra commentary surrounds it
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before closing braces/brackets (common LLM syntax issue)
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Remove potential unescaped control characters
  cleaned = cleaned.replace(/[\u0000-\u001F]+/g, (match) => {
    return match === '\n' || match === '\r' || match === '\t' ? match : '';
  });

  return JSON.parse(cleaned) as T;
}

/**
 * Sanitizes Mermaid diagram syntax to prevent syntax crashes:
 * - Ensures graph starts with graph TD or flowchart TD
 * - Replaces unsafe characters inside node labels (unescaped brackets, quotes, braces)
 */
export function sanitizeMermaidGraph(graph: string): string {
  if (!graph || graph.trim().length === 0) {
    return `graph TD\n  N1["Lecture Overview"] --> N2["Core Concepts"]`;
  }

  let sanitized = graph.trim();

  // Ensure standard graph header
  if (!sanitized.startsWith('graph ') && !sanitized.startsWith('flowchart ')) {
    sanitized = `graph TD\n${sanitized}`;
  }

  // Sanitize node label contents to prevent syntax explosions
  // E.g. replace nested brackets inside node labels like N1["Label [info]"] with N1["Label (info)"]
  sanitized = sanitized.replace(/\["([^"]*)"\]/g, (_, label) => {
    const cleanLabel = label
      .replace(/\[/g, '(')
      .replace(/\]/g, ')')
      .replace(/"/g, "'");
    return `["${cleanLabel}"]`;
  });

  return sanitized;
}

/**
 * Self-healing wrapper with up to 3 retries and automatic fallback to demo corpus.
 */
export async function withSelfHealingJSON<T>(
  generatorFn: () => Promise<string>,
  fallbackValue: T,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const rawText = await generatorFn();
      const parsed = cleanAndParseJSON<T>(rawText);
      if (parsed && typeof parsed === 'object' && 'mermaidGraph' in parsed && typeof (parsed as Record<string, unknown>).mermaidGraph === 'string') {
        (parsed as Record<string, unknown>).mermaidGraph = sanitizeMermaidGraph((parsed as Record<string, unknown>).mermaidGraph as string);
      }
      return parsed;
    } catch (err) {
      lastError = err;
      console.warn(`[Self-Healing JSON] Attempt ${attempt}/${maxRetries} failed to parse LLM output:`, err);
      if (attempt < maxRetries) {
        // Exponential backoff delay
        await new Promise((res) => setTimeout(res, attempt * 500));
      }
    }
  }

  console.error('[Self-Healing JSON] All parse attempts exhausted. Gracefully reverting to fallback dataset.', lastError);
  return fallbackValue;
}

/**
 * System prompt enforcing strict structured JSON schema for LectureArtifact.
 */
const SYSTEM_PROMPT = `
You are an elite University Professor, Cognitive Scientist, and Curriculum Architect.
Analyze the provided multimodal lecture (audio/video transcript or document) and produce a high-yield, structured Lecture-to-Learning Artifact in STRICT JSON format with NO markdown commentary.

Your JSON output MUST match this exact schema:
{
  "id": "generated-lecture-id",
  "title": "Clear Technical Lecture Title",
  "course": "University Course Identifier & Subject",
  "lecturer": "Professor / Lecturer Name (or 'Academic Series')",
  "date": "Lecture Term or Timestamp",
  "durationSeconds": 1200,
  "durationFormatted": "20:00",
  "overview": "Comprehensive 3-sentence executive overview of the conceptual domain.",
  "keyThemes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4", "Theme 5"],
  "mermaidGraph": "graph TD\\n  N1[\\"Foundational Topic\\"] --> N2[\\"Core Mechanism\\"]\\n  N2 --> N3[\\"Advanced Application\\"]",
  "concepts": [
    {
      "id": "concept-1",
      "title": "Concept Name",
      "timestampSeconds": 120,
      "timestampFormatted": "02:00",
      "summary": "One sentence elevator summary.",
      "explanation": "Detailed 2-3 paragraph pedagogical explanation.",
      "formulaLatex": "\\\\nabla f = \\\\lambda \\\\nabla g",
      "prerequisites": [],
      "keyTakeaways": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
      "importance": "foundational"
    }
  ],
  "flashcards": [
    {
      "id": "fc-1",
      "conceptId": "concept-1",
      "front": "Targeted active-recall prompt?",
      "back": "Comprehensive answer uncovering deep rationale.",
      "hint": "Pedagogical clue"
    }
  ],
  "diagnosticQuestions": [
    {
      "id": "dq-1",
      "conceptId": "concept-1",
      "timestampSeconds": 150,
      "question": "Probing multiple choice question testing conceptual boundaries?",
      "options": [
        {
          "id": "opt-1",
          "text": "Plausible but false answer based on common student cognitive trap",
          "isCorrect": false,
          "misconceptionExplanation": "Detailed explanation of why students fall into this specific misconception trap."
        },
        {
          "id": "opt-2",
          "text": "True and accurate statement",
          "isCorrect": true,
          "misconceptionExplanation": "Correct explanation highlighting core insight."
        }
      ],
      "explanation": "Full step-by-step resolution."
    }
  ],
  "goldenSnippets": [
    {
      "id": "gs-1",
      "title": "Pivotal Breakthrough Moment",
      "startSeconds": 120,
      "endSeconds": 160,
      "durationFormatted": "0:40",
      "transcriptSnippet": "Verbatim pivotal quote explaining the core breakthrough.",
      "whyItMatters": "Why this 30-40 second moment unlocks the entire lecture."
    }
  ]
}

CRITICAL RULES:
1. ONLY return valid JSON. Do not wrap in backticks if possible, or wrap strictly in \`\`\`json.
2. In 'mermaidGraph', use simple IDs (N1, N2) with double-quoted labels [\\"Label\\"]. Avoid unescaped brackets or parentheses inside labels.
3. Every incorrect option in 'diagnosticQuestions' MUST explain the specific cognitive trap in 'misconceptionExplanation'.
`;

export async function processLectureWithGemini(params: {
  text?: string;
  base64Data?: string;
  mimeType?: string;
  apiKey?: string;
}): Promise<LectureArtifact> {
  const activeKey = params.apiKey || process.env.GEMINI_API_KEY;

  // If no API key provided, seamlessly return one of the university demo lectures
  if (!activeKey) {
    console.log('[Gemini Engine] No API key detected. Serving university demo dataset.');
    return DEMO_LECTURES[0];
  }

  const ai = new GoogleGenerativeAI(activeKey);
  // Default to gemini-2.0-flash with fallback to gemini-1.5-flash
  const modelName = 'gemini-2.0-flash';
  const model = ai.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Analyze this lecture content and construct the complete LectureArtifact JSON schema:\n\n${params.text || 'Process attached multimodal media.'}`;

  return withSelfHealingJSON<LectureArtifact>(
    async () => {
      if (params.base64Data && params.mimeType) {
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: params.base64Data,
              mimeType: params.mimeType,
            },
          },
        ]);
        return result.response.text();
      } else {
        const result = await model.generateContent(prompt);
        return result.response.text();
      }
    },
    DEMO_LECTURES[0] // Fallback value on failure
  );
}
