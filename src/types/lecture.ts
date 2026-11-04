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
  sourceCitation?: SourceCitation;
}

export interface SourceCitation {
  filename: string;
  pageNumber?: number;
  timestampSeconds?: number;
  timestampFormatted?: string;
  snippet?: string;
}

export type GraphEdgeType =
  | 'is-a'
  | 'causes'
  | 'part-of'
  | 'depends-on'
  | 'contrasts-with'
  | 'prerequisite'
  | 'related';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
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
  audioExplanation?: string; // ~30-sec golden audio explanation script
  sourceCitation?: SourceCitation;
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

export type QuizQuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_in_the_blank'
  | 'short_answer';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface DiagnosticQuestion {
  id: string;
  conceptId: string;
  timestampSeconds: number;
  question: string;
  options: DiagnosticOption[];
  type?: QuizQuestionType;
  difficulty?: QuizDifficulty;
  fillBlankAnswer?: string;
  sampleAnswer?: string;
  gradingRubric?: string[];
  explanation: string;
  sourceCitation?: SourceCitation;
}

export interface DetailedSummarySection {
  sectionTitle: string;
  content: string;
  keyPoints: string[];
  sourceCitation?: SourceCitation;
}

export interface StudySummaries {
  oneLineTldr: string;
  shortSummary: string;
  detailedSections: DetailedSummarySection[];
  keyTakeaways: string[];
  eli12Summary: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  context?: string;
  sourceCitation?: SourceCitation;
}

export interface FormulaOrDateItem {
  item: string;
  description: string;
  category: 'formula' | 'date' | 'milestone';
  latex?: string;
  sourceCitation?: SourceCitation;
}

export interface LikelyExamQuestion {
  question: string;
  difficulty: 'standard' | 'challenging';
  answerOutline: string;
  keyPoints: string[];
  sourceCitation?: SourceCitation;
}

export interface StudyPlanSession {
  dayOrSession: string;
  topic: string;
  activities: string[];
  timeMinutes: number;
}

export interface StudyKitExtras {
  glossary: GlossaryTerm[];
  importantFormulasAndDates: FormulaOrDateItem[];
  likelyExamQuestions: LikelyExamQuestion[];
  studyPlan: StudyPlanSession[];
}

export interface FailedFileRecord {
  id: string;
  filename: string;
  reason: string;
  errorDetails?: string;
  fileSize?: number;
}

export type UploadFileStatus = 'queued' | 'reading' | 'analysing' | 'done' | 'failed';

export interface UploadedFileItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  status: UploadFileStatus;
  progressPercent?: number;
  progressMessage?: string;
  errorReason?: string;
  previewUrl?: string;
  extractedText?: string;
  rawPayload?: string;
  mimeCategory?: 'image' | 'pdf' | 'document' | 'audio' | 'video' | 'text' | 'link' | 'unknown';
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
  summaries?: StudySummaries;
  extras?: StudyKitExtras;
  sourceFiles?: string[];
  failedFiles?: FailedFileRecord[];
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
