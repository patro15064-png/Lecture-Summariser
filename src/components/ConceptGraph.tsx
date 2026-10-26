'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  Network, 
  Play, 
  CheckCircle2, 
  Layers, 
  Info, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  ShieldCheck,
  Volume2,
  VolumeX 
} from 'lucide-react';
import { LectureArtifact, ConceptNode, ConceptType } from '@/types/lecture';
import { MathView } from './MathView';
import { formatTime } from '@/lib/transcriptParser';

interface ConceptGraphProps {
  artifact: LectureArtifact;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function ConceptGraph({ artifact, currentTime, onSeek }: ConceptGraphProps) {
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | ConceptType>('all');
  const [selectedConceptId, setSelectedConceptId] = useState<string>(() => {
    return artifact.concepts?.[0]?.id || '';
  });
  const [speakingExplanation, setSpeakingExplanation] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const allConcepts = useMemo(() => artifact.concepts || [], [artifact.concepts]);
  const edges = useMemo(() => artifact.graphData?.edges || [], [artifact.graphData?.edges]);

  // Filtered concepts by type
  const filteredConcepts = useMemo(() => {
    if (selectedTypeFilter === 'all') return allConcepts;
    return allConcepts.filter((c) => c.type === selectedTypeFilter);
  }, [allConcepts, selectedTypeFilter]);

  // Selected concept
  const selectedConcept = useMemo(() => {
    return allConcepts.find((c) => c.id === selectedConceptId) || allConcepts[0] || null;
  }, [allConcepts, selectedConceptId]);

  // Active concept during playback
  const activeConceptDuringPlayback = useMemo(() => {
    // Sort concepts chronologically
    const sorted = [...allConcepts].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    let active = sorted[0];
    for (const c of sorted) {
      if (currentTime >= c.timestampSeconds) {
        active = c;
      } else {
        break;
      }
    }
    return active;
  }, [allConcepts, currentTime]);

  // Find incoming prerequisites and outgoing dependents for selectedConcept
  const { prerequisites, dependents } = useMemo(() => {
    if (!selectedConcept) return { prerequisites: [], dependents: [] };

    const incomingPrereqIds = edges
      .filter((e) => e.target === selectedConcept.id)
      .map((e) => e.source);

    const outgoingDependentIds = edges
      .filter((e) => e.source === selectedConcept.id)
      .map((e) => e.target);

    return {
      prerequisites: allConcepts.filter((c) => incomingPrereqIds.includes(c.id)),
      dependents: allConcepts.filter((c) => outgoingDependentIds.includes(c.id)),
    };
  }, [selectedConcept, edges, allConcepts]);

  // Handle Pan & Zoom on SVG Canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Node importance styling
  const getNodeSizing = (importance: ConceptNode['importance']) => {
    switch (importance) {
      case 'foundational':
        return { radius: 24, badge: 'Foundational', color: '#6366f1' };
      case 'core':
        return { radius: 30, badge: 'Core Concept', color: '#a855f7' };
      case 'advanced':
        return { radius: 26, badge: 'Advanced Topic', color: '#ec4899' };
      default:
        return { radius: 25, badge: 'Concept', color: '#3b82f6' };
    }
  };

  // Compute 2D Positions for nodes in SVG canvas (Hierarchical DAG layers)
  const nodeLayout = useMemo(() => {
    const layout = new Map<string, { x: number; y: number }>();
    const count = allConcepts.length;
    if (count === 0) return layout;

    // Arrange in a balanced responsive arc / grid
    const cols = Math.min(4, Math.ceil(Math.sqrt(count)));
    const colSpacing = 220;
    const rowSpacing = 160;

    allConcepts.forEach((c, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      // Add slight offset for aesthetic non-linear feel
      const staggerX = (row % 2) * 40;
      layout.set(c.id, {
        x: 100 + col * colSpacing + staggerX,
        y: 80 + row * rowSpacing,
      });
    });

    return layout;
  }, [allConcepts]);

  const canvasWidth = 900;
  const canvasHeight = Math.max(500, (Math.ceil(allConcepts.length / 4) + 1) * 160);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Prerequisite Concept DAG
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                Live Playback Synced
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any node to inspect equations, grounded verbatim quotes, and seek playback.
            </p>
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-900 border border-white/5">
          {(['all', 'core', 'equation', 'definition', 'entity'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedTypeFilter(type)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all ${
                selectedTypeFilter === type
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Interactive Canvas on Left, Side Drawer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: SVG Canvas with Pan/Zoom (7 Cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[480px]">
          {/* Canvas Controls Header */}
          <div className="flex items-center justify-between z-10 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Topological Graph View
              </span>
              <span className="text-xs font-mono text-slate-500">
                ({filteredConcepts.length} Nodes)
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-white/5 rounded-xl p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-1.5">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.15))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={resetView}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Reset Canvas Position"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Draggable SVG Canvas */}
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`w-full h-full min-h-[400px] overflow-hidden cursor-${isDragging ? 'grabbing' : 'grab'} select-none relative flex items-center justify-center`}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <defs>
                <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.6" />
                </linearGradient>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
                </marker>
              </defs>

              {/* Draw Edges */}
              {edges.map((edge) => {
                const srcPos = nodeLayout.get(edge.source);
                const tgtPos = nodeLayout.get(edge.target);
                if (!srcPos || !tgtPos) return null;

                // Bezier curve
                const dx = tgtPos.x - srcPos.x;
                const path = `M ${srcPos.x} ${srcPos.y} C ${srcPos.x + dx * 0.4} ${srcPos.y}, ${tgtPos.x - dx * 0.4} ${tgtPos.y}, ${tgtPos.x} ${tgtPos.y}`;

                const isEdgeHighlighted =
                  edge.source === selectedConcept?.id || edge.target === selectedConcept?.id;

                return (
                  <path
                    key={edge.id}
                    d={path}
                    fill="none"
                    stroke={isEdgeHighlighted ? '#ec4899' : 'url(#edgeGrad)'}
                    strokeWidth={isEdgeHighlighted ? 2.5 : 1.5}
                    strokeDasharray={isEdgeHighlighted ? 'none' : '4,3'}
                    markerEnd="url(#arrow)"
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Draw Nodes */}
              {allConcepts.map((concept) => {
                const pos = nodeLayout.get(concept.id);
                if (!pos) return null;

                const sizing = getNodeSizing(concept.importance);
                const isSelected = concept.id === selectedConcept?.id;
                const isLiveActive = concept.id === activeConceptDuringPlayback?.id;
                const isDimmed =
                  selectedTypeFilter !== 'all' && concept.type !== selectedTypeFilter;

                return (
                  <g
                    key={concept.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => {
                      setSelectedConceptId(concept.id);
                      onSeek(concept.timestampSeconds);
                    }}
                    className="cursor-pointer group"
                    opacity={isDimmed ? 0.35 : 1}
                  >
                    {/* Active playback pulse ring */}
                    {isLiveActive && (
                      <circle
                        r={sizing.radius + 10}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        className="animate-ping opacity-60"
                      />
                    )}

                    {/* Outer Glow Ring on Select */}
                    {isSelected && (
                      <circle
                        r={sizing.radius + 6}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="3"
                        strokeDasharray="4,2"
                        className="animate-spin"
                        style={{ transformOrigin: '0 0', animationDuration: '8s' }}
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      r={sizing.radius}
                      fill={isSelected ? '#1e1b4b' : isLiveActive ? '#064e3b' : '#0f172a'}
                      stroke={isSelected ? '#ec4899' : isLiveActive ? '#10b981' : sizing.color}
                      strokeWidth={isSelected ? 3 : 2}
                      className="group-hover:scale-110 transition-transform duration-200"
                    />

                    {/* Node Type Glyph or Number */}
                    <text
                      textAnchor="middle"
                      dy=".3em"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {formatTime(concept.timestampSeconds)}
                    </text>

                    {/* Node Title Label Below */}
                    <text
                      textAnchor="middle"
                      y={sizing.radius + 16}
                      fill={isSelected ? '#f472b6' : '#cbd5e1'}
                      fontSize="11"
                      fontWeight="600"
                      className="transition-colors group-hover:fill-white drop-shadow"
                    >
                      {concept.title.length > 20
                        ? `${concept.title.substring(0, 18)}...`
                        : concept.title}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Canvas Footer Legend */}
          <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 z-10">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Foundational
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Core
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Advanced
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /> Playing Now
              </span>
            </div>
            <span className="text-slate-500">Drag to pan • Click node to seek</span>
          </div>
        </div>

        {/* Right: Selected Node Side Drawer / Deep Dive (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedConcept ? (
            <div className="rounded-3xl border border-purple-500/30 bg-slate-950/90 backdrop-blur-xl p-6 shadow-2xl space-y-5 transition-all">
              {/* Header with Type & Seek */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {selectedConcept.type} • {selectedConcept.importance}
                  </span>

                  <button
                    type="button"
                    onClick={() => onSeek(selectedConcept.timestampSeconds)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Seek {selectedConcept.timestampFormatted}</span>
                  </button>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight leading-tight">
                  {selectedConcept.title}
                </h3>
              </div>

              {/* KaTeX Math Formula (if available) */}
              {selectedConcept.formulaLatex && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 text-center shadow-inner space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Mathematical Formulation
                  </span>
                  <div className="overflow-x-auto py-1">
                    <MathView math={selectedConcept.formulaLatex} displayMode={true} />
                  </div>
                </div>
              )}

              {/* Pedagogical Explanation with AI Voice Readout */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-purple-400" /> Pedagogical Explanation:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
                      if (speakingExplanation) {
                        window.speechSynthesis.cancel();
                        setSpeakingExplanation(false);
                      } else {
                        window.speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(selectedConcept.explanation);
                        utterance.rate = 1.0;
                        utterance.onend = () => setSpeakingExplanation(false);
                        utterance.onerror = () => setSpeakingExplanation(false);
                        setSpeakingExplanation(true);
                        window.speechSynthesis.speak(utterance);
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
                    title="Read explanation aloud"
                  >
                    {speakingExplanation ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{speakingExplanation ? 'Stop Voice' : 'Listen'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  {selectedConcept.explanation}
                </p>
              </div>

              {/* Verbatim Grounded Quote from Transcript */}
              {selectedConcept.verbatimQuote && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verbatim Quote in Lecture
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      [{selectedConcept.timestampFormatted}]
                    </span>
                  </div>
                  <p className="text-xs italic text-slate-200 leading-relaxed pl-2 border-l-2 border-indigo-500">
                    &ldquo;{selectedConcept.verbatimQuote}&rdquo;
                  </p>
                </div>
              )}

              {/* Key Takeaways */}
              {selectedConcept.keyTakeaways && selectedConcept.keyTakeaways.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    Key Conceptual Insights:
                  </span>
                  <ul className="space-y-1.5">
                    {selectedConcept.keyTakeaways.map((takeaway, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clickable Appearances Timestamps */}
              {selectedConcept.appearsAtTimestamps && selectedConcept.appearsAtTimestamps.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Referenced at Timestamps:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedConcept.appearsAtTimestamps.map((sec, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSeek(sec)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-900 border border-white/10 hover:border-indigo-400 text-indigo-300 hover:text-white transition-colors"
                      >
                        [{formatTime(sec)}]
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites Chain */}
              {prerequisites.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Prerequisite Mastery Required:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {prerequisites.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedConceptId(p.id);
                          onSeek(p.timestampSeconds);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-white/10 hover:border-purple-400 text-slate-300 hover:text-white transition-colors"
                      >
                        ← {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependents Chain */}
              {dependents.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Unlocks Downstream Topics:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dependents.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedConceptId(d.id);
                          onSeek(d.timestampSeconds);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-white/10 hover:border-pink-400 text-slate-300 hover:text-white transition-colors"
                      >
                        {d.title} →
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-3xl border border-white/10 bg-slate-950/70 text-center text-slate-400">
              Select a node in the graph to view its deep dive.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
