'use client';

import React, { useState } from 'react';
import { 
  Sigma, 
  Play, 
  ArrowRight, 
  BookOpen, 
  Clock, 
  CheckCircle2,
  Atom
} from 'lucide-react';
import { LectureArtifact, ConceptNode } from '@/types/lecture';

interface FormulaExplorerProps {
  artifact: LectureArtifact;
  onSeek: (seconds: number) => void;
}

export function FormulaExplorer({ artifact, onSeek }: FormulaExplorerProps) {
  // Filter concepts that have mathematical/logical formulas
  const formulaConcepts: ConceptNode[] = artifact.concepts?.filter((c) => Boolean(c.formulaLatex)) || [];

  const [selectedId, setSelectedId] = useState<string>(
    formulaConcepts.length > 0 ? formulaConcepts[0].id : ''
  );

  if (formulaConcepts.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/70 text-center text-slate-400">
        No mathematical formulas extracted for this lecture.
      </div>
    );
  }

  const activeConcept = formulaConcepts.find((c) => c.id === selectedId) || formulaConcepts[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Sigma className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Smart Mathematical &amp; Logical Formula Explorer
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                {formulaConcepts.length} Formulas
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Deconstruct equations into geometric intuition, symbol glossaries, and prerequisite dependency chains.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Formula Selector List (4 Cols) */}
        <div className="lg:col-span-4 space-y-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block px-1">
            Formulas in Lecture
          </span>

          <div className="space-y-2">
            {formulaConcepts.map((concept) => {
              const isSelected = concept.id === activeConcept.id;

              return (
                <button
                  key={concept.id}
                  type="button"
                  onClick={() => setSelectedId(concept.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-500/15'
                      : 'border-white/10 bg-slate-950/60 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-mono text-indigo-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {concept.timestampFormatted}
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-slate-300">
                      {concept.importance}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-white mb-2">{concept.title}</h3>

                  <div className="p-2 rounded-lg bg-slate-900/90 border border-white/5 font-mono text-[11px] text-indigo-300 truncate">
                    <code>{concept.formulaLatex}</code>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Deconstructed Formula Blueprint (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-xl">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Atom className="w-4 h-4" /> Formula Blueprint
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                {activeConcept.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onSeek(activeConcept.timestampSeconds)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-400 transition-all shadow-md shadow-indigo-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Review at {activeConcept.timestampFormatted}</span>
            </button>
          </div>

          {/* Primary Formula Display */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/30 to-purple-950/30 border border-indigo-500/30 text-center shadow-inner">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300 block mb-3">
              Mathematical / Logical Formulation
            </span>
            <div className="text-lg sm:text-2xl font-mono font-bold text-white tracking-wide overflow-x-auto py-2">
              <code>{activeConcept.formulaLatex}</code>
            </div>
          </div>

          {/* Conceptual Intuition */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" /> Deep Conceptual Rationale:
            </span>
            <p className="text-sm text-slate-200 leading-relaxed font-light">
              {activeConcept.explanation}
            </p>
          </div>

          {/* Key Takeaways */}
          {activeConcept.keyTakeaways && activeConcept.keyTakeaways.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-white/5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Engineering &amp; Exam Insights:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeConcept.keyTakeaways.map((takeaway, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prerequisite Path */}
          {activeConcept.prerequisites && activeConcept.prerequisites.length > 0 && (
            <div className="pt-4 border-t border-white/5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Prerequisite Mastery Sequence:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {activeConcept.prerequisites.map((prereqId, idx) => {
                  const prereq = artifact.concepts?.find((c) => c.id === prereqId);
                  return (
                    <React.Fragment key={prereqId}>
                      {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-slate-500" />}
                      <button
                        type="button"
                        onClick={() => {
                          if (prereq) {
                            onSeek(prereq.timestampSeconds);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-white/10 hover:border-indigo-400 text-slate-300 hover:text-white transition-colors"
                      >
                        {prereq ? prereq.title : prereqId}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
