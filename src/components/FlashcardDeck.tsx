'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Layers, 
  RotateCw, 
  Play, 
  Pause,
  ChevronLeft, 
  ChevronRight, 
  HelpCircle, 
  Sparkles,
  Headphones,
  Calendar,
  Square
} from 'lucide-react';
import { LectureArtifact, Flashcard, GoldenAudioSnippet, Sm2Rating } from '@/types/lecture';
import { calculateSm2 } from '@/lib/grounding';
import { saveArtifactToCache } from '@/lib/orchestrator';

interface FlashcardDeckProps {
  artifact: LectureArtifact;
  onSeek: (seconds: number) => void;
}

export function FlashcardDeck({ artifact, onSeek }: FlashcardDeckProps) {
  const [cards, setCards] = useState<Flashcard[]>(artifact.flashcards || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [dueOnlyFilter, setDueOnlyFilter] = useState(false);

  // Commute Mode State
  const [isCommuteMode, setIsCommuteMode] = useState(false);
  const [commuteStage, setCommuteStage] = useState<'idle' | 'speaking_question' | 'recall_pause' | 'playing_clip' | 'speaking_takeaway'>('idle');
  const [recallCountdown, setRecallCountdown] = useState(4);
  const [isAudioClipPlaying, setIsAudioClipPlaying] = useState(false);

  const audioClipRef = useRef<HTMLAudioElement | null>(null);

  // Filter cards if "Due Today" is selected
  const activeDeck = React.useMemo(() => {
    if (!dueOnlyFilter) return cards;
    const now = new Date();
    return cards.filter((c) => new Date(c.dueDate) <= now);
  }, [cards, dueOnlyFilter]);

  const currentCard: Flashcard | undefined = activeDeck[currentIndex] || activeDeck[0];
  const relatedConcept = artifact.concepts?.find((c) => c.id === currentCard?.conceptId);
  const goldenSnippets = artifact.goldenSnippets || [];
  const relatedSnippet: GoldenAudioSnippet | undefined = 
    goldenSnippets.find((s) => s.id === currentCard?.snippetId) ||
    goldenSnippets[currentIndex % (goldenSnippets.length || 1)];

  // Navigation handlers
  const handleNext = useCallback(() => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev < activeDeck.length - 1 ? prev + 1 : 0));
  }, [activeDeck.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : activeDeck.length - 1));
  }, [activeDeck.length]);

  const handleFlip = () => setIsFlipped((prev) => !prev);

  // SM-2 Spaced Repetition Rating Handler
  const handleRateSm2 = async (rating: Sm2Rating) => {
    if (!currentCard) return;

    const updated = calculateSm2(
      currentCard.repetition,
      currentCard.interval,
      currentCard.easeFactor,
      rating
    );

    const updatedCard: Flashcard = {
      ...currentCard,
      repetition: updated.repetition,
      interval: updated.interval,
      easeFactor: updated.easeFactor,
      dueDate: updated.dueDate,
    };

    const newCards = cards.map((c) => (c.id === currentCard.id ? updatedCard : c));
    setCards(newCards);

    // Save back to cache
    const updatedArtifact: LectureArtifact = {
      ...artifact,
      flashcards: newCards,
    };
    await saveArtifactToCache(updatedArtifact);

    setTimeout(() => {
      handleNext();
    }, 200);
  };

  // Play Golden Breakthrough Audio Clip
  const playAudioClip = () => {
    if (!relatedSnippet) {
      if (currentCard?.startSeconds !== undefined) onSeek(currentCard.startSeconds);
      return;
    }

    if (artifact.mediaUrl && audioClipRef.current) {
      audioClipRef.current.currentTime = relatedSnippet.startSeconds;
      audioClipRef.current.play().then(() => setIsAudioClipPlaying(true)).catch(() => {});
      
      const clipDurationSec = (relatedSnippet.endSeconds - relatedSnippet.startSeconds);
      setTimeout(() => {
        if (audioClipRef.current) {
          audioClipRef.current.pause();
          setIsAudioClipPlaying(false);
        }
      }, clipDurationSec * 1000);
    } else {
      onSeek(relatedSnippet.startSeconds);
    }
  };

  const stopAudioClip = () => {
    if (audioClipRef.current) {
      audioClipRef.current.pause();
      setIsAudioClipPlaying(false);
    }
  };

  // Web Speech helper
  const speakText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return resolve();
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  };

  const toggleCommuteMode = useCallback((active: boolean) => {
    setIsCommuteMode(active);
    if (!active) {
      setCommuteStage('idle');
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopAudioClip();
    }
  }, []);

  // Commute Mode Step Automation
  useEffect(() => {
    if (!isCommuteMode || !currentCard) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    let isCancelled = false;

    const runCommuteStep = async () => {
      // 1. Speak Question
      setCommuteStage('speaking_question');
      setIsFlipped(false);
      await speakText(`Question: ${currentCard.front}`);
      if (isCancelled) return;

      // 2. Silent Recall Pause
      setCommuteStage('recall_pause');
      setRecallCountdown(4);
      for (let sec = 4; sec > 0; sec--) {
        if (isCancelled) return;
        setRecallCountdown(sec);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (isCancelled) return;

      // Flip card to reveal
      setIsFlipped(true);

      // 3. Play golden breakthrough clip if audio available
      if (artifact.mediaUrl && relatedSnippet) {
        setCommuteStage('playing_clip');
        playAudioClip();
        const durationSec = Math.min(25, relatedSnippet.endSeconds - relatedSnippet.startSeconds);
        await new Promise((r) => setTimeout(r, durationSec * 1000));
        stopAudioClip();
      }
      if (isCancelled) return;

      // 4. Speak Takeaway
      setCommuteStage('speaking_takeaway');
      await speakText(`Key Takeaway: ${currentCard.takeaway}`);
      if (isCancelled) return;

      // Pause before next card
      await new Promise((r) => setTimeout(r, 2000));
      if (isCancelled) return;

      // Advance to next card
      handleNext();
    };

    runCommuteStep();

    return () => {
      isCancelled = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopAudioClip();
    };
  }, [isCommuteMode, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Media Session API for Lock Screen & Headphone Controls
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentCard) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentCard.front,
        artist: artifact.title || 'Lecture Flashcard',
        album: isCommuteMode ? 'Commute Hands-Free Mode' : 'Spaced Repetition Deck',
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrev());
      navigator.mediaSession.setActionHandler('play', () => toggleCommuteMode(true));
      navigator.mediaSession.setActionHandler('pause', () => toggleCommuteMode(false));
    } catch {
      // MediaSession may not support all handlers on older browsers
    }
  }, [currentCard, isCommuteMode, artifact.title, handleNext, handlePrev, toggleCommuteMode]);

  if (activeDeck.length === 0) {
    return (
      <div className="p-8 rounded-3xl border border-white/10 bg-slate-950/70 text-center text-slate-400 space-y-3">
        <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
        <h3 className="text-base font-bold text-white">All Caught Up!</h3>
        <p className="text-xs">Zero flashcards due today under SuperMemo SM-2 scheduling.</p>
        <button
          type="button"
          onClick={() => setDueOnlyFilter(false)}
          className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
        >
          View All {cards.length} Cards
        </button>
      </div>
    );
  }

  // Count due cards
  const now = new Date();
  const dueCount = cards.filter((c) => new Date(c.dueDate) <= now).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hidden audio element for slicing real media clips */}
      {artifact.mediaUrl && (
        <audio ref={audioClipRef} src={artifact.mediaUrl} className="hidden" />
      )}

      {/* Top Banner & Commute Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Spaced-Repetition Audio Flashcards
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-medium">
                SM-2 Scheduled
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Reinforce high-yield golden moments with interval-spaced active recall.
            </p>
          </div>
        </div>

        {/* Action Controls & Commute Mode Trigger */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Due Today Filter Toggle */}
          <button
            type="button"
            onClick={() => setDueOnlyFilter(!dueOnlyFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              dueOnlyFilter
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Due Today ({dueCount})</span>
          </button>

          {/* Commute Hands-Free Mode Toggle */}
          <button
            type="button"
            onClick={() => toggleCommuteMode(!isCommuteMode)}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-lg ${
              isCommuteMode
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400 shadow-emerald-500/25 animate-pulse'
                : 'bg-slate-900 text-slate-300 hover:text-white border-white/10 hover:border-pink-500/30'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span>{isCommuteMode ? 'Commute Mode Active' : 'Start Commute Mode'}</span>
          </button>
        </div>
      </div>

      {/* Commute Mode Status Bar */}
      {isCommuteMode && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-950 to-indigo-950/50 border border-emerald-500/30 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div>
              <span className="font-bold text-white block">Hands-Free Commute Queue</span>
              <span className="text-emerald-300 font-mono">
                {commuteStage === 'speaking_question' && 'Speaking Question (TTS)...'}
                {commuteStage === 'recall_pause' && `Active Recall Window: ${recallCountdown}s`}
                {commuteStage === 'playing_clip' && 'Playing Original Lecture Clip...'}
                {commuteStage === 'speaking_takeaway' && 'Speaking Key Pedagogical Takeaway...'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleCommuteMode(false)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-white/10"
          >
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
      )}

      {/* 3D Flip Card Container */}
      <div className="flex flex-col items-center">
        <div 
          className="w-full max-w-2xl h-[380px] sm:h-[420px] cursor-pointer [perspective:1000px]"
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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-slate-300">
                    Card {currentIndex + 1} of {activeDeck.length}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Rep: {currentCard.repetition} • EF: {currentCard.easeFactor.toFixed(1)}
                  </span>
                </div>

                {relatedConcept && (
                  <span className="text-xs font-semibold text-pink-300 flex items-center gap-1.5 bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/20">
                    <Sparkles className="w-3.5 h-3.5" /> {relatedConcept.title}
                  </span>
                )}
              </div>

              {/* Front Content */}
              <div className="space-y-4 my-auto text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                  Active Recall Prompt
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-white leading-relaxed">
                  {currentCard.front}
                </p>

                {currentCard.hint && (
                  <div className="pt-2">
                    {showHint ? (
                      <p className="text-xs font-mono text-purple-300 bg-purple-950/40 border border-purple-500/30 px-3.5 py-2 rounded-xl inline-block max-w-md animate-in fade-in">
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
                <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <RotateCw className="w-3.5 h-3.5" /> Flip Card
                </span>
              </div>
            </div>

            {/* BACK OF CARD */}
            <div className="absolute inset-0 w-full h-full rounded-3xl border border-indigo-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 backdrop-blur-2xl p-7 flex flex-col justify-between shadow-2xl [transform:rotateY(180deg)] [backface-visibility:hidden]">
              {/* Back Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                  Pedagogical Takeaway
                </span>

                {/* Golden Breakthrough Clip Play Button */}
                {relatedSnippet && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAudioClipPlaying) stopAudioClip();
                      else playAudioClip();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                      isAudioClipPlaying
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-sm shadow-indigo-500/20'
                    }`}
                  >
                    {isAudioClipPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>{isAudioClipPlaying ? 'Pause Clip' : `Play Moment (${relatedSnippet.durationFormatted})`}</span>
                  </button>
                )}
              </div>

              {/* Back Content */}
              <div className="space-y-4 my-auto overflow-y-auto max-h-[220px] pr-2">
                <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-light">
                  {currentCard.back}
                </p>

                {currentCard.takeaway && (
                  <div className="p-3 rounded-2xl bg-slate-900/90 border border-white/10 text-xs text-indigo-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block">
                      Core Breakthrough Intuition:
                    </span>
                    <p className="leading-relaxed">{currentCard.takeaway}</p>
                  </div>
                )}

                {relatedSnippet?.transcriptSnippet && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-[11px] text-slate-400 italic">
                    &ldquo;{relatedSnippet.transcriptSnippet}&rdquo;
                  </div>
                )}
              </div>

              {/* SuperMemo SM-2 Spaced-Repetition Feedback Buttons */}
              <div className="pt-3 border-t border-white/10">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <span>Rate Recall (SM-2 Interval Scheduling):</span>
                  <span>Next: ~{currentCard.interval}d</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRateSm2('again');
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all text-center"
                    title="Again: reset interval (1 day)"
                  >
                    Again (1)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRateSm2('hard');
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all text-center"
                    title="Hard: review sooner"
                  >
                    Hard (2)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRateSm2('good');
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200 border border-indigo-500/40 transition-all text-center"
                    title="Good: ideal standard interval"
                  >
                    Good (3)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRateSm2('easy');
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 transition-all text-center"
                    title="Easy: increase ease factor"
                  >
                    Easy (4)
                  </button>
                </div>
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
