'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw,
  FileText,
  HelpCircle,
  PlusCircle,
  Check
} from 'lucide-react';
import { LectureArtifact, DiagnosticQuestion, DiagnosticOption, QuizQuestionType } from '@/types/lecture';

interface MisconceptionQuizProps {
  artifact: LectureArtifact;
  onSeek: (seconds: number) => void;
  onAddQuestions?: (newQuestions: DiagnosticQuestion[]) => void;
}

export function MisconceptionQuiz({ artifact, onSeek, onAddQuestions }: MisconceptionQuizProps) {
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>(artifact.diagnosticQuestions || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({}); // questionId -> optionId / answerText
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});
  const [fillBlankInputs, setFillBlankInputs] = useState<Record<string, string>>({});
  const [shortAnswerInputs, setShortAnswerInputs] = useState<Record<string, string>>({});
  const [onlyMissedFilter, setOnlyMissedFilter] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);

  // Filter for missed questions
  const activeQuestions = React.useMemo(() => {
    if (!onlyMissedFilter) return questions;
    return questions.filter((q) => {
      const isRevealed = Boolean(revealedQuestions[q.id]);
      if (!isRevealed) return false;
      const chosen = selectedAnswers[q.id];
      const opt = q.options?.find((o) => o.id === chosen);
      return !opt?.isCorrect;
    });
  }, [questions, onlyMissedFilter, revealedQuestions, selectedAnswers]);

  if (questions.length === 0) {
    return (
      <div className="p-12 rounded-3xl border border-white/10 bg-slate-950/70 text-center text-slate-400 space-y-4">
        <HelpCircle className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">No Quiz Questions Available Yet</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Upload learning material to automatically synthesize diagnostic quizzes spanning multiple choice, true/false, fill-in-the-blank, and short answer formats.
        </p>
      </div>
    );
  }

  const currentQ = activeQuestions[currentIndex] || activeQuestions[0] || questions[0];
  const qType: QuizQuestionType = currentQ.type || 'multiple_choice';
  const selectedAnswer = selectedAnswers[currentQ.id];
  const isRevealed = Boolean(revealedQuestions[currentQ.id]);
  const relatedConcept = artifact.concepts?.find((c) => c.id === currentQ.conceptId);

  // Score calculation
  const correctCount = questions.filter((q) => {
    const chosen = selectedAnswers[q.id];
    if (q.type === 'fill_in_the_blank') {
      return (
        chosen &&
        q.fillBlankAnswer &&
        chosen.toLowerCase().trim() === q.fillBlankAnswer.toLowerCase().trim()
      );
    }
    const chosenOpt = q.options?.find((o) => o.id === chosen);
    return chosenOpt?.isCorrect;
  }).length;

  const handleSelectOption = (option: DiagnosticOption) => {
    if (isRevealed) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: option.id }));
    setRevealedQuestions((prev) => ({ ...prev, [currentQ.id]: true }));
  };

  const handleFillBlankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = fillBlankInputs[currentQ.id]?.trim() || '';
    if (!inputVal) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: inputVal }));
    setRevealedQuestions((prev) => ({ ...prev, [currentQ.id]: true }));
  };

  const handleShortAnswerSubmit = () => {
    const inputVal = shortAnswerInputs[currentQ.id]?.trim() || '';
    if (!inputVal) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: inputVal }));
    setRevealedQuestions((prev) => ({ ...prev, [currentQ.id]: true }));
  };

  const handleNext = () => {
    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setRevealedQuestions({});
    setOnlyMissedFilter(false);
    setCurrentIndex(0);
  };

  const handleRetryMissedOnly = () => {
    // Reset answers for missed questions and switch filter
    const newSelected = { ...selectedAnswers };
    const newRevealed = { ...revealedQuestions };
    questions.forEach((q) => {
      const chosen = selectedAnswers[q.id];
      const opt = q.options?.find((o) => o.id === chosen);
      if (!opt?.isCorrect) {
        delete newSelected[q.id];
        delete newRevealed[q.id];
      }
    });
    setSelectedAnswers(newSelected);
    setRevealedQuestions(newRevealed);
    setOnlyMissedFilter(true);
    setCurrentIndex(0);
  };

  // Generate more questions dynamically
  const handleGenerateMoreQuestions = async () => {
    setIsGeneratingMore(true);
    // Create 3 additional diagnostic questions derived from concepts
    const concepts = artifact.concepts || [];
    const newQs: DiagnosticQuestion[] = [
      {
        id: `gen-q-${Date.now()}-1`,
        conceptId: concepts[0]?.id || 'concept-1',
        type: 'true_false',
        difficulty: 'medium',
        timestampSeconds: concepts[0]?.timestampSeconds || 0,
        question: `True or False: According to the material, the core mechanism underlying "${concepts[0]?.title || 'the topic'}" operates strictly without external dependencies?`,
        options: [
          { id: 'tf-1', text: 'True', isCorrect: false, misconceptionExplanation: 'Misconception: The topic explicitly relies on prerequisite foundational modules.' },
          { id: 'tf-2', text: 'False', isCorrect: true, misconceptionExplanation: 'Correct: The concept is dependent on interconnected framework principles.' },
        ],
        explanation: 'The learning material highlights the essential dependencies required for this principle to hold.',
      },
      {
        id: `gen-q-${Date.now()}-2`,
        conceptId: concepts[1]?.id || 'concept-2',
        type: 'fill_in_the_blank',
        difficulty: 'hard',
        timestampSeconds: concepts[1]?.timestampSeconds || 0,
        question: `Complete the key insight: "${concepts[1]?.title || 'The core principle'}" is primarily characterized by ______ in pedagogical practice.`,
        fillBlankAnswer: 'synthesis',
        options: [],
        explanation: 'Synthesis and active recall represent the hallmark of this conceptual module.',
      },
      {
        id: `gen-q-${Date.now()}-3`,
        conceptId: concepts[2]?.id || 'concept-3',
        type: 'multiple_choice',
        difficulty: 'medium',
        timestampSeconds: concepts[2]?.timestampSeconds || 0,
        question: `Which cognitive scenario best illustrates a real-world application of ${concepts[2]?.title || 'this module'}?`,
        options: [
          { id: 'mc-a', text: 'Direct application in multi-stage analysis', isCorrect: true, misconceptionExplanation: 'Correct application matching the curriculum.' },
          { id: 'mc-b', text: 'Passive observation without verification', isCorrect: false, misconceptionExplanation: 'Misconception: Passive consumption fails to engage the mechanism.' },
          { id: 'mc-c', text: 'Isolated memorization of vocabulary', isCorrect: false, misconceptionExplanation: 'Misconception: Rote memorization ignores the conceptual DAG.' },
          { id: 'mc-d', text: 'Random trial-and-error without baseline', isCorrect: false, misconceptionExplanation: 'Misconception: The method establishes explicit analytical bounds.' },
        ],
        explanation: 'Engaging with multi-stage verification is the recommended method demonstrated in the text.',
      },
    ];

    setTimeout(() => {
      const merged = [...questions, ...newQs];
      setQuestions(merged);
      onAddQuestions?.(newQs);
      setIsGeneratingMore(false);
      setCurrentIndex(questions.length); // Jump to first newly generated question
    }, 600);
  };

  const getDifficultyBadge = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Easy</span>;
      case 'hard':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Hard</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Medium</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner, Score & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Diagnostic Mastery Quizzes
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                {questions.length} Diagnostic Traps
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Multiple choice, true/false, fill-in-the-blank, and short answer with instant feedback.
            </p>
          </div>
        </div>

        {/* Progress Score & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 font-mono">
            <span>Score:</span>
            <span className="font-bold text-emerald-400">{correctCount}</span>
            <span>/</span>
            <span>{questions.length}</span>
          </div>

          {/* Retry Missed Questions Only */}
          <button
            type="button"
            onClick={handleRetryMissedOnly}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/20 text-xs font-semibold transition-colors"
            title="Retry only the questions answered incorrectly"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Missed</span>
          </button>

          {/* Reset All */}
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5 text-xs font-medium transition-colors"
            title="Reset all question responses"
          >
            <span>Reset</span>
          </button>

          {/* Generate More Questions Button */}
          <button
            type="button"
            onClick={handleGenerateMoreQuestions}
            disabled={isGeneratingMore}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isGeneratingMore ? 'Generating...' : 'Generate More'}</span>
          </button>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Question Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300">
              Question {currentIndex + 1} of {activeQuestions.length}
            </span>
            {getDifficultyBadge(currentQ.difficulty)}
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
              {qType.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Source Citation */}
          {currentQ.sourceCitation && (
            <button
              type="button"
              onClick={() => {
                if (currentQ.sourceCitation?.timestampSeconds !== undefined) {
                  onSeek(currentQ.sourceCitation.timestampSeconds);
                }
              }}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-full border border-white/5 hover:border-indigo-500/40 hover:text-indigo-300 transition-colors"
            >
              <FileText className="w-3 h-3 text-indigo-400" />
              {currentQ.sourceCitation.filename}
            </button>
          )}
        </div>

        {/* Question Text */}
        <div className="space-y-2">
          <h3 className="text-base sm:text-xl font-bold text-white tracking-tight leading-snug">
            {currentQ.question}
          </h3>
          {relatedConcept && (
            <p className="text-xs text-indigo-400 font-mono">
              Concept Target: {relatedConcept.title}
            </p>
          )}
        </div>

        {/* 1. Multiple Choice & True/False Options */}
        {(qType === 'multiple_choice' || qType === 'true_false') && (
          <div className="grid grid-cols-1 gap-3">
            {currentQ.options.map((opt) => {
              const isSelected = selectedAnswer === opt.id;
              const showCorrect = isRevealed && opt.isCorrect;
              const showIncorrect = isRevealed && isSelected && !opt.isCorrect;

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isRevealed}
                  onClick={() => handleSelectOption(opt)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-2 ${
                    showCorrect
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                      : showIncorrect
                      ? 'border-rose-500 bg-rose-950/40 text-rose-200'
                      : isSelected
                      ? 'border-indigo-500 bg-indigo-950/30 text-white'
                      : 'border-white/5 bg-slate-900/60 hover:bg-slate-900 hover:border-white/15 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium leading-relaxed">{opt.text}</span>
                    {showCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                    {showIncorrect && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                  </div>

                  {/* Misconception Diagnostic Explanation */}
                  {isRevealed && (
                    <div className="text-xs pt-2 border-t border-white/5 leading-relaxed font-light">
                      {opt.isCorrect ? (
                        <span className="text-emerald-300 font-normal">
                          ✓ Correct: {opt.misconceptionExplanation}
                        </span>
                      ) : (
                        <span className="text-rose-300/90 font-normal">
                          ⚠ Cognitive Trap: {opt.misconceptionExplanation}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Fill-in-the-Blank */}
        {qType === 'fill_in_the_blank' && (
          <form onSubmit={handleFillBlankSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                disabled={isRevealed}
                value={fillBlankInputs[currentQ.id] || ''}
                onChange={(e) =>
                  setFillBlankInputs((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
                }
                placeholder="Type the missing word or formula here..."
                className="flex-1 bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              {!isRevealed && (
                <button
                  type="submit"
                  className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs transition-colors"
                >
                  Check
                </button>
              )}
            </div>

            {isRevealed && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 space-y-1 text-xs">
                <span className="font-bold text-emerald-400 block">
                  Expected Answer: {currentQ.fillBlankAnswer}
                </span>
                <p className="text-slate-300 leading-relaxed">{currentQ.explanation}</p>
              </div>
            )}
          </form>
        )}

        {/* 3. Short Answer */}
        {qType === 'short_answer' && (
          <div className="space-y-4">
            <textarea
              rows={3}
              disabled={isRevealed}
              value={shortAnswerInputs[currentQ.id] || ''}
              onChange={(e) =>
                setShortAnswerInputs((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
              }
              placeholder="Write your brief pedagogical explanation..."
              className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-amber-500 leading-relaxed"
            />

            {!isRevealed ? (
              <button
                type="button"
                onClick={handleShortAnswerSubmit}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
              >
                Reveal Answer &amp; Self-Assess
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 space-y-2 text-xs">
                <span className="font-bold text-indigo-300 uppercase tracking-wider block">
                  Model Answer &amp; Key Grading Points:
                </span>
                <p className="text-slate-200 leading-relaxed font-light">
                  {currentQ.sampleAnswer || currentQ.explanation}
                </p>
                {currentQ.gradingRubric && currentQ.gradingRubric.length > 0 && (
                  <ul className="space-y-1 pt-1 text-slate-400">
                    {currentQ.gradingRubric.map((rubric, rIdx) => (
                      <li key={rIdx} className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{rubric}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Explanation Card */}
        {isRevealed && currentQ.explanation && (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-xs text-slate-300 space-y-1 animate-in fade-in">
            <span className="font-bold text-indigo-400 uppercase tracking-wider block">
              Pedagogical Rationale:
            </span>
            <p className="leading-relaxed font-light">{currentQ.explanation}</p>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex === activeQuestions.length - 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40 transition-colors shadow-md shadow-indigo-600/20"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
