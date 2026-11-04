'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Camera, 
  RotateCw, 
  Check, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureModal({ isOpen, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Stop all active tracks to turn off camera hardware light
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera when modal opens; stop when closed
  useEffect(() => {
    let isMounted = true;

    if (isOpen && !capturedDataUrl) {
      // Async camera initialization without calling synchronous setState in effect
      (async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          if (isMounted) setCameraError('Camera access is not supported by your browser.');
          return;
        }

        try {
          const constraints: MediaStreamConstraints = {
            audio: false,
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(() => {});
              if (isMounted) setIsLoadingCamera(false);
            };
          }
        } catch (err: unknown) {
          if (!isMounted) return;
          setIsLoadingCamera(false);
          const error = err as { name?: string; message?: string };
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            setCameraError(
              'Camera access was blocked by your browser. Please click the lock or camera icon in your address bar to allow camera access.'
            );
          } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            setCameraError('No camera device was detected on your computer or phone.');
          } else {
            setCameraError(
              error.message || 'Could not start camera stream. Please check browser permissions.'
            );
          }
        }
      })();
    } else if (!isOpen) {
      stopStream();
    }

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isOpen, capturedDataUrl, facingMode, retryCount, stopStream]);

  // Capture current video frame onto canvas
  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Trigger visual shutter flash
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);
    stopStream();
  };

  // Retake photo: discard current snapshot and re-engage camera
  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  // Accept photo: convert canvas/dataURL to File and dispatch
  const handleConfirmPhoto = async () => {
    if (!capturedDataUrl) return;

    try {
      const res = await fetch(capturedDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `camera-notes-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopStream();
      onCapture(file);
      onClose();
    } catch (err) {
      console.error('[Camera confirm error]:', err);
      onClose();
    }
  };

  // Flip front/back camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-slate-900 shadow-2xl flex flex-col max-h-[92vh] text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-modal-title"
      >
        {/* Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-10" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-b border-white/10 z-10 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Camera className="w-4 h-4" />
            </div>
            <h3 id="camera-modal-title" className="text-sm sm:text-base font-bold text-white">
              {capturedDataUrl ? 'Review Captured Photo' : 'Capture Learning Material / Notes'}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Viewport */}
        <div className="relative flex-1 min-h-[320px] sm:min-h-[420px] bg-black flex items-center justify-center overflow-hidden">
          {/* Shutter Flash Animation */}
          {flashEffect && <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200" />}

          {/* Camera Error State */}
          {cameraError ? (
            <div className="p-8 text-center max-w-md space-y-4 animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-white">Camera Permission Needed</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-light">{cameraError}</p>
              </div>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera Access</span>
              </button>
            </div>
          ) : capturedDataUrl ? (
            /* Review Captured Photo Screen */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedDataUrl}
                alt="Captured notes or scene"
                className="w-full h-full max-h-[500px] object-contain"
              />
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 text-[11px] text-emerald-300 font-mono flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400" /> Photo Ready for Analysis
              </div>
            </div>
          ) : (
            /* Live Camera Stream View */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full max-h-[500px] object-cover"
              />

              {/* Viewfinder Target Guide Overlay */}
              <div className="absolute inset-8 sm:inset-12 pointer-events-none border-2 border-dashed border-indigo-400/40 rounded-3xl flex flex-col justify-between p-4">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-indigo-400" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-indigo-400" />
                </div>
                <div className="text-center">
                  <span className="px-3 py-1 rounded-full bg-slate-950/70 border border-white/10 text-[11px] text-indigo-300 font-mono backdrop-blur-md">
                    Align notes, diagram, or scene inside frame
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-indigo-400" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-indigo-400" />
                </div>
              </div>

              {/* Loading Spinner */}
              {isLoadingCamera && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                  <span className="text-xs text-indigo-300 font-mono">Initializing camera feed...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-900/90 flex items-center justify-between gap-3">
          {capturedDataUrl ? (
            /* Controls for Reviewing Photo */
            <div className="w-full flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-white/10"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <span>Retake Photo</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-[1.02]"
              >
                <Check className="w-4 h-4" />
                <span>Use This Photo</span>
              </button>
            </div>
          ) : (
            /* Controls for Live Viewfinder */
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all"
                title="Switch between front and rear cameras"
              >
                <RotateCw className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Flip Camera</span>
              </button>

              {/* Central Shutter Button */}
              <button
                type="button"
                onClick={handleShutter}
                disabled={Boolean(cameraError) || isLoadingCamera}
                className="relative group p-1 rounded-full border-2 border-white/60 hover:border-white transition-all transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Capture photo"
              >
                <div className="w-14 h-14 rounded-full bg-white group-hover:bg-indigo-100 transition-colors flex items-center justify-center shadow-lg shadow-white/20">
                  <Camera className="w-6 h-6 text-slate-900" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopStream();
                  onClose();
                }}
                className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
