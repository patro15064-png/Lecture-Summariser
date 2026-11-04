'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppDynamicBackground } from '@/components/SynthlyWorkspace';
import { MediaPlayer } from '@/components/MediaPlayer';
import { LectureSummary } from '@/components/LectureSummary';
import { ConceptGraph } from '@/components/ConceptGraph';
import { FlashcardDeck } from '@/components/FlashcardDeck';
import { MisconceptionQuiz } from '@/components/MisconceptionQuiz';
import { StudyKitExtras } from '@/components/StudyKitExtras';
import { SocraticChat } from '@/components/SocraticChat';
import { FeynmanCoach } from '@/components/FeynmanCoach';
import { ExportModal } from '@/components/ExportModal';
import { SettingsModal } from '@/components/SettingsModal';
import { StudyKitsLibraryModal } from '@/components/StudyKitsLibraryModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DEMO_LECTURES } from '@/data/demoLectures';
import { LectureArtifact, UserApiSettings, UploadedFileItem } from '@/types/lecture';
import { animateStaggerCards, animateTabSwitch } from '@/lib/animations';
import { loadUserApiSettings, saveUserApiSettings } from '@/lib/providerSettings';
import { extractAnyLearningMaterial, UniversalExtractionResult } from '@/lib/documentExtractors';
import { runUniversalLearningPipeline, PipelineCancellationToken } from '@/lib/orchestrator';
import { getAllSavedStudyKits, saveStudyKitToStorage } from '@/lib/studyKitStorage';
import { 
  UploadCloud, 
  Key, 
  BookOpen, 
  Network, 
  Layers, 
  MessageSquareCode, 
  ChevronDown,
  GraduationCap,
  Download,
  Compass,
  Award,
  Sparkles,
  Camera,
  Link as LinkIcon,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  AlertCircle,
  X,
  Trash2,
  Plus,
  HelpCircle,
  Library,
  Zap
} from 'lucide-react';

