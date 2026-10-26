export type ImportanceLevel = 'foundational' | 'core' | 'advanced';

export interface ConceptNode {
  id: string;
  title: string;
  timestampSeconds: number;
  timestampFormatted: string;
  summary: string;
  explanation: string;
  formulaLatex?: string;
  prerequisites: string[]; // Concept IDs that must be learned first
  keyTakeaways: string[];
  importance: ImportanceLevel;
}

export interface Flashcard {
  id: string;
  conceptId: string;
  front: string;
  back: string;
  hint?: string;
}

export interface DiagnosticOption {
  id: string;
  text: string;
  isCorrect: boolean;
  misconceptionExplanation: string; // Detailed pedagogical explanation of why this trap was chosen
}

export interface DiagnosticQuestion {
  id: string;
  conceptId: string;
  timestampSeconds: number;
  question: string;
  options: DiagnosticOption[];
  explanation: string;
}

export interface FeynmanEvaluation {
  conceptId: string;
  conceptTitle: string;
  studentExplanation: string;
  conceptualScore: number; // 0 - 100
  clarityScore: number;    // 0 - 100 (jargon-free)
  depthScore: number;      // 0 - 100 (nuance)
  overallScore: number;    // Weighted combination
  strengthFeedback: string;
  gapFeedback: string;
  socraticFollowUp: string;
}

export interface GoldenAudioSnippet {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  durationFormatted: string;
  transcriptSnippet: string;
  whyItMatters: string;
}

export interface LectureArtifact {
  id: string;
  title: string;
  course: string;
  lecturer: string;
  date: string;
  durationSeconds: number;
  durationFormatted: string;
  audioUrl?: string; // Preloaded or simulated waveform track
  overview: string;
  keyThemes: string[];
  mermaidGraph: string;
  concepts: ConceptNode[];
  flashcards: Flashcard[];
  diagnosticQuestions: DiagnosticQuestion[];
  goldenSnippets: GoldenAudioSnippet[];
}
