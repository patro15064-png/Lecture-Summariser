'use client';

import React, { useEffect, useRef } from 'react';

interface SatinRidgesProps {
  className?: string;
  intensity?: number;
  speed?: number;
}

export default function SatinRidges({
  className = '',
  intensity = 1.0,
  speed = 0.6,
}: SatinRidgesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const updateDimensions = () => {
      if (!canvas) return;
      // Cap device pixel ratio to 1 for high-efficiency fill rate
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    updateDimensions();

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout | null = null;

    const onScroll = () => {
      isScrolling = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 120);
    };

    window.addEventListener('resize', updateDimensions, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    let t = 0;
    let lastFrameTime = performance.now();
    const targetFps = 30; // 30 FPS ambient wave is butter smooth and cuts GPU fill rate by 50%
    const frameInterval = 1000 / targetFps;

    // Rich color palette: deep midnight obsidian, violet-indigo satin waves, specular silver highlights
    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);

      // If user is actively scrolling, skip heavy 2D canvas repaints to give 100% compositor headroom
      if (isScrolling) {
        return;
      }

      const elapsed = now - lastFrameTime;
      if (elapsed < frameInterval) {
        return;
      }
      lastFrameTime = now - (elapsed % frameInterval);

      t += 0.005 * speed;
      ctx.clearRect(0, 0, width, height);

      // Deep dark background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#030712'); // obsidian black
      bgGrad.addColorStop(0.5, '#070b19'); // deep navy slate
      bgGrad.addColorStop(1, '#0b0f20'); // midnight violet
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render 5 layers of flowing satin folds (reduced from 8 for high performance)
      const numRidges = 5;
      for (let i = 0; i < numRidges; i++) {
        ctx.beginPath();

        const offsetPhase = (i * Math.PI) / 3;
        const baseY = height * (0.25 + (i / numRidges) * 0.65);
        const waveHeight = (height * 0.07 + i * 16) * intensity;

        ctx.moveTo(0, height);
        ctx.lineTo(0, baseY);

        // Optimized step size (cuts loop iterations)
        const step = Math.max(28, width / 40);
        for (let x = 0; x <= width + step; x += step) {
          const normX = x / width;
          // Dual sine wave superposition to create realistic fabric folds
          const fold1 = Math.sin(normX * 3.5 + t * 1.2 + offsetPhase);
          const fold2 = Math.cos(normX * 5.8 - t * 0.8 + offsetPhase * 1.5) * 0.5;
          
          const y = baseY + (fold1 + fold2) * waveHeight * 0.55;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Layer gradient with luminous satin edges
        const ridgeGrad = ctx.createLinearGradient(
          0,
          baseY - waveHeight,
          width * 0.8,
          baseY + waveHeight * 2
        );

        const alpha = (0.08 + (i / numRidges) * 0.12) * intensity;
        
        // Alternating iridescent satin colors (indigo, violet, celestial cyan)
        if (i % 2 === 0) {
          ridgeGrad.addColorStop(0, `rgba(99, 102, 241, ${alpha * 1.3})`); // Indigo 500
          ridgeGrad.addColorStop(0.5, `rgba(168, 85, 247, ${alpha * 0.85})`); // Violet 500
          ridgeGrad.addColorStop(1, `rgba(15, 23, 42, ${alpha * 0.3})`);
        } else {
          ridgeGrad.addColorStop(0, `rgba(147, 51, 234, ${alpha * 1.2})`); // Purple 600
          ridgeGrad.addColorStop(0.5, `rgba(56, 189, 248, ${alpha * 0.8})`); // Sky 400
          ridgeGrad.addColorStop(1, `rgba(2, 6, 23, ${alpha * 0.25})`);
        }

        ctx.fillStyle = ridgeGrad;
        ctx.fill();

        // Specular fold highlight stroke along the crest
        ctx.strokeStyle = `rgba(224, 231, 255, ${0.07 * (i + 1) * intensity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Soft ambient light vignette on top
      const radialVignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.3,
        80,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      radialVignette.addColorStop(0, 'rgba(129, 140, 248, 0.05)');
      radialVignette.addColorStop(0.6, 'rgba(15, 23, 42, 0.2)');
      radialVignette.addColorStop(1, 'rgba(2, 6, 23, 0.88)');
      ctx.fillStyle = radialVignette;
      ctx.fillRect(0, 0, width, height);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, speed]);

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
