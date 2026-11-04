import test from 'node:test';
import assert from 'node:assert';
import { chatWithLecture } from '../src/lib/gemini';
import { LectureArtifact } from '../src/types/lecture';

const mockArtifact = {
  id: 'lec-test-1',
  title: 'Human Portrait: Person in Royal Blue Polo Shirt (Studio Headshot)',
  overview: 'Frontal portrait of a young person with short dark hair, wearing a royal blue polo shirt against a white studio background.',
  keyThemes: ['Portraiture', 'Color Contrast'],
  mermaidGraph: 'graph TD; N1["Portrait"] --> N2["Attire"]',
  concepts: [
    {
      id: 'c-1',
      title: 'Human Portrait: Person in Royal Blue Polo Shirt',
      type: 'core' as const,
      timestampSeconds: 0,
      timestampFormatted: '00:00',
      summary: 'Frontal headshot of a young person in royal blue attire.',
      explanation: 'A young man with short dark hair and brown eyes, centered in the frame facing directly forward, wearing a royal blue collared polo shirt against a clean solid white background.',
      keyTakeaways: ['Direct frontal gaze', 'Royal blue shirt contrast'],
      importance: 'foundational' as const,
      prerequisites: [],
      related: [],
    },
  ],
  flashcards: [],
  diagnosticQuestions: [],
  goldenSnippets: [],
} as unknown as LectureArtifact;

test('Natural Chat Conversation Suite', async (t) => {
  await t.test('responds normally and naturally when user asks to talk normally', async () => {
    const reply = await chatWithLecture({
      message: 'I would like to talk to you normally',
      artifact: mockArtifact,
    });

    // Must NOT contain robotic template phrases
    assert.doesNotMatch(reply, /Regarding your question about/i);
    assert.doesNotMatch(reply, /This concept represents a foundational milestone/i);
    assert.doesNotMatch(reply, /Essential conceptual pillar/i);
    assert.doesNotMatch(reply, /How would you connect this principle back to the central thesis/i);

    // Must be natural and conversational
    assert.match(reply, /talk normally|right here with you|what's on your mind/i);
  });

  await t.test('greets user warmly when user says hello or hi', async () => {
    const reply = await chatWithLecture({
      message: 'Hello! How are you?',
      artifact: mockArtifact,
    });

    assert.doesNotMatch(reply, /Regarding your question about/i);
    assert.match(reply, /hello|connect with you|help/i);
  });

  await t.test('describes who is there and what he is wearing when asked', async () => {
    const reply = await chatWithLecture({
      message: 'Who is in the photo and what is he wearing?',
      artifact: mockArtifact,
    });

    assert.doesNotMatch(reply, /geomorphology/i);
    assert.match(reply, /royal blue/i);
    assert.match(reply, /short dark hair/i);
  });
});
