'use client';

import React from 'react';
import { 
  BookOpen, 
  Sparkles, 
  GraduationCap, 
  User, 
  Calendar, 
  Clock, 
  Play, 
  Quote, 
  Flame
} from 'lucide-react';
import { LectureArtifact, GoldenAudioSnippet } from '@/types/lecture';

interface LectureSummaryProps {
  artifact: LectureArtifact;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function LectureSummary({ artifact, currentTime, onSeek }: LectureSummaryProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Overview Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-6 sm:p-8 shadow-xl text-slate-100">
        {/* Subtle Ambient Radial Highlight */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative space-y-6">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
              <GraduationCap className="w-3.5 h-3.5" /> {artifact.course}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-slate-800/80 border border-white/5 text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-400" /> {artifact.lecturer}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-slate-800/80 border border-white/5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> {artifact.date}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-full bg-slate-800/80 border border-white/5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> {artifact.durationFormatted}
            </span>
          </div>

          {/* Lecture Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {artifact.title}
            </h1>
          </div>

          {/* Executive Overview */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
              <BookOpen className="w-4 h-4" /> Executive Synthesis
            </div>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
              {artifact.overview}
            </p>
          </div>

          {/* Core Themes */}
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

      {/* Golden Audio/Video Breakthrough Moments */}
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
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                        {snippet.durationFormatted} ({Math.floor(snippet.startSeconds / 60)}:{(snippet.startSeconds % 60).toString().padStart(2, '0')})
                      </span>

                      <button
                        type="button"
                        onClick={() => onSeek(snippet.startSeconds)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                          isActive
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                        }`}
                        title="Jump to snippet timestamp"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Jump</span>
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-white leading-snug">
                      {snippet.title}
                    </h3>

                    {/* Quote */}
                    <div className="relative pl-3 border-l-2 border-indigo-500/40 italic text-xs text-slate-300 leading-relaxed font-light">
                      <Quote className="w-3 h-3 text-indigo-400/50 absolute -top-1 -left-2 fill-current" />
                      {snippet.transcriptSnippet}
                    </div>
                  </div>

                  {/* Why it matters callout */}
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <span className="text-[11px] font-semibold text-purple-300 block mb-0.5">
                      Why This Matters:
                    </span>
                    <p className="text-xs text-slate-400 leading-normal">
                      {snippet.whyItMatters}
                    </p>
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
