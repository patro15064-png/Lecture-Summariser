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
  Key, 
  Camera, 
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { LectureArtifact, Transcript } from '@/types/lecture';
import { parseTranscriptContent } from '@/lib/transcriptParser';
import { transcribeAudioOrMedia } from '@/lib/transcription';
import { 
  runLectureAnalysisPipeline, 
  PipelineCancellationToken 
} from '@/lib/orchestrator';
import { loadUserApiSettings } from '@/lib/providerSettings';
import { 
  analyzePhotoWithSensing,
  generateSpokenAudioLecture, 
  extractVideoFrames 
} from '@/lib/multimodalAnalyzer';
import { isMeaninglessFilename } from '@/lib/visualSensor';
import { extractAnyLearningMaterial } from '@/lib/documentExtractors';
import { CameraCaptureModal } from './CameraCaptureModal';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLectureCreated: (artifact: LectureArtifact) => void;
  onOpenSettings?: () => void;
}

type IngestMode = 'photo' | 'media' | 'document' | 'paste';

export function UploadModal({ 
  isOpen, 
  onClose, 
  onLectureCreated,
  onOpenSettings 
}: UploadModalProps) {
  const [ingestMode, setIngestMode] = useState<IngestMode>('photo');
  
  // Selected Files
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
    if (!title && !isMeaninglessFilename(file.name)) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
    setErrorMessage(null);
  };

  const handleMediaSelect = (file: File) => {
    setMediaFile(file);
    if (!title && !isMeaninglessFilename(file.name)) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
    setErrorMessage(null);
  };

  const handleDocumentSelect = (file: File) => {
    setDocumentFile(file);
    if (!title && !isMeaninglessFilename(file.name)) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
    setErrorMessage(null);
  };

  const handleTranscriptSelect = (file: File) => {
    setTranscriptFile(file);
    if (!title && !mediaFile && !isMeaninglessFilename(file.name)) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
    setErrorMessage(null);
  };

  const handleGenericDrop = (file: File) => {
    if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif|bmp)$/i.test(file.name)) {
      setIngestMode('photo');
      handleImageSelect(file);
    } else if (file.type.startsWith('video/') || file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|mp4|webm|mov)$/i.test(file.name)) {
      setIngestMode('media');
      handleMediaSelect(file);
    } else if (/\.(vtt|srt|json)$/i.test(file.name)) {
      setIngestMode('media');
      handleTranscriptSelect(file);
    } else {
      setIngestMode('document');
      handleDocumentSelect(file);
    }
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
    setProgressStage('Initializing multimodal pipeline...');

    const cancelToken = new PipelineCancellationToken();
    cancellationTokenRef.current = cancelToken;

    try {
      const settings = loadUserApiSettings();
      let transcript: Transcript;
      let mediaUrl: string | undefined;
      let audioBlob: Blob | undefined;
      let mediaType: 'audio' | 'video' | 'transcript_only' = 'transcript_only';
      let finalTitle = title.trim();

      // -------------------------------------------------------------
      // PATH 1: PHOTO / IMAGE INPUT (HANDWRITING, WHITEBOARDS, NOTES)
      // -------------------------------------------------------------
      if (ingestMode === 'photo' && selectedImage) {
        setProgressStage('Inspecting image pixels & visual content with Visual Sensor...');
        setProgressPercent(15);
        cancelToken.check();

        // 1. Analyze image directly from pixels using visual sensing & multimodal vision (never relies on file name)
        const visionResult = await analyzePhotoWithSensing({
          imageFileOrBlob: selectedImage,
          filename: selectedImage.name,
          settings,
          onProgress: (stage) => {
            cancelToken.check();
            setProgressStage(stage);
          },
        });

        if (!finalTitle || isMeaninglessFilename(finalTitle)) {
          finalTitle = visionResult.title;
        }

        cancelToken.check();
        setProgressPercent(35);
        setProgressStage('Generating spoken pedagogical audio explanation...');

        // 2. Synthesize spoken audio lecture explanation with timestamps
        transcript = await generateSpokenAudioLecture({
          rawContent: visionResult.notes,
          title: finalTitle,
          settings,
          onProgress: (stage) => {
            cancelToken.check();
            setProgressStage(stage);
          },
        });

        // 3. Attach image as visual mediaUrl so MediaPlayer displays the diagram/notes!
        mediaUrl = URL.createObjectURL(selectedImage);
        audioBlob = selectedImage;
        mediaType = 'transcript_only'; // Uses continuous speech synthesis while displaying image
      } 
      // -------------------------------------------------------------
      // PATH 2: AUDIO / VIDEO RECORDING
      // -------------------------------------------------------------
      else if (ingestMode === 'media' && (mediaFile || transcriptFile)) {
        if (mediaFile) {
          mediaUrl = URL.createObjectURL(mediaFile);
          audioBlob = mediaFile;
          mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'audio';
        }

        if (transcriptFile) {
          setProgressStage('Parsing attached transcript file...');
          setProgressPercent(20);
          const text = await transcriptFile.text();
          transcript = parseTranscriptContent(text);
        } else if (mediaFile) {
          const isVideo = mediaFile.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(mediaFile.name);

          // Attempt audio transcription
          setProgressStage('Transcribing audio track with configured provider...');
          const transcriberConfig = settings.useSingleModel
            ? settings.singleProvider
            : settings.assignments.transcriber.provider;
          const transcriberModel = settings.useSingleModel
            ? settings.singleModel
            : settings.assignments.transcriber.model;
          const apiKey = settings.providers[transcriberConfig]?.apiKey || '';

          let transcribedOk = false;
          let candidateTranscript: Transcript = { segments: [], rawText: '', hasTimestamps: false };

          try {
            candidateTranscript = await transcribeAudioOrMedia({
              mediaBlob: mediaFile,
              provider: transcriberConfig,
              apiKey,
              baseUrl: settings.providers[transcriberConfig]?.baseUrl,
              model: transcriberModel,
              onProgress: (stage, pct) => {
                cancelToken.check();
                setProgressStage(stage);
                setProgressPercent(Math.round(pct * 0.35));
              },
            });
            if (candidateTranscript.rawText.trim().length > 20) {
              transcribedOk = true;
            }
          } catch (transcribeErr) {
            console.warn('[Transcription error, checking silent video fallback]:', transcribeErr);
          }

          // If transcription failed or returned empty text on a video (silent video / slide recording)
          if (!transcribedOk && isVideo) {
            setProgressStage('Silent video detected: Extracting visual presentation keyframes...');
            setProgressPercent(25);
            const frames = await extractVideoFrames(mediaFile, 3);

            if (frames.length > 0) {
              setProgressStage('Analyzing video frames with Visual Sensor & Vision...');
              const visionParts: string[] = [];
              for (let i = 0; i < frames.length; i++) {
                cancelToken.check();
                // Convert frame dataURL to blob
                const res = await fetch(frames[i]);
                const frameBlob = await res.blob();
                const visionResult = await analyzePhotoWithSensing({
                  imageFileOrBlob: frameBlob,
                  settings,
                  onProgress: (msg) => setProgressStage(msg),
                });
                if ((!finalTitle || isMeaninglessFilename(finalTitle)) && visionResult.title) {
                  finalTitle = visionResult.title;
                }
                visionParts.push(visionResult.notes);
              }

              const combinedNotes = visionParts.join('\n\n');
              transcript = await generateSpokenAudioLecture({
                rawContent: combinedNotes,
                title: finalTitle || 'Video Visual Presentation Analysis',
                settings,
                onProgress: (msg) => setProgressStage(msg),
              });
            } else {
              transcript = candidateTranscript;
            }
          } else {
            transcript = candidateTranscript;
          }
        } else {
          throw new Error('Please select an audio/video file or transcript.');
        }
      }
      // -------------------------------------------------------------
      // PATH 3: DOCUMENT (PDF, DOCX, PPTX, TXT, MD)
      // -------------------------------------------------------------
      else if (ingestMode === 'document' && documentFile) {
        setProgressStage('Extracting document text, formulas, and slide contents...');
        setProgressPercent(20);

        const extractedDoc = await extractAnyLearningMaterial(
          documentFile,
          documentFile.name,
          (stage: string, pct: number) => {
            cancelToken.check();
            setProgressStage(stage);
            setProgressPercent(Math.round(pct * 0.3));
          }
        );

        if (!extractedDoc.success || !extractedDoc.combinedText.trim()) {
          throw new Error(extractedDoc.errorReason || 'Failed to extract text from document.');
        }

        setProgressStage('Generating spoken pedagogical audio explanation...');
        setProgressPercent(35);

        transcript = await generateSpokenAudioLecture({
          rawContent: extractedDoc.combinedText,
          title: finalTitle,
          settings,
          onProgress: (msg) => {
            cancelToken.check();
            setProgressStage(msg);
          },
        });
        mediaType = 'transcript_only';
      }
      // -------------------------------------------------------------
      // PATH 4: PASTED NOTES / TEXT
      // -------------------------------------------------------------
      else if (ingestMode === 'paste' && pastedText.trim()) {
        const text = pastedText.trim();
        // If user pasted text with timestamps [00:00], parse as transcript directly
        if (/\[\d{1,2}:\d{2}\]/.test(text)) {
          setProgressStage('Parsing timestamped transcript text...');
          transcript = parseTranscriptContent(text);
        } else {
          setProgressStage('Synthesizing spoken pedagogical audio lecture from notes...');
          setProgressPercent(25);
          transcript = await generateSpokenAudioLecture({
            rawContent: text,
            title: finalTitle,
            settings,
            onProgress: (msg) => {
              cancelToken.check();
              setProgressStage(msg);
            },
          });
        }
        mediaType = 'transcript_only';
      } else {
        throw new Error('Please provide learning material to analyze.');
      }

      cancelToken.check();

      if (!finalTitle || isMeaninglessFilename(finalTitle)) {
        finalTitle = 'Visual Learning Synthesis';
      }

      // -------------------------------------------------------------
      // RUN GROUNDED MULTI-AGENT SYNTHESIS PIPELINE
      // -------------------------------------------------------------
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
          // Scale progress bar from 40% to 100%
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
    if (ingestMode === 'photo' && !selectedImage) return true;
    if (ingestMode === 'media' && !mediaFile && !transcriptFile) return true;
    if (ingestMode === 'document' && !documentFile) return true;
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
              Upload Learning Material &amp; Generate Study Pack
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Ingest photos of notes, whiteboards, textbooks, audio/video recordings, documents, or text into grounded concept graphs, spoken audio lectures, flashcards, and quizzes.
            </p>
          </div>

          {/* Mode Switcher */}
          {!isProcessing && (
            <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-slate-950 border border-white/5 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setIngestMode('photo')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all ${
                  ingestMode === 'photo'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Camera className="w-3.5 h-3.5" /> Photo / Camera
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('media')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all ${
                  ingestMode === 'media'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Music className="w-3.5 h-3.5" /> Audio / Video
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('document')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all ${
                  ingestMode === 'document'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" /> PDF / DOCX
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('paste')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all ${
                  ingestMode === 'paste'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Paste Notes
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
                  <h3 className="text-base font-bold text-white">Synthesizing Learning Ecosystem</h3>
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
              {/* Mode 1: Photo / Camera */}
              {ingestMode === 'photo' && (
                <div className="space-y-4">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.gif,.bmp"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                    className="hidden"
                  />

                  {/* Photo Dropzone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleGenericDrop(e.dataTransfer.files[0]);
                    }}
                    onClick={() => imageInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70"
                  >
                    {selectedImage && imagePreviewUrl ? (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreviewUrl}
                            alt="Selected material"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            {isMeaninglessFilename(selectedImage.name) ? 'Visual Material Selected (Sensing Active)' : selectedImage.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {(selectedImage.size / (1024 * 1024)).toFixed(2)} MB • Visual Material Ready for Vision Analysis
                          </p>
                          <p className="text-[11px] text-purple-300 mt-1">
                            Multimodal vision model reads handwriting, formulas, tables, and diagrams.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(null);
                            setImagePreviewUrl(null);
                          }}
                          className="text-xs text-rose-400 hover:underline sm:ml-auto"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Upload Photo of Notes, Blackboard, or Textbook
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Drag &amp; drop or click to browse (JPG, PNG, WEBP, HEIC, diagrams)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera Snap Button */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-200 hover:text-white border border-indigo-500/30 hover:border-indigo-400/60 transition-all shadow-sm"
                    >
                      <Camera className="w-4 h-4 text-indigo-400" />
                      <span>Take Photo with Camera / Webcam</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2: Audio / Video Media File */}
              {ingestMode === 'media' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleGenericDrop(e.dataTransfer.files[0]);
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
                          Supports MP3, WAV, M4A, MP4, WebM (with or without audio)
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

              {/* Mode 3: Document (PDF, DOCX, PPTX, TXT) */}
              {ingestMode === 'document' && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleGenericDrop(e.dataTransfer.files[0]);
                  }}
                  onClick={() => documentInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70"
                >
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt,.md,.rtf,.epub"
                    onChange={(e) => e.target.files?.[0] && handleDocumentSelect(e.target.files[0])}
                    className="hidden"
                  />

                  {documentFile ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
                        <FileCode className="w-8 h-8" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">{documentFile.name}</p>
                        <p className="text-xs text-slate-400">
                          {(documentFile.size / 1024).toFixed(1)} KB • Document
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocumentFile(null);
                        }}
                        className="text-xs text-rose-400 hover:underline ml-2"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-white">
                        Upload PDF, DOCX, PPTX, or Markdown Document
                      </p>
                      <p className="text-xs text-slate-400">
                        Automatically extracts text, slide titles, notes, and generates spoken audio lecture
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 4: Paste Notes / Raw Text */}
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
                    placeholder="Paste lecture transcript with timestamps [00:00] or comprehensive raw notes..."
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
                      placeholder="Auto-detected from visual/audio content (or custom title)"
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

      {/* Interactive Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(capturedFile) => {
          handleImageSelect(capturedFile);
        }}
      />
    </div>
  );
}
