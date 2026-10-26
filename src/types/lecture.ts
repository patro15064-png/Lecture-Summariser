export type ImportanceLevel = 'foundational' | 'core' | 'advanced';
export type ConceptType = 'definition' | 'equation' | 'entity' | 'core';

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
}

export interface Transcript {
  segments: TranscriptSegment[];
  rawText: string;
  hasTimestamps: boolean;
}

export interface ConceptNode {
  id: string;
  title: string;
  type: ConceptType;
  timestampSeconds: number;
  timestampFormatted: string;
  summary: string;
  explanation: string;
  formulaLatex?: string;
  verbatimQuote?: string; // Grounded quote from transcript
  prerequisites: string[]; // Concept IDs that must be learned first (DAG dependencies)
  related: string[]; // Associated concept IDs
  keyTakeaways: string[];
  importance: ImportanceLevel;
  appearsAtTimestamps?: number[]; // All timestamps where concept is discussed
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'prerequisite' | 'related';
  label?: string;
}

export interface ConceptGraphData {
  nodes: ConceptNode[];
  edges: GraphEdge[];
  isDag: boolean;
}

export interface GoldenAudioSnippet {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  durationFormatted: string; // "MM:SS-MM:SS" range
  transcriptSnippet: string; // Verified verbatim substring
  whyItMatters: string;
  difficultyScore: number; // 1 - 5
  clarityScore: number; // 1 - 5
  audioBlobUrl?: string; // Client-side sliced audio clip URL
  audioBlob?: Blob;
}

export type Sm2Rating = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: string;
  conceptId: string;
  front: string;
  back: string;
  takeaway: string;
  hint?: string;
  snippetId?: string;
  startSeconds?: number;
  endSeconds?: number;
  audioClipUrl?: string;
  // SM-2 Spaced Repetition Scheduling Fields
  repetition: number;
  interval: number; // days
  easeFactor: number; // default 2.5
  dueDate: string; // ISO string
  lastReviewed?: string; // ISO string
}

export interface DiagnosticOption {
  id: string;
  text: string;
  isCorrect: boolean;
  misconceptionExplanation: string; // Pedagogical analysis of this trap
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

export interface LectureMetadata {
  title: string;
  course?: string;
  lecturer?: string;
  date?: string;
}

export interface LectureArtifact {
  id: string;
  title: string;
  course: string;
  lecturer: string;
  date: string;
  durationSeconds: number;
  durationFormatted: string;
  mediaUrl?: string; // Object URL for HTML5 player
  mediaType?: 'audio' | 'video' | 'transcript_only';
  audioBlob?: Blob;
  transcript: Transcript;
  overview: string;
  keyThemes: string[];
  mermaidGraph?: string;
  graphData: ConceptGraphData;
  concepts: ConceptNode[];
  flashcards: Flashcard[];
  diagnosticQuestions: DiagnosticQuestion[];
  goldenSnippets: GoldenAudioSnippet[];
  isSample?: boolean;
  createdAt: string;
}

// BYO API Providers and Routing
export type ApiProvider =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'custom'
  | 'local';

export type AgentRole =
  | 'transcriber'
  | 'segmenter'
  | 'extractor'
  | 'graph'
  | 'golden'
  | 'composer'
  | 'summary'
  | 'quiz'
  | 'chat';

export interface ProviderKeyConfig {
  provider: ApiProvider;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  status: 'untested' | 'valid' | 'invalid' | 'rate_limited' | 'cors_blocked';
  statusMessage?: string;
}

export interface AgentModelAssignment {
  role: AgentRole;
  provider: ApiProvider;
  model: string;
}

export interface UserApiSettings {
  useSingleModel: boolean;
  singleProvider: ApiProvider;
  singleModel: string;
  providers: Record<ApiProvider, ProviderKeyConfig>;
  assignments: Record<AgentRole, AgentModelAssignment>;
  rememberOnDevice: boolean;
}
