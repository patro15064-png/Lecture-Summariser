'use client';

import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  Key, 
  Music, 
  Video, 
  FileCode,
  ArrowRight
} from 'lucide-react';
import { UserApiSettings } from '@/types/lecture';

interface EmptyStateProps {
  onOpenUpload: () => void;
  onOpenSettings: () => void;
  onLoadSample: () => void;
  settings: UserApiSettings;
  isLoadingSample?: boolean;
}

export function EmptyState({
  onOpenUpload,
  onOpenSettings,
  onLoadSample,
  settings,
  isLoadingSample = false,
}: EmptyStateProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const hasAnyKey = Boolean(
    settings.providers.gemini?.apiKey ||
    settings.providers.openai?.apiKey ||
    settings.providers.groq?.apiKey ||
    settings.providers.anthropic?.apiKey ||
    settings.providers.openrouter?.apiKey ||
    settings.providers.custom?.apiKey ||
    settings.useSingleModel && settings.providers[settings.singleProvider]?.apiKey
  );

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      {/* Hero Welcome */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real Multimodal Lecture-to-Learning Engine</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Turn Any Recorded Lecture Into an <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Interactive Active-Learning Pack
          </span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          Upload any audio, video, or transcript. Extract grounded prerequisite DAG concept graphs, KaTeX formulas, cognitive misconception quizzes, and real sliced audio flashcards.
        </p>
      </div>

      {/* Main Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          onOpenUpload();
        }}
        onClick={onOpenUpload}
        className={`relative group cursor-pointer rounded-3xl border-2 border-dashed p-8 sm:p-14 text-center transition-all duration-300 bg-slate-950/70 backdrop-blur-xl ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-950/30 shadow-2xl shadow-indigo-500/20 scale-[1.01]'
            : 'border-white/15 hover:border-purple-500/50 hover:bg-slate-900/60'
        }`}
      >
        <div className="max-w-md mx-auto space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-purple-500/25 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Drag &amp; drop your lecture media or transcript
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              or click anywhere to browse files or paste notes
            </p>
          </div>

          {/* Supported Format Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-mono text-indigo-300">
              <Music className="w-3 h-3 text-indigo-400" /> MP3, WAV, M4A, AAC
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-mono text-purple-300">
              <Video className="w-3 h-3 text-purple-400" /> MP4, WebM, MOV
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-mono text-emerald-300">
              <FileCode className="w-3 h-3 text-emerald-400" /> VTT, SRT, JSON, TXT
            </span>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:via-purple-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 transition-all transform group-hover:scale-105"
          >
            <span>Select Lecture File or Paste Notes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sample Loader */}
        <div className="p-6 rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
              Zero-Friction Preview
            </span>
            <h4 className="text-base font-bold text-white">
              Load Sample University Lecture
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-light">
              Explore a verified MIT Multivariable Calculus lecture with real transcript timestamps, verbatim quotes, DAG concept graph, and audio cards.
            </p>
          </div>

          <button
            type="button"
            onClick={onLoadSample}
            disabled={isLoadingSample}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-purple-400" />
            <span>{isLoadingSample ? 'Processing Sample...' : 'Load Sample (Sample)'}</span>
          </button>
        </div>

        {/* Bring Your Own API Status */}
        <div className="p-6 rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/5">
                Zero-Trust BYO API
              </span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  hasAnyKey ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
                }`}
              />
            </div>
            <h4 className="text-base font-bold text-white">
              {hasAnyKey ? 'API Key Configured' : 'Configure Your API Key'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-light">
              {hasAnyKey
                ? 'Your client-side API credentials are active in browser memory. No keys leave your device except direct to provider endpoints.'
                : 'No default model is bundled. Provide your own key for Google Gemini, OpenAI, Groq, Anthropic, or OpenRouter.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all"
          >
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Open Provider Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
