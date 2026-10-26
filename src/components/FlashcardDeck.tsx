'use client';

import React, { useState } from 'react';
import { 
  Layers, 
  RotateCw, 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  CheckCircle2, 
  HelpCircle, 
  Flame, 
  Sparkles,
  Award,
  RotateCcw
} from 'lucide-react';
import { LectureArtifact, Flashcard } from '@/types/lecture';

interface FlashcardDeckProps {
  artifact: LectureArtifact;
  onSeek: (seconds: number) => void;
}

type RatingType = 'again' | 'good' | 'easy';

export function FlashcardDeck({ artifact, onSeek }: FlashcardDeckProps) {
  const cards: Flashcard[] = artifact.flashcards || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [ratings, setRatings] = useState<Record<string, RatingType>>({});

  if (!cards || cards.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/70 text-center text-slate-400">
        No flashcards generated for this lecture yet.
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const relatedConcept = artifact.concepts?.find((c) => c.id === currentCard.conceptId);

  const handleNext = () => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev < cards.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : cards.length - 1));
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleRate = (rating: RatingType) => {
    setRatings((prev) => ({
      ...prev,
      [currentCard.id]: rating,
    }));
    // Auto advance after rating
    setTimeout(() => {
      handleNext();
    }, 250);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex(Math.floor(Math.random() * cards.length));
  };

  const handleResetProgress = () => {
    setRatings({});
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  // Calculate mastery statistics
  const ratedCount = Object.keys(ratings).length;
  const easyCount = Object.values(ratings).filter((r) => r === 'easy').length;
  const goodCount = Object.values(ratings).filter((r) => r === 'good').length;
  const againCount = Object.values(ratings).filter((r) => r === 'again').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Mastery Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Active-Recall Spaced Repetition Deck
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-normal">
                {cards.length} Flashcards
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Flip to test conceptual retrieval. Rate your confidence to measure mastery.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-slate-300 hover:text-white bg-slate-900 border border-white/10 hover:border-pink-500/30 transition-all"
            title="Shuffle Deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Shuffle</span>
          </button>
          <button
            type="button"
            onClick={handleResetProgress}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-white/5 transition-all"
            title="Reset Ratings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Progress & Mastery Tracker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/10">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Studied</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-white">{ratedCount}</span>
            <span className="text-xs text-slate-500">/ {cards.length} cards</span>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
          <span className="text-[11px] font-semibold text-emerald-400 block mb-1 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" /> Mastered (Easy)
          </span>
          <span className="text-xl font-bold text-emerald-300">{easyCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20">
          <span className="text-[11px] font-semibold text-indigo-400 block mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Retained (Good)
          </span>
          <span className="text-xl font-bold text-indigo-300">{goodCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20">
          <span className="text-[11px] font-semibold text-amber-400 block mb-1 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> Review Again
          </span>
          <span className="text-xl font-bold text-amber-300">{againCount}</span>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div className="flex flex-col items-center">
        <div 
          className="w-full max-w-2xl h-[360px] sm:h-[400px] cursor-pointer [perspective:1000px]"
          onClick={handleFlip}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleFlip();
            }
          }}
          aria-label="Click to flip flashcard"
        >
          <div
            className={`relative w-full h-full duration-500 rounded-3xl transition-transform [transform-style:preserve-3d] ${
              isFlipped ? '[transform:rotateY(180deg)]' : ''
            }`}
          >
            {/* FRONT OF CARD */}
            <div className="absolute inset-0 w-full h-full rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-2xl p-8 flex flex-col justify-between shadow-2xl [backface-visibility:hidden]">
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-slate-300">
                  Card {currentIndex + 1} of {cards.length}
                </span>

                {relatedConcept && (
                  <span className="text-xs font-medium text-pink-400 flex items-center gap-1 bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                    <Sparkles className="w-3 h-3" /> {relatedConcept.title}
                  </span>
                )}
              </div>

              {/* Front Content */}
              <div className="space-y-4 my-auto text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                  Active Recall Prompt
                </span>
                <p className="text-lg sm:text-2xl font-bold text-white leading-relaxed">
                  {currentCard.front}
                </p>

                {currentCard.hint && (
                  <div className="pt-2">
                    {showHint ? (
                      <p className="text-xs font-mono text-purple-300 bg-purple-950/40 border border-purple-500/30 px-3 py-2 rounded-xl inline-block max-w-md animate-in fade-in">
                        💡 Hint: {currentCard.hint}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHint(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" /> Need a hint?
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-slate-500">
                <span>Click card or press Space to reveal answer</span>
                <span className="flex items-center gap-1 text-indigo-400">
                  <RotateCw className="w-3.5 h-3.5" /> Flip Card
                </span>
              </div>
            </div>

            {/* BACK OF CARD */}
            <div className="absolute inset-0 w-full h-full rounded-3xl border border-indigo-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 backdrop-blur-2xl p-8 flex flex-col justify-between shadow-2xl [transform:rotateY(180deg)] [backface-visibility:hidden]">
              {/* Back Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                  Answer &amp; Conceptual Model
                </span>

                {relatedConcept && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(relatedConcept.timestampSeconds);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-all"
                    title="Jump to lecture timestamp"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Review at {relatedConcept.timestampFormatted}</span>
                  </button>
                )}
              </div>

              {/* Back Content */}
              <div className="space-y-4 my-auto overflow-y-auto max-h-[220px] pr-2">
                <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-light">
                  {currentCard.back}
                </p>

                {relatedConcept?.formulaLatex && (
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono text-indigo-300 text-center">
                    <code>{relatedConcept.formulaLatex}</code>
                  </div>
                )}
              </div>

              {/* Spaced-Repetition Feedback Buttons */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate('again');
                  }}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all text-center"
                >
                  Again (Review)
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate('good');
                  }}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 transition-all text-center"
                >
                  Good (Retained)
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate('easy');
                  }}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all text-center"
                >
                  Easy (Mastered)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Navigation Toolbar */}
        <div className="flex items-center justify-between w-full max-w-2xl mt-4 px-2">
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <button
            type="button"
            onClick={handleFlip}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/10 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" /> Flip
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-white/10 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
