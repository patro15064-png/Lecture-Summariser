'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  LocateFixed,
  Volume1
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
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Synchronized refs so speech synthesis callbacks and loops have current state without triggering re-subscriptions
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const currentSpeakingIdxRef = useRef<number>(-1);

  // Effective transcript segments with fallback for raw explanation text
  const segments = artifact.transcript?.segments || [];
  const effectiveSegments = useMemo(() => {
    if (segments.length > 0) return segments;
    const fallbackText = (artifact.overview || artifact.title || 'Lecture explanation').trim();
    return [
      {
        id: 'seg-fallback-1',
        start: 0,
        end: Math.max(15, Math.round(fallbackText.split(/\s+/).length / 2.5)),
        text: fallbackText,
      },
    ];
  }, [segments, artifact.overview, artifact.title]);

  const hasTimestamps = artifact.transcript?.hasTimestamps ?? true;
  const totalSeconds =
    realMediaDuration ||
    artifact.durationSeconds ||
    (effectiveSegments.length > 0 ? effectiveSegments[effectiveSegments.length - 1].end : 600);

  // Sync real HTMLMediaElement if media URL is attached (video or audio file)
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

  // Stop Web Speech Synthesis safely
  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    currentSpeakingIdxRef.current = -1;
    setIsSpeakingNow(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Speak a specific segment by index with full audio output and smooth progress tracking
  const speakSegmentIndex = useCallback(
    (idx: number) => {
      if (artifact.mediaUrl || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }

      if (idx < 0 || idx >= effectiveSegments.length) {
        stopSpeech();
        onPlayStateChange(false);
        onTimeUpdate(totalSeconds);
        return;
      }

      if (isMutedRef.current) {
        return;
      }

      // Cancel previous utterance
      window.speechSynthesis.cancel();

      const seg = effectiveSegments[idx];
      const utterance = new SpeechSynthesisUtterance(seg.text);
      utterance.lang = 'en-US';
      utterance.rate = Math.max(0.75, Math.min(2, playbackRateRef.current));
      utterance.volume = isMutedRef.current ? 0 : Math.max(0.1, volumeRef.current);
      utterance.pitch = 1.0;

      // Select natural English voice if available in browser
      try {
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') ||
                v.name.includes('Google') ||
                v.name.includes('David') ||
                v.name.includes('Samantha') ||
                v.name.includes('Zira') ||
                v.name.includes('Jenny') ||
                v.name.includes('Guy'))
          ) || voices.find((v) => v.lang.startsWith('en'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      } catch {}

      currentSpeakingIdxRef.current = idx;

      utterance.onstart = () => {
        setIsSpeakingNow(true);
        onTimeUpdate(seg.start);

        // Animate scrubber progress continuously during this segment's speech
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        const startTime = seg.start;
        const startWallClock = Date.now();

        const loop = () => {
          if (!isPlayingRef.current || currentSpeakingIdxRef.current !== idx) return;
          const elapsedSec = ((Date.now() - startWallClock) / 1000) * playbackRateRef.current;
          const nextT = Math.min(seg.end, startTime + elapsedSec);
          onTimeUpdate(nextT);
          if (nextT < seg.end) {
            animationFrameRef.current = requestAnimationFrame(loop);
          }
        };
        animationFrameRef.current = requestAnimationFrame(loop);
      };

      utterance.onend = () => {
        setIsSpeakingNow(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // If still in playing state, advance seamlessly to next segment
        if (isPlayingRef.current) {
          if (idx + 1 < effectiveSegments.length) {
            speakSegmentIndex(idx + 1);
          } else {
            currentSpeakingIdxRef.current = -1;
            onPlayStateChange(false);
            onTimeUpdate(totalSeconds);
          }
        }
      };

      utterance.onerror = (event) => {
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          setIsSpeakingNow(false);
          if (isPlayingRef.current && idx + 1 < effectiveSegments.length) {
            speakSegmentIndex(idx + 1);
          }
        }
      };

      window.speechSynthesis.speak(utterance);
      // Nudge browser in case speech was paused internally
      window.speechSynthesis.resume();
    },
    [artifact.mediaUrl, effectiveSegments, totalSeconds, onPlayStateChange, onTimeUpdate, stopSpeech]
  );

  // Speak starting from a specific second timestamp
  const speakFromTime = useCallback(
    (timeSec: number) => {
      let targetIdx = effectiveSegments.findIndex(
        (seg) => timeSec >= seg.start && timeSec < seg.end
      );
      if (targetIdx === -1) {
        targetIdx = effectiveSegments.findIndex((seg) => seg.end > timeSec);
        if (targetIdx === -1) targetIdx = 0;
      }
      speakSegmentIndex(targetIdx);
    },
    [effectiveSegments, speakSegmentIndex]
  );

  // React to isPlaying changes without re-triggering speech when time advances
  useEffect(() => {
    if (artifact.mediaUrl) return; // Real media tag controls sound

    if (isPlaying) {
      speakFromTime(currentTimeRef.current);
    } else {
      stopSpeech();
    }
  }, [isPlaying, artifact.mediaUrl, speakFromTime, stopSpeech]);

  // Handle mute changes
  useEffect(() => {
    if (artifact.mediaUrl) return;
    if (isMuted) {
      stopSpeech();
    } else if (isPlaying) {
      speakFromTime(currentTimeRef.current);
    }
  }, [isMuted, isPlaying, artifact.mediaUrl, speakFromTime, stopSpeech]);

  // Keep-alive workaround for Chromium speech pause bug on long sentences
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const interval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

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
    } else if (isPlaying) {
      speakFromTime(newSec);
    }
  };

  const skipSeconds = (amount: number) => {
    const nextTime = Math.max(0, Math.min(totalSeconds, currentTime + amount));
    onTimeUpdate(nextTime);
    if (mediaRef.current) {
      mediaRef.current.currentTime = nextTime;
    } else if (isPlaying) {
      speakFromTime(nextTime);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (!artifact.mediaUrl && isPlaying && currentSpeakingIdxRef.current >= 0) {
      speakSegmentIndex(currentSpeakingIdxRef.current);
    }
  };

  const handleTogglePlay = () => {
    const nextPlay = !isPlaying;
    onPlayStateChange(nextPlay);
    // User click gesture directly triggers synthesis to bypass any browser autoplay restrictions
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    if (!artifact.mediaUrl) {
      if (nextPlay) {
        speakFromTime(currentTime);
      } else {
        stopSpeech();
      }
    }
  };

  const activeSegment = effectiveSegments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  ) || effectiveSegments[0];

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
              {artifact.mediaUrl ? (
                <>
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Synchronized Media</span>
                </>
              ) : (
                <>
                  {isSpeakingNow ? (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  ) : (
                    <Volume1 className="w-3.5 h-3.5 text-purple-400" />
                  )}
                  <span className={isSpeakingNow ? 'text-emerald-400 font-bold' : ''}>
                    {isSpeakingNow ? 'AI Speaking Out Loud' : isPlaying ? 'AI Voice Active' : 'AI Voice Narrator'}
                  </span>
                </>
              )}
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
              onClick={handleTogglePlay}
              className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-105 active:scale-95"
              title={isPlaying ? 'Pause' : 'Play & Read Out Loud'}
              aria-label={isPlaying ? 'Pause playback' : 'Play and read aloud'}
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
            {effectiveSegments.map((seg, idx) => {
              const isActive = currentTime >= seg.start && currentTime <= seg.end;
              const isCurrentlyBeingSpoken = isSpeakingNow && currentSpeakingIdxRef.current === idx;

              return (
                <div
                  key={seg.id}
                  ref={isActive ? activeSegmentRef : null}
                  onClick={() => {
                    onTimeUpdate(seg.start);
                    if (mediaRef.current) {
                      mediaRef.current.currentTime = seg.start;
                    } else if (isPlaying) {
                      speakSegmentIndex(idx);
                    }
                  }}
                  className={`group p-2.5 rounded-xl cursor-pointer transition-all duration-150 flex items-start justify-between gap-3 ${
                    isActive
                      ? 'bg-indigo-600/25 border border-indigo-500/40 text-white shadow-md shadow-indigo-500/10'
                      : 'hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`font-mono text-[11px] shrink-0 px-2 py-0.5 rounded-md ${
                      isActive ? 'bg-indigo-500 text-white font-bold' : 'bg-slate-900 text-slate-400 group-hover:text-indigo-300'
                    }`}>
                      {formatTime(seg.start)}
                    </span>
                    <p className="leading-relaxed font-light">
                      {seg.text}
                    </p>
                  </div>

                  {!artifact.mediaUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTimeUpdate(seg.start);
                        if (!isPlaying) onPlayStateChange(true);
                        speakSegmentIndex(idx);
                      }}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                        isCurrentlyBeingSpoken
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                          : 'opacity-0 group-hover:opacity-100 hover:bg-white/10 text-slate-400 hover:text-white'
                      }`}
                      title="Read this sentence aloud"
                      aria-label={`Read aloud: ${seg.text.slice(0, 30)}`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
