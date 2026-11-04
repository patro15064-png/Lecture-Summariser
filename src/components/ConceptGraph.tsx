'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  Network, 
  Play, 
  Layers, 
  Info, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Volume2,
  VolumeX,
  Search,
  BookOpen,
  HelpCircle,
  FileText
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
  const [selectedImportanceFilter, setSelectedImportanceFilter] = useState<'all' | 'foundational' | 'core' | 'advanced'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Filtered concepts by type, importance, and search query
  const filteredConcepts = useMemo(() => {
    return allConcepts.filter((c) => {
      const matchesType = selectedTypeFilter === 'all' || c.type === selectedTypeFilter;
      const matchesImportance = selectedImportanceFilter === 'all' || c.importance === selectedImportanceFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.explanation.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesImportance && matchesSearch;
    });
  }, [allConcepts, selectedTypeFilter, selectedImportanceFilter, searchQuery]);

  // Selected concept
  const selectedConcept = useMemo(() => {
    return (
      allConcepts.find((c) => c.id === selectedConceptId) ||
      filteredConcepts[0] ||
      allConcepts[0] ||
      null
    );
  }, [allConcepts, filteredConcepts, selectedConceptId]);

  // Related flashcards & questions for selected concept
  const relatedFlashcards = useMemo(() => {
    if (!selectedConcept) return [];
    return (artifact.flashcards || []).filter((f) => f.conceptId === selectedConcept.id);
  }, [artifact.flashcards, selectedConcept]);

  const relatedQuestions = useMemo(() => {
    if (!selectedConcept) return [];
    return (artifact.diagnosticQuestions || []).filter((q) => q.conceptId === selectedConcept.id);
  }, [artifact.diagnosticQuestions, selectedConcept]);

  // Active concept during playback
  const activeConceptDuringPlayback = useMemo(() => {
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

    const cols = Math.min(4, Math.ceil(Math.sqrt(count)));
    const colSpacing = 220;
    const rowSpacing = 170;

    allConcepts.forEach((c, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const staggerX = (row % 2) * 45;
      layout.set(c.id, {
        x: 120 + col * colSpacing + staggerX,
        y: 90 + row * rowSpacing,
      });
    });

    return layout;
  }, [allConcepts]);

  const canvasWidth = 960;
  const canvasHeight = Math.max(500, (Math.ceil(allConcepts.length / 4) + 1) * 170);

  // Graceful empty / tiny graph handling
  if (allConcepts.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
          <Network className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-lg font-bold text-white">No Concept Nodes Extracted Yet</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Upload text, PDF documents, lecture slides, or recorded audio to automatically synthesize prerequisite DAG relationships and topological concept maps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Search / Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Interactive Concept Relationship Graph
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                {allConcepts.length} Concepts
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Nodes are concepts; edges are labeled semantic relationships. Click any node to deep dive.
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Real-time search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-36 sm:w-44"
            />
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/5">
            {(['all', 'core', 'equation', 'definition'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedTypeFilter(type)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                  selectedTypeFilter === type
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Importance Filters */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/5">
            {(['all', 'foundational', 'core', 'advanced'] as const).map((imp) => (
              <button
                key={imp}
                type="button"
                onClick={() => setSelectedImportanceFilter(imp)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                  selectedImportanceFilter === imp
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {imp}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Canvas on Left (7 cols), Side Drawer on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: SVG Canvas with Pan/Zoom */}
        <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[500px]">
          {/* Canvas Controls Header */}
          <div className="flex items-center justify-between z-10 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Topological Concept View
              </span>
              <span className="text-xs font-mono text-slate-500">
                ({filteredConcepts.length} Visible)
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-white/5 rounded-xl p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.15))}
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
                onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
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
            className={`w-full h-full min-h-[420px] overflow-hidden cursor-${isDragging ? 'grabbing' : 'grab'} select-none relative flex items-center justify-center`}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
              className="transition-transform duration-75"
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
                </marker>
              </defs>

              {/* Render Labeled Edges */}
              {edges.map((edge) => {
                const sourcePos = nodeLayout.get(edge.source);
                const targetPos = nodeLayout.get(edge.target);
                if (!sourcePos || !targetPos) return null;

                const midX = (sourcePos.x + targetPos.x) / 2;
                const midY = (sourcePos.y + targetPos.y) / 2;
                const edgeLabel = edge.label || edge.type || 'prerequisite';

                return (
                  <g key={edge.id} className="opacity-75">
                    {/* Edge Line */}
                    <line
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      stroke="#4f46e5"
                      strokeWidth="2"
                      strokeDasharray={edge.type === 'contrasts-with' ? '4,4' : undefined}
                      markerEnd="url(#arrow)"
                    />
                    {/* Labeled relationship pill */}
                    <rect
                      x={midX - 28}
                      y={midY - 8}
                      width="56"
                      height="16"
                      rx="8"
                      fill="#0f172a"
                      stroke="#6366f1"
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      textAnchor="middle"
                      fill="#c7d2fe"
                      fontSize="8"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {edgeLabel.slice(0, 10)}
                    </text>
                  </g>
                );
              })}

              {/* Render Nodes */}
              {allConcepts.map((concept) => {
                const pos = nodeLayout.get(concept.id);
                if (!pos) return null;

                const sizing = getNodeSizing(concept.importance);
                const isSelected = concept.id === selectedConcept?.id;
                const isLiveActive = concept.id === activeConceptDuringPlayback?.id;
                const isFilteredOut = !filteredConcepts.some((f) => f.id === concept.id);

                return (
                  <g
                    key={concept.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => {
                      setSelectedConceptId(concept.id);
                      if (concept.timestampSeconds > 0) {
                        onSeek(concept.timestampSeconds);
                      }
                    }}
                    className="cursor-pointer group"
                    opacity={isFilteredOut ? 0.25 : 1}
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

                    {/* Node Glyphs / Time */}
                    <text
                      textAnchor="middle"
                      dy=".3em"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {concept.timestampSeconds > 0 ? formatTime(concept.timestampSeconds) : `#${concept.id.replace('concept-', '')}`}
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
            <span className="text-slate-500">Drag to pan • Click node to deep dive</span>
          </div>
        </div>

        {/* Right: Selected Node Side Panel with Sources, Flashcards, and Quizzes */}
        <div className="lg:col-span-5 space-y-4">
          {selectedConcept ? (
            <div className="rounded-3xl border border-purple-500/30 bg-slate-950/90 backdrop-blur-xl p-6 shadow-2xl space-y-5 transition-all">
              {/* Header with Type & Seek */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {selectedConcept.type} • {selectedConcept.importance}
                  </span>

                  {selectedConcept.timestampSeconds > 0 && (
                    <button
                      type="button"
                      onClick={() => onSeek(selectedConcept.timestampSeconds)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Seek {selectedConcept.timestampFormatted || formatTime(selectedConcept.timestampSeconds)}</span>
                    </button>
                  )}
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
                  >
                    {speakingExplanation ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{speakingExplanation ? 'Stop Voice' : 'Listen'}</span>
                  </button>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  {selectedConcept.explanation}
                </p>
              </div>

              {/* Source Citation & Verbatim Quote */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" /> Source Citation:
                  </span>
                  <span className="font-mono text-indigo-300">
                    {selectedConcept.sourceCitation?.filename || artifact.title}
                    {selectedConcept.sourceCitation?.pageNumber ? ` (p. ${selectedConcept.sourceCitation.pageNumber})` : ''}
                  </span>
                </div>
                {selectedConcept.verbatimQuote && (
                  <div className="text-xs text-slate-300 italic font-serif border-l-2 border-indigo-500/50 pl-2.5">
                    &ldquo;{selectedConcept.verbatimQuote}&rdquo;
                  </div>
                )}
              </div>

              {/* Related Flashcards for this concept */}
              {relatedFlashcards.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Related Flashcards ({relatedFlashcards.length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {relatedFlashcards.map((card) => (
                      <div key={card.id} className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-200">
                        <div className="font-semibold text-white">{card.front}</div>
                        <div className="text-slate-400 mt-1 line-clamp-1">{card.back}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Quiz Questions for this concept */}
              {relatedQuestions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> Related Quizzes ({relatedQuestions.length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {relatedQuestions.map((q) => (
                      <div key={q.id} className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-200">
                        <div className="font-semibold text-white">{q.question}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites & Dependents Navigation */}
              <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                {prerequisites.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider">Prerequisites:</span>
                    <div className="flex flex-wrap gap-1">
                      {prerequisites.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedConceptId(p.id)}
                          className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 font-medium"
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {dependents.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider">Unlocks:</span>
                    <div className="flex flex-wrap gap-1">
                      {dependents.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSelectedConceptId(d.id)}
                          className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 font-medium"
                        >
                          {d.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-3xl border border-white/10 bg-slate-950/70 text-center text-slate-400">
              Select any node in the graph to view details, formulas, and related practice items.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
