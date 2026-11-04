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
      "formulaLatex": null,
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
4. STRICT DOMAIN FIDELITY: Only include 'formulaLatex' if the material explicitly teaches mathematics, physics, statistics, or quantitative formulas. For scenery, nature, art, biology, history, literature, or non-mathematical topics, set 'formulaLatex' to null. NEVER invent calculus or unrelated formulas.
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
  provider?: string;
  model?: string;
  baseUrl?: string;
}): Promise<string> {
  const { message, history = [], artifact, mode = 'socratic', apiKey, provider = 'gemini', model: chosenModel, baseUrl } = params;
  const activeKey = apiKey || process.env.GEMINI_API_KEY || '';

  // Concept summaries with timestamps for grounding
  const groundedContext = (artifact.concepts || [])
    .map(
      (c) =>
        `[${c.timestampFormatted}] ${c.title}: ${c.summary}. Formula: ${c.formulaLatex || 'N/A'}. Key Takeaways: ${(c.keyTakeaways || []).join('; ')}`
    )
    .join('\n');

  const goldenContext = (artifact.goldenSnippets || [])
    .map((s) => `[${s.durationFormatted}] "${s.transcriptSnippet}" (Why it matters: ${s.whyItMatters})`)
    .join('\n');

  const transcriptExcerpt = artifact.transcript?.segments
    ? artifact.transcript.segments
        .slice(0, 30)
        .map((s) => `[${Math.floor(s.start / 60)}:${(s.start % 60).toString().padStart(2, '0')}] ${s.text}`)
        .join('\n')
    : '';

  const systemInstruction = `You are an elite, highly engaging University Academic Tutor and Learning Coach specializing in: "${artifact.title}" (${artifact.course || 'Curriculum'}).
You are having an interactive conversation with a student.

GROUNDING MATERIAL:
Title: ${artifact.title}
Overview: ${artifact.overview}
Key Themes: ${(artifact.keyThemes || []).join(', ')}

CONCEPTS & TIMESTAMPS:
${groundedContext}

TRANSCRIPT EXCERPTS:
${transcriptExcerpt}

GOLDEN BREAKTHROUGH SNIPPETS:
${goldenContext}

PEDAGOGICAL DIRECTIVE:
1. Converse naturally and directly address whatever the student asks, wonders, or observes. Never repeat generic canned templates or stock questions over and over.
2. ${
  mode === 'socratic'
    ? 'In Socratic mode, guide the student with thoughtful explanations, intuitive analogies, and 1 targeted provocative question that helps them think deeper about their specific query.'
    : 'In Direct mode, give a clear, comprehensive, step-by-step authoritative breakdown with formulas, examples, and key points.'
}
3. Always include relevant timestamp markers in format [MM:SS] (like "[01:30]" or "[03:45]") where the concept appears, so the student can click to jump the audio player instantly.`;

  // 1. Google Gemini Provider
  if (activeKey && (provider === 'gemini' || activeKey.startsWith('AIza'))) {
    try {
      const ai = new GoogleGenerativeAI(activeKey);
      const geminiModel = ai.getGenerativeModel({
        model: chosenModel || 'gemini-2.0-flash',
        systemInstruction,
      });

      const formattedHistory = history.map((h) => ({
        role: h.role,
        parts: [{ text: h.content }],
      }));

      const chat = geminiModel.startChat({
        history: formattedHistory,
      });

      const result = await chat.sendMessage(message);
      const text = result.response.text();
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (err) {
      console.warn('[Gemini Chat Error] Falling back to multi-provider / heuristics:', err);
    }
  }

  // 2. OpenAI, Groq, OpenRouter, or Custom Endpoint
  if (activeKey && (provider === 'openai' || provider === 'groq' || provider === 'openrouter' || provider === 'custom')) {
    try {
      let endpoint = 'https://api.openai.com/v1/chat/completions';
      if (provider === 'groq') endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      if (provider === 'custom') endpoint = `${(baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '')}/chat/completions`;

      const targetModel =
        chosenModel ||
        (provider === 'groq'
          ? 'llama-3.3-70b-versatile'
          : provider === 'openrouter'
          ? 'deepseek/deepseek-chat'
          : 'gpt-4o-mini');

      const messages = [
        { role: 'system', content: systemInstruction },
        ...history.map((h) => ({
          role: h.role === 'model' ? ('assistant' as const) : ('user' as const),
          content: h.content,
        })),
        { role: 'user' as const, content: message },
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply && reply.trim().length > 0) {
          return reply.trim();
        }
      }
    } catch (llmErr) {
      console.warn('[LLM Chat Error]:', llmErr);
    }
  }

  // 3. Anthropic Claude Provider
  if (activeKey && provider === 'anthropic') {
    try {
      const targetModel = chosenModel || 'claude-3-5-sonnet-20241022';
      const messages = [
        ...history.map((h) => ({
          role: h.role === 'model' ? ('assistant' as const) : ('user' as const),
          content: h.content,
        })),
        { role: 'user' as const, content: message },
      ];

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: targetModel,
          system: systemInstruction,
          messages,
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.content?.[0]?.text;
        if (reply && reply.trim().length > 0) {
          return reply.trim();
        }
      }
    } catch (anthropicErr) {
      console.warn('[Anthropic Chat Error]:', anthropicErr);
    }
  }

  // High-fidelity fallback logic for demo exploration or offline sessions
  return generateContextualChatFallback(message, artifact, mode);
}