export default function Home() {
  const [allLectures, setAllLectures] = useState<LectureArtifact[]>([]);
  const [activeLecture, setActiveLecture] = useState<LectureArtifact | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'summary' | 'graph' | 'flashcards' | 'quizzes' | 'extras' | 'chat'>('summary');
  const [chatSubTab, setChatSubTab] = useState<'socratic' | 'feynman'>('socratic');

  // Modals & Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Universal File Upload & Queue State
  const [queuedFiles, setQueuedFiles] = useState<UploadedFileItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showPastedTextInput, setShowPastedTextInput] = useState(false);
  const [webUrlInput, setWebUrlInput] = useState('');
  const [showWebUrlInput, setShowWebUrlInput] = useState(false);

  // Pipeline Processing Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const cancellationTokenRef = useRef<PipelineCancellationToken | null>(null);

  const [settings, setSettings] = useState<UserApiSettings>(() => loadUserApiSettings());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved study kits from IndexedDB on startup
  useEffect(() => {
    getAllSavedStudyKits().then((saved) => {
      if (saved && saved.length > 0) {
        setAllLectures(saved);
      }
    });
  }, []);

  useEffect(() => {
    if (activeLecture) {
      animateStaggerCards('.stagger-item', 100);
    }
  }, [activeLecture]);

  // Global Clipboard Paste Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeLecture || isProcessing) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const newFileItem: UploadedFileItem = {
              id: `paste-img-${Date.now()}-${i}`,
              file,
              name: `Pasted Screenshot ${new Date().toLocaleTimeString()}.png`,
              size: file.size,
              type: file.type || 'image/png',
              status: 'queued',
              mimeCategory: 'image',
              previewUrl: URL.createObjectURL(file),
            };
            setQueuedFiles((prev) => [...prev, newFileItem]);
          }
        } else if (item.type === 'text/plain') {
          item.getAsString((text) => {
            if (text.trim().length > 20) {
              const textBlob = new Blob([text], { type: 'text/plain' });
              const newFileItem: UploadedFileItem = {
                id: `paste-txt-${Date.now()}`,
                file: new File([textBlob], `Pasted Notes ${new Date().toLocaleTimeString()}.txt`, { type: 'text/plain' }),
                name: `Pasted Notes ${new Date().toLocaleTimeString()}.txt`,
                size: text.length,
                type: 'text/plain',
                status: 'queued',
                mimeCategory: 'text',
                extractedText: text,
              };
              setQueuedFiles((prev) => [...prev, newFileItem]);
            }
          });
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeLecture, isProcessing]);

  const handleTabChange = (tab: 'summary' | 'graph' | 'flashcards' | 'quizzes' | 'extras' | 'chat') => {
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

  const handleLoadSample = () => {
    setIsLoadingSample(true);
    setTimeout(() => {
      const sample = DEMO_LECTURES[0];
      setAllLectures((prev) => (prev.some((l) => l.id === sample.id) ? prev : [sample, ...prev]));
      setActiveLecture(sample);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsLoadingSample(false);
    }, 300);
  };

  const handleUpdateSettings = (newSettings: UserApiSettings) => {
    setSettings(newSettings);
    saveUserApiSettings(newSettings);
  };

  // Add files to queue
  const handleAddFiles = (files: FileList | File[]) => {
    const newItems: UploadedFileItem[] = Array.from(files).map((f, idx) => {
      let cat: UploadedFileItem['mimeCategory'] = 'unknown';
      if (f.type.startsWith('image/')) cat = 'image';
      else if (f.type.includes('pdf')) cat = 'pdf';
      else if (f.type.includes('word') || f.type.includes('presentation') || f.type.includes('epub')) cat = 'document';
      else if (f.type.startsWith('audio/')) cat = 'audio';
      else if (f.type.startsWith('video/')) cat = 'video';
      else if (f.type.startsWith('text/')) cat = 'text';

      return {
        id: `file-${Date.now()}-${idx}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type || 'unknown',
        status: 'queued',
        mimeCategory: cat,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
      };
    });

    setQueuedFiles((prev) => [...prev, ...newItems]);
  };

  const handleRemoveQueuedFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Add Pasted Raw Text to queue
  const handleAddPastedText = () => {
    if (!pastedText.trim()) return;
    const blob = new Blob([pastedText], { type: 'text/plain' });
    const file = new File([blob], `Pasted Notes ${new Date().toLocaleTimeString()}.txt`, { type: 'text/plain' });
    const item: UploadedFileItem = {
      id: `pasted-${Date.now()}`,
      file,
      name: file.name,
      size: pastedText.length,
      type: 'text/plain',
      status: 'queued',
      mimeCategory: 'text',
      extractedText: pastedText,
    };
    setQueuedFiles((prev) => [...prev, item]);
    setPastedText('');
    setShowPastedTextInput(false);
  };

  // Add Web or YouTube Link to queue
  const handleAddWebUrl = () => {
    if (!webUrlInput.trim()) return;
    const url = webUrlInput.trim();
    const isYt = url.includes('youtube.com') || url.includes('youtu.be');
    const title = isYt ? `YouTube Video Link (${url.slice(0, 30)}...)` : `Web Article (${url.slice(0, 30)}...)`;

    const blob = new Blob([`[Learning Resource URL]: ${url}\nPlease analyze and generate a complete study kit based on this content.`], { type: 'text/plain' });
    const file = new File([blob], `${title}.txt`, { type: 'text/plain' });

    const item: UploadedFileItem = {
      id: `url-${Date.now()}`,
      file,
      name: title,
      size: url.length,
      type: 'text/plain',
      status: 'queued',
      mimeCategory: 'link',
      extractedText: `Web Resource URL: ${url}`,
    };

    setQueuedFiles((prev) => [...prev, item]);
    setWebUrlInput('');
    setShowWebUrlInput(false);
  };

  // Main Universal Analysis Trigger
  const handleRunUniversalPipeline = async () => {
    if (queuedFiles.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgressPercent(5);
    setProgressStage('Validating and reading uploaded study files...');

    const token = new PipelineCancellationToken();
    cancellationTokenRef.current = token;

    try {
      const extractionResults: UniversalExtractionResult[] = [];

      // Process each file with progress updates
      for (let i = 0; i < queuedFiles.length; i++) {
        token.check();
        const item = queuedFiles[i];

        // Update item status to reading
        setQueuedFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'reading', progressMessage: 'Reading file signature...' } : f))
        );

        if (!item.file) continue;

        // Validation: 0-byte file check
        if (item.file.size === 0) {
          setQueuedFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: 'failed', errorReason: 'File is empty (0 bytes).' } : f))
          );
          extractionResults.push({
            filename: item.name,
            fileType: 'application/x-empty',
            fileSize: 0,
            success: false,
            totalWordCount: 0,
            sections: [],
            combinedText: '',
            errorReason: 'File is empty (0 bytes).',
          });
          continue;
        }

        try {
          const res = await extractAnyLearningMaterial(item.file, item.name, (stage, pct) => {
            setProgressStage(stage);
            setProgressPercent(Math.round(5 + ((i + pct / 100) / queuedFiles.length) * 45));
          });

          extractionResults.push(res);

          setQueuedFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: res.success ? 'done' : 'failed',
                    errorReason: res.errorReason,
                    progressMessage: res.success ? `Extracted ${res.totalWordCount} words` : res.errorReason,
                  }
                : f
            )
          );
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : 'Extraction error';
          extractionResults.push({
            filename: item.name,
            fileType: item.type,
            fileSize: item.size,
            success: false,
            totalWordCount: 0,
            sections: [],
            combinedText: '',
            errorReason: reason,
          });
          setQueuedFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: 'failed', errorReason: reason } : f))
          );
        }
      }

      // Check if at least one file extracted successfully
      const successfulCount = extractionResults.filter((r) => r.success).length;
      if (successfulCount === 0) {
        throw new Error('All uploaded files failed extraction. Please review the errors on each file.');
      }

      // Run Synthesis Pipeline
      token.check();
      setProgressStage('Synthesizing study kit: summaries, concept DAG, flashcards, and quizzes...');
      setProgressPercent(55);

      const studyKit = await runUniversalLearningPipeline({
        studyKitId: `kit-${Date.now()}`,
        metadata: {
          title: queuedFiles.find((f) => f.status === 'done')?.name.replace(/\.[^.]+$/, '') || 'Universal Study Kit',
        },
        materials: extractionResults,
        settings,
        onProgress: (stage, pct) => {
          setProgressStage(stage);
          setProgressPercent(Math.round(55 + (pct / 100) * 45));
        },
        cancellationToken: token,
      });

      // Save to IndexedDB and set active
      await saveStudyKitToStorage(studyKit);
      setAllLectures((prev) => [studyKit, ...prev]);
      setActiveLecture(studyKit);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsProcessing(false);
      setQueuedFiles([]);
    } catch (err: unknown) {
      console.error('[Universal Pipeline Error]:', err);
      setIsProcessing(false);
      setProgressStage('');
      alert(err instanceof Error ? err.message : 'Pipeline interrupted. Check files and try again.');
    }
  };

  const handleCancelPipeline = () => {
    if (cancellationTokenRef.current) {
      cancellationTokenRef.current.cancel();
      setIsProcessing(false);
      setProgressStage('Processing cancelled.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (cat?: UploadedFileItem['mimeCategory']) => {
    switch (cat) {
      case 'image':
        return <FileImage className="w-5 h-5 text-pink-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-400" />;
      case 'document':
        return <FileCode className="w-5 h-5 text-indigo-400" />;
      case 'audio':
        return <FileAudio className="w-5 h-5 text-amber-400" />;
      case 'video':
        return <FileVideo className="w-5 h-5 text-purple-400" />;
      case 'link':
        return <LinkIcon className="w-5 h-5 text-sky-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const hasConfiguredKey = Boolean(
    settings.providers.gemini?.apiKey ||
    settings.providers.openai?.apiKey ||
    settings.providers.groq?.apiKey ||
    settings.providers.anthropic?.apiKey ||
    settings.providers.openrouter?.apiKey ||
    settings.providers.custom?.apiKey ||
    (settings.useSingleModel && settings.providers[settings.singleProvider]?.apiKey)
  );

  const primaryApiKey = settings.providers.gemini?.apiKey || settings.providers[settings.singleProvider]?.apiKey || '';

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col font-sans selection:bg-purple-500/30">
      {/* 60fps Ambient Studio Canvas */}
      <AppDynamicBackground className="fixed inset-0 -z-10 pointer-events-none opacity-85" intensity={1.1} />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div 
            onClick={() => setActiveLecture(null)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent">
                  Lecture-Summariser
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                  Universal Study Kit
                </span>
              </div>
            </div>
          </div>

          {/* Center: Study Kit Selector */}
          {activeLecture && allLectures.length > 0 && (
            <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-white/10 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="text-xs text-slate-400 font-medium">Kit:</span>
              <div className="relative">
                <select
                  value={activeLecture.id}
                  onChange={(e) => handleLectureSelect(e.target.value)}
                  className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer pr-6 appearance-none max-w-[260px] truncate"
                >
                  {allLectures.map((lec) => (
                    <option key={lec.id} value={lec.id} className="bg-slate-900 text-white">
                      {lec.title.length > 35 ? `${lec.title.substring(0, 35)}...` : lec.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Library of Previous Kits */}
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-200 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-white/10"
              title="Open previous study kits library"
            >
              <Library className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Library ({allLectures.length})</span>
            </button>

            {/* Export Study Pack (Visible when kit is active) */}
            {activeLecture && (
              <button
                type="button"
                onClick={() => setIsExportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-200 bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 hover:text-white border-purple-500/30 hover:border-purple-500/60 shadow-sm"
                title="Download as PDF, Markdown, Anki CSV, or ZIP"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Export Pack</span>
              </button>
            )}

            {/* Background Studio Link */}
            <a
              href="/studio"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all duration-200 bg-zinc-900/80 hover:bg-zinc-800 text-purple-300 hover:text-white border-purple-500/30 hover:border-purple-400/60 shadow-sm"
              title="Interactive Studio"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Studio</span>
            </a>

            {/* Zero-Trust BYO API Settings */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all duration-200 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-white/10"
              title="Configure Bring Your Own API Key"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Key Vault</span>
              <span 
                className={`w-2 h-2 rounded-full ${hasConfiguredKey ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-500'}`} 
              />
            </button>

            {/* New Upload / Back to Dropzone Button */}
            {activeLecture && (
              <button
                type="button"
                onClick={() => setActiveLecture(null)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:opacity-90 shadow-md shadow-purple-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload New</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!activeLecture ? (
          /* UNIVERSAL DROPZONE: DRAG & DROP / CAMERA / PASTE / MULTI-FILE INPUT */
          <ErrorBoundary sectionName="Universal Learning Ingest Zone">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 py-6">
              {/* Header Hero */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Universal Learning Ingest &bull; Multi-Format &bull; Never Crashes</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  Upload Anything. <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                    Learn and Master Everything.
                  </span>
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
                  Drop notes, PDFs, photos of whiteboards, slides, textbook pages, recorded audio, video, or pasted text. Slices high-yield concepts into prerequisite DAG graphs, SM-2 flashcards, and diagnostic quizzes.
                </p>
              </div>

              {/* Large Drag-and-Drop Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleAddFiles(e.dataTransfer.files);
                  }
                }}
                className={`relative group rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-300 bg-slate-950/70 backdrop-blur-xl ${
                  isDragOver
                    ? 'border-indigo-400 bg-indigo-950/30 shadow-2xl shadow-indigo-500/20 scale-[1.01]'
                    : 'border-white/15 hover:border-purple-500/50 hover:bg-slate-900/60'
                }`}
              >
                {/* Hidden File Inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAddFiles(e.target.files);
                    }
                  }}
                  className="hidden"
                />

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAddFiles(e.target.files);
                    }
                  }}
                  className="hidden"
                />

                <div className="max-w-md mx-auto space-y-5">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-purple-500/25 group-hover:scale-110 transition-transform cursor-pointer"
                  >
                    <UploadCloud className="w-8 h-8" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      Drag &amp; drop learning material here
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Supports photos, PDF, DOCX, PPTX, EPUB, audio, video, or clipboard paste
                    </p>
                  </div>

                  {/* Quick Action Pill Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-indigo-300 transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" /> Browse Files
                    </button>

                    {/* Camera Capture on Mobile */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-pink-300 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" /> Scan Notes / Whiteboard
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPastedTextInput(!showPastedTextInput)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-purple-300 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" /> Paste Raw Text
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowWebUrlInput(!showWebUrlInput)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-sky-300 transition-colors"
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Add Web / YouTube Link
                    </button>
                  </div>

                  {/* Supported Format Pills */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3 text-[10px] text-slate-400 font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-white/5">PDF</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-white/5">DOCX</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-white/5">PPTX</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-white/5">EPUB</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-white/5">JPG/PNG/WEBP/HEIC</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-white/5">MP3/WAV/MP4/MOV</span>
                  </div>
                </div>
              </div>

              {/* Collapsible Pasted Raw Text Area */}
              {showPastedTextInput && (
                <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/80 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Paste Lecture Notes / Article
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPastedTextInput(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste lecture transcript, study notes, or textbook excerpt here..."
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleAddPastedText}
                    disabled={!pastedText.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
                  >
                    Add Pasted Text to Queue
                  </button>
                </div>
              )}

              {/* Collapsible Web / YouTube Link Input */}
              {showWebUrlInput && (
                <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/80 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon className="w-4 h-4" /> Add Web Article or YouTube URL
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowWebUrlInput(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={webUrlInput}
                      onChange={(e) => setWebUrlInput(e.target.value)}
                      placeholder="https://en.wikipedia.org/... or https://youtube.com/watch?v=..."
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddWebUrl}
                      disabled={!webUrlInput.trim()}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
                    >
                      Add URL
                    </button>
                  </div>
                </div>
              )}

              {/* File Preview Cards Queue */}
              {queuedFiles.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Upload Queue ({queuedFiles.length} Material{queuedFiles.length > 1 ? 's' : ''})
                    </span>
                    <button
                      type="button"
                      onClick={() => setQueuedFiles([])}
                      disabled={isProcessing}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear All
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {queuedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-white/10 bg-slate-950/80 shadow-md"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5 shrink-0">
                            {getFileIcon(item.mimeCategory)}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[200px]">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span>{formatFileSize(item.size)}</span>
                              <span>&bull;</span>
                              <span className={`capitalize font-bold ${
                                item.status === 'done'
                                  ? 'text-emerald-400'
                                  : item.status === 'reading' || item.status === 'analysing'
                                  ? 'text-purple-400 animate-pulse'
                                  : item.status === 'failed'
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                            {item.errorReason && (
                              <p className="text-[10px] text-rose-400 leading-tight truncate">
                                {item.errorReason}
                              </p>
                            )}
                          </div>
                        </div>

                        {!isProcessing && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQueuedFile(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Primary Trigger Button & Live Progress Bar */}
                  <div className="pt-4 space-y-3">
                    {isProcessing ? (
                      <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-950/20 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between text-xs text-purple-200 font-mono">
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 animate-spin text-purple-400" />
                            {progressStage || 'Processing material...'}
                          </span>
                          <span className="font-bold">{progressPercent}%</span>
                        </div>

                        <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleCancelPipeline}
                            className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 text-xs font-semibold border border-rose-500/20"
                          >
                            Cancel Processing
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRunUniversalPipeline}
                        className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-white font-bold text-sm sm:text-base bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:via-purple-500 hover:to-pink-500 shadow-xl shadow-purple-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <Zap className="w-5 h-5 fill-current" />
                        <span>Generate Complete Active Study Kit ({queuedFiles.length} Material{queuedFiles.length > 1 ? 's' : ''})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Sample / Library Footer Links */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-white/10 text-xs">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={isLoadingSample}
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isLoadingSample ? 'Loading Demo...' : 'Try a sample lecture (Offline Demo)'}</span>
                </button>

                <span className="text-slate-600">&bull;</span>

                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(true)}
                  className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold"
                >
                  <Library className="w-4 h-4" />
                  <span>View Previous Study Kits ({allLectures.length})</span>
                </button>
              </div>
            </div>
          </ErrorBoundary>
        ) : (
          /* ACTIVE STUDY ECOSYSTEM WORKSPACE */
          <>
            {/* Partial Success Alert (If any files failed during processing) */}
            {activeLecture.failedFiles && activeLecture.failedFiles.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-2 text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Partial Success: Study kit generated from working files</span>
                  </div>
                  <p className="text-slate-400">
                    {activeLecture.failedFiles.length} file(s) could not be parsed: {activeLecture.failedFiles.map((f) => `"${f.filename}" (${f.reason})`).join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLecture(null)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold border border-amber-500/40 shrink-0"
                >
                  Re-upload Missing Files
                </button>
              </div>
            )}

            {/* Synchronized Media Stream Controller (Audio / Video Player) */}
            <div className="stagger-item">
              <ErrorBoundary sectionName="Media Player">
                <MediaPlayer
                  artifact={activeLecture}
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  isPlaying={isPlaying}
                  onPlayStateChange={setIsPlaying}
                />
              </ErrorBoundary>
            </div>

            {/* Feature Tabs Bar */}
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
                <span>SM-2 Audio Flashcards</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('quizzes')}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'quizzes'
                    ? 'border-amber-500 text-white bg-white/5 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Diagnostic Mastery Quizzes</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('extras')}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'extras'
                    ? 'border-emerald-500 text-white bg-white/5 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Study Extras &amp; Glossary</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('chat')}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'chat'
                    ? 'border-sky-500 text-white bg-white/5 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <MessageSquareCode className="w-4 h-4 text-sky-400" />
                <span>AI Socratic &amp; Feynman Coach</span>
              </button>
            </div>

            {/* Tab Content Display Wrapped in Error Boundaries */}
            <div id="workspace-content" className="stagger-item">
              {activeTab === 'summary' && (
                <ErrorBoundary sectionName="Executive Summary">
                  <LectureSummary
                    artifact={activeLecture}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'graph' && (
                <ErrorBoundary sectionName="Prerequisite Concept Graph">
                  <ConceptGraph
                    artifact={activeLecture}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'flashcards' && (
                <ErrorBoundary sectionName="Spaced-Repetition Flashcards">
                  <FlashcardDeck
                    artifact={activeLecture}
                    onSeek={handleSeek}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'quizzes' && (
                <ErrorBoundary sectionName="Diagnostic Mastery Quizzes">
                  <MisconceptionQuiz
                    artifact={activeLecture}
                    onSeek={handleSeek}
                  />
                </ErrorBoundary>
              )}

              {activeTab === 'extras' && (
                <ErrorBoundary sectionName="Study Kit Extras & Glossary">
                  <StudyKitExtras artifact={activeLecture} />
                </ErrorBoundary>
              )}

              {activeTab === 'chat' && (
                <ErrorBoundary sectionName="AI Socratic & Feynman Coach">
                  <div className="space-y-6">
                    <div className="flex items-center justify-center sm:justify-start gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-white/10 w-fit">
                      <button
                        type="button"
                        onClick={() => setChatSubTab('socratic')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                          chatSubTab === 'socratic'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Compass className="w-4 h-4" />
                        <span>Socratic AI Tutor</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setChatSubTab('feynman')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                          chatSubTab === 'feynman'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Award className="w-4 h-4" />
                        <span>Richard Feynman Voice Coach</span>
                      </button>
                    </div>

                    {chatSubTab === 'socratic' ? (
                      <SocraticChat
                        artifact={activeLecture}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                        apiKey={primaryApiKey}
                      />
                    ) : (
                      <FeynmanCoach
                        artifact={activeLecture}
                        onSeek={handleSeek}
                        apiKey={primaryApiKey}
                      />
                    )}
                  </div>
                </ErrorBoundary>
              )}
            </div>
          </>
        )}
      </main>

      {/* Modals & Dialogs */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <StudyKitsLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectKit={(kit) => {
          setActiveLecture(kit);
          setCurrentTime(0);
          setIsPlaying(false);
        }}
      />

      {activeLecture && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          artifact={activeLecture}
        />
      )}
    </div>
  );
}
