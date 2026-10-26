import test from 'node:test';
import assert from 'node:assert';
import { 
  RawConceptSchema, 
  RawGoldenMomentSchema, 
  RawQuizQuestionSchema,
  runLectureAnalysisPipeline
} from '../src/lib/orchestrator';
import { buildExportPackZip } from '../src/lib/exportPack';
import { LectureArtifact } from '../src/types/lecture';
import { loadUserApiSettings } from '../src/lib/providerSettings';
import { parseTranscriptContent } from '../src/lib/transcriptParser';

test('Pipeline Zod Schemas & Strict Parsing', async (t) => {
  await t.test('parses and validates well-formed concept schemas', () => {
    const validConcept = {
      title: 'Gradient Vector',
      type: 'equation' as const,
      approxTimestampSeconds: 120,
      summary: 'Points in direction of steepest ascent.',
      explanation: 'The gradient combines all partial derivatives into a vector.',
      formulaLatex: '\\nabla f = (\\partial f / \\partial x, \\partial f / \\partial y)',
      verbatimQuote: 'The gradient vector always points directly along the path of maximal increase',
      keyTakeaways: ['Orthogonal to level curves', 'Magnitude is maximum directional derivative'],
      importance: 'core' as const,
      prerequisiteTitles: ['Partial Derivatives'],
    };

    const parsed = RawConceptSchema.parse(validConcept);
    assert.strictEqual(parsed.title, 'Gradient Vector');
    assert.strictEqual(parsed.type, 'equation');
    assert.strictEqual(parsed.importance, 'core');
  });

  await t.test('parses and validates golden breakthrough moments', () => {
    const validMoment = {
      title: 'Geometric intuition of the dot product',
      approxStartSeconds: 180,
      approxEndSeconds: 215,
      quote: 'Notice that taking the dot product projects one vector onto another',
      whyItMatters: 'Explains why the directional derivative simplifies to a single projection',
      difficultyScore: 3,
      clarityScore: 5,
    };

    const parsed = RawGoldenMomentSchema.parse(validMoment);
    assert.strictEqual(parsed.difficultyScore, 3);
    assert.strictEqual(parsed.clarityScore, 5);
  });

  await t.test('parses diagnostic misconception questions', () => {
    const validQuiz = {
      conceptTitle: 'Gradient Vector',
      question: 'In which direction does the gradient vector point relative to a level curve?',
      options: [
        {
          text: 'Tangent along the level curve',
          isCorrect: false,
          misconceptionExplanation: 'Confusion between level set tangent and perpendicular gradient.',
        },
        {
          text: 'Strictly orthogonal (perpendicular) to the level curve',
          isCorrect: true,
          misconceptionExplanation: 'Correct: directional derivative is zero along level curve.',
        },
      ],
      explanation: 'Because f is constant along level curves, the tangent component must be zero.',
    };

    const parsed = RawQuizQuestionSchema.parse(validQuiz);
    assert.strictEqual(parsed.options.length, 2);
    assert.strictEqual(parsed.options[1].isCorrect, true);
  });
});