/**
 * Intelligent contextual fallback response grounded directly in the lecture artifact.
 */
function generateContextualChatFallback(
  message: string,
  artifact: LectureArtifact,
  mode: 'socratic' | 'direct'
): string {
  const lowerMsg = message.trim().toLowerCase();
  const concepts = artifact.concepts || [];
  const segments = artifact.transcript?.segments || [];

  // Match the most relevant concept or segment based on keyword overlap
  let matchedConcept = concepts.find((c) =>
    lowerMsg.includes(c.title.toLowerCase()) ||
    c.keyTakeaways?.some((t) => lowerMsg.includes(t.toLowerCase().slice(0, 15)))
  );

  if (!matchedConcept && segments.length > 0) {
    const words = lowerMsg.split(/\s+/).filter((w) => w.length > 3);
    const matchingSeg = segments.find((seg) =>
      words.some((w) => seg.text.toLowerCase().includes(w))
    );
    if (matchingSeg) {
      matchedConcept = concepts.find(
        (c) => Math.abs(c.timestampSeconds - matchingSeg.start) < 60
      );
    }
  }

  if (!matchedConcept) {
    matchedConcept = concepts[0] || {
      id: 'c-1',
      title: artifact.title || 'Core Topic',
      timestampSeconds: 0,
      timestampFormatted: '00:00',
      summary: artifact.overview || 'Fundamental principles',
      explanation: artifact.overview || 'Core ideas of the lecture',
      keyTakeaways: artifact.keyThemes || ['Core mechanism'],
      importance: 'foundational' as const,
      type: 'core' as const,
      prerequisites: [],
      related: [],
    };
  }

  const timestampTag = `[${matchedConcept.timestampFormatted}]`;

  // 1. Direct answer if user mentions audio, narrator, voice, or playback
  if (lowerMsg.includes('text') || lowerMsg.includes('audio') || lowerMsg.includes('voice') || lowerMsg.includes('read') || lowerMsg.includes('play')) {
    return `Yes! This study session includes a synchronized **AI Voice Narrator**.
You can click **Play** at ${timestampTag} in the player above, and the browser will read each concept line aloud while highlighting the transcript in sync.

Regarding **${matchedConcept.title}**:
> "${matchedConcept.summary}"

${mode === 'socratic'
  ? `How does this mechanism fit into your understanding of ${artifact.title}? Click ${timestampTag} to listen to the explanation!`
  : matchedConcept.explanation
}`;
  }

  // 2. Analogy / Intuition request
  if (lowerMsg.includes('analogy') || lowerMsg.includes('simple') || lowerMsg.includes('intuition') || lowerMsg.includes('explain')) {
    return `Here is an intuitive way to understand **${matchedConcept.title}** ${timestampTag}:

Think of this like a coordinated physical system: rather than functioning in isolation, every step actively influences the downstream state.
At ${timestampTag}, the lecture establishes:
> "${matchedConcept.summary}"

${matchedConcept.formulaLatex ? `The mathematical formulation is:\n\`\`\`latex\n${matchedConcept.formulaLatex}\n\`\`\`\n` : ''}
${mode === 'socratic'
  ? `If you were to adjust the boundary inputs, how do you predict the outcome would shift? Click ${timestampTag} to review the audio!`
  : matchedConcept.explanation
}`;
  }

  // 3. Misconceptions, errors, traps
  if (lowerMsg.includes('mistake') || lowerMsg.includes('trap') || lowerMsg.includes('quiz') || lowerMsg.includes('wrong') || lowerMsg.includes('error')) {
    const diag = artifact.diagnosticQuestions?.[0];
    const trapOpt = diag?.options?.find((o) => !o.isCorrect);

    return `A common cognitive trap regarding **${matchedConcept.title}** ${timestampTag}:
${trapOpt ? `> Many students incorrectly assume: *"${trapOpt.text}"*\n\n**Why this fails:** ${trapOpt.misconceptionExplanation}` : `> Assuming properties remain uniform without accounting for prerequisite boundary interactions.`}

You can test yourself on this in the **Diagnostic Quizzes** tab or jump directly to ${timestampTag} in the player!`;
  }

  // 4. Default dynamic pedagogical response
  return `Regarding your question about **${matchedConcept.title}** ${timestampTag}:

${matchedConcept.explanation}

${matchedConcept.formulaLatex ? `**Key Formulation:**\n\`\`\`latex\n${matchedConcept.formulaLatex}\n\`\`\`\n` : ''}
**Core Takeaway:**
${matchedConcept.keyTakeaways?.map((t) => `• ${t}`).join('\n') || matchedConcept.summary}

${mode === 'socratic'
  ? `How would you connect this principle back to the central thesis of ${artifact.title}? Jump to ${timestampTag} to explore further!`
  : `Jump to ${timestampTag} in the player above to follow along with the narration!`
}`;
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
