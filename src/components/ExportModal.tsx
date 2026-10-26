'use client';

import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  Code
} from 'lucide-react';
import { LectureArtifact } from '@/types/lecture';
import { generateObsidianVaultMarkdown, downloadMarkdownFile, printLectureStudySheet } from '@/lib/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: LectureArtifact;
}

export function ExportModal({ isOpen, onClose, artifact }: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);

  if (!isOpen) return null;

  const markdownContent = generateObsidianVaultMarkdown(artifact);
  const filename = `${artifact.id || 'lecture'}-study-pack.md`;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadMarkdownFile(filename, markdownContent);
  };

  const handlePrint = () => {
    printLectureStudySheet(artifact);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
          title="Close export modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Export Academic Study Pack
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                Multi-Format
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Export lecture synthesis, flashcards, LaTeX formulas, and quizzes into your personal knowledge base.
            </p>
          </div>
        </div>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Format 1: Obsidian Vault Markdown */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-purple-500/30 bg-purple-950/20 hover:border-purple-500/50 transition-all space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <FileText className="w-3.5 h-3.5" /> Obsidian Vault (.md)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Markdown</span>
              </div>
              <h3 className="text-base font-bold text-white">Obsidian &amp; PKM Vault</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Complete structured markdown note equipped with YAML frontmatter, bidirectional [[Wikilinks]], #card spaced repetition tags, and LaTeX math.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-md shadow-purple-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all"
                title="Copy markdown text to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Format 2: Printable PDF Master Pack */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 hover:border-indigo-500/50 transition-all space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Printer className="w-3.5 h-3.5" /> Printable PDF
                </span>
                <span className="text-[10px] text-slate-400 font-mono">1-Click</span>
              </div>
              <h3 className="text-base font-bold text-white">1-Click Printable PDF</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Modern academic syllabus format with print-optimized typography, flashcard cutouts, and formula cheat-sheets.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Toggle */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRawMarkdown((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Code className="w-4 h-4" />
              <span>{showRawMarkdown ? 'Hide Raw Markdown Preview' : 'Inspect Generated Obsidian Markdown'}</span>
            </button>

            <span className="text-xs text-slate-500 font-mono">
              {markdownContent.length} bytes
            </span>
          </div>

          {showRawMarkdown && (
            <div className="mt-3 p-4 rounded-2xl bg-slate-950 border border-white/10 max-h-60 overflow-y-auto text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap shadow-inner animate-in fade-in">
              {markdownContent}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
          <span>Client-Side Local Generation • Zero Telemetry</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
