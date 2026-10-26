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
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    let t = 0;

    // Rich color palette: deep midnight obsidian, violet-indigo satin waves, specular silver highlights
    const render = () => {
      t += 0.003 * speed;
      ctx.clearRect(0, 0, width, height);

      // Deep dark background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#030712'); // obsidian black
      bgGrad.addColorStop(0.5, '#070b19'); // deep navy slate
      bgGrad.addColorStop(1, '#0b0f20'); // midnight violet
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render 8 layers of flowing satin folds with specular highlights
      const numRidges = 8;
      for (let i = 0; i < numRidges; i++) {
        ctx.beginPath();

        const offsetPhase = (i * Math.PI) / 4;
        const baseY = height * (0.2 + (i / numRidges) * 0.7);
        const waveHeight = (height * 0.08 + i * 14) * intensity;

        ctx.moveTo(0, height);
        ctx.lineTo(0, baseY);

        const step = Math.max(16, width / 60);
        for (let x = 0; x <= width + step; x += step) {
          const normX = x / width;
          // Dual sine wave superposition to create realistic fabric folds
          const fold1 = Math.sin(normX * 3.5 + t * 1.2 + offsetPhase);
          const fold2 = Math.cos(normX * 6.2 - t * 0.8 + offsetPhase * 1.5) * 0.5;
          const fold3 = Math.sin(normX * 1.8 + t * 0.4) * 0.8;
          
          const y = baseY + (fold1 + fold2 + fold3) * waveHeight * 0.5;
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

        const alpha = (0.07 + (i / numRidges) * 0.12) * intensity;
        
        // Alternating iridescent satin colors (indigo, violet, celestial cyan, soft silver)
        if (i % 3 === 0) {
          ridgeGrad.addColorStop(0, `rgba(99, 102, 241, ${alpha * 1.4})`); // Indigo 500
          ridgeGrad.addColorStop(0.5, `rgba(168, 85, 247, ${alpha * 0.9})`); // Violet 500
          ridgeGrad.addColorStop(1, `rgba(15, 23, 42, ${alpha * 0.4})`);
        } else if (i % 3 === 1) {
          ridgeGrad.addColorStop(0, `rgba(147, 51, 234, ${alpha * 1.3})`); // Purple 600
          ridgeGrad.addColorStop(0.4, `rgba(59, 130, 246, ${alpha * 0.8})`); // Blue 500
          ridgeGrad.addColorStop(1, `rgba(2, 6, 23, ${alpha * 0.3})`);
        } else {
          ridgeGrad.addColorStop(0, `rgba(56, 189, 248, ${alpha * 1.1})`); // Sky 400 highlight
          ridgeGrad.addColorStop(0.5, `rgba(129, 140, 248, ${alpha * 0.8})`); // Indigo 400
          ridgeGrad.addColorStop(1, `rgba(3, 7, 18, ${alpha * 0.2})`);
        }

        ctx.fillStyle = ridgeGrad;
        ctx.fill();

        // Add specular fold highlight stroke along the crest
        ctx.strokeStyle = `rgba(224, 231, 255, ${0.08 * (i + 1) * intensity})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Soft ambient light vignette on top
      const radialVignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.3,
        50,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8
      );
      radialVignette.addColorStop(0, 'rgba(129, 140, 248, 0.06)');
      radialVignette.addColorStop(0.5, 'rgba(15, 23, 42, 0.2)');
      radialVignette.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
      ctx.fillStyle = radialVignette;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
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
      }}
      className={`fixed inset-0 pointer-events-none -z-10 h-full w-full ${className}`}
    />
  );
}
