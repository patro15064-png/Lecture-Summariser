'use client';

import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  GraduationCap, 
  User, 
  Calendar, 
  Clock, 
  Play, 
  Flame,
  Volume2,
  VolumeX,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { LectureArtifact, GoldenAudioSnippet, DetailedSummarySection } from '@/types/lecture';

interface LectureSummaryProps {
  artifact: LectureArtifact;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function LectureSummary({ artifact, currentTime, onSeek }: LectureSummaryProps) {
  const [speakingOverview, setSpeakingOverview] = useState(false);
  const [isEli12Mode, setIsEli12Mode] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({ 0: true, 1: true });

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const oneLineTldr =
    artifact.summaries?.oneLineTldr ||
    artifact.overview?.split('.')[0] + '.' ||
    'Comprehensive active-learning synthesis generated from your study material.';

  const standardSummary = artifact.summaries?.shortSummary || artifact.overview;
  
  // ELI12 (Explain Like I'm 12) summary text
  const eli12Text =
    artifact.summaries?.eli12Summary ||
    `Think of this topic like building a mega Lego fortress: first, you lay down the big solid base bricks (the core concepts). Every formula and rule is just like a special connector that keeps the whole castle from falling down when you test it!`;

  const detailedSections: DetailedSummarySection[] =
    artifact.summaries?.detailedSections && artifact.summaries.detailedSections.length > 0
      ? artifact.summaries.detailedSections
      : [
          {
            sectionTitle: 'Foundational Concepts & Background',
            content: artifact.overview,
            keyPoints: artifact.keyThemes?.slice(0, 3) || ['Foundational principles', 'Prerequisite insights'],
          },
        ];

  const keyTakeaways =
    artifact.summaries?.keyTakeaways && artifact.summaries.keyTakeaways.length > 0
      ? artifact.summaries.keyTakeaways
      : artifact.keyThemes && artifact.keyThemes.length > 0
      ? artifact.keyThemes.map((t) => `Core theme: ${t}`)
      : ['Mastery of core definitions and relationships', 'Active recall of key breakthrough concepts'];

  const handleReadAloud = (textToRead: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingOverview) {
      window.speechSynthesis.cancel();
      setSpeakingOverview(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingOverview(false);
      utterance.onerror = () => setSpeakingOverview(false);
      setSpeakingOverview(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. One-Line TL;DR Highlight Card */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-950/80 backdrop-blur-xl p-5 shadow-xl text-slate-100 flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            One-Line TL;DR
          </span>
          <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
            {oneLineTldr}
          </p>
        </div>
      </div>

      {/* 2. Executive Synthesis Card with ELI12 Switch */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-6 sm:p-8 shadow-xl text-slate-100">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
              <GraduationCap className="w-3.5 h-3.5" /> {artifact.course || 'Universal Study Kit'}
            </span>
            {artifact.lecturer && (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-slate-800/80 border border-white/5 text-slate-300">
                <User className="w-3.5 h-3.5 text-slate-400" /> {artifact.lecturer}
              </span>
            )}
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-slate-800/80 border border-white/5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> {artifact.date || new Date().toISOString().split('T')[0]}
            </span>
            {artifact.durationFormatted && (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-full bg-slate-800/80 border border-white/5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {artifact.durationFormatted}
              </span>
            )}
            {artifact.sourceFiles && artifact.sourceFiles.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                <FileText className="w-3.5 h-3.5" /> {artifact.sourceFiles.length} Source Materials
              </span>
            )}
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {artifact.title}
            </h1>
          </div>

          {/* Synthesis Header & ELI12 Switch */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <BookOpen className="w-4 h-4" />
                <span>{isEli12Mode ? "ELI12 (Explain Like I'm 12)" : 'Executive Summary'}</span>
              </div>

              <div className="flex items-center gap-3">
                {/* ELI12 Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setIsEli12Mode(!isEli12Mode)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                    isEli12Mode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                      : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                  }`}
                  title="Toggle simplified, analogy-driven explanation"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Explain like I&apos;m 12</span>
                </button>

                {/* Read Aloud */}
                <button
                  type="button"
                  onClick={() => handleReadAloud(isEli12Mode ? eli12Text : standardSummary)}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors bg-slate-900/80 px-2.5 py-1 rounded-xl border border-white/10"
                  title="Read aloud"
                >
                  {speakingOverview ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{speakingOverview ? 'Stop' : 'Listen'}</span>
                </button>
              </div>
            </div>

            {/* Summary Text Content */}
            <div className={`p-4 rounded-xl border transition-all leading-relaxed font-light ${
              isEli12Mode
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-100 text-sm sm:text-base font-normal'
                : 'bg-slate-900/50 border-white/5 text-slate-300 text-sm sm:text-base'
            }`}>
              {isEli12Mode ? eli12Text : standardSummary}
            </div>
          </div>

          {/* Key Themes Pills */}
          {artifact.keyThemes && artifact.keyThemes.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-white/5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Pivotal Conceptual Themes:
              </span>
              <div className="flex flex-wrap gap-2">
                {artifact.keyThemes.map((theme, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-900/90 border border-white/10 text-slate-200 hover:border-purple-500/40 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Section-by-Section Detailed Summary */}
      {detailedSections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              Detailed Section-by-Section Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {detailedSections.length} Sections
            </span>
          </div>

          <div className="space-y-3">
            {detailedSections.map((sec, idx) => {
              const isExpanded = Boolean(expandedSections[idx]);

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 overflow-hidden transition-all shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(idx)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm sm:text-base font-semibold text-white">
                        {sec.sectionTitle}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {sec.sourceCitation && (
                        <span className="hidden sm:inline-block text-[11px] text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-full border border-white/5 font-mono">
                          {sec.sourceCitation.filename}
                          {sec.sourceCitation.pageNumber ? ` • p. ${sec.sourceCitation.pageNumber}` : ''}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-white/5 text-sm text-slate-300">
                      <p className="leading-relaxed font-light">{sec.content}</p>

                      {sec.keyPoints && sec.keyPoints.length > 0 && (
                        <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-white/5">
                          <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block">
                            Key Takeaways in this Section:
                          </span>
                          <ul className="space-y-1 text-xs text-slate-300">
                            {sec.keyPoints.map((pt, pIdx) => (
                              <li key={pIdx} className="flex items-start gap-2">
                                <span className="text-indigo-400">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Core Takeaways Grid */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 space-y-4">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          High-Yield Key Takeaways
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {keyTakeaways.map((takeaway, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-900/80 border border-white/5 text-xs text-slate-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{takeaway}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Golden Audio Breakthrough Moments */}
      {artifact.goldenSnippets && artifact.goldenSnippets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Flame className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Golden Audio Breakthrough Moments
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {artifact.goldenSnippets.length} High-Yield Segments
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {artifact.goldenSnippets.map((snippet: GoldenAudioSnippet) => {
              const isActive = currentTime >= snippet.startSeconds && currentTime <= snippet.endSeconds;

              return (
                <div
                  key={snippet.id}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-300 p-5 ${
                    isActive
                      ? 'border-indigo-500/60 bg-indigo-950/30 shadow-lg shadow-indigo-500/10 scale-[1.02]'
                      : 'border-white/10 bg-slate-950/70 hover:border-white/20'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                        {snippet.durationFormatted} ({Math.floor(snippet.startSeconds / 60)}:{(snippet.startSeconds % 60).toString().padStart(2, '0')})
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">
                      {snippet.title}
                    </h4>

                    <div className="relative pl-3 border-l-2 border-indigo-500/40 text-xs text-slate-300 italic font-serif">
                      &ldquo;{snippet.transcriptSnippet}&rdquo;
                    </div>

                    <p className="text-xs text-slate-400 font-light">
                      {snippet.whyItMatters}
                    </p>
                  </div>

                  <div className="pt-4 mt-2 border-t border-white/5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onSeek(snippet.startSeconds)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play Moment</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
