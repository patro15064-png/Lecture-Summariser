'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Waves, 
  Activity, 
  Sparkles, 
  Flame, 
  Compass, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2,
  Code2,
  Play,
  RotateCcw
} from 'lucide-react';

export type BackgroundTheme = 
  | 'satin-ridges' 
  | 'acoustic-frequency' 
  | 'synapse-constellation' 
  | 'obsidian-aurora' 
  | 'distill-prism';

export const STUDIO_THEME_STORAGE_KEY = 'synthly_active_background_theme';

export function getStoredStudioTheme(): BackgroundTheme {
  if (typeof window === 'undefined') return 'satin-ridges';
  try {
    const val = localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
    if (
      val === 'satin-ridges' ||
      val === 'acoustic-frequency' ||
      val === 'synapse-constellation' ||
      val === 'obsidian-aurora' ||
      val === 'distill-prism'
    ) {
      return val;
    }
  } catch (err) {
    console.warn('[Studio Theme] Failed reading stored theme:', err);
  }
  return 'satin-ridges';
}

export function saveStoredStudioTheme(theme: BackgroundTheme): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUDIO_THEME_STORAGE_KEY, theme);
    // Dispatch custom event to notify all listeners across tabs/components
    window.dispatchEvent(new CustomEvent('studio-theme-change', { detail: { theme } }));
  } catch (err) {
    console.warn('[Studio Theme] Failed saving theme:', err);
  }
}

export interface InteractiveBackgroundStudioProps {
  className?: string;
  defaultTheme?: BackgroundTheme;
  brandName?: string;
  tagline?: string;
  logoSvg?: React.ReactNode;
  showOverlayInitially?: boolean;
}

export interface SynthlyWorkspaceProps extends InteractiveBackgroundStudioProps {}

/**
 * Default Circular Synthly Logo:
 * - Outer circle: Solid obsidian black (#09090B) with 1.75px gradient border (#A855F7 -> #818CF8 -> #38BDF8)
 * - Inner elements: Optically centered white play triangle (#FFFFFF) & 3 horizontal summary bars (#A855F7, #818CF8, #38BDF8)
 */
export function SynthlyLogo({ size = 56, className = '' }: { size?: number; className?: string }) {
  const uniqueId = React.useId().replace(/:/g, '');
  const gradId = `synthly-logo-grad-${uniqueId}`;

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
      aria-label="Synthly Logo"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>

      {/* Outer Circle with Obsidian Fill & 1.75px Gradient Border */}
      <circle 
        cx="32" 
        cy="32" 
        r="29" 
        fill="#09090B" 
        stroke={`url(#${gradId})`} 
        strokeWidth="1.75" 
      />

      {/* Inner Play Triangle (Optically Centered) */}
      <path 
        d="M23 22.5L34 32L23 41.5V22.5Z" 
        fill="#FFFFFF" 
      />

      {/* 3 Summary Bars */}
      {/* Top Bar: #A855F7 */}
      <rect 
        x="37.5" 
        y="23" 
        width="11" 
        height="3" 
        rx="1.5" 
        fill="#A855F7" 
      />
      {/* Middle Bar: #818CF8 */}
      <rect 
        x="37.5" 
        y="30.5" 
        width="14" 
        height="3" 
        rx="1.5" 
        fill="#818CF8" 
      />
      {/* Bottom Bar: #38BDF8 */}
      <rect 
        x="37.5" 
        y="38" 
        width="9" 
        height="3" 
        rx="1.5" 
        fill="#38BDF8" 
      />
    </svg>
  );
}

const THEME_OPTIONS: Array<{ id: BackgroundTheme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'satin-ridges', label: 'Satin Ridges', icon: Waves },
  { id: 'acoustic-frequency', label: 'Acoustic Waves', icon: Activity },
  { id: 'synapse-constellation', label: 'Synapse Constellation', icon: Sparkles },
  { id: 'obsidian-aurora', label: 'Obsidian Aurora', icon: Flame },
  { id: 'distill-prism', label: 'Distill Prism', icon: Compass },
];

