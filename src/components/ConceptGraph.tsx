'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Network, 
  Play, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Info, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { LectureArtifact, ConceptNode } from '@/types/lecture';
import { sanitizeMermaidGraph } from '@/lib/gemini';
import { animateTimestampPulse } from '@/lib/animations';

interface ConceptGraphProps {
  artifact: LectureArtifact;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function ConceptGraph({ artifact, currentTime, onSeek }: ConceptGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptNode | null>(
    artifact.concepts && artifact.concepts.length > 0 ? artifact.concepts[0] : null
  );
  const [isRendering, setIsRendering] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  // Render Mermaid Graph Client-Side
  useEffect(() => {
    if (!artifact.mermaidGraph) return;

    let isSubscribed = true;

    import('mermaid')
      .then(async (mermaidModule) => {
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            darkMode: true,
            background: 'transparent',
            primaryColor: '#1e1b4b',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#6366f1',
            lineColor: '#a855f7',
            secondaryColor: '#311042',
            tertiaryColor: '#082f49',
            fontFamily: 'inherit',
            fontSize: '13px',
          },
          securityLevel: 'loose',
        });

        const sanitized = sanitizeMermaidGraph(artifact.mermaidGraph);
        const graphId = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(graphId, sanitized);

        if (isSubscribed) {
          setSvgContent(svg);
          setRenderError(null);
          setIsRendering(false);
        }
      })
      .catch((err: unknown) => {
        console.warn('[Mermaid Render Warning]:', err);
        if (isSubscribed) {
          setRenderError('Could not render dynamic vector graph. Visualizing structured concept hierarchy below.');
          setIsRendering(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [artifact.mermaidGraph, renderCount]);

  const handleRedraw = () => {
    setIsRendering(true);
    setRenderCount((prev) => prev + 1);
  };

  // Handle clicking on concept cards or graph nodes
  const handleConceptClick = (concept: ConceptNode) => {
    setSelectedConcept(concept);
    onSeek(concept.timestampSeconds);
    animateTimestampPulse(`#concept-card-${concept.id}`);
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case 'foundational':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            Foundational
          </span>
        );
      case 'core':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            Core Concept
          </span>
        );
      case 'advanced':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            Advanced Topic
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Instructions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Prerequisite Dependency Graph
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-normal">
                Bi-Directional Sync
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any concept node to focus its mathematical breakdown and jump media playback to that timestamp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRedraw}
            disabled={isRendering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-slate-300 hover:text-white bg-slate-900 border border-white/10 hover:border-purple-500/30 transition-all"
            title="Redraw Graph"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRendering ? 'animate-spin' : ''}`} />
            <span>Redraw</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Mermaid Graph on Left, Selected Concept Deep-Dive on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Vector Mermaid Diagram Canvas (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-5 shadow-xl overflow-hidden min-h-[420px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Topic Dependency Topography
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {artifact.concepts?.length || 0} Connected Concepts
              </span>
            </div>

            {/* Render Container */}
            <div className="mt-4 flex items-center justify-center min-h-[300px] overflow-x-auto p-2">
              {isRendering ? (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                  <p className="text-xs font-mono">Synthesizing vector graph topology...</p>
                </div>
              ) : svgContent && !renderError ? (
                <div
                  ref={containerRef}
                  className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto transition-transform hover:scale-[1.01]"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-400 max-w-sm">
                    {renderError || 'Interactive SVG topology rendered. Explore the concepts below.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Foundational
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Core Mechanism
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Advanced
              </span>
            </div>
            <span className="text-slate-500">Arrows indicate required prerequisite flow</span>
          </div>
        </div>

        {/* Right: Selected Node Deep Dive & Mathematical Context (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedConcept ? (
            <div
              id={`concept-card-${selectedConcept.id}`}
              className="rounded-2xl border border-purple-500/30 bg-slate-950/90 backdrop-blur-xl p-6 shadow-xl space-y-5 transition-all"
            >
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {getImportanceBadge(selectedConcept.importance)}
                  <button
                    type="button"
                    onClick={() => onSeek(selectedConcept.timestampSeconds)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-400 transition-all shadow-sm shadow-indigo-500/20"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Seek {selectedConcept.timestampFormatted}</span>
                  </button>
                </div>

                <h3 className="text-lg font-bold text-white leading-tight">
                  {selectedConcept.title}
                </h3>
              </div>

              {/* Formula Block (if available) */}
              {selectedConcept.formulaLatex && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 font-mono text-center text-sm text-indigo-300 overflow-x-auto shadow-inner">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Mathematical Formulation:
                  </span>
                  <code>{selectedConcept.formulaLatex}</code>
                </div>
              )}

              {/* Explanation */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-purple-400" /> Pedagogical Explanation:
                </span>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  {selectedConcept.explanation}
                </p>
              </div>

              {/* Key Takeaways */}
              {selectedConcept.keyTakeaways && selectedConcept.keyTakeaways.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-white/5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    Key Conceptual Takeaways:
                  </span>
                  <ul className="space-y-1.5">
                    {selectedConcept.keyTakeaways.map((takeaway, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-normal">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prerequisites Chain */}
              {selectedConcept.prerequisites && selectedConcept.prerequisites.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Required Prior Mastery:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedConcept.prerequisites.map((prereqId) => {
                      const foundPrereq = artifact.concepts.find((c) => c.id === prereqId);
                      return (
                        <button
                          key={prereqId}
                          type="button"
                          onClick={() => foundPrereq && handleConceptClick(foundPrereq)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-white/10 hover:border-indigo-400 text-slate-300 hover:text-white transition-colors"
                        >
                          ← {foundPrereq ? foundPrereq.title : prereqId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/70 text-center text-slate-400">
              Select a node in the graph to view its deep dive.
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Concept Node Strip */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> All Extracted Topic Milestones
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {artifact.concepts?.map((concept) => {
            const isSelected = selectedConcept?.id === concept.id;
            const isPassed = currentTime >= concept.timestampSeconds;

            return (
              <button
                key={concept.id}
                type="button"
                onClick={() => handleConceptClick(concept)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-500/15 scale-[1.02]'
                    : isPassed
                    ? 'border-white/15 bg-slate-900/80 hover:border-white/25'
                    : 'border-white/5 bg-slate-950/60 hover:border-white/15'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[11px] font-mono text-indigo-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {concept.timestampFormatted}
                    </span>
                    {getImportanceBadge(concept.importance)}
                  </div>
                  <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2">
                    {concept.title}
                  </h4>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {concept.summary}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
