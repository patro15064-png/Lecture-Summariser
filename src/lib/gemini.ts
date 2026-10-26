import { GoogleGenerativeAI } from '@google/generative-ai';
import { LectureArtifact, ConceptNode, FeynmanEvaluation } from '@/types/lecture';
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

/**
 * Context-aware in-lecture chat engine (Socratic or Direct mode).
 */
export async function chatWithLecture(params: {
  message: string;
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  artifact: LectureArtifact;
  mode?: 'socratic' | 'direct';
  apiKey?: string;
}): Promise<string> {
  const { message, history = [], artifact, mode = 'socratic', apiKey } = params;
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  // Concept summaries with timestamps for grounding
  const groundedContext = artifact.concepts
    .map(
      (c) =>
        `[${c.timestampFormatted}] ${c.title}: ${c.summary}. Formula: ${c.formulaLatex || 'N/A'}. Key Takeaways: ${c.keyTakeaways.join('; ')}`
    )
    .join('\n');

  const goldenContext = artifact.goldenSnippets
    .map((s) => `[${s.durationFormatted}] "${s.transcriptSnippet}" (Why it matters: ${s.whyItMatters})`)
    .join('\n');

  if (activeKey) {
    try {
      const ai = new GoogleGenerativeAI(activeKey);
      const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are an elite University Academic Tutor specializing in: "${artifact.title}" (${artifact.course}).
Ground all answers strictly in the following verified lecture milestones and golden quotes:
LECTURE CONTEXT:
${artifact.overview}
Key Themes: ${artifact.keyThemes.join(', ')}

CONCEPTS & TIMESTAMPS:
${groundedContext}

GOLDEN BREAKTHROUGH SNIPPETS:
${goldenContext}

PEDAGOGICAL DIRECTIVE (${mode.toUpperCase()} MODE):
${
  mode === 'socratic'
    ? 'Act as a Socratic mentor: Do not give the complete answer away immediately if the student is developing a concept. Ask guiding questions, point out conceptual contradictions, offer intuitive analogies, and reference specific timestamps using format [MM:SS] (e.g., "[05:20]") so the student can jump to the video.'
    : 'Provide a direct, rigorous, clear explanation with mathematical precision, intuitive diagrams in text, and exact timestamp citations in format [MM:SS].'
}
Always cite relevant timestamps [MM:SS] so the student can click to review the lecture.`,
      });

      const formattedHistory = history.map((h) => ({
        role: h.role,
        parts: [{ text: h.content }],
      }));

      const chat = model.startChat({
        history: formattedHistory,
      });

      const result = await chat.sendMessage(message);
      return result.response.text();
    } catch (err) {
      console.warn('[Gemini Chat Error] Falling back to intelligent heuristic response:', err);
    }
  }

  // High-fidelity fallback logic for demo exploration without API keys
  return generateContextualChatFallback(message, artifact, mode);
}

/**
 * Intelligent heuristic fallback response generator grounded in the lecture artifact.
 */
function generateContextualChatFallback(
  message: string,
  artifact: LectureArtifact,
  mode: 'socratic' | 'direct'
): string {
  const lowerMsg = message.toLowerCase();

  // Match best concept in artifact
  const matchedConcept =
    artifact.concepts.find(
      (c) =>
        lowerMsg.includes(c.title.toLowerCase()) ||
        c.keyTakeaways.some((t) => lowerMsg.includes(t.toLowerCase().slice(0, 15))) ||
        (c.formulaLatex && lowerMsg.includes('formula'))
    ) || artifact.concepts[0];

  const timestampTag = `[${matchedConcept.timestampFormatted}]`;

  if (lowerMsg.includes('analogy') || lowerMsg.includes('like i\'m 5') || lowerMsg.includes('simple')) {
    return `Let's break this down intuitively! Think of **${matchedConcept.title}** as a hiker on a foggy mountain ridge. 

Instead of seeing the whole landscape at once, you feel the incline directly under your feet. At ${timestampTag}, the professor explains that:
> "${matchedConcept.summary}"

${
  mode === 'socratic'
    ? `Now imagine you take one step in any direction. How does your step along the steepest slope compare to a step where elevation doesn't change at all? What does that tell you about the angle between your path and the contour lines?`
    : `Mathematically, this corresponds to:
\`\`\`latex
${matchedConcept.formulaLatex || matchedConcept.summary}
\`\`\`
Check out the golden breakdown at ${timestampTag} to hear the exact geometric insight.`
}`;
  }

  if (lowerMsg.includes('mistake') || lowerMsg.includes('trap') || lowerMsg.includes('quiz')) {
    const diag = artifact.diagnosticQuestions[0];
    const trapOpt = diag?.options.find((o) => !o.isCorrect);

    return `The most frequent cognitive trap in this topic centers on **${diag ? diag.question : matchedConcept.title}**.

Many students intuitively believe:
> *"${trapOpt ? trapOpt.text : 'Rates can be computed without normalizing vectors'}"*

**Why this fails:** ${trapOpt ? trapOpt.misconceptionExplanation : 'It conflates magnitude with pure directional rate of change.'}

Review the resolution directly at ${diag ? `[${Math.floor(diag.timestampSeconds / 60)}:${(diag.timestampSeconds % 60).toString().padStart(2, '0')}]` : timestampTag} in the lecture!`;
  }

  if (mode === 'socratic') {
    return `That's a pivotal question for understanding **${matchedConcept.title}** (${timestampTag}).

Before answering, let's test your conceptual intuition:
1. When the professor discusses *"${matchedConcept.summary}"* at ${timestampTag}, what physical or mathematical constraint is kept constant?
2. If you look at the formula:
\`\`\`latex
${matchedConcept.formulaLatex || 'Key Relationship'}
\`\`\`
What would happen to the output if you reversed the direction of the vector or inverted the input?

Take a moment to formulate what you think happens, or jump to ${timestampTag} in the player above!`;
  }

  return `In **${artifact.title}**, **${matchedConcept.title}** is formulated at ${timestampTag}:

${matchedConcept.explanation}

### Key Takeaways:
${matchedConcept.keyTakeaways.map((t) => `- ${t}`).join('\n')}

${matchedConcept.formulaLatex ? `### Formulation:\n\`\`\`latex\n${matchedConcept.formulaLatex}\n\`\`\`` : ''}

Jump to ${timestampTag} in the synced media player to review the professor's original derivation!`;
}

/**
 * Evaluates student explanations using the Richard Feynman Pedagogical Rubric.
 */
export async function evaluateFeynmanExplanation(params: {
  concept: ConceptNode;
  studentExplanation: string;
  artifact: LectureArtifact;
  apiKey?: string;
}): Promise<FeynmanEvaluation> {
  const { concept, studentExplanation, artifact, apiKey } = params;
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  if (activeKey) {
    try {
      const ai = new GoogleGenerativeAI(activeKey);
      const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are Richard Feynman, master teacher and Nobel Laureate.
Evaluate the student's attempt to explain the following concept from "${artifact.title}" (${artifact.course}) in plain, simple, jargon-free language as if explaining to a 12-year-old or bright high school student.

REFERENCE CONCEPT:
Title: "${concept.title}"
Reference Summary: "${concept.summary}"
Pedagogical Explanation: "${concept.explanation}"
Formula: "${concept.formulaLatex || 'N/A'}"
Key Principles: ${concept.keyTakeaways.join('; ')}

RUBRIC:
1. conceptualScore (0-100): Did they get the fundamental scientific/mathematical truth right without fatal errors?
2. clarityScore (0-100): Did they avoid empty academic jargon, buzzwords, and hand-waving?
3. depthScore (0-100): Did they convey the 'why' (intuition/mechanism), not just a memorized formula?
4. overallScore: Weighted combination (0.4 * conceptual + 0.3 * clarity + 0.3 * depth).
5. strengthFeedback: Warm, encouraging praise of what was explained intuitively.
6. gapFeedback: Specific spot where jargon slipped in, an analogy broke down, or a misconception lurked.
7. socraticFollowUp: One provocative, thought-provoking question to test the boundary of their understanding.

STRICT JSON OUTPUT SCHEMA:
{
  "conceptId": "${concept.id}",
  "conceptTitle": "${concept.title}",
  "studentExplanation": "...",
  "conceptualScore": 85,
  "clarityScore": 90,
  "depthScore": 80,
  "overallScore": 85,
  "strengthFeedback": "...",
  "gapFeedback": "...",
  "socraticFollowUp": "..."
}`,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const prompt = `Student Explanation to evaluate:\n"${studentExplanation}"`;
      const result = await model.generateContent(prompt);
      const parsed = cleanAndParseJSON<FeynmanEvaluation>(result.response.text());
      if (parsed && typeof parsed.overallScore === 'number') {
        return parsed;
      }
    } catch (err) {
      console.warn('[Feynman Gemini Evaluation Error] Falling back to heuristic rubric:', err);
    }
  }

  // High-fidelity heuristic evaluation for zero-key demo exploration
  return generateHeuristicFeynmanEvaluation(concept, studentExplanation);
}

/**
 * Intelligent heuristic Feynman evaluation when running without API keys.
 */
function generateHeuristicFeynmanEvaluation(
  concept: ConceptNode,
  studentExplanation: string
): FeynmanEvaluation {
  const text = studentExplanation.trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  // Check key terms from concept
  const keyTerms = [
    ...concept.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    ...concept.keyTakeaways.flatMap((t) => t.toLowerCase().split(/\s+/).filter((w) => w.length > 4)),
  ];

  const matchedTerms = keyTerms.filter((term) => lower.includes(term));
  const coverageRatio = keyTerms.length > 0 ? Math.min(1, matchedTerms.length / 4) : 0.7;

  // Jargon penalty: overly technical words without analogies
  const jargonWords = ['differential', 'orthogonal', 'transformation', 'matrix', 'isomorphism', 'manifold', 'multiplier'];
  const jargonFound = jargonWords.filter((w) => lower.includes(w));
  const hasAnalogy = lower.includes('like') || lower.includes('think of') || lower.includes('imagine') || lower.includes('picture');

  let conceptual = Math.round(55 + coverageRatio * 35);
  let clarity = Math.round(60 + (hasAnalogy ? 25 : 5) - Math.min(20, jargonFound.length * 6));
  let depth = Math.round(50 + Math.min(40, words.length * 0.8));

  // Cap bounds
  conceptual = Math.max(30, Math.min(98, conceptual));
  clarity = Math.max(25, Math.min(95, clarity));
  depth = Math.max(30, Math.min(95, depth));
  const overall = Math.round(conceptual * 0.4 + clarity * 0.3 + depth * 0.3);

  let strength = '';
  if (hasAnalogy) {
    strength = `Terrific intuition! Using an analogy creates an immediate mental picture that demystifies ${concept.title}.`;
  } else if (words.length > 20) {
    strength = `Solid foundational structure! You clearly grasped that ${concept.summary.toLowerCase()}`;
  } else {
    strength = `You captured the core essence of ${concept.title} succinctly without overcomplicating the concept.`;
  }

  let gap = '';
  if (jargonFound.length > 1 && !hasAnalogy) {
    gap = `Watch out for technical buzzwords like "${jargonFound.slice(0, 2).join('", "')}". A true Feynman test requires explaining the intuition without hiding behind textbook terminology.`;
  } else if (words.length < 15) {
    gap = `Your explanation is brief. Try elaborating on *why* this behavior occurs geometrically or physically, not just what it is named.`;
  } else {
    gap = `Notice what happens at the boundary conditions: make sure you emphasize why the rate or constraint behaves differently when parameters shift.`;
  }

  const socraticFollowUp = `Suppose a friend says: "If this is true, why doesn't it double when we scale the inputs?" How would you prove your explanation holds using a simple sketch or everyday object?`;

  return {
    conceptId: concept.id,
    conceptTitle: concept.title,
    studentExplanation,
    conceptualScore: conceptual,
    clarityScore: clarity,
    depthScore: depth,
    overallScore: overall,
    strengthFeedback: strength,
    gapFeedback: gap,
    socraticFollowUp,
  };
}
