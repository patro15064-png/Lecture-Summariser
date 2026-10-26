'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  X, 
  FileVideo, 
  FileAudio, 
  Sparkles, 
  AlertCircle,
  FileCode,
  Music,
  Calendar,
  User,
  GraduationCap,
  StopCircle,
  Key
} from 'lucide-react';
import { LectureArtifact, Transcript } from '@/types/lecture';
import { parseTranscriptContent } from '@/lib/transcriptParser';
import { transcribeAudioOrMedia } from '@/lib/transcription';
import { 
  runLectureAnalysisPipeline, 
  PipelineCancellationToken 
} from '@/lib/orchestrator';
import { loadUserApiSettings } from '@/lib/providerSettings';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLectureCreated: (artifact: LectureArtifact) => void;
  onOpenSettings?: () => void;
}

type IngestMode = 'media' | 'transcript' | 'paste';

export function UploadModal({ 
  isOpen, 
  onClose, 
  onLectureCreated,
  onOpenSettings 
}: UploadModalProps) {
  const [ingestMode, setIngestMode] = useState<IngestMode>('media');
  
  // Media & Transcript Files
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  
  // Metadata Fields
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [lecturer, setLecturer] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Execution & Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [activeAgent, setActiveAgent] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancellationTokenRef = useRef<PipelineCancellationToken | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleMediaSelect = (file: File) => {
    setMediaFile(file);
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
    setErrorMessage(null);
  };

  const handleTranscriptSelect = (file: File) => {
    setTranscriptFile(file);
    if (!title && !mediaFile) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
    setErrorMessage(null);
  };

  const handleCancel = () => {
    if (cancellationTokenRef.current) {
      cancellationTokenRef.current.cancel();
      setIsProcessing(false);
      setProgressStage('Processing cancelled.');
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(5);
    setProgressStage('Initializing analysis pipeline...');

    const cancelToken = new PipelineCancellationToken();
    cancellationTokenRef.current = cancelToken;

    try {
      const settings = loadUserApiSettings();
      let transcript: Transcript;
      let mediaUrl: string | undefined;
      let audioBlob: Blob | undefined;
      let mediaType: 'audio' | 'video' | 'transcript_only' = 'transcript_only';

      // 1. Prepare Media URL if file was provided
      if (mediaFile) {
        mediaUrl = URL.createObjectURL(mediaFile);
        audioBlob = mediaFile;
        mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'audio';
      }

      // 2. Obtain Transcript (either from file, paste, or audio transcription)
      if (transcriptFile) {
        setProgressStage('Parsing uploaded transcript file...');
        setProgressPercent(15);
        const text = await transcriptFile.text();
        transcript = parseTranscriptContent(text);
      } else if (ingestMode === 'paste' && pastedText.trim()) {
        setProgressStage('Parsing pasted lecture text...');
        setProgressPercent(15);
        transcript = parseTranscriptContent(pastedText.trim());
      } else if (mediaFile) {
        // Need to transcribe audio track
        setProgressStage('Transcribing audio with configured provider...');
        const transcriberConfig = settings.useSingleModel
          ? settings.singleProvider
          : settings.assignments.transcriber.provider;
        const transcriberModel = settings.useSingleModel
          ? settings.singleModel
          : settings.assignments.transcriber.model;
        const apiKey = settings.providers[transcriberConfig]?.apiKey || '';

        if (!apiKey && transcriberConfig !== 'local') {
          throw new Error(
            `No API key configured for ${transcriberConfig.toUpperCase()}. Click Key Vault / Provider Settings to add your key.`
          );
        }

        transcript = await transcribeAudioOrMedia({
          mediaBlob: mediaFile,
          provider: transcriberConfig,
          apiKey,
          baseUrl: settings.providers[transcriberConfig]?.baseUrl,
          model: transcriberModel,
          onProgress: (stage, pct) => {
            cancelToken.check();
            setProgressStage(stage);
            setProgressPercent(Math.round(pct * 0.4)); // First 40% of pipeline
          },
        });
      } else {
        throw new Error('Please upload a media file, transcript file, or paste lecture text.');
      }

      cancelToken.check();

      // 3. Run Multi-Agent Grounded Analysis Pipeline
      const finalTitle = title.trim() || mediaFile?.name || transcriptFile?.name || 'Lecture Synthesis';
      const lectureId = `lec-${Date.now()}`;

      const artifact = await runLectureAnalysisPipeline({
        lectureId,
        metadata: {
          title: finalTitle,
          course: course.trim() || undefined,
          lecturer: lecturer.trim() || undefined,
          date: date || undefined,
        },
        transcript,
        mediaUrl,
        mediaType,
        audioBlob,
        settings,
        onProgress: (stage, pct, agent) => {
          cancelToken.check();
          setProgressStage(stage);
          // Scale from 40% to 100%
          setProgressPercent(40 + Math.round(pct * 0.6));
          setActiveAgent(agent);
        },
        cancellationToken: cancelToken,
      });

      setIsProcessing(false);
      onLectureCreated(artifact);
      onClose();
    } catch (err: unknown) {
      setIsProcessing(false);
      setErrorMessage(err instanceof Error ? err.message : 'Pipeline execution failed.');
    }
  };

  const isSubmitDisabled = () => {
    if (isProcessing) return true;
    if (ingestMode === 'media' && !mediaFile && !transcriptFile) return true;
    if (ingestMode === 'transcript' && !transcriptFile) return true;
    if (ingestMode === 'paste' && !pastedText.trim()) return true;
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl overflow-hidden border border-white/10 rounded-3xl bg-slate-900/95 shadow-2xl text-slate-100 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        {/* Glow Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors disabled:opacity-40"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
          {/* Header */}
          <div>
            <h2 id="upload-title" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-indigo-400" />
              Upload Lecture &amp; Generate Study Pack
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Ingest raw audio/video recordings or transcripts into grounded DAG concept graphs, flashcards, and quizzes.
            </p>
          </div>

          {/* Mode Switcher */}
          {!isProcessing && (
            <div className="flex p-1 bg-slate-950 border border-white/5 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setIngestMode('media')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
                  ingestMode === 'media'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Music className="w-3.5 h-3.5" /> Media + Transcript
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('transcript')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
                  ingestMode === 'transcript'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" /> Transcript File (.vtt/.srt)
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition-all ${
                  ingestMode === 'paste'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Paste Notes / Text
              </button>
            </div>
          )}

          {/* Processing State with Live Bar & Cancel */}
          {isProcessing ? (
            <div className="p-8 rounded-2xl bg-slate-950/80 border border-indigo-500/30 text-center space-y-6 animate-in fade-in">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-purple-400 absolute" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <h3 className="text-base font-bold text-white">Synthesizing Lecture Ecosystem</h3>
                  {activeAgent && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Agent: {activeAgent}
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-300 font-mono transition-all animate-pulse">
                  {progressStage}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>{progressPercent}% Complete</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" /> Cancel Pipeline
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Mode 1: Media File + Optional Transcript File */}
              {ingestMode === 'media' && (
                <div className="space-y-4">
                  {/* Media Dropzone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleMediaSelect(e.dataTransfer.files[0]);
                    }}
                    onClick={() => mediaInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70"
                  >
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.mp4,.webm,.mov"
                      onChange={(e) => e.target.files?.[0] && handleMediaSelect(e.target.files[0])}
                      className="hidden"
                    />

                    {mediaFile ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400">
                          {mediaFile.type.startsWith('video/') ? (
                            <FileVideo className="w-8 h-8" />
                          ) : (
                            <FileAudio className="w-8 h-8" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">{mediaFile.name}</p>
                          <p className="text-xs text-slate-400">
                            {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB • {mediaFile.type || 'Media Audio/Video'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMediaFile(null);
                          }}
                          className="text-xs text-rose-400 hover:underline ml-2"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-white">
                          Select Lecture Audio or Video File
                        </p>
                        <p className="text-xs text-slate-400">
                          Supported: .mp3, .wav, .m4a, .mp4, .webm (Max 250MB)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Optional Attached Transcript File */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/50 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <FileCode className="w-4 h-4 text-purple-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">
                          {transcriptFile ? transcriptFile.name : 'Attach Aligned Transcript (.vtt, .srt, .json)'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Optional: skips audio transcription step and guarantees 100% verified accuracy
                        </span>
                      </div>
                    </div>

                    <input
                      ref={transcriptInputRef}
                      type="file"
                      accept=".vtt,.srt,.json,.txt"
                      onChange={(e) => e.target.files?.[0] && handleTranscriptSelect(e.target.files[0])}
                      className="hidden"
                    />

                    {transcriptFile ? (
                      <button
                        type="button"
                        onClick={() => setTranscriptFile(null)}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => transcriptInputRef.current?.click()}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-white/10"
                      >
                        Attach
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mode 2: Transcript File Only */}
              {ingestMode === 'transcript' && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleTranscriptSelect(e.dataTransfer.files[0]);
                  }}
                  onClick={() => transcriptInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70"
                >
                  <input
                    ref={transcriptInputRef}
                    type="file"
                    accept=".vtt,.srt,.json,.txt"
                    onChange={(e) => e.target.files?.[0] && handleTranscriptSelect(e.target.files[0])}
                    className="hidden"
                  />

                  {transcriptFile ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
                        <FileCode className="w-8 h-8" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">{transcriptFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {(transcriptFile.size / 1024).toFixed(1)} KB • Text Transcript
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTranscriptFile(null);
                        }}
                        className="text-xs text-rose-400 hover:underline ml-2"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                        <FileCode className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-white">
                        Upload WebVTT, SubRip (.srt), or JSON Transcript
                      </p>
                      <p className="text-xs text-slate-400">
                        Supports timestamps from Zoom, YouTube, Panopto, or Whisper exports
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 3: Paste Notes / Raw Text */}
              {ingestMode === 'paste' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Paste Transcript or Lecture Text</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {pastedText.length} characters
                    </span>
                  </label>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste lecture transcript with timestamps [00:00] or comprehensive notes..."
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Editable Metadata Fields */}
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Lecture Metadata (Optional)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <FileText className="w-3 h-3 text-indigo-400" /> Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Multivariable Calculus: Gradient Vectors"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <GraduationCap className="w-3 h-3 text-purple-400" /> Course Code
                    </label>
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. MIT 18.02"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <User className="w-3 h-3 text-pink-400" /> Lecturer / Speaker
                    </label>
                    <input
                      type="text"
                      value={lecturer}
                      onChange={(e) => setLecturer(e.target.value)}
                      placeholder="e.g. Prof. Denis Auroux"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-emerald-400" /> Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold block">Processing Error</span>
                    <span>{errorMessage}</span>
                    {errorMessage.includes('API key') && onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="flex items-center gap-1 text-xs text-indigo-300 underline mt-1"
                      >
                        <Key className="w-3 h-3" /> Open Provider Settings to configure key
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          {!isProcessing && (
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProcess}
                disabled={isSubmitDisabled()}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:via-purple-500 hover:to-pink-500 rounded-xl shadow-lg shadow-purple-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start Learning Analysis</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
