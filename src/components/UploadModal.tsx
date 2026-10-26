'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Link as LinkIcon, 
  FileText, 
  X, 
  FileVideo, 
  FileAudio, 
  File, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { LectureArtifact } from '@/types/lecture';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLectureCreated: (artifact: LectureArtifact) => void;
  apiKey?: string;
}

type TabType = 'file' | 'link' | 'text';

const PROCESSING_STEPS = [
  'Ingesting stream & validating multimodal bounds...',
  'Extracting non-linear prerequisite dependencies...',
  'Synthesizing interactive Mermaid graph & 3D flashcards...',
  'Formulating misconception diagnostic traps & golden audio timestamps...',
  'Finalizing active-learning study ecosystem...',
];

export function UploadModal({ isOpen, onClose, onLectureCreated, apiKey }: UploadModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [courseContext, setCourseContext] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip out the data url prefix: "data:audio/mp3;base64,"
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Data);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setStepIndex(0);

    // Step cycle animation timer
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);

    try {
      const payload: {
        text?: string;
        base64Data?: string;
        mimeType?: string;
      } = {};

      if (activeTab === 'file' && selectedFile) {
        if (selectedFile.type.startsWith('text/') || selectedFile.name.endsWith('.md') || selectedFile.name.endsWith('.txt')) {
          const text = await selectedFile.text();
          payload.text = `Lecture Document (${selectedFile.name}):\n\n${text}`;
        } else {
          const base64 = await readFileAsBase64(selectedFile);
          payload.base64Data = base64;
          payload.mimeType = selectedFile.type || 'application/octet-stream';
          if (courseContext) {
            payload.text = `Course context / notes: ${courseContext}`;
          }
        }
      } else if (activeTab === 'link') {
        if (!externalUrl.trim()) {
          throw new Error('Please enter a valid lecture URL or media link.');
        }
        payload.text = `External Lecture Reference: ${externalUrl.trim()}\nTitle: ${urlTitle || 'University Lecture'}\nContext Notes: ${courseContext || 'N/A'}`;
      } else if (activeTab === 'text') {
        if (!pastedText.trim()) {
          throw new Error('Please paste your lecture notes or transcript.');
        }
        payload.text = courseContext ? `Course Context: ${courseContext}\n\n${pastedText}` : pastedText;
      }

      // Send to self-healing process API
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-gemini-key'] = apiKey;
      }

      const res = await fetch('/api/process-lecture', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.artifact) {
        throw new Error(data.error || 'Failed to process lecture artifact.');
      }

      clearInterval(interval);
      setIsProcessing(false);
      onLectureCreated(data.artifact);
      onClose();
    } catch (err: unknown) {
      clearInterval(interval);
      setIsProcessing(false);
      setErrorMessage(err instanceof Error ? err.message : 'Unexpected processing failure.');
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) return <FileVideo className="w-8 h-8 text-indigo-400" />;
    if (file.type.startsWith('audio/')) return <FileAudio className="w-8 h-8 text-purple-400" />;
    return <FileText className="w-8 h-8 text-pink-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl overflow-hidden border border-white/10 rounded-2xl bg-slate-950/95 shadow-2xl shadow-purple-500/10 text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        {/* Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 disabled:opacity-50"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div>
            <h2 id="upload-title" className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-indigo-400" />
              Upload &amp; Generate Learning Ecosystem
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Ingest raw audio/video files, slides, transcripts, or external web links into an active-recall study pack.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex p-1 bg-slate-900 border border-white/5 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              disabled={isProcessing}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'file'
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <File className="w-4 h-4" /> Media / Document File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              disabled={isProcessing}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'link'
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LinkIcon className="w-4 h-4" /> External Link / URL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              disabled={isProcessing}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'text'
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" /> Raw Notes / Text
            </button>
          </div>

          {/* Processing Staged Progress Overlay */}
          {isProcessing ? (
            <div className="p-8 rounded-2xl bg-slate-900/80 border border-indigo-500/20 text-center space-y-6 animate-in fade-in">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-purple-400 absolute" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-semibold text-white">Synthesizing Lecture Artifact</h3>
                <p className="text-xs text-indigo-300 font-mono transition-all animate-pulse">
                  {PROCESSING_STEPS[stepIndex]}
                </p>
              </div>

              {/* Step indicator bar */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-500 ease-out"
                  style={{ width: `${((stepIndex + 1) / PROCESSING_STEPS.length) * 100}%` }}
                />
              </div>

              <p className="text-xs text-slate-500">
                Self-healing schema guard active with zero data persistence.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab 1: File Upload */}
              {activeTab === 'file' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/70 group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,video/*,.mp3,.mp4,.wav,.webm,.pdf,.txt,.md"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                          {getFileIcon(selectedFile)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Custom Media'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-xs text-rose-400 hover:underline mt-1"
                        >
                          Change file
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                          <UploadCloud className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            Drag &amp; drop lecture recording or click to browse
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Supported: <span className="text-slate-300">.mp4, .mp3, .wav, .webm, .pdf, .txt</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                      Optional Course / Subject Context
                    </label>
                    <input
                      type="text"
                      value={courseContext}
                      onChange={(e) => setCourseContext(e.target.value)}
                      placeholder="e.g. CS 61A: Structure and Interpretation of Computer Programs"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: External Link */}
              {activeTab === 'link' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                      Lecture URL or Media Link
                    </label>
                    <input
                      type="url"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or direct .mp3/.mp4 stream link"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                        Lecture Title (Optional)
                      </label>
                      <input
                        type="text"
                        value={urlTitle}
                        onChange={(e) => setUrlTitle(e.target.value)}
                        placeholder="e.g. Quantum Computing: Shor's Algorithm"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                        Course Code / Professor
                      </label>
                      <input
                        type="text"
                        value={courseContext}
                        onChange={(e) => setCourseContext(e.target.value)}
                        placeholder="e.g. PHYS 401 — Prof. Preskill"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Text Paste */}
              {activeTab === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                      Lecture Transcript or Detailed Professor Notes
                    </label>
                    <textarea
                      rows={7}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste verbatim transcript, slide notes, or textbook chapters here..."
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                      Course Header Context
                    </label>
                    <input
                      type="text"
                      value={courseContext}
                      onChange={(e) => setCourseContext(e.target.value)}
                      placeholder="e.g. BIO 101: Cellular Respiration & ATP Synthase"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          {!isProcessing && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400">
                {apiKey ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Client Gemini API Key Active
                  </span>
                ) : (
                  <span className="text-amber-400">
                    No key provided — will self-heal to university reference dataset
                  </span>
                )}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={
                    (activeTab === 'file' && !selectedFile) ||
                    (activeTab === 'link' && !externalUrl.trim()) ||
                    (activeTab === 'text' && !pastedText.trim())
                  }
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:via-purple-500 hover:to-pink-500 rounded-xl shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate Learning Artifact
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