export function InteractiveBackgroundStudio({
  className = '',
  defaultTheme,
  brandName = 'Synthly',
  tagline = 'Turn raw video/audio into active learning summaries',
  logoSvg,
  showOverlayInitially = true,
}: InteractiveBackgroundStudioProps) {
  const [theme, setThemeState] = useState<BackgroundTheme>(() => {
    if (defaultTheme) return defaultTheme;
    return getStoredStudioTheme();
  });

  const setTheme = (newTheme: BackgroundTheme) => {
    setThemeState(newTheme);
    saveStoredStudioTheme(newTheme);
  };

  useEffect(() => {
    // Listen for changes from other tabs or components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STUDIO_THEME_STORAGE_KEY && e.newValue) {
        const val = e.newValue as BackgroundTheme;
        setThemeState(val);
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: BackgroundTheme }>;
      if (customEvent.detail?.theme) {
        setThemeState(customEvent.detail.theme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('studio-theme-change', handleCustomChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('studio-theme-change', handleCustomChange);
    };
  }, []);
  const [showOverlay, setShowOverlay] = useState<boolean>(showOverlayInitially);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mouseActive, setMouseActive] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mouse physics with lerping for fluid inertia
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number; radius: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    radius: 180,
  });

  // Track cursor position smoothly
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    mouseRef.current.targetX = clientX;
    mouseRef.current.targetY = clientY;
    setMouseActive(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMouseActive(false);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Canvas 60fps Animation Loop with Retina Scaling & Clean Garbage Collection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Constellation particle system
    const particleCount = 75;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
      color: string;
    }> = [];

    const colors = ['#A855F7', '#818CF8', '#38BDF8'];

    const initParticles = (w: number, h: number) => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.9,
          vy: (Math.random() - 0.5) * 0.9,
          radius: Math.random() * 2.2 + 1,
          baseAlpha: Math.random() * 0.5 + 0.3,
          color: colors[i % colors.length],
        });
      }
    };

    const resizeCanvas = () => {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.parentElement?.clientHeight || window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      // Default mouse to center on load
      if (mouseRef.current.targetX === 0 && mouseRef.current.targetY === 0) {
        mouseRef.current.x = width / 2;
        mouseRef.current.y = height / 2;
        mouseRef.current.targetX = width / 2;
        mouseRef.current.targetY = height / 2;
      }

      initParticles(width, height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    let t = 0;

    // Main 60 FPS Render Loop
    const render = () => {
      t += 0.016;

      // Smooth mouse lerping (dampening factor 0.08)
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mRadius = mouseRef.current.radius;

      // Base Obsidian Black Fill (#09090B)
      ctx.fillStyle = '#09090B';
      ctx.fillRect(0, 0, width, height);

      // --- THEME 1: SATIN RIDGES (Cursor-Reactive Topographic Wave Mesh) ---
      if (theme === 'satin-ridges') {
        const numRidges = 7;
        for (let i = 0; i < numRidges; i++) {
          ctx.beginPath();
          const offsetPhase = (i * Math.PI) / 3.5;
          const baseY = height * (0.28 + (i / numRidges) * 0.62);
          const waveHeight = height * 0.06 + i * 14;

          ctx.moveTo(0, height);
          ctx.lineTo(0, baseY);

          const step = Math.max(16, width / 70);
          for (let x = 0; x <= width + step; x += step) {
            const normX = x / width;

            // Multi-harmonic trigonometric folds
            let fold =
              Math.sin(normX * 4.2 + t * 0.8 + offsetPhase) * 0.55 +
              Math.cos(normX * 6.5 - t * 0.6 + offsetPhase * 1.3) * 0.35 +
              Math.sin(normX * 2.1 + t * 0.3) * 0.4;

            // Cursor Warping / Gravitational Deflection
            const dx = x - mx;
            const distFromMouse = Math.abs(dx);
            if (distFromMouse < mRadius * 2.5) {
              const influence = Math.pow(1 - distFromMouse / (mRadius * 2.5), 2);
              const dyMouse = my - baseY;
              // Warp ridge toward cursor elevation
              fold += (dyMouse / waveHeight) * influence * 0.85;
            }

            const y = baseY + fold * waveHeight;
            ctx.lineTo(x, y);
          }

          ctx.lineTo(width, height);
          ctx.closePath();

          // Gradient fills utilizing #A855F7, #818CF8, #38BDF8
          const grad = ctx.createLinearGradient(0, baseY - waveHeight, width, baseY + waveHeight * 2);
          const alpha = 0.07 + (i / numRidges) * 0.12;

          if (i % 3 === 0) {
            grad.addColorStop(0, `rgba(168, 85, 247, ${alpha * 1.5})`); // #A855F7
            grad.addColorStop(0.5, `rgba(129, 140, 248, ${alpha * 0.9})`); // #818CF8
            grad.addColorStop(1, 'rgba(9, 9, 11, 0.4)');
          } else if (i % 3 === 1) {
            grad.addColorStop(0, `rgba(129, 140, 248, ${alpha * 1.4})`); // #818CF8
            grad.addColorStop(0.5, `rgba(56, 189, 248, ${alpha * 0.95})`); // #38BDF8
            grad.addColorStop(1, 'rgba(9, 9, 11, 0.3)');
          } else {
            grad.addColorStop(0, `rgba(56, 189, 248, ${alpha * 1.3})`); // #38BDF8
            grad.addColorStop(0.6, `rgba(168, 85, 247, ${alpha * 0.8})`); // #A855F7
            grad.addColorStop(1, 'rgba(9, 9, 11, 0.2)');
          }

          ctx.fillStyle = grad;
          ctx.fill();

          // Luminous specular ridge crest
          ctx.strokeStyle = i % 2 === 0 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }

        // Ambient center highlight following cursor
        const radialLight = ctx.createRadialGradient(mx, my, 10, mx, my, 380);
        radialLight.addColorStop(0, 'rgba(168, 85, 247, 0.12)');
        radialLight.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)');
        radialLight.addColorStop(1, 'rgba(9, 9, 11, 0)');
        ctx.fillStyle = radialLight;
        ctx.fillRect(0, 0, width, height);
      }

      // --- THEME 2: ACOUSTIC FREQUENCY WAVES ---
      else if (theme === 'acoustic-frequency') {
        const lines = 36;
        const spacing = height / (lines + 1);

        for (let i = 0; i < lines; i++) {
          const yBase = spacing * (i + 1);
          ctx.beginPath();
          ctx.moveTo(0, yBase);

          const step = Math.max(12, width / 90);
          for (let x = 0; x <= width; x += step) {
            const freq = (i + 1) * 0.03;
            let amp = Math.sin(x * 0.012 + t * 1.8 + freq) * (14 + Math.sin(t + i) * 8);

            // Cursor proximity amplitude surge
            const dist = Math.hypot(x - mx, yBase - my);
            if (dist < mRadius * 1.8) {
              const boost = (1 - dist / (mRadius * 1.8)) * 38;
              amp += Math.sin(x * 0.05 - t * 4) * boost;
            }

            ctx.lineTo(x, yBase + amp);
          }

          const ratio = i / lines;
          let strokeColor = '#A855F7';
          if (ratio > 0.6) strokeColor = '#38BDF8';
          else if (ratio > 0.3) strokeColor = '#818CF8';

          ctx.strokeStyle = strokeColor;
          ctx.globalAlpha = 0.25 + Math.sin(t + i * 0.2) * 0.15;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      }

      // --- THEME 3: SYNAPSE CONSTELLATION ---
      else if (theme === 'synapse-constellation') {
        // Update particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Push slightly away from mouse
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.hypot(dx, dy);
          if (dist < mRadius && dist > 1) {
            const force = (1 - dist / mRadius) * 2.2;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }

          // Draw Particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.baseAlpha;
          ctx.fill();
        }

        // Draw connections between nearby particles & cursor
        for (let i = 0; i < particles.length; i++) {
          const pi = particles[i];

          // Connect to cursor
          const dCursor = Math.hypot(pi.x - mx, pi.y - my);
          if (dCursor < mRadius * 1.3) {
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(mx, my);
            ctx.strokeStyle = '#818CF8';
            ctx.globalAlpha = (1 - dCursor / (mRadius * 1.3)) * 0.45;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Connect to neighbor nodes
          for (let j = i + 1; j < particles.length; j++) {
            const pj = particles[j];
            const d = Math.hypot(pi.x - pj.x, pi.y - pj.y);
            if (d < 110) {
              ctx.beginPath();
              ctx.moveTo(pi.x, pi.y);
              ctx.lineTo(pj.x, pj.y);
              ctx.strokeStyle = pi.color;
              ctx.globalAlpha = (1 - d / 110) * 0.22;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // --- THEME 4: OBSIDIAN AURORA ---
      else if (theme === 'obsidian-aurora') {
        const bands = 4;
        for (let b = 0; b < bands; b++) {
          ctx.beginPath();
          const startY = height * (0.35 + b * 0.12);
          ctx.moveTo(0, startY);

          for (let x = 0; x <= width; x += 24) {
            const wave =
              Math.sin(x * 0.003 + t * 0.6 + b * 1.2) * 80 +
              Math.cos(x * 0.008 - t * 0.4 + b) * 45;

            // Mouse gravitational distortion
            const dx = x - mx;
            const dist = Math.abs(dx);
            let warp = 0;
            if (dist < mRadius * 2) {
              warp = Math.cos((dist / (mRadius * 2)) * Math.PI) * (my - startY) * 0.4;
            }

            ctx.lineTo(x, startY + wave + warp);
          }

          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.closePath();

          const auroraGrad = ctx.createLinearGradient(0, startY - 100, width, height);
          if (b === 0) {
            auroraGrad.addColorStop(0, 'rgba(168, 85, 247, 0.18)');
            auroraGrad.addColorStop(1, 'rgba(9, 9, 11, 0.8)');
          } else if (b === 1) {
            auroraGrad.addColorStop(0, 'rgba(129, 140, 248, 0.15)');
            auroraGrad.addColorStop(1, 'rgba(9, 9, 11, 0.85)');
          } else {
            auroraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
            auroraGrad.addColorStop(1, 'rgba(9, 9, 11, 0.9)');
          }

          ctx.fillStyle = auroraGrad;
          ctx.fill();
        }
      }

      // --- THEME 5: DISTILL PRISM LIGHT BEAMS ---
      else if (theme === 'distill-prism') {
        const beams = 14;
        const originX = mx;
        const originY = my;

        for (let i = 0; i < beams; i++) {
          const angle = (i / beams) * Math.PI * 2 + t * 0.2;
          const beamLength = Math.max(width, height) * 1.2;
          const endX = originX + Math.cos(angle) * beamLength;
          const endY = originY + Math.sin(angle) * beamLength;

          const beamGrad = ctx.createLinearGradient(originX, originY, endX, endY);
          const color = colors[i % colors.length];

          beamGrad.addColorStop(0, `${color}44`);
          beamGrad.addColorStop(0.3, `${color}18`);
          beamGrad.addColorStop(1, 'rgba(9, 9, 11, 0)');

          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(endX - 45, endY - 45);
          ctx.lineTo(endX + 45, endY + 45);
          ctx.closePath();

          ctx.fillStyle = beamGrad;
          ctx.fill();
        }

        // Center prism core
        ctx.beginPath();
        ctx.arc(originX, originY, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#818CF8';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  // Code Copy Handler
  const handleCopyCode = () => {
    const componentCodeSnippet = `// Production Ready Next.js 16 (App Router) Component
// Component: SynthlyWorkspace.tsx
import { InteractiveBackgroundStudio, SynthlyLogo } from '@/components/InteractiveBackgroundStudio';

export default function WorkspacePage() {
  return (
    <InteractiveBackgroundStudio 
      defaultTheme="${theme}" 
      brandName="${brandName}" 
      tagline="${tagline}" 
    />
  );
}`;

    navigator.clipboard.writeText(componentCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-screen overflow-hidden bg-[#09090B] text-slate-100 select-none font-sans ${className}`}
    >
      {/* 60fps Dynamic Interactive Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{
          touchAction: 'none',
          contain: 'strict',
        }}
      />

      {/* Floating Top Control Toolbar */}
      <header className="absolute top-4 inset-x-0 mx-auto max-w-4xl px-4 z-30">
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 shadow-2xl">
          {/* Brand Mark in Toolbar */}
          <div className="flex items-center gap-2.5 pl-2">
            <SynthlyLogo size={28} />
            <span className="font-semibold text-sm tracking-tight text-white hidden sm:inline-block">
              {brandName} Studio
            </span>
          </div>

          {/* Theme Selector Pills */}
          <div className="flex items-center gap-1 overflow-x-auto p-0.5 rounded-xl bg-zinc-900/70 border border-white/5">
            {THEME_OPTIONS.map((item) => {
              const Icon = item.icon;
              const isActive = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTheme(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline-block">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pr-1">
            {/* Toggle Overlay Button */}
            <button
              type="button"
              onClick={() => setShowOverlay(!showOverlay)}
              className={`p-2 rounded-xl text-xs font-medium border transition-all ${
                showOverlay
                  ? 'bg-zinc-800/80 text-zinc-200 border-zinc-700/80 hover:bg-zinc-700'
                  : 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
              }`}
              title={showOverlay ? 'Hide UI Card' : 'Show UI Card'}
              aria-label="Toggle UI Overlay"
            >
              {showOverlay ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Copy Component Code */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:border-zinc-600 transition-all shadow-sm"
              title="Copy Next.js Component Code"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Code2 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline-block">Get Code</span>
                </>
              )}
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent transition-all"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Center Frosted Glassmorphic Synthly UI Card */}
      {showOverlay && (
        <main className="absolute inset-0 flex items-center justify-center p-4 z-20 pointer-events-none">
          <div className="relative pointer-events-auto max-w-md w-full rounded-2xl bg-zinc-950/70 backdrop-blur-xl border border-zinc-800/80 p-8 shadow-2xl flex flex-col items-center text-center space-y-6 transition-all duration-300 transform hover:scale-[1.01] group">
            {/* Luminous Glow Behind Logo */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />

            {/* Circular Custom SVG Logo */}
            <div className="relative">
              {logoSvg || <SynthlyLogo size={72} />}
            </div>

            {/* Typography: Wordmark & Tagline */}
            <div className="space-y-2">
              <h1 className="text-[25px] font-semibold tracking-tight text-white flex items-center justify-center gap-1.5">
                <span>{brandName}</span>
                <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto">
                {tagline}
              </p>
            </div>

            {/* Quick Demo Action Buttons */}
            <div className="w-full pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const currentIndex = THEME_OPTIONS.findIndex((o) => o.id === theme);
                  const nextTheme = THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length].id;
                  setTheme(nextTheme);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Next Physics Mode</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 hover:border-zinc-600 transition-all flex items-center justify-center gap-2"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Export Component'}</span>
              </button>
            </div>

            {/* Cursor Dynamics Prompt */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 pt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${mouseActive ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
              <span>Cursor Physics: {mouseActive ? 'Active Warp' : 'Move cursor on canvas'}</span>
            </div>
          </div>
        </main>
      )}

      {/* Subtle Bottom Status Bar */}
      <footer className="absolute bottom-4 inset-x-0 mx-auto max-w-sm px-4 z-10 flex items-center justify-center pointer-events-none">
        <div className="px-3.5 py-1.5 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/5 text-[11px] text-zinc-400 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Active Theme: <span className="text-zinc-200 capitalize">{theme.replace('-', ' ')}</span></span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">60 FPS</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Pure Ambient Background Canvas for the Main App:
 * Automatically synchronizes with the studio theme chosen by the user in localStorage.
 */
export function AppDynamicBackground({
  className = '',
  intensity = 1.0,
}: {
  className?: string;
  intensity?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<BackgroundTheme>(() => getStoredStudioTheme());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number; radius: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    radius: 180,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for storage or studio theme change events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STUDIO_THEME_STORAGE_KEY && e.newValue) {
        setTheme(e.newValue as BackgroundTheme);
      }
    };
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: BackgroundTheme }>;
      if (customEvent.detail?.theme) {
        setTheme(customEvent.detail.theme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('studio-theme-change', handleCustomChange);

    const onPointerMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };
    window.addEventListener('mousemove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('studio-theme-change', handleCustomChange);
      window.removeEventListener('mousemove', onPointerMove);
    };
  }, []);

  // Canvas render loop matching studio physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
      color: string;
    }> = [];
    const colors = ['#A855F7', '#818CF8', '#38BDF8'];

    const initParticles = (w: number, h: number) => {
      particles.length = 0;
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          radius: Math.random() * 2 + 1,
          baseAlpha: Math.random() * 0.4 + 0.25,
          color: colors[i % colors.length],
        });
      }
    };

    const updateSize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles(width, height);
    };
    updateSize();

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout | null = null;
    const onScroll = () => {
      isScrolling = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 120);
    };

    window.addEventListener('resize', updateSize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    let t = 0;
    let lastTime = performance.now();
    const targetFps = 35;
    const frameInterval = 1000 / targetFps;

    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (isScrolling) return;

      const elapsed = now - lastTime;
      if (elapsed < frameInterval) return;
      lastTime = now - (elapsed % frameInterval);

      t += 0.016;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;
      const mx = mouseRef.current.x || width / 2;
      const my = mouseRef.current.y || height / 2;
      const mRadius = mouseRef.current.radius;

      ctx.fillStyle = '#09090B';
      ctx.fillRect(0, 0, width, height);

      // --- THEME 1: SATIN RIDGES ---
      if (theme === 'satin-ridges') {
        const numRidges = 5;
        for (let i = 0; i < numRidges; i++) {
          ctx.beginPath();
          const offsetPhase = (i * Math.PI) / 3;
          const baseY = height * (0.28 + (i / numRidges) * 0.65);
          const waveHeight = (height * 0.07 + i * 16) * intensity;

          ctx.moveTo(0, height);
          ctx.lineTo(0, baseY);

          const step = Math.max(24, width / 45);
          for (let x = 0; x <= width + step; x += step) {
            const normX = x / width;
            let fold =
              Math.sin(normX * 3.8 + t * 0.8 + offsetPhase) * 0.55 +
              Math.cos(normX * 6.0 - t * 0.6 + offsetPhase * 1.3) * 0.35;

            const dx = x - mx;
            const dist = Math.abs(dx);
            if (dist < mRadius * 2) {
              const influence = Math.pow(1 - dist / (mRadius * 2), 2);
              fold += ((my - baseY) / waveHeight) * influence * 0.65;
            }

            const y = baseY + fold * waveHeight;
            ctx.lineTo(x, y);
          }

          ctx.lineTo(width, height);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, baseY - waveHeight, width, baseY + waveHeight * 2);
          const alpha = (0.07 + (i / numRidges) * 0.1) * intensity;

          if (i % 2 === 0) {
            grad.addColorStop(0, `rgba(168, 85, 247, ${alpha * 1.4})`);
            grad.addColorStop(0.5, `rgba(129, 140, 248, ${alpha * 0.9})`);
            grad.addColorStop(1, 'rgba(9, 9, 11, 0.3)');
          } else {
            grad.addColorStop(0, `rgba(56, 189, 248, ${alpha * 1.3})`);
            grad.addColorStop(0.5, `rgba(168, 85, 247, ${alpha * 0.8})`);
            grad.addColorStop(1, 'rgba(9, 9, 11, 0.2)');
          }

          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = i % 2 === 0 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // --- THEME 2: ACOUSTIC FREQUENCY WAVES ---
      else if (theme === 'acoustic-frequency') {
        const lines = 24;
        const spacing = height / (lines + 1);
        for (let i = 0; i < lines; i++) {
          const yBase = spacing * (i + 1);
          ctx.beginPath();
          ctx.moveTo(0, yBase);
          const step = Math.max(16, width / 60);

          for (let x = 0; x <= width; x += step) {
            let amp = Math.sin(x * 0.012 + t * 1.6 + i * 0.04) * (12 + Math.sin(t + i) * 6);
            const dist = Math.hypot(x - mx, yBase - my);
            if (dist < mRadius * 1.6) {
              amp += Math.sin(x * 0.05 - t * 3) * ((1 - dist / (mRadius * 1.6)) * 30);
            }
            ctx.lineTo(x, yBase + amp);
          }

          const ratio = i / lines;
          ctx.strokeStyle = ratio > 0.5 ? '#38BDF8' : '#A855F7';
          ctx.globalAlpha = 0.22 + Math.sin(t + i * 0.2) * 0.12;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      }

      // --- THEME 3: SYNAPSE CONSTELLATION ---
      else if (theme === 'synapse-constellation') {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.hypot(dx, dy);
          if (dist < mRadius && dist > 1) {
            const force = (1 - dist / mRadius) * 2;
            p.x += (dx / dist) * force;
            p.y += (dy / dist) * force;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.baseAlpha;
          ctx.fill();
        }

        for (let i = 0; i < particles.length; i++) {
          const pi = particles[i];
          const dCursor = Math.hypot(pi.x - mx, pi.y - my);
          if (dCursor < mRadius * 1.2) {
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(mx, my);
            ctx.strokeStyle = '#818CF8';
            ctx.globalAlpha = (1 - dCursor / (mRadius * 1.2)) * 0.4;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          for (let j = i + 1; j < particles.length; j++) {
            const pj = particles[j];
            const d = Math.hypot(pi.x - pj.x, pi.y - pj.y);
            if (d < 100) {
              ctx.beginPath();
              ctx.moveTo(pi.x, pi.y);
              ctx.lineTo(pj.x, pj.y);
              ctx.strokeStyle = pi.color;
              ctx.globalAlpha = (1 - d / 100) * 0.2;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // --- THEME 4: OBSIDIAN AURORA ---
      else if (theme === 'obsidian-aurora') {
        const bands = 3;
        for (let b = 0; b < bands; b++) {
          ctx.beginPath();
          const startY = height * (0.35 + b * 0.14);
          ctx.moveTo(0, startY);

          for (let x = 0; x <= width; x += 30) {
            const wave = Math.sin(x * 0.003 + t * 0.5 + b * 1.2) * 70;
            const dist = Math.abs(x - mx);
            let warp = 0;
            if (dist < mRadius * 2) {
              warp = Math.cos((dist / (mRadius * 2)) * Math.PI) * (my - startY) * 0.35;
            }
            ctx.lineTo(x, startY + wave + warp);
          }

          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, startY - 80, width, height);
          grad.addColorStop(0, b === 0 ? 'rgba(168, 85, 247, 0.16)' : 'rgba(56, 189, 248, 0.12)');
          grad.addColorStop(1, 'rgba(9, 9, 11, 0.85)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // --- THEME 5: DISTILL PRISM ---
      else if (theme === 'distill-prism') {
        const beams = 10;
        for (let i = 0; i < beams; i++) {
          const angle = (i / beams) * Math.PI * 2 + t * 0.18;
          const len = Math.max(width, height) * 1.1;
          const endX = mx + Math.cos(angle) * len;
          const endY = my + Math.sin(angle) * len;

          const grad = ctx.createLinearGradient(mx, my, endX, endY);
          const color = colors[i % colors.length];
          grad.addColorStop(0, `${color}38`);
          grad.addColorStop(0.35, `${color}12`);
          grad.addColorStop(1, 'rgba(9, 9, 11, 0)');

          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(endX - 35, endY - 35);
          ctx.lineTo(endX + 35, endY + 35);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(mx, my, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#818CF8';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, intensity, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        transform: 'translateZ(0)',
        willChange: 'transform',
        contain: 'strict',
      }}
      className={`fixed inset-0 pointer-events-none -z-10 h-full w-full ${className}`}
    />
  );
}

// Named alias SynthlyWorkspace to satisfy all prompt requirements
export const SynthlyWorkspace = InteractiveBackgroundStudio;
export default InteractiveBackgroundStudio;