test('Export Pack ZIP Generator', async (t) => {
  await t.test('generates valid ZIP archive containing all 5 core files', async () => {
    const mockArtifact: LectureArtifact = {
      id: 'test-lec-1',
      title: 'Multivariable Calculus Vector Fields',
      course: 'MIT 18.02',
      lecturer: 'Prof. Denis Auroux',
      date: '2026-10-26',
      durationSeconds: 300,
      durationFormatted: '05:00',
      createdAt: '2026-10-26T12:00:00.000Z',
      overview: 'Test overview of multivariable vector fields.',
      keyThemes: ['Gradients', 'Level Curves'],
      mermaidGraph: 'graph TD\n  N1 --> N2',
      graphData: {
        nodes: [
          {
            id: 'c1',
            title: 'Partial Derivatives',
            type: 'definition',
            timestampSeconds: 30,
            timestampFormatted: '00:30',
            summary: 'Derivative along single coordinate.',
            explanation: 'Detailed explanation.',
            verbatimQuote: 'holding all other variables fixed',
            prerequisites: [],
            related: [],
            keyTakeaways: ['Single variable slice'],
            importance: 'foundational',
          },
          {
            id: 'c2',
            title: 'Gradient Vector',
            type: 'core',
            timestampSeconds: 120,
            timestampFormatted: '02:00',
            summary: 'Vector of partial derivatives.',
            explanation: 'Detailed explanation.',
            verbatimQuote: 'the gradient points along steepest ascent',
            prerequisites: ['c1'],
            related: [],
            keyTakeaways: ['Steepest ascent'],
            importance: 'core',
          },
        ],
        edges: [{ id: 'e1', source: 'c1', target: 'c2', type: 'prerequisite' }],
        isDag: true,
      },
      concepts: [],
      flashcards: [
        {
          id: 'fc-1',
          conceptId: 'c1',
          front: 'What does a partial derivative calculate?',
          back: 'Rate of change along one axis.',
          takeaway: 'Holding all others fixed.',
          repetition: 1,
          interval: 1,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(),
        },
      ],
      diagnosticQuestions: [],
      goldenSnippets: [
        {
          id: 'snip-1',
          title: 'Steepest ascent explanation',
          startSeconds: 100,
          endSeconds: 130,
          durationFormatted: '01:40 - 02:10',
          transcriptSnippet: 'the gradient points along steepest ascent',
          whyItMatters: 'Resolves orientation',
          difficultyScore: 3,
          clarityScore: 5,
        },
      ],
      transcript: {
        segments: [
          { id: 's1', start: 0, end: 30, text: 'Welcome to multivariable calculus holding all other variables fixed.' },
          { id: 's2', start: 30, end: 150, text: 'Notice the gradient points along steepest ascent orthogonal to level sets.' },
        ],
        rawText: 'Welcome to multivariable calculus holding all other variables fixed. Notice the gradient points along steepest ascent orthogonal to level sets.',
        hasTimestamps: true,
      },
    };

    const { zip } = await buildExportPackZip(mockArtifact);

    // Verify all required files are present in the ZIP
    assert.ok(zip.file('transcript.vtt'), 'transcript.vtt must be present in ZIP');
    assert.ok(zip.file('summary.md'), 'summary.md must be present in ZIP');
    assert.ok(zip.file('concept-graph.json'), 'concept-graph.json must be present in ZIP');
    assert.ok(zip.file('cards.json'), 'cards.json must be present in ZIP');
    assert.ok(zip.file('anki_cards.csv'), 'anki_cards.csv must be present in ZIP');

    // Inspect VTT content
    const vtt = await zip.file('transcript.vtt')?.async('text');
    assert.ok(vtt?.includes('WEBVTT'), 'VTT must begin with WEBVTT header');
    assert.ok(vtt?.includes('00:00:00.000 --> 00:00:30.000'), 'VTT must have correct timestamps');

    // Inspect Anki CSV
    const csv = await zip.file('anki_cards.csv')?.async('text');
    assert.ok(csv?.includes('#separator:tab'), 'Anki CSV header must declare tab separator');
    assert.ok(csv?.includes('What does a partial derivative calculate?'), 'Anki CSV must contain card front');
  });

  await t.test('executes full pipeline successfully with zero API key (offline local engine)', async () => {
    const dummyTranscript = {
      segments: [
        { id: 's1', start: 0, end: 35, text: 'The partial derivative measures the rate of change holding all other variables constant.' },
        { id: 's2', start: 35, end: 75, text: 'Next we construct the gradient vector pointing in the direction of greatest rate of increase.' },
        { id: 's3', start: 75, end: 120, text: 'Finally the directional derivative projects this rate of change along any chosen unit vector.' },
      ],
      rawText: 'The partial derivative measures the rate of change holding all other variables constant. Next we construct the gradient vector pointing in the direction of greatest rate of increase. Finally the directional derivative projects this rate of change along any chosen unit vector.',
      hasTimestamps: true,
    };

    const zeroKeySettings = loadUserApiSettings();

    const artifact = await runLectureAnalysisPipeline({
      lectureId: 'test-offline-1',
      metadata: { title: 'Offline Analysis Test' },
      transcript: dummyTranscript,
      settings: zeroKeySettings,
    });

    assert.ok(artifact.concepts.length > 0, 'Must extract concepts even with zero API key');
    assert.ok(artifact.graphData.nodes.length > 0, 'Must generate DAG nodes in offline mode');
    assert.ok(artifact.graphData.isDag, 'Graph must maintain valid DAG topology');
    assert.ok(artifact.flashcards.length > 0, 'Must generate spaced-repetition flashcards');
    assert.ok(artifact.diagnosticQuestions.length > 0, 'Must generate diagnostic quiz questions');
  });

  await t.test('extracts real concepts from user text without prompt template leakage', async () => {
    const userPastedText = `The Tardigrade, a microscopic animal, is renowned for its extreme resilience, capable of surviving near absolute zero temperatures, the vacuum of space, and radiation levels roughly 1000 times higher than what would kill a human, though it is not immortal as active tardigrades die quickly at 37°C. This hardiness is part of a broader biological mystery involving bioluminescence, where about three-quarters of deep-sea animals off California produce their own light through chemical reactions, creating a light show that has existed for millions of years before humans. These biological extremes contrast with the cosmic scale of Dark Matter and Dark Energy, which constitute 95% of the universe; while we can detect their gravitational effects, the remaining 5% of normal matter, including all stars, planets, and humans, remains a tiny fraction of reality that we cannot directly see or fully understand.`;

    const parsedTranscript = parseTranscriptContent(userPastedText);
    const zeroKeySettings = loadUserApiSettings();

    const artifact = await runLectureAnalysisPipeline({
      lectureId: 'tardigrade-test',
      metadata: { title: 'Tardigrades and Cosmic Extremes' },
      transcript: parsedTranscript,
      settings: zeroKeySettings,
    });

    // 1. Verify prompt template NEVER leaked into concepts
    for (const concept of artifact.concepts) {
      assert.ok(!concept.title.includes('You are a Master'), 'Concept title must not leak system prompt');
      assert.ok(!concept.title.includes('Concept Name'), 'Concept title must not leak JSON schema template');
      assert.ok(!concept.title.includes('ApproxTimestamp'), 'Concept title must not leak schema fields');
      assert.ok(!concept.title.includes('Explanation Detail'), 'Concept title must not leak schema placeholders');
      assert.ok(!concept.title.includes('VerbatimQuote'), 'Concept title must not leak schema placeholders');
      assert.strictEqual(concept.formulaLatex, undefined, 'Biology lecture without math must not have formulaLatex');
    }

    // 2. Verify real concepts were extracted from user text
    const conceptTitles = artifact.concepts.map((c) => c.title.toLowerCase());
    const hasTardigrade = conceptTitles.some((t) => t.includes('tardigrade'));
    const hasBioluminescence = conceptTitles.some((t) => t.includes('bioluminescence'));
    const hasDarkMatter = conceptTitles.some((t) => t.includes('dark matter'));

    assert.ok(hasTardigrade || hasBioluminescence || hasDarkMatter, 'Must extract real concepts from user text');

    // 3. Verify flashcards and quizzes test real lecture content
    assert.ok(artifact.flashcards.length > 0, 'Must produce flashcards');
    assert.ok(artifact.diagnosticQuestions.length > 0, 'Must produce diagnostic questions');
    const questionText = artifact.diagnosticQuestions.map((q) => q.question).join(' ');
    assert.ok(!questionText.includes('You are a Master'), 'Diagnostic questions must not leak prompt instructions');
  });
});
