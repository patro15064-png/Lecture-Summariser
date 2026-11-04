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
  Volume2,
  VolumeX,
  FileText,
  Gauge
} from 'lucide-react';
import { LectureArtifact, Flashcard, GoldenAudioSnippet, Sm2Rating } from '@/types/lecture';
import { calculateSm2 } from '@/lib/grounding';
import { saveStudyKitToStorage } from '@/lib/studyKitStorage';

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

  // 30s TTS Golden Explanation State
  const [isSpeakingExplanation, setIsSpeakingExplanation] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);

  // Commute Mode State
  const [isCommuteMode, setIsCommuteMode] = useState(false);
  const [commuteStage, setCommuteStage] = useState<'idle' | 'speaking_question' | 'recall_pause' | 'playing_clip' | 'speaking_takeaway'>('idle');
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingExplanation(false);
    }
    setIsFlipped(false);
    setShowHint(false);
    setCurrentIndex((prev) => (prev < activeDeck.length - 1 ? prev + 1 : 0));
  }, [activeDeck.length]);

  const handlePrev = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingExplanation(false);
    }
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

    // Save back to IndexedDB
    const updatedArtifact: LectureArtifact = {
      ...artifact,
      flashcards: newCards,
    };
    await saveStudyKitToStorage(updatedArtifact);

    setTimeout(() => {
      handleNext();
    }, 200);
  };

  // 30-Second Golden Explanation TTS Player
  const toggleSpeechExplanation = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !currentCard) return;

    if (isSpeakingExplanation) {
      window.speechSynthesis.cancel();
      setIsSpeakingExplanation(false);
      return;
    }

    window.speechSynthesis.cancel();
    const explanationText =
      currentCard.audioExplanation ||
      `${currentCard.front}. Here is the core explanation: ${currentCard.back}. Key takeaway to remember: ${currentCard.takeaway}`;

    const utterance = new SpeechSynthesisUtterance(explanationText);
    utterance.rate = speechRate;
    utterance.onend = () => setIsSpeakingExplanation(false);
    utterance.onerror = () => setIsSpeakingExplanation(false);
    setIsSpeakingExplanation(true);
    window.speechSynthesis.speak(utterance);
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

  // Commute Hands-Free Mode Controller
  const toggleCommuteMode = useCallback((start: boolean) => {
    if (!start) {
      setIsCommuteMode(false);
      setCommuteStage('idle');
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopAudioClip();
      return;
    }
    setIsCommuteMode(true);
    setCommuteStage('speaking_question');
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '1') {
        handleRateSm2('again');
      } else if (e.key === '2') {
        handleRateSm2('hard');
      } else if (e.key === '3') {
        handleRateSm2('good');
      } else if (e.key === '4') {
        handleRateSm2('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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
  const progressPercent = Math.round(((currentIndex + 1) / activeDeck.length) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hidden audio element for slicing real media clips */}
      {artifact.mediaUrl && (
        <audio ref={audioClipRef} src={artifact.mediaUrl} className="hidden" />
      )}

      {/* Top Banner, Progress & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Spaced-Repetition Active Recall
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 font-medium">
                SM-2 Scheduled
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Reinforce high-yield concepts with interval-spaced active recall and 30s audio explanations.
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
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-900 border-white/5'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
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
            <span>{isCommuteMode ? `Commute: ${commuteStage.replace('_', ' ')}` : 'Commute Mode'}</span>
          </button>
        </div>
      </div>

      {/* Visual Deck Progress Bar */}
      <div className="max-w-2xl mx-auto space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Card {currentIndex + 1} of {activeDeck.length}</span>
          <span>{progressPercent}% Complete</span>
        </div>
        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 30s Audio Golden Explanation Toolbar */}
      <div className="max-w-2xl mx-auto flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-white/10 text-xs">
        <button
          type="button"
          onClick={toggleSpeechExplanation}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
            isSpeakingExplanation
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/20'
          }`}
        >
          {isSpeakingExplanation ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span>{isSpeakingExplanation ? 'Pause 30s Explanation' : 'Listen to 30s Explanation'}</span>
        </button>

        {/* Speed Selector */}
        <div className="flex items-center gap-2 text-slate-400">
          <Gauge className="w-3.5 h-3.5" />
          <span className="text-[11px] font-mono">Speed:</span>
          <select
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            className="bg-slate-900 text-white text-xs rounded-lg px-2 py-1 border border-white/10 focus:outline-none cursor-pointer"
          >
            <option value="0.75">0.75x</option>
            <option value="1.0">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2.0">2.0x</option>
          </select>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div className="flex flex-col items-center">
        <div 
          className="w-full max-w-2xl h-[380px] sm:h-[420px] cursor-pointer [perspective:1000px]"
          onClick={handleFlip}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleFlip();
          }}
        >
          <div 
            className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
              isFlipped ? '[transform:rotateY(180deg)]' : ''
            }`}
          >
            {/* FRONT OF CARD */}
            <div className="absolute inset-0 w-full h-full rounded-3xl border border-white/15 bg-slate-950/90 backdrop-blur-2xl p-7 flex flex-col justify-between shadow-2xl [backface-visibility:hidden]">
              {/* Front Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300">
                    Active Recall Prompt
                  </span>
                  {relatedConcept && (
                    <span className="text-xs text-slate-400 truncate max-w-[180px]">
                      {relatedConcept.title}
                    </span>
                  )}
                </div>

                {/* Source Citation Badge */}
                {currentCard.sourceCitation && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono bg-slate-900 px-2.5 py-0.5 rounded-full border border-white/5">
                    <FileText className="w-3 h-3 text-indigo-400" />
                    {currentCard.sourceCitation.filename}
                    {currentCard.sourceCitation.pageNumber ? ` p.${currentCard.sourceCitation.pageNumber}` : ''}
                  </span>
                )}
              </div>

              {/* Front Question Content */}
              <div className="space-y-4 my-auto text-center px-4">
                <p className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-relaxed">
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
                    <span>{isAudioClipPlaying ? 'Pause Moment' : `Original Clip (${relatedSnippet.durationFormatted})`}</span>
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
              </div>

              {/* SuperMemo SM-2 Spaced-Repetition Feedback Buttons */}
              <div className="pt-3 border-t border-white/10">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <span>Rate Recall (SM-2 Interval Scheduling):</span>
                  <span>Interval: ~{currentCard.interval}d</span>
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
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all text-center"
                    title="Good: standard advance"
                  >
                    Good (3)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRateSm2('easy');
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all text-center"
                    title="Easy: extended interval"
                  >
                    Easy (4)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation Buttons */}
        <div className="flex items-center gap-4 mt-6">
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
