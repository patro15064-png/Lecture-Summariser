'use client';

import React, { useState, useEffect } from 'react';
import SatinRidges from '@/components/ui/satin-ridges';
import { MediaPlayer } from '@/components/MediaPlayer';
import { LectureSummary } from '@/components/LectureSummary';
import { ConceptGraph } from '@/components/ConceptGraph';
import { FlashcardDeck } from '@/components/FlashcardDeck';
import { FormulaExplorer } from '@/components/FormulaExplorer';
import { UploadModal } from '@/components/UploadModal';
import { KeyVaultModal } from '@/components/KeyVaultModal';
import { DEMO_LECTURES } from '@/data/demoLectures';
import { LectureArtifact } from '@/types/lecture';
import { animateStaggerCards, animateTabSwitch } from '@/lib/animations';
import { 
  UploadCloud, 
  Key, 
  BookOpen, 
  Network, 
  Layers, 
  MessageSquareCode, 
  ChevronDown,
  GraduationCap
} from 'lucide-react';

export default function Home() {
  const [allLectures, setAllLectures] = useState<LectureArtifact[]>(DEMO_LECTURES);
  const [activeLecture, setActiveLecture] = useState<LectureArtifact>(DEMO_LECTURES[0]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'summary' | 'graph' | 'flashcards' | 'chat'>('summary');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_vault_key') || '';
    }
    return '';
  });

  useEffect(() => {
    animateStaggerCards('.stagger-item', 100);
  }, [activeLecture.id]);

  const handleTabChange = (tab: 'summary' | 'graph' | 'flashcards' | 'chat') => {
    setActiveTab(tab);
    animateTabSwitch('#workspace-content');
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    setIsPlaying(true);
  };

  const handleLectureSelect = (id: string) => {
    const selected = allLectures.find((l) => l.id === id);
    if (selected) {
      setActiveLecture(selected);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const handleLectureCreated = (newArtifact: LectureArtifact) => {
    setAllLectures((prev) => [newArtifact, ...prev]);
    setActiveLecture(newArtifact);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col font-sans selection:bg-purple-500/30">
      {/* 60fps Ambient Satin Ridges WebGL/Canvas Shader Background */}
      <SatinRidges className="fixed inset-0 -z-10 pointer-events-none opacity-85" intensity={1.1} speed={0.5} />

      {/* Glassmorphic Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent">
                  Lecture-Summariser
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                  Multimodal v2.0
                </span>
              </div>
            </div>
          </div>

          {/* Center: Lecture Selector */}
          <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-white/10 rounded-xl px-3 py-1.5 shadow-inner">
            <span className="text-xs text-slate-400 font-medium">Lecture:</span>
            <div className="relative">
              <select
                value={activeLecture.id}
                onChange={(e) => handleLectureSelect(e.target.value)}
                className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer pr-6 appearance-none"
              >
                {allLectures.map((lec) => (
                  <option key={lec.id} value={lec.id} className="bg-slate-900 text-white">
                    {lec.title.length > 40 ? `${lec.title.substring(0, 40)}...` : lec.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Zero-Trust Key Vault Trigger */}
            <button
              type="button"
              onClick={() => setIsVaultOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all duration-200 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-white/10 hover:border-indigo-500/30"
              title="Configure Client-Side Gemini Key"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Key Vault</span>
              <span 
                className={`w-2 h-2 rounded-full ${apiKey ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-500'}`} 
                title={apiKey ? 'API Key Active in Client' : 'No Key (Demo Mode Active)'}
              />
            </button>

            {/* Upload Lecture Trigger */}
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:via-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Lecture</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Synchronized Media Stream Controller */}
        <div className="stagger-item">
          <MediaPlayer
            artifact={activeLecture}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            isPlaying={isPlaying}
            onPlayStateChange={setIsPlaying}
          />
        </div>

        {/* Workspace Feature Navigation Tabs */}
        <div className="stagger-item flex border-b border-white/10 overflow-x-auto no-scrollbar gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('summary')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'summary'
                ? 'border-indigo-500 text-white bg-white/5 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Executive Summary &amp; Themes</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('graph')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'graph'
                ? 'border-purple-500 text-white bg-white/5 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Network className="w-4 h-4 text-purple-400" />
            <span>Prerequisite Concept Graph</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('flashcards')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'flashcards'
                ? 'border-pink-500 text-white bg-white/5 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4 text-pink-400" />
            <span>Flashcards &amp; Formulas</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('chat')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'chat'
                ? 'border-emerald-500 text-white bg-white/5 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <MessageSquareCode className="w-4 h-4 text-emerald-400" />
            <span>AI Socratic Chat &amp; Feynman</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Phase 4</span>
          </button>
        </div>

        {/* Tab Content Workspace */}
        <div id="workspace-content" className="stagger-item">
          {activeTab === 'summary' && (
            <LectureSummary
              artifact={activeLecture}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          )}

          {activeTab === 'graph' && (
            <ConceptGraph
              artifact={activeLecture}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          )}

          {activeTab === 'flashcards' && (
            <div className="space-y-10">
              <FlashcardDeck
                artifact={activeLecture}
                onSeek={handleSeek}
              />
              <FormulaExplorer
                artifact={activeLecture}
                onSeek={handleSeek}
              />
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <MessageSquareCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">In-Lecture Socratic AI Tutor &amp; Feynman Voice Coach</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
                Scheduled for Phase 4! Ask any question about the lecture with timestamp citations, practice voice recall, and export to PDF.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onLectureCreated={handleLectureCreated}
        apiKey={apiKey}
      />

      <KeyVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onKeySaved={setApiKey}
      />
    </div>
  );
}
