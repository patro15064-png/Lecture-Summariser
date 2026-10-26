'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Play, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { LectureArtifact, DiagnosticQuestion, DiagnosticOption } from '@/types/lecture';

interface MisconceptionQuizProps {
  artifact: LectureArtifact;
  onSeek: (seconds: number) => void;
}

export function MisconceptionQuiz({ artifact, onSeek }: MisconceptionQuizProps) {
  const questions: DiagnosticQuestion[] = artifact.diagnosticQuestions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
  const [revealedQuestions, setRevealedQuestions] = useState<Record<string, boolean>>({});

  if (questions.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/70 text-center text-slate-400">
        No diagnostic misconception quizzes available for this lecture.
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const selectedOptionId = selectedAnswers[currentQ.id];
  const isRevealed = Boolean(revealedQuestions[currentQ.id]);
  const relatedConcept = artifact.concepts?.find((c) => c.id === currentQ.conceptId);

  const handleSelectOption = (option: DiagnosticOption) => {
    if (isRevealed) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: option.id }));
    setRevealedQuestions((prev) => ({ ...prev, [currentQ.id]: true }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
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
    setCurrentIndex(0);
  };

  // Calculate stats
  const correctCount = questions.filter((q) => {
    const chosenId = selectedAnswers[q.id];
    const chosenOpt = q.options.find((o) => o.id === chosenId);
    return chosenOpt?.isCorrect;
  }).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Diagnostic Cognitive Misconception Quiz
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-normal">
                {questions.length} Diagnostic Traps
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Probe counterintuitive cognitive traps. Every distractor reveals the exact mental error students commit.
            </p>
          </div>
        </div>

        {/* Progress Badge & Reset */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 font-mono">
            <span>Score:</span>
            <span className="font-bold text-emerald-400">{correctCount}</span>
            <span>/</span>
            <span>{questions.length}</span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition-colors"
            title="Reset Quiz"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Question Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-mono font-semibold rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
              Trap {currentIndex + 1} of {questions.length}
            </span>
            {relatedConcept && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                Topic: {relatedConcept.title}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSeek(currentQ.timestampSeconds)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white border border-white/10 transition-all"
            title="Jump to lecture timestamp"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>
              Review at {Math.floor(currentQ.timestampSeconds / 60)}:
              {(currentQ.timestampSeconds % 60).toString().padStart(2, '0')}
            </span>
          </button>
        </div>

        {/* Question Text */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white leading-relaxed">
            {currentQ.question}
          </h3>
        </div>

        {/* Options List */}
        <div className="space-y-3">
          {currentQ.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const showFeedback = isRevealed;

            let borderStyle = 'border-white/10 hover:border-white/20 bg-slate-900/60';
            if (showFeedback) {
              if (option.isCorrect) {
                borderStyle = 'border-emerald-500/60 bg-emerald-950/20 shadow-md shadow-emerald-500/10';
              } else if (isSelected && !option.isCorrect) {
                borderStyle = 'border-rose-500/60 bg-rose-950/20 shadow-md shadow-rose-500/10';
              } else {
                borderStyle = 'border-white/5 bg-slate-950/40 opacity-70';
              }
            }

            return (
              <div
                key={option.id}
                onClick={() => handleSelectOption(option)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${borderStyle}`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {showFeedback ? (
                      option.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isSelected ? (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-600" />
                      )
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-500 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                        {option.id.slice(-1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <p className={`text-sm ${isSelected ? 'font-semibold text-white' : 'text-slate-200'}`}>
                      {option.text}
                    </p>

                    {/* Explanatory Trap Callout when revealed */}
                    {showFeedback && (isSelected || option.isCorrect) && (
                      <div
                        className={`mt-2 p-3 rounded-lg text-xs leading-relaxed ${
                          option.isCorrect
                            ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/30'
                            : 'bg-rose-950/40 text-rose-200 border border-rose-500/30'
                        }`}
                      >
                        <span className="font-bold block mb-0.5">
                          {option.isCorrect ? '✔ Insight Breakdown:' : '⚠️ Misconception Trap Analysis:'}
                        </span>
                        {option.misconceptionExplanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resolution Box when revealed */}
        {isRevealed && (
          <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2 animate-in fade-in">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Complete Pedagogical Resolution:
            </span>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
              {currentQ.explanation}
            </p>
          </div>
        )}

        {/* Carousel Navigation Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 rounded-xl border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous Trap
          </button>

          <span className="text-xs text-slate-500 font-mono">
            {currentIndex + 1} / {questions.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next Trap <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
