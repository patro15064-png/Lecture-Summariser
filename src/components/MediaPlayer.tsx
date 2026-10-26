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
  Radio
} from 'lucide-react';
import { LectureArtifact } from '@/types/lecture';

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
  const totalSeconds = artifact.durationSeconds || 1500;

  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Simulated audio playback loop when using demo or synthetic waveform
  useEffect(() => {
    if (isPlaying) {
      lastTickRef.current = Date.now();
      const updateLoop = () => {
        const now = Date.now();
        const deltaSec = ((now - lastTickRef.current) / 1000) * playbackRate;
        lastTickRef.current = now;

        onTimeUpdate(Math.min(totalSeconds, currentTime + deltaSec));

        if (currentTime >= totalSeconds) {
          onPlayStateChange(false);
        } else {
          animationFrameRef.current = requestAnimationFrame(updateLoop);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, playbackRate, totalSeconds, onTimeUpdate, onPlayStateChange]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    onTimeUpdate(newSec);
  };

  const skipSeconds = (amount: number) => {
    const nextTime = Math.max(0, Math.min(totalSeconds, currentTime + amount));
    onTimeUpdate(nextTime);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
  };

  const progressPercent = Math.min(100, (currentTime / totalSeconds) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-4 sm:p-5 shadow-xl text-slate-100">
      {/* Top subtle glow bar */}
      <div 
        className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
        style={{ width: `${progressPercent}%` }}
      />

      <div className="flex flex-col gap-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-2.5 w-2.5 relative">
              {isPlaying && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 shrink-0">
              <Radio className="w-3.5 h-3.5" /> Synced Media Stream
            </span>
            <span className="text-xs text-slate-400 truncate border-l border-white/10 pl-2.5">
              {artifact.title}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/90 px-3 py-1 rounded-lg border border-white/5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white font-medium">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {/* Dynamic Simulated Waveform Bars */}
        <div className="flex items-end justify-between gap-1 h-9 px-1">
          {Array.from({ length: 48 }).map((_, i) => {
            const barProgress = (i / 48) * 100;
            const isPassed = barProgress <= progressPercent;
            // Harmonic wave height pattern
            const baseHeight = 25 + Math.sin(i * 0.4) * 20 + Math.cos(i * 0.7) * 15;
            const dynamicHeight = isPlaying && isPassed ? Math.min(100, baseHeight + (Math.sin(currentTime * 5 + i) * 15)) : baseHeight;

            return (
              <div
                key={i}
                className={`w-full rounded-full transition-all duration-150 ${
                  isPassed
                    ? 'bg-gradient-to-t from-indigo-500 to-purple-400 shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-800/80 hover:bg-slate-700/80'
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
            max={totalSeconds}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-purple-400 transition-all"
            aria-label="Lecture progress scrubber"
          />
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Left Controls */}
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

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-white/5 transition-colors"
              title="Change playback speed"
            >
              <FastForward className="w-3 h-3 text-indigo-400" />
              <span>{playbackRate}x</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
