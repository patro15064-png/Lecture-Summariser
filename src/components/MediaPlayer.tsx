'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Clock, 
  FastForward,
  Radio,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  LocateFixed
} from 'lucide-react';
import { LectureArtifact } from '@/types/lecture';
import { formatTime } from '@/lib/transcriptParser';

interface MediaPlayerProps {
  artifact: LectureArtifact;
  currentTime: number;
  onTimeUpdate: (seconds: number) => void;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
}

export function MediaPlayer({
  artifact,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onPlayStateChange,
}: MediaPlayerProps) {
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState<number>(1);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(true);
  const [followAudio, setFollowAudio] = useState(true);
  const [realMediaDuration, setRealMediaDuration] = useState<number | null>(null);

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const segments = artifact.transcript?.segments || [];
  const hasTimestamps = artifact.transcript?.hasTimestamps ?? true;
  const totalSeconds = realMediaDuration || artifact.durationSeconds || (segments.length > 0 ? segments[segments.length - 1].end : 600);

  // Sync real HTMLMediaElement if available
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (isPlaying) {
      media.play().catch(() => {
        // Autoplay may be restricted
      });
    } else {
      media.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (Math.abs(media.currentTime - currentTime) > 0.5) {
      media.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.playbackRate = playbackRate;
    media.muted = isMuted;
    media.volume = volume;
  }, [playbackRate, isMuted, volume]);

  // AI Voice Synthesis for text/transcript lectures without media files
  const speakingSegmentIndexRef = useRef<number>(-1);

  // Fallback timer and Web Speech narration when media file is not attached (transcript-only / text mode)
  useEffect(() => {
    if (artifact.mediaUrl && mediaRef.current) {
      return; // Real media element drives time
    }

    if (isPlaying) {
      // If browser supports SpeechSynthesis, speak the current segment
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && !isMuted) {
        // Find segment index corresponding to currentTime
        const currentSegIdx = segments.findIndex(
          (seg) => currentTime >= seg.start && currentTime <= seg.end
        );
        const targetIdx = currentSegIdx >= 0 ? currentSegIdx : 0;

        if (speakingSegmentIndexRef.current !== targetIdx && segments[targetIdx]) {
          window.speechSynthesis.cancel();
          const segText = segments[targetIdx].text;
          const utterance = new SpeechSynthesisUtterance(segText);
          utterance.rate = Math.max(0.75, Math.min(2, playbackRate));
          utterance.volume = volume;
          speakingSegmentIndexRef.current = targetIdx;

          utterance.onend = () => {
            speakingSegmentIndexRef.current = -1;
          };
          utterance.onerror = () => {
            speakingSegmentIndexRef.current = -1;
          };

          window.speechSynthesis.speak(utterance);
        }
      }

      lastTickRef.current = Date.now();
      const updateLoop = () => {
        const now = Date.now();
        const deltaSec = ((now - lastTickRef.current) / 1000) * playbackRate;
        lastTickRef.current = now;

        const nextTime = Math.min(totalSeconds, currentTime + deltaSec);
        onTimeUpdate(nextTime);

        if (nextTime >= totalSeconds) {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          speakingSegmentIndexRef.current = -1;
          onPlayStateChange(false);
        } else {
          animationFrameRef.current = requestAnimationFrame(updateLoop);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      speakingSegmentIndexRef.current = -1;
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying, currentTime, playbackRate, isMuted, volume, totalSeconds, artifact.mediaUrl, segments, onTimeUpdate, onPlayStateChange]);

  // Handle mute change for speech synthesis
  useEffect(() => {
    if (!artifact.mediaUrl && isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      speakingSegmentIndexRef.current = -1;
    }
  }, [isMuted, artifact.mediaUrl]);

  // Auto-scroll transcript to active segment if followAudio is enabled
  useEffect(() => {
    if (followAudio && activeSegmentRef.current && transcriptListRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentTime, followAudio]);

  const handleMediaTimeUpdate = () => {
    if (mediaRef.current) {
      onTimeUpdate(mediaRef.current.currentTime);
    }
  };

  const handleMediaLoadedMetadata = () => {
    if (mediaRef.current && Number.isFinite(mediaRef.current.duration)) {
      setRealMediaDuration(mediaRef.current.duration);
    }
  };

  const handleMediaEnded = () => {
    onPlayStateChange(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    onTimeUpdate(newSec);
    if (mediaRef.current) {
      mediaRef.current.currentTime = newSec;
    }
  };

  const skipSeconds = (amount: number) => {
    const nextTime = Math.max(0, Math.min(totalSeconds, currentTime + amount));
    onTimeUpdate(nextTime);
    if (mediaRef.current) {
      mediaRef.current.currentTime = nextTime;
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
  };

  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  const progressPercent = Math.min(100, (currentTime / (totalSeconds || 1)) * 100);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-2xl text-slate-100 flex flex-col">
      {/* Top Progress Accent Bar */}
      <div 
        className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-200"
        style={{ width: `${progressPercent}%` }}
      />

      {/* Real HTML5 Media Track (Video or Audio) */}
      {artifact.mediaUrl && (
        <div className="relative bg-black flex items-center justify-center">
          {artifact.mediaType === 'video' ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={artifact.mediaUrl}
              onTimeUpdate={handleMediaTimeUpdate}
              onLoadedMetadata={handleMediaLoadedMetadata}
              onEnded={handleMediaEnded}
              className="w-full max-h-80 object-contain"
              playsInline
            />
          ) : (
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={artifact.mediaUrl}
              onTimeUpdate={handleMediaTimeUpdate}
              onLoadedMetadata={handleMediaLoadedMetadata}
              onEnded={handleMediaEnded}
              className="hidden"
            />
          )}
        </div>
      )}

      {/* Main Controls Header & Scrubber */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Stream Metadata & Clock */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-2.5 w-2.5 relative">
              {isPlaying && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 shrink-0">
              <Radio className="w-3.5 h-3.5" />
              {artifact.mediaUrl ? 'Synchronized Media' : 'AI Voice Narrator (TTS)'}
            </span>
            <span className="text-xs text-slate-300 font-medium truncate border-l border-white/10 pl-2.5">
              {artifact.title}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/90 px-3 py-1 rounded-xl border border-white/5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white font-medium">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {/* Dynamic Simulated Waveform Bars */}
        <div className="flex items-end justify-between gap-1 h-9 px-1">
          {Array.from({ length: 52 }).map((_, i) => {
            const barProgress = (i / 52) * 100;
            const isPassed = barProgress <= progressPercent;
            const baseHeight = 22 + Math.sin(i * 0.35) * 18 + Math.cos(i * 0.7) * 14;
            const dynamicHeight = isPlaying && isPassed ? Math.min(100, baseHeight + (Math.sin(currentTime * 6 + i) * 16)) : baseHeight;

            return (
              <div
                key={i}
                className={`w-full rounded-full transition-all duration-150 ${
                  isPassed
                    ? 'bg-gradient-to-t from-indigo-500 to-purple-400 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-800/70 hover:bg-slate-700/80'
                }`}
                style={{ height: `${Math.max(15, dynamicHeight)}%` }}
              />
            );
          })}
        </div>

        {/* Scrubbing Slider */}
        <div className="relative group">
          <input
            type="range"
            min={0}
            max={totalSeconds || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-purple-400 transition-all"
            aria-label="Lecture progress scrubber"
          />
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Playback Core Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => skipSeconds(-10)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              title="Skip backward 10s"
              aria-label="Skip backward 10 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onPlayStateChange(!isPlaying)}
              className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-105 active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => skipSeconds(10)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              title="Skip forward 10s"
              aria-label="Skip forward 10 seconds"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Active Segment Preview */}
          <div className="hidden md:flex items-center gap-2 max-w-md truncate text-xs text-slate-300 font-mono bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/5">
            <span className="text-indigo-400 font-semibold shrink-0">
              [{formatTime(activeSegment?.start || currentTime)}]
            </span>
            <span className="truncate">
              {activeSegment?.text || 'Listening to lecture stream...'}
            </span>
          </div>

          {/* Right Tools (Speed, Volume, Transcript Toggle) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-white/5 transition-colors"
              title="Change playback speed"
            >
              <FastForward className="w-3.5 h-3.5 text-indigo-400" />
              <span>{playbackRate}x</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (val > 0 && isMuted) setIsMuted(false);
                }}
                className="w-14 h-1 bg-slate-800 rounded appearance-none accent-indigo-500 cursor-pointer hidden sm:inline-block"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                isTranscriptOpen
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Transcript</span>
              {isTranscriptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Transcript Drawer */}
      {isTranscriptOpen && (
        <div className="border-t border-white/10 bg-slate-950/90 p-4 sm:p-5 space-y-3 animate-in fade-in">
          {/* Transcript Drawer Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Interactive Transcript
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ({segments.length} Segments)
              </span>

              {!hasTimestamps && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" /> Uniform Time Grid
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFollowAudio(!followAudio)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                followAudio
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-white/5'
              }`}
              title="Automatically keep current spoken segment in view"
            >
              <LocateFixed className="w-3 h-3" />
              <span>Follow Audio</span>
            </button>
          </div>

          {/* Transcript Scroll Container */}
          <div 
            ref={transcriptListRef}
            className="max-h-56 sm:max-h-64 overflow-y-auto space-y-1.5 pr-2 font-sans text-xs scroll-smooth"
          >
            {segments.map((seg) => {
              const isActive = currentTime >= seg.start && currentTime <= seg.end;

              return (
                <div
                  key={seg.id}
                  ref={isActive ? activeSegmentRef : null}
                  onClick={() => {
                    onTimeUpdate(seg.start);
                    if (mediaRef.current) mediaRef.current.currentTime = seg.start;
                  }}
                  className={`group p-2.5 rounded-xl cursor-pointer transition-all duration-150 flex items-start gap-3 ${
                    isActive
                      ? 'bg-indigo-600/25 border border-indigo-500/40 text-white shadow-md shadow-indigo-500/10'
                      : 'hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span className={`font-mono text-[11px] shrink-0 px-2 py-0.5 rounded-md ${
                    isActive ? 'bg-indigo-500 text-white font-bold' : 'bg-slate-900 text-slate-400 group-hover:text-indigo-300'
                  }`}>
                    {formatTime(seg.start)}
                  </span>
                  <p className="leading-relaxed font-light">
                    {seg.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
